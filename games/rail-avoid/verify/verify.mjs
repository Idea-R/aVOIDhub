#!/usr/bin/env node
/**
 * RAILaVOID verification harness.
 *
 *   npm run verify                 build, serve dist with `vite preview`, run every gate
 *   node verify/verify.mjs --dev   connect to a running dev server (VERIFY_URL or http://localhost:5173)
 *   node verify/verify.mjs --url=http://host:port   connect to any URL (no build)
 *   node verify/verify.mjs --no-build               skip `npm run build` (still serves dist/)
 *   node verify/verify.mjs --headed                 show the browser
 *   node verify/verify.mjs --help
 *
 * Writes verify/report.json, verify/report.md and verify/screenshots/*.png.
 * Exit code 1 when any gate (other than perf_headless_note) fails or console errors were seen.
 * Only node built-ins + playwright + pngjs are used.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ args
const argv = process.argv.slice(2);
const flag = (name) => argv.includes('--' + name);
const opt = (name, def) => {
  const hit = argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
};

if (flag('help') || flag('h')) {
  console.log(`RAILaVOID verify harness
usage: node verify/verify.mjs [--dev] [--url=URL] [--no-build] [--headed] [--seed=12345] [--port=4173]

  --dev        connect to VERIFY_URL or http://localhost:5173 (no build, no preview server)
  --url=URL    connect to URL (no build, no preview server)
  --no-build   skip 'npm run build' but still serve dist/ with vite preview
  --headed     run Chromium with a window
  --seed=N     run seed (default 12345 = TEST_SEED)
  --port=N     preview port (default 4173)
  --help       this text`);
  process.exit(0);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY_DIR = path.join(ROOT, 'verify');
const SHOT_DIR = path.join(VERIFY_DIR, 'screenshots');
const PORT = parseInt(opt('port', '4173'), 10);
const SEED = parseInt(opt('seed', '12345'), 10);
const HEADED = flag('headed');
const DEV = flag('dev');
const EXPLICIT_URL = opt('url', null) || (DEV ? (process.env.VERIFY_URL || 'http://localhost:5173') : null);
const BASE_URL = EXPLICIT_URL || `http://localhost:${PORT}`;
const PAGE_URL = BASE_URL + (BASE_URL.includes('?') ? '&dev' : '/?dev');
const NO_BUILD = flag('no-build') || !!EXPLICIT_URL;

// console noise that headless SwiftShader / Chromium emit and that is not a game bug
const IGNORED_CONSOLE = [
  /GroupMarkerNotSet/i,
  /GPU stall due to ReadPixels/i,
  /Automatic fallback to software WebGL/i,
  /WebGL: INVALID_/i,
  /AudioContext was not allowed to start/i,
];

// ------------------------------------------------------------------ report state
const report = {
  timestamp: new Date().toISOString(),
  url: PAGE_URL,
  node: process.version,
  headless: !HEADED,
  gates: [],
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
  perf: null,
  summary: null,
  autopilotStatus: null,
  build: null,
};

const log = (...a) => console.log('[verify]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  let timer;
  const t = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timeout after ${ms} ms (${label})`)), ms); });
  return Promise.race([promise.finally(() => clearTimeout(timer)), t]);
}

/** Run a gate: never throws, always records. fn(g) may call g.note()/g.fail(); a thrown error fails the gate. */
async function gate(name, fn, timeoutMs = 60000) {
  const g = { name, pass: true, details: '', screenshot: null, ms: 0, notes: [] };
  g.note = (s) => { g.notes.push(String(s)); };
  g.fail = (s) => { g.pass = false; g.notes.push('FAIL: ' + s); };
  g.assert = (cond, s) => { if (!cond) g.fail(s); return !!cond; };
  const t0 = Date.now();
  log(`gate ${name} ...`);
  try {
    await withTimeout(Promise.resolve().then(() => fn(g)), timeoutMs, name);
  } catch (e) {
    g.pass = false;
    g.notes.push('ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e)));
  }
  g.ms = Date.now() - t0;
  g.details = g.notes.join('; ');
  delete g.note; delete g.fail; delete g.assert; delete g.notes;
  report.gates.push(g);
  log(`gate ${name}: ${g.pass ? 'PASS' : 'FAIL'} (${g.ms} ms) ${g.details}`);
  return g;
}

// ------------------------------------------------------------------ build + server
function runBuild() {
  log('npm run build');
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  report.build = { status: r.status, output: out.slice(-20000) };
  if (r.status !== 0) {
    log('build FAILED');
    console.log(out.slice(-4000));
    return false;
  }
  return true;
}

let server = null;
function startPreview() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  server.stdout.on('data', d => { buf += d; });
  server.stderr.on('data', d => { buf += d; });
  server.on('exit', code => { if (code && code !== 0) log('preview server exited with', code, buf.slice(-500)); });
  server.getLog = () => buf;
}
function stopPreview() {
  if (!server) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill('SIGTERM');
  } catch { /* ignore */ }
  server = null;
}
function httpOk(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(res.statusCode && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}
async function waitForServer(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await httpOk(url)) return true;
    await sleep(250);
  }
  return false;
}

