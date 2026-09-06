/** Responsive acceptance: the live game, not a static mock-up. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/map-first');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
const errors = [], failures = [], results = [];
page.on('pageerror', e => errors.push(e.message));
const assert = (ok, message) => { if (!ok) failures.push(message); };
await page.addInitScript(() => { window.__RAIL_SKIP_OPENING = true; });
try {
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  async function opening() {
    await page.evaluate(() => {
      const R = window.__RAIL;
      R.ctx.settings.setMeta({ introSeen: true });
      R.ctx.settings.set({ showTutorial: false, reducedMotion: true, compactHud: false, largeText: false, uiScale: .75 });
      R.newRun(12345); R.pause();
    });
    await page.locator('.rv-junction-opt').first().waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    // The first desktop train-deck measurement resizes the sketch. Wait for its
    // ResizeObserver projection, not an arbitrary 350 ms on a software renderer.
    await page.waitForFunction(() => {
      const map=document.querySelector('.rv-junction-map');
      const svg=map?.querySelector('svg');
      return !!svg && Math.abs(svg.viewBox.baseVal.width-map.clientWidth)<1 && Math.abs(svg.viewBox.baseVal.height-map.clientHeight)<1;
    }, null, {timeout:10000});
  }
  for (const [width, height] of [[1920,1080], [1455,943], [1280,720], [1024,768], [800,600], [390,844]]) {
    await page.setViewportSize({ width, height });
    await opening();
    const layout = await page.evaluate(() => {
      const rect = sel => {
        const n = document.querySelector(sel), r = n.getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom, overflow:n.scrollWidth-n.clientWidth };
      };
      const root = document.querySelector('#ui');
      const top = rect('.rv-hud-top'), dock = rect('.rv-dock');
      const mapFirst = root.classList.contains('rv-map-first');
      return { width:innerWidth, height:innerHeight, mapFirst, top, dock,
        freeFraction: Math.max(0, dock.y-top.bottom)*(innerWidth-parseFloat(getComputedStyle(root).getPropertyValue('--rv-left-w')))/(innerWidth*innerHeight),
        menu:rect('.rv-command-actions > .rv-btn:last-child'),
        trainHidden:getComputedStyle(document.querySelector('.rv-cars')).display === 'none',
        choices:[...document.querySelectorAll('.rv-junction-opt')].map(n=>{ const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:n.scrollWidth-n.clientWidth}; }),
        endpoints:[...document.querySelectorAll('.rv-jm-endpoint')].map(n=>{ const r=n.getBoundingClientRect(),m=n.parentElement.getBoundingClientRect();return {contained:r.x>=m.x&&r.right<=m.right&&r.y>=m.y&&r.bottom<=m.bottom}; }),
        labels:[...document.querySelectorAll('.rv-chips .rv-chip-k')].map(n=>({display:getComputedStyle(n).display,font:parseFloat(getComputedStyle(n).fontSize)})),
      };
    });
    results.push(layout);
    assert(layout.top.overflow<=1, `${width}: HUD overflows by ${layout.top.overflow}`);
    assert(layout.menu.right<=width+1 && layout.menu.x>=0, `${width}: Menu leaves viewport`);
    assert(layout.endpoints.every(e=>e.contained), `${width}: diagram endpoints clipped`);
    assert(layout.labels.every(l=>l.display!=='none'&&l.font>=9), `${width}: resource labels hidden or too small`);
    assert(layout.choices.every(c=>c.x>=0&&c.right<=width), `${width}: choice node leaves viewport`);
    if (layout.mapFirst) {
      assert(layout.trainHidden, `${width}: train deck expanded by default`);
      if (width>=1000) assert(layout.freeFraction>=.5, `${width}: less than half the screen is clear map (${layout.freeFraction})`);
      await page.locator('.rv-route-toggle').hover();
      await page.waitForTimeout(500);
      assert(!await page.locator('.rv-route-details').isVisible(), `${width}: route expanded on hover`);
      await page.locator('.rv-route-toggle').focus();
      await page.keyboard.press('Enter');
      assert(await page.locator('.rv-route-details').isVisible(), `${width}: route click did not open tools`);
      await page.keyboard.press('Tab');
      assert(await page.evaluate(()=>document.activeElement!==document.querySelector('.rv-route-toggle')&&!document.querySelector('#ui').classList.contains('rv-inspector-open')), `${width}: Tab did not navigate controls`);
      await page.keyboard.press('Escape');
      assert(!await page.locator('.rv-route-details').isVisible(), `${width}: Escape did not close Route`);
      await page.locator('.rv-train-toggle').click();
      assert(await page.locator('.rv-cars').isVisible(), `${width}: Manage train did not expose cards`);
      await page.keyboard.press('Escape');
      assert(!await page.locator('.rv-cars').isVisible(), `${width}: Escape did not close train`);
    }
    await page.mouse.move(width-4, height/2);
    await page.screenshot({ path:path.join(out, `junction-${width}x${height}.png`) });
  }
  // The dial itself selects exactly the same map tile as its numbered route card.
  await page.setViewportSize({ width:1280, height:720 }); await opening();
  const selected = await page.locator('.rv-junction-opt').last().evaluate(n=>({ col:+n.dataset.col, row:+n.dataset.row }));
  await page.locator('.rv-jm-endpoint').last().click();
  await page.waitForFunction(({col,row})=>{const R=window.__RAIL,p=R.state.route.path.at(-1);return p[0]===col&&p[1]===row&&R.state.phase==='running'&&!R.state.train.stopped;},selected);
  await page.screenshot({ path:path.join(out, 'journey-1280x720.png') });
  await opening();
  await page.keyboard.press('2');
  await page.waitForFunction(()=>window.__RAIL.state.phase==='running'&&!window.__RAIL.state.train.stopped);
  // Actual event modal must own the space; no dead deck behind the choices.
  await page.evaluate(()=>window.__RAIL.triggerEvent('node_shrine'));
  await page.waitForTimeout(400);
  assert(!await page.locator('.rv-dock').isVisible(), 'event leaves inactive train deck visible');
  await page.screenshot({ path:path.join(out, 'event-1280x720.png') });
  // Resize and accessibility settings work on the existing page without a reload.
  for (const uiScale of [.75, 1, 1.1]) {
    await page.setViewportSize({width:1024,height:768}); await opening();
    await page.evaluate(uiScale=>window.__RAIL.ctx.settings.set({uiScale,largeText:true}),uiScale);
    await page.waitForTimeout(250);
    const bounds=await page.locator('.rv-hud-top').evaluate(n=>({overflow:n.scrollWidth-n.clientWidth}));
    assert(bounds.overflow<=1, `1024 large text / scale ${uiScale}: HUD overflow ${bounds.overflow}`);
  }
  for (const [width,height] of [[800,600],[390,844]]) {
    await page.setViewportSize({width,height}); await opening();
    await page.locator('.rv-train-toggle').click();
    await page.locator('.rv-car-type-gatling').click();
    await page.waitForTimeout(300);
    assert(await page.locator('.rv-inspector').isVisible(), `${width}: inspector not reachable`);
    assert(!await page.locator('.rv-cars').isVisible(), `${width}: inspector leaves deck expanded`);
    const panel = await page.locator('.rv-inspector').evaluate(n=>({right:n.getBoundingClientRect().right,bottom:n.getBoundingClientRect().bottom,overflow:n.scrollWidth-n.clientWidth}));
    assert(panel.right<=width&&panel.bottom<=height&&panel.overflow<=1, `${width}: inspector overflow ${JSON.stringify(panel)}`);
    await page.screenshot({path:path.join(out,`inspector-${width}x${height}.png`)});
    await page.getByRole('button',{name:'Close inspector',exact:true}).click();
    await page.evaluate(()=>{
      const R=window.__RAIL;
      R.resume();
      R.state.train.crew.push({id:'qa-gunner',name:'Nils',specialty:'gunner',hp:100,carIndex:-1},{id:'qa-medic',name:'Ines',specialty:'medic',hp:100,carIndex:-1});
      R.sim.startExpedition(R.state.train.crew.map(c=>c.id));
    });
    await page.locator('.rv-exp-menu').waitFor({state:'visible'});
    await page.waitForTimeout(350);
    const battle=await page.locator('.rv-exp').evaluate(n=>({overflow:n.scrollWidth-n.clientWidth,actions:[...n.querySelectorAll('.rv-exp-action')].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})}));
    assert(battle.overflow<=1, `${width}: combat horizontal overflow ${battle.overflow}`);
    assert(battle.actions.every(a=>a.left>=0&&a.right<=width&&a.top>=0&&a.bottom<=height), `${width}: combat action clipped`);
    await page.locator('.rv-exp-log-toggle').click();
    assert(await page.locator('.rv-exp-log').isVisible(),`${width}: battle log not accessible`);
    await page.locator('.rv-exp-log-toggle').click();
    await page.screenshot({path:path.join(out,`expedition-${width}x${height}.png`)});
  }
  await page.evaluate(()=>window.__RAIL.quitToTitle()); await page.waitForTimeout(300);
  assert(!await page.locator('.rv-dock').isVisible(), 'title leaks run panels');
  assert(errors.length===0, `browser errors: ${errors.join('; ')}`);
} catch (error) {
  const state = await page.evaluate(() => {
    const map=document.querySelector('.rv-junction-map'), svg=map?.querySelector('svg'), root=document.querySelector('#ui');
    return {size:[innerWidth,innerHeight],classes:root?.className,style:root?.style.cssText,settings:window.__RAIL?.ctx.settings.get(),phase:window.__RAIL?.state.phase,map:map?{width:map.clientWidth,height:map.clientHeight}:null,viewBox:svg?.getAttribute('viewBox')};
  });
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:String(error),state,results,failures,errors},null,2));
  await page.screenshot({path:path.join(out,'failure.png')});
  throw error;
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({results,failures,errors},null,2));
console.log(JSON.stringify({results,failures,errors},null,2));
if(failures.length)process.exitCode=1;
else console.log('PASS responsive map-first defaults, drawers, junction input, event isolation and resize');
