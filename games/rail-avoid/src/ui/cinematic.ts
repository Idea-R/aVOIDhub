/**
 * Cinematic dressing: letterbox bars, skip hint and title cards. The render layer moves the camera and
 * dispatches window CustomEvent 'railavoid:cine' ({ phase: 'start'|'card'|'end', name, title?, subtitle? }).
 */
import { el, btn } from './dom';
import type { UiShared } from './shared';
import { gsap, D, isReduced } from './motion';

export interface CineDetail { phase: 'start' | 'card' | 'end'; name: string; title?: string; subtitle?: string }
export interface Cinematic {
  el: HTMLElement;
  active(): boolean;
  /** Run `cb` once the current cinematic ends (immediately when none is playing; after `timeoutMs` at the latest). */
  onEnd(cb: () => void, timeoutMs?: number): void;
  destroy(): void;
}

const TAGS: Record<string, string> = { boss_intro: 'Boss', region_enter: 'Entering', run_intro: 'The last train', victory: 'Run complete', defeat: 'Run over' };

export function createCinematic(ui: UiShared, hooks: { hideHud(): void; showHud(): void }): Cinematic {
  const top = el('div', { class: 'rv-cine-bar rv-cine-top' });
  const bottom = el('div', { class: 'rv-cine-bar rv-cine-bottom' });
  const tag = el('div', { class: 'rv-cine-tag' });
  const titleEl = el('div', { class: 'rv-cine-title' });
  const rule = el('div', { class: 'rv-cine-rule' });
  const sub = el('div', { class: 'rv-cine-sub' });
  const card = el('div', { class: 'rv-cine-card', 'aria-live': 'polite' }, tag, titleEl, rule, sub);
  const skip = btn('Skip ▸', () => doSkip(), { class: 'rv-small rv-cine-skip', aria: 'Skip cinematic (Esc)' });
  const root = el('div', { class: 'rv-cine' }, top, bottom, card, skip);
  root.hidden = true;

  let active = false, name = '';
  let cardTl: gsap.core.Timeline | null = null;
  let endCbs: Array<() => void> = [];

  function doSkip(): void { try { ui.view()?.skipCinematic(); } catch { /* view not ready */ } }
  function onKey(e: KeyboardEvent): void {
    if (!active) return;
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doSkip(); }
  }

  function start(n: string): void {
    active = true; name = n;
    root.hidden = false;
    root.className = 'rv-cine rv-cine-' + n;
    hooks.hideHud();
    gsap.killTweensOf([top, bottom, skip, card]);
    gsap.fromTo(top, { yPercent: -100 }, { yPercent: 0, duration: D(0.7), ease: 'power3.out' });
    gsap.fromTo(bottom, { yPercent: 100 }, { yPercent: 0, duration: D(0.7), ease: 'power3.out' });
    gsap.fromTo(skip, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: D(0.4), delay: D(0.8) });
    gsap.set(card, { opacity: 0 });
  }

  function glitch(): gsap.core.Timeline {
    return gsap.timeline()
      .to(titleEl, { x: -7, skewX: 9, textShadow: '5px 0 #e86f6f, -5px 0 #6fb7e8', duration: 0.045, ease: 'none' })
      .to(titleEl, { x: 6, skewX: -7, duration: 0.045, ease: 'none' })
      .to(titleEl, { x: 0, skewX: 0, textShadow: '0 0 34px rgba(232,111,111,0.55)', duration: 0.09 });
  }

  function showCard(d: CineDetail): void {
    cardTl?.kill();
    titleEl.textContent = d.title ?? '';
    sub.textContent = d.subtitle ?? '';
    tag.textContent = TAGS[name] ?? '';
    tag.hidden = !tag.textContent;
    const slow = name === 'defeat' ? 1.7 : 1;
    const tl = gsap.timeline();
    cardTl = tl;
    tl.set(card, { opacity: 1 })
      .fromTo(tag, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: D(0.4 * slow) }, 0)
      .fromTo(titleEl, { opacity: 0, letterSpacing: '0.9em', filter: 'blur(10px)', y: 12 },
        { opacity: 1, letterSpacing: '0.32em', filter: 'blur(0px)', y: 0, duration: D(1.1 * slow), ease: 'power3.out' }, D(0.1))
      .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: D(0.9 * slow), ease: 'power2.inOut' }, D(0.3))
      .fromTo(sub, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.6 * slow) }, D(0.75));
    if (name === 'boss_intro' && !isReduced()) for (let i = 0; i < 4; i++) tl.add(glitch(), 0.45 + i * 0.4);
    if (name === 'victory') tl.fromTo(titleEl, { textShadow: '0 0 0px rgba(232,193,112,0)' }, { textShadow: '0 0 46px rgba(232,193,112,0.95)', duration: D(1.3), ease: 'sine.inOut', yoyo: true, repeat: 1 }, D(0.4));
    tl.to(card, { opacity: 0, duration: D(0.5), delay: D(1.9 * slow) });
  }

  function end(): void {
    if (!active) return;
    active = false;
    cardTl?.kill(); cardTl = null;
    gsap.killTweensOf([top, bottom, skip, card]);
    gsap.to(card, { opacity: 0, duration: D(0.3) });
    gsap.to(skip, { opacity: 0, duration: D(0.2) });
    gsap.to(top, { yPercent: -100, duration: D(0.5), ease: 'power3.in' });
    gsap.to(bottom, { yPercent: 100, duration: D(0.5), ease: 'power3.in', onComplete: () => { if (!active) root.hidden = true; } });
    hooks.showHud();
    const cbs = endCbs; endCbs = [];
    for (const cb of cbs) cb();
  }

  const onCine = (e: Event): void => {
    const d = (e as CustomEvent<CineDetail>).detail;
    if (!d || !d.phase) return;
    if (d.phase === 'start') start(d.name);
    else if (d.phase === 'card') { if (!active) start(d.name); showCard(d); }
    else end();
  };
  window.addEventListener('railavoid:cine', onCine);
  window.addEventListener('keydown', onKey, true);

  return {
    el: root,
    active: () => active,
    onEnd(cb, timeoutMs = 9000) {
      if (!active) { cb(); return; }
      let done = false;
      const run = () => { if (!done) { done = true; window.clearTimeout(timer); cb(); } };
      const timer = window.setTimeout(run, timeoutMs);
      endCbs.push(run);
    },
    destroy() { window.removeEventListener('railavoid:cine', onCine); window.removeEventListener('keydown', onKey, true); },
  };
}
