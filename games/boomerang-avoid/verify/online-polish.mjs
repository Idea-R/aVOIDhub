import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../../docs/boomerangavoid/evidence/polish/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const contexts=[],errors=[];let releaseAssets;let allowAssets=false;const delayed=new Promise(resolve=>releaseAssets=resolve);
try{
 async function open(host=false){const ctx=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(ctx);await ctx.addInitScript(()=>{window.__pad={index:0,id:'Simulated standard controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__pad]});});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));if(host)await page.route('**/models/gamefeel/nori.glb',async route=>{if(!allowAssets)await delayed;await route.continue();});await page.goto('http://127.0.0.1:5177/boomerangavoid/');await page.locator('[data-action="online"]').click();return page;}
 const host=await open(true);await host.locator('[data-online-seat="0"][data-online-field="control"]').selectOption('pad0');await host.locator('[data-action="create-room"]').click();await host.getByRole('heading',{name:/Room /}).waitFor();const room=(await host.getByRole('heading',{name:/Room /}).innerText()).replace('Room ','');
 const peer=await open();await peer.locator('[data-online-seat="0"][data-online-field="character"]').selectOption('nori');await peer.locator('#room-code').fill(room);await peer.locator('[data-action="join-room"]').click();await peer.getByRole('heading',{name:/Room /}).waitFor();
 await host.locator('[data-lobby="bots"]').selectOption('1');await host.locator('[data-lobby="botDifficulty"]').selectOption('hard');await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.seats.some(s=>s.bot==='hard'));
 await host.locator('[data-lobby="bots"]').selectOption('0');await host.locator('[data-lobby="wins"]').selectOption('3');await host.locator('[data-lobby="upgrades"]').selectOption('false');
 await host.locator('[data-action="online-ready"]').click();await peer.locator('[data-action="online-ready"]').click();await host.locator('[data-action="online-start"]').click();
 await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.stage==='loading');await host.waitForTimeout(400);const held=await host.evaluate(()=>({stage:window.__BOOMERANGAVOID__.network.stage,tick:window.__BOOMERANGAVOID__.state.tick}));assert.equal(held.stage,'loading');assert.equal(held.tick,0,'missing model must hold authority at loading');
 allowAssets=true;releaseAssets();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.state.phase==='playing'&&window.__BOOMERANGAVOID__.online,null,{timeout:25000});
 const originalIds=await host.evaluate(()=>window.__BOOMERANGAVOID__.network.ownedSeatIds);await host.reload();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.online&&window.__BOOMERANGAVOID__.network.status==='playing',null,{timeout:25000});assert.deepEqual(await host.evaluate(()=>window.__BOOMERANGAVOID__.network.ownedSeatIds),originalIds);
 await host.bringToFront();await host.waitForTimeout(200);
 let stage=0,lastRound=0;const started=Date.now();let finished=false;
 while(Date.now()-started<120000){const debug=await host.evaluate(()=>window.__BOOMERANGAVOID__);const state=debug.state;if(state.phase==='matchResults'){finished=true;break;}if(debug.network.status==='error')throw Error(debug.network.message);if(debug.network.status==='reconnecting'){await host.evaluate(()=>{window.__pad.axes=[0,0,0,0];window.__pad.buttons[2]={pressed:false,value:0};});await host.waitForTimeout(100);continue;}if(state.round!==lastRound){stage=0;lastRound=state.round;}
  const a=state.players.find(p=>originalIds.includes(p.id)),b=state.players.find(p=>!originalIds.includes(p.id));if(!a||!b)throw Error('Missing party seats');
  let mx=0,my=0,ax=0,ay=0,slash=false;
  if(state.phase==='playing'&&a.alive&&b.alive){if(stage===0&&Math.abs(a.x-9)<.18)stage=1;if(stage===1&&Math.abs(a.y-b.y)<.16)stage=2;const tx=stage<2?9:b.x,ty=stage===0?a.y:b.y;const dx=tx-a.x,dy=ty-a.y,length=Math.hypot(dx,dy);if(length>.08){mx=dx/length;my=dy/length;}const d=Math.hypot(b.x-a.x,b.y-a.y);if(d){ax=(b.x-a.x)/d;ay=(b.y-a.y)/d;}slash=d<1.15&&Math.floor((Date.now()-started)/100)%2===0;}
  await host.evaluate(({mx,my,ax,ay,slash})=>{window.__pad.axes=[mx,my,ax,ay];window.__pad.buttons[2]={pressed:slash,value:slash?1:0};},{mx,my,ax,ay,slash});await host.waitForTimeout(55);
 }
 await host.evaluate(()=>{window.__pad.axes=[0,0,0,0];window.__pad.buttons[2]={pressed:false,value:0};});
 const terminal=await host.evaluate(()=>window.__BOOMERANGAVOID__);await host.screenshot({path:new URL('online-results.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
 assert.ok(finished,'actual controller-driven online match must finish');assert.ok(terminal.state.matchWinnerIds.some(id=>originalIds.includes(id)));
 await host.locator('[data-action="rematch"]').click();await host.getByRole('heading',{name:/Room /}).waitFor();await peer.getByRole('heading',{name:/Room /}).waitFor();
 const result={timestamp:new Date().toISOString(),localOnly:true,connections:2,modelDelayHeldTickZero:held,botDifficultyControl:true,refreshPreservedSeat:true,controllerDrivenCompleteMatch:true,rounds:terminal.state.round,rematch:true,errors};await fs.writeFile(new URL('online-browser.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.deepEqual(errors,[]);
}finally{allowAssets=true;releaseAssets();for(const context of contexts)await context.close();await browser.close();}
