/** Isolated CPU replay in Chrome, separate from real-time app validation. */
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import * as api from '@avoid/boomerangavoid-sim';
import {compareReplayStates} from './replay-state.mjs';
const repo=new URL('../../../',import.meta.url),out=new URL('docs/boomerangavoid/evidence/bot-boundary/',repo);
const f=JSON.parse(await fs.readFile(new URL('docs/boomerangavoid/evidence/ads-powers/two-hard-fixture-walltime.json',repo),'utf8')).expected.first;
const seats=structuredClone(f.seats);seats.find(s=>s.id==='studio-5').bot='normal';
function replay(api,config,seats,stop=10000,reference=null){const s=api.createMatch(config,seats),hashes=[],mismatches=[];while(s.tick<stop&&s.phase!=='matchResults'){api.step(s,api.getBotInputs(s));const h=api.stateHash(s);hashes.push(h);if(reference&&h!==reference[s.tick-1])mismatches.push({tick:s.tick,state:structuredClone(s)});}return {hashes,state:s,mismatches};}
const node=replay(api,f.config,seats);let browser,vite;
try{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata)$/i.test(k)));
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fileURLToPath(repo),env,windowsHide:true,stdio:'ignore'});
 const base=`http://127.0.0.1:${port}/boomerangavoid/`;for(let i=0;i<150;i++){if(await fetch(base).then(r=>r.ok).catch(()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.goto(base+'src/studio-contract.ts');
 const module=base+'@fs/'+fileURLToPath(new URL('packages/boomerangavoid-sim/src/index.ts',repo)).replaceAll('\\','/');
 const chrome=await page.evaluate(async({module,code,config,seats,reference})=>{const api=await import(module);return (0,eval)('('+code+')')(api,config,seats,10000,reference);},{module,code:replay.toString(),config:f.config,seats,reference:node.hashes});
 const first=node.hashes.findIndex((h,i)=>h!==chrome.hashes[i]);
 const report={node:process.version,browser:browser.version(),firstDivergence:first<0?null:first+1,nodeTerminalTick:node.state.tick,chromeTerminalTick:chrome.state.tick,hashesMatch:first<0,nodeHash:api.stateHash(node.state),chromeHash:api.stateHash(chrome.state),scope:'Isolated headless CPU simulation in Node and Chrome; not accelerated live gameplay.'};
 if(first>=0){report.firstNode=replay(api,f.config,seats,first+1).state;report.firstChrome=await page.evaluate(async({module,code,config,seats,stop})=>{const api=await import(module);return (0,eval)('('+code+')')(api,config,seats,stop).state;},{module,code:replay.toString(),config:f.config,seats,stop:first+1});}
 const cursor=api.createMatch(f.config,seats);report.roundingComparisons=[];
 for(const mismatch of chrome.mismatches){while(cursor.tick<mismatch.tick)api.step(cursor,api.getBotInputs(cursor));const comparison=compareReplayStates(cursor,mismatch.state);if(!comparison.equivalent)throw Error('Real CPU replay divergence at '+mismatch.tick);report.roundingComparisons.push({tick:mismatch.tick,...comparison});}
 if(report.nodeHash!==report.chromeHash)throw Error('Terminal replay hashes differ');
 // Prove the diagnostic tolerance still rejects substantive position and discrete changes.
 const changed=structuredClone(node.state);changed.players[0].x+=1e-6;if(compareReplayStates(node.state,changed).equivalent)throw Error('Comparison accepted a real position change');changed.players[0].x=node.state.players[0].x;changed.round+=1e-12;if(compareReplayStates(node.state,changed).equivalent)throw Error('Comparison accepted a fractional round change');changed.round=node.state.round;changed.round++;if(compareReplayStates(node.state,changed).equivalent)throw Error('Comparison accepted a round change');
 report.passed=true;report.toleranceRejectsRealChanges=true;
 await fs.writeFile(new URL('cpu-replay.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,firstDivergence:report.firstDivergence,roundingBoundaryTicks:report.roundingComparisons.length,maxDelta:Math.max(0,...report.roundingComparisons.map(c=>c.maxDelta)),nodeTerminalTick:report.nodeTerminalTick,chromeTerminalTick:report.chromeTerminalTick,nodeHash:report.nodeHash,chromeHash:report.chromeHash}));
}finally{if(browser)await browser.close();if(vite&&vite.exitCode===null){vite.kill();await new Promise(r=>vite.once('exit',r));}}
