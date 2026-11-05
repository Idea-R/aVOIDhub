import { Client, type Room } from '@colyseus/sdk';

import { step, type Input, type MatchConfig, type MatchState, type Seat } from '@avoid/boomerangavoid-sim';

import { PROTOCOL, CONTENT_HASH, type Snapshot, type Welcome, type InputCommand } from '@avoid/boomerangavoid-protocol';

export interface OnlineInfo { status:'idle'|'connecting'|'lobby'|'playing'|'reconnecting'|'error'; roomId:string; clientId:string; ping:number|null; region:string; message:string; seats:Seat[]; readyIds:string[]; hostId:string; stage:'lobby'|'loading'|'match'; ownedSeatIds:string[]; public:boolean; config:MatchConfig|null }

export interface OnlineAdapter {

 readonly info:OnlineInfo; create(config:MatchConfig,seat:Seat,party?:Seat[]):Promise<void>;join(roomId:string,seat:Seat,party?:Seat[]):Promise<void>;quickJoin(seat:Seat,party?:Seat[]):Promise<void>;configure(patch:{public?:boolean;bots?:number;config?:MatchConfig}):void;

 ready(ready:boolean):void;start():void;send(inputs:Record<string,Input>):void;rematch():void;leave():void;

 onState(callback:(state:MatchState)=>void):()=>void;onChange(callback:()=>void):()=>void;

}

