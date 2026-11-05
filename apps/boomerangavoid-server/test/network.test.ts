import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { PROTOCOL, CONTENT_HASH, type Snapshot } from '@avoid/boomerangavoid-protocol';
import { mintTicket } from '@avoid/boomerangavoid-protocol/tickets';
import { NEUTRAL, getBotInputs } from '@avoid/boomerangavoid-sim';
const endpoint=process.env.BAV_TEST_ENDPOINT??'http://127.0.0.1:2777';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Timed out waiting for authoritative room state');await delay(30);}}
for(let i=0;i<100;i++){if(await fetch(endpoint+'/health').then(r=>r.ok).catch(()=>false))break;if(i===99)throw new Error('Test endpoint did not become healthy');await delay(100);}
const health=await fetch(endpoint+'/health').then(r=>r.json()) as {ticketEpoch:string};const ticketAudience='boomerangavoid:'+health.ticketEpoch;
test('six real clients share authoritative rounds, enforce ownership, expire input and reconnect',{timeout:240000},async()=>{
 const clients:Room[]=[];const views=new Map<string,Snapshot>();const observedEvents=new Set<string>();let timer:ReturnType<typeof setInterval>|undefined;let driverMemory:unknown={};
 const bind=(room:Room)=>{clients.push(room);room.onMessage('snapshot',(s:Snapshot)=>{views.set(room.sessionId,s);for(const e of s.state?.events??[])observedEvents.add(e.type);if(s.stage==='loading'&&s.state)room.send('loaded',{contentHash:CONTENT_HASH,round:s.state.round});});room.onMessage('welcome',()=>{});room.onMessage('notice',()=>{});room.onMessage('pong',()=>{});};
 try{
  await assert.rejects(new Client(endpoint).create('boomerangavoid',{guest:true,protocol:'invalid',contentHash:CONTENT_HASH}),/version/i);
  const options={guest:true,protocol:PROTOCOL,contentHash:CONTENT_HASH,intent:'create',name:'Network test',localSeats:1,config:{mode:'ffa',wins:3,mapId:'moss-court',seed:123,friendlyFire:false,upgrades:false}};
  const host=await new Client(endpoint).create('boomerangavoid',options);bind(host);
  for(let i=1;i<6;i++)bind(await new Client(endpoint).joinById(host.roomId,{...options,intent:host.roomId,name:'Test '+i}));
  await until(()=>clients.every(c=>views.get(c.sessionId)?.seats.length===6));
  await assert.rejects(new Client(endpoint).joinById(host.roomId,{...options,intent:host.roomId,localSeats:2}),/seats/i);
  for(const c of clients)c.send('ready',true);await until(()=>views.get(host.sessionId)?.seats.every(s=>s.ready)===true);host.send('start');
  await until(()=>views.get(host.sessionId)?.state?.phase==='playing');
  const first=views.get(host.sessionId)!;assert.equal(first.state!.players.length,6);const own=host.sessionId+':0';const foreign=clients[1].sessionId+':0';
  host.send('input',[{...NEUTRAL,mx:1,seatId:foreign,sequence:900,tick:first.state!.tick,round:1}]);
  host.send('input',[{...NEUTRAL,mx:1,score:100000,seatId:own,sequence:901,tick:first.state!.tick,round:1}]);
  await delay(100);assert.equal(views.get(host.sessionId)!.state!.players.every(p=>p.score===0),true);assert.equal(views.get(host.sessionId)!.ack[foreign],undefined);
  let seq=1000;let s=views.get(host.sessionId)!.state!;host.send('input',[{...NEUTRAL,mx:1,seatId:own,sequence:seq++,tick:s.tick,round:s.round}]);
  await until(()=>(views.get(host.sessionId)?.ack[own]??-1)>=seq-1);const acceptedAt=views.get(host.sessionId)!.state!.tick;await until(()=>(views.get(host.sessionId)?.state?.tick??0)>acceptedAt+20);s=views.get(host.sessionId)!.state!;const p=s.players.find(p=>p.id===own)!;assert.ok(Math.abs(p.vx)<.001,'Frozen connected client must stop without socket disconnect');
  const before=s.players.find(p=>p.id===foreign)!.alive;let dropped=false,reconnected=false;const peer=clients[1];peer.onDrop(()=>{dropped=true;});peer.onReconnect(()=>{reconnected=true;});peer.reconnection.minUptime=0;peer.connection.close();
  await until(()=>dropped&&reconnected,15000);await until(()=>views.get(host.sessionId)!.seats.find(s=>s.id===foreign)?.connected===true);assert.equal(views.get(host.sessionId)!.state!.players.find(p=>p.id===foreign)!.alive,before);
  // Each independent SDK connection drives only its own seat through legal commands.
  timer=setInterval(()=>{const latest=views.get(host.sessionId);if(!latest?.state||latest.stage!=='match')return;const frame=structuredClone(latest.state);for(const p of frame.players)p.bot='hard';if(frame.internal)frame.internal.bots=driverMemory as NonNullable<typeof frame.internal>['bots'];const inputs=getBotInputs(frame);driverMemory=frame.internal?.bots??{};for(const c of clients){const id=c.sessionId+':0';const state=views.get(c.sessionId)?.state;if(state)c.send('input',[{...(inputs[id]??NEUTRAL),seatId:id,sequence:seq++,tick:state.tick,round:state.round}]);}},1000/60);
  await until(()=>views.get(host.sessionId)?.state?.phase==='matchResults',180000);
  clearInterval(timer);timer=undefined;await delay(100);const results=clients.map(c=>views.get(c.sessionId)!.state!);assert.equal(new Set(results.map(s=>JSON.stringify(s.matchWinnerIds))).size,1);assert.ok(results[0].matchWinnerIds.length>0);assert.ok(results[0].players.some(p=>p.score===3));assert.ok(observedEvents.has('throw'),'Action events must survive snapshot gaps');assert.ok(observedEvents.has('death'),'Authoritative elimination events must reach clients');
  const metrics=await fetch(endpoint+'/metrics').then(r=>r.json()) as {roomMetrics:{rejectedInputs:number;tickP95Ms:number}[]};assert.ok(metrics.roomMetrics.some(r=>r.rejectedInputs>=2));
  console.log(JSON.stringify({case:'six-seat-live-authority',protocol:PROTOCOL,contentHash:CONTENT_HASH,roomId:host.roomId,players:6,round:results[0].round,winners:results[0].matchWinnerIds,reconnect:true,staleInputStops:true,metrics}));
  host.send('rematch');await until(()=>views.get(host.sessionId)?.stage==='lobby');assert.equal(views.get(host.sessionId)!.seats.length,6);
 }finally{if(timer)clearInterval(timer);await Promise.all(clients.map(c=>c.leave()));}
});

test('create tickets cannot join a different room by spoofing intent',{skip:!process.env.BAV_TEST_TICKET_SECRET,timeout:20000},async()=>{
 const secret=process.env.BAV_TEST_TICKET_SECRET!;const make=(userId:string,room:string)=>mintTicket({userId,name:'Ticket fixture',room,audience:ticketAudience,seats:1},secret);
 const base={protocol:PROTOCOL,contentHash:CONTENT_HASH,intent:'create'};
 const room=await new Client(endpoint).create('boomerangavoid',{...base,ticket:make('fixture-owner','create')});room.onMessage('*',()=>{});
 try{await assert.rejects(new Client(endpoint).joinById(room.roomId,{...base,ticket:make('fixture-attacker','create')}),/Sign in/i);
  const guest=await new Client(endpoint).joinById(room.roomId,{...base,ticket:make('fixture-friend',room.roomId)});guest.onMessage('*',()=>{});await guest.leave();
 }finally{await room.leave();}
});
