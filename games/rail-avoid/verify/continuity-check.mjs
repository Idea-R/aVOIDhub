/** UI fixtures, not a difficulty/balance measurement. Normal motion remains enabled. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'verify/screenshots/continuity';
fs.mkdirSync(out, { recursive: true });
const failures = [], errors = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => window.__RAIL_SKIP_OPENING = true);
  await page.goto('http://localhost:5178/RAILaVOID/');
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  async function fresh(reducedMotion = false) {
    await page.evaluate(reduced => {
      const R = window.__RAIL;
      R.ctx.settings.setMeta({ introSeen: true });
      R.ctx.settings.set({ reducedMotion: reduced, showTutorial: false, uiScale: .75 });
      R.newRun(12345); R.resume(); R.pause();
      R.state.train.crew.push({ id: 'qa-mechanic', name: 'Vey', specialty: 'mechanic', hp: 100, carIndex: -1 });
    }, reducedMotion);
    await page.waitForTimeout(600);
    if (await page.locator('.rv-junction-opt').first().isVisible()) {
      await page.locator('.rv-junction-opt').first().click();
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__RAIL.pause());
      await page.waitForTimeout(200);
    }
  }
  for (const [width, height] of [[1280, 720], [800, 600], [390, 844]]) {
    await page.setViewportSize({ width, height }); await fresh();
    await page.evaluate(() => window.__RAIL.ctx.bus.emit('relic:taken', { id: 'tinkers_kit' }));
    await page.locator('.rv-announce').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    const before = await page.locator('.rv-announce').boundingBox();
    check((await page.locator('.rv-ann-body').textContent()).includes('0.4'), `${width}: full relic text missing`);
    await page.evaluate(() => window.__RAIL.ctx.bus.emit('ui:notify', { text: 'Ostford was taken by the void with 10 people', kind: 'bad' }));
    await page.waitForTimeout(250);
    const after = await page.locator('.rv-announce').boundingBox();
    const toast = await page.locator('.rv-toast').last().boundingBox();
    check(toast.y >= after.y + after.height, `${width}: toast overlaps announcement`);
    check(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, `${width}: toast moves announcement`);
    check(after.x >= 0 && after.x + after.width <= width + 1, `${width}: announcement clipped`);
    check(await page.locator('.rv-announce').evaluate(n => getComputedStyle(n).transform === 'none'), `${width}: notice transformed`);
    await page.screenshot({ path: `${out}/notices-${width}.png` });
    await page.evaluate(() => window.__RAIL.ctx.bus.emit('ui:selectCar', { index: 2 }));
    await page.locator('.rv-inspector').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    check(await page.locator('.rv-notice-rail').evaluate(n => getComputedStyle(n).visibility === 'hidden'), `${width}: notices cover inspector`);
    await page.getByRole('button', { name: /Post Vey, mechanic/ }).click();
    await page.getByRole('button', { name: 'Unassign current crew member' }).waitFor();
    await page.waitForTimeout(250);
    check(await page.getByRole('button', { name: 'Unassign current crew member' }).evaluate(n => n === document.activeElement), `${width}: posting loses focus`);
    check(await page.locator('.rv-crew-portrait img').evaluate(async img => { await img.decode(); return getComputedStyle(img).transform.includes('1.8') && img.naturalWidth === 240; }), `${width}: portrait not framed`);
    await page.screenshot({ path: `${out}/crew-posted-${width}.png` });
    await page.getByRole('button', { name: 'Unassign current crew member' }).click();
    await page.waitForTimeout(350);
    check(await page.getByRole('button', { name: /Post Vey, mechanic/ }).evaluate(n => n === document.activeElement), `${width}: unassign loses focus`);
  }
  // Resolver-driven stage completion: set HP at the boundary, before UI builds its choice.
  async function stageGate(hp, width = 1280) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 }); await fresh(true);
    await page.evaluate(() => { const R = window.__RAIL; R.resume(); R.sim.startExpedition(R.state.train.crew.map(c => c.id)); });
    await page.locator('.rv-exp-menu').waitFor({ state: 'visible' });
    await page.evaluate(health => {
      const R = window.__RAIL, x = R.state.expedition;
      for (let i = 0; i < 300 && !x.awaitingAdvance && !x.outcome; i++) {
        if (x.pending) R.sim.expeditionResolve('perfect');
        else if (x.turn === 'player') R.sim.expeditionAction('strike');
      }
      if (!x.awaitingAdvance) throw new Error('Stage fixture did not clear');
      x.actors[0].hp = health;
    }, hp);
    await page.locator('.rv-exp-depth-card').waitFor({ state: 'visible' });
    await page.waitForTimeout(200);
    return page.locator('.rv-exp-stage-gate');
  }
  for (const hp of [100, 21, 20, 1]) {
    const gate = await stageGate(hp, hp === 20 ? 390 : 1280);
    check(await gate.evaluate(n => n.classList.contains('rv-exp-depth-danger')) === (hp <= 20), `${hp} HP: warning threshold wrong`);
    check(await gate.locator('button').evaluateAll(ns => ns.every(n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })), `${hp} HP: stage choices clipped`);
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__RAIL.state.expedition.awaitingAdvance), `${hp} HP: auto-descended`);
    await page.screenshot({ path: `${out}/stage-${hp}hp.png` });
    if (hp === 100 || hp === 1) {
      await gate.locator('[data-retreat]').focus();
      await page.keyboard.press(hp === 100 ? 'Enter' : 'Space');
      await page.waitForFunction(() => window.__RAIL.state.expedition?.outcome === 'fled');
      check(await page.evaluate(() => window.__RAIL.state.expedition.stage === 1), `${hp} HP: retreat descended instead`);
    } else {
      await gate.locator('[data-autofocus]').click();
      await page.waitForFunction(() => window.__RAIL.state.expedition?.stage === 2);
    }
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
} finally { await browser.close(); }
fs.writeFileSync(`${out}/results.json`, JSON.stringify({ failures, errors }, null, 2));
console.log(JSON.stringify({ failures, errors }, null, 2));
if (failures.length) process.exitCode = 1;
else console.log('PASS stationary notices, crew framing/posting focus, voluntary descent and low-HP retreat keyboard controls');
