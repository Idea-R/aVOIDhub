import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {startFixture,pause,until} from './loopback-fixture.mjs';

// Run from the repository root: node games/boomerang-avoid/verify/impaired-browser.mjs
// All actions use the actual DOM or simulated navigator Gamepad samples. The
// development getter is read-only observation; no SDK peer or state mutations.
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const recoveryOnly=process.argv.includes('--recovery-only');
const out=new URL(`../../../docs/boomerangavoid/evidence/completion/impaired-browser-${stamp}/`,import.meta.url);
await mkdir(out,{recursive:true});
const report={startedAt:new Date().toISOString(),passed:false,cases:[],pageErrors:[],resources:{},limitations:[
 'Two actual Chrome contexts, real app/adapter and server; standard gamepads simulated, no physical hardware claim.',
 'Seeded ordered WebSocket message delay: nominal120ms RTT, +/-20ms each direction,1.5%180ms stalls. Deliberate2500ms downstream blackout queues all messages reliably; no dropped TCP packets, input omissions or snapshot filtering.',
 'Loopback only; no TLS, internet, hosted capacity or subjective playability certification. Runtime model metadata unavailable.'
]};
report.mode=recoveryOnly?'recovery-only':'full-journey';
let fixture,browser;const contexts=[];let phase='startup';
const debug=page=>page.evaluate(()=>window.__BOOMERANGAVOID__);
async function pad(page,mx=0,my=0){await page.evaluate(([x,y])=>{window.__fixturePad.axes=[x,y,0,0];},[mx,my]);}
async function open(){const context=await browser.newContext({viewport:{width:1050,height:760}});contexts.push(context);
 await context.addInitScript(()=>{window.__fixturePad={index:0,id:'Simulated standard fixture controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__fixturePad]});});
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));return{context,page};}
async function online(page){await page.goto(fixture.base);await page.locator('[data-action="online"]').click();await page.locator('[data-online-seat="0"][data-online-field="control"]').selectOption('pad0');}
async function join(host,peer){await host.locator('[data-action="create-room"]').click();await host.getByRole('heading',{name:/Room /}).waitFor();const room=(await host.getByRole('heading',{name:/Room /}).innerText()).replace('Room ','');await peer.locator('[data-online-seat="0"][data-online-field="character"]').selectOption('nori');await peer.locator('#room-code').fill(room);await peer.locator('[data-action="join-room"]').click();await peer.getByRole('heading',{name:/Room /}).waitFor();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.seats.length===2);return room;}
async function start(host,peer){await host.locator('[data-action="online-ready"]').click();await peer.locator('[data-action="online-ready"]').click();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.readyIds.length===2);await host.locator('[data-action="online-start"]').click();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.stage==='loading');}

