/** Exercise the compiled local release through its public UI, without development hooks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const artifact=path.resolve(process.argv[2]||path.join(repo,'dist/BoomerangaVOID'));
const out=path.join(repo,'docs/boomerangavoid/evidence/hosting');
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
async function files(dir,prefix=''){
 const rows=[];
 for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const relative=prefix+entry.name,absolute=path.join(dir,entry.name);
  if(entry.isDirectory())rows.push(...await files(absolute,relative+'/'));
  else{assert.ok(entry.isFile());const bytes=await fs.readFile(absolute);rows.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}
 }
 return rows;
}
const artifactFiles=await files(artifact);
const report={timestamp:new Date().toISOString(),artifact,artifactFiles,artifactTreeSha256:sha(JSON.stringify(artifactFiles)),passed:false,cases:[],pageErrors:[],failedRequests:[],backendRequests:[],webSockets:[],externalRequests:[],modelResponses:[],scope:'Built local-release artifact, own loopback static server, installed headless Chrome, real keyboard/touch UI and real-time bot match. No development hooks, simulation mutation, clock acceleration, account, hosted authentication, internet multiplayer or physical controller claim.'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.glb':'model/gltf-binary','.json':'application/json','.txt':'text/plain','.md':'text/plain','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/boomerangavoid'){res.writeHead(301,{Location:'/boomerangavoid/'});res.end();return;}
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(!pathname.startsWith('/boomerangavoid/')){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(pathname.slice('/boomerangavoid/'.length))||'index.html';
  const target=path.resolve(artifact,relative);
  if(!target.startsWith(artifact+path.sep)){res.writeHead(403);res.end();return;}
  const data=await fs.readFile(target);
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/boomerangavoid/';
 report.server={bind:'127.0.0.1',port:server.address().port};
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});report.browser=browser.version();
 function observe(page){
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),failure:r.failure()}));
  page.on('websocket',s=>report.webSockets.push(s.url()));
  page.on('request',r=>{const u=new URL(r.url());if(/^https?:$/.test(u.protocol)&&u.origin!==origin)report.externalRequests.push(r.url());if(/^\/(?:api|auth|login)(?:\/|$)/.test(u.pathname))report.backendRequests.push(r.url());});
  page.on('response',r=>{if(r.url().endsWith('.glb'))report.modelResponses.push({url:r.url(),status:r.status()});});
 }
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});observe(page);
 await page.goto(url+'?room=unavailable-room&studio=1');
 await page.locator('[data-action="practice"]').waitFor();
 assert.equal(await page.locator('[data-action="online"]').count(),0);
 assert.equal(await page.locator('[data-action="studio"]').count(),0);
 assert.match(await page.locator('.play-choices').innerText(),/Online parties are not available in this release/);
 assert.equal(await page.evaluate(()=>('__BOOMERANGAVOID__' in window)),false);
 await page.screenshot({path:path.join(out,'static-menu.png')});
 report.cases.push({case:'invite-and-studio-query-stay-local',onlineAction:false,studioAction:false,developmentHook:false});
 await page.locator('[data-action="settings"]').click();
 await page.locator('[data-pref="quality"]').selectOption('low');
 await page.locator('[data-pref="reducedMotion"]').check();
 await page.locator('[data-pref="character"]').selectOption('cairn');
 assert.equal(await page.locator('#account-match-history').count(),0);
 await page.evaluate(()=>dispatchEvent(new Event('focus')));
 await page.waitForTimeout(600);
 assert.match(await page.locator('#account-preferences-status').innerText(),/Saved to this device/);
 await page.reload();await page.locator('[data-action="settings"]').click();
 assert.equal(await page.locator('[data-pref="quality"]').inputValue(),'low');
 assert.equal(await page.locator('[data-pref="reducedMotion"]').isChecked(),true);
 assert.equal(await page.locator('[data-pref="character"]').inputValue(),'cairn');
 report.cases.push({case:'device-preferences-survive-reload',quality:'low',reducedMotion:true,character:'cairn',accountHistory:false});
 await page.locator('[data-action="back"]').click();await page.locator('[data-action="practice"]').click();
 await page.locator('#tutorial h2').filter({hasText:'Find your feet'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#phase-overlay')?.getAttribute('data-state')?.startsWith('playing:'));
 await page.keyboard.down('KeyD');await page.waitForTimeout(1100);await page.keyboard.up('KeyD');
 await page.locator('#tutorial h2').filter({hasText:'Make a little escape'}).waitFor();
 await page.keyboard.press('Space');await page.locator('#tutorial h2').filter({hasText:'Leave a bright arc'}).waitFor();
 await page.keyboard.press('KeyJ');await page.locator('#tutorial h2').filter({hasText:'Let it fly'}).waitFor();
 await page.keyboard.press('KeyK');await page.locator('#tutorial h2').filter({hasText:'Bend the comeback'}).waitFor();
 await page.keyboard.down('KeyW');await page.waitForTimeout(200);await page.keyboard.up('KeyW');
 // A second outbound curve can be needed if the first blade returned before movement.
 if((await page.locator('#tutorial h2').innerText())==='Bend the comeback'){
  await page.waitForTimeout(1500);await page.keyboard.press('KeyK');await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');
 }
 await page.locator('#tutorial h2').filter({hasText:'Call it home'}).waitFor();
 await page.keyboard.press('KeyK');await page.locator('#tutorial h2').filter({hasText:'Now, a friendly duel'}).waitFor();
 await page.screenshot({path:path.join(out,'static-practice.png')});
 report.cases.push({case:'actual-keyboard-practice',actions:['move','dash','slash','throw','curve','recall'],lesson:'Now, a friendly duel'});
 await page.keyboard.press('Escape');await page.locator('[data-action="resume"]').click();
 await page.keyboard.press('Escape');await page.locator('[data-action="exit-match"]').click();
 await page.locator('[data-action="party"]').click();
 assert.equal(await page.locator('[data-config="mapId"] option').count(),8);
 await page.locator('[data-config="mode"]').selectOption('relay');
 assert.equal(await page.locator('[data-config="wins"]').isDisabled(),true);
 assert.match(await page.locator('[data-config="wins"]').innerText(),/3 deliveries/);
 await page.locator('[data-config="mode"]').selectOption('ffa');
 await page.locator('[data-config="wins"]').selectOption('3');
 await page.locator('[data-config="upgrades"]').selectOption('false');
 while(await page.locator('.seat-row').count()<6)await page.locator('[data-action="add-seat"]').click();
 for(let i=1;i<6;i++)await page.locator(`[data-seat="${i}"][data-field="control"]`).selectOption('bot');
 assert.equal(await page.locator('.seat-row').count(),6);
 await page.screenshot({path:path.join(out,'static-couch-setup.png')});
 await page.locator('[data-action="start"]').click();await page.locator('#scores .score-card').nth(5).waitFor();
 assert.match(await page.locator('.bottom-hints').innerText(),/Keyboard 1/);
 const matchStarted=performance.now();
 console.log('Static release: real-time six-seat first-to-three match started (one keyboard human, five bots).');
 await page.locator('.results-panel').waitFor({timeout:180000});
 const scores=await page.locator('#scores .score-card > b').allTextContents();
 assert.equal(Math.max(...scores.map(Number)),3);
 await page.screenshot({path:path.join(out,'static-couch-result.png')});
 report.cases.push({case:'complete-production-couch-match',seats:6,humans:1,bots:5,botDifficulty:'normal',mode:'ffa',wins:3,upgrades:false,arenaCount:8,wallMs:performance.now()-matchStarted,scores});
 await page.locator('.results-panel [data-action="rematch"]').click();
 await page.waitForFunction(()=>{const scores=[...document.querySelectorAll('#scores .score-card > b')];return scores.length===6&&scores.every(s=>s.textContent==='0');});
 assert.equal(await page.locator('.results-panel').count(),0);
 await page.keyboard.press('Escape');await page.locator('[data-action="exit-match"]').click();
 report.cases.push({case:'actual-rematch-resets-six-scores',scores:[0,0,0,0,0,0]});
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});observe(phone);
 await phone.goto(url);await phone.locator('[data-action="practice"]').tap();await phone.locator('#tutorial').waitFor();
 await phone.waitForFunction(()=>document.querySelector('#phase-overlay')?.getAttribute('data-state')?.startsWith('playing:'));
 assert.equal(await phone.locator('.touch-controls').isVisible(),true);
 await phone.locator('[data-touch="dash"]').tap();await phone.locator('[data-touch="slash"]').tap();await phone.locator('[data-touch="throw"]').tap();
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await phone.screenshot({path:path.join(out,'static-phone.png')});
 await phone.locator('[data-action="pause"]').tap();await phone.locator('[data-action="exit-match"]').tap();
 report.cases.push({case:'phone-touch-practice',viewport:'390x844',touchButtons:true,horizontalOverflow:false});
 assert.equal(new Set(report.modelResponses.filter(r=>r.status===200).map(r=>r.url.split('/').at(-1))).size,6);
 for(const key of ['pageErrors','failedRequests','backendRequests','webSockets','externalRequests'])assert.deepEqual(report[key],[],key);
 report.passed=true;
}catch(e){report.failure=e.stack||String(e);process.exitCode=1;}
finally{
 if(browser)await browser.close();report.browserClosed=true;
 await new Promise(r=>server.close(r));report.serverStopped=true;
 await fs.writeFile(path.join(out,'static-browser.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,artifactTreeSha256:report.artifactTreeSha256,cases:report.cases,backendRequests:report.backendRequests,webSockets:report.webSockets,pageErrors:report.pageErrors,failure:report.failure}));
}
