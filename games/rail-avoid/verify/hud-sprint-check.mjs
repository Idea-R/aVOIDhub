#!/usr/bin/env node
/** Focused command-deck check for resources, authored rolling stock, responsive layout, and crew posting. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const base = opt('url', 'http://127.0.0.1:5178/RAILaVOID');
const out = path.resolve('verify/screenshots/sprint-04');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const failures = [];
const results = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

async function start(page) {
  await page.goto(`${base}/?dev`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
  await page.evaluate(() => window.__RAIL.ctx.settings.setMeta({ introSeen: true }));
  await page.evaluate(() => window.__RAIL.newRun(12345));
  await page.waitForFunction(() => window.__RAIL.state.phase === 'running', null, { timeout: 15000 });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(300);
    const playing = await page.evaluate(() => !!window.__RAIL.view?.isCinematicPlaying());
    if (!playing) break;
    await page.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
  }
  await page.waitForFunction(() => !window.__RAIL.view?.isCinematicPlaying(), null, { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__RAIL.stepSim(2); window.__RAIL.pause(); });
  await page.waitForTimeout(900);
}

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await start(page);

const initial = await page.evaluate(() => {
  const resources = [...document.querySelectorAll('#ui .rv-chip[data-key]')];
  const cars = [...document.querySelectorAll('#ui .rv-car')];
  const px = (node, prop) => parseFloat(getComputedStyle(node)[prop]);
  const artSignature = node => {
    const src = node?.getAttribute('src') || '';
    let hash = 2166136261;
    for (let i = 0; i < src.length; i++) hash = Math.imul(hash ^ src.charCodeAt(i), 16777619);
    return `${src.length}:${hash >>> 0}`;
  };
  const gatlingArt = document.querySelector('#ui .rv-car-type-gatling .rv-car-art');
  return {
    resourceCount: resources.length,
    resourceLabels: resources.map(n => n.querySelector('.rv-chip-k')?.textContent?.trim()),
    resourceValueFont: resources.map(n => px(n.querySelector('.rv-chip-v'), 'fontSize')),
    resourceLabelFont: resources.map(n => px(n.querySelector('.rv-chip-k'), 'fontSize')),
    resourceBars: resources.filter(n => n.querySelector('.rv-chip-bar i')).length,
    carCount: cars.length,
    namedCars: cars.filter(n => n.querySelector('.rv-car-name')?.textContent?.trim()).length,
    authoredArtCount: cars.filter(n => n.querySelector('.rv-car-art')).length,
    loadedArtCount: cars.filter(n => { const img = n.querySelector('.rv-car-art'); return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0; }).length,
    artSources: cars.map(n => { const src = n.querySelector('.rv-car-art')?.getAttribute('src') || ''; return src.startsWith('data:') ? `embedded-webp:${src.length}` : src; }),
    gatlingArtSignature: artSignature(gatlingArt),
    hullRows: cars.filter(n => /Hull/i.test(n.querySelector('.rv-car-hull .rv-car-meter-label')?.textContent || '')).length,
    heatRows: cars.filter(n => /(Heat|Thermal)/i.test(n.querySelector('.rv-car-thermal .rv-car-meter-label')?.textContent || '')).length,
  };
});
assert(initial.resourceCount === 5, `expected 5 resource cards, got ${initial.resourceCount}`);
assert(initial.resourceLabels.join(',') === 'Rails,Scrap,Coal,Ammo,Food', `resource labels missing: ${initial.resourceLabels.join(',')}`);
assert(initial.resourceBars === 5, `expected 5 resource capacity bars, got ${initial.resourceBars}`);
assert(initial.resourceValueFont.every(n => n >= 16), `resource values below 16px: ${initial.resourceValueFont.join(',')}`);
assert(initial.resourceLabelFont.every(n => n >= 9.5), `resource labels below 9.5px: ${initial.resourceLabelFont.join(',')}`);
assert(initial.carCount >= 2 && initial.namedCars === initial.carCount, 'every train card must have a visible name');
assert(initial.authoredArtCount >= 6, `expected authored art for the six-car starter consist, got ${initial.authoredArtCount}`);
assert(initial.loadedArtCount === initial.authoredArtCount, `only ${initial.loadedArtCount}/${initial.authoredArtCount} authored car images loaded`);
assert(initial.artSources.filter(Boolean).every(src => /(?:\/art\/cars\/.+\.webp|\/assets\/.+\.webp|^embedded-webp:)/.test(src)), `unexpected rolling-stock art source: ${initial.artSources.join(',')}`);
assert(initial.hullRows === initial.carCount && initial.heatRows === initial.carCount, 'every train card must label hull and heat');

// Newly authored specialist cars must be wired into real cards, not only present on disk.
await page.evaluate(() => ['flak', 'cannon', 'radiator', 'medical'].forEach(type => window.__RAIL.addCar(type)));
await page.waitForFunction(() => ['flak', 'cannon', 'radiator', 'medical'].every(type => {
  const img = document.querySelector(`#ui .rv-car-type-${type} .rv-car-art`);
  return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
}), null, { timeout: 8000 });
const specialistArt = await page.evaluate(() => ['flak', 'cannon', 'radiator', 'medical'].map(type => ({
  type,
  loaded: (() => { const img = document.querySelector(`#ui .rv-car-type-${type} .rv-car-art`); return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0; })(),
  source: (() => { const src = document.querySelector(`#ui .rv-car-type-${type} .rv-car-art`)?.getAttribute('src') || ''; return src.startsWith('data:') ? `embedded-webp:${src.length}` : src; })(),
})));
assert(specialistArt.every(x => x.loaded && x.source), `specialist rolling-stock art missing: ${JSON.stringify(specialistArt)}`);

// Authored art must follow the upgrade state without requiring a new run.
await page.evaluate(() => {
  const carIndex = window.__RAIL.state.train.cars.findIndex(c => c.type === 'gatling');
  const gatling = window.__RAIL.state.train.cars[carIndex];
  if (gatling) {
    gatling.level = 3;
    window.__RAIL.ctx.bus.emit('car:upgraded', { carIndex, level: 3 });
  }
});
await page.waitForFunction((initialSignature) => {
  const art = document.querySelector('#ui .rv-car-type-gatling .rv-car-art');
  if (!(art instanceof HTMLImageElement) || !art.complete || art.naturalWidth <= 0) return false;
  const src = art.getAttribute('src') || '';
  let hash = 2166136261;
  for (let i = 0; i < src.length; i++) hash = Math.imul(hash ^ src.charCodeAt(i), 16777619);
  return `${src.length}:${hash >>> 0}` !== initialSignature;
}, initial.gatlingArtSignature, { timeout: 5000 });
const upgradeArt = await page.evaluate(() => {
  const src = document.querySelector('#ui .rv-car-type-gatling .rv-car-art')?.getAttribute('src') || '';
  let hash = 2166136261;
  for (let i = 0; i < src.length; i++) hash = Math.imul(hash ^ src.charCodeAt(i), 16777619);
  return `${src.length}:${hash >>> 0}`;
});
assert(upgradeArt !== initial.gatlingArtSignature, `level III Gatling did not switch authored variants: ${upgradeArt}`);

await page.evaluate(() => {
  const s = window.__RAIL.state;
  s.train.crew = s.train.crew.filter(c => c.id !== 'verify-engineer');
  s.train.crew.push({ id: 'verify-engineer', name: 'Mara Voss', specialty: 'engineer', carIndex: -1, hp: 92 });
  window.__RAIL.ctx.bus.emit('crew:joined', { specialty: 'engineer', name: 'Mara Voss' });
});
await page.waitForFunction(() => {
  const b = document.querySelector('#ui .rv-crew-ready');
  return b && !b.hidden && /crew ready/i.test(b.textContent || '');
}, null, { timeout: 10000 });
await page.locator('#ui .rv-crew-ready').click();
await page.waitForFunction(() => {
  const panel = document.querySelector('#ui .rv-inspector');
  return panel && !panel.hidden && document.querySelector('#ui .rv-crew-choice');
}, null, { timeout: 5000 });
await page.waitForFunction(() => document.activeElement?.classList.contains('rv-crew-choice'), null, { timeout: 3000 });

const posting = await page.evaluate(() => {
  const choice = document.querySelector('#ui .rv-crew-choice');
  const panel = document.querySelector('#ui .rv-inspector');
  return {
    choiceText: choice?.textContent?.replace(/\s+/g, ' ').trim() || '',
    choiceTag: choice?.tagName || '',
    choiceAria: choice?.getAttribute('aria-label') || '',
    inspectorVisible: !!panel && !panel.hidden,
    focusedChoice: document.activeElement === choice,
    selectedCar: window.__RAIL.view.getSelectedCar(),
  };
});
assert(posting.inspectorVisible, 'crew callout did not open the inspector');
assert(posting.choiceTag === 'BUTTON', `crew choice is not a button: ${posting.choiceTag}`);
assert(/Mara Voss/.test(posting.choiceText) && /Engineer/i.test(posting.choiceText), `crew choice lacks identity: ${posting.choiceText}`);
assert(/Post Mara Voss/.test(posting.choiceAria), `crew choice lacks action aria label: ${posting.choiceAria}`);
assert(posting.focusedChoice, 'crew callout did not move keyboard focus to the posting choice');
assert(posting.selectedCar > 0, `crew callout selected invalid car ${posting.selectedCar}`);

await page.locator('#ui .rv-crew-choice').click();
await page.waitForFunction(() => window.__RAIL.state.train.crew.find(c => c.id === 'verify-engineer')?.carIndex >= 0, null, { timeout: 5000 });
await page.waitForTimeout(350);
const assigned = await page.evaluate(() => {
  const crew = window.__RAIL.state.train.crew.find(c => c.id === 'verify-engineer');
  const card = crew ? document.querySelector(`#ui .rv-car[data-i="${crew.carIndex}"]`) : null;
  return {
    carIndex: crew?.carIndex ?? -1,
    cardCrew: card?.querySelector('.rv-crewb')?.textContent?.trim() || '',
    stillReady: !document.querySelector('#ui .rv-crew-ready')?.hidden,
  };
});
assert(assigned.carIndex > 0, `crew was not posted: ${assigned.carIndex}`);
assert(/Mara/i.test(assigned.cardCrew), `posted crew is not visible on train card: ${assigned.cardCrew}`);
assert(!assigned.stillReady, 'crew-ready callout remained after the last specialist was posted');
await page.screenshot({ path: path.join(out, 'hud_1920x1080_assigned.png') });
results.push({ viewport: '1920x1080', initial, specialistArt, upgradeArt, posting, assigned });
await page.close();

for (const [width, height] of [[1366, 768], [1280, 720], [800, 600]]) {
  const p = await browser.newPage({ viewport: { width, height } });
  p.on('pageerror', e => pageErrors.push(e.message));
  await start(p);
  const layout = await p.evaluate(() => {
    const rect = sel => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const top = rect('#ui .rv-hud-top');
    const strip = rect('#ui .rv-strip');
    const resourceLabelsVisible = [...document.querySelectorAll('#ui .rv-chip[data-key] .rv-chip-k')].filter(n => getComputedStyle(n).display !== 'none').length;
    return { top, strip, resourceLabelsVisible, vw: innerWidth, vh: innerHeight };
  });
  assert(layout.top && layout.top.left >= -1 && layout.top.right <= width + 1, `${width} top bar leaves viewport`);
  assert(layout.strip && layout.strip.left >= -1 && layout.strip.right <= width + 1 && layout.strip.bottom <= height + 1, `${width} train strip leaves viewport`);
  if (width >= 1366) assert(layout.resourceLabelsVisible === 5, `${width} hides resource names`);
  await p.screenshot({ path: path.join(out, `hud_${width}x${height}.png`) });
  results.push({ viewport: `${width}x${height}`, layout });
  await p.close();
}

assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
await browser.close();
const report = { pass: failures.length === 0, failures, pageErrors, results };
fs.writeFileSync(path.resolve('verify/hud-sprint-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
