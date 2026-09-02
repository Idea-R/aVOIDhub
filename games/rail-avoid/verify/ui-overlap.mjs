#!/usr/bin/env node
/**
 * HUD safe-zone overlap check.
 *
 *   node verify/ui-overlap.mjs [--url=http://localhost:5199] [--shots=DIR] [--headed]
 *
 * For each viewport (1920x1080, 1600x900, 1366x768, 1280x720) and scenario (shop open / inspector open + event
 * modal) it starts a run, forces the HUD into its busiest state (wave banner, stop pill, three toasts, tutorial
 * card, log feed on) and measures the bounding boxes of every major container. Any pair of boxes that intersects
 * by more than 1 px is reported. Exit code 1 when any overlap is found.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const hit = argv.find(a => a.startsWith('--' + name + '=')); return hit ? hit.slice(name.length + 3) : def; };
const URL = opt('url', 'http://localhost:5199') + '/?dev';
const SHOTS = opt('shots', '');
const HEADED = argv.includes('--headed');
const VIEWPORTS = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];
const SCENARIOS = ['shop', 'inspector'];

const BOXES = {
  topbar: '#ui .rv-hud-top',
  leftrail: '#ui .rv-route',
  log: '#ui .rv-log',
  rightpanel: '#ui .rv-side:not([hidden]):not(.rv-closing)',
  wavebanner: '#ui .rv-warning',
  stoppill: '#ui .rv-stop',
  junction: '#ui .rv-junction',
  strip: '#ui .rv-strip',
  toast: '#ui .rv-toast',
  tutorial: '#ui .rv-coach',
  eventmodal: '#ui .rv-event',
};

function intersects(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 1 && h > 1 ? { w: Math.round(w), h: Math.round(h) } : null;
}

async function setup(page, scenario) {
  await page.evaluate(async () => {
    const R = window.__RAIL;
    R.ctx.settings.set({ showTutorial: true, showLog: true, reducedMotion: false, compactHud: false });
    R.newRun(12345);
    await R.waitFor(() => R.state.phase === 'running', 5000);
    // the run-intro cinematic hides the HUD and replays its entrance when it ends; skip it and let the entrance settle
    await new Promise(r => setTimeout(r, 300));
    try { R.view && R.view.skipCinematic(); } catch (e) { /* view may not be ready */ }
    await R.waitFor(() => !R.view || !R.view.isCinematicPlaying(), 5000);
    R.stepSim(3);
    R.pause();
  });
  await page.waitForTimeout(1600);
  await page.evaluate((scenario) => {
    const R = window.__RAIL;
    const s = R.state;
    const bus = R.ctx.bus;
    // busiest HUD: wave banner + stop pill + toasts + tutorial
    s.director.warning = { type: 'raider', from: 'west', in: 5 };
    s.train.stopped = true;
    s.train.stopReason = 'settlement';
    s.train.stopTimer = 0;
    // put the loco on a settlement tile so the pill names it
    const yard = s.settlements.find(x => x.type === 'yard') || s.settlements[1];
    const p = s.route.path[Math.min(s.train.routeIndex, s.route.path.length - 1)];
    if (yard && p) { const t = s.tiles[p[1] * s.mapW + p[0]]; if (t) t.settlementId = yard.id; }
    if (scenario === 'shop') {
      s.phase = 'shop';
      bus.emit('phase:change', { phase: 'shop' });
    } else {
      bus.emit('ui:selectCar', { index: 1 });
      const ev = s.activeEvent ? s.activeEvent.defId : 'stowaway';
      bus.emit('event:show', { defId: ev });
    }
    for (let i = 0; i < 3; i++) bus.emit('ui:notify', { text: `Toast ${i + 1}: something happened on the line`, kind: i === 0 ? 'good' : i === 1 ? 'warn' : 'bad' });
    bus.emit('tutorial:step', { step: 3, text: 'A wave is coming. Turrets fire on their own; keep the ammo supplier within two cars of every gun.' });
  }, scenario);
  await page.waitForTimeout(1300);
}

async function measure(page) {
  return page.evaluate((BOXES) => {
    const out = [];
    for (const [name, sel] of Object.entries(BOXES)) {
      const nodes = Array.from(document.querySelectorAll(sel));
      nodes.forEach((n, i) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.hidden || n.closest('[hidden]')) return;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = n.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        out.push({ name: nodes.length > 1 ? `${name}#${i + 1}` : name, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      });
    }
    return out;
  }, BOXES);
}

const browser = await chromium.launch({ headless: !HEADED });
let failures = 0;
const summary = [];
for (const [w, h] of VIEWPORTS) {
  for (const scenario of SCENARIOS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__RAIL && window.__RAIL.ready, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await setup(page, scenario);
    const boxes = await measure(page);
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      // sibling toasts stack; a group is one column so they never overlap each other, but check anyway
      const hit = intersects(a, b);
      if (hit) overlaps.push(`${a.name} × ${b.name} (${hit.w}×${hit.h}px)`);
    }
    // containers must also stay inside the viewport
    const outside = boxes.filter(b => b.left < -1 || b.top < -1 || b.right > w + 1 || b.bottom > h + 1).map(b => `${b.name} leaves the viewport`);
    const tag = `${w}x${h} ${scenario}`;
    const line = `${tag.padEnd(20)} boxes=${boxes.length} overlaps=${overlaps.length}${outside.length ? ' outside=' + outside.length : ''}${errors.length ? ' pageErrors=' + errors.length : ''}`;
    console.log(line);
    for (const o of overlaps) console.log('   OVERLAP ' + o);
    for (const o of outside) console.log('   ' + o);
    for (const e of errors) console.log('   ERROR ' + e.split('\n')[0]);
    if (argv.includes('--boxes')) for (const b of boxes) console.log(`   ${b.name.padEnd(14)} ${Math.round(b.left)},${Math.round(b.top)} → ${Math.round(b.right)},${Math.round(b.bottom)}`);
    summary.push({ viewport: `${w}x${h}`, scenario, boxes: boxes.length, overlaps, outside, errors });
    if (overlaps.length || outside.length) failures++;
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `overlap_${w}x${h}_${scenario}.png`) });
    }
    await page.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} layout(s) with overlaps` : '\nZero overlaps across all viewports and scenarios');
process.exit(failures ? 1 : 0);
