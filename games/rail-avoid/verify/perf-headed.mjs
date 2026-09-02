// Headed GPU performance probe: opens a real Chromium window for ~35 s and samples __RAIL.perf().
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
const port = 4177;
const srv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
const wait = () => new Promise(r => { const t = setInterval(() => http.get(`http://localhost:${port}/`, res => { if (res.statusCode < 500) { clearInterval(t); r(); } }).on('error', () => {}), 300); });
await wait();
const b = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--window-size=1920,1080'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://localhost:${port}/?dev`);
await p.waitForFunction(() => window.__RAIL && window.__RAIL.ready, null, { timeout: 30000 });
await p.evaluate(() => { const R = window.__RAIL; R.newRun(12345); R.view && R.view.skipCinematic(); R.autopilot.setEnabled(true); R.godTrain(); R.warpToRegion(2); R.setSpeed(1); });
await p.waitForTimeout(2000);
await p.evaluate(() => { const R = window.__RAIL; R.spawnWave(['raider','raider','raider','raider','hound','hound','hound','crawler','crawler','harpy','harpy','wisp','wisp','sapper','raider','hound']); R.setWeather('rain'); R.setTime(0.7); });
const samples = [];
for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); samples.push(await p.evaluate(() => ({ ...window.__RAIL.perf(), enemies: window.__RAIL.state.enemies.length }))); }
const fps = samples.map(s => s.fps); const worst = Math.max(...samples.map(s => s.worstFrameMs));
const out = { avgFps: +(fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1), minFps: Math.min(...fps), worstFrameMs: worst, drawCalls: samples[samples.length - 1].drawCalls, quality: samples[samples.length - 1].quality, maxEnemies: Math.max(...samples.map(s => s.enemies)), renderer: await p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; }) };
console.log(JSON.stringify(out));
await b.close(); srv.kill();
process.exit(0);