try{
 fixture=await startFixture();report.resources=fixture.resources;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 // First prove cancellation through Leave, with a real pending GLB request.
 if(!recoveryOnly){phase='loading cancellation';const cancelHost=await open(),cancelPeer=await open();let cancelledRequests=0;
 await cancelHost.page.route('**/models/gamefeel/nori.glb',()=>{cancelledRequests++;});
 await online(cancelHost.page);await online(cancelPeer.page);await join(cancelHost.page,cancelPeer.page);await start(cancelHost.page,cancelPeer.page);
 await until(()=>cancelledRequests>0);const held=await debug(cancelHost.page);assert.equal(held.state.tick,0);
 await cancelHost.page.locator('[data-action="leave-online"]').click();await cancelHost.page.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='idle');await pause(400);
 const cancelled=await debug(cancelHost.page);assert.equal(cancelled.online,false);report.cases.push({case:'leave-cancels-loading',pendingRequests:cancelledRequests,heldTick:held.state.tick,lateEntry:cancelled.online});
 await cancelHost.context.close();await cancelPeer.context.close();}

 phase='model timeout and retry';const a=await open(),b=await open(),host=a.page,peer=b.page;let requests=0,allow=recoveryOnly;
 await host.route('**/models/gamefeel/nori.glb',route=>{requests++;if(!allow&&requests===1)return;if(!allow)return route.fulfill({status:503,body:'Transient loopback fixture'});return route.continue();});
 await online(host);await online(peer);const roomId=await join(host,peer);
 await host.locator('[data-lobby="mapId"]').selectOption('tideglass-steps');await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.config.mapId==='tideglass-steps');
 await host.locator('[data-lobby="upgrades"]').selectOption('false');await host.waitForFunction(()=>!window.__BOOMERANGAVOID__.network.config.upgrades);
 await start(host,peer);if(!recoveryOnly){await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.message.includes('Retry loading'),null,{timeout:18000});
 const failed=await debug(host);assert.equal(failed.network.stage,'loading');assert.equal(failed.state.tick,0);assert.ok(requests>=2);
 const failedRequests=requests;allow=true;await host.locator('[data-action="retry-assets"]').click();
 await host.waitForFunction(()=>window.__BOOMERANGAVOID__.state.phase==='playing'&&window.__BOOMERANGAVOID__.online,null,{timeout:25000});
 assert.ok(requests>failedRequests);report.cases.push({case:'stalled-then503-then-manual-fresh-retry',roomId,failedRequests,totalRequests:requests,heldTick:failed.state.tick,playing:true});}
 else await host.waitForFunction(()=>window.__BOOMERANGAVOID__.state.phase==='playing'&&window.__BOOMERANGAVOID__.online,null,{timeout:25000});

 phase='blackout release recovery';const ids=(await debug(host)).network.ownedSeatIds,sessionId=(await debug(host)).network.clientId;
 // Move on the safe outer path; the peer's state observes authority independently.
 await host.bringToFront();await pad(host,.45,0);await pause(450);fixture.proxy.blackout(sessionId,2500);
 await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='reconnecting',null,{timeout:4500});
 const stale=await debug(host);assert.ok(stale.network.snapshotAgeMs>=1500);
 await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='playing'&&window.__BOOMERANGAVOID__.network.inputsSuspended,null,{timeout:6500});
 await pause(150);const guidance={case:'visible-release-guidance',status:(await debug(host)).network.status,inputsSuspended:(await debug(host)).network.inputsSuspended,adapterMessage:(await debug(host)).network.message,visibleText:await host.locator('#game-message').innerText()};guidance.visibleReleaseInstruction=/release.*controls|release.*stick/i.test(guidance.visibleText);report.cases.push(guidance);
 await host.screenshot({path:fileURLToPath(new URL('release-guidance.png',out))});
 const authority=async()=>{const d=await debug(peer);return d.state.players.find(p=>p.id===ids[0]);};
 await pause(500);const stopped=await authority();await pause(500);const still=await authority();assert.ok(Math.hypot(still.x-stopped.x,still.y-stopped.y)<.08,'held control must remain neutral after stale recovery');
 await pad(host);await pause(300);await pad(host,.45,0);const before=await authority();await pause(900);const after=await authority();
 report.cases.push({case:'ordered-blackout-neutral-release',blackoutMs:2500,stickMagnitude:.45,staleAgeMs:stale.network.snapshotAgeMs,heldDrift:Math.hypot(still.x-stopped.x,still.y-stopped.y),freshMovement:after.x-before.x,before:{x:before.x,y:before.y},after:{x:after.x,y:after.y},hostMessage:(await debug(host)).network.message});
 assert.ok(after.x-before.x>.4,'neutral sample then fresh movement resumes authority');assert.equal(guidance.inputsSuspended,true);assert.equal(guidance.visibleReleaseInstruction,true,'paused inputs must have a visible release instruction');assert.equal((await debug(host)).network.inputsSuspended,false,'typed recovery flag follows actual resumed input session');await pad(host);

 if(recoveryOnly){assert.deepEqual(report.pageErrors,[]);report.passed=true;}
 else{

 phase='refresh reconnect';await host.reload();await host.waitForFunction(()=>window.__BOOMERANGAVOID__.online&&window.__BOOMERANGAVOID__.network.status==='playing',null,{timeout:20000});assert.deepEqual((await debug(host)).network.ownedSeatIds,ids);
 report.cases.push({case:'refresh-restores-same-seat',seatIds:ids,roomId:(await debug(host)).network.roomId});

 phase='complete authoritative match';const rounds=new Set(),started=performance.now();
 while(performance.now()-started<60000){const d=await debug(peer),state=d.state;if(state.phase==='matchResults')break;rounds.add(state.round);
  const p=state.players.find(p=>d.network.ownedSeatIds.includes(p.id));let mx=0,my=0;
  if(state.phase==='playing'&&p?.alive){const dy=(p.y>=0?3.3:-3.3)-p.y;my=Math.max(-.8,Math.min(.8,dy*1.1));mx=Math.abs(dy)<.35?Math.sign((Math.abs(p.x+3)<=Math.abs(p.x-3)?-3:3)-p.x)*.8:0;}
  await pad(peer,mx,my);await pause(55);
 }
 await pad(peer);await host.waitForFunction(()=>window.__BOOMERANGAVOID__.state.phase==='matchResults',null,{timeout:10000});
 const terminal=await debug(host),other=await debug(peer);assert.deepEqual(terminal.state.matchWinnerIds,ids);assert.deepEqual(other.state.matchWinnerIds,ids);assert.equal(terminal.state.players.find(p=>p.id===ids[0]).score,3);
 await host.screenshot({path:fileURLToPath(new URL('results.png',out))});
 await host.locator('[data-action="rematch"]').click();await host.getByRole('heading',{name:/Room /}).waitFor();await peer.getByRole('heading',{name:/Room /}).waitFor();const rematch=await debug(host);assert.equal(rematch.network.seats.length,2);assert.equal(rematch.network.readyIds.length,0);
 report.cases.push({case:'complete-three-round-match-and-rematch',rounds:[...rounds],winnerIds:terminal.state.matchWinnerIds,score:3,rematchSeats:rematch.network.seats.length,allUnready:true});
 assert.deepEqual(report.pageErrors,[]);report.passed=true;
 }
}catch(error){report.failure={phase,message:error.message,stack:error.stack};process.exitCode=1;}
finally{
 for(const context of contexts)await context.close().catch(()=>{});if(browser){await browser.close();report.resources.browserClosed=true;}
 if(fixture){report.proxyMetrics=fixture.proxy.metrics;await fixture.stop();}
 report.finishedAt=new Date().toISOString();await writeFile(new URL('result.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({output:fileURLToPath(out),...report},null,2));
}