export function createOnlineAdapter():OnlineAdapter {

 const endpoint=(import.meta.env.VITE_BOOMERANGAVOID_SERVER as string|undefined)||(import.meta.env.DEV?'http://127.0.0.1:2777':'');

 const info:OnlineInfo={status:'idle',roomId:'',clientId:'',ping:null,region:'Not connected',message:endpoint?'Private rooms · server-authoritative matches':'Online service is not configured for this build. Practice and Couch Party are available.',seats:[],readyIds:[],hostId:'',stage:'lobby',ownedSeatIds:[],public:false,config:null};

 const callbacks=new Set<()=>void>(),stateCallbacks=new Set<(s:MatchState)=>void>();

 let room:Room|undefined,client:Client|undefined,seatIds:string[]=[],sequence=0,snapshot:Snapshot|null=null,lastSnapshotAt=0,loadedRound=-1,pingTimer:ReturnType<typeof setInterval>|undefined;

 let pending:InputCommand[][]=[],prior:MatchState|null=null,priorAt=0,frame=0,paused=false,waitNeutral=false,lastNotified=0,lastStored=0;

 const notify=()=>callbacks.forEach(fn=>fn());

 const error=(message:string)=>{info.status='error';info.message=message;notify();};

 function render(){frame=requestAnimationFrame(render);if(!snapshot?.state||info.status!=='playing')return;const now=performance.now();const view=structuredClone(snapshot.state);

  // Predict movement only. Authority alone changes hits, life, weapons, points and results.

  if(!paused&&pending.length&&view.phase==='playing'){

   const prediction=structuredClone(view);

   for(const batch of pending.slice(-12)){const input=Object.fromEntries(batch.map(c=>[c.seatId,c]));step(prediction,input);}

   for(const id of seatIds){const dest=view.players.find(p=>p.id===id),src=prediction.players.find(p=>p.id===id);if(dest&&src&&dest.alive){dest.x=src.x;dest.y=src.y;dest.vx=src.vx;dest.vy=src.vy;dest.fx=src.fx;dest.fy=src.fy;dest.dashUntil=src.dashUntil;}}

  }

  if(prior&&prior.round===view.round){const alpha=Math.max(0,Math.min(1,(now-lastSnapshotAt)/Math.max(1,lastSnapshotAt-priorAt)));for(const p of view.players){if(seatIds.includes(p.id))continue;const old=prior.players.find(q=>q.id===p.id);if(old&&old.alive===p.alive){p.x=old.x+(p.x-old.x)*alpha;p.y=old.y+(p.y-old.y)*alpha;}}}

  stateCallbacks.forEach(fn=>fn(view));

 }

 async function ticket(intent:string,count:number):Promise<Record<string,unknown>>{

  if(import.meta.env.DEV)return {guest:true};

  const response=await fetch('/api/v1/boomerangavoid/ticket/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:intent,seats:count})});

  if(response.status===401){const next='/boomerangavoid/'+(intent==='create'?'':'?room='+encodeURIComponent(intent));const link='/login/?next='+encodeURIComponent(next);info.message='Sign in on aVOID to join an online party.';location.assign(link);throw new Error('Sign in on aVOID to join online.');}

  const result=await response.json();if(!response.ok||typeof result.ticket!=='string')throw new Error('The online identity service is not ready. Practice and Couch Party remain available.');return {ticket:result.ticket};

 }

 function bind(joined:Room){joined.reconnection.minUptime=0;room=joined;seatIds=[joined.sessionId+':0'];info.clientId=joined.sessionId;info.ownedSeatIds=seatIds;info.roomId=joined.roomId;info.status='lobby';info.message='Connected. Ready up when your party arrives.';

  try{sessionStorage.setItem('bav-reconnect',JSON.stringify({endpoint,roomId:joined.roomId,token:joined.reconnectionToken,time:Date.now()}));}catch{}

  joined.onMessage('welcome',(message:Welcome)=>{seatIds=message.seatIds;info.ownedSeatIds=seatIds;info.clientId=message.connectionId;notify();});

  joined.onMessage('snapshot',(s:Snapshot)=>{

   if(s.protocol!==PROTOCOL||s.contentHash!==CONTENT_HASH){error('Game version changed. Refresh to continue.');void joined.leave();return;}

   const oldRound=snapshot?.state?.round;prior=snapshot?.state??null;priorAt=lastSnapshotAt;snapshot=s;lastSnapshotAt=performance.now();

   seatIds=s.seats.filter(seat=>seat.connectionId===joined.sessionId).map(seat=>seat.id);info.ownedSeatIds=seatIds;info.config=s.config;info.public=s.public;info.stage=s.stage;info.roomId=s.roomId;info.hostId=s.ownerId;info.region=s.region;info.seats=s.seats.filter(x=>!x.spectator);info.readyIds=s.seats.filter(x=>x.ready).map(x=>x.id);info.status=s.stage==='match'?'playing':'lobby';info.message=s.message||(s.stage==='match'?'Match continues while menus are open.':'Ready up when your party is here.');

   pending=pending.filter(batch=>batch.some(c=>c.sequence>(s.ack[c.seatId]??-1)));

   if(oldRound!==s.state?.round){pending=[];loadedRound=-1;}

   if(s.stage==='loading'&&s.state&&loadedRound!==s.state.round){loadedRound=s.state.round;stateCallbacks.forEach(fn=>fn(structuredClone(s.state!)));queueMicrotask(()=>joined.send('loaded',{contentHash:CONTENT_HASH,round:s.state!.round}));}

   if(Date.now()-lastStored>2000){lastStored=Date.now();try{sessionStorage.setItem('bav-reconnect',JSON.stringify({endpoint,roomId:joined.roomId,token:joined.reconnectionToken,time:Date.now()}));}catch{}}

   if(performance.now()-lastNotified>100||s.stage!=='match'){notify();lastNotified=performance.now();}

  });

  joined.onMessage('notice',(message:string)=>{info.message=message;notify();});

  joined.onMessage('pong',(at:number)=>{info.ping=Math.round(performance.now()-at);notify();});

  joined.onDrop(()=>{paused=true;waitNeutral=true;loadedRound=-1;pending=[];info.status='reconnecting';info.message='Connection lost. Holding your seats for up to 20 seconds.';notify();});

  joined.onReconnect(()=>{paused=true;waitNeutral=true;loadedRound=-1;pending=[];info.status=snapshot?.stage==='match'?'playing':'lobby';info.message='Reconnected. Press a movement or action key to resume.';notify();});

  joined.onLeave(()=>{if(room===joined){room=undefined;info.status='error';info.message='Room closed. Create a new room or return to practice.';notify();}});

  pingTimer=setInterval(()=>joined.send('ping',performance.now()),2000);if(!frame)frame=requestAnimationFrame(render);notify();

 }

 async function connect(intent:string,seat:Seat,config?:MatchConfig,party:Seat[]=[seat]){

  if(!endpoint)throw new Error(info.message);if(room)leave();info.status='connecting';info.message='Connecting to the garden…';notify();

  try{client=new Client(endpoint);const auth=await ticket(intent,party.length);const options={...auth,protocol:PROTOCOL,contentHash:CONTENT_HASH,intent,name:seat.name,character:seat.character,characters:party.map(s=>s.character),localSeats:party.length,config};const joined=intent==='create'?await client.create('boomerangavoid',options):await client.joinById(intent,options);bind(joined);}catch(e){const message=e instanceof Error?e.message:'Room connection failed.';error(message);throw e;}

 }

 function leave(){const old=room;room=undefined;void old?.leave();if(pingTimer)clearInterval(pingTimer);pingTimer=undefined;if(frame)cancelAnimationFrame(frame);frame=0;snapshot=null;pending=[];seatIds=[];info.status='idle';info.seats=[];info.readyIds=[];info.ownedSeatIds=[];try{sessionStorage.removeItem('bav-reconnect');}catch{}notify();}

 // Resume only this tab's short seat lease; invitation URLs never carry the token.

 queueMicrotask(async()=>{if(!endpoint||room)return;let saved;try{saved=JSON.parse(sessionStorage.getItem('bav-reconnect')??'null');}catch{return;}const invite=new URL(location.href).searchParams.get('room');

  if(!saved||saved.endpoint!==endpoint||typeof saved.token!=='string'||Date.now()-saved.time>22000||(invite&&invite!==saved.roomId))return;

  info.status='reconnecting';info.message='Restoring your party seats…';notify();try{client=new Client(endpoint);const resumed=await client.reconnect(saved.token);paused=true;waitNeutral=true;bind(resumed);}catch{try{sessionStorage.removeItem('bav-reconnect');}catch{}error('The seat lease ended. Join the party again, or start a new room.');}

 });

 return {info,

  create:(config,seat,party)=>connect('create',seat,config,party),join:(id,seat,party)=>connect(id.trim(),seat,undefined,party),configure:patch=>room?.send('configure',patch),

  async quickJoin(seat,party=[seat]){if(!endpoint)throw new Error(info.message);const response=await fetch(endpoint.replace(/^ws/,'http')+'/rooms');if(!response.ok)throw new Error('Room discovery is unavailable. Try an invitation.');const available=await response.json() as {roomId:string;seats:number;protocol:string}[];const candidate=available.find(r=>r.seats+party.length<=6&&r.protocol===PROTOCOL);if(!candidate){info.message='No open rooms. Create a private room or play Practice.';notify();throw new Error(info.message);}await connect(candidate.roomId,seat,undefined,party);},

  ready:value=>room?.send('ready',value),start:()=>room?.send('start'),

  send(inputs){if(!room||!snapshot?.state||info.status!=='playing')return;const state=snapshot.state;const values=Object.values(inputs);const batch=seatIds.map((id,index)=>{const input=inputs[id]??values[index];if(!input)return null;const active=!!(input.mx||input.my||input.dash||input.slash||input.throw);if(paused&&waitNeutral&&!active)waitNeutral=false;if(paused&&!waitNeutral&&active)paused=false;return {...input,...(paused?{mx:0,my:0,dash:false,slash:false,throw:false}:{}),seatId:id,sequence:++sequence,round:state.round,tick:state.tick+Math.min(5,Math.floor((performance.now()-lastSnapshotAt)*.06))};}).filter((x):x is InputCommand=>!!x);if(!batch.length)return;pending.push(batch);if(pending.length>30)pending.shift();room.send('input',batch);},

  rematch:()=>room?.send('rematch'),leave,

  onState(fn){stateCallbacks.add(fn);return()=>stateCallbacks.delete(fn);},onChange(fn){callbacks.add(fn);return()=>callbacks.delete(fn);}

 };

}
