#!/usr/bin/env node
/** Focused gate for adjustable chrome, settlement clicks, the repair yard and weather readability. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = process.argv.find(v => v.startsWith('--url='));
const base = arg ? arg.slice(6) : 'http://127.0.0.1:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/usability');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1664, height: 920 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error' && !/AudioContext encountered an error from the audio device|WebAudio renderer/i.test(m.text())) errors.push(m.text());
});
await page.addInitScript(() => { window.__RAIL_SKIP_OPENING = true; });
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
await page.evaluate(() => {
  const R = window.__RAIL;
  R.ctx.settings.setMeta({ introSeen: true });
  // Pin high quality so headless SwiftShader cannot auto-disable weather during the visual gate.
  R.ctx.settings.set({ showTutorial: false, quality: 'high' });
  R.newRun(12345);
});
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(350);
  const playing = await page.evaluate(() => !!window.__RAIL.view?.isCinematicPlaying());
  if (playing) await page.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
}
await page.waitForFunction(() => !window.__RAIL.view?.isCinematicPlaying(), null, { timeout: 10000 });
await page.evaluate(() => window.__RAIL.pause());
await page.waitForTimeout(1000); // command-deck entrance animation must settle before geometry checks

const desktop = await page.evaluate(() => {
  const root = document.querySelector('#ui');
  const top = document.querySelector('#ui .rv-hud-top');
  const slider = document.querySelector('input[aria-label="Interface size"]');
  const tr = document.querySelector('#ui .rv-hud-tr');
  const r = top?.getBoundingClientRect();
  const rr = tr?.getBoundingClientRect();
  return {
    density: getComputedStyle(root).getPropertyValue('--ui-density').trim(),
    slider: slider?.value,
    topRight: r?.right ?? 99999,
    controlsRight: rr?.right ?? 99999,
    controlsLeft: rr?.left ?? -1,
    controlsWidth: rr?.width ?? -1,
    controlsTransform: tr ? getComputedStyle(tr).transform : '',
    controlsLayoutRight: top && tr ? top.getBoundingClientRect().left + tr.offsetLeft + tr.offsetWidth : 99999,
    topGrid: top ? getComputedStyle(top).gridTemplateColumns : '',
    width: innerWidth,
    resourceRows: document.querySelectorAll('#ui .rv-chips .rv-chip').length,
    opsRows: document.querySelectorAll('#ui .rv-deck-operations > .rv-chip, #ui .rv-deck-operations > .rv-void').length,
  };
});
assert(desktop.density === '0.75', `default density ${desktop.density}, expected 0.75`);
assert(desktop.slider === '75', `interface-size slider ${desktop.slider}, expected 75`);
console.log('desktop', JSON.stringify(desktop));
assert(desktop.topRight <= desktop.width + 2 && desktop.controlsLayoutRight <= desktop.width + 2, `desktop command deck layout overflows viewport (${desktop.topRight}/${desktop.controlsLayoutRight} > ${desktop.width})`);
assert(desktop.resourceRows === 5 && desktop.opsRows >= 3, 'manifest is not split into supply and operations rails');

// A real canvas click on a nearby settlement marker must extend the route toward it.
const click = await page.evaluate(() => {
  const R = window.__RAIL;
  const end = R.state.route.path.at(-1);
  const candidates = R.state.settlements.filter(s => !s.consumed && !s.visited && s.col > end[0]);
  candidates.sort((a, b) => Math.hypot(a.col - end[0], a.row - end[1]) - Math.hypot(b.col - end[0], b.row - end[1]));
  const target = candidates[0];
  return target ? { id: target.id, before: R.state.route.path.length, at: R.view.hexToScreen(target.col, target.row) } : null;
});
assert(click && click.at.x > 0 && click.at.x < 1664 && click.at.y > 0 && click.at.y < 920, 'nearby settlement marker is not on screen');
if (click) {
  await page.mouse.click(click.at.x, click.at.y);
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.__RAIL.state.route.path.length);
  assert(after > click.before, `settlement click did not extend route (${click.before} -> ${after})`);
}

// Force the repair-yard presentation after interaction verification.
await page.evaluate(() => {
  const R = window.__RAIL;
  R.state.phase = 'shop';
  R.state.train.stopped = true;
  R.state.train.stopReason = 'settlement';
  R.ctx.bus.emit('phase:change', { phase: 'shop' });
});
await page.waitForTimeout(500);
const yard = await page.evaluate(() => {
  const panel = document.querySelector('#ui [data-panel="shop"]');
  const body = panel?.querySelector('.rv-side-body');
  return {
    visible: !!panel && !panel.hidden,
    cards: panel?.querySelectorAll('.rv-shop-car').length ?? 0,
    visuals: panel?.querySelectorAll('.rv-shop-car-visual').length ?? 0,
    loco: panel?.querySelector('.rv-loco-card')?.textContent ?? '',
    jump: panel?.querySelector('.rv-loco-jump')?.textContent ?? '',
    horizontalOverflow: body ? body.scrollWidth > body.clientWidth + 2 : true,
  };
});
assert(yard.visible, 'repair yard did not open');
assert(yard.cards >= 6 && yard.visuals === yard.cards, 'repair-yard rolling-stock cards are incomplete');
assert(/four tracks/i.test(yard.loco) && /separate/i.test(yard.loco), 'locomotive upgrade explanation is missing');
assert(/engine systems/i.test(yard.jump), 'locomotive card has no engine-system jump');
assert(!yard.horizontalOverflow, 'repair-yard body has horizontal overflow');
await page.screenshot({ path: path.join(out, 'repair-yard-1664x920.png') });

// Compact command deck must retain controls and weather while staying inside 1280 px.
await page.evaluate(() => {
  const R = window.__RAIL;
  R.state.phase = 'running'; R.ctx.bus.emit('phase:change', { phase: 'running' }); R.setWeather('fog');
});
// Let the deliberately gentle fog-bank fade reach its representative in-game state.
await page.waitForTimeout(1400);
await page.evaluate(() => window.__RAIL.pause());
await page.setViewportSize({ width: 1280, height: 720 });
await page.mouse.move(2, 2);
await page.waitForTimeout(700);
const compact = await page.evaluate(() => {
  const top = document.querySelector('#ui .rv-hud-top')?.getBoundingClientRect();
  const controls = document.querySelector('#ui .rv-hud-tr')?.getBoundingClientRect();
  const status = document.querySelector('#ui .rv-hud-tc');
  return {
    topRight: top?.right ?? 99999,
    controlsRight: controls?.right ?? 99999,
    controlsLayoutRight: top && controls ? top.left + document.querySelector('#ui .rv-hud-tr').offsetLeft + document.querySelector('#ui .rv-hud-tr').offsetWidth : 99999,
    statusVisible: !!status && getComputedStyle(status).display !== 'none',
    weather: status?.textContent ?? '',
  };
});
console.log('compact', JSON.stringify(compact));
assert(compact.topRight <= 1282 && compact.controlsLayoutRight <= 1282, `compact command deck layout overflows 1280 px (${compact.topRight}/${compact.controlsLayoutRight})`);
assert(compact.statusVisible && /fog/i.test(compact.weather), 'compact weather/status readout is missing');
await page.screenshot({ path: path.join(out, 'fog-1280x720.png') });

assert(errors.length === 0, `browser errors: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log('PASS interface scale, two-tier manifest, settlement click, repair yard, compact weather');
