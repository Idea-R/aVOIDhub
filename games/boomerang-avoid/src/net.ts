import { Client, CloseCode, type Room } from '@colyseus/sdk';
import { InputSession } from './input-session';
import { SnapshotClock } from './snapshot-clock';
import { elapsedTicks, interpolateRemote, predictMovement, snapshotIsOrdered, unacknowledged, MAX_PENDING_BATCHES } from './prediction';
import { RoundPreparation, type PrepareRound } from './round-preparation';

import { type Input, type MatchConfig, type MatchState, type Seat } from '@avoid/boomerangavoid-sim';

import { PROTOCOL, CONTENT_HASH, type Snapshot, type Welcome, type InputCommand } from '@avoid/boomerangavoid-protocol';
import { LOCAL_RELEASE } from './release-scope';

export interface OnlineInfo { readonly inputsSuspended:boolean; lastCloseCode:number|null; snapshotAgeMs:number; snapshotLagMs:number; status:'idle'|'connecting'|'lobby'|'playing'|'reconnecting'|'error'; roomId:string; clientId:string; ping:number|null; resultPersistence:'session'|'pending'|'saved'|'unavailable'; region:string; message:string; seats:Seat[]; readyIds:string[]; hostId:string; stage:'lobby'|'loading'|'match'; ownedSeatIds:string[]; public:boolean; config:MatchConfig|null }

export interface OnlineAdapter {

 readonly info:OnlineInfo; create(config:MatchConfig,seat:Seat,party?:Seat[]):Promise<void>;join(roomId:string,seat:Seat,party?:Seat[]):Promise<void>;quickJoin(seat:Seat,party?:Seat[]):Promise<void>;configure(patch:{public?:boolean;bots?:number;botDifficulty?:'easy'|'normal'|'hard';config?:MatchConfig}):void;

 ready(ready:boolean):void;start():void;send(inputs:Record<string,Input>):void;rematch():void;leave():void;suspendInputs():void;

 onState(callback:(state:MatchState)=>void):()=>void;onChange(callback:()=>void):()=>void;
 onPrepare(callback:PrepareRound):()=>void;retryPreparation():void;

}

