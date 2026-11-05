// Local test proxy. Delays actual WebSocket frames; HTTP matchmaking is passed through.
// Stalls model retransmission delay, not kernel-level packet loss.
import http from 'node:http';import {WebSocket,WebSocketServer}from 'ws';
const port=Number(process.env.PROXY_PORT??2779),target=Number(process.env.TARGET_PORT??2777),rtt=Number(process.env.PROXY_RTT??120),jitter=Number(process.env.PROXY_JITTER??20),stallRate=Number(process.env.PROXY_STALL_RATE??.01);
let rng=41827,bytes=0,frames=0,stalls=0;const sockets=new Set();const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/4294967296;};
const server=http.createServer((req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:target,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode??502,response.headers);response.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(upstream);});
const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{const upstream=new WebSocket('ws://127.0.0.1:'+target+req.url,{headers:req.headers.origin?{Origin:req.headers.origin}:{}});upstream.once('open',()=>wss.handleUpgrade(req,socket,head,client=>{sockets.add(client);sockets.add(upstream);
 function forward(from,to){let chain=Promise.resolve();let scheduled=Date.now();from.on('message',(data,binary)=>{bytes+=data.length;frames++;const stall=random()<stallRate?180:0;if(stall)stalls++;const due=Math.max(scheduled,Date.now()+rtt/2+(random()*2-1)*jitter+stall);scheduled=due;chain=chain.then(()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,due-Date.now())))).then(()=>{if(to.readyState===WebSocket.OPEN)to.send(data,{binary});});});from.on('close',(code,reason)=>{void chain.finally(()=>{sockets.delete(from);if(to.readyState===WebSocket.OPEN)to.close(code===1005||code===1006?4001:code,reason);});});from.on('error',()=>to.terminate());}
 forward(client,upstream);forward(upstream,client);
 }));upstream.once('error',()=>socket.destroy());});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({proxy:port,target,rtt,jitter,retransmissionStyleStallRate:stallRate,actualPacketLoss:false,transport:'WebSocket frame proxy'})));
setInterval(()=>console.log(JSON.stringify({bytes,frames,stalls,connections:sockets.size/2})),30000).unref();const stop=()=>{for(const s of sockets)s.terminate();server.close();wss.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
