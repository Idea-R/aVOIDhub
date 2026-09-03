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
const pass = r.ready && r.view && r.phase === 'running' && r.authoredArt >= 6 && r.loadedArt === r.authoredArt && r.embeddedArt === r.authoredArt && errs.length === 0;
console.log(JSON.stringify({ ...r, pass, ignoredAudioFallbacks: ignored.length, errs: errs.slice(0, 5) }));
await p.screenshot({ path: path.join(screenshotDir, 'standalone.png') });
await b.close();
if (!pass) process.exitCode = 1;