export function createOnlineAdapter():OnlineAdapter {

 const endpoint=LOCAL_RELEASE?'':(import.meta.env.VITE_BOOMERANGAVOID_SERVER as string|undefined)||(import.meta.env.DEV?'http://127.0.0.1:2777':'');

 const info:OnlineInfo={get inputsSuspended(){return inputSession.paused;},lastCloseCode:null,snapshotAgeMs:0,snapshotLagMs:0,status:'idle',roomId:'',clientId:'',ping:null,resultPersistence:'session',region:'Not connected',message:endpoint?'Private rooms · server-authoritative matches':'Online service is not configured for this build. Practice and Couch Party are available.',seats:[],readyIds:[],hostId:'',stage:'lobby',ownedSeatIds:[],public:false,config:null};

 const callbacks=new Set<()=>void>(),stateCallbacks=new Set<(s:MatchState)=>void>();
 const prepareCallbacks=new Set<PrepareRound>(),preparation=new RoundPreparation();

 let room:Room|undefined,client:Client|undefined,seatIds:string[]=[],sequence=0,snapshot:Snapshot|null=null,lastSnapshotAt=0,loadedRound=-1,pingTimer:ReturnType<typeof setInterval>|undefined,watchdog:ReturnType<typeof setInterval>|undefined;

 let pending:InputCommand[][]=[],prior:MatchState|null=null,priorAt=0,frame=0,lastNotified=0,lastStored=0;
 let inputSession=new InputSession(),clock=new SnapshotClock(performance.now()),lastRecoveryAt=0,terminalMessage='',preparationFailure='';
 const clearQueued=(joined:Room)=>{joined.reconnection.enqueuedMessages.length=0;};
 const suspendInputs=()=>{inputSession.suspend();pending=[];if(room)clearQueued(room);};
 const control=(type:string,value?:unknown)=>{if(room?.connection.isOpen&&!clock.stale(performance.now()))room.send(type,value);};

 const notify=()=>callbacks.forEach(fn=>fn());

 const error=(message:string)=>{info.status='error';info.message=message;notify();};

 function render(){frame=requestAnimationFrame(render);if(!snapshot?.state||info.status!=='playing')return;const now=performance.now();
  if(clock.stale(now)){suspendInputs();return;}
  const view=predictMovement(snapshot.state,pending,seatIds,inputSession.paused?0:elapsedTicks(lastSnapshotAt,now));
  const presentation=interpolateRemote(view,prior,seatIds,priorAt,lastSnapshotAt,now);
  stateCallbacks.forEach(fn=>fn(presentation));
 }

 function prepareLoading(joined:Room){
  const state=snapshot?.state;
  if(room!==joined||snapshot?.stage!=='loading'||!state||loadedRound===state.round)return;
  const key=`${state.config.seed}:${state.round}`;
  preparation.start(key,state,[...prepareCallbacks],()=>{
   if(room!==joined||snapshot?.stage!=='loading'||snapshot.state?.round!==state.round||!joined.connection.isOpen||clock.stale(performance.now())){preparation.cancel();return;}
   preparationFailure='';
   loadedRound=state.round;joined.send('loaded',{contentHash:CONTENT_HASH,round:state.round});
  },failure=>{if(room!==joined||snapshot?.stage!=='loading')return;preparationFailure=`${failure.message} Retry loading or return to the lobby.`;info.message=preparationFailure;notify();});
 }

 async function ticket(intent:string,count:number):Promise<Record<string,unknown>>{

  if(import.meta.env.DEV)return {guest:true};

  const response=await fetch('/api/v1/boomerangavoid/ticket/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:intent,seats:count})});

  if(response.status===401){const next='/boomerangavoid/'+(intent==='create'?'':'?room='+encodeURIComponent(intent));const link='/login/?next='+encodeURIComponent(next);info.message='Sign in on aVOID to join an online party.';location.assign(link);throw new Error('Sign in on aVOID to join online.');}

  if(response.status===403)throw new Error('Online access is restricted for this account.');
  const result=await response.json();if(!response.ok||typeof result.ticket!=='string')throw new Error('The online identity service is not ready. Practice and Couch Party remain available.');return {ticket:result.ticket};

 }

 function bind(joined:Room,resuming=false){preparation.cancel();loadedRound=-1;joined.reconnection.minUptime=0;room=joined;inputSession=new InputSession();if(resuming)inputSession.suspend();clock=new SnapshotClock(performance.now());lastRecoveryAt=performance.now();terminalMessage='';snapshot=null;pending=[];prior=null;sequence=0;info.lastCloseCode=null;seatIds=[joined.sessionId+':0'];info.clientId=joined.sessionId;info.ownedSeatIds=seatIds;info.roomId=joined.roomId;info.status='lobby';info.message='Connected. Ready up when your party arrives.';

  try{sessionStorage.setItem('bav-reconnect',JSON.stringify({endpoint,roomId:joined.roomId,token:joined.reconnectionToken,time:Date.now()}));}catch{}

  joined.onMessage('welcome',(message:Welcome)=>{seatIds=message.seatIds;info.ownedSeatIds=seatIds;info.clientId=message.connectionId;notify();});

  joined.onMessage('snapshot',(s:Snapshot)=>{
   if(room!==joined)return;

   if(s.protocol!==PROTOCOL||s.contentHash!==CONTENT_HASH){terminalMessage='Game version changed. Refresh to continue.';error(terminalMessage);void joined.leave();return;}

   if(!snapshotIsOrdered(snapshot,s))return;
   const arrivedAt=performance.now();if(clock.stale(arrivedAt))suspendInputs();const fresh=clock.accept(s.serverTime,arrivedAt);info.snapshotLagMs=Math.round(clock.arrivalLagMs);if(!fresh)return;info.snapshotAgeMs=0;
   const oldRound=snapshot?.state?.round;prior=snapshot?.state??null;priorAt=lastSnapshotAt;snapshot=s;lastSnapshotAt=performance.now();

   seatIds=s.seats.filter(seat=>seat.connectionId===joined.sessionId).map(seat=>seat.id);info.ownedSeatIds=seatIds;info.config=s.config;info.public=s.public;info.stage=s.stage;info.resultPersistence=s.resultPersistence??'session';info.roomId=s.roomId;info.hostId=s.ownerId;info.region=s.region;info.seats=s.seats.filter(x=>!x.spectator);info.readyIds=s.seats.filter(x=>x.ready).map(x=>x.id);info.status=s.stage==='match'?'playing':'lobby';info.message=(s.stage==='loading'&&preparationFailure)||s.message||(s.stage==='match'?(inputSession.paused?'Release controls, then press movement or an action to resume.':'Match continues while menus are open.'):'Ready up when your party is here.');

   pending=s.state?unacknowledged(pending,s.ack,s.state.round,seatIds):[];

   if(oldRound!==s.state?.round){pending=[];loadedRound=-1;preparationFailure='';preparation.cancel();prior=null;}
   if(s.stage!=='match')pending=[];
   if(s.stage!=='loading'){preparation.cancel();preparationFailure='';}

   if(s.stage==='loading'&&s.state&&loadedRound!==s.state.round){stateCallbacks.forEach(fn=>fn(structuredClone(s.state!)));prepareLoading(joined);}

   if(Date.now()-lastStored>2000){lastStored=Date.now();try{sessionStorage.setItem('bav-reconnect',JSON.stringify({endpoint,roomId:joined.roomId,token:joined.reconnectionToken,time:Date.now()}));}catch{}}

   if(performance.now()-lastNotified>100||s.stage!=='match'){notify();lastNotified=performance.now();}

  });

  joined.onMessage('notice',(message:string)=>{info.message=message;notify();});

  joined.onMessage('pong',(at:number)=>{info.ping=Math.round(performance.now()-at);notify();});

  joined.onDrop((code)=>{if(room!==joined)return;preparation.cancel();info.lastCloseCode=code;suspendInputs();loadedRound=-1;lastRecoveryAt=performance.now();info.status='reconnecting';info.message='Connection lost. Holding your seats for up to 20 seconds.';notify();});
  joined.onReconnect(()=>{if(room!==joined)return;preparation.cancel();suspendInputs();clock=new SnapshotClock(performance.now());loadedRound=-1;lastRecoveryAt=performance.now();info.status='reconnecting';info.message='Connected. Waiting for current room state.';notify();});
  joined.onError((code)=>{if(room===joined)info.lastCloseCode=code;});
  joined.onLeave((code)=>{if(room!==joined)return;preparation.cancel();clearQueued(joined);room=undefined;if(frame)cancelAnimationFrame(frame);frame=0;snapshot=null;prior=null;if(pingTimer)clearInterval(pingTimer);if(watchdog)clearInterval(watchdog);pingTimer=watchdog=undefined;suspendInputs();info.lastCloseCode=code;try{sessionStorage.removeItem('bav-reconnect');}catch{}info.status='error';info.message=terminalMessage||(code===4003?'The 20-second seat lease ended. Join the party again or create a new room.':code===4008?'Connection sent too many commands. Rejoin the room to continue.':'Room connection ended. Join again, create a room or return to practice.');notify();});
  pingTimer=setInterval(()=>{if(room===joined&&joined.connection.isOpen)joined.send('ping',performance.now());},2000);
  watchdog=setInterval(()=>{
   if(room!==joined)return;const now=performance.now();info.snapshotAgeMs=Math.round(clock.age(now));
   if(clock.stale(now)&&info.status!=='reconnecting'){suspendInputs();info.status='reconnecting';info.message='Waiting for current room state. Controls are released.';notify();}
   // Request recovery before the server lease expires, without extending it.
   if(clock.age(now)>5000&&now-lastRecoveryAt>5000&&joined.connection.isOpen){lastRecoveryAt=now;suspendInputs();joined.connection.close(CloseCode.MAY_TRY_RECONNECT);}
  },250);if(!frame)frame=requestAnimationFrame(render);notify();
 }

 async function connect(intent:string,seat:Seat,config?:MatchConfig,party:Seat[]=[seat]){

  if(!endpoint)throw new Error(info.message);if(room)leave();info.status='connecting';info.message='Connecting to the garden…';notify();

  try{client=new Client(endpoint);const auth=await ticket(intent,party.length);const options={...auth,protocol:PROTOCOL,contentHash:CONTENT_HASH,intent,name:seat.name,character:seat.character,characters:party.map(s=>s.character),localSeats:party.length,config};const joined=intent==='create'?await client.create('boomerangavoid',options):await client.joinById(intent,options);bind(joined);}catch(e){const message=e instanceof Error?e.message:'Room connection failed.';error(message);throw e;}

 }

 function leave(){preparation.cancel();loadedRound=-1;const old=room;room=undefined;if(old)clearQueued(old);void old?.leave();if(pingTimer)clearInterval(pingTimer);pingTimer=undefined;if(watchdog)clearInterval(watchdog);watchdog=undefined;suspendInputs();if(frame)cancelAnimationFrame(frame);frame=0;snapshot=null;pending=[];seatIds=[];info.status='idle';info.seats=[];info.readyIds=[];info.ownedSeatIds=[];try{sessionStorage.removeItem('bav-reconnect');}catch{}notify();}

 // Resume only this tab's short seat lease; invitation URLs never carry the token.

 queueMicrotask(async()=>{if(!endpoint||room)return;let saved;try{saved=JSON.parse(sessionStorage.getItem('bav-reconnect')??'null');}catch{return;}const invite=new URL(location.href).searchParams.get('room');

  if(!saved||saved.endpoint!==endpoint||typeof saved.token!=='string'||Date.now()-saved.time>22000||(invite&&invite!==saved.roomId))return;

  info.status='reconnecting';info.message='Restoring your party seats…';notify();try{client=new Client(endpoint);const resumed=await client.reconnect(saved.token);bind(resumed,true);}catch{try{sessionStorage.removeItem('bav-reconnect');}catch{}error('The seat lease ended. Join the party again, or start a new room.');}

 });

 return {info,

  create:(config,seat,party)=>connect('create',seat,config,party),join:(id,seat,party)=>connect(id.trim(),seat,undefined,party),configure:patch=>control('configure',patch),

  async quickJoin(seat,party=[seat]){if(!endpoint)throw new Error(info.message);const response=await fetch(endpoint.replace(/^ws/,'http')+'/rooms');if(!response.ok)throw new Error('Room discovery is unavailable. Try an invitation.');const available=await response.json() as {roomId:string;seats:number;protocol:string}[];const candidate=available.find(r=>r.seats+party.length<=6&&r.protocol===PROTOCOL);if(!candidate){info.message='No open rooms. Create a private room or play Practice.';notify();throw new Error(info.message);}await connect(candidate.roomId,seat,undefined,party);},

  ready:value=>control('ready',value),start:()=>control('start'),

  send(inputs){
   if(!room||!room.connection.isOpen||!snapshot?.state||info.status!=='playing'||document.hidden||clock.stale(performance.now()))return;
   const state=snapshot.state,wasPaused=inputSession.paused,values=inputSession.map(inputs,seatIds);
   if(wasPaused&&!inputSession.paused){info.message='Match continues while menus are open.';notify();}
   const batch=seatIds.map(id=>({...values[id],seatId:id,sequence:++sequence,round:state.round,tick:state.tick+elapsedTicks(lastSnapshotAt,performance.now())}));
   if(!batch.length)return;pending.push(batch);if(pending.length>MAX_PENDING_BATCHES)pending.shift();room.send('input',batch);
  },

  rematch:()=>control('rematch'),leave,suspendInputs,

  onState(fn){stateCallbacks.add(fn);return()=>stateCallbacks.delete(fn);},onChange(fn){callbacks.add(fn);return()=>callbacks.delete(fn);},
  onPrepare(fn){prepareCallbacks.add(fn);return()=>prepareCallbacks.delete(fn);},retryPreparation(){if(!room||snapshot?.stage!=='loading')return;preparation.cancel();loadedRound=-1;preparationFailure='';info.message='Retrying arena assets.';notify();prepareLoading(room);}

 };

}
