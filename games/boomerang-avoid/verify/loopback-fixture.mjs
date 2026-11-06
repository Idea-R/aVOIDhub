import http from 'node:http';
import net from 'node:net';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {WebSocket,WebSocketServer} from 'ws';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const exec=promisify(execFile);
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function until(check,ms=15000,description='fixture startup') {
 const started=performance.now();while(!await check()){if(performance.now()-started>ms)throw Error(`Timed out: ${description}`);await pause(30);}
}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function listenerProof(ports){
 if(process.platform!=='win32')return{unavailable:'Windows listener inventory is not available on this OS; proxy address is still observed from server.address().'};
 try{const {stdout}=await exec('powershell.exe',['-NoProfile','-Command',`Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in ${ports.join(',')} } | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress`],{windowsHide:true,timeout:10000});const value=stdout.trim()?JSON.parse(stdout):[];return{observedAt:new Date().toISOString(),listeners:Array.isArray(value)?value:[value]};}
 catch(error){
  // CIM inventory can be restricted while the ordinary socket table remains
  // readable. Inspect only this fixture's known ports; never elevate privileges.
  try{const {stdout}=await exec('netstat.exe',['-ano','-p','tcp'],{windowsHide:true,timeout:10000});
   const listeners=stdout.split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(row=>row[0]==='TCP'&&row[3]==='LISTENING'&&ports.includes(Number(row[1].slice(row[1].lastIndexOf(':')+1)))).map(row=>({LocalAddress:row[1].slice(0,row[1].lastIndexOf(':')),LocalPort:Number(row[1].slice(row[1].lastIndexOf(':')+1)),OwningProcess:Number(row[4])}));
   return{observedAt:new Date().toISOString(),source:'netstat -ano -p tcp',cimUnavailable:'Get-NetTCPConnection was unavailable; no elevation attempted.',listeners};
  }catch(fallback){return{unavailable:`Socket inventory unavailable: ${fallback.message}`};}
 }
}

