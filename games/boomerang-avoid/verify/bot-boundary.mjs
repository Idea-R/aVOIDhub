/** Bounded real renderer/engine observations; no gameplay writes or timing changes. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createMatch,getBotInputs,step,stateHash,RULES,RULESET} from '@avoid/boomerangavoid-sim';
import {compareReplayStates} from './replay-state.mjs';
const ordinary=process.argv.includes('--ordinary');
const repo=new URL('../../../',import.meta.url),out=new URL('docs/boomerangavoid/evidence/bot-boundary/',repo);
await fs.mkdir(out,{recursive:true});
const fixture=JSON.parse(await fs.readFile(new URL('docs/boomerangavoid/evidence/ads-powers/two-hard-fixture-walltime.json',repo),'utf8')).expected.first;
const config=structuredClone(fixture.config),seats=structuredClone(fixture.seats);
if(ordinary)seats.find(p=>p.id==='studio-5').bot='normal';
const {arenaDraft,...match}=config;
const draft={schema:'boomerangavoid-ads',version:1,label:arenaDraft.name,biome:'garden',arena:arenaDraft,match,seats:seats.map((s,i)=>({...s,control:i?'bot':'keyboard1'}))};
const expected=createMatch(config,seats);while(expected.phase!=='matchResults'&&expected.tick<60000)step(expected,getBotInputs(expected));assert.equal(expected.phase,'matchResults');
const report={ruleset:RULESET,ordinary,timestamp:new Date().toISOString(),passed:false,errors:[],runs:[],expected:{tick:expected.tick,round:expected.round,hash:stateHash(expected),scores:expected.players.map(p=>p.score)},scope:ordinary?'Two complete ordinary real-time matches with actual UI rematch; each retains the original 180-second case bound.':'45-second prefix of the exact retained two-Hard fixture; no full-browser completion claim.',method:'Chrome 1280x900 DPR1, fresh context, default auto quality, passive serializable development hook. Compare Node continuation at every observation. No simulation mutation, clock acceleration or physical hardware/internet claim.'};
const pause=ms=>new Promise(r=>setTimeout(r,ms));let vite,browser;
try{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata)$/i.test(k)));
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fileURLToPath(repo),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [vite.stdout,vite.stderr])stream.on('data',b=>output=(output+b).slice(-2500));
 const url=`http://127.0.0.1:${port}/boomerangavoid/?studio=1`;
 for(let i=0;i<150;i++){if(vite.exitCode!==null)throw Error(output);if(await fetch(url).then(r=>r.ok).catch(()=>false))break;if(i===149)throw Error('Vite startup timeout');await pause(100);}
 report.vite={pid:vite.pid,port,bind:'127.0.0.1'};
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url);await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
 await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(draft));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);await page.locator('[data-do="play"]').click();
 for(let run=0;run<(ordinary?2:1);run++){
  await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:30000});
  const cursor=createMatch(config,seats),samples=[],started=performance.now();let terminal=null,lastLog=0;
  while(performance.now()-started<=(ordinary?180000:45000)){
   const live=await page.evaluate(()=>window.__BOOMERANGAVOID__);assert.equal(live.online,false);assert.equal(live.paused,false);
   while(cursor.tick<live.state.tick)step(cursor,getBotInputs(cursor));
   if(stateHash(cursor)!==live.hash){
    const comparison=compareReplayStates(cursor,live.state);
    if(!comparison.equivalent)await fs.writeFile(new URL('divergence.json',out),JSON.stringify({tick:live.state.tick,node:cursor,chrome:live.state,comparison},null,2)+'\n');
    assert.equal(comparison.equivalent,true,`Browser state divergence at tick ${live.state.tick}`);
    (report.hashRoundingBoundaries??=[]).push({tick:live.state.tick,...comparison});
   }
   samples.push({wallMs:performance.now()-started,tick:live.state.tick,round:live.state.round,phase:live.state.phase,hash:live.hash,medianFrameMs:live.metrics.medianFrameMs,p95FrameMs:live.metrics.p95FrameMs,deliveredFrames:live.metrics.deliveredFrames,quality:live.metrics.quality,actors:live.state.players.filter(p=>p.alive).map(p=>({id:p.id,bot:p.bot,x:p.x,y:p.y,vx:p.vx,vy:p.vy,dashUntil:p.dashUntil,input:live.state.internal.controls[p.id]?.previous}))});
   if(live.state.phase==='matchResults'){terminal=live.state;break;}
   if(performance.now()-started-lastLog>30000){lastLog=performance.now()-started;console.log(JSON.stringify({ordinary,run,wallSeconds:Math.round(lastLog/1000),tick:live.state.tick,round:live.state.round}));}
   await pause(500);
  }
  if(ordinary){assert.ok(terminal,'Natural match exceeded the original 180-second budget');assert.equal(stateHash(terminal),stateHash(expected));assert.deepEqual(terminal.config,config);assert.deepEqual(terminal.players.map(({id,name,character,color,team,bot})=>({id,name,character,color,team,bot})),seats);}
  const window=samples.filter(s=>s.wallMs<=45000),a=window[0],b=window.at(-1);
  const pushes=window.filter(s=>s.actors.some(p=>p.bot&&p.dashUntil<=s.tick+1&&((Math.abs(p.x)>arenaDraft.width/2-RULES.playerRadius-1e-6&&p.x*p.input?.mx>0)||(Math.abs(p.y)>arenaDraft.height/2-RULES.playerRadius-1e-6&&p.y*p.input?.my>0))));
  const result={run,completed:!!terminal,wallMs:performance.now()-started,tickRate:(b.tick-a.tick)/((b.wallMs-a.wallMs)/1000),rafRate:(b.deliveredFrames-a.deliveredFrames)/((b.wallMs-a.wallMs)/1000),wallPushSamples:pushes.length,lastTick:samples.at(-1).tick,hash:samples.at(-1).hash,samples};
  report.runs.push(result);assert.equal(pushes.length,0,'Bots must not keep requesting movement through an arena wall');
  await page.screenshot({path:fileURLToPath(new URL(ordinary?`ordinary-${run}-result.png`:'browser-after.png',out))});
  console.log(JSON.stringify({ordinary,run,completed:result.completed,lastTick:result.lastTick,hash:result.hash,tickRate:result.tickRate,wallPushSamples:result.wallPushSamples}));
  if(ordinary&&run===0){await page.locator('.results-panel [data-action="rematch"]').click();await page.waitForFunction(()=>{const s=window.__BOOMERANGAVOID__?.state;return s?.round===1&&s.phase==='countdown'&&s.players.every(p=>p.score===0);});report.realUiRematch=true;}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack||String(e);process.exitCode=1;}
finally{
 if(browser)await browser.close();report.browserClosed=true;
 if(vite&&vite.exitCode===null){vite.kill();await Promise.race([new Promise(r=>vite.once('exit',r)),pause(3000)]);}report.viteStopped=!vite||vite.exitCode!==null||vite.signalCode!==null;
 await fs.writeFile(new URL(ordinary?'ordinary-browser.json':'browser-after.json',out),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({ordinary,passed:report.passed,runs:report.runs.map(({samples,...r})=>r),errors:report.errors,failure:report.failure}));
}
