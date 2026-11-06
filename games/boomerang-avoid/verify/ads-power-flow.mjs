/** Actual ADS inputs and two natural matches. Human seats stay neutral; no gameplay writes. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {UPGRADES,RULES,stateHash} from '@avoid/boomerangavoid-sim';
import {parseDraft} from '../src/studio-contract.ts';
import {powerDraft,replayPowerDraft} from './ads-power-fixtures.ts';

const baseline=process.argv.includes('--baseline');
const out=new URL('../../../docs/boomerangavoid/evidence/ads-powers/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const report={baseline,passed:false,timestamp:new Date().toISOString(),pageErrors:[],matches:[],scope:'Actual Chrome ADS changes, six seats (one neutral keyboard human and five bots), selected powers, first-to-five natural match and complete UI rematch. Passive state observation only; no gameplay mutation/clock acceleration. No physical-controller, hardware-performance or internet claim.'};
let vite,browser,failure;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const root=fileURLToPath(new URL('../../../',import.meta.url)),storage='boomerangavoid.ads.draft.v1';
try {
  const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata)$/i.test(k)));
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','games/boomerang-avoid','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [vite.stdout,vite.stderr])stream.on('data',b=>output=(output+b).slice(-3000));
  const endpoint=`http://127.0.0.1:${port}/boomerangavoid/?studio=1`;
  for(let i=0;i<150;i++){if(vite.exitCode!==null)throw Error(output);if(await fetch(endpoint).then(r=>r.ok).catch(()=>false))break;if(i===149)throw Error('Owned Vite startup timeout');await pause(100);}
  report.vite={pid:vite.pid,bind:'127.0.0.1',port};
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(endpoint);await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storage);
  const live=()=>page.evaluate(()=>window.__BOOMERANGAVOID__);
  const importDraft=async d=>{await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(d));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);await page.locator('[data-tab="rules"]').click();};
  const legacy=powerDraft('legacy',4,3);await importDraft(legacy);
  const checked=await page.locator('[data-power]:checked').count();
  const off=powerDraft('off',6,3);
  off.seats[5].bot='easy';
  if(baseline) {
    assert.equal(checked,0);report.omittedPoolShownEmpty=true;
    const actual=replayPowerDraft(legacy);assert.ok(actual.first.drops.length>0);report.omittedPoolActuallySpawns=[...new Set(actual.first.drops.map(d=>d.upgrade))];
    await page.screenshot({path:fileURLToPath(new URL('before-omitted-pool.png',out))});
    await importDraft(off);assert.equal(await page.locator('[data-rule="upgrades"]').count(),0);assert.equal((await read()).match.upgrades,false);
    report.disabledDropsHaveNoStudioEnableControl=true;
  }else{
    assert.equal(checked,UPGRADES.length);assert.equal(await page.locator('[data-rule="upgrades"]').isChecked(),true);
    assert.equal((await read()).match.enabledUpgrades,undefined);report.omittedPoolMatchesAllDefault=true;
    await importDraft(off);
    assert.equal(await page.locator('[data-rule="upgrades"]').isChecked(),false);
    assert.equal(await page.locator('[data-power="tailwind"]').isChecked(),true);
    assert.equal(await page.locator('[data-power="tailwind"]').isDisabled(),true);
    assert.match(await page.locator('#ads-power-status').innerText(),/off/i);
    await page.locator('[data-rule="upgrades"]').check();
    assert.equal(await page.locator('[data-power="tailwind"]').isEnabled(),true);
    assert.deepEqual((await read()).match.enabledUpgrades,['tailwind']);
    await page.locator('[data-rule="wins"]').selectOption('5');
    await page.locator('#ads-label').fill('Tailwind party proving yard');await page.locator('#ads-label').press('Tab');
    await page.locator('[data-tab="crew"]').click();
    assert.equal(await page.locator('.ads-seat').count(),6);
    await page.locator('[data-seat="5"][data-field="bot"]').selectOption('normal');
    const accepted=parseDraft(await read());assert.equal(accepted.match.upgrades,true);
    await page.locator('[data-tab="rules"]').click();await page.screenshot({path:fileURLToPath(new URL('enabled-tailwind-rules.png',out))});
    await page.locator('[data-tab="exchange"]').click();const downloadReady=page.waitForEvent('download');await page.locator('[data-do="export"]').click();const download=await downloadReady;
    assert.deepEqual(JSON.parse(await fs.readFile(await download.path(),'utf8')),accepted);
    await fs.writeFile(new URL('accepted-draft.json',out),JSON.stringify(accepted,null,2)+'\n');
    const expected=replayPowerDraft(accepted);assert.deepEqual(expected.first,expected.rematch);
    assert.ok(expected.first.tick<9000,'Choose a declared natural fixture within the browser wall-clock budget before starting play');
    report.expected=expected;report.actualUiSelection={seats:6,humans:accepted.seats.filter(s=>!s.bot).length,bots:accepted.seats.filter(s=>s.bot).length,wins:accepted.match.wins,pool:accepted.match.enabledUpgrades};
    console.log(JSON.stringify({phase:'accepted configuration',expectedTicks:expected.first.tick,drops:expected.first.drops.length,firstDecisions:expected.first.firstDecision}));
    await page.reload();await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();assert.deepEqual(await read(),accepted);report.exportReloadExact=true;
    await page.locator('[data-do="play"]').click();
    for(let run=0;run<2;run++){
      await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:30000});
      const initial=await live();assert.equal(initial.online,false);assert.equal(initial.state.round,1);assert.deepEqual(initial.state.config,{...accepted.match,arenaDraft:accepted.arena});
      assert.deepEqual(initial.state.players.map(({id,name,character,color,team,bot})=>({id,name,character,color,team,bot})),expected.first.seats);
      assert.deepEqual(initial.controls,accepted.seats.map(({id,control})=>({id,control})));assert.ok(initial.state.players.every(p=>p.score===0));
      const seen=new Set(),started=Date.now();let terminal;
      while(Date.now()-started<180000){
        const now=await live();assert.equal(now.online,false);assert.equal(now.paused,false);
        now.state.pickups.forEach(p=>seen.add(p.upgrade));now.state.players.forEach(p=>p.upgrades.forEach(u=>seen.add(u)));
        if(now.state.phase==='matchResults'){terminal=now.state;break;}await pause(100);
      }
      assert.ok(terminal,'Natural match must finish within the wall-clock bound');
      const actual={tick:terminal.tick,round:terminal.round,hash:stateHash(terminal),scores:terminal.players.map(p=>p.score),winners:terminal.matchWinnerIds};
      for(const key of Object.keys(actual))assert.deepEqual(actual[key],expected.first[key],`${run?'rematch':'match'} ${key}`);
      assert.deepEqual([...seen],['tailwind']);
      report.matches.push({...actual,seenPowerTypes:[...seen],wallClockMs:Date.now()-started});
      console.log(JSON.stringify({phase:run?'rematch complete':'match complete',...actual}));
      await page.screenshot({path:fileURLToPath(new URL(run?'rematch-result.png':'match-result.png',out))});
      if(run===0){await page.locator('.results-panel [data-action="rematch"]').click();report.realUiRematch=true;}
    }
    // Separate short actual-engine checks distinguish a saved disabled pool from an explicitly empty pool.
    await page.locator('[data-action="exit-match"]').click();
    for(const kind of ['off','empty']){
      await page.locator('[data-action="studio"]').click();await page.getByRole('heading',{name:'Garden workshop',exact:true}).waitFor();
      const d=powerDraft(kind,4,3);await importDraft(d);
      assert.match(await page.locator('#ads-power-status').innerText(),kind==='off'?/off/i:/No power-ups selected/);
      await page.locator('[data-do="play"]').click();await page.waitForFunction(t=>{const s=window.__BOOMERANGAVOID__?.state;return s?.phase==='playing'&&s.tick-s.roundStart>=t;},RULES.pickupOffset+2,{timeout:30000});
      const s=(await live()).state;assert.deepEqual(s.config,{...d.match,arenaDraft:d.arena});assert.deepEqual(s.pickups,[]);
      assert.ok(s.players.every(p=>!p.shield&&p.upgrades.length===0));
      report[kind+'ActualSpawnOpportunity']={tick:s.tick,round:s.round,pickups:s.pickups.length};
      await page.locator('.pause-button').click();await page.locator('[data-action="exit-match"]').click();
    }
  }
  assert.deepEqual(report.pageErrors,[]);report.passed=true;
}catch(e){failure=e;report.failure=e.stack||String(e);}
finally{
  if(browser)await browser.close();report.browserClosed=true;
  if(vite&&vite.exitCode===null){vite.kill();await Promise.race([new Promise(r=>vite.once('exit',r)),pause(3000)]);}
  report.viteStopped=!vite||vite.exitCode!==null||vite.signalCode!==null;
  await fs.writeFile(new URL(baseline?'before.json':'after.json',out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({baseline,passed:report.passed,matches:report.matches,failure:report.failure,pageErrors:report.pageErrors}));
}
if(failure)throw failure;
