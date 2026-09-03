#!/usr/bin/env node
/** Focused gate for the first authored Away Team character vertical slice. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = process.argv.find(v => v.startsWith('--url='));
const base = arg ? arg.slice(6) : 'http://127.0.0.1:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/sprint-05');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/AudioContext|WebAudio renderer/i.test(m.text())) errors.push(m.text()); });
await page.addInitScript(() => { window.__RAIL_SKIP_OPENING = true; });
await page.goto(`${base}/?dev`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
await page.evaluate(() => {
  const R = window.__RAIL;
  R.ctx.settings.setMeta({ introSeen: true });
  R.ctx.settings.set({ showTutorial: false, quality: 'high' });
  R.newRun(50505);
});
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  if (await page.evaluate(() => !!window.__RAIL.view?.isCinematicPlaying())) {
    await page.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
  }
}
await page.evaluate(() => window.__RAIL.sim.debug.startExpedition());
await page.waitForFunction(() => document.querySelector('#ui .rv-exp-fig-authored img')?.complete, null, { timeout: 10000 });
await page.waitForTimeout(900);

const result = await page.evaluate(() => {
  const root = document.querySelector('#ui .rv-exp');
  const img = document.querySelector('#ui .rv-exp-fig-authored img');
  const rect = img?.getBoundingClientRect();
  let cornerAlpha = -1;
  if (img instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    cornerAlpha = ctx.getImageData(0, 0, 1, 1).data[3];
  }
  return {
    phase: window.__RAIL.state.phase,
    visible: !!root && getComputedStyle(root).display !== 'none',
    natural: [img?.naturalWidth ?? 0, img?.naturalHeight ?? 0],
    rendered: [Math.round(rect?.width ?? 0), Math.round(rect?.height ?? 0)],
    cornerAlpha,
    viewport: [innerWidth, innerHeight],
  };
});

console.log('expedition-art', JSON.stringify(result));
assert(result.phase === 'expedition' && result.visible, 'deterministic expedition fixture did not open');
assert(result.natural[0] >= 768 && result.natural[1] >= 1024, `combat master is undersized (${result.natural.join('x')})`);
assert(result.rendered[1] >= 120, `combat master is not legible at 1280x720 (${result.rendered.join('x')})`);
assert(result.cornerAlpha === 0, `combat master does not retain transparent corners (alpha ${result.cornerAlpha})`);
assert(errors.length === 0, `browser errors: ${errors.slice(0, 3).join(' | ')}`);
await page.screenshot({ path: path.join(out, 'conductor-vertical-slice-1280x720.png') });
await browser.close();

if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS authored conductor identity, alpha, resolution and stage readability');
