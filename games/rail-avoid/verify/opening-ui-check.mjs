#!/usr/bin/env node
/**
 * Opening cinematic UI check (cards, letterbox, skip keys, HUD return, reduced motion, title menu + settings toggle).
 *   node verify/opening-ui-check.mjs [--url=http://localhost:5195]
 * Screenshots land in verify/screenshots/opening/. Headless SwiftShader runs the sim clock slowly, so the timed
 * shots (2/6/11/16/22 s) are complemented by shots keyed on each card event.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const hit = argv.find(a => a.startsWith('--' + name + '=')); return hit ? hit.slice(name.length + 3) : def; };
const URL = opt('url', 'http://localhost:5195') + '/?dev';
const OUT = path.resolve('verify/screenshots/opening');
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/swiftshader|WebGL|GroupMarker|AudioContext/i.test(m.text())) errs.push('console: ' + m.text()); });
await p.addInitScript(() => {
  try { localStorage.clear(); } catch {}
  window.__cine = [];
  window.addEventListener('railavoid:cine', e => { const d = e.detail || {}; window.__cine.push({ t: performance.now(), phase: d.phase, name: d.name, title: d.title }); });
});
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__RAIL && window.__RAIL.ready && window.__RAIL.view, null, { timeout: 30000 });
// the title entrance is gsap-driven; under SwiftShader load it can lag, so wait for the last menu entry to land
await p.waitForFunction(() => { const b = [...document.querySelectorAll('#ui .rv-title-menu .rv-btn')].filter(x => !x.hidden).pop(); const f = document.querySelector('#ui .rv-footer'); return b && f && getComputedStyle(b).opacity === '1' && getComputedStyle(f).opacity === '1'; }, null, { timeout: 20000 });
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(OUT, 'title_720.png') });
const menu = await p.evaluate(() => [...document.querySelectorAll('#ui .rv-title-menu .rv-btn')].filter(b => !b.hidden).map(b => b.textContent.trim() + (b.classList.contains('rv-secondary') ? ' [secondary]' : '')));
console.log('title menu:', JSON.stringify(menu));
// title stack must stay inside the viewport at 720p (footer / hint not overlapped)
const fit = await p.evaluate(() => { const s = document.querySelector('#ui .rv-title-stack').getBoundingClientRect(); const f = document.querySelector('#ui .rv-footer').getBoundingClientRect(); return { stackTop: Math.round(s.top), stackBottom: Math.round(s.bottom), footerTop: Math.round(f.top), vh: innerHeight }; });
console.log('title stack fit:', JSON.stringify(fit));

await p.evaluate(() => { [...document.querySelectorAll('#ui .rv-title-menu .rv-btn')].find(x => x.textContent.trim() === 'Settings').click(); });
await p.waitForFunction(() => { const b = document.querySelector('#ui .rv-settings .rv-actions .rv-btn'); return b && getComputedStyle(b).opacity === '1'; }, null, { timeout: 20000 });
await p.waitForTimeout(300);
const toggle = await p.evaluate(() => { const i = document.querySelector('#ui .rv-settings input[aria-label="Play the opening on the next new run"]'); return i ? { checked: i.checked, introSeen: window.__RAIL.ctx.settings.meta().introSeen } : null; });
console.log('settings toggle (fresh profile):', JSON.stringify(toggle));
await p.evaluate(() => { const i = document.querySelector('#ui .rv-settings input[aria-label="Play the opening on the next new run"]'); i.click(); });
const toggled = await p.evaluate(() => window.__RAIL.ctx.settings.meta().introSeen);
console.log('after unchecking → introSeen =', toggled);
await p.evaluate(() => { const i = document.querySelector('#ui .rv-settings input[aria-label="Play the opening on the next new run"]'); i.click(); });
await p.evaluate(() => document.querySelector('#ui .rv-settings').scrollTo(0, 260));
await p.waitForTimeout(200);
await p.screenshot({ path: path.join(OUT, 'settings_toggle.png') });
await p.keyboard.press('Escape');
await p.waitForTimeout(500);

// ---- fresh profile → newRun plays the opening
await p.evaluate(() => { window.__RAIL.newRun(12345); });
await p.waitForFunction(() => window.__cine.some(e => e.phase === 'start' && e.name === 'opening'), null, { timeout: 8000 });
const t0 = await p.evaluate(() => window.__cine.find(e => e.phase === 'start' && e.name === 'opening').t);
console.log('opening started; introSeen =', await p.evaluate(() => window.__RAIL.ctx.settings.meta().introSeen));
const cardInfo = () => p.evaluate(() => {
  const card = document.querySelector('#ui .rv-cine-card');
  const cine = document.querySelector('#ui .rv-cine');
  const lit = card.querySelectorAll('.rv-cine-swatches i.rv-lit').length;
  const sw = [...card.querySelectorAll('.rv-cine-swatches i')].map(i => getComputedStyle(i).backgroundColor + '@' + getComputedStyle(i).opacity);
  return { cls: card.className.replace('rv-cine-card ', ''), opacity: +(+getComputedStyle(card).opacity).toFixed(2), title: card.querySelector('.rv-cine-title')?.textContent, sub: card.querySelector('.rv-cine-sub')?.textContent, tagline: card.querySelector('.rv-cine-tagline')?.textContent,
    lit, swatches: card.querySelector('.rv-cine-swatches').hidden ? 'hidden' : sw.join(' '), skip: document.querySelector('#ui .rv-cine-skip').textContent, bar: getComputedStyle(cine.querySelector('.rv-cine-top')).height, announce: !!document.querySelector('#ui .rv-announce') };
});
const timed = [2, 6, 11, 16, 22];
const cards = ['aVOID Games', 'The continent is falling into the void.', 'Three lines. One train.', 'Every line meets at the Crossroads.', 'RAILaVOID'];
let nextTimed = 0, nextCard = 0;
// interleave: timed shots (wall clock from the start event) and per-card shots (1.6 s after each card event)
while (nextTimed < timed.length || nextCard < cards.length) {
  const state = await p.evaluate((n) => { const c = window.__cine.filter(e => e.phase === 'card' && e.name === 'opening'); return { count: c.length, at: c[n] ? c[n].t : null, now: performance.now(), ended: window.__cine.some(e => e.phase === 'end') }; }, nextCard);
  if (nextCard < cards.length && state.at !== null && state.now >= state.at + 1600) {
    const info = await cardInfo();
    const f = path.join(OUT, `card${nextCard + 1}.png`);
    await p.screenshot({ path: f });
    console.log(`card ${nextCard + 1} (+1.6 s) ${f}`, JSON.stringify(info));
    nextCard++;
    continue;
  }
  if (nextTimed < timed.length && state.now >= t0 + timed[nextTimed] * 1000) {
    const info = await cardInfo();
    const f = path.join(OUT, `t${String(timed[nextTimed]).padStart(2, '0')}s.png`);
    await p.screenshot({ path: f });
    console.log(`t=${timed[nextTimed]}s ${f}`, JSON.stringify({ cls: info.cls, opacity: info.opacity, title: info.title ?? info.tagline }));
    nextTimed++;
    continue;
  }
  if (state.ended && nextTimed >= timed.length) break;
  if (state.now - t0 > 90000) { console.log('gave up waiting for cards'); break; }
  await p.waitForTimeout(120);
}
await p.waitForFunction(() => window.__cine.some(e => e.phase === 'end' && e.name === 'opening'), null, { timeout: 90000 });
await p.waitForTimeout(1500);
const after = await p.evaluate(() => { const h = document.querySelector('#ui .rv-hud'); const c = document.querySelector('#ui .rv-cine'); return { hudHidden: h.hidden, hudOff: h.classList.contains('rv-hud-off'), hudOpacity: getComputedStyle(h.querySelector('.rv-hud-top') || h).opacity, cineHidden: c.hidden, announce: document.querySelector('#ui .rv-announce')?.textContent?.slice(0, 40) ?? null, phase: window.__RAIL.state.phase }; });
await p.screenshot({ path: path.join(OUT, 'after_end.png') });
console.log('after end:', JSON.stringify(after));
console.log('cine log (s):', JSON.stringify(await p.evaluate((t0) => window.__cine.map(e => `${((e.t - t0) / 1000).toFixed(1)} ${e.phase}${e.title ? ':' + e.title : ''}`), t0)));

// ---- Space must not skip; Enter must; click must
await p.evaluate(() => { window.__cine.length = 0; window.__SKIPS = 0; const v = window.__RAIL.view; const orig = v.skipCinematic.bind(v); v.skipCinematic = () => { window.__SKIPS++; orig(); }; window.__RAIL_PLAY_OPENING(); });
await p.waitForFunction(() => window.__cine.some(e => e.phase === 'start'), null, { timeout: 5000 });
await p.waitForTimeout(400);
await p.keyboard.press('Space');
await p.waitForTimeout(150);
const afterSpace = await p.evaluate(() => ({ skips: window.__SKIPS, playing: window.__RAIL.view.isCinematicPlaying() }));
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
const afterEnter = await p.evaluate(() => ({ skips: window.__SKIPS, playing: window.__RAIL.view.isCinematicPlaying() }));
console.log('Space →', JSON.stringify(afterSpace), 'Enter →', JSON.stringify(afterEnter));
await p.waitForTimeout(800);
await p.evaluate(() => { window.__cine.length = 0; window.__RAIL_PLAY_OPENING(); });
await p.waitForFunction(() => window.__cine.some(e => e.phase === 'start'), null, { timeout: 5000 });
await p.waitForTimeout(400);
await p.mouse.click(640, 300);
await p.waitForTimeout(300);
console.log('click →', JSON.stringify(await p.evaluate(() => ({ skips: window.__SKIPS, playing: window.__RAIL.view.isCinematicPlaying() }))));
await p.waitForTimeout(800);

// ---- reduced motion: instant cards (driven by hand so the DOM path is exercised regardless of the render gate)
await p.evaluate(() => { window.__RAIL.ctx.settings.set({ reducedMotion: true }); });
await p.evaluate(() => {
  const ev = (d) => window.dispatchEvent(new CustomEvent('railavoid:cine', { detail: d }));
  ev({ phase: 'start', name: 'opening' });
  ev({ phase: 'card', name: 'opening', title: 'Three lines. One train.', subtitle: 'Northern · Central · Southern' });
});
await p.waitForTimeout(500);
console.log('reduced-motion card:', JSON.stringify(await cardInfo()));
await p.screenshot({ path: path.join(OUT, 'reduced_card3.png') });
await p.evaluate(() => { window.dispatchEvent(new CustomEvent('railavoid:cine', { detail: { phase: 'end', name: 'opening' } })); window.__RAIL.ctx.settings.set({ reducedMotion: false }); });

console.log('errors:', errs.length ? errs.slice(0, 8) : 'none');
await b.close();
