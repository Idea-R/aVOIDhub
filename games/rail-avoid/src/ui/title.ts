/** Title screen: animated wordmark, ember field, self-drawing rail line, magnetic menu, departure transition. */
import { el, btn } from './dom';
import type { UiShared } from './shared';
import { hashSeed } from '../core/rng';
import { REGION_NAMES } from '../core/config';
import { gsap, D, isReduced, Particles, countText, screenFlash } from './motion';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

export interface TitleActions {
  newRun(seed?: number): void;
  /** New run that plays the scripted opening cinematic first. */
  watchIntro(seed?: number): void;
  continueRun(): void;
  howto(): void;
  settings(): void;
}

export interface TitleScreen { el: HTMLElement; refresh(): void; onOpen(): void; onClose(): void }

export function parseSeed(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{1,10}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n <= 0xffffffff) return n >>> 0;
  }
  return hashSeed(s);
}

const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
  return n;
}
const letters = (word: string, cls: string): HTMLElement[] => Array.from(word).map(ch => el('span', { class: 'rv-ltr ' + cls, text: ch }));

export function createTitle(ui: UiShared, actions: TitleActions): TitleScreen {
  const seedInput = el('input', { type: 'text', placeholder: 'seed (optional)', 'aria-label': 'Run seed, optional. Numbers or any text.', maxlength: '32', autocomplete: 'off', spellcheck: 'false' });
  const continueBtn = btn('Continue', () => depart(() => actions.continueRun()), { class: 'rv-big', aria: 'Continue saved run' });
  const metaEl = el('div', { class: 'rv-meta' });

  const startRun = () => depart(() => actions.newRun(parseSeed(seedInput.value)));
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); startRun(); } });

  // ---- wordmark: per-letter spans so each can rise / spin / flicker
  const railL = letters('RAIL', 'rv-rail-l');
  const aL = el('span', { class: 'rv-ltr rv-a-seg', text: 'a' });
  const voidL = letters('VOID', 'rv-void-l');
  const steam = el('span', { class: 'rv-steam', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
  const wordmark = el('div', { class: 'rv-wordmark', role: 'heading', 'aria-level': '1', 'aria-label': 'RAILaVOID' },
    ...railL, el('span', { class: 'rv-a-wrap' }, aL, steam), el('span', { class: 'rv-void-seg' }, ...voidL));

  // ---- rail line (SVG): solid rail draws itself, sleepers fade in, stations pop, a lamp runs the line
  const railSvg = svg('svg', { class: 'rv-title-rail', viewBox: '0 0 600 44', 'aria-hidden': 'true' });
  const d = 'M 6 26 C 110 26, 150 12, 240 12 S 380 34, 460 34 S 560 16, 594 16';
  const sleepers = svg('path', { d, class: 'rv-rail-sleepers' });
  const railPath = svg('path', { d, class: 'rv-rail-line' });
  const stations = [140, 300, 470].map(x => svg('circle', { r: '4', class: 'rv-rail-station' }));
  const lamp = svg('circle', { r: '3', class: 'rv-rail-lamp' });
  railSvg.append(sleepers, railPath, ...stations, lamp);

  const tagline = el('div', { class: 'rv-tagline', text: 'The last train across a collapsing continent' });
  const seedRow = el('div', { class: 'rv-seed-row' }, el('span', { class: 'rv-label', text: 'seed' }), seedInput);
  seedRow.hidden = true; // Settings → "Show seed field"
  const fx = el('canvas', { class: 'rv-title-fx', 'aria-hidden': 'true' });
  const particles = new Particles(fx, 120);
  const menu = el('div', { class: 'rv-title-menu' },
    btn('New Run', startRun, { class: 'rv-big rv-primary', aria: 'Start a new run' }),
    seedRow,
    continueBtn,
    btn('How to Play', () => { ui.audio().ui('open'); actions.howto(); }, { class: 'rv-big', aria: 'How to play' }),
    btn('Watch intro', () => depart(() => actions.watchIntro(parseSeed(seedInput.value))), { class: 'rv-big rv-secondary', aria: 'Watch the opening and start a new run' }),
    btn('Settings', () => { ui.audio().ui('open'); actions.settings(); }, { class: 'rv-big', aria: 'Open settings' }),
  );
  const hint = el('div', { class: 'rv-hint', text: 'Space pause · 1/2 speed · click hexes to plan track · R reverse · Tab train · Esc menu · H help' });
  const footer = el('div', { class: 'rv-footer', text: 'aVOID Games' });
  const root = el('section', { class: 'rv-title', role: 'dialog', 'aria-label': 'RAILaVOID title' },
    el('div', { class: 'rv-title-bg', 'aria-hidden': 'true' }), fx, el('div', { class: 'rv-title-vignette', 'aria-hidden': 'true' }),
    el('div', { class: 'rv-title-stack' }, wordmark, tagline, railSvg, menu, metaEl, hint), footer);
  (menu.querySelector('.rv-btn') as HTMLElement | null)?.setAttribute('data-autofocus', '');

  // magnetic buttons: nudge toward the cursor (CSS var → transform), CSS transition smooths it
  const menuBtns = Array.from(menu.querySelectorAll<HTMLElement>('.rv-btn'));
  menu.addEventListener('pointermove', (e) => {
    if (isReduced()) return;
    for (const b of menuBtns) {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const near = Math.abs(dx) < r.width / 2 + 28 && Math.abs(dy) < r.height / 2 + 18;
      b.style.setProperty('--mx', near ? (dx * 0.12).toFixed(1) + 'px' : '0px');
      b.style.setProperty('--my', near ? (dy * 0.18).toFixed(1) + 'px' : '0px');
    }
  });
  menu.addEventListener('pointerleave', () => { for (const b of menuBtns) { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); } });

  const menuItems = Array.from(menu.children) as HTMLElement[];
  const allLetters = [...railL, aL, ...voidL];
  let intro: gsap.core.Timeline | null = null;
  let isOpen = false, departing = false, railLen = 600;

  function flickerVoid(): void {
    if (isReduced()) return;
    const tl = gsap.timeline({ onComplete: sputter });
    for (const o of [0.15, 1, 0.3, 1, 0.1, 0.85, 1]) tl.to(voidL, { opacity: o, duration: 0.05 + Math.random() * 0.06, ease: 'none', stagger: { each: 0.012, from: 'random' } });
    tl.to(voidL, { opacity: 1, duration: 0.25 });
  }
  /** Occasional single-letter sputter, like a failing neon sign. */
  function sputter(): void {
    if (isReduced() || !isOpen) return;
    const l = voidL[Math.floor(Math.random() * voidL.length)];
    gsap.timeline({ delay: 2.5 + Math.random() * 6, onComplete: sputter })
      .to(l, { opacity: 0.25, duration: 0.05 }).to(l, { opacity: 1, duration: 0.07 }).to(l, { opacity: 0.4, duration: 0.05 }).to(l, { opacity: 1, duration: 0.3 });
  }
  function drawRail(): gsap.core.Timeline {
    try { railLen = railPath.getTotalLength() || 600; } catch { railLen = 600; }
    for (let i = 0; i < stations.length; i++) {
      const p = railPath.getPointAtLength(railLen * (0.22 + i * 0.28));
      stations[i].setAttribute('cx', p.x.toFixed(1)); stations[i].setAttribute('cy', p.y.toFixed(1));
    }
    railPath.style.strokeDasharray = String(railLen);
    const tl = gsap.timeline();
    tl.set(railSvg, { opacity: 1 })
      .fromTo(railPath, { strokeDashoffset: railLen }, { strokeDashoffset: 0, duration: D(1.6), ease: 'power2.inOut' })
      .fromTo(sleepers, { opacity: 0 }, { opacity: 0.3, duration: D(0.8) }, D(0.6))
      .fromTo(stations, { scale: 0, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: D(0.5), ease: 'back.out(3)', stagger: D(0.25) }, D(0.5))
      .add(() => {
        if (isReduced()) return;
        gsap.killTweensOf(lamp);
        gsap.fromTo(lamp, { opacity: 0 }, { opacity: 1, duration: 0.5 });
        gsap.to(lamp, { motionPath: { path: railPath, align: railPath, alignOrigin: [0.5, 0.5] }, duration: 9, repeat: -1, ease: 'none' });
      }, D(1.3));
    return tl;
  }
  function playIntro(): void {
    intro?.kill();
    gsap.killTweensOf([...allLetters, tagline, railSvg, ...menuItems, metaEl, hint, footer, lamp]);
    gsap.set([tagline, railSvg, ...menuItems, metaEl, hint, footer], { opacity: 0 });
    gsap.set(lamp, { opacity: 0 });
    const rise = { y: 70, opacity: 0, filter: 'blur(14px)' }, land = { y: 0, opacity: 1, filter: 'blur(0px)', duration: D(0.95), ease: 'power4.out', stagger: D(0.07) };
    const tl = gsap.timeline();
    intro = tl;
    tl.fromTo(railL, rise, land, 0)
      .fromTo(aL, { rotation: -540, scale: 0, opacity: 0 }, { rotation: 0, scale: 1, opacity: 1, duration: D(1.1), ease: 'back.out(1.7)' }, D(0.3))
      .fromTo(voidL, rise, land, D(0.45))
      .add(flickerVoid, D(1.0))
      .fromTo(tagline, { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.3em', duration: D(1.1), ease: 'power2.out' }, D(1.05))
      .add(drawRail(), D(1.0))
      .fromTo(menuItems, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: D(0.55), ease: 'back.out(1.6)', stagger: D(0.075), clearProps: 'transform' }, D(1.45))
      .fromTo([metaEl, hint, footer], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.5), stagger: D(0.12), clearProps: 'transform' }, D(1.9))
      .add(countMeta, D(1.95));
  }
  /** Fly the title out, flash white, and hand over at peak brightness. */
  function depart(go: () => void): void {
    if (departing) return;
    departing = true;
    ui.audio().ui('confirm');
    intro?.kill();
    gsap.killTweensOf([...allLetters, ...menuItems, railPath]);
    const tl = gsap.timeline({ onComplete: () => { departing = false; } });
    tl.to(menuItems, { y: 44, opacity: 0, duration: D(0.35), ease: 'power3.in', stagger: D(0.04) }, 0)
      .to([metaEl, hint, footer, tagline, sleepers, stations, lamp], { opacity: 0, duration: D(0.3) }, 0)
      .to(railPath, { strokeDashoffset: -railLen, duration: D(0.6), ease: 'power2.in' }, 0)
      .to([...railL, ...voidL], { y: -90, opacity: 0, filter: 'blur(10px)', duration: D(0.5), ease: 'power3.in', stagger: { each: D(0.03), from: 'center' } }, D(0.1))
      .to(aL, { scale: 3, opacity: 0, rotation: 200, duration: D(0.5), ease: 'power3.in' }, D(0.15))
      .add(() => screenFlash(ui.root, '#fff', 0.92, () => { go(); if (ui.isOpen('title')) playIntro(); }), D(0.42));
  }

  function countMeta(): void {
    for (const b of metaEl.querySelectorAll<HTMLElement>('b[data-n]')) countText(b, b.dataset.n ?? '0', { dur: 1.1 });
  }
  function refresh(): void {
    const hasSave = ui.app.settings.hasSave();
    continueBtn.hidden = !hasSave;
    seedRow.hidden = !ui.settings().showSeedField;
    if (seedRow.hidden) seedInput.value = '';
    const m = ui.app.settings.meta();
    const bestRegion = m.runs > 0 ? (REGION_NAMES[Math.max(0, Math.min(REGION_NAMES.length - 1, m.bestRegion))] ?? '—') : '—';
    const num = (n: number) => el('b', { 'data-n': String(n), text: String(n) });
    metaEl.replaceChildren(
      el('span', null, 'Runs ', num(m.runs)),
      el('span', null, 'Victories ', num(m.victories)),
      el('span', null, 'Best score ', num(m.bestScore)),
      el('span', null, 'Best region ', el('b', { text: bestRegion })),
    );
    seedInput.placeholder = m.lastSeed ? `seed (last: ${m.lastSeed})` : 'seed (optional)';
  }
  function onOpen(): void { isOpen = true; departing = false; refresh(); particles.start(); playIntro(); }
  function onClose(): void { isOpen = false; particles.stop(); intro?.kill(); gsap.killTweensOf(lamp); }

  return { el: root, refresh, onOpen, onClose };
}