// ------------------------------------------------------------------ page helpers
/** Evaluate `fn(R, arg)` in the page where R = window.__RAIL. `fn` must be self-contained. */
async function evalRail(page, fn, arg) {
  return page.evaluate(([src, a]) => {
    // eslint-disable-next-line no-new-func
    const f = new Function('return (' + src + ')')();
    return f(window.__RAIL, a);
  }, [fn.toString(), arg === undefined ? null : arg]);
}
/** Poll `pred(R, arg)` in the page until truthy. Returns the truthy value or false on timeout. */
async function pollRail(page, pred, timeoutMs, arg, intervalMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    let v = false;
    try { v = await evalRail(page, pred, arg); } catch { v = false; }
    if (v) return v;
    await sleep(intervalMs);
  }
  return false;
}
async function railReady(page) {
  try { return await page.evaluate(() => !!(window.__RAIL && window.__RAIL.ready)); } catch { return false; }
}
async function requireRail(page, g) {
  if (!(await railReady(page))) { g.fail('app not booted (window.__RAIL missing)'); return false; }
  return true;
}
const shots = [];
async function shot(page, name, g) {
  try {
    const file = path.join(SHOT_DIR, name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    shots.push({ name, file });
    if (g && !g.screenshot) g.screenshot = path.relative(ROOT, file).replace(/\\/g, '/');
    return file;
  } catch (e) {
    if (g) g.note('screenshot ' + name + ' failed: ' + (e && e.message));
    return null;
  }
}
async function phase(page) { return evalRail(page, R => R.state.phase); }
/** Make sure a run is in progress (phase running); starts a fresh seeded run when needed. */
async function ensureRunning(page, g, autopilot = true) {
  const ph = await phase(page);
  if (ph === 'running' || ph === 'shop' || ph === 'event') return true;
  await evalRail(page, (R, seed) => { R.newRun(seed); }, SEED);
  const ok = await pollRail(page, R => R.state.phase === 'running', 15000);
  if (!ok) { g.fail('could not start a run (phase=' + (await phase(page)) + ')'); return false; }
  if (autopilot) await evalRail(page, R => { R.autopilot.setEnabled(true); });
  return true;
}
/** (Re)subscribe event counters on the shared bus; stored on window.__RAIL_COUNTERS. */
async function installCounters(page) {
  await evalRail(page, R => {
    const w = window;
    if (w.__RAIL_UNSUB) { try { w.__RAIL_UNSUB.forEach(f => f()); } catch { /* ignore */ } }
    w.__RAIL_COUNTERS = { fire: 0, spawn: 0, died: 0, bossSpawn: 0, bossDied: 0, damage: 0 };
    const c = w.__RAIL_COUNTERS;
    w.__RAIL_UNSUB = [
      R.ctx.bus.on('weapon:fire', () => { c.fire++; }),
      R.ctx.bus.on('enemy:spawn', () => { c.spawn++; }),
      R.ctx.bus.on('enemy:died', () => { c.died++; }),
      R.ctx.bus.on('boss:spawn', () => { c.bossSpawn++; }),
      R.ctx.bus.on('boss:died', () => { c.bossDied++; }),
      R.ctx.bus.on('train:damage', () => { c.damage++; }),
    ];
  });
}
const counters = (page) => page.evaluate(() => window.__RAIL_COUNTERS || null);

// ------------------------------------------------------------------ PNG stats (pngjs)
async function pngStats(file) {
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width, height, data } = png;
  let sum = 0, sum2 = 0;
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 400000)); // sample up to ~400k px
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    const l = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
    sum += l; sum2 += l * l; count++;
  }
  const mean = sum / count;
  const std = Math.sqrt(Math.max(0, sum2 / count - mean * mean));
  return { width, height, mean: +mean.toFixed(2), std: +std.toFixed(2) };
}

