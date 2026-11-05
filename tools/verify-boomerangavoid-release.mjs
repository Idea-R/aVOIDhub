import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),results=[];
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(args,env={}){return new Promise((resolve,reject)=>{const started=Date.now();const child=spawn(npm,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',shell:process.platform==='win32',windowsHide:true});child.on('error',reject);child.on('exit',code=>{results.push({command:['npm',...args].join(' '),code,durationMs:Date.now()-started});code===0?resolve():reject(new Error('Verification failed: npm '+args.join(' ')));});});}
const listen=createServer();await new Promise(r=>listen.listen(0,'127.0.0.1',r));const port=listen.address().port;await new Promise(r=>listen.close(r));
let server;
try{
 for(const workspace of ['@avoid/boomerangavoid-sim','@avoid/boomerangavoid-protocol','@avoid/boomerangavoid-server','@avoid/boomerang-avoid','@avoid/platform'])await run(['run','typecheck','--workspace='+workspace]);
 for(const workspace of ['@avoid/boomerangavoid-sim','@avoid/boomerangavoid-protocol','@avoid/platform'])await run(['run','test','--workspace='+workspace]);
 await run(['run','test:catalog','--workspace=@avoid/platform']);
 server=spawn(process.execPath,['--import','tsx',path.join(root,'apps/boomerangavoid-server/src/index.ts')],{cwd:root,env:{...process.env,NODE_ENV:'test',BAV_ALLOW_GUESTS:'1',PORT:String(port),BOOMERANGAVOID_TICKET_SECRET:'test-only-fixture-secret-never-use-in-deployment'},stdio:['ignore','inherit','inherit'],windowsHide:true});
 const endpoint='http://127.0.0.1:'+port;let healthy=false;for(let i=0;i<100;i++){if(await fetch(endpoint+'/health').then(r=>r.ok).catch(()=>false)){healthy=true;break;}await new Promise(r=>setTimeout(r,100));}if(!healthy)throw new Error('Owned test server did not become healthy');
 await run(['run','test','--workspace=@avoid/boomerangavoid-server'],{BAV_TEST_ENDPOINT:endpoint,BAV_TEST_TICKET_SECRET:'test-only-fixture-secret-never-use-in-deployment'});
 await run(['run','build:platform:netlify']);
 console.log('Local source/network/build gate passed. Hosted auth, external-network/device/capacity gates remain separate.');
}finally{
 if(server&&!server.killed)server.kill();
 const evidence=path.join(root,'docs/boomerangavoid/evidence');await mkdir(evidence,{recursive:true});await writeFile(path.join(evidence,'local-release-checks.json'),JSON.stringify({timestamp:new Date().toISOString(),node:process.version,lockfileSha256:createHash('sha256').update(await readFile(path.join(root,'package-lock.json'))).digest('hex'),checks:results,scope:'Local source and loopback network/build only; not a production release'},null,2)+'\n');
}
