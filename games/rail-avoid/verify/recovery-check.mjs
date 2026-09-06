/** Isolated UI/command fixtures, not player-balance evidence. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5178/RAILaVOID/';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'verify/screenshots/recovery'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
const errors = [], failures = [], shots = [];
page.on('pageerror', e => errors.push(e.message));
const check = (ok, msg) => { if (!ok) failures.push(msg); };
await page.addInitScript(() => window.__RAIL_SKIP_OPENING = true);
async function fresh() {
  await page.evaluate(() => {
    const R = window.__RAIL;
    R.ctx.settings.setMeta({ introSeen: true }); R.ctx.settings.set({ reducedMotion: true, showTutorial: false, uiScale: .75 });
    R.newRun(12345); R.resume();
    const s = R.state, t = s.train;
    const p = s.route.path[t.routeIndex];
    const stop = s.settlements.find(st => st.col === p[0] && st.row === p[1]);
    stop.type = 'depot'; stop.visited = true; stop.consumed = false;
    t.stopReason = 'settlement'; t.stopped = true; t.speed = 0; t.stopTimer = 0;
    t.cars[5].hp = t.cars[5].maxHp * .44; t.cars[4].hp = t.cars[4].maxHp * .62;
    s.phase = 'paused'; R.sim.restore(R.sim.serialize()); R.view.centerOnTrain();
  });
  await page.getByRole('button', { name: 'Service stop', exact: true }).waitFor();
}
async function key(key, extra = {}) {
  await page.evaluate(({ key, extra }) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, ...extra, bubbles: true, cancelable: true })), { key, extra });
}
async function bounds(width, height) {
  const bad = await page.locator('.rv-service-row button, .rv-stop-main button').evaluateAll(nodes => nodes.filter(n => !n.disabled && n.getClientRects().length).map(n => ({ text: n.textContent, r: n.getBoundingClientRect().toJSON() })));
  for (const b of bad) check(b.r.x >= 0 && b.r.y >= 0 && b.r.right <= width + 1 && b.r.bottom <= height + 1, `${width}x${height}: clipped ${b.text}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: horizontal page overflow`);
}
try {
  await page.goto(base); await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  for (const [width, height] of [[1440,900], [1280,720], [800,600], [390,844], [360,740], [844,450]]) {
    await page.setViewportSize({ width, height }); await fresh();
    await page.getByRole('button', { name: 'Service stop', exact: true }).click();
    await page.locator('.rv-service-row').waitFor({ state: 'visible' });
    await key('p', { repeat: true }); await key('p', { ctrlKey: true });
    check(!await page.evaluate(() => window.__RAIL.state.train.service.repairing), 'Repeated/modified P started repair');
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__RAIL.state.train.service.repairing);
    await page.locator('.rv-service-actions button').filter({ hasText: 'Stop repairs' }).waitFor();
    check(await page.evaluate(() => window.__RAIL.state.phase) === 'paused', 'Starting repair unpaused the player');
    await bounds(width,height);
    const path = `${out}/service-${width}x${height}.png`; await page.screenshot({ path }); shots.push(path);
    await page.getByRole('button', { name: 'Arrange cars', exact: true }).click();
    const backward = page.getByRole('button', { name: 'Move this car backward', exact: true }); await backward.waitFor();
    const car = await page.evaluate(() => window.__RAIL.state.train.cars[1].id);
    await backward.click();
    check(await page.evaluate(() => window.__RAIL.state.train.cars[2].id) === car, 'Reorder failed at depot');
    await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await page.keyboard.press('p');
    check(!await page.evaluate(() => window.__RAIL.state.train.service.repairing), 'P did not stop repairs');
    await page.keyboard.press('x');
    check(!await page.evaluate(() => window.__RAIL.state.train.service), 'Departure retained repair mode');
  }
  await page.setViewportSize({ width:1280, height:720 }); await fresh();
  const work = await page.evaluate(() => {
    const R = window.__RAIL, t = R.state.train, before = t.cars[5].hp, scrap = t.resources.scrap, front = R.state.void.front[0];
    R.sim.setFieldRepair(true); R.resume();
    for(let i=0; i<45; i++) R.sim.update(.05);
    R.pause(); return { gain:t.cars[5].hp-before, paid:scrap-t.resources.scrap, voidMoved:R.state.void.front[0]>front, held:!!t.service };
  });
  check(work.gain>0 && work.paid>0 && Math.abs(work.gain/work.paid-8)<.01 && work.voidMoved && work.held, 'Repair did not exchange real time and scrap for hull');
  // No leaked service HUD on title screen.
  await page.evaluate(() => window.__RAIL.ctx.quitToTitle());
  await page.waitForFunction(() => document.querySelector('#ui').classList.contains('rv-title-mode'));
  check(await page.locator('.rv-service-row').isHidden(), 'Service controls leaked onto title screen');
} catch(e) { failures.push(e.stack ?? String(e)); await page.screenshot({ path:`${out}/failure.png` }).catch(()=>{}); }
finally { await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify({ errors, failures, shots }, null, 2)); console.log(JSON.stringify({ errors, failures, shots }, null, 2)); if(errors.length || failures.length) process.exitCode=1; }
