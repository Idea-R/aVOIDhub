/** UI/art gate only: granted crew are fixture setup, not a campaign-balance claim. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import sharp from 'sharp';
const out='verify/screenshots/expedition-cards';
fs.mkdirSync(out,{recursive:true});
const failures=[],errors=[],results=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg);};
const {data,info}=await sharp('public/art/ui/expedition-brass-frame-v2.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const alpha=(x,y)=>data[(y*info.width+x)*4+3];
check([alpha(0,0),alpha(info.width-1,0),alpha(0,info.height-1),alpha(info.width-1,info.height-1),alpha(Math.floor(info.width/2),Math.floor(info.height/2))].every(a=>a===0),'Frame corners/opening must have real alpha');
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.__RAIL_SKIP_OPENING=true);
  await page.goto('http://localhost:5178/RAILaVOID/');
  await page.waitForFunction(()=>window.__RAIL?.ready&&window.__RAIL.view);
  async function newRun(){
    await page.evaluate(()=>{const R=window.__RAIL;R.ctx.settings.setMeta({introSeen:true});R.ctx.settings.set({showTutorial:false,reducedMotion:true,uiScale:.75});R.newRun(12345);R.resume();R.state.train.crew.push({id:'qa-gunner',name:'Nils',specialty:'gunner',hp:100,carIndex:-1},{id:'qa-medic',name:'Ines',specialty:'medic',hp:100,carIndex:-1});});
  }
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768],[800,600],[390,844],[360,740],[844,450]]){
    await page.setViewportSize({width,height});await newRun();
    await page.evaluate(()=>{const R=window.__RAIL;R.sim.startExpedition(R.state.train.crew.map(c=>c.id));});
    await page.locator('.rv-exp-menu').waitFor({state:'visible'});await page.waitForTimeout(200);
    const state=await page.evaluate(async()=>{
      await Promise.all([...document.querySelectorAll('.rv-exp img')].map(i=>i.decode()));
      const root=document.querySelector('.rv-exp'),menu=root.querySelector('.rv-exp-menu'),stage=root.querySelector('.rv-exp-stage');
      const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
      const frame=getComputedStyle(root.querySelector('.rv-exp-card'),'::before').borderImageSource;
      const img=new Image();img.src=frame.slice(5,-2);await img.decode();
      return{size:[innerWidth,innerHeight],overflow:root.scrollWidth-root.clientWidth,menu:rect(menu),stage:rect(stage),plates:[...root.querySelectorAll('.rv-exp-card')].map(rect),actions:[...root.querySelectorAll('.rv-exp-action')].map(rect),frame:img.naturalWidth,blur:getComputedStyle(root.querySelector('.rv-exp-card')).backdropFilter};
    });
    results.push(state);
    check(state.overflow<=1,`${width}: horizontal overflow`);
    check(state.frame===512,`${width}: frame image missing`);
    check(state.blur==='none',`${width}: glass backdrop leaked`);
    check(state.actions.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1&&r.h>=43),`${width}: action clipped or too small`);
    check(state.plates.every(r=>r.y>=state.stage.y-1&&r.bottom<=state.menu.y+1),`${width}: identity plates collide with header/commands`);
    await page.screenshot({path:`${out}/battle-${width}x${height}.png`});
    await page.locator('.rv-exp-log-toggle').click();check(await page.locator('.rv-exp-log').isVisible(),`${width}: log not accessible`);await page.locator('.rv-exp-log-toggle').click();
  }
  await page.setViewportSize({width:1280,height:720});await newRun();
  await page.evaluate(()=>window.__RAIL.sim.debug.triggerEvent('node_site'));
  await page.locator('.rv-event .rv-option').first().click();
  await page.locator('.rv-crewpick').waitFor({state:'visible'});
  check(await page.locator('.rv-cp-portrait img').evaluateAll(ns=>ns.every(n=>n.complete&&n.naturalWidth>0)),'Crew picker portraits missing');
  await page.screenshot({path:`${out}/crew-selection-1280x720.png`});
  await page.locator('.rv-crewpick-row').nth(1).click();
  check(await page.locator('.rv-crewpick-row').nth(1).getAttribute('aria-checked')==='true','Crew selection toggle failed');
  await page.getByRole('button',{name:'Start the expedition (Enter)',exact:true}).click();
  await page.locator('.rv-exp-menu').waitFor({state:'visible'});
  check(await page.locator('.rv-exp-actor').count()===2,'Selected crew not carried into expedition');
  for(const width of [1280,800,390]){
    await page.setViewportSize({width,height:width===390?844:width===800?600:720});
    await page.evaluate(()=>window.__RAIL.ctx.settings.set({uiScale:1.1,largeText:true}));
    await page.waitForTimeout(200);
    check(await page.locator('.rv-exp-action').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&n.scrollWidth<=n.clientWidth+1;})),`${width}: large-text action overflow`);
  }
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>window.__RAIL.ctx.settings.set({uiScale:.75,largeText:false}));
  // Walk the existing deterministic battle resolver to exercise the result UI, not timing skill or balance.
  for(let step=0;step<180;step++){
    const state=await page.evaluate(()=>{const R=window.__RAIL,x=R.state.expedition;if(x.outcome)return 'result';if(x.awaitingAdvance)return 'gate';if(x.pending)R.sim.expeditionResolve('perfect');else if(x.turn==='player')R.sim.expeditionAction('strike');return 'fight';});
    if(state==='result')break;
    if(state==='gate'){
      await page.setViewportSize({width:390,height:844});
      await page.locator('.rv-exp-depth-card').waitFor({state:'visible'});
      check(await page.locator('.rv-exp-depth-card').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Phone stage-choice text overflows frame');
      await page.screenshot({path:`${out}/stage-choice-390x844.png`});
      await page.getByRole('button',{name:/Continue to Buried Concourse/}).click();
      await page.setViewportSize({width:1280,height:720});
    }
    await page.waitForTimeout(60);
  }
  await page.locator('.rv-exp-result').waitFor({state:'visible'});
  check(await page.locator('.rv-exp-result .rv-exp-rc img').count()===2,'Result lost the selected crew portraits');
  await page.screenshot({path:`${out}/battle-result-1280x720.png`});
  await page.setViewportSize({width:390,height:844});
  check(await page.locator('.rv-exp-result').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Phone result text overflows frame');
  await page.screenshot({path:`${out}/battle-result-390x844.png`});
  await page.getByRole('button',{name:'Continue (Enter)',exact:true}).click();
  await page.waitForFunction(()=>window.__RAIL.state.phase!=='expedition');
  check(errors.length===0,`Browser errors: ${errors.join('; ')}`);
}finally{await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,failures,errors},null,2));
console.log(JSON.stringify({failures,errors},null,2));
if(failures.length)process.exitCode=1;else console.log('PASS framed expedition UI, seven viewports, alpha, loaded frames, actions and crew-selection flow');
