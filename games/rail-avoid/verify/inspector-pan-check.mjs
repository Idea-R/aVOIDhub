#!/usr/bin/env node
/** Regression check for the equipment-bay inspector and canvas-scoped right-drag camera input. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const urlArg = argv.find(a => a.startsWith('--url='));
const base = urlArg ? urlArg.slice(6) : 'http://127.0.0.1:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/sprint-05');
fs.mkdirSync(out, { recursive: true });

const failures = [];
const results = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });

async function start(page) {
  await page.goto(`${base}/?dev`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
  await page.evaluate(() => window.__RAIL.ctx.settings.setMeta({ introSeen: true }));
  await page.evaluate(() => window.__RAIL.newRun(12345));
  await page.waitForFunction(() => window.__RAIL.state.phase === 'running', null, { timeout: 15000 });
  await page.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
  await page.waitForFunction(() => !window.__RAIL.view?.isCinematicPlaying(), null, { timeout: 10000 });
  await page.evaluate(() => { window.__RAIL.pause(); window.__RAIL.view.centerOnTrain(); });
  await page.waitForTimeout(500);
}

for (const [width, height] of [[1664, 920], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await start(page);

  await page.locator('#ui .rv-car-type-gatling').click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('#ui .rv-inspector');
    return panel && !panel.hidden && document.querySelectorAll('#ui .rv-weapon-metric').length === 3;
  });
  await page.waitForTimeout(250);

  const inspector = await page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const panel = document.querySelector('#ui .rv-inspector');
    const body = panel.querySelector('.rv-side-body');
    const foot = panel.querySelector('.rv-side-foot');
    const gauges = [...panel.querySelectorAll('.rv-insp-gauge')];
    const status = [...panel.querySelectorAll('.rv-insp-status-cell')];
    const weapons = [...panel.querySelectorAll('.rv-weapon-metric')];
    return {
      panel: rect(panel),
      body: rect(body),
      foot: rect(foot),
      horizontalOverflow: body.scrollWidth - body.clientWidth,
      gauges: gauges.map(n => ({ text: n.textContent.replace(/\s+/g, ' ').trim(), rect: rect(n), bar: rect(n.querySelector('.rv-bar')) })),
      status: status.map(n => n.textContent.replace(/\s+/g, ' ').trim()),
      weapons: weapons.map(n => n.textContent.replace(/\s+/g, ' ').trim()),
      rosterCollapsed: !panel.querySelector('.rv-insp-roster')?.open,
      legacyTables: panel.querySelectorAll('.rv-kv-grid').length,
    };
  });
  assert(inspector.panel.right <= width + 1 && inspector.panel.bottom <= height + 1, `${width}: inspector leaves viewport`);
  assert(inspector.foot.bottom <= inspector.panel.bottom + 1 && inspector.foot.height > 30, `${width}: inspector actions are not persistently visible`);
  assert(inspector.horizontalOverflow <= 1, `${width}: inspector body overflows horizontally by ${inspector.horizontalOverflow}px`);
  assert(inspector.gauges.length === 2 && inspector.gauges.every(g => g.rect.height > 35 && g.bar.width > 100 && g.text.length > 12), `${width}: hull/thermal gauges are incomplete`);
  assert(inspector.status.length >= 6 && inspector.status.every(Boolean), `${width}: operational readouts are incomplete`);
  assert(inspector.weapons.length === 3 && inspector.weapons.every(Boolean), `${width}: weapon module is incomplete`);
  assert(inspector.rosterCollapsed, `${width}: train roster should use progressive disclosure`);
  assert(inspector.legacyTables === 0, `${width}: legacy inspector table remains`);
  await page.screenshot({ path: path.join(out, `inspector_${width}x${height}.png`) });

  // Context-menu suppression is deliberately scoped to the game canvas.
  const contextScope = await page.evaluate(() => {
    const canvas = document.querySelector('#game canvas');
    const panel = document.querySelector('#ui .rv-inspector');
    const canvasEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    const panelEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    const canvasDispatch = canvas.dispatchEvent(canvasEvent);
    const panelDispatch = panel.dispatchEvent(panelEvent);
    return { canvasPrevented: canvasEvent.defaultPrevented, canvasDispatch, panelPrevented: panelEvent.defaultPrevented, panelDispatch };
  });
  assert(contextScope.canvasPrevented && !contextScope.canvasDispatch, `${width}: canvas context menu was not prevented`);
  assert(!contextScope.panelPrevented && contextScope.panelDispatch, `${width}: context-menu prevention leaked into the HUD`);

  await page.locator('#ui .rv-inspector .rv-icon').click();
  const canvas = page.locator('#game canvas');
  const box = await canvas.boundingBox();
  const startX = Math.round(width * 0.58), startY = Math.round(height * 0.46);
  const before = await page.evaluate(() => {
    const scene = window.__RAIL.view.__scene;
    return { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, following: window.__RAIL.view.isFollowing() };
  });
  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(startX - 150, startY + 55, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const scene = window.__RAIL.view.__scene;
    return { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, following: window.__RAIL.view.isFollowing() };
  });
  const cameraDelta = Math.hypot(after.x - before.x, after.y - before.y);
  assert(box && cameraDelta > 20, `${width}: right-drag did not move the camera (${cameraDelta.toFixed(1)}px)`);
  assert(after.following === false, `${width}: right-drag did not release follow-camera mode`);
  assert(pageErrors.length === 0, `${width}: page errors: ${pageErrors.join(' | ')}`);

  results.push({ viewport: `${width}x${height}`, inspector, contextScope, camera: { before, after, delta: cameraDelta }, pageErrors });
  await page.close();
}

await browser.close();
const report = { pass: failures.length === 0, failures, results };
fs.writeFileSync(path.resolve('verify/inspector-pan-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
