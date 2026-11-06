/** Real local rooms and UI controls; test-only transport/presentation impairments live in
 * isolated browser init scripts, never in the game or deployed server. Requires Vite5177. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));globalThis.WebSocket=require('ws');const {Client}=require('@colyseus/sdk');
const base=process.env.BAV_CLIENT_URL||'http://127.0.0.1:5177/boomerangavoid/';
const roomUrl=process.env.BAV_TEST_ROOM_URL||'http://127.0.0.1:2777';
for(const address of [base,roomUrl])assert.ok(['localhost','127.0.0.1'].includes(new URL(address).hostname),'Impairments are loopback-only');
const out=new URL('./raw/low-power/',import.meta.url);await fs.mkdir(out,{recursive:true});
const profiles=[{name:'software-desktop',software:true,viewport:{width:1100,height:760},dpr:1,cpu:1,mobile:false},{name:'mobile-cpu4',software:false,viewport:{width:390,height:844},dpr:2,cpu:4,mobile:true}];
const reports=[];
for(const profile of profiles.filter(p=>!process.env.BAV_PROFILE||p.name===process.env.BAV_PROFILE)){
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(profile.software?['--use-angle=swiftshader']:[])]});
 const contexts=[],errors=[];let peer;
 try{
  async function open(isHost){
   const context=await browser.newContext({viewport:isHost?profile.viewport:{width:480,height:360},deviceScaleFactor:isHost?profile.dpr:1,isMobile:isHost&&profile.mobile,hasTouch:isHost&&profile.mobile});contexts.push(context);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/src/net.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('http://127.0.0.1:2777',roomUrl)});});
   await page.addInitScript(({roomPort})=>{
    const fault=window.__transportFixture={sockets:[],events:[],dropId:0,captured:null,delayingCloseId:0,closeDelayMs:0,rafMs:0};
    const Native=window.WebSocket;let next=0;
    window.WebSocket=class extends Native{
     constructor(...args){super(...args);if(new URL(String(args[0]),location.href).port!==roomPort)return;const item={id:++next,ws:this,sent:0,received:0};fault.sockets.push(item);let replay=false;
      this.addEventListener('message',e=>{item.received++;if(fault.dropId===item.id){if(new TextDecoder().decode(new Uint8Array(e.data).slice(0,20)).includes('snapshot'))fault.captured??={socket:this,data:e.data};e.stopImmediatePropagation();}});
      this.addEventListener('close',e=>{if(!replay&&fault.delayingCloseId===item.id){e.stopImmediatePropagation();setTimeout(()=>{replay=true;this.dispatchEvent(new CloseEvent('close',{code:e.code,wasClean:e.wasClean}));replay=false;},fault.closeDelayMs);return}fault.events.push({type:'close',id:item.id,code:e.code,at:Date.now()});});
      this.addEventListener('open',()=>fault.events.push({type:'open',id:item.id,at:Date.now()}));const send=this.send.bind(this);this.send=data=>{item.sent++;return send(data)};
     }
    };
    const nativeRaf=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window),pending=new Map();let rafId=0;
    window.requestAnimationFrame=callback=>{const id=++rafId,entry={timer:0,native:0};pending.set(id,entry);const deliver=()=>{entry.native=nativeRaf(t=>{pending.delete(id);callback(t)});};if(fault.rafMs)entry.timer=setTimeout(deliver,fault.rafMs);else deliver();return id};
    window.cancelAnimationFrame=id=>{const entry=pending.get(id);if(entry){clearTimeout(entry.timer);nativeCancel(entry.native);pending.delete(id)}};
   },{roomPort:new URL(roomUrl).port});
   const cdp=await context.newCDPSession(page);if(isHost&&profile.cpu!==1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
   await page.goto(base);await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.ready);await page.getByRole('button',{name:/Online Party/}).click();return{page,cdp};
  }
  const {page:host,cdp}=await open(true);await host.getByRole('button',{name:'+ Add local player',exact:true}).click();await host.locator('[data-online-seat="1"][data-online-field="control"]').selectOption('keyboard2');await host.getByRole('button',{name:/Create a room/}).click();await host.getByRole('heading',{name:/Room /}).waitFor();
  const room=(await host.getByRole('heading',{name:/Room /}).innerText()).replace('Room ','');
  // Independent SDK peer avoids putting two software GPUs on one low-power client.
  const health=await fetch(roomUrl+'/health').then(r=>r.json());peer=await new Client(roomUrl).joinById(room,{guest:true,protocol:health.protocol,contentHash:health.contentHash,localSeats:1,name:'Recovery peer',characters:['pip']});peer.onMessage('welcome',()=>{});peer.onMessage('notice',()=>{});let loaded=-1;peer.onMessage('snapshot',s=>{if(s.stage==='loading'&&s.state&&loaded!==s.state.round){loaded=s.state.round;peer.send('loaded',{contentHash:health.contentHash,round:loaded})}});
  await host.getByRole('button',{name:'Ready all 2 local players',exact:true}).click();peer.send('ready',true);await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.readyIds.length===3);await host.getByRole('button',{name:'Start party',exact:true}).click();await host.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:20000});await host.bringToFront();
  await host.waitForTimeout(10000);const natural=await host.evaluate(()=>window.__BOOMERANGAVOID__.metrics);
  const originalIds=await host.evaluate(()=>window.__BOOMERANGAVOID__.network.ownedSeatIds);
  const position=()=>host.evaluate(()=>{const d=window.__BOOMERANGAVOID__,p=d.state.players.find(p=>p.id===d.network.ownedSeatIds[0]);return{x:p.x,y:p.y}});
  if(profile.mobile){
   const stick=await host.locator('#touch-stick').boundingBox();assert.ok(stick);const x=stick.x+stick.width/2,y=stick.y+stick.height/2;const before=await position();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+32,y,id:1}]});await host.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await host.waitForTimeout(300);const after=await position();assert.ok(after.x-before.x>.4,'real touch moves an authoritative seat');
  }
  await host.evaluate(()=>{window.__transportFixture.rafMs=250});await host.waitForTimeout(1000);await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='playing'&&window.__BOOMERANGAVOID__.network.snapshotAgeMs<500,null,{timeout:20000});await host.waitForTimeout(600);
  console.log(JSON.stringify({stage:'before-input',profile:profile.name,debug:await host.evaluate(()=>({network:window.__BOOMERANGAVOID__.network,metrics:window.__BOOMERANGAVOID__.metrics}))}));
  // Briefly stop presentation entirely: input cadence must continue without a frame.
  // This isolates sampling from variable GPU work rather than asserting a device FPS.
  await host.evaluate(()=>{window.__transportFixture.rafMs=2000});await host.waitForTimeout(650);
  const cadenceBefore=await host.evaluate(()=>({at:Date.now(),sent:window.__transportFixture.sockets.at(-1).sent,frames:window.__BOOMERANGAVOID__.metrics.frames}));
  const beforeMove=await position();await host.keyboard.down('KeyD');await host.waitForTimeout(650);await host.keyboard.up('KeyD');await host.waitForTimeout(450);
  const cadenceAfter=await host.evaluate(()=>({at:Date.now(),sent:window.__transportFixture.sockets.at(-1).sent,frames:window.__BOOMERANGAVOID__.metrics.frames}));
  console.log(JSON.stringify({stage:'cadence',profile:profile.name,cadenceBefore,cadenceAfter}));
  assert.ok(cadenceAfter.sent-cadenceBefore.sent>10,'input continues while presentation is suspended');assert.equal(cadenceAfter.frames,cadenceBefore.frames,'no rendered frame drove the input sample');
  await host.evaluate(()=>{window.__transportFixture.rafMs=250});await host.waitForTimeout(2300);const afterMove=await position();assert.ok(afterMove.x-beforeMove.x>.6,'timer-sampled input moved the authoritative seat');
  // Drop incoming app messages on only the current socket; native heartbeats stay real.
  await host.evaluate(()=>{const f=window.__transportFixture;f.dropId=f.sockets.at(-1).id;f.captured=null;});
  await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='reconnecting',null,{timeout:4000});
  await host.waitForFunction(()=>window.__transportFixture.captured!==null);const staleTick=await host.evaluate(()=>window.__BOOMERANGAVOID__.state.tick);
  await host.evaluate(()=>{const f=window.__transportFixture,c=f.captured;f.dropId=0;c.socket.dispatchEvent(new MessageEvent('message',{data:c.data}));f.dropId=f.sockets.at(-1).id;});
  assert.equal(await host.evaluate(()=>window.__BOOMERANGAVOID__.network.status),'reconnecting','old callback cannot restore freshness');
  assert.equal(await host.evaluate(()=>window.__BOOMERANGAVOID__.state.tick),staleTick);
  await host.waitForFunction(()=>window.__transportFixture.sockets.length>=2&&window.__BOOMERANGAVOID__.network.status==='playing',null,{timeout:10000});
  assert.deepEqual(await host.evaluate(()=>window.__BOOMERANGAVOID__.network.ownedSeatIds),originalIds);
  const restored=await position();await host.waitForTimeout(600);const still=await position();assert.ok(Math.hypot(still.x-restored.x,still.y-restored.y)<.25,'recovery does not replay motion');
  await host.keyboard.press('KeyD',{delay:400});await host.waitForTimeout(400);const resumed=await position();assert.ok(resumed.x-still.x>.4,'fresh press resumes after neutral');
  // A full JS task stall must not replay a held movement/action on return.
  await host.keyboard.down('KeyD');await host.evaluate(()=>{const end=performance.now()+2200;while(performance.now()<end){}});await host.waitForTimeout(600);
  const afterStall=await position();await host.waitForTimeout(600);const stallStill=await position();assert.ok(Math.hypot(stallStill.x-afterStall.x,stallStill.y-afterStall.y)<.25);await host.keyboard.up('KeyD');
  await host.screenshot({path:fileURLToPath(new URL(profile.name+'.png',out))});
  const beforeExpiry=await host.evaluate(()=>({metrics:window.__BOOMERANGAVOID__.metrics,network:window.__BOOMERANGAVOID__.network,events:window.__transportFixture.events}));
  // Delay JS's close notification past the unchanged server20s lease; no token logging.
  await host.evaluate(()=>{const f=window.__transportFixture,item=f.sockets.at(-1);f.delayingCloseId=item.id;f.closeDelayMs=23000;item.ws.close(4010);});
  await host.waitForFunction(()=>window.__BOOMERANGAVOID__.network.status==='error',null,{timeout:33000});
  const terminal=await host.evaluate(()=>({network:window.__BOOMERANGAVOID__.network,playing:window.__BOOMERANGAVOID__.playing,saved:sessionStorage.getItem('bav-reconnect')!==null,events:window.__transportFixture.events}));
  assert.equal(terminal.network.lastCloseCode,4003);assert.match(terminal.network.message,/20-second seat lease ended/);assert.equal(terminal.playing,false);assert.equal(terminal.saved,false);assert.equal(errors.length,0);
  const report={timestamp:new Date().toISOString(),profile,peer:'one independent real SDK connection, two owned browser seats',naturalMetrics:natural,presentationLimitMs:250,inputPacketsWithoutRenderedFrame:cadenceAfter.sent-cadenceBefore.sent,cadenceWindowMs:cadenceAfter.at-cadenceBefore.at,renderedFramesInCadenceWindow:cadenceAfter.frames-cadenceBefore.frames,travel:afterMove.x-beforeMove.x,staleAuthorityRejected:true,watchdogReconnectedSameParty:true,noMotionReplay:true,freshPressResumed:true,taskStallReleasedControls:true,beforeExpiry,expiredLease:{closeCode:terminal.network.lastCloseCode,message:terminal.network.message,playing:terminal.playing,storedTokenCleared:!terminal.saved},errors,scope:'Real loopback SDK rooms and UI inputs, browser-only transport/presentation impairments; CPU/mobile emulation is not physical device or internet certification'};
  reports.push(report);await fs.writeFile(new URL(profile.name+'.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({profile:profile.name,passed:true,inputBatches:report.inputPacketsWithoutRenderedFrame,frames:report.renderedFramesInCadenceWindow,quality:beforeExpiry.metrics.effectiveQuality}));
 }catch(e){capture:for(const context of contexts){for(const page of context.pages()){try{const d=await page.evaluate(()=>({debug:window.__BOOMERANGAVOID__,events:window.__transportFixture?.events}));await fs.writeFile(new URL(profile.name+'-failure.json',out),JSON.stringify({message:String(e),errors,...d},null,2));break capture}catch{}}}throw e;
 }finally{if(peer)await peer.leave();for(const context of contexts)await context.close();await browser.close();}
}
await fs.writeFile(new URL('summary.json',out),JSON.stringify({timestamp:new Date().toISOString(),reports},null,2));