// Delay entire WebSocket messages in FIFO order. No kernel packet loss, packet
// reordering, retransmission, bandwidth shaping or internet emulation is claimed.
async function orderedProxy(targetPort){
 let seed=41827;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const links=new Set(),metrics={frames:0,bytes:0,stalls:0,maxQueuedFrames:0,connections:0,blackouts:[]};
 const server=http.createServer((req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:targetPort,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode||502,reply.headers);reply.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(upstream);});
 const wss=new WebSocketServer({noServer:true});
 server.on('upgrade',(request,socket,head)=>{
  const upstream=new WebSocket(`ws://127.0.0.1:${targetPort}${request.url}`,{headers:request.headers.origin?{Origin:request.headers.origin}:{}});
  upstream.once('error',()=>socket.destroy());upstream.once('open',()=>wss.handleUpgrade(request,socket,head,client=>{
   const link={client,upstream,id:new URL(request.url,'http://127.0.0.1').searchParams.get('sessionId'),blockedUntil:0,cleanups:[]};links.add(link);metrics.connections++;
   function forward(from,to,downstream){const queue=[];let timer,due=0;
    const clear=()=>{clearTimeout(timer);queue.length=0;};link.cleanups.push(clear);
    const pump=()=>{timer=undefined;const now=performance.now();if(downstream&&link.blockedUntil>now){timer=setTimeout(pump,link.blockedUntil-now);return;}
     const next=queue.shift();if(next&&to.readyState===WebSocket.OPEN){if(next.close)to.close(next.code,next.reason);else to.send(next.data,{binary:next.binary});}
     if(queue.length)timer=setTimeout(pump,Math.max(0,queue[0].due-performance.now()));};
    from.on('message',(data,binary)=>{metrics.frames++;metrics.bytes+=data.length;const stall=random()<.015?180:0;if(stall)metrics.stalls++;
     due=Math.max(due+.01,performance.now()+60+(random()*2-1)*20+stall);queue.push({data:Buffer.from(data),binary,due});metrics.maxQueuedFrames=Math.max(metrics.maxQueuedFrames,queue.length);if(!timer)timer=setTimeout(pump,Math.max(0,due-performance.now()));});
    from.on('close',(code,reason)=>{queue.push({close:true,code:[1005,1006].includes(code)?4001:code,reason,due:Math.max(due,performance.now())});if(!timer)timer=setTimeout(pump,Math.max(0,due-performance.now()));if(client.readyState===WebSocket.CLOSED&&upstream.readyState===WebSocket.CLOSED)links.delete(link);});
    from.on('error',()=>{clear();to.terminate();});
   }forward(client,upstream,false);forward(upstream,client,true);
  }));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return{port:server.address().port,metrics,blackout(id,ms){const matches=[...links].filter(l=>l.id===id);if(matches.length!==1)throw Error(`Expected one owned connection, found ${matches.length}`);matches[0].blockedUntil=performance.now()+ms;metrics.blackouts.push({sessionId:id,durationMs:ms,at:new Date().toISOString()});},async close(){for(const l of links){l.cleanups.forEach(f=>f());l.client.terminate();l.upstream.terminate();}links.clear();await new Promise(r=>wss.close(r));server.closeAllConnections();await new Promise(r=>server.close(r));}};
}

export async function startFixture(){
 const processes=[],resources={bind:'127.0.0.1',fixture:'Existing release-gate test-only guest constants; no provider credentials inherited.'};let proxy;
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|appdata|localappdata)$/i.test(key)));
 async function stop(){if(proxy){await proxy.close();resources.proxyClosed=true;}for(const child of processes.reverse()){if(child.exitCode===null&&child.signalCode===null){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(3000)]);}resources[`${child.fixtureName}Stopped`]=child.exitCode!==null||child.signalCode!==null;}resources.cleanupListeners=await listenerProof([resources.serverPort,resources.vitePort,resources.proxyPort].filter(Boolean));return resources;}
 try{
  const roomPort=await freePort(),vitePort=await freePort();resources.serverPort=roomPort;resources.vitePort=vitePort;
  function launch(name,args,extra){const child=spawn(process.execPath,args,{cwd:root,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});child.fixtureName=name;processes.push(child);resources[`${name}Pid`]=child.pid;let output='';child.stdout.on('data',d=>output=(output+d).slice(-3000));child.stderr.on('data',d=>output=(output+d).slice(-3000));child.fixtureOutput=()=>output;return child;}
  const server=launch('server',['--import','tsx','apps/boomerangavoid-server/src/index.ts'],{NODE_ENV:'test',BAV_ALLOW_GUESTS:'1',PORT:String(roomPort),BAV_ALLOWED_ORIGINS:`http://127.0.0.1:${vitePort}`,BOOMERANGAVOID_TICKET_SECRET:'test-only-fixture-secret-never-use-in-deployment'});
  await until(async()=>{if(server.exitCode!==null)throw Error(server.fixtureOutput());return fetch(`http://127.0.0.1:${roomPort}/health`).then(r=>r.ok).catch(()=>false);});
  proxy=await orderedProxy(roomPort);resources.proxyPort=proxy.port;resources.proxyAddress=`127.0.0.1:${proxy.port}`;
  const vite=launch('vite',['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(vitePort),'--strictPort'],{VITE_BOOMERANGAVOID_SERVER:`http://127.0.0.1:${proxy.port}`});
  const base=`http://127.0.0.1:${vitePort}/boomerangavoid/`;
  await until(async()=>{if(vite.exitCode!==null)throw Error(vite.fixtureOutput());return fetch(base).then(r=>r.ok).catch(()=>false);});
  resources.runtimeListeners=await listenerProof([roomPort,vitePort,proxy.port]);
  if(resources.runtimeListeners.listeners){if(resources.runtimeListeners.listeners.length!==3||resources.runtimeListeners.listeners.some(s=>s.LocalAddress!=='127.0.0.1'))throw Error('Owned fixture listeners must all bind exactly127.0.0.1');}
  return{base,proxy,resources,stop};
 }catch(e){await stop();throw e;}
}
