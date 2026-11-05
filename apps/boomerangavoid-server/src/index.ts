import { runtimeStatus } from './runtime';
import { defineServer, defineRoom } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GardenRoom, rooms } from './room';
import { PROTOCOL, CONTENT_HASH } from '@avoid/boomerangavoid-protocol';
const dev=process.env.NODE_ENV!=='production';
const origins=new Set((process.env.BAV_ALLOWED_ORIGINS??(dev?'http://127.0.0.1:5177,http://localhost:5177,http://127.0.0.1:4177,http://localhost:4177':'https://avoidgame.io')).split(',').map(s=>s.trim()).filter(Boolean));
let draining=false;
export const server=defineServer({
 greet:false,
 transport:new WebSocketTransport({maxPayload:8192,pingInterval:5000,pingMaxRetries:2,verifyClient:(info:{origin:string})=>origins.has(info.origin)||(!info.origin&&dev)}),
 rooms:{boomerangavoid:defineRoom(GardenRoom)},
 express:app=>{
  // CORS grants only browser access from enumerated game origins; it is not authentication.
  app.use((req,res,next)=>{const origin=req.headers.origin;if(origin&&!origins.has(origin)){res.status(403).json({error:'origin_not_allowed'});return;}if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}if(req.method==='OPTIONS'){res.sendStatus(204);return;}next();});
  app.get('/health',(_req,res)=>{const ready=!draining&&(dev||(process.env.BOOMERANGAVOID_TICKET_SECRET?.length??0)>=32);res.setHeader('Cache-Control','no-store');res.status(ready?200:503).json({ok:ready,ticketEpoch:runtimeStatus.ticketEpoch,protocol:PROTOCOL,contentHash:CONTENT_HASH,region:process.env.BAV_REGION??'Local development'});});
  app.get('/rooms',(_req,res)=>res.setHeader('Cache-Control','no-store').json([...rooms].map(r=>r.snapshot()).filter(r=>r.public&&r.stage==='lobby').map(r=>({roomId:r.roomId,mode:r.config.mode,seats:r.seats.filter(s=>!s.spectator).length,region:r.region,protocol:r.protocol}))));
  if(dev)app.get('/metrics',(_req,res)=>res.json({rooms:rooms.size,rss:process.memoryUsage().rss,uptime:process.uptime(),roomMetrics:[...rooms].map(r=>r.metrics())}));
 }
});
const port=Number(process.env.PORT??2777);
await server.listen(port,process.env.BAV_BIND??'127.0.0.1');
console.log(JSON.stringify({service:'boomerangavoid',port,protocol:PROTOCOL,contentHash:CONTENT_HASH,guestMode:dev&&process.env.BAV_ALLOW_GUESTS==='1'}));
const stop=async()=>{if(draining)return;draining=true;runtimeStatus.draining=true;for(const room of rooms)room.drain();const deadline=Date.now()+25000;const timer=setInterval(()=>{if(Date.now()>=deadline||[...rooms].every(r=>r.snapshot().stage==='lobby'||r.snapshot().state?.phase==='matchResults')){clearInterval(timer);void server.gracefullyShutdown(true).then(()=>process.exit(0));}},250);timer.unref();};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
