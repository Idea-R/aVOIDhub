/**
 * Cinematic dressing: letterbox bars, skip hint and title cards. The render layer moves the camera and
 * dispatches window CustomEvent 'railavoid:cine' ({ phase: 'start'|'card'|'end', name, title?, subtitle? }).
 *
 * The scripted 'opening' (first run of a profile, or "Watch intro") gets a deeper letterbox and per-card styling:
 *   1 studio card (Special Elite small caps, slow fade, gold rule) · 2–4 lower-third Cinzel titles that type on with
 *   the subtitle rising after (card 3 lights three line swatches) · 5 the wordmark moment (scale-in + bloom flash).
 * Enter / Esc / click skip; Space never does (it is the pause key).
 */
import { el, btn, hexColor } from './dom';
import type { UiShared } from './shared';
import { gsap, D, isReduced } from './motion';
import { LINE_COLORS } from '../core/config';

export interface CineDetail { phase: 'start' | 'card' | 'end'; name: string; title?: string; subtitle?: string }
export interface Cinematic {
  el: HTMLElement;
  active(): boolean;
  /** Run `cb` once the current cinematic ends (immediately when none is playing; after `timeoutMs` at the latest). */
  onEnd(cb: () => void, timeoutMs?: number): void;
  destroy(): void;
}
export interface CineHooks {
  hideHud(): void;
  showHud(): void;
  /** Let the mood driver re-apply the gameplay music after the opening borrowed the title mood. */
  moodReset?(): void;
}

const TAGS: Record<string, string> = { boss_intro: 'Boss', region_enter: 'Entering', run_intro: 'The last train', victory: 'Run complete', defeat: 'Run over' };
const TYPE_CPS = 28;
const letters = (word: string, cls: string): HTMLElement[] => Array.from(word).map(ch => el('span', { class: 'rv-ltr ' + cls, text: ch }));

