/** Real-time UI acceptance of the two new arenas. No simulation writes or accelerated clocks. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {CONTENT_HASH} from '@avoid/boomerangavoid-protocol';
const evidenceName=process.env.BAV_EVIDENCE_NAME==='bot-onboarding'?'bot-onboarding':'polish-next';
const out=new URL(`../../../docs/boomerangavoid/evidence/${evidenceName}/`,import.meta.url);
const fixtures=new URL(`../../../docs/boomerangavoid/examples/${evidenceName}/`,import.meta.url);
const audit=JSON.parse(await fs.readFile(new URL('arena-new-maps-audit.json',out),'utf8'));
const specs=evidenceName==='bot-onboarding'?['reedwater-crossing','copperleaf-locks'].flatMap(id=>['relay','ffa'].map(mode=>{
 const fastest=audit.results.filter(r=>r.id===id&&r.mode===mode).sort((a,b)=>a.ticks-b.ticks)[0];
 assert.ok(fastest);return{id,mode,difficulty:fastest.difficulty,seed:fastest.seed};
})):[
 {id:'reedwater-crossing',mode:'relay',difficulty:'normal',seed:1337},
 {id:'copperleaf-locks',mode:'relay',difficulty:'hard',seed:41827},
 {id:'reedwater-crossing',mode:'ffa',difficulty:'normal',seed:1337},
 {id:'copperleaf-locks',mode:'ffa',difficulty:'normal',seed:1337},
];
const results=[],errors=[];let browser,failure,menuPassed=false;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 // The ordinary Couch Party picker must offer both canonical arenas too.
 const menuContext=await browser.newContext({viewport:{width:1280,height:800}});
 try{
  const page=await menuContext.newPage();await page.goto('http://127.0.0.1:5188/boomerangavoid/');
  await page.locator('[data-action="party"]').click();
  const choices=await page.locator('[data-config="mapId"] option').evaluateAll(nodes=>nodes.map(n=>n.value));
  assert.equal(choices.length,8);
  for(const id of ['reedwater-crossing','copperleaf-locks']){assert.ok(choices.includes(id));await page.locator('[data-config="mapId"]').selectOption(id);}
  menuPassed=true;
 }finally{await menuContext.close()}
 for(const spec of specs){
  const expected=audit.results.find(v=>Object.entries(spec).every(([key,value])=>v[key]===value));assert.ok(expected);
  const name=`arena-${spec.id}-${spec.mode}-${spec.difficulty}-${spec.seed}.json`;
  const draft=JSON.parse(await fs.readFile(new URL(name,fixtures),'utf8'));
  const result={...spec,status:'running',draft:name,transitions:[]};results.push(result);
  const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push({id:spec.id,mode:spec.mode,message:error.message}));
  const started=Date.now();let timer;
  try{
   await Promise.race([(async()=>{
    await page.goto('http://127.0.0.1:5188/boomerangavoid/?studio=1');await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
    await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(draft));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);
    await page.locator('[data-do="audit"]').click();assert.match(await page.locator('.ads-status').innerText(),/Audit passed/);
    const downloading=page.waitForEvent('download');await page.locator('[data-do="export"]').click();const downloaded=await downloading;
    const exported=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));assert.deepEqual(exported,draft);
    await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(exported));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);
    result.exactImportAuditDownloadReimport=true;
    await page.locator('[data-do="play"]').click();await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.screen==='playing'&&window.__BOOMERANGAVOID__.state.phase==='playing');
    const initial=await page.evaluate(()=>{const g=window.__BOOMERANGAVOID__;return{config:g.state.config,seats:g.state.players.map(({id,name,character,color,team,bot})=>({id,name,character,color,team,bot})),controls:g.controls}});
    assert.deepEqual(initial.config,{...draft.match,arenaDraft:draft.arena});assert.deepEqual(initial.seats,draft.seats.map(({control,...seat})=>seat));assert.deepEqual(initial.controls,draft.seats.map(({id,control})=>({id,control})));
    await page.waitForFunction(name=>document.querySelector('#arena-label')?.textContent?.startsWith(name),draft.arena.name);
    await page.waitForFunction(()=>!document.querySelector('#phase-overlay .countdown'));
    await page.screenshot({path:fileURLToPath(new URL(`${spec.id}-${spec.mode}-playing.png`,out))});
    const observed=new Map();let previous='',terminal;
    while(true){
     const v=await page.evaluate(()=>{const g=window.__BOOMERANGAVOID__,s=g.state;return{phase:s.phase,tick:s.tick,round:s.round,paused:g.paused,online:g.online,winners:s.winnerIds,matchWinners:s.matchWinnerIds,relayScores:s.relay.scores,scores:s.players.map(({id,score,kills})=>({id,score,kills})),finiteAndBounded:[...s.players,...s.weapons,...s.pickups,...s.effects,s.relay].every(e=>Object.values(e).every(v=>typeof v!=='number'||Number.isFinite(v))&&Math.abs(e.x)<=11.00001&&Math.abs(e.y)<=8.50001)}});
     assert.ok(!v.paused&&!v.online&&v.finiteAndBounded);
     const key=`${v.round}/${v.phase}`;if(key!==previous){result.transitions.push({round:v.round,phase:v.phase,observedTick:v.tick});previous=key;}
     if(v.phase==='roundResults'||v.phase==='matchResults')observed.set(v.round,{round:v.round,winners:v.winners,scores:v.scores.map(({id,score})=>({id,score}))});
     if(v.phase==='matchResults'){terminal=v;break}await page.waitForTimeout(100);
    }
    assert.equal(terminal.tick,expected.ticks);assert.equal(terminal.round,expected.rounds);assert.deepEqual(terminal.scores,expected.scores);assert.deepEqual(terminal.matchWinners,expected.winnerIds);assert.deepEqual(terminal.relayScores,expected.relayScores);
    assert.deepEqual([...observed.values()],expected.roundResults.map(({round,winners,scores})=>({round,winners,scores})));
    if(spec.mode==='relay'){assert.equal(Math.max(...terminal.relayScores),3);assert.match(await page.locator('.result-crew').innerText(),/3 deliveries/)}
    await page.locator('.results-panel').waitFor();await page.screenshot({path:fileURLToPath(new URL(`${spec.id}-${spec.mode}-results.png`,out))});
    result.fullNaturalResultsMatchHeadless=true;result.terminal=terminal;
    await page.locator('.results-panel [data-action="rematch"]').click();await page.waitForFunction(()=>{const g=window.__BOOMERANGAVOID__;return g?.screen==='playing'&&g.state.phase==='playing'&&g.state.round===1});
    const reset=await page.evaluate(()=>{const s=window.__BOOMERANGAVOID__.state;return{config:s.config,scores:s.players.map(p=>p.score),relay:s.relay.scores}});
    assert.deepEqual(reset.config,initial.config);assert.deepEqual(reset.scores,draft.seats.map(()=>0));assert.deepEqual(reset.relay,[0,0]);result.rematchReset=true;result.status='passed';
   })(),new Promise((_,reject)=>{const limit=Math.min(600000,Math.max(180000,expected.ticks/60*2500+20000));result.wallClockLimitMs=limit;timer=setTimeout(()=>reject(Error(`Arena UI case exceeded ${limit}ms`)),limit)})]);
  }catch(error){result.status='failed';result.error=error.message;await page.screenshot({path:fileURLToPath(new URL(`${spec.id}-${spec.mode}-failure.png`,out))}).catch(()=>{});throw error}
  finally{clearTimeout(timer);result.wallClockMs=Date.now()-started;await context.close()}
 }
 assert.deepEqual(errors,[]);
}catch(error){failure=error}finally{
 await browser?.close();
 const report={timestamp:new Date().toISOString(),contentHash:CONTENT_HASH,passed:!failure&&results.length===specs.length,ordinaryMenuHasEightArenas:menuPassed,selection:evidenceName==='bot-onboarding'?'Fastest complete audited fixture for each arena/mode, to bound wall time; no runtime overrides.':'Declared original polish fixtures.',scope:'Actual Chrome UI, ordinary menu availability plus ADS import/audit/download/reimport, real-time complete matches/results/rematch. Development hook read-only; no simulation writes or clock acceleration. Not physical-device or arbitrary-seed coverage.',results,errors,...(failure?{failure:failure.message}:{})};
 await fs.writeFile(new URL('arena-browser.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,results:results.map(({id,mode,status,wallClockMs})=>({id,mode,status,wallClockMs})),errors}));
}if(failure)throw failure;
