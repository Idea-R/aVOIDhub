import { chromium } from 'playwright';
import fs from 'node:fs';
import sharp from 'sharp';
const out='verify/screenshots/crew-timing'; fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync('docs/sprint-07/CREW-ART-MANIFEST.json','utf8'));
const failures=[],errors=[];const check=(ok,msg)=>{if(!ok)failures.push(msg);};
for(const asset of manifest.assets){
  const {data,info}=await sharp(asset.runtime).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  check(info.width===480&&info.height===600,`${asset.role}: wrong runtime size`);
  check([0,info.width-1,info.width*(info.height-1),info.width*info.height-1].every(p=>data[p*4+3]===0),`${asset.role}: nontransparent corner`);
}
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));
try{
  await page.addInitScript(()=>window.__RAIL_SKIP_OPENING=true);
  await page.goto('http://localhost:5178/RAILaVOID/');
  await page.waitForFunction(()=>window.__RAIL?.ready&&window.__RAIL.view);
  async function battle(roles=['gunner','medic']){
    await page.evaluate(roles=>{const R=window.__RAIL;R.ctx.settings.setMeta({introSeen:true});R.ctx.settings.set({reducedMotion:true,showTutorial:false,uiScale:.75});R.newRun(12345);R.resume();
      R.state.train.crew.push(...roles.map((specialty,i)=>({id:`qa-${i}`,name:specialty,specialty,hp:100,carIndex:-1})));
      if(!R.sim.startExpedition(R.state.train.crew.map(c=>c.id)))throw Error('Cannot start expedition');
      // Endurance fixture for input assertions, not evidence of combat balance.
      R.state.expedition.foes.forEach(f=>{f.hp=1000;f.maxHp=1000;f.atk=1;});
      const resolve=R.sim.expeditionResolve.bind(R.sim);window.__timingJudgements=[];
      R.sim.expeditionResolve=t=>{window.__timingJudgements.push(t);return resolve(t);};
    },roles);
    await page.locator('.rv-exp-menu').waitFor({state:'visible'});await page.waitForTimeout(200);
  }
  for(const roles of [['gunner','medic'],['engineer','mechanic'],['surveyor','quartermaster']]){
    await battle(roles);
    check(await page.locator('.rv-exp-actor .rv-exp-fig-authored img').count()===3,`Missing crew art: ${roles}`);
    check(await page.locator('.rv-exp-actor svg,.rv-exp-turn,.rv-exp-key,.rv-exp-reticle').count()===0,'Silhouette/overhead marker leaked');
    check(await page.locator('.rv-exp-actor img').evaluateAll(ns=>ns.every(n=>n.complete&&n.naturalWidth>0)),`Unloaded crew art: ${roles}`);
    await page.screenshot({path:`${out}/crew-${roles.join('-')}.png`});
  }
  await battle();
  for(const trigger of ['s','Space']){
    await page.keyboard.press('s');
    await page.waitForFunction(()=>!document.querySelector('.rv-exp-ring').hidden);
    check(await page.locator('.rv-exp-ring').getAttribute('data-key')==='s','Strike must show S timing');
    // Auto-repeat must not judge the window.
    await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',repeat:true,bubbles:true})));
    check(await page.evaluate(()=>window.__timingJudgements.length)===0,'Held action key caused an early judgement');
    await page.waitForFunction(()=>document.querySelector('.rv-exp-ring').classList.contains('rv-ring-near'));
    await page.keyboard.press(trigger);
    await page.waitForFunction(()=>window.__timingJudgements.length>0);
    const t=await page.evaluate(()=>window.__timingJudgements[0]);check(t!=='miss',`${trigger}: expected a timed hit, got ${t}`);
    await battle();
  }
  // Special uses E again; test a timed Gunner action (Conductor's Rally is deliberately untimed).
  await page.evaluate(()=>window.__RAIL.state.expedition.activeActor=1);
  await page.keyboard.press('e');await page.waitForFunction(()=>!document.querySelector('.rv-exp-ring').hidden);
  check(await page.locator('.rv-exp-ring').getAttribute('data-key')==='e','Special must show E timing');
  await page.waitForFunction(()=>document.querySelector('.rv-exp-ring').classList.contains('rv-ring-near'));await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__timingJudgements.length>0);
  check(await page.evaluate(()=>window.__timingJudgements[0]!=='miss'),'E did not judge special');
  // Guards: move to the last living actor, brace, then time the incoming enemy blow with G.
  await battle();await page.evaluate(()=>window.__RAIL.state.expedition.activeActor=2);
  await page.keyboard.press('g');await page.waitForFunction(()=>{const r=document.querySelector('.rv-exp-ring');return !r.hidden&&r.classList.contains('rv-ring-guard');});
  check(await page.locator('.rv-exp-ring').getAttribute('data-key')==='g','Incoming attack must show G timing');
  check(await page.evaluate(()=>{
    const x=window.__RAIL.state.expedition,p=x.pending,a=x.actors[p.actorIndex],f=x.foes[p.foeIndex];
    const amount=t=>Math.round(f.atk*t*(a.guard>0?.5:1));
    const prompt=document.querySelector('.rv-exp-prompt').textContent;
    const target=document.querySelectorAll('.rv-exp-intent-target')[p.foeIndex].textContent;
    return target===`Next: ${a.name}`&&prompt.includes(`${a.name}: ${amount(1)} damage · ${amount(.5)} on Good · ${amount(.25)} on Perfect`);
  }),'Incoming card/prompt did not match the actual queued target and guard reductions');
  const before=await page.evaluate(()=>window.__timingJudgements.length);
  await page.waitForFunction(()=>document.querySelector('.rv-exp-ring').classList.contains('rv-ring-near'));await page.keyboard.press('g');
  await page.waitForFunction(n=>window.__timingJudgements.length>n,before);
  check(await page.evaluate(()=>window.__timingJudgements.at(-1)!=='miss'),'G did not judge block');
  // Preserve mouse/touch-style pointer activation; two presses must not resolve twice.
  await battle();await page.keyboard.press('s');
  await page.waitForFunction(()=>{const r=document.querySelector('.rv-exp-ring');return !r.hidden&&r.classList.contains('rv-ring-near');});
  await page.locator('.rv-exp-stage').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__timingJudgements.length>0);
  check(await page.evaluate(()=>window.__timingJudgements.length===1&&window.__timingJudgements[0]!=='miss'),'Pointer/Space double input resolved incorrectly');
  check(!errors.length,`Browser errors: ${errors.join('; ')}`);
  if(failures.length)throw Error(failures.join('\n'));
  console.log('PASS six crew avatar/portrait assets, seven authored battle roles, S/Space/E/G and touch timing, repeat and double-input suppression');
}catch(error){
  await page.screenshot({path:`${out}/failure.png`});
  const state=await page.evaluate(()=>{const x=window.__RAIL?.state.expedition,r=document.querySelector('.rv-exp-ring');return {phase:window.__RAIL?.state.phase,stage:x?.stage,turn:x?.turn,pending:x?.pending,judgements:window.__timingJudgements,ring:r?{hidden:r.hidden,classes:r.className}:null};});
  fs.writeFileSync(`${out}/failure.json`,JSON.stringify({message:String(error),state,errors},null,2));
  throw error;
}finally{await browser.close();}
