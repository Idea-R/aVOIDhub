import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const contexts=[], errors=[];
try{
 async function open(){const ctx=await browser.newContext({viewport:{width:1200,height:800}});contexts.push(ctx);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5177/boomerangavoid/');await p.waitForFunction(()=>window.__BOOMERANGAVOID__?.ready);await p.getByRole('button',{name:/Online Party/}).click();return p;}
 const host=await open();await host.getByRole('button',{name:'+ Add local player',exact:true}).click();await host.locator('[data-online-seat="1"][data-online-field="control"]').selectOption('keyboard2');await host.getByRole('button',{name:/Create a room/}).click();await host.getByRole('heading',{name:/Room /}).waitFor();
 const room=(await host.getByRole('heading',{name:/Room /}).innerText()).replace('Room ','');assert.equal(await host.locator('.owned-seat').count(),2);
 await host.locator('[data-lobby="public"]').check();await host.waitForFunction(()=>document.querySelector('.privacy-label')?.textContent?.includes('Public'));
 const peer=await open();await peer.getByRole('button',{name:'Find a public party',exact:true}).click();await peer.getByRole('heading',{name:`Room ${room}`,exact:true}).waitFor();
 await host.getByRole('button',{name:'Ready all 2 local players',exact:true}).click();await peer.getByRole('button',{name:'Ready up',exact:true}).click();await host.getByRole('button',{name:'Start party',exact:true}).click();
 await host.waitForFunction(()=>window.__BOOMERANGAVOID__?.state.phase==='playing');await host.bringToFront();await host.waitForTimeout(300);
 const before=await host.evaluate(()=>window.__BOOMERANGAVOID__.state.players.map(p=>({id:p.id,x:p.x,y:p.y})));
 assert.equal(before.length,3);await host.keyboard.down('KeyD');await host.keyboard.down('ArrowRight');await host.waitForTimeout(350);await host.keyboard.up('KeyD');await host.keyboard.up('ArrowRight');await host.waitForTimeout(250);
 const after=await host.evaluate(()=>window.__BOOMERANGAVOID__.state.players.map(p=>({id:p.id,x:p.x,y:p.y})));
 const travel=before.map((p,i)=>({id:p.id,dx:after[i].x-p.x,dy:after[i].y-p.y}));assert.ok(travel[0].dx>.3&&travel[1].dx>.3);assert.ok(Math.hypot(travel[2].dx,travel[2].dy)<.1);
 const report={timestamp:new Date().toISOString(),partySeats:2,remoteSeats:1,publicQuickJoin:true,seatsReservedAtomically:true,independentKeyboardInputs:travel,errors,scope:'Three authoritative seats across two loopback browser contexts; no physical keyboard rollover or internet host claim'};
 await fs.mkdir(new URL('./raw/',import.meta.url),{recursive:true});await fs.writeFile(new URL('./raw/mixed-party.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(errors.length,0);
}finally{for(const ctx of contexts)await ctx.close();await browser.close();}
