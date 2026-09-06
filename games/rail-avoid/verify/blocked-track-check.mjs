/** Local opt-in fixture. Separate browser/save; ordinary worlds remain unchanged. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5178/RAILaVOID/';
const out = 'verify/screenshots/blocked-track'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
const errors = [], failures = [], samples = [];
const check = (ok, label) => { if (!ok) failures.push(label); };
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => window.__RAIL_SKIP_OPENING = true);
async function capture(name) {
  const bounds = await page.locator('.rv-overlay:not([hidden]) button, .rv-event, .rv-crewpick, .rv-exp-result, .rv-exp-depth-card').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => {
    const r = n.getBoundingClientRect(); return { tag: n.tagName, text: n.textContent.slice(0, 70), x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
  }));
  for (const b of bounds) check(b.x >= -1 && b.y >= -1 && b.right <= b.width + 1 && b.bottom <= b.height + 1, `${name}: ${b.text} outside viewport`);
  samples.push({ name, bounds });
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function fresh(width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => {
    const R = window.__RAIL; R.ctx.settings.setMeta({ introSeen: true });
    R.ctx.settings.set({ showTutorial: false, reducedMotion: true, uiScale: .75 });
    R.newRun(12345); R.resume();
    const from = [...R.state.route.path.at(-1)], option = R.sim.junctionOptions()[0], to = [option.col, option.row];
    if (!R.sim.planTile(...to).ok) throw Error('Could not create ordinary rail plan');
    if (!R.sim.debug.placeTrackAmbush(from, to)) throw Error('Could not arm fixture');
    R.state.train.crew[0].hp = 45;
    R.state.train.crew.push({ id: 'qa-gunner', name: 'Nils', specialty: 'gunner', hp: 45, carIndex: -1 }, { id: 'qa-medic', name: 'Ines', specialty: 'medic', hp: 45, carIndex: -1 });
    R.sim.update(.1); // actual movement interception, not a synthetic event
    if (R.state.phase !== 'event' || R.state.train.progress !== 0) throw Error('Train did not stop at barricade');
  });
  await page.locator('.rv-event').waitFor({ state: 'visible' });
  await page.locator('.rv-event img').evaluate(i => i.decode());
}
async function prepare() {
  await page.keyboard.press('1');
  await page.locator('.rv-crewpick').waitFor({ state: 'visible' });
}
async function start() {
  await prepare(); await page.keyboard.press('2'); await page.keyboard.press('3');
  await page.getByRole('button', { name: 'Start the expedition (Enter)', exact: true }).click();
  await page.locator('.rv-exp-menu').waitFor({ state: 'visible' });
}
async function play(toGate) {
  await page.evaluate(stop => {
    const R = window.__RAIL;
    for (let i = 0; i < 250 && !R.state.expedition.outcome; i++) {
      const x = R.state.expedition;
      if (x.awaitingAdvance) { if (stop) break; R.sim.advanceExpedition(true); }
      else if (x.pending) R.sim.expeditionResolve('good');
      else R.sim.expeditionAction('strike');
    }
    R.sim.restore(R.sim.serialize());
  }, toGate);
}
try {
  await page.goto(base); await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  for (const [width, height] of [[1280,720],[800,600],[390,844],[844,450]]) {
    await fresh(width, height); await capture(`arrival-${width}x${height}`);
    await prepare(); await capture(`prepare-${width}x${height}`);
    await page.keyboard.press('Escape'); await page.locator('.rv-event').waitFor({ state: 'visible' });
    check(await page.evaluate(() => window.__RAIL.state.route.encounters[0].attempts === 0), 'Cancel spent an attempt');
    await page.keyboard.press('2');
    await page.waitForFunction(() => window.__RAIL.state.phase === 'running');
    await page.evaluate(() => window.__RAIL.pause());
    await page.getByRole('button', { name: 'Inspect barricade', exact: true }).waitFor({ state: 'visible' });
    await capture(`stay-aboard-${width}x${height}`);
    await page.getByRole('button', { name: 'Inspect barricade', exact: true }).click();
    await page.locator('.rv-event').waitFor({ state: 'visible' });
  }
  await fresh(1280,720); await start();
  await page.keyboard.press('f'); await page.locator('.rv-exp-result').waitFor({ state: 'visible' });
  await capture('retreat'); await page.locator('.rv-exp-result button').click();
  await page.locator('.rv-event').waitFor({ state: 'visible' });
  check(await page.evaluate(() => window.__RAIL.state.route.encounters[0].status === 'blocked'), 'Retreat opened the track');
  await capture('retry'); await start(); await play(true);
  await page.locator('.rv-exp-depth-card').waitFor({ state: 'visible' }); await capture('stage-gate');
  await page.locator('.rv-exp-depth-card button').first().click(); await play(false);
  await page.locator('.rv-exp-result').waitFor({ state: 'visible' }); await capture('victory');
  check(await page.evaluate(() => window.__RAIL.state.expedition.outcome === 'won'), 'Good-timing ordinary wounded party failed');
  const receipt = await page.evaluate(() => ({ marks: window.__RAIL.state.train.marks, front: window.__RAIL.state.void.front }));
  await page.locator('.rv-exp-result button').click();
  await page.waitForFunction(() => window.__RAIL.state.phase === 'relic');
  await page.evaluate(() => { const R = window.__RAIL; R.ctx.settings.writeSave(R.sim.serialize()); });
  await page.reload(); await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  await page.evaluate(() => { const R = window.__RAIL; if (!R.ctx.continueRun()) throw Error('Continue failed'); });
  await page.waitForFunction(() => window.__RAIL.state.phase === 'relic');
  await page.evaluate(() => window.__RAIL.sim.chooseRelic(0));
  check(await page.evaluate(r => { const s = window.__RAIL.state; return s.phase === 'running' && s.route.encounters[0].status === 'cleared' && s.train.marks === r.marks && JSON.stringify(s.void.front) === JSON.stringify(r.front); }, receipt), 'Result/relic reload duplicated reward or lost clear state');
} catch (e) { failures.push(e.stack ?? String(e)); await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); }
finally {
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ errors, failures, samples }, null, 2));
  console.log(JSON.stringify({ errors, failures, samples: samples.length }, null, 2));
  if (errors.length || failures.length) process.exitCode = 1;
}
