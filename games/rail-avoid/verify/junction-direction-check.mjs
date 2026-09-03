#!/usr/bin/env node
/** Verify junction controls mirror map geometry and choosing a branch resumes play. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = process.argv.find(v => v.startsWith('--url='));
const base = arg ? arg.slice(6) : 'http://127.0.0.1:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/junction');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1664, height: 920 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { window.__RAIL_SKIP_OPENING = true; });
await page.goto(`${base}/?dev`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
await page.evaluate(() => {
  const R = window.__RAIL;
  R.ctx.settings.setMeta({ introSeen: true });
  R.ctx.settings.set({ showTutorial: false, reducedMotion: true });
  R.newRun(12345);
  R.invulnerable(true);
  let guard = 0;
  while (guard++ < 20000) {
    const s = R.state;
    if (s.phase === 'relic') R.sim.chooseRelic(0);
    if (s.phase === 'event') {
      if (!R.sim.chooseEventOption(2) && !R.sim.chooseEventOption(1)) R.sim.chooseEventOption(0);
    }
    if (s.phase === 'shop') R.sim.closeShop();
    if (s.phase === 'expedition') {
      const x = s.expedition;
      if (x?.outcome) R.sim.endExpedition();
      else if (x?.awaitingAdvance) R.sim.advanceExpedition(true);
      else if (x?.pending) R.sim.expeditionResolve('good');
      else R.sim.expeditionAction('strike');
    }
    if (s.train.stopped && s.train.stopReason === 'junction') break;
    if (s.train.stopped && s.train.stopReason === 'no_route') {
      const opts = R.sim.plannableTiles();
      const next = opts.find(t => t.free) ?? opts[0];
      if (next) R.sim.planTile(next.col, next.row);
    }
    if (s.train.stopped && s.train.stopReason === 'settlement' && s.train.stopTimer > 1) R.sim.depart();
    R.sim.update(0.05);
  }
  if (R.state.train.stopReason === 'junction') R.pause();
});
await page.waitForFunction(() => {
  const panel = document.querySelector('#ui .rv-junction');
  return window.__RAIL.state.phase === 'paused' && panel && !panel.hidden && panel.querySelectorAll('.rv-junction-opt').length >= 2;
}, null, { timeout: 5000 });
await page.waitForTimeout(250);

const geometry = await page.evaluate(() => {
  const R = window.__RAIL;
  const buttons = [...document.querySelectorAll('#ui .rv-junction-opt')];
  return buttons.map((button, i) => {
    const col = Number(button.dataset.col), row = Number(button.dataset.row);
    return {
      i, col, row,
      mapX: R.view.hexToScreen(col, row).x,
      controlX: button.getBoundingClientRect().left,
      text: button.textContent?.replace(/\s+/g, ' ').trim() || '',
      aria: button.getAttribute('aria-label') || '',
    };
  });
});
assert(geometry.length >= 2, `expected at least two junction choices, got ${geometry.length}`);
for (let i = 1; i < geometry.length; i++) {
  assert(geometry[i - 1].mapX <= geometry[i].mapX, `controls do not run left-to-right with map branches: ${JSON.stringify(geometry)}`);
  assert(geometry[i - 1].controlX < geometry[i].controlX, `junction cards are not left-to-right: ${JSON.stringify(geometry)}`);
}
assert(geometry.every(x => /east|west|north|south/i.test(x.aria) && /[←→↑↓↖↗↘↙]/.test(x.text)), `junction directions are not explicit: ${JSON.stringify(geometry)}`);
await page.screenshot({ path: path.join(out, 'map-aligned-paused-junction.png') });

const chosen = geometry.at(-1);
await page.locator('#ui .rv-junction-opt').last().click();
await page.waitForFunction(({ col, row }) => {
  const R = window.__RAIL;
  const end = R.state.route.path.at(-1);
  return end?.[0] === col && end?.[1] === row && R.state.phase === 'running' && !R.state.train.stopped;
}, { col: chosen.col, row: chosen.row }, { timeout: 4000 });
const final = await page.evaluate(() => ({ phase: window.__RAIL.state.phase, stopped: window.__RAIL.state.train.stopped, end: window.__RAIL.state.route.path.at(-1) }));
assert(final.phase === 'running' && !final.stopped, `junction choice did not visibly resume the journey: ${JSON.stringify(final)}`);
assert(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
await browser.close();

if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS map-aligned junction controls, explicit direction labels, and choose-to-resume flow');
