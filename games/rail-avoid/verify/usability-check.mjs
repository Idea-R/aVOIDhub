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
const startedRunning = await page.evaluate(() => window.__RAIL.state.phase === 'running');
assert(startedRunning, 'a new run did not begin in the running state');
await page.evaluate(() => window.__RAIL.pause());
await page.waitForTimeout(1000); // command-deck entrance animation must settle before geometry checks
const paused = await page.evaluate(() => ({
  phase: window.__RAIL.state.phase,
  callout: !document.querySelector('#ui .rv-paused-callout')?.hidden,
  calloutText: document.querySelector('#ui .rv-paused-callout')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  topControl: document.querySelector('#ui .rv-speed button[aria-label^="Resume"]')?.textContent?.trim() || '',
}));
assert(paused.phase === 'paused' && paused.callout, `paused journey has no central recovery action: ${JSON.stringify(paused)}`);
assert(/Journey paused/i.test(paused.calloutText) && /Resume journey/i.test(paused.calloutText), `paused callout is unclear: ${paused.calloutText}`);
assert(paused.topControl === '▶', `top time control does not become Resume while paused: ${paused.topControl}`);
await page.locator('#ui .rv-paused-callout button').click();
await page.waitForFunction(() => window.__RAIL.state.phase === 'running', null, { timeout: 3000 });
await page.evaluate(() => window.__RAIL.pause());

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

  // The route rail should wait for deliberate hover and then unfold, rather than
  // flashing its contents into existence instantly.
  await page.evaluate(() => {
    const R = window.__RAIL;
    const s = R.state;
    s.route.blocked = false; s.train.reversing = false;
    s.train.stopped = false; s.train.stopReason = 'none';
    // Emit real phase transitions so the paused render loop recomputes responsive layout.
    R.resume(); R.pause();
  });
  await page.mouse.move(900, 500);
  await page.waitForTimeout(650);
  const route = page.locator('#ui .rv-route');
  const collapsedWidth = await route.evaluate(n => n.getBoundingClientRect().width);
  await route.hover();
  await page.waitForTimeout(75);
  const intentWidth = await route.evaluate(n => n.getBoundingClientRect().width);
  await page.waitForTimeout(600);
  const openWidth = await route.evaluate(n => n.getBoundingClientRect().width);
  assert(collapsedWidth <= 48, `route rail did not collapse (${collapsedWidth}px)`);
  assert(intentWidth < 90, `route rail expanded before hover intent elapsed (${intentWidth}px)`);
  assert(openWidth > 180, `route rail did not smoothly expand (${openWidth}px)`);
}

// A concealed track node must reveal a purpose-built encounter card only after it fires.
await page.evaluate(() => { window.__RAIL.resume(); window.__RAIL.triggerEvent('mystery_cache'); });
await page.waitForFunction(() => {
  const n = document.querySelector('#ui .rv-event.rv-mystery-event');
  return n && !n.closest('[hidden]');
}, null, { timeout: 4000 });
await page.waitForTimeout(1100);
const mysteryCard = await page.evaluate(() => ({
  wire: document.querySelector('#ui .rv-event .rv-wire')?.textContent || '',
  title: document.querySelector('#ui .rv-event h2')?.textContent || '',
  choices: document.querySelectorAll('#ui .rv-event .rv-option').length,
  mark: document.querySelector('#ui .rv-event .rv-mystery-mark')?.textContent || '',
}));
assert(/Unknown signal/i.test(mysteryCard.wire) && mysteryCard.choices === 3 && !!mysteryCard.mark, `mystery event reveal is incomplete: ${JSON.stringify(mysteryCard)}`);
await page.screenshot({ path: path.join(out, 'mystery-cache-1664x920.png') });
await page.evaluate(() => window.__RAIL.state.phase === 'event' && window.__RAIL.sim.chooseEventOption(1));
await page.waitForTimeout(150);

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
  const dock = document.querySelector('#ui .rv-dock');
  const inspector = document.querySelector('#ui [data-panel="inspector"]');
  const rendered = (n) => !!n && !n.hidden && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden';
  return {
    visible: !!panel && !panel.hidden,
    cards: panel?.querySelectorAll('.rv-shop-car').length ?? 0,
    visuals: panel?.querySelectorAll('.rv-shop-car-visual').length ?? 0,
    loco: panel?.querySelector('.rv-loco-card')?.textContent ?? '',
    jump: panel?.querySelector('.rv-loco-jump')?.textContent ?? '',
    horizontalOverflow: body ? body.scrollWidth > body.clientWidth + 2 : true,
    dockVisible: rendered(dock),
    inspectorVisible: rendered(inspector),
  };
});
assert(yard.visible, 'repair yard did not open');
assert(yard.cards >= 6 && yard.visuals === yard.cards, 'repair-yard rolling-stock cards are incomplete');
assert(/four tracks/i.test(yard.loco) && /separate/i.test(yard.loco), 'locomotive upgrade explanation is missing');
assert(/engine systems/i.test(yard.jump), 'locomotive card has no engine-system jump');
assert(!yard.horizontalOverflow, 'repair-yard body has horizontal overflow');
assert(!yard.dockVisible && !yard.inspectorVisible, 'repair yard did not collapse conflicting train workspaces');

// Yard cards select rolling stock in place; they must not reopen the inspector over the yard.
await page.locator('#ui [data-panel="shop"] .rv-shop-car').first().click({ position: { x: 16, y: 16 } });
await page.waitForTimeout(100);
const yardCardExclusive = await page.evaluate(() => {
  const inspector = document.querySelector('#ui [data-panel="inspector"]');
  return !inspector || inspector.hidden || getComputedStyle(inspector).display === 'none';
});
assert(yardCardExclusive, 'selecting a repair-yard card opened the inspector over the yard');
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

// Returning from an active Repair Yard must make the title an exclusive mode immediately,
// including while the side-panel exit animation would normally still be in flight.
await page.evaluate(() => window.__RAIL.quitToTitle());
await page.waitForTimeout(40);
const titleExclusive = await page.evaluate(() => {
  const root = document.querySelector('#ui');
  const title = document.querySelector('#ui [data-panel="title"], #ui .rv-title');
  const shop = document.querySelector('#ui [data-panel="shop"]');
  const inspector = document.querySelector('#ui [data-panel="inspector"]');
  const visible = (n) => !!n && !n.hidden && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden';
  return {
    titleMode: root?.classList.contains('rv-title-mode') ?? false,
    titleVisible: visible(title),
    shopVisible: visible(shop),
    inspectorVisible: visible(inspector),
    shopLayoutClass: root?.classList.contains('rv-shop-open') ?? true,
    inspectorLayoutClass: root?.classList.contains('rv-inspector-open') ?? true,
  };
});
assert(titleExclusive.titleMode && titleExclusive.titleVisible, 'title mode did not become active');
assert(!titleExclusive.shopVisible && !titleExclusive.inspectorVisible, 'gameplay side panel leaked onto the title screen');
assert(!titleExclusive.shopLayoutClass && !titleExclusive.inspectorLayoutClass, 'stale side-panel layout class survived the title transition');
console.log('title', JSON.stringify(titleExclusive));
await page.screenshot({ path: path.join(out, 'title-exclusive-1280x720.png') });

assert(errors.length === 0, `browser errors: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log('PASS interface scale, two-tier manifest, settlement click, exclusive repair yard, compact weather, exclusive title');
