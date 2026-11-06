import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=new URL('../../../docs/boomerangavoid/evidence/reliability/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{
   window.__pad={index:0,id:'Simulated standard accessibility pad',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__pad]});
   if(!sessionStorage.getItem('fixture-seeded')){localStorage.setItem('boomerangavoid-settings',JSON.stringify({quality:'broken',bindings:[{up:17,dash:null}],gamepadButtons:{dash:99},touch:'invalid'}));sessionStorage.setItem('fixture-seeded','yes');}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188/boomerangavoid/');await page.locator('[data-action="practice"]').waitFor();await page.waitForTimeout(400);
 const press=async index=>{await page.evaluate(i=>{window.__pad.buttons[i]={pressed:true,value:1};},index);await page.waitForTimeout(85);await page.evaluate(i=>{window.__pad.buttons[i]={pressed:false,value:0};},index);await page.waitForTimeout(240);};
 const navigate=async selector=>{const trail=[];for(let i=0;i<70;i++){if(await page.evaluate(s=>document.activeElement?.matches(s),selector))return;trail.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,action:document.activeElement?.getAttribute('data-action'),field:document.activeElement?.getAttribute('data-field'),seat:document.activeElement?.getAttribute('data-seat'),config:document.activeElement?.getAttribute('data-config')})));await press(13);}await fs.writeFile(new URL('controller-failure.json',out),JSON.stringify({selector,trail},null,2));await page.screenshot({path:fileURLToPath(new URL('controller-failure.png',out))});throw Error('Pad focus did not reach '+selector);};
 await navigate('[data-action="settings"]');await press(0);await page.locator('[data-pref="music"]').waitFor();
 await navigate('[data-pref="music"]');const volume=Number(await page.locator('[data-pref="music"]').inputValue());await press(15);assert.equal(Number(await page.locator('[data-pref="music"]').inputValue()),volume+1);
 await navigate('[data-pref="stickDeadzone"]');await press(15);await press(15);await press(15);assert.equal(await page.locator('[data-pref="stickDeadzone"]').inputValue(),'21');
 await navigate('[data-pref="invertAimY"]');await press(0);assert.equal(await page.locator('[data-pref="invertAimY"]').isChecked(),true);
 await navigate('[data-pad="slash"]');await press(15);assert.equal(await page.locator('[data-pad="slash"]').inputValue(),'3');
 await page.screenshot({path:fileURLToPath(new URL('controller-settings.png',out)),fullPage:true});
 await press(1);await page.locator('[data-action="party"]').waitFor();await navigate('[data-action="party"]');await press(0);
 await navigate('[data-config="mapId"]');await press(15);assert.equal(await page.locator('[data-config="mapId"]').inputValue(),'kiln-courtyard');assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-config="mapId"]')),true);
 await press(15);assert.equal(await page.locator('[data-config="mapId"]').inputValue(),'tideglass-steps');
 await navigate('[data-seat="0"][data-field="control"]');await press(15);await press(15);assert.equal(await page.locator('[data-seat="0"][data-field="control"]').inputValue(),'pad0');
 await navigate('[data-action="ready-0"]');await press(0);await navigate('[data-action="start"]');await press(0);
 await page.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing',null,{timeout:20000});
 const before=await page.evaluate(()=>{const p=window.__BOOMERANGAVOID__.state.players[0];return{x:p.x,y:p.y};});
 await page.evaluate(()=>window.__pad.axes=[.6,.23,0,.7]);await page.waitForTimeout(350);await page.evaluate(()=>window.__pad.axes=[0,0,0,0]);
 const after=await page.evaluate(()=>{const p=window.__BOOMERANGAVOID__.state.players[0];return{x:p.x,y:p.y};});assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>.1);
 assert.match(await page.locator('.bottom-hints').innerText(),/L \/ R stick/);assert.match(await page.locator('.bottom-hints').innerText(),/North/);
 await press(9);await page.locator('.pause-panel').waitFor();for(let i=0;i<7;i++){await press(13);assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.pause-panel')),true);}
 await press(1);await page.waitForFunction(()=>window.__BOOMERANGAVOID__.screen==='playing');
 await page.evaluate(()=>{window.__pad.connected=false;dispatchEvent(new GamepadEvent('gamepaddisconnected'));});await page.waitForTimeout(100);
 const disconnected=await page.evaluate(()=>{const p=window.__BOOMERANGAVOID__.state.players[0];return{x:p.x,y:p.y};});await page.waitForTimeout(200);
 const still=await page.evaluate(()=>{const p=window.__BOOMERANGAVOID__.state.players[0];return{x:p.x,y:p.y};});assert.ok(Math.hypot(still.x-disconnected.x,still.y-disconnected.y)<.05);
 await page.reload();await page.locator('[data-action="settings"]').click();assert.equal(await page.locator('[data-pref="stickDeadzone"]').inputValue(),'21');assert.equal(await page.locator('[data-pref="invertAimY"]').isChecked(),true);assert.equal(await page.locator('[data-pad="slash"]').inputValue(),'3');assert.equal(await page.locator('[data-pad="slash"] option[value="9"]').evaluate(option=>option.disabled),true);
 await page.locator('[data-action="bind-0-dash"]').click();await page.locator('[data-action="reset-bindings"]').click();await page.keyboard.press('KeyL');assert.equal(await page.locator('[data-action="bind-0-dash"]').innerText(),'Space');
 await page.setViewportSize({width:390,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.screenshot({path:fileURLToPath(new URL('controller-settings-mobile.png',out)),fullPage:true});
 const result={timestamp:new Date().toISOString(),browser:'Chrome headless',simulatedGamepad:true,physicalDevice:false,padOnlySetupAndStart:true,dropdownFocusRetained:true,sliderAdjusted:true,remapAppliedToHints:true,deadzoneAndInvertPersisted:true,modalFocusContained:true,disconnectStopsMovement:true,mobileViewport:{width:390,height:844,horizontalOverflow:overflow},errors};
 await fs.writeFile(new URL('controller-browser.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();}
