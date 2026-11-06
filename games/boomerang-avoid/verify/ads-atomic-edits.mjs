/** Real editor events and natural fixed-step play. No gameplay mutations or accelerated clock. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newDraft,parseDraft} from '../src/studio-contract.ts';
import {createMatch,getBotInputs,stateHash,step} from '@avoid/boomerangavoid-sim';

const baseline=process.argv.includes('--baseline');
const out=new URL('../../../docs/boomerangavoid/evidence/ads-atomic/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const report={baseline,passed:false,timestamp:new Date().toISOString(),pageErrors:[],scope:'Actual Chrome ADS UI, browser storage, real download/reload and local natural match. Read-only game observation, no state writes or clock acceleration. No hardware/network/hosting claim.'};
let vite,browser,failure;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const storage='boomerangavoid.ads.draft.v1';
const fixture=newDraft('moss-court');
fixture.label='Atomic configuration proving yard';fixture.arena.name=fixture.label;
fixture.match={...fixture.match,seed:41827,wins:3,enabledUpgrades:['guard'],stageIds:['moss-court','lantern-foundry']};
fixture.seats.forEach((s,i)=>{s.bot=i===0?null:i===1?'hard':'easy';s.control=i===0?'keyboard1':'bot';});

try {
  const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const safeEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata)$/i.test(k)));
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,env:safeEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [vite.stdout,vite.stderr])stream.on('data',b=>output=(output+b).slice(-3000));
  const endpoint=`http://127.0.0.1:${port}/boomerangavoid/?studio=1`;
  for(let i=0;i<150;i++){if(vite.exitCode!==null)throw Error(output);if(await fetch(endpoint).then(r=>r.ok).catch(()=>false))break;if(i===149)throw Error('Owned Vite startup timeout');await pause(100);}
  report.vite={pid:vite.pid,bind:'127.0.0.1',port};
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(endpoint);await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storage);
  const change=async(selector,value)=>{await page.locator(selector).fill(value);await page.locator(selector).press('Tab');};
  const importDraft=async(d)=>{await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(d));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);};
  await importDraft(fixture);
  await page.locator('[data-tab="rules"]').click();
  await change('[data-rule="seed"]','-1');
  if(baseline){
    report.invalidSeedSaved=(await read()).match.seed===-1;assert.equal(report.invalidSeedSaved,true);
    await page.reload();await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
    report.reloadStatus=await page.locator('.ads-status').innerText();
    assert.match(report.reloadStatus,/could not be loaded/);
    assert.notEqual(await page.locator('#ads-label').inputValue(),fixture.label);
    report.validAuthoredDraftLostOnReload=true;
    await page.screenshot({path:fileURLToPath(new URL('before-invalid-reload.png',out))});
  }else{
    assert.match(await page.locator('.ads-status').innerText(),/Change rejected: match.seed: enter a whole number from 0 to 4294967295/);
    const notice=await page.locator('.ads-status').boundingBox();
    assert.ok(notice&&notice.y>=0&&notice.y+notice.height<=900,'Rejected-edit notice must be visible next to the controls');
    report.rejectionNoticeVisible=true;
    assert.deepEqual(await read(),fixture);assert.equal(await page.locator('[data-rule="seed"]').inputValue(),'41827');
    await page.screenshot({path:fileURLToPath(new URL('after-rejected-seed.png',out))});
    report.invalidSeedPreservesSavedDraft=true;
    await page.locator('[data-rule="wins"]').selectOption('7');const seven=await read();assert.equal(seven.match.wins,7);
    await page.locator('[data-do="undo"]').click();assert.deepEqual(await read(),fixture);
    await change('[data-rule="seed"]','4294967296');assert.deepEqual(await read(),fixture);
    assert.equal(await page.locator('[data-do="redo"]').isEnabled(),true);
    await page.locator('[data-do="redo"]').click();assert.deepEqual(await read(),seven);
    await page.locator('[data-do="undo"]').click();
    report.rejectedEditRetainsUndoRedo=true;
    await page.locator('[data-tab="crew"]').click();
    await page.locator('[data-seat="1"][data-field="control"]').selectOption('keyboard1');
    assert.match(await page.locator('.ads-status').innerText(),/Inputs must be unique/);assert.deepEqual(await read(),fixture);
    assert.equal(await page.locator('[data-seat="1"][data-field="control"]').inputValue(),'bot');
    report.conflictingInputRejected=true;
    const malformed=structuredClone(fixture);malformed.match.enabledUpgrades=['guard','guard'];
    await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(malformed));await page.locator('[data-do="import"]').click();
    assert.match(await page.locator('.ads-status').innerText(),/Invalid power-up pool/);assert.deepEqual(await read(),fixture);
    report.invalidImportPreservesSavedDraft=true;
    // Removing a linked shutter used to save a broken level through a separate deletion path.
    const linked=structuredClone(fixture);
    linked.arena.hazards.push({id:'atomic-shutter',x:5,y:0,w:.5,h:2,kind:'shutter',period:300,active:90,offset:0,angle:0});
    linked.arena.switches=[{id:'atomic-plate',x:-5,y:0,w:1,h:1,target:'atomic-shutter',duration:120}];
    await importDraft(linked);await page.locator('[data-tab="maps"]').click();await page.locator('[data-object="atomic-shutter"]').press('Enter');await page.locator('[data-do="delete"]').click();
    assert.match(await page.locator('.ads-status').innerText(),/Switch must target/);assert.deepEqual(await read(),linked);
    assert.equal(await page.locator('[data-do="delete"]').count(),1);report.linkedDeletionRejected=true;
    await page.locator('[data-do="undo"]').click();assert.deepEqual(await read(),fixture);
    await page.locator('[data-object="moss-0"]').press('Enter');
    await change('[data-object-field="w"]','-1');
    assert.match(await page.locator('.ads-status').innerText(),/Change rejected/);assert.deepEqual(await read(),fixture);
    report.invalidGeometryPreservesDraft=true;
    const shape=await page.locator('[data-object="moss-0"] rect').boundingBox();assert.ok(shape);
    await page.mouse.move(shape.x+shape.width/2,shape.y+shape.height/2);await page.mouse.down();
    await page.mouse.move(shape.x+shape.width/2+24,shape.y+shape.height/2,{steps:8});await page.mouse.up();
    const moved=await read();parseDraft(moved);assert.notEqual(moved.arena.obstacles[0].x,fixture.arena.obstacles[0].x);
    await page.locator('[data-do="undo"]').click();assert.deepEqual(await read(),fixture);
    await page.locator('[data-do="redo"]').click();assert.deepEqual(await read(),moved);
    await page.locator('[data-do="undo"]').click();assert.deepEqual(await read(),fixture);
    report.pointerDragIsOneValidatedHistoryStep=true;
    await page.locator('[data-tab="crew"]').click();await page.locator('[data-seat="0"][data-field="control"]').selectOption('bot');
    await page.locator('[data-seat="0"][data-field="bot"]').selectOption('easy');
    const accepted=await read();assert.equal(accepted.seats[0].bot,'easy');parseDraft(accepted);
    await page.reload();await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();assert.deepEqual(await read(),accepted);
    assert.equal(await page.locator('#ads-label').inputValue(),fixture.label);report.reloadKeepsAcceptedDraft=true;
    await page.locator('[data-tab="exchange"]').click();
    const downloaded=page.waitForEvent('download');await page.locator('[data-do="export"]').click();const download=await downloaded;
    assert.deepEqual(JSON.parse(await fs.readFile(await download.path(),'utf8')),accepted);
    await fs.writeFile(new URL('accepted-draft.json',out),JSON.stringify(accepted,null,2)+'\n');
    report.exportExact=true;
    // startLocal projects browser-only input ownership out of simulation seats.
    const expected=createMatch({...accepted.match,arenaDraft:accepted.arena},accepted.seats.map(({control,...seat})=>seat));
    while(expected.phase!=='matchResults'&&expected.tick<36000)step(expected,getBotInputs(expected));
    assert.equal(expected.phase,'matchResults');
    report.expected={tick:expected.tick,round:expected.round,hash:stateHash(expected),scores:expected.players.map(p=>p.score),winners:expected.matchWinnerIds};
    await page.locator('[data-do="play"]').click();await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:30000});
    const actualInitial=await page.evaluate(()=>structuredClone(window.__BOOMERANGAVOID__.state));
    assert.deepEqual(actualInitial.config,{...accepted.match,arenaDraft:accepted.arena});
    assert.deepEqual(actualInitial.players.map(({id,bot})=>({id,bot})),accepted.seats.map(({id,bot})=>({id,bot})));
    await page.screenshot({path:fileURLToPath(new URL('accepted-playtest.png',out))});
    await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='matchResults',null,{timeout:180000,polling:100});
    const actual=await page.evaluate(()=>structuredClone(window.__BOOMERANGAVOID__.state));
    report.actual={tick:actual.tick,round:actual.round,hash:stateHash(actual),scores:actual.players.map(p=>p.score),winners:actual.matchWinnerIds};
    assert.deepEqual(report.actual,report.expected);assert.equal(Math.max(...report.actual.scores),3);
    await page.screenshot({path:fileURLToPath(new URL('accepted-result.png',out))});
    report.naturalMatchMatchesSeededSimulation=true;
  }
  assert.deepEqual(report.pageErrors,[]);report.passed=true;
}catch(e){failure=e;report.failure=e.stack||String(e);}
finally{
  if(browser)await browser.close();report.browserClosed=true;
  if(vite&&vite.exitCode===null){vite.kill();await Promise.race([new Promise(r=>vite.once('exit',r)),pause(3000)]);}
  report.viteStopped=!vite||vite.exitCode!==null||vite.signalCode!==null;
  await fs.writeFile(new URL(baseline?'before.json':'after.json',out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
if(failure)throw failure;
