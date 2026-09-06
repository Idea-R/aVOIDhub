/** Isolated keyboard/visual fixtures; direct resolver use is NOT balance evidence. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://localhost:5178/RAILaVOID/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'verify/screenshots/dialogue-shortcuts'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],failures=[]; const check=(ok,text)=>{if(!ok)failures.push(text);};
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>window.__RAIL_SKIP_OPENING=true);
async function fresh(){
  await page.evaluate(()=>{const R=window.__RAIL;R.ctx.settings.setMeta({introSeen:true});R.ctx.settings.set({reducedMotion:true,showTutorial:false,uiScale:.75});R.newRun(12345);R.resume();R.state.train.crew.push({id:'qa-medic',name:'Ines',specialty:'medic',hp:100,carIndex:-1},{id:'qa-gunner',name:'Nils',specialty:'gunner',hp:100,carIndex:-1});});
}
async function keyEvent(key,extra={}){await page.evaluate(({key,extra})=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra})),{key,extra});}
async function stageOne(){
  await page.evaluate(()=>{const R=window.__RAIL;for(let i=0;i<200;i++){const x=R.state.expedition;if(x.awaitingAdvance||x.outcome)break;if(x.pending)R.sim.expeditionResolve('good');else R.sim.expeditionAction('strike');}R.sim.restore(R.sim.serialize());});
  await page.locator('.rv-exp-depth-card').waitFor({state:'visible'});
}
try{
  await page.goto(base);await page.waitForFunction(()=>window.__RAIL?.ready&&window.__RAIL.view);
  for(const [width,height] of [[1280,720],[800,600],[390,844],[360,740],[844,450]]){
    await page.setViewportSize({width,height});await fresh();
    await page.evaluate(()=>window.__RAIL.sim.debug.triggerEvent('node_crossroads'));
    await page.locator('.rv-conversation').waitFor({state:'visible'});
    await page.locator('.rv-conversation-bust img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
    const geo=await page.locator('.rv-conversation').evaluate(n=>{
      const p=n.querySelector('.rv-person-player').getBoundingClientRect(),q=n.querySelector('.rv-person-npc').getBoundingClientRect();
      return {left:p.x<q.x,images:[...n.querySelectorAll('.rv-conversation-bust')].map(i=>({h:i.clientHeight,w:i.clientWidth})),speech:[...n.querySelectorAll('.rv-conversation-line')].map(i=>({h:i.clientHeight,overflow:i.scrollHeight-i.clientHeight}))};
    });
    check(geo.left,`${width}: Conductor not on left`);check(geo.images.every(i=>i.h>=50&&i.w>=65),`${width}: portraits collapsed`);check(geo.speech.every(i=>i.h>=60),`${width}: dialogue collapsed`);
    await page.screenshot({path:`${out}/conversation-${width}x${height}.png`});
    await page.keyboard.press('c');check(await page.evaluate(()=>window.__RAIL.state.activeEvent.dialogue?.step??'arrival')==='arrival','C chose a dialogue branch');
    await keyEvent('1',{ctrlKey:true});await keyEvent('1',{repeat:true});
    check(await page.evaluate(()=>window.__RAIL.state.activeEvent.dialogue?.step??'arrival')==='arrival','Modified or held number chose a reply');
    await page.keyboard.press('1');await page.locator('.rv-conversation[data-dialogue-step="briefing"]').waitFor();
    await page.keyboard.press('1');await page.locator('.rv-crewpick').waitFor({state:'visible'});
    await keyEvent('c',{repeat:true});check(await page.evaluate(()=>window.__RAIL.state.phase)==='event','Held C started expedition');
    await page.getByRole('button',{name:'Cancel (Esc)',exact:true}).focus();await page.keyboard.press('Enter');
    await page.locator('.rv-conversation').waitFor({state:'visible'});
    await page.keyboard.press('3');await page.locator('.rv-conversation[data-dialogue-step="receipt"]').waitFor();
    await page.keyboard.press('c');await page.waitForFunction(()=>window.__RAIL.state.phase==='running');
    check(await page.evaluate(()=>window.__RAIL.state.speedMul)===1,'Reply key leaked into world speed');
  }
  await page.setViewportSize({width:1280,height:720});await fresh();
  await page.evaluate(()=>window.__RAIL.sim.debug.triggerEvent('node_site'));await page.keyboard.press('1');
  await page.locator('.rv-crewpick').waitFor({state:'visible'});await page.keyboard.press('2');await page.keyboard.press('3');await page.keyboard.press('c');
  await page.locator('.rv-exp-menu').waitFor({state:'visible'});await stageOne();
  check(await page.locator('.rv-exp-depth-card [aria-keyshortcuts="C"]').count()===1,'No continue badge at stage gate');
  await keyEvent('c',{repeat:true});await keyEvent('c',{ctrlKey:true});
  check(await page.evaluate(()=>window.__RAIL.state.expedition.stage)===1,'Repeated/modified C advanced a stage');
  await page.screenshot({path:`${out}/continue-deeper.png`});
  await page.locator('.rv-exp-depth-card [data-retreat]').focus();await page.keyboard.press('Enter');
  await page.locator('.rv-exp-result').waitFor({state:'visible'});
  check(await page.evaluate(()=>window.__RAIL.state.expedition.outcome)==='fled','Native Enter on Retreat continued instead');
  await page.keyboard.press('c');await page.waitForFunction(()=>window.__RAIL.state.phase==='event');
  // Start another ordinary fixture and use C to continue deeper, then to leave victory.
  await fresh();await page.evaluate(()=>window.__RAIL.sim.startExpedition(window.__RAIL.state.train.crew.map(c=>c.id)));
  await page.locator('.rv-exp-menu').waitFor({state:'visible'});await stageOne();await page.keyboard.press('c');
  await page.waitForFunction(()=>window.__RAIL.state.expedition.stage===2);
  await page.evaluate(()=>{const R=window.__RAIL;for(let i=0;i<200&&!R.state.expedition.outcome;i++){if(R.state.expedition.pending)R.sim.expeditionResolve('good');else R.sim.expeditionAction('strike');}R.sim.restore(R.sim.serialize());});
  await page.locator('.rv-exp-result').waitFor({state:'visible'});
  check(await page.evaluate(()=>window.__RAIL.state.expedition.outcome)==='won','Fixture did not reach victory');
  await page.screenshot({path:`${out}/victory.png`});
  await keyEvent('c',{repeat:true});check(await page.evaluate(()=>window.__RAIL.state.phase)==='expedition','Held C left result');
  await page.keyboard.press('c');await page.waitForFunction(()=>window.__RAIL.state.phase==='relic');
  await page.keyboard.press('c');check(await page.evaluate(()=>window.__RAIL.state.phase)==='relic','C auto-picked a relic');
  await page.keyboard.press('1');await page.waitForFunction(()=>window.__RAIL.state.phase==='running');
  await page.keyboard.press('Escape');await page.locator('.rv-pause').waitFor({state:'visible'});await page.keyboard.press('c');await page.waitForFunction(()=>window.__RAIL.state.phase==='running');
}catch(e){failures.push(e.stack??String(e));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify({errors,failures},null,2));console.log(JSON.stringify({errors,failures},null,2));if(errors.length||failures.length)process.exitCode=1;}