export function createCinematic(ui: UiShared, hooks: CineHooks): Cinematic {
  const top = el('div', { class: 'rv-cine-bar rv-cine-top' });
  const bottom = el('div', { class: 'rv-cine-bar rv-cine-bottom' });
  const tag = el('div', { class: 'rv-cine-tag' });
  const titleEl = el('div', { class: 'rv-cine-title' });
  const rule = el('div', { class: 'rv-cine-rule' });
  const sub = el('div', { class: 'rv-cine-sub' });
  // opening extras: line swatches (card 3) and the wordmark block (card 5)
  const swatches = el('div', { class: 'rv-cine-swatches', 'aria-hidden': 'true' },
    ...LINE_COLORS.slice(0, 3).map(c => el('i', { style: `--c: ${hexColor(c)}` })));
  const railL = letters('RAIL', 'rv-rail-l');
  const aL = el('span', { class: 'rv-ltr rv-a-seg', text: 'a' });
  const voidL = letters('VOID', 'rv-void-l');
  const steam = el('span', { class: 'rv-steam', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
  const wordmark = el('div', { class: 'rv-wordmark', role: 'heading', 'aria-level': '1', 'aria-label': 'RAILaVOID' },
    ...railL, el('span', { class: 'rv-a-wrap' }, aL, steam), el('span', { class: 'rv-void-seg' }, ...voidL));
  const tagline = el('div', { class: 'rv-tagline rv-cine-tagline' });
  const wm = el('div', { class: 'rv-cine-wm' }, wordmark, tagline);
  const bloom = el('div', { class: 'rv-cine-bloom', 'aria-hidden': 'true' });
  const card = el('div', { class: 'rv-cine-card', 'aria-live': 'polite' }, tag, titleEl, rule, sub, swatches, wm);
  const skip = btn('Skip ▸', () => doSkip(), { class: 'rv-small rv-cine-skip', aria: 'Skip cinematic (Esc)' });
  const root = el('div', { class: 'rv-cine' }, top, bottom, bloom, card, skip);
  root.hidden = true;
  swatches.hidden = true; wm.hidden = true;

  let active = false, name = '';
  let openingIndex = 0;
  let cardTl: gsap.core.Timeline | null = null;
  let endCbs: Array<() => void> = [];
  const audio = () => ui.audio();
  const cue = (n: string): void => { try { audio().cue?.(n as never); } catch { /* audio not ready */ } };

  function doSkip(): void { try { ui.view()?.skipCinematic(); } catch { /* view not ready */ } }
  function onKey(e: KeyboardEvent): void {
    if (!active) return;
    // Space is the pause key and must never skip
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doSkip(); }
  }
  function onClick(): void { if (active && name === 'opening') doSkip(); }

  function start(n: string): void {
    active = true; name = n;
    openingIndex = 0;
    root.hidden = false;
    root.className = 'rv-cine rv-cine-' + n;
    skip.textContent = n === 'opening' ? 'Enter ▸ skip' : 'Skip ▸';
    hooks.hideHud();
    gsap.killTweensOf([top, bottom, skip, card, bloom]);
    gsap.fromTo(top, { yPercent: -100 }, { yPercent: 0, duration: D(0.7), ease: 'power3.out' });
    gsap.fromTo(bottom, { yPercent: 100 }, { yPercent: 0, duration: D(0.7), ease: 'power3.out' });
    gsap.fromTo(skip, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: D(0.4), delay: D(0.8) });
    gsap.set(card, { opacity: 0 });
    gsap.set(bloom, { opacity: 0 });
  }

  function glitch(): gsap.core.Timeline {
    return gsap.timeline()
      .to(titleEl, { x: -7, skewX: 9, textShadow: '5px 0 #e86f6f, -5px 0 #6fb7e8', duration: 0.045, ease: 'none' })
      .to(titleEl, { x: 6, skewX: -7, duration: 0.045, ease: 'none' })
      .to(titleEl, { x: 0, skewX: 0, textShadow: '0 0 34px rgba(232,111,111,0.55)', duration: 0.09 });
  }

  /** Reset every card element to a neutral state before a new card populates it. */
  function resetCard(): void {
    cardTl?.kill(); cardTl = null;
    const sw = Array.from(swatches.children);
    gsap.killTweensOf([card, tag, titleEl, rule, sub, swatches, wm, wordmark, tagline, bloom, ...railL, aL, ...voidL, ...sw]);
    gsap.set([tag, titleEl, rule, sub, swatches, wm, wordmark, tagline, ...railL, aL, ...voidL], { clearProps: 'all' });
    gsap.set(sw, { clearProps: 'transform,opacity' }); // keep the inline --c line colour
    titleEl.classList.remove('rv-cine-typing');
    for (const s of Array.from(swatches.children)) s.classList.remove('rv-lit');
    tag.hidden = false; titleEl.hidden = false; rule.hidden = false; sub.hidden = false; swatches.hidden = true; wm.hidden = true;
    card.className = 'rv-cine-card';
  }

  function showCard(d: CineDetail): void {
    if (name === 'opening') { showOpeningCard(d); return; }
    resetCard();
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

  // ---------- opening ----------
  type OpeningKind = 'studio' | 'lower' | 'lines' | 'wordmark';
  function classify(d: CineDetail, index: number): OpeningKind {
    const t = (d.title ?? '').trim(), s = (d.subtitle ?? '').trim();
    if (/^railavoid$/i.test(t)) return 'wordmark';
    if (/^avoid games$/i.test(t) || /^presents$/i.test(s)) return 'studio';
    if (/three lines/i.test(t) || /northern/i.test(s)) return 'lines';
    if (index === 1) return 'studio';
    if (index >= 5) return 'wordmark';
    return 'lower';
  }

  function showOpeningCard(d: CineDetail): void {
    resetCard();
    openingIndex++;
    const kind = classify(d, openingIndex);
    const title = d.title ?? '', subtitle = d.subtitle ?? '';
    tag.hidden = true;
    const tl = gsap.timeline();
    cardTl = tl;
    if (kind === 'studio') {
      card.className = 'rv-cine-card rv-op rv-op-studio';
      titleEl.textContent = title; sub.textContent = subtitle;
      cue('open_whistle');
      tl.set(card, { opacity: 1 })
        .fromTo(titleEl, { opacity: 0, letterSpacing: '0.55em', filter: 'blur(4px)' }, { opacity: 1, letterSpacing: '0.3em', filter: 'blur(0px)', duration: D(1.7), ease: 'sine.out' }, 0)
        .fromTo(rule, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: D(1.3), ease: 'power2.inOut' }, D(0.5))
        .fromTo(sub, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.9) }, D(1.1))
        .to(card, { opacity: 0, duration: D(0.7), ease: 'sine.in' }, D(2.7));
      return;
    }
    if (kind === 'wordmark') {
      card.className = 'rv-cine-card rv-op rv-op-wordmark';
      titleEl.hidden = true; sub.hidden = true; rule.hidden = true; wm.hidden = false;
      tagline.textContent = subtitle;
      cue('open_sting');
      try { audio().setMusicMood('title'); } catch { /* */ }
      tl.set(card, { opacity: 1 })
        .fromTo(bloom, { opacity: 0 }, { opacity: 0.85, duration: D(0.14), ease: 'power2.in' }, 0)
        .to(bloom, { opacity: 0, duration: D(1.1), ease: 'power2.out' }, D(0.14))
        .fromTo(wm, { scale: 1.15, opacity: 0, filter: 'blur(10px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: D(1.2), ease: 'power3.out' }, D(0.05))
        .fromTo(aL, { rotation: -180, scale: 0.4 }, { rotation: 0, scale: 1, duration: D(0.9), ease: 'back.out(1.6)' }, D(0.15))
        .fromTo(tagline, { opacity: 0, letterSpacing: '0.6em', y: 8 }, { opacity: 1, letterSpacing: '0.3em', y: 0, duration: D(1.1), ease: 'power2.out' }, D(0.8));
      if (!isReduced()) tl.add(flickerVoid(), 0.9);
      return;
    }
    // cards 2–4: lower-third Cinzel title typing on, subtitle rising after
    card.className = 'rv-cine-card rv-op rv-op-lower';
    titleEl.textContent = '';
    sub.textContent = subtitle;
    if (kind === 'lines') swatches.hidden = false;
    if (openingIndex === 2) cue('open_ticks');
    if (kind !== 'lines' && openingIndex >= 4) { cue('open_ticks_stop'); cue('open_drone'); }
    const typeDur = D(title.length / TYPE_CPS);
    const prog = { n: 0 };
    tl.set(card, { opacity: 1 })
      .fromTo(titleEl, { opacity: 0 }, { opacity: 1, duration: D(0.2) }, 0)
      .add(() => titleEl.classList.add('rv-cine-typing'), 0)
      .to(prog, { n: title.length, duration: typeDur, ease: 'none', onUpdate: () => { titleEl.textContent = title.slice(0, Math.round(prog.n)); } }, D(0.15))
      .add(() => { titleEl.textContent = title; titleEl.classList.remove('rv-cine-typing'); }, D(0.15) + typeDur + D(0.35))
      .fromTo(sub, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: D(0.75), ease: 'power3.out' }, D(0.15) + typeDur + D(0.2));
    let hold = D(0.15) + typeDur + D(0.2) + D(0.75);
    if (kind === 'lines') {
      const sw = Array.from(swatches.children) as HTMLElement[];
      sw.forEach((s, i) => {
        const at = hold - D(0.25) + D(i * 0.32);
        tl.add(() => { s.classList.add('rv-lit'); cue('open_tone' + (i + 1)); }, at)
          .fromTo(s, { opacity: 0.15, scale: 0.55 }, { opacity: 1, scale: 1, duration: D(0.4), ease: 'back.out(2.2)' }, at);
      });
      hold += D(3 * 0.32);
    }
    tl.to(card, { opacity: 0, duration: D(0.55), ease: 'sine.in' }, Math.max(hold + D(1.6), D(4.4)));
  }

  function flickerVoid(): gsap.core.Timeline {
    const tl = gsap.timeline();
    for (const o of [0.15, 1, 0.3, 1, 0.1, 0.85, 1]) tl.to(voidL, { opacity: o, duration: 0.05 + Math.random() * 0.06, ease: 'none', stagger: { each: 0.012, from: 'random' } });
    tl.to(voidL, { opacity: 1, duration: 0.25 });
    // a couple of single-letter sputters while the wordmark holds, like a failing neon sign
    for (let k = 0; k < 2; k++) {
      const l = voidL[Math.floor(Math.random() * voidL.length)];
      tl.to(l, { opacity: 0.25, duration: 0.05 }, 1.4 + k * 1.1).to(l, { opacity: 1, duration: 0.07 }).to(l, { opacity: 0.4, duration: 0.05 }).to(l, { opacity: 1, duration: 0.3 });
    }
    return tl;
  }

  function end(): void {
    if (!active) return;
    const wasOpening = name === 'opening';
    active = false;
    cardTl?.kill(); cardTl = null;
    gsap.killTweensOf([top, bottom, skip, card, bloom]);
    gsap.to(card, { opacity: 0, duration: D(wasOpening ? 0.6 : 0.3) });
    gsap.to(bloom, { opacity: 0, duration: D(0.2) });
    gsap.to(skip, { opacity: 0, duration: D(0.2) });
    gsap.to(top, { yPercent: -100, duration: D(0.5), ease: 'power3.in' });
    gsap.to(bottom, { yPercent: 100, duration: D(0.5), ease: 'power3.in', onComplete: () => { if (!active) root.hidden = true; } });
    if (wasOpening) { cue('open_stop'); hooks.moodReset?.(); }
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
  root.addEventListener('click', onClick);

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
    destroy() { window.removeEventListener('railavoid:cine', onCine); window.removeEventListener('keydown', onKey, true); root.removeEventListener('click', onClick); },
  };
}
