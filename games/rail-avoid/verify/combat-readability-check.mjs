/** Mixed enemy fixture; authored stats and ordinary crew, not a campaign-balance claim. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const baseline = process.argv.includes('--baseline');
const base = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5178/RAILaVOID/';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? `verify/screenshots/combat-readability/${baseline ? 'before' : 'after'}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
const errors = [], results = [], failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { window.__RAIL_SKIP_OPENING = true; });
async function fresh(width = 1280, height = 720, scale = .75, reduced = true) {
  await page.setViewportSize({ width, height });
  await page.evaluate(({ scale, reduced }) => {
    const R = window.__RAIL;
    R.ctx.settings.setMeta({ introSeen: true });
    R.ctx.settings.set({ showTutorial: false, reducedMotion: reduced, uiScale: scale, largeText: scale === 1.1, quality: 'high' });
    R.newRun(12345);
    R.state.region = 3; // authored Fusilier + Hound opening; same fixture before/after
    R.state.train.crew.push(
      { id: 'qa-gunner', name: 'Nils', specialty: 'gunner', hp: 100, carIndex: -1 },
      { id: 'qa-medic', name: 'Ines', specialty: 'medic', hp: 100, carIndex: -1 },
    );
    R.sim.startExpedition(R.state.train.crew.map(c => c.id));
  }, { scale, reduced });
  await page.locator('.rv-exp-menu').waitFor({ state: 'visible' });
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.rv-exp img')].map(i => i.decode())); });
  if (!reduced) await page.waitForTimeout(1000);
}
async function state() { return page.evaluate(() => JSON.stringify(JSON.parse(window.__RAIL.sim.serialize()).state)); }
async function checkBounds(label, selectors) {
  const bounds = await page.locator(selectors).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => {
    const r = n.getBoundingClientRect();
    return { class: n.className, x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight, overflow: n.scrollWidth - n.clientWidth };
  }));
  for (const b of bounds) {
    check(b.x >= -1 && b.y >= -1 && b.x + b.width <= b.vw + 1 && b.y + b.height <= b.vh + 1, `${label}: ${b.class} outside viewport`);
    check(b.overflow <= 1, `${label}: ${b.class} horizontal overflow ${b.overflow}`);
  }
  results.push({ label, bounds });
}
async function openSwap() {
  await page.keyboard.press('w');
  await page.locator('.rv-exp-swap-overlay').waitFor({ state: 'visible' });
}
async function menuReady(actor = 0) {
  await page.waitForFunction(i => window.__RAIL.state.expedition.activeActor === i && !window.__RAIL.state.expedition.pending, actor);
  await page.locator('.rv-exp-menu').waitFor({ state: 'visible' });
}
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  const sizes = baseline ? [[1280,720,.75],[800,600,.75],[390,844,.75]]
    : [[1920,1080,.75],[1366,768,.75],[1280,720,.75],[800,600,.75],[390,844,.75],[360,740,.75],[844,450,.75],[1280,720,1],[1280,720,1.1],[800,600,1.1],[390,844,1.1]];
  for (const [width, height, scale] of sizes) {
    await fresh(width, height, scale);
    const label = `${width}x${height}-${scale}`;
    await page.screenshot({ path: `${out}/battle-${label}.png` });
    if (baseline) continue;
    await checkBounds(`battle-${label}`, '.rv-exp-intent,.rv-exp-intent-target,.rv-exp-card,.rv-exp-menu,.rv-exp-action,.rv-exp-order-step');
    check(await page.locator('.rv-exp-order-step').count() === 5, `${label}: round order incomplete`);
    check(await page.locator('.rv-exp-intent').allTextContents().then(t => t.join('|') === '1 × 10 damage|2 × 6 damage'), `${label}: authored enemy intents incorrect`);
    const positions = await page.locator('.rv-exp-actor').evaluateAll(ns => ns.map(n => ({ x: n.getBoundingClientRect().x, pos: n.querySelector('.rv-exp-lane').textContent })));
    check(positions.find(p => p.pos === 'front').x > positions.find(p => p.pos === 'rear').x, `${label}: front farther from foes than rear`);
    const before = await state();
    await openSwap();
    await checkBounds(`swap-${label}`, '.rv-exp-swap-card,.rv-exp-swap-options,.rv-exp-swap-footer');
    check(await page.locator('.rv-exp-swap-choice').count() === 2, `${label}: missing explicit partners`);
    check((await page.locator('.rv-exp-swap-choice').nth(1).textContent()).includes('13% → 63%'), `${label}: missing ranged risk preview`);
    await page.screenshot({ path: `${out}/swap-${label}.png` });
    // Partners can scroll in short viewports; confirmation text and cancel remain reachable.
    for (const choice of await page.locator('.rv-exp-swap-choice').all()) {
      await choice.scrollIntoViewIfNeeded();
      check(await choice.evaluate(b => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + 10)); }), `${label}: swap partner cannot be reached`);
    }
    await page.keyboard.press('Escape');
    await menuReady();
    check(await state() === before, `${label}: preview/cancel spent a turn or RNG`);
    check(await page.locator('.rv-exp-a-swap').evaluate(n => n === document.activeElement), `${label}: cancel lost focus`);
  }
  if (!baseline) {
    // Explicit non-adjacent partner via real number key; swaps positions, not turn order.
    await fresh(); await openSwap(); await page.keyboard.press('2'); await menuReady(1);
    check(await page.evaluate(() => window.__RAIL.state.expedition.actors.map(a => a.position).join() === 'rear,middle,front'), 'number key did not choose Ines');
    // Mouse with ordinary motion enabled; no second action on confirmation.
    await fresh(1280,720,.75,false);
    await page.locator('.rv-exp-a-swap').click();
    await page.locator('.rv-exp-swap-choice[data-partner="1"]').click(); await menuReady(1);
    check(await page.evaluate(() => window.__RAIL.state.expedition.actors.map(a => a.position).join() === 'middle,front,rear'), 'mouse swap wrong partner');
    // Held W does not cancel, and native cancel/Tab focus do not leak into gameplay.
    await fresh(); await page.keyboard.down('w'); await page.keyboard.down('w'); await page.keyboard.up('w');
    check(await page.locator('.rv-exp-swap-overlay').isVisible(), 'held W toggled chooser');
    await page.keyboard.press('Shift+Tab');
    check(await page.locator('[data-cancel-swap]').evaluate(n => n === document.activeElement), 'swap focus trap did not wrap');
    await page.keyboard.press('Enter'); await menuReady();
    // Controller D-pad, B cancel, A confirm. Wait for actual gamepad polls on software rendering.
    await page.evaluate(() => {
      window.__qaPad = { index: 0, id: 'QA controller', connected: true, mapping: 'standard', axes: [0,0,0,0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      window.__qaPadPolls = 0;
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { window.__qaPadPolls++; return [window.__qaPad]; } });
    });
    async function pad(button) {
      const start = await page.evaluate(i => { window.__qaPad.buttons[i] = { pressed: true, touched: true, value: 1 }; return window.__qaPadPolls; }, button);
      await page.waitForFunction(n => window.__qaPadPolls > n, start);
      const end = await page.evaluate(i => { window.__qaPad.buttons[i] = { pressed: false, touched: false, value: 0 }; return window.__qaPadPolls; }, button);
      await page.waitForFunction(n => window.__qaPadPolls > n, end);
    }
    await pad(0); // Cancel returned focus to Swap.
    await page.locator('.rv-exp-swap-overlay').waitFor({ state: 'visible' });
    const beforePad = await state(); await pad(1); await menuReady();
    check(await state() === beforePad, 'controller B consumed a turn');
    await pad(0); await pad(13); await pad(0); await menuReady(1);
    check(await page.evaluate(() => window.__RAIL.state.expedition.actors[0].position === 'rear'), 'controller did not select second partner');
    await page.evaluate(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
    // Inspecting is not a saved committed action. Reload resumes the original turn.
    await fresh(); await openSwap();
    await page.evaluate(() => window.__RAIL.ctx.settings.writeSave(window.__RAIL.sim.serialize()));
    await page.reload(); await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
    await page.evaluate(() => { if (!window.__RAIL.ctx.continueRun()) throw Error('Continue failed'); });
    await menuReady();
    check(!await page.locator('.rv-exp-swap-overlay').isVisible(), 'UI-only preview restored as action');
    check(await page.evaluate(() => window.__RAIL.state.expedition.actors.map(a => a.position).join() === 'front,middle,rear'), 'reload preview changed formation');
    // Downed partners disappear; no arbitrary fallback when a partner becomes unavailable.
    await fresh(); await openSwap();
    await page.evaluate(() => { const x = window.__RAIL.state.expedition; x.actors[2].hp = 0; x.actors[2].down = true; });
    await page.waitForFunction(() => document.querySelectorAll('.rv-exp-swap-choice').length === 1);
    check(await page.locator('.rv-exp-swap-choice').getAttribute('data-partner') === '1', 'downed ally remained a target');
    await page.evaluate(() => { const x = window.__RAIL.state.expedition; x.actors[1].hp = 0; x.actors[1].down = true; });
    await menuReady();
    check(await page.locator('.rv-exp-a-swap').isDisabled(), 'solo survivor can open swap');
    results.push({ interactions: 'mouse; 1/2; held W; Tab; Escape; native Enter cancel; controller A/B/D-pad; reload; invalidated and downed partners', passed: true });
  }
} catch (error) {
  failures.push(error.stack ?? String(error));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  check(errors.length === 0, `Page errors: ${errors.join('; ')}`);
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors, failures }, null, 2));
  console.log(JSON.stringify({ baseline, samples: results.length, errors, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}
