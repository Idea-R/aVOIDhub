/**
 * Announcements: important notices arrive as a telegram / ticket card upper-centre of the screen (inside the free
 * zone: below the top bar, beside the left rail, clear of side panels and toasts). Dark navy plate, gold hairline
 * frame, violet corner accents; a category header, a Cinzel title and a typewriter body line.
 * One card at a time; a queue plays the rest; identical titles within 5 s are dropped; click / Enter skips (Space stays the pause key).
 */
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/special-elite/400.css';
import './announce.css';
import { el } from './dom';
import type { UiShared } from './shared';
import { gsap, isReduced } from './motion';

export type AnnounceTone = 'gold' | 'void' | 'good' | 'bad' | 'info';
export interface Announcement { cat: string; title: string; body?: string; tone?: AnnounceTone; hold?: number }
export interface Announcer { el: HTMLElement; announce(a: Announcement): void; skip(): void; reset(): void; visible(): boolean; destroy(): void }

const CHARS_PER_S = 26;
const BASE_HOLD = 2.8;

export function createAnnouncer(ui: UiShared): Announcer {
  const layer = el('div', { class: 'rv-announce-layer', role: 'status', 'aria-live': 'polite' });
  const queue: Announcement[] = [];
  const recent = new Map<string, number>();
  let current: { el: HTMLElement; body: HTMLElement; text: string; tl: gsap.core.Timeline | null; typeTimer: number; holdTimer: number; done: boolean } | null = null;

  function announce(a: Announcement): void {
    if (!a || !a.title) return;
    const now = performance.now();
    const key = a.title.trim().toLowerCase();
    const last = recent.get(key) ?? -Infinity;
    if (now - last < 5000) return;
    recent.set(key, now);
    if (recent.size > 40) { for (const [k, t] of recent) if (now - t > 5000) recent.delete(k); }
    queue.push(a);
    if (!current) next();
  }

  function build(a: Announcement): { card: HTMLElement; body: HTMLElement; rule: HTMLElement; title: HTMLElement; head: HTMLElement } {
    const head = el('div', { class: 'rv-ann-head' }, el('i'), el('span', { text: a.cat.toUpperCase() }), el('i'));
    const title = el('div', { class: 'rv-ann-title', text: a.title });
    const rule = el('div', { class: 'rv-ann-rule' });
    const body = el('div', { class: 'rv-ann-body' + (a.body ? '' : ' rv-empty') }, el('span', { class: 'rv-ann-text' }), el('span', { class: 'rv-ann-caret', 'aria-hidden': 'true' }));
    const card = el('div', { class: 'rv-announce rv-panel rv-tone-' + (a.tone ?? 'gold'), tabindex: '-1' },
      el('span', { class: 'rv-ann-corner rv-c-tl', 'aria-hidden': 'true' }), el('span', { class: 'rv-ann-corner rv-c-tr', 'aria-hidden': 'true' }),
      el('span', { class: 'rv-ann-corner rv-c-bl', 'aria-hidden': 'true' }), el('span', { class: 'rv-ann-corner rv-c-br', 'aria-hidden': 'true' }),
      el('span', { class: 'rv-ann-punch', 'aria-hidden': 'true' }),
      head, title, rule, body,
    );
    card.addEventListener('click', () => skip());
    return { card, body, rule, title, head };
  }

  function next(): void {
    const a = queue.shift();
    if (!a) return;
    const { card, body, rule, title, head } = build(a);
    const text = a.body ?? '';
    const textEl = body.querySelector<HTMLElement>('.rv-ann-text')!;
    layer.replaceChildren(card);
    const hold = (a.hold ?? BASE_HOLD) + Math.max(0, text.length - 40) * 0.03;
    const cur = { el: card, body, text, tl: null as gsap.core.Timeline | null, typeTimer: 0, holdTimer: 0, done: false };
    current = cur;
    if (isReduced()) {
      textEl.textContent = text;
      body.classList.add('rv-typed');
      cur.holdTimer = window.setTimeout(() => finish(cur), hold * 1000 + 600);
      return;
    }
    gsap.set(card, { transformOrigin: '50% 0%' });
    const tl = gsap.timeline();
    cur.tl = tl;
    tl.fromTo(card, { y: -40, opacity: 0, scaleY: 0.6 }, { y: 0, opacity: 1, scaleY: 1, duration: 0.45, ease: 'power3.out' }, 0)
      .fromTo(head, { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.34em', duration: 0.5 }, 0.15)
      .fromTo(title, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 0.22)
      .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, 0.3)
      .add(() => type(cur, textEl, hold), 0.55);
  }

  function type(cur: NonNullable<typeof current>, textEl: HTMLElement, hold: number): void {
    const text = cur.text;
    if (!text) { cur.body.classList.add('rv-typed'); cur.holdTimer = window.setTimeout(() => finish(cur), hold * 1000); return; }
    // wall-clock driven so dropped frames never slow the reveal; punctuation adds a small beat
    const t0 = performance.now();
    let shown = 0, pauseMs = 0, lastTick = 0;
    const tick = () => {
      if (cur.done || current !== cur) return;
      const want = Math.min(text.length, Math.floor((performance.now() - t0 - pauseMs) * CHARS_PER_S / 1000));
      if (want > shown) {
        for (let i = shown; i < want; i++) { const ch = text[i]; if (ch === '.' || ch === ',') pauseMs += 90; }
        shown = want;
        textEl.textContent = text.slice(0, shown);
        if (shown - lastTick >= 3 && text[shown - 1] !== ' ') { lastTick = shown; try { ui.audio().ui('hover'); } catch { /* */ } }
      }
      if (shown < text.length) cur.typeTimer = window.setTimeout(tick, 1000 / CHARS_PER_S);
      else { cur.body.classList.add('rv-typed'); cur.holdTimer = window.setTimeout(() => finish(cur), hold * 1000); }
    };
    cur.typeTimer = window.setTimeout(tick, 1000 / CHARS_PER_S);
  }

  function finish(cur: NonNullable<typeof current>): void {
    if (cur.done) return;
    cur.done = true;
    window.clearTimeout(cur.typeTimer); window.clearTimeout(cur.holdTimer);
    cur.tl?.kill();
    const gone = () => { if (cur.el.isConnected) cur.el.remove(); if (current === cur) current = null; next(); };
    if (isReduced()) { gone(); return; }
    gsap.to(cur.el, { y: -18, opacity: 0, scaleY: 0.6, duration: 0.28, ease: 'power2.in', onComplete: gone });
  }

  function skip(): void {
    const cur = current;
    if (!cur) return;
    const textEl = cur.body.querySelector<HTMLElement>('.rv-ann-text');
    // first press completes the typing, second (or a fully shown card) dismisses it
    if (textEl && textEl.textContent !== cur.text && !cur.body.classList.contains('rv-typed')) {
      window.clearTimeout(cur.typeTimer);
      textEl.textContent = cur.text;
      cur.body.classList.add('rv-typed');
      cur.tl?.progress(1);
      window.clearTimeout(cur.holdTimer);
      cur.holdTimer = window.setTimeout(() => finish(cur), 1200);
      return;
    }
    finish(cur);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' || !current || ui.anyModal() || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    skip();
  };
  document.addEventListener('keydown', onKey, true);

  return {
    el: layer,
    announce,
    skip,
    visible: () => !!current,
    reset() {
      queue.length = 0; recent.clear();
      if (current) { current.done = true; window.clearTimeout(current.typeTimer); window.clearTimeout(current.holdTimer); current.tl?.kill(); current.el.remove(); current = null; }
    },
    destroy() { document.removeEventListener('keydown', onKey, true); },
  };
}
