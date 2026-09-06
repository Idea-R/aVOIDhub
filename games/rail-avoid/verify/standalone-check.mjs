import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screenshotDir = path.join(root, 'verify', 'screenshots');
await mkdir(screenshotDir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
const ignored = [];
p.on('pageerror', e => errs.push(String(e.message)));
p.on('console', m => {
  if (m.type() !== 'error') return;
  const message = m.text();
  // Audio intentionally falls back to the procedural score when file:// cannot fetch its optional manifest.
  if (/Fetch API cannot load file:.*\/audio\/manifest\.json/i.test(message)) ignored.push(message);
  else errs.push(message);
});
await p.goto(pathToFileURL(path.join(root, 'dist-standalone', 'railavoid.html')).href);
await p.waitForFunction(() => window.__RAIL?.ready && window.__RAIL?.view, null, { timeout: 30000 });
await p.evaluate(() => {
  window.__RAIL.ctx.settings.setMeta({ introSeen: true });
  window.__RAIL.newRun(12345);
});
// A standalone load can create the renderer a beat after the app object; repeatedly
// issue the best-effort skip so the screenshot settles without making this a cinematic test.
for (let i = 0; i < 10; i++) {
  await p.waitForTimeout(300);
  const playing = await p.evaluate(() => !!window.__RAIL.view?.isCinematicPlaying());
  if (playing) await p.evaluate(() => { try { window.__RAIL.view.skipCinematic(); } catch {} });
}
await p.waitForFunction(() => document.querySelectorAll('#ui .rv-car-art').length >= 6, null, { timeout: 15000 });
await p.waitForFunction(() => [...document.querySelectorAll('#ui .rv-car-art')].every(img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
const r = await p.evaluate(() => {
  const art = [...document.querySelectorAll('#ui .rv-car-art')];
  return {
    ready: !!window.__RAIL?.ready,
    view: !!window.__RAIL?.view,
    phase: window.__RAIL?.state.phase,
    authoredArt: art.length,
    loadedArt: art.filter(img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0).length,
    embeddedArt: art.filter(img => img instanceof HTMLImageElement && img.src.startsWith('data:image/webp')).length,
  };
});
await p.screenshot({ path: path.join(screenshotDir, 'standalone.png') });
// The new location scene, portrait and authored frame must also work offline.
await p.evaluate(() => window.__RAIL.triggerEvent('node_crossroads'));
await p.waitForFunction(() => {
  const box = document.querySelector('#ui .rv-conversation');
  return box && !box.closest('[hidden]') && [...box.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0);
}, null, { timeout: 15000 });
const conversation = await p.evaluate(() => {
  const box = document.querySelector('#ui .rv-conversation');
  return {
    choices: box.querySelectorAll('.rv-option').length,
    imagesEmbedded: [...box.querySelectorAll('img')].every(img => img.src.startsWith('data:image/')),
    frameEmbedded: getComputedStyle(box).borderImageSource.includes('data:image/'),
  };
});
await p.locator('#ui .rv-conversation .rv-option').first().click();
await p.waitForFunction(() => document.querySelector('#ui .rv-conversation')?.dataset.dialogueStep === 'briefing');
await p.screenshot({ path: path.join(screenshotDir, 'standalone-conversation.png') });
// Shared-rule intent and explicit swaps must also work with no server.
await p.evaluate(() => {
  const R = window.__RAIL;
  R.ctx.settings.set({ reducedMotion: true, showTutorial: false });
  R.newRun(12345); R.state.region = 3;
  R.state.train.crew.push(
    { id: 'offline-gunner', name: 'Nils', specialty: 'gunner', hp: 100, carIndex: -1 },
    { id: 'offline-medic', name: 'Ines', specialty: 'medic', hp: 100, carIndex: -1 },
  );
  R.sim.startExpedition(R.state.train.crew.map(c => c.id));
});
await p.locator('.rv-exp-menu').waitFor({ state: 'visible' });
const intents = await p.locator('.rv-exp-intent').allTextContents();
await p.keyboard.press('w');
await p.locator('.rv-exp-swap-overlay').waitFor({ state: 'visible' });
const swap = await p.locator('.rv-exp-swap-card').evaluate(n => ({ choices: n.querySelectorAll('.rv-exp-swap-choice').length, frameEmbedded: getComputedStyle(n).borderImageSource.includes('data:image/') }));
await p.screenshot({ path: path.join(screenshotDir, 'standalone-swap.png') });
await p.keyboard.press('2');
await p.waitForFunction(() => window.__RAIL.state.expedition.activeActor === 1 && !window.__RAIL.state.expedition.pending);
const formation = await p.evaluate(() => window.__RAIL.state.expedition.actors.map(a => a.position).join());
const combat = { intents, ...swap, formation };
const pass = r.ready && r.view && r.phase === 'running' && r.authoredArt >= 6 && r.loadedArt === r.authoredArt && r.embeddedArt === r.authoredArt && conversation.choices === 3 && conversation.imagesEmbedded && conversation.frameEmbedded && intents.join('|') === '1 × 10 damage|2 × 6 damage' && swap.choices === 2 && swap.frameEmbedded && formation === 'rear,middle,front' && errs.length === 0;
console.log(JSON.stringify({ ...r, conversation, combat, pass, ignoredAudioFallbacks: ignored.length, errs: errs.slice(0, 5) }));
await b.close();
if (!pass) process.exitCode = 1;
