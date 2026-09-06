#!/usr/bin/env node
/** Focused gate for staged Away Team combat, scene art, formation and enemy identity. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const arg = process.argv.find(v => v.startsWith('--url='));
const base = arg ? arg.slice(6) : 'http://127.0.0.1:5178/RAILaVOID';
const out = path.resolve('verify/screenshots/sprint-05');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const errors = [];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const enemyAssets = [
  'rail-thug-v3.webp', 'void-hound-v3.webp', 'void-shade-v3.webp', 'scrap-brute-v3.webp',
  'ash-cult-fusilier-v3.webp', 'rail-maw-crawler-v3.webp', 'lantern-wraith-v3.webp', 'iron-sentinel-v3.webp',
];

for (const filename of enemyAssets) {
  const source = path.join(packageRoot, 'public', 'art', 'enemies', filename);
  const image = sharp(source);
  const metadata = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[((y * info.width + x) * info.channels) + 3];
  const corners = [alphaAt(0, 0), alphaAt(info.width - 1, 0), alphaAt(0, info.height - 1), alphaAt(info.width - 1, info.height - 1)];
  assert(metadata.width === 480 && metadata.height === 600, `${filename} is not 480x600 (${metadata.width}x${metadata.height})`);
  assert(metadata.hasAlpha === true, `${filename} has no real alpha channel`);
  assert(corners.every(alpha => alpha === 0), `${filename} has an opaque canvas corner (${corners.join(',')})`);
}

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
  R.ctx.settings.set({ showTutorial: false, quality: 'high', uiScale: 0.75 });
  R.newRun(50505);
  R.state.train.crew.push(
    { id: 'verify-gunner', name: 'Nils', specialty: 'gunner', carIndex: -1, hp: 100 },
    { id: 'verify-medic', name: 'Ines', specialty: 'medic', carIndex: -1, hp: 100 },
  );
});
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(200);
  if (await page.evaluate(() => !!window.__RAIL.view?.isCinematicPlaying())) await page.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
}
const mysteryScenes = ['mystery_cache', 'mystery_away', 'mystery_ambush', 'mystery_survivor', 'mystery_weapon', 'mystery_dock'];
for (const eventId of mysteryScenes) {
  await page.evaluate(id => window.__RAIL.sim.debug.triggerEvent(id), eventId);
  await page.waitForFunction(id => {
    const img = document.querySelector('#ui .rv-event-scene img');
    return img?.complete && img.getAttribute('data-scene') === id;
  }, eventId, { timeout: 5000 });
  await page.waitForTimeout(1300);
  const eventScene = await page.evaluate(() => {
    const img = document.querySelector('#ui .rv-event-scene img');
    const card = document.querySelector('#ui .rv-event');
    const choices = [...document.querySelectorAll('#ui .rv-event .rv-option')];
    const c = card?.getBoundingClientRect();
    return {
      id: img?.getAttribute('data-scene') ?? '',
      visible: !!img && getComputedStyle(img).display !== 'none',
      natural: [img?.naturalWidth ?? 0, img?.naturalHeight ?? 0],
      choices: choices.length,
      choicesVisible: choices.every(choice => {
        const r = choice.getBoundingClientRect();
        return !!c && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 && r.left >= c.left - 1 && r.right <= c.right + 1;
      }),
    };
  });
  assert(eventScene.id === eventId && eventScene.visible && eventScene.natural[0] === 1600 && eventScene.natural[1] === 900, `encounter establishing art missing (${JSON.stringify(eventScene)})`);
  assert(eventScene.choices >= 3 && eventScene.choicesVisible, `encounter choices are clipped (${JSON.stringify(eventScene)})`);
  if (eventId === 'mystery_cache' || eventId === 'mystery_dock') {
    await page.screenshot({ path: path.join(out, `event-${eventId}-1280x720.png`) });
  }
  await page.evaluate(() => window.__RAIL.sim.chooseEventOption(2));
}
await page.evaluate(() => window.__RAIL.sim.debug.startExpedition());
await page.waitForFunction(() => [...document.querySelectorAll('#ui .rv-exp-fig-enemy img, #ui .rv-exp-scene-art')].every(x => x.complete), null, { timeout: 10000 });
await page.waitForTimeout(1000);

const first = await page.evaluate(() => {
  const root = document.querySelector('#ui .rv-exp');
  const scene = document.querySelector('#ui .rv-exp-scene-art');
  const foe = document.querySelector('#ui .rv-exp-fig-enemy img');
  const conductor = document.querySelector('#ui .rv-exp-fig-authored img');
  const menu = document.querySelector('#ui .rv-exp-menu');
    const m = menu?.getBoundingClientRect();
  return {
    phase: window.__RAIL.state.phase,
    stage: window.__RAIL.state.expedition?.stage,
    positions: window.__RAIL.state.expedition?.actors.map(a => a.position),
    enemyPortraits: document.querySelectorAll('#ui .rv-exp-fig-enemy img').length,
    scene: [scene?.naturalWidth ?? 0, scene?.naturalHeight ?? 0, scene?.getAttribute('data-scene') ?? ''],
    foe: [foe?.naturalWidth ?? 0, foe?.naturalHeight ?? 0],
    conductor: [conductor?.naturalWidth ?? 0, conductor?.naturalHeight ?? 0],
    bounds: m ? [m.left, m.top, m.right, m.bottom] : null,
    inBounds: !!m && m.left >= -1 && m.right <= innerWidth + 1 && m.top >= -1 && m.bottom <= innerHeight + 1,
  };
});
console.log('expedition-stage-one', JSON.stringify(first));
assert(first.phase === 'expedition' && first.stage === 1, 'deterministic expedition fixture did not open stage one');
assert(first.positions?.join(',') === 'front,middle,rear', `formation did not initialize front/middle/rear (${first.positions})`);
assert(first.enemyPortraits >= 1 && first.foe[0] === 480 && first.foe[1] === 600, `authored enemy portrait missing or wrong size (${first.foe})`);
assert(first.scene[0] === 1600 && first.scene[1] === 900, `authored scene missing or wrong size (${first.scene.slice(0, 2)})`);
assert(first.conductor[0] >= 768 && first.conductor[1] >= 1024, `conductor combat art is undersized (${first.conductor})`);
assert(first.inBounds, 'expedition action deck overflows the 1280x720 viewport');
await page.screenshot({ path: path.join(out, 'stage-1-formation-1280x720.png') });

const swapped = await page.evaluate(() => {
  const R = window.__RAIL;
  R.sim.expeditionAction('swap', undefined, 1);
  R.sim.expeditionResolve('good');
  return R.state.expedition.actors.map(a => a.position);
});
assert(swapped.join(',') === 'middle,front,rear', `swap did not exchange formation positions (${swapped})`);

let guard = 0;
while (guard++ < 80) {
  const state = await page.evaluate(() => {
    const R = window.__RAIL; const x = R.state.expedition;
    if (x.awaitingAdvance) return 'gate';
    if (x.pending) R.sim.expeditionResolve('perfect');
    else if (x.turn === 'player') R.sim.expeditionAction('strike');
    return 'fight';
  });
  if (state === 'gate') break;
  await page.waitForTimeout(25);
}
await page.waitForFunction(() => document.querySelector('#ui .rv-exp-stage-gate:not([hidden])'), null, { timeout: 5000 });
assert(await page.getByRole('button', { name: /Continue to Buried Concourse/ }).isVisible(), 'stage-clear risk choice is not visible');
await page.screenshot({ path: path.join(out, 'stage-clear-choice-1280x720.png') });

const firstScene = first.scene[2];
await page.getByRole('button', { name: /Continue to Buried Concourse/ }).click();
await page.waitForFunction(() => window.__RAIL.state.expedition?.stage === 2 && document.querySelector('#ui .rv-exp-scene-art')?.complete, null, { timeout: 5000 });
await page.waitForTimeout(1100);
const second = await page.evaluate(() => ({
  stage: window.__RAIL.state.expedition?.stage,
  name: document.querySelector('#ui .rv-exp-stage-name')?.textContent,
  scene: document.querySelector('#ui .rv-exp-scene-art')?.getAttribute('data-scene'),
  enemyPortraits: document.querySelectorAll('#ui .rv-exp-fig-enemy img').length,
}));
console.log('expedition-stage-two', JSON.stringify(second));
assert(second.stage === 2 && second.name === 'Buried Concourse', `stage two did not identify the Buried Concourse (${JSON.stringify(second)})`);
assert(second.scene && second.scene !== firstScene, 'stage transition did not change the scene backplate');
assert(second.enemyPortraits >= 1, 'stage two has no authored enemy portrait');
await page.screenshot({ path: path.join(out, 'stage-2-buried-concourse-1280x720.png') });

assert(errors.length === 0, `browser errors: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();

if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS clean mystery scenes, alpha enemy art, formation, swap, depth choice and 1280x720 fit');
