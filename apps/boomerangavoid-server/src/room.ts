import { runtimeStatus } from './runtime';
import { Room, ServerError, type Client } from '@colyseus/core';
import { randomBytes, createHash } from 'node:crypto';
import { ARENAS, CHARACTERS, createMatch, step, getBotInputs, releaseRelaySeed, addSeatsAtRoundBoundary, type MatchConfig, type MatchState, type Seat, type GameEvent } from '@avoid/boomerangavoid-sim';
import { PROTOCOL, CONTENT_HASH, InputBuffer, parseInput, parseConfig, record, safeName, type Snapshot, type PartySeat } from '@avoid/boomerangavoid-protocol';
import { TicketVerifier } from '@avoid/boomerangavoid-protocol/tickets';
const tickets=new TicketVerifier(process.env.BOOMERANGAVOID_TICKET_SECRET??'',(process.env.BOOMERANGAVOID_TICKET_AUDIENCE??'boomerangavoid')+':'+runtimeStatus.ticketEpoch);
const localGuests=process.env.NODE_ENV!=='production'&&process.env.BAV_ALLOW_GUESTS==='1';
export const rooms=new Set<GardenRoom>();
interface Identity { userId:string;name:string;seats:number;guest:boolean }
interface Member { id:string; seats:string[]; connected:boolean; ready:boolean; loaded:boolean; userId:string; guest:boolean; window:number; packets:number }
const characterIds=['pip','kiln','volt','nori','cairn','comet'] as const;
const colors=[0x93d66a,0xf3a46a,0xffd96b,0x78d7bb,0xb6acf1,0xfb91b6];
export class GardenRoom extends Room {
 maxClients=10;
 autoDispose=true;
 private members=new Map<string,Member>();
 private seats:PartySeat[]=[];
 private owner='';
 private creationTicketHash='';
 private creatorClaimed=false;
 private stage:'lobby'|'loading'|'match'='lobby';
 private game:MatchState|null=null;
 private config:MatchConfig={mode:'ffa',wins:5,mapId:ARENAS[0].id,seed:0,friendlyFire:false,upgrades:true};
 private commandBuffer=new InputBuffer();
 private isPublic=false;
 private loadingUntil=0;
 private message='Ready up when your party is here.';
 private previousRound=-1;
 private eventHistory:GameEvent[]=[];
 private tickTimes:number[]=[];
 private rejected=0;
 private accumulator=0;
 private snapshotTick=0;
 onCreate(options:unknown) {
  if(runtimeStatus.draining)throw new ServerError(503,'The garden is restarting. Please try again shortly.');
  if(rooms.size>=Number(process.env.BAV_MAX_ROOMS??20))throw new ServerError(503,'The garden is full. Try again shortly.');
  const o=record(options)?options:{};
  if(!localGuests&&!tickets.verify(o.ticket,'create',Date.now(),false))throw new ServerError(401,'Sign in on aVOID before creating a room.');
  rooms.add(this);
  if(typeof o.ticket==='string')this.creationTicketHash=createHash('sha256').update(o.ticket).digest('hex');
  const config=parseConfig(o.config);if(config)this.config=config;
  this.config.seed=randomBytes(4).readUInt32BE(0);
  this.metadata={public:false,protocol:PROTOCOL,stage:'lobby',seats:0,region:process.env.BAV_REGION??'Local development'};
  this.setSimulationInterval((dt)=>this.update(dt),1000/60);
 }
 onAuth(_client:Client,options:unknown):Identity {
  if(runtimeStatus.draining)throw new ServerError(503,'The garden is restarting. Please try again shortly.');
  if(!record(options)||options.protocol!==PROTOCOL||options.contentHash!==CONTENT_HASH)throw new ServerError(409,'Game version changed. Refresh to join.');
  const matchesCreator=!this.creatorClaimed&&typeof options.ticket==='string'&&this.creationTicketHash!==''&&createHash('sha256').update(options.ticket).digest('hex')===this.creationTicketHash;
  const target=matchesCreator?'create':this.roomId;
  const ticket=tickets.verify(options.ticket,target);
  if(ticket){if(matchesCreator)this.creatorClaimed=true;return {userId:ticket.userId,name:ticket.name,seats:ticket.seats,guest:false};}
  if(localGuests&&options.guest===true){const n=Number(options.localSeats??1);if(!Number.isInteger(n)||n<1||n>6)throw new ServerError(400,'Invalid local party size.');return {userId:'local:'+_client.sessionId,name:safeName(options.name),seats:n,guest:true};}
  throw new ServerError(401,'Sign in on aVOID before joining online.');
 }
 async onJoin(client:Client,options:unknown) {
  if(runtimeStatus.draining)throw new ServerError(503,'The garden is restarting. Please try again shortly.');
  const identity=client.auth as Identity;
  // A single account may have one live party connection in a room.
  if([...this.members.values()].some(m=>m.userId===identity.userId))throw new ServerError(409,'This account is already in the room. Reconnect your original tab.');
  const o=record(options)?options:{};
  const spectator=o.spectate===true||this.stage!=='lobby';
  const active=this.seats.filter(s=>!s.spectator).length;
  if(!spectator&&active+identity.seats>6)throw new ServerError(409,'There are not enough seats for your whole party.');
  if(spectator&&this.seats.filter(s=>s.spectator).length+identity.seats>4)throw new ServerError(409,'Spectator seats are full.');
  const count=identity.seats;
  const ids:string[]=[];
  for(let i=0;i<count;i++){
   const index=active+i;const id=client.sessionId+':'+i;ids.push(id);
   const requested=Array.isArray(o.characters)?o.characters[i]:i===0?o.character:null;
   this.seats.push({id,name:identity.name+(i?' · Guest '+(i+1):''),character:characterIds.includes(requested as never)?requested as Seat['character']:characterIds[index%6],color:colors[index%6],team:index%2,bot:null,connectionId:client.sessionId,ready:false,connected:true,spectator});
  }
  this.members.set(client.sessionId,{id:client.sessionId,seats:ids,connected:true,ready:false,loaded:false,userId:identity.userId,guest:identity.guest,window:Date.now(),packets:0});
  if(!this.owner&&!spectator)this.owner=client.sessionId;
  client.send('welcome',{seatIds:ids,connectionId:client.sessionId,guest:identity.guest});
  await this.updateMetadata();this.sendSnapshot();
 }
 messages={
  input:(client:Client,payload:unknown)=>{
   const member=this.accept(client);if(!member||this.stage!=='match'||!this.game)return;
   if(!Array.isArray(payload)||payload.length<1||payload.length>6){this.rejected++;return;}
   for(const value of payload){const command=parseInput(value);if(!command||!this.commandBuffer.enqueue(command,member.seats,this.game.tick,this.game.round))this.rejected++;}
  },
  ready:(client:Client,payload:unknown)=>{const m=this.accept(client);if(!m||this.stage!=='lobby'||typeof payload!=='boolean')return;m.ready=payload;for(const s of this.seats.filter(s=>s.connectionId===m.id))s.ready=payload;this.sendSnapshot();},
  loaded:(client:Client,payload:unknown)=>{const m=this.accept(client);if(!m||this.stage!=='loading'||!record(payload))return;if(payload.contentHash!==CONTENT_HASH||payload.round!==(this.game?.round??1)){client.send('notice','The arena version differs. Refresh, or watch this match.');return;}m.loaded=true;this.beginWhenLoaded();},
  configure:(client:Client,payload:unknown)=>{if(!this.accept(client)||client.sessionId!==this.owner||this.stage!=='lobby'||!record(payload))return;
   const cfg=parseConfig(payload.config);if(cfg)this.config={...cfg,seed:this.config.seed};
   if(typeof payload.public==='boolean')this.isPublic=payload.public;
   const bots=typeof payload.bots==='number'&&Number.isInteger(payload.bots)?Math.max(0,Math.min(5,payload.bots)):this.seats.filter(s=>s.bot!==null).length;
   this.seats=this.seats.filter(s=>s.bot===null);const available=6-this.seats.filter(s=>!s.spectator).length;
   for(let i=0;i<Math.min(bots,available);i++){const index=this.seats.filter(s=>!s.spectator).length;this.seats.push({id:'bot:'+i,name:CHARACTERS[index%CHARACTERS.length].name+' · Bot',character:characterIds[index%6],color:colors[index%6],team:index%2,bot:'normal',connectionId:'server',ready:true,connected:true,spectator:false});}
   for(const m of this.members.values())m.ready=false;for(const s of this.seats)if(!s.bot)s.ready=false;
   void this.updateMetadata();this.sendSnapshot();
  },
  start:(client:Client)=>{if(!this.accept(client)||client.sessionId!==this.owner||this.stage!=='lobby')return;
   const active=this.seats.filter(s=>!s.spectator);if(active.length<2||!active.every(s=>s.ready&&s.connected)){this.notice(client,'Two or more players must be connected and ready.');return;}
   if(this.config.mode!=='ffa'&&new Set(active.map(s=>s.team)).size<2){this.notice(client,'Both teams need a player.');return;}
   this.game=createMatch(this.config,active);this.loadRound();
  },
  rematch:(client:Client)=>{if(!this.accept(client)||this.stage!=='match'||this.game?.phase!=='matchResults'||client.sessionId!==this.owner)return;this.enterLobby('Same party. Ready for a rematch?');},
  ping:(client:Client,value:unknown)=>{if(this.accept(client)&&typeof value==='number'&&Number.isFinite(value))client.send('pong',value);},
  '*':(_client:Client)=>{this.rejected++;},
 };
 private accept(client:Client):Member|null {const m=this.members.get(client.sessionId);if(!m||!m.connected)return null;const now=Date.now();if(now-m.window>=1000){m.window=now;m.packets=0;}if(++m.packets>100){this.rejected++;if(m.packets>300)client.leave(4008);return null;}return m;}
 private notice(client:Client,message:string){client.send('notice',message);}
 private loadRound(){this.eventHistory=[];this.stage='loading';this.loadingUntil=Date.now()+20000;for(const m of this.members.values())m.loaded=false;this.commandBuffer.reset();this.message='Preparing the garden. Every player must finish loading.';void this.updateMetadata();this.sendSnapshot();}
 private beginWhenLoaded(){if(this.stage!=='loading'||!this.game)return;const active=new Set(this.seats.filter(s=>!s.spectator&&!s.bot).map(s=>s.connectionId));if([...active].every(id=>this.members.get(id)?.loaded&&this.members.get(id)?.connected)){this.stage='match';this.previousRound=this.game.round;this.message='';this.commandBuffer.reset();void this.updateMetadata();this.sendSnapshot();}}
 private update(dt:number){const started=performance.now();
  if(this.stage==='loading'&&Date.now()>this.loadingUntil){
   // Do not spawn anyone with missing content. Return to lobby rather than starting an incomplete match.
   this.enterLobby('Loading timed out. Reconnect or refresh, then ready up again.');
  }
  if(this.stage==='match'&&this.game){
   this.accumulator+=Math.min(dt,100);let loops=0;
   while(this.accumulator>=1000/60&&loops++<5){
    const inputs=getBotInputs(this.game);for(const s of this.seats)if(!s.bot&&!s.spectator)inputs[s.id]=this.commandBuffer.consume(s.id,this.game.tick);
    step(this.game,inputs);this.eventHistory=[...new Map([...this.eventHistory,...this.game.events].map(e=>[e.id,e])).values()].filter(e=>e.tick>=this.game!.tick-120).slice(-256);this.accumulator-=1000/60;
    if(this.game.round!==this.previousRound){
     const retained=new Set(this.seats.filter(s=>s.bot||this.members.has(s.connectionId)).map(s=>s.id));
     this.seats=this.seats.filter(s=>retained.has(s.id));this.game.players=this.game.players.filter(p=>retained.has(p.id));this.game.weapons=this.game.weapons.filter(w=>retained.has(w.ownerId));
     this.promoteWaitingParties();
     if(this.game.players.length<2||(this.config.mode!=='ffa'&&new Set(this.game.players.map(p=>p.team)).size<2)){this.enterLobby('The party needs more players before the next round.');}else this.loadRound();break;
    }
   }
   if(loops>5){this.accumulator=0;this.message='Server is catching up.';}
  }
  if(++this.snapshotTick%3===0)this.sendSnapshot();
  this.tickTimes.push(performance.now()-started);if(this.tickTimes.length>3600)this.tickTimes.shift();
 }
 snapshot():Snapshot {return {protocol:PROTOCOL,contentHash:CONTENT_HASH,roomId:this.roomId,ownerId:this.owner,region:process.env.BAV_REGION??'Local development',public:this.isPublic,stage:this.stage,message:this.message,seats:this.seats,config:this.config,state:this.game?{...this.game,events:this.eventHistory}:null,ack:this.commandBuffer.acknowledgements(),serverTime:Date.now()};}
 private promoteWaitingParties(){
  for(const m of this.members.values()){
   const waiting=this.seats.filter(s=>s.connectionId===m.id&&s.spectator);
   const active=this.seats.filter(s=>!s.spectator).length;
   if(!m.connected||!waiting.length||active+waiting.length>6)continue;
   if(this.game&&!addSeatsAtRoundBoundary(this.game,waiting))continue;
   for(const seat of waiting)seat.spectator=false;
  }
 }
 private enterLobby(message:string){this.stage='lobby';this.game=null;this.eventHistory=[];this.commandBuffer.reset();this.seats=this.seats.filter(s=>s.bot||this.members.has(s.connectionId));this.promoteWaitingParties();for(const m of this.members.values()){m.ready=false;m.loaded=false;}for(const s of this.seats)s.ready=!!s.bot;this.owner=[...this.members.values()].find(m=>m.id===this.owner&&m.connected)?.id??[...this.members.values()].find(m=>m.connected)?.id??'';this.message=message;void this.updateMetadata();this.sendSnapshot();}
 private sendSnapshot(){this.broadcast('snapshot',this.snapshot());}
 private async updateMetadata(){await this.setMetadata({public:this.isPublic,protocol:PROTOCOL,stage:this.stage,seats:this.seats.filter(s=>!s.spectator).length,region:process.env.BAV_REGION??'Local development'});}
 onDrop(client:Client){const m=this.members.get(client.sessionId);if(!m)return;if(m){m.connected=false;m.loaded=false;for(const id of m.seats)this.commandBuffer.clear(id);for(const s of this.seats.filter(s=>s.connectionId===m.id))s.connected=false;
  if(this.game)for(const id of m.seats)releaseRelaySeed(this.game,id);
 }this.allowReconnection(client,20);this.sendSnapshot();}
 onReconnect(client:Client){const m=this.members.get(client.sessionId);if(!m)return;m.connected=true;m.loaded=false;if(!this.owner)this.owner=m.id;for(const s of this.seats.filter(s=>s.connectionId===m.id))s.connected=true;for(const id of m.seats)this.commandBuffer.clear(id);client.send('welcome',{seatIds:m.seats,connectionId:m.id,guest:m.guest});this.sendSnapshot();}
 async onLeave(client:Client){const m=this.members.get(client.sessionId);if(!m)return;if(this.game)for(const id of m.seats)releaseRelaySeed(this.game,id);for(const id of m.seats)this.commandBuffer.clear(id);this.members.delete(client.sessionId);
  if(this.stage==='lobby')this.seats=this.seats.filter(s=>s.connectionId!==client.sessionId);else for(const s of this.seats.filter(s=>s.connectionId===client.sessionId))s.connected=false;
  if(this.owner===client.sessionId)this.owner=[...this.members.values()].find(m=>m.connected)?.id??'';
  await this.updateMetadata();this.sendSnapshot();
 }
 onDispose(){rooms.delete(this);}
 metrics(){const sorted=[...this.tickTimes].sort((a,b)=>a-b);return {seats:this.seats.length,rejectedInputs:this.rejected,tickP95Ms:sorted[Math.floor(sorted.length*.95)]??0};}
 drain(){this.broadcast('notice','The garden is restarting. Current play has up to 25 seconds; unfinished matches end without an awarded result. Please create a new room afterward.');}
}
