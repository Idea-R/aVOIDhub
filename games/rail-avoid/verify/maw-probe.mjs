import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
const port = 4178;
const srv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
await new Promise(r => { const t = setInterval(() => http.get(`http://localhost:${port}/`, res => { if (res.statusCode < 500) { clearInterval(t); r(); } }).on('error', () => {}), 300); });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e.message))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:${port}/?dev`);
await p.waitForFunction(() => window.__RAIL && window.__RAIL.ready, null, { timeout: 30000 });
await p.evaluate(() => { const R = window.__RAIL; R.newRun(12345); R.view && R.view.skipCinematic(); R.godTrain(); R.invulnerable(true); R.warpToRegion(2); R.autopilot.setEnabled(true); R.setSpeed(4); R.spawnBoss('boss_maw'); });
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(2000);
  const s = await p.evaluate(() => { const R = window.__RAIL; const s = R.state; const m = s.enemies.find(e => e.type === 'boss_maw'); const lp = R.sim.locoPos(); return { t: s.time.toFixed(0), phase: s.phase, maw: m ? m.hp.toFixed(0) : 'dead', active: s.boss.active, stop: s.train.stopped + '/' + s.train.stopReason, tes: s.train.cars.filter(c => c.type === 'tesla').map(c => c.derived.powerRatio.toFixed(2) + '/' + c.heat.toFixed(0) + '/' + (c.disabled ? 'D' : '-') + '/' + (c.derived.targetEnemyId || '-')), d: m ? Math.hypot(m.x - lp.x, m.y - lp.y).toFixed(0) : '-', cine: R.view && R.view.isCinematicPlaying(), ap: R.autopilot.status().slice(0, 40), en: s.enemies.length, path: s.route.path.length - 1 - s.train.routeIndex }; });
  console.log(JSON.stringify(s));
  if (!s.active) break;
}
console.log('errs', errs.slice(0, 3));
await b.close(); srv.kill(); process.exit(0);