// ------------------------------------------------------------------ main
let browser = null;
let exiting = false;
async function cleanup() {
  if (exiting) return;
  exiting = true;
  try { if (browser) await browser.close(); } catch { /* ignore */ }
  stopPreview();
}
process.on('SIGINT', async () => { log('SIGINT'); await cleanup(); process.exit(130); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  for (const f of fs.readdirSync(SHOT_DIR)) if (f.endsWith('.png')) fs.rmSync(path.join(SHOT_DIR, f), { force: true });

  // 1. build + serve
  if (!NO_BUILD) {
    const ok = runBuild();
    if (!ok) {
      report.gates.push({ name: 'build', pass: false, details: 'npm run build failed - see build.output in report.json', screenshot: null, ms: 0 });
      return;
    }
    report.gates.push({ name: 'build', pass: true, details: 'npm run build ok', screenshot: null, ms: 0 });
  }
  if (!EXPLICIT_URL) {
    startPreview();
    const up = await waitForServer(BASE_URL + '/', 30000);
    if (!up) {
      report.gates.push({ name: 'server', pass: false, details: 'vite preview did not answer on ' + BASE_URL + ' : ' + (server ? server.getLog().slice(-500) : ''), screenshot: null, ms: 0 });
      return;
    }
  } else if (!(await waitForServer(BASE_URL, 15000))) {
    report.gates.push({ name: 'server', pass: false, details: 'nothing answering at ' + BASE_URL, screenshot: null, ms: 0 });
    return;
  }

  // 2. browser
  let page;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: !HEADED,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page = await context.newPage();
  } catch (e) {
    report.gates.push({ name: 'browser', pass: false, details: 'chromium launch failed: ' + (e && e.message) + ' (try: npx playwright install chromium)', screenshot: null, ms: 0 });
    return;
  }
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (IGNORED_CONSOLE.some(re => re.test(text))) return;
    if (type === 'error') report.consoleErrors.push(text);
    else if (type === 'warning') report.consoleWarnings.push(text);
  });
  page.on('pageerror', err => { report.pageErrors.push((err && err.stack) || String(err)); });
  page.on('requestfailed', req => { report.failedRequests.push({ url: req.url(), error: (req.failure() || {}).errorText || 'failed' }); });
  page.on('response', res => { if (res.status() >= 400) report.failedRequests.push({ url: res.url(), status: res.status() }); });
  const errorCount = () => report.consoleErrors.length + report.pageErrors.length;

  // 3. gates -----------------------------------------------------------------
  await gate('boot', async (g) => {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
    const ready = await pollRail(page, () => true, 20000); // pollRail only succeeds once __RAIL exists
    if (!g.assert(ready && await railReady(page), 'window.__RAIL.ready not set within 20 s')) {
      const title = await page.title().catch(() => '');
      g.note(`document.title=${JSON.stringify(title)} pageErrors=${report.pageErrors.length} consoleErrors=${report.consoleErrors.length}`);
      await shot(page, 'title', g);
      return;
    }
    const bootHidden = await (async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 8000) {
        const hidden = await page.evaluate(() => {
          const b = document.getElementById('boot');
          if (!b || !b.isConnected) return true;
          const cs = getComputedStyle(b);
          return b.hidden || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0;
        });
        if (hidden) return true;
        await sleep(200);
      }
      return false;
    })();
    g.assert(bootHidden, '#boot overlay still visible after ready');
    const v = await evalRail(page, R => ({ version: R.version, dev: !!window.__RAIL_DEV, phase: R.state && R.state.phase }));
    g.note(`version=${v.version} dev=${v.dev} phase=${v.phase}`);
    await sleep(4500); // let the title intro animation finish
    await shot(page, 'title', g);
  }, 60000);

  await gate('start', async (g) => {
    if (!(await requireRail(page, g))) return;
    await evalRail(page, (R, seed) => { R.newRun(seed); }, SEED);
    const ok = await pollRail(page, R => R.state.phase === 'running', 15000);
    g.assert(ok, 'phase did not become running after newRun (phase=' + (await phase(page)) + ')');
    const s = await evalRail(page, R => ({ seed: R.state.seed, cars: R.state.train.cars.length, settlements: R.state.settlements.length, mapW: R.state.mapW, mapH: R.state.mapH }));
    g.assert(s.seed === SEED, `seed ${s.seed} != ${SEED}`);
    g.note(`cars=${s.cars} settlements=${s.settlements} map=${s.mapW}x${s.mapH}`);
    await sleep(700);
    const tut = await page.evaluate(() => !!document.querySelector('[class*="tutorial"], [data-panel="tutorial"], #tutorial, [data-tutorial]'));
    g.note('tutorial element ' + (tut ? 'found' : 'not found (best effort)'));
    await shot(page, 'tutorial', g);
  }, 30000);

  await gate('controls', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g, false))) return;
    await evalRail(page, R => { R.autopilot.setEnabled(false); R.setSpeed(1); if (R.sim.isPaused()) R.resume(); try { R.view && R.view.skipCinematic(); } catch {} });
    await sleep(600); // let the run-intro cinematic release the keys
    // click a plannable tile
    const target = await evalRail(page, R => {
      const opts = R.sim.plannableTiles();
      if (!opts.length || !R.view) return null;
      const best = opts.reduce((a, b) => (b.col > a.col ? b : a));
      const p = R.view.hexToScreen(best.col, best.row);
      return { col: best.col, row: best.row, x: p.x, y: p.y, before: R.state.route.path.length, cost: best.cost };
    });
    if (!target) g.fail('no plannable tile or view missing');
    else {
      await page.mouse.move(target.x, target.y);
      await sleep(80);
      await page.mouse.click(target.x, target.y);
      await sleep(350);
      const after = await evalRail(page, R => R.state.route.path.length);
      g.assert(after > target.before, `click on tile ${target.col},${target.row} @${Math.round(target.x)},${Math.round(target.y)} did not grow the plan (${target.before} -> ${after})`);
      if (after > target.before) g.note(`click planned ${target.col},${target.row}`);
      await page.keyboard.press('Backspace');
      await sleep(250);
      const afterBs = await evalRail(page, R => R.state.route.path.length);
      g.assert(afterBs < after, `Backspace did not unplan (${after} -> ${afterBs})`);
    }
    // pause / resume
    await page.keyboard.press('Space');
    await sleep(250);
    const paused = await evalRail(page, R => R.sim.isPaused() || R.state.phase === 'paused');
    g.assert(paused, 'Space did not pause');
    await page.keyboard.press('Space');
    await sleep(250);
    const resumed = await evalRail(page, R => !R.sim.isPaused() && R.state.phase === 'running');
    g.assert(resumed, 'second Space did not resume');
    // speed
    await page.keyboard.press('2');
    await sleep(200);
    const mul = await evalRail(page, R => R.state.speedMul);
    g.assert(mul === 2, `key 2 -> speedMul ${mul}`);
    await page.keyboard.press('1');
    // mute
    const mutedBefore = await evalRail(page, R => R.ctx.settings.get().muted);
    await page.keyboard.press('m');
    await sleep(200);
    const mutedAfter = await evalRail(page, R => R.ctx.settings.get().muted);
    g.assert(mutedAfter !== mutedBefore, `M did not toggle mute (${mutedBefore} -> ${mutedAfter})`);
    await page.keyboard.press('m');
    // train panel (best effort)
    const domBefore = await page.evaluate(() => document.querySelectorAll('#ui *').length);
    await page.keyboard.press('Tab');
    await sleep(350);
    const panel = await page.evaluate(() => ({ count: document.querySelectorAll('#ui *').length, attr: !!document.querySelector('[data-panel="train"]') }));
    const panelShown = panel.attr || panel.count !== domBefore;
    g.note('Tab train panel ' + (panelShown ? 'shown' : 'not detected (best effort)'));
    await page.keyboard.press('Escape');
    await sleep(300);
    const panelAfter = await page.evaluate(() => ({ count: document.querySelectorAll('#ui *').length, attr: !!document.querySelector('[data-panel="train"]') }));
    g.note('Escape ' + (!panelAfter.attr && panelAfter.count !== panel.count ? 'closed panel' : 'no DOM change detected (best effort)'));
    // make sure we left the game running for the next gates
    await evalRail(page, R => { if (R.sim.isPaused()) R.resume(); R.setSpeed(1); });
    if (await phase(page) === 'paused') await page.keyboard.press('Escape');
    await sleep(200);
  }, 45000);

  await gate('early_game', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g))) return;
    await evalRail(page, R => { R.autopilot.setEnabled(true); R.setSpeed(4); if (R.sim.isPaused()) R.resume(); });
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < 90000) {
      last = await evalRail(page, R => {
        if (R.state.phase === 'paused' || R.sim.isPaused()) R.resume();
        if (R.state.speedMul !== 4) R.setSpeed(4);
        return { time: R.state.time, phase: R.state.phase, speedMul: R.state.speedMul, status: R.autopilot.status() };
      });
      if (last.time >= 120) break;
      if (last.phase === 'victory' || last.phase === 'defeat' || last.phase === 'title') break;
      await sleep(300);
    }
    const s = await evalRail(page, R => R.summary());
    g.note(`t=${s.time.toFixed(1)} phase=${s.phase} speedMul=${last && last.speedMul} region=${s.region} cars=${s.cars.length} rescued=${s.settlementsRescued} route=${s.route.index}/${s.route.len} stop=${s.stopped ? s.stopReason : 'moving'} res=${JSON.stringify(s.resources)}`);
    g.note('autopilot: ' + s.autopilot);
    if (last && last.speedMul !== 4) g.note('4x speed not honoured (is ?dev respected?)');
    if (s.phase === 'defeat') g.fail('run ended in defeat before 120 s: ' + s.defeatReason);
    else g.assert(s.time >= 120 || s.phase === 'victory', `sim time only reached ${s.time.toFixed(1)} s in 90 s real time`);
    await evalRail(page, R => { R.setSpeed(1); if (R.view) { R.view.setFollow(true); R.view.centerOnTrain(); } });
    await sleep(500);
    await shot(page, 'early_game', g);
  }, 120000);

  await gate('combat', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g))) return;
    await installCounters(page);
    await evalRail(page, R => { R.setSpeed(1); if (R.sim.isPaused()) R.resume(); R.spawnWave(['raider', 'raider', 'hound', 'crawler']); });
    let maxEnemies = 0;
    let fired = 0;
    const t0 = Date.now();
    let shotTaken = false;
    while (Date.now() - t0 < 9000) {
      const s = await evalRail(page, R => ({ n: R.state.enemies.filter(e => e.state !== 'dead').length, fire: (window.__RAIL_COUNTERS || {}).fire || 0, ph: R.state.phase }));
      maxEnemies = Math.max(maxEnemies, s.n);
      fired = s.fire;
      if (!shotTaken && Date.now() - t0 >= 3000) { await shot(page, 'combat', g); shotTaken = true; }
      if (fired > 0 && Date.now() - t0 >= 6000) break;
      await sleep(250);
    }
    if (!shotTaken) await shot(page, 'combat', g);
    const c = await counters(page);
    g.assert(maxEnemies > 0, 'no enemies present after spawnWave');
    g.assert(fired > 0, 'no weapon:fire event within 9 s of the wave');
    g.note(`maxEnemies=${maxEnemies} weapon:fire=${fired} enemy:spawn=${c && c.spawn} enemy:died=${c && c.died} train:damage=${c && c.damage}`);
  }, 45000);

  await gate('mid_game', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g))) return;
    await evalRail(page, R => { R.autopilot.setEnabled(true); R.setSpeed(1); R.warpToRegion(2); if (R.view) R.view.centerOnTrain(); });
    await sleep(3000);
    const s = await evalRail(page, R => R.summary());
    g.assert(s.region === 2, `state.region is ${s.region}, expected 2`);
    g.note(`t=${s.time} phase=${s.phase} cars=${s.cars.length} weather=${s.weather} route=${s.route.index}/${s.route.len}`);
    await shot(page, 'mid_game', g);
  }, 30000);

  await gate('bosses', async (g) => {
    if (!(await requireRail(page, g))) return;
    const results = [];
    for (const type of ['boss_wagon', 'boss_brood', 'boss_maw']) {
      if (!(await ensureRunning(page, g))) return;
      await installCounters(page);
      await evalRail(page, (R, t) => {
        R.autopilot.setEnabled(true);
        if (R.sim.isPaused()) R.resume();
        R.godTrain(); R.invulnerable(true); R.spawnBoss(t); R.setSpeed(4);
      }, type);
      await sleep(1500);
      await evalRail(page, R => { if (R.view) R.view.centerOnTrain(); });
      await shot(page, 'boss_' + type, g);
      const spawned = await pollRail(page, (R, t) => R.state.boss.active || R.state.enemies.some(e => e.type === t && e.state !== 'dead') || ((window.__RAIL_COUNTERS || {}).bossSpawn || 0) > 0, 5000, type);
      const t0 = Date.now();
      let done = false;
      let last = null;
      while (Date.now() - t0 < 120000) {
        last = await evalRail(page, (R, t) => {
          if (R.state.speedMul !== 4) R.setSpeed(4);
          if (R.state.phase === 'paused' || R.sim.isPaused()) R.resume();
          const c = window.__RAIL_COUNTERS || {};
          const alive = R.state.enemies.some(e => e.type === t && e.state !== 'dead');
          return { active: R.state.boss.active, alive, died: c.bossDied || 0, phase: R.state.phase, bossPhase: R.state.boss.phase, time: R.state.time, defeated: R.state.boss.defeated.slice() };
        }, type);
        if (!last.active && !last.alive) { done = true; break; }
        if (last.died > 0) { done = true; break; }
        if (last.phase === 'defeat' || last.phase === 'victory') break;
        await sleep(400);
      }
      const died = !!last && (last.died > 0 || (last.defeated || []).includes(type));
      const r = { type, spawned: !!spawned, died, ended: done, bossPhase: last && last.bossPhase, phase: last && last.phase, realMs: Date.now() - t0 };
      results.push(r);
      g.note(`${type}: spawned=${r.spawned} died=${died} ended=${done} phase=${r.phase} bossPhase=${r.bossPhase} (${(r.realMs / 1000).toFixed(1)} s)`);
      if (!r.spawned) g.fail(type + ' did not spawn');
      else if (!done) g.fail(type + ' still active after 120 s at 4x with god train');
      if (last && last.phase === 'defeat') g.fail(type + ': run ended in defeat while invulnerable');
    }
    await evalRail(page, R => { R.invulnerable(false); R.setSpeed(1); });
    report.bosses = results;
  }, 420000);

  await gate('save_load', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g))) return;
    const saved = await evalRail(page, R => {
      R.setSpeed(1); R.pause();
      const json = R.serialize();
      R.ctx.settings.writeSave(json);
      const s = R.state;
      return { json, time: s.time, seed: s.seed, cars: s.train.cars.length, region: s.region, len: json.length };
    });
    g.note(`saved t=${saved.time.toFixed(2)} seed=${saved.seed} cars=${saved.cars} bytes=${saved.len}`);
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
    const ready = await pollRail(page, () => true, 20000);
    g.assert(ready, 'app did not come back after reload');
    const hasSave = await evalRail(page, R => R.ctx.settings.hasSave());
    g.note('hasSave after reload=' + hasSave);
    let r = await evalRail(page, R => {
      let via = 'continueRun';
      let ok = false;
      try { ok = !!R.continueRun(); } catch (e) { via = 'continueRun threw ' + (e && e.message); }
      const s = R.state;
      return { ok, via, time: s.time, seed: s.seed, cars: s.train.cars.length, phase: s.phase };
    });
    if (!r.ok || r.seed !== saved.seed) {
      g.note(`continueRun ${r.ok ? 'ok but seed ' + r.seed : 'failed'} - falling back to restore(json)`);
      r = await evalRail(page, (R, json) => {
        const ok = R.restore(json);
        const s = R.state;
        return { ok, via: 'restore', time: s.time, seed: s.seed, cars: s.train.cars.length, phase: s.phase };
      }, saved.json);
    }
    g.assert(r.ok, 'neither continueRun nor restore succeeded');
    g.assert(Math.abs(r.time - saved.time) <= 0.1, `restored time ${r.time} vs saved ${saved.time}`);
    g.assert(r.seed === saved.seed, `restored seed ${r.seed} vs ${saved.seed}`);
    g.assert(r.cars === saved.cars, `restored cars ${r.cars} vs ${saved.cars}`);
    g.note(`via=${r.via} phase=${r.phase}`);
    await evalRail(page, R => { if (R.sim.isPaused()) R.resume(); });
  }, 90000);

  await gate('victory', async (g) => {
    if (!(await requireRail(page, g))) return;
    if (!(await ensureRunning(page, g))) return;
    await evalRail(page, R => { R.forceVictory(); });
    const v = await pollRail(page, R => R.state.phase === 'victory', 10000);
    g.assert(v, 'phase did not become victory (phase=' + (await phase(page)) + ')');
    const sc = await evalRail(page, R => R.state.stats.score);
    g.note('victory score=' + sc);
    await pollRail(page, R => !(R.view && R.view.isCinematicPlaying && R.view.isCinematicPlaying()), 12000);
    await sleep(2500); // results card count-up
    await shot(page, 'victory', g);
    await evalRail(page, (R, seed) => { R.newRun(seed); }, SEED);
    const running = await pollRail(page, R => R.state.phase === 'running', 15000);
    g.assert(running, 'newRun after victory did not reach running');
    await evalRail(page, R => { R.forceDefeat('verification'); });
    const d = await pollRail(page, R => R.state.phase === 'defeat', 10000);
    g.assert(d, 'phase did not become defeat');
    const reason = await evalRail(page, R => R.state.defeatReason);
    g.note('defeatReason=' + JSON.stringify(reason));
    await pollRail(page, R => !(R.view && R.view.isCinematicPlaying && R.view.isCinematicPlaying()), 12000);
    await sleep(2500);
    const f = path.join(SHOT_DIR, 'defeat.png');
    await page.screenshot({ path: f });
    shots.push({ name: 'defeat', file: f });
  }, 60000);

  await gate('resize', async (g) => {
    if (!(await requireRail(page, g))) return;
    const before = errorCount();
    for (const [w, h] of [[1280, 720], [800, 600]]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(400);
      if (w === 800) await shot(page, 'resize_800x600', g);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await sleep(400);
    const after = errorCount();
    g.assert(after === before, `${after - before} new error(s) during resize`);
    const canvas = await page.evaluate(() => { const c = document.querySelector('#game canvas'); return c ? { w: c.clientWidth, h: c.clientHeight } : null; });
    g.note('canvas after resize=' + JSON.stringify(canvas));
  }, 30000);

  await gate('perf', async (g) => {
    if (!(await requireRail(page, g))) return;
    await evalRail(page, (R, seed) => { R.newRun(seed); }, SEED);
    const running = await pollRail(page, R => R.state.phase === 'running', 15000);
    if (!g.assert(running, 'could not start perf run')) return;
    await evalRail(page, R => {
      R.autopilot.setEnabled(true); R.setSpeed(1); if (R.sim.isPaused()) R.resume();
      R.spawnWave(['raider', 'raider', 'raider', 'hound', 'hound', 'crawler', 'crawler', 'harpy', 'harpy', 'sapper', 'wisp', 'wisp']);
      const w = window; w.__RAIL_RAF = { frames: 0, t0: performance.now(), on: true };
      const tick = () => { if (!w.__RAIL_RAF.on) return; w.__RAIL_RAF.frames++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const samples = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      await sleep(500);
      const p = await evalRail(page, R => {
        const perf = R.perf();
        return perf ? { ...perf, enemies: R.state.enemies.filter(e => e.state !== 'dead').length } : null;
      });
      if (p) samples.push(p);
    }
    const raf = await page.evaluate(() => { const r = window.__RAIL_RAF; r.on = false; return { frames: r.frames, seconds: (performance.now() - r.t0) / 1000 }; });
    const rafFps = raf.seconds > 0 ? raf.frames / raf.seconds : 0;
    const fpsVals = samples.map(s => s.fps).filter(x => typeof x === 'number' && isFinite(x));
    const avgFps = fpsVals.length ? fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length : rafFps;
    const minFps = fpsVals.length ? Math.min(...fpsVals) : rafFps;
    const worst = Math.max(0, ...samples.map(s => s.worstFrameMs || 0));
    const draws = Math.max(0, ...samples.map(s => s.drawCalls || 0));
    const enemiesMax = Math.max(0, ...samples.map(s => s.enemies || 0));
    report.perf = { samples: samples.length, avgFps: +avgFps.toFixed(1), minFps: +minFps.toFixed(1), rafFps: +rafFps.toFixed(1), worstFrameMs: +worst.toFixed(1), drawCalls: draws, quality: samples.length ? samples[samples.length - 1].quality : null, enemiesMax, headless: !HEADED };
    g.note(`avgFps=${report.perf.avgFps} minFps=${report.perf.minFps} rafFps=${report.perf.rafFps} worstFrameMs=${report.perf.worstFrameMs} drawCalls=${draws} enemiesMax=${enemiesMax} quality=${report.perf.quality}`);
    if (!samples.length) g.note('view.perf() returned nothing - using rAF frame count only');
    const effective = fpsVals.length ? avgFps : rafFps;
    if (effective >= 50) {
      g.note('>= 50 fps');
    } else if (!HEADED && effective >= 15) {
      g.note(`below 50 fps under headless SwiftShader (software GL) - see perf_headless_note`);
      report.gates.push({ name: 'perf_headless_note', pass: false, details: `avg fps ${effective.toFixed(1)} < 50 measured under headless SwiftShader; re-run with --headed on a GPU to confirm`, screenshot: null, ms: 0 });
    } else {
      g.fail(`avg fps ${effective.toFixed(1)} < 50`);
    }
  }, 60000);

  await gate('determinism', async (g) => {
    if (!(await requireRail(page, g))) return;
    const run = () => evalRail(page, (R, seed) => {
      R.autopilot.setEnabled(false);
      R.newRun(seed);
      R.pause();
      R.stepSim(30);
      const s = R.state;
      const snap = {
        path: s.route.path,
        settlements: s.settlements.map(x => x.name + ':' + x.type + '@' + x.col + ',' + x.row),
        summary: R.summary(),
        rng: s.rngState,
        enemies: s.enemies.length,
        loco: s.train.trailX.length ? [Math.round(s.train.trailX[0]), Math.round(s.train.trailY[0])] : null,
      };
      delete snap.summary.autopilot;
      R.resume();
      return JSON.stringify(snap);
    }, SEED);
    const a = await run();
    await sleep(300);
    const b = await run();
    const same = a === b;
    if (!same) {
      const A = JSON.parse(a), B = JSON.parse(b);
      const diffs = Object.keys(A).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
      g.fail('runs differ in: ' + diffs.join(', ') + ' (summaryA=' + JSON.stringify(A.summary).slice(0, 300) + ')');
    } else {
      const A = JSON.parse(a);
      g.note(`identical after 30 s: t=${A.summary.time} path=${A.path.length} settlements=${A.settlements.length} enemies=${A.enemies} rng=${JSON.stringify(A.rng)}`);
    }
    await evalRail(page, R => { if (R.sim.isPaused()) R.resume(); });
  }, 90000);

  await gate('screenshots', async (g) => {
    if (!shots.length) { g.fail('no screenshots captured'); return; }
    const out = [];
    for (const s of shots) {
      if (!fs.existsSync(s.file)) { g.fail(s.name + ' missing'); continue; }
      try {
        const st = await pngStats(s.file);
        const blank = st.std < 4 || st.mean < 3 || st.mean > 250;
        out.push({ name: s.name, file: path.relative(ROOT, s.file).replace(/\\/g, '/'), ...st, blank });
        if (blank) g.fail(`${s.name} looks blank (mean=${st.mean} std=${st.std})`);
      } catch (e) {
        g.fail(`${s.name} could not be decoded: ${e && e.message}`);
      }
    }
    report.screenshots = out;
    g.note(out.map(o => `${o.name}:${o.mean}/${o.std}`).join(' '));
  }, 60000);

  // final state
  try {
    report.summary = await evalRail(page, R => R.summary());
    report.autopilotStatus = report.summary && report.summary.autopilot;
    const inPage = await evalRail(page, R => ({ errors: R.errors.slice(0, 50), warnings: R.warnings.slice(0, 50) }));
    report.inPageErrors = inPage.errors;
    report.inPageWarnings = inPage.warnings;
  } catch { /* ignore */ }
}

// ------------------------------------------------------------------ report writers
function writeReports() {
  const failing = report.gates.filter(g => !g.pass && g.name !== 'perf_headless_note');
  const errors = report.consoleErrors.length + report.pageErrors.length;
  report.ok = failing.length === 0 && errors === 0;
  report.failingGates = failing.map(g => g.name);
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
  fs.writeFileSync(path.join(VERIFY_DIR, 'report.json'), JSON.stringify(report, null, 2));

  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines = [];
  lines.push('# RAILaVOID verification report');
  lines.push('');
  lines.push(`- Time: ${report.timestamp}`);
  lines.push(`- URL: ${report.url}`);
  lines.push(`- Result: **${report.ok ? 'PASS' : 'FAIL'}**${failing.length ? ' (failing: ' + failing.map(g => g.name).join(', ') + ')' : ''}`);
  lines.push(`- Console errors: ${report.consoleErrors.length}, page errors: ${report.pageErrors.length}, warnings: ${report.consoleWarnings.length}, failed requests: ${report.failedRequests.length}`);
  if (report.perf) lines.push(`- Perf: avg ${report.perf.avgFps} fps, min ${report.perf.minFps} fps, rAF ${report.perf.rafFps} fps, worst frame ${report.perf.worstFrameMs} ms, draw calls ${report.perf.drawCalls}${report.perf.headless ? ' (headless SwiftShader)' : ''}`);
  lines.push('');
  lines.push('| Gate | Result | Time | Details | Screenshot |');
  lines.push('|---|---|---:|---|---|');
  for (const g of report.gates) {
    const shotCell = g.screenshot ? `[${path.basename(g.screenshot)}](${g.screenshot.replace(/^verify\//, '')})` : '';
    lines.push(`| ${g.name} | ${g.pass ? 'PASS' : (g.name === 'perf_headless_note' ? 'NOTE' : 'FAIL')} | ${g.ms ? (g.ms / 1000).toFixed(1) + ' s' : ''} | ${esc(g.details)} | ${shotCell} |`);
  }
  if (report.screenshots && report.screenshots.length) {
    lines.push('');
    lines.push('## Screenshots');
    lines.push('');
    lines.push('| Name | Mean luminance | Std | Blank? |');
    lines.push('|---|---:|---:|---|');
    for (const s of report.screenshots) lines.push(`| [${s.name}](${s.file.replace(/^verify\//, '')}) | ${s.mean} | ${s.std} | ${s.blank ? 'yes' : 'no'} |`);
  }
  if (report.consoleErrors.length || report.pageErrors.length) {
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    for (const e of [...report.pageErrors, ...report.consoleErrors].slice(0, 40)) lines.push('- `' + esc(e).slice(0, 400) + '`');
  }
  if (report.consoleWarnings.length) {
    lines.push('');
    lines.push('## Warnings (first 20)');
    lines.push('');
    for (const w of report.consoleWarnings.slice(0, 20)) lines.push('- `' + esc(w).slice(0, 300) + '`');
  }
  if (report.failedRequests.length) {
    lines.push('');
    lines.push('## Failed requests');
    lines.push('');
    for (const r of report.failedRequests.slice(0, 20)) lines.push(`- ${r.url} ${r.status || r.error}`);
  }
  if (report.summary) {
    lines.push('');
    lines.push('## Final sim summary');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.summary, null, 2));
    lines.push('```');
  }
  fs.writeFileSync(path.join(VERIFY_DIR, 'report.md'), lines.join('\n') + '\n');

  console.log('');
  console.log('==================== RAILaVOID verify ====================');
  for (const g of report.gates) console.log(`${(g.pass ? 'PASS' : g.name === 'perf_headless_note' ? 'NOTE' : 'FAIL').padEnd(5)} ${g.name.padEnd(20)} ${g.details.slice(0, 160)}`);
  console.log(`console errors: ${report.consoleErrors.length}  page errors: ${report.pageErrors.length}  warnings: ${report.consoleWarnings.length}  failed requests: ${report.failedRequests.length}`);
  if (report.perf) console.log(`perf: avg ${report.perf.avgFps} fps, min ${report.perf.minFps}, worst frame ${report.perf.worstFrameMs} ms, draw calls ${report.perf.drawCalls}`);
  console.log(`report: ${path.join(VERIFY_DIR, 'report.md')}`);
  console.log(`RESULT: ${report.ok ? 'PASS' : 'FAIL'}`);
  console.log('==========================================================');
  return report.ok;
}

let ok = false;
try {
  await main();
} catch (e) {
  report.gates.push({ name: 'harness', pass: false, details: 'harness crashed: ' + (e && e.stack ? e.stack : e), screenshot: null, ms: 0 });
} finally {
  try { ok = writeReports(); } catch (e) { console.error('could not write report', e); }
  await cleanup();
}
process.exit(ok ? 0 : 1);
