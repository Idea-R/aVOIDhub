import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=new URL('../../../docs/boomerangavoid/evidence/reliability/',import.meta.url);
const draft=JSON.parse(await fs.readFile(new URL('arena-courier.json',out),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188/boomerangavoid/?studio=1');await page.getByRole('heading',{name:'Garden workshop'}).waitFor();
 await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(draft));await page.locator('[data-do="import"]').click();assert.match(await page.locator('.ads-status').innerText(),/Imported and validated/);
 await page.locator('[data-do="audit"]').click();assert.match(await page.locator('.ads-status').innerText(),/Audit passed/);
 const downloadReady=page.waitForEvent('download');await page.locator('[data-do="export"]').click();const download=await downloadReady;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.deepEqual(exported,draft);
 await page.locator('[data-tab="exchange"]').click();await page.locator('#ads-json').fill(JSON.stringify(exported));await page.locator('[data-do="import"]').click();
 await page.screenshot({path:fileURLToPath(new URL('arena-studio.png',out))});
 await page.keyboard.press('Escape');await page.locator('[data-action="studio"]').waitFor();await page.locator('[data-action="studio"]').click();await page.getByRole('heading',{name:'Garden workshop'}).waitFor();
 await page.locator('[data-do="play"]').click();await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:30000});await page.waitForTimeout(1200);
 const live=await page.evaluate(()=>({config:window.__BOOMERANGAVOID__.state.config,seats:window.__BOOMERANGAVOID__.state.players.map(p=>({id:p.id,bot:p.bot})),metrics:window.__BOOMERANGAVOID__.metrics}));
 assert.deepEqual(live.config.arenaDraft,draft.arena);assert.deepEqual(live.config.stageIds,draft.match.stageIds);assert.equal(live.config.seed,draft.match.seed);assert.equal(live.seats.length,draft.seats.length);
 await page.screenshot({path:fileURLToPath(new URL('arena-playtest.png',out))});
 const result={timestamp:new Date().toISOString(),authoredBy:'Existing ADS example CLI, seed41827',browser:'Chrome headless',importAuditExportReimportExact:true,actualSimulationHandoffExact:true,arena:draft.arena.id,stages:live.config.stageIds,seatCount:live.seats.length,drawCalls:live.metrics.drawCalls,triangles:live.metrics.triangles,scope:'Actual UI import/download/reimport and local renderer/simulation handoff; finite headless audit separately covers first-round completion',errors};await fs.writeFile(new URL('arena-browser.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.deepEqual(errors,[]);
}finally{await browser.close();}
