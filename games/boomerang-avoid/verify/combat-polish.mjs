import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {until,pause} from './loopback-fixture.mjs';

// Isolated actual WebGL renderer + original GLBs. State slices are explicit
// presentation fixtures, not an app journey, combat balance or hardware claim.
const baseline=process.argv.includes('--baseline');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=new URL(`../../../docs/boomerangavoid/evidence/polish-next/combat-${baseline?'before':'after'}-${new Date().toISOString().replace(/[:.]/g,'-')}/`,import.meta.url);
await mkdir(out,{recursive:true});
const report={startedAt:new Date().toISOString(),baseline,passed:false,pageErrors:[],resources:{},scope:'Actual Chrome/WebGL and original project GLBs; controlled presentation state fixtures, not a live match, physical device, networking or performance certification. Runtime model metadata unavailable.'};
let browser,vite;
try{
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|appdata|localappdata)$/i.test(key)));
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});report.resources={vitePid:vite.pid,port,bind:'127.0.0.1'};let output='';vite.stdout.on('data',d=>output=(output+d).slice(-3000));vite.stderr.on('data',d=>output=(output+d).slice(-3000));
 const base=`http://127.0.0.1:${port}/boomerangavoid/`;await until(async()=>{if(vite.exitCode!==null)throw Error(output);return fetch(base).then(r=>r.ok).catch(()=>false);});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1050,height:760},deviceScaleFactor:1});page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.route(base+'__combat-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#15383c"><canvas></canvas><div id="label" style="position:fixed;left:18px;top:15px;color:#ffedc5;font:20px sans-serif"></div></body></html>'}));
 await page.goto(base+'__combat-fixture');
 const source=await (await page.request.get(base+'src/render.ts')).text();const simImport=[...source.matchAll(/from\s*["']([^"']+)["']/g)].map(m=>m[1]).find(s=>s.includes('boomerangavoid-sim'));assert.ok(simImport);
 await page.evaluate(async({base,simImport})=>{
  const {GardenRenderer}=await import(base+'src/render.ts');const sim=await import(new URL(simImport,base).href);const library=await import(base+'src/character-library.ts');
  await library.preloadCharacters(['pip','nori'],new AbortController().signal);
  const preferences={music:0,sfx:0,reducedMotion:false,character:'pip',touch:false,quality:'low',bindings:[],gamepadButtons:{dash:0,slash:2,throw:1}};
  const renderer=new GardenRenderer(document.querySelector('canvas'),preferences);renderer.setMenu(false);
  const seats=[{id:'winner',name:'Pip',character:'pip',color:0xbce579,team:0,bot:null},{id:'loser',name:'Nori',character:'nori',color:0x7ccbb8,team:1,bot:null}];
  const state=sim.createMatch({mode:'ffa',wins:3,mapId:'moss-court',seed:31,friendlyFire:false,upgrades:false},seats);state.phase='playing';state.tick=200;state.players[0].x=-2;state.players[0].y=0;state.players[1].x=2;state.players[1].y=0;
  const draw=(dt=1/60)=>renderer.draw(state,dt,()=>{});draw();for(let i=0;i<100&&renderer.metrics.loadedCharacters<2;i++){await new Promise(r=>setTimeout(r,20));draw();}if(renderer.metrics.loadedCharacters!==2)throw Error('Original GLBs did not attach');
  window.__combatFixture={renderer,state,preferences,sim,draw};
 },{base,simImport});
 const before=await page.evaluate(()=>{const{renderer,state,draw}=window.__combatFixture;const p=state.players[0];p.slashStart=203;p.slashUntil=209;p.slashCooldown=221;draw();document.querySelector('#label').textContent='Slash windup: no active hit arc yet';return{tick:state.tick,slashStart:p.slashStart,arcVisible:renderer.actors.get(p.id).userData.slash.visible,motion:renderer.actors.get(p.id).userData.motion};});
 await page.screenshot({path:fileURLToPath(new URL('slash-windup.png',out))});
 const result=await page.evaluate(()=>{const{renderer,state,draw}=window.__combatFixture;for(const p of state.players){p.slashStart=p.slashUntil=p.slashCooldown=0;p.fx=0;p.fy=1;}state.config.mode='relay';state.phase='matchResults';state.matchWinnerIds=['winner'];state.winnerIds=['winner'];for(let i=0;i<31;i++)draw();document.querySelector('#label').textContent='Relay result: winner celebrates; loser rests';return [...renderer.actors].map(([id,g])=>({id,motion:g.userData.motion,loop:g.userData.actions?.[g.userData.motion]?.loop}));});
 await page.screenshot({path:fileURLToPath(new URL('relay-result.png',out))});
 report.checks={windup:before,relayResult:result};
 if(baseline){assert.equal(before.arcVisible,true,'baseline reproduces premature windup arc');assert.equal(result.find(x=>x.id==='loser').motion,'victory');assert.ok(result.every(x=>x.loop===2201),'baseline actions repeat by default');}
 else{assert.equal(before.arcVisible,false);assert.equal(result.find(x=>x.id==='winner').motion,'victory');assert.notEqual(result.find(x=>x.id==='loser').motion,'victory');assert.equal(result.find(x=>x.id==='winner').loop,2200);}
 if(!baseline){
  report.checks.boundaries=await page.evaluate(()=>{
   const{renderer,state,draw}=window.__combatFixture;state.config.mode='ffa';state.phase='playing';state.tick=200;const p=state.players[0];p.slashStart=203;p.slashUntil=209;p.slashCooldown=221;
   const weapon=state.weapons.find(w=>w.ownerId===p.id);const samples=[];for(let tick=200;tick<=221;tick++){state.tick=tick;draw();const actor=renderer.actors.get(p.id),visual=renderer.weapons.get(weapon.id);samples.push({tick,visible:actor.userData.slash.visible,clipTime:actor.userData.actions.slash.time,gripAngle:visual.rotation.y-Math.atan2(p.fx,p.fy),weaponX:visual.position.x,weaponZ:visual.position.z});}
   state.tick=206;draw();document.querySelector('#label').textContent='Active ticks only: committed weapon sweep';return samples;
  });
  assert.deepEqual(report.checks.boundaries.filter(s=>s.visible).map(s=>s.tick),[203,204,205,206,207,208]);
  assert.equal(report.checks.boundaries.find(s=>s.tick===206).gripAngle,0,'weapon crosses the facing center during the actual active interval');
  await page.screenshot({path:fileURLToPath(new URL('slash-active.png',out))});
  report.checks.lifecycle=await page.evaluate(async()=>{
   const{renderer,state,preferences,draw}=window.__combatFixture;const p=state.players[0];p.slashStart=p.slashUntil=p.slashCooldown=0;state.tick=300;p.dashUntil=310;p.vx=15;draw();state.tick=305;draw();const actor=renderer.actors.get(p.id);const stretched=actor.userData.footRing.scale.y;const firstKey=actor.userData.motionKey;const transitions=actor.userData.animation.transitions;
   draw();const repeatDidNotRestart=actor.userData.animation.transitions===transitions;
   state.tick=353;p.dashUntil=358;draw();const retrigger=actor.userData.motionKey!==firstKey&&actor.userData.animation.transitions===transitions+1;
   preferences.reducedMotion=true;draw();const reduced={dashRingScale:actor.userData.footRing.scale.y,bodyHeight:actor.userData.body.position.y,bodyScale:actor.userData.body.scale.toArray()};
   p.dashUntil=0;p.vx=0;state.tick=400;state.weapons[0].phase='grounded';state.weapons[0].heading=1.2;state.weapons[0].x=0;state.weapons[0].y=-2;draw();const rotation=renderer.weapons.get(state.weapons[0].id).rotation.y;for(let i=0;i<60;i++)draw();const groundedSpin=renderer.weapons.get(state.weapons[0].id).rotation.y-rotation;
   const stable={...renderer.renderer.info.memory,calls:renderer.metrics.drawCalls},original=JSON.stringify(state);for(let i=0;i<240;i++)draw();const after={...renderer.renderer.info.memory,calls:renderer.metrics.drawCalls};const stateUntouched=original===JSON.stringify(state);
   const removedModel=actor.userData.animation.model;const skeletons=[];removedModel.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton.boneTexture)skeletons.push(o.skeleton.boneTexture);});let boneTextureDisposals=0;for(const texture of new Set(skeletons))texture.addEventListener('dispose',()=>boneTextureDisposals++);
   const party=state.players,weapons=state.weapons;state.players=[];state.weapons=[];draw();const removed={...renderer.renderer.info.memory};
   state.players=party;state.weapons=weapons;draw();for(let i=0;i<100&&[...renderer.actors.values()].some(g=>!g.userData.animation);i++){await new Promise(r=>setTimeout(r,10));draw();}for(let i=0;i<10;i++)draw();
   const reloaded={...renderer.renderer.info.memory,calls:renderer.metrics.drawCalls,actors:renderer.actors.size,loaded:[...renderer.actors.values()].every(g=>!!g.userData.animation)};
   return{stretched,repeatDidNotRestart,retrigger,reduced,groundedSpin,stable,after,stateUntouched,boneTextures:skeletons.length,boneTextureDisposals,removed,reloaded};
  });
  const life=report.checks.lifecycle;assert.ok(life.stretched>1);assert.ok(life.repeatDidNotRestart&&life.retrigger);assert.equal(life.reduced.dashRingScale,1);assert.equal(life.reduced.bodyHeight,0);assert.deepEqual(life.reduced.bodyScale,[1,1,1]);assert.equal(life.groundedSpin,0);assert.deepEqual(life.after,life.stable);assert.ok(life.stateUntouched);assert.equal(life.boneTextureDisposals,life.boneTextures,'Removed original rig bone textures must be disposed');assert.ok(life.reloaded.loaded);assert.equal(life.reloaded.actors,2);assert.ok(life.reloaded.geometries<=life.stable.geometries,'cache reuse must stay within warmed GPU geometry budget; the new hidden slash arc has not been uploaded');assert.equal(life.reloaded.textures,life.stable.textures);assert.equal(life.reloaded.calls,life.stable.calls);
 }
 assert.deepEqual(report.pageErrors,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{if(browser){await browser.close();report.resources.browserClosed=true;}if(vite){vite.kill();await Promise.race([new Promise(r=>vite.once('exit',r)),pause(2500)]);report.resources.viteStopped=vite.exitCode!==null||vite.signalCode!==null;}report.finishedAt=new Date().toISOString();await writeFile(new URL('result.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({output:fileURLToPath(out),...report},null,2));}
