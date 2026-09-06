/** Complete, stationary telegrams. One at a time, queued while a task panel is open. */
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/special-elite/400.css';
import './announce.css';
import { el } from './dom';
import type { UiShared } from './shared';
import { gsap, isReduced } from './motion';

export type AnnounceTone = 'gold' | 'void' | 'good' | 'bad' | 'info';
export interface Announcement { cat: string; title: string; body?: string; tone?: AnnounceTone; hold?: number }
export interface Announcer {
  el: HTMLElement; announce(a: Announcement): void; skip(): void; reset(): void; visible(): boolean; destroy(): void;
  hold(on: boolean): void;
}

export function createAnnouncer(ui: UiShared): Announcer {
  const layer = el('div', { class: 'rv-announce-layer', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const queue: Announcement[] = [];
  const recent = new Map<string, number>();
  let current: { a: Announcement; el: HTMLElement; timer: number; done: boolean } | null = null;
  let held = false;

  function announce(a: Announcement): void {
    if (!a?.title) return;
    const key = a.title.trim().toLowerCase(), now = performance.now();
    if (now - (recent.get(key) ?? -Infinity) < 5000) return;
    recent.set(key, now);
    for (const [k, at] of recent) if (now - at > 5000) recent.delete(k);
    queue.push(a);
    if (!current && !held) next();
  }
  function hold(on: boolean): void {
    if (held === on) return;
    held = on;
    if (on && current && !current.done) { queue.unshift(current.a); finish(current); }
    else if (!on && !current) next();
  }
  function next(): void {
    if (held) return;
    const a = queue.shift();
    if (!a) return;
    const card = el('div', { class: 'rv-announce rv-panel rv-tone-' + (a.tone ?? 'gold'), role: 'button', tabindex: '0', 'aria-label': a.cat + ': ' + a.title + '. ' + (a.body ?? '') + ' Dismiss notice.' },
      el('div', { class: 'rv-ann-head' }, el('i'), el('span', { text: a.cat }), el('i')),
      el('div', { class: 'rv-ann-title', text: a.title }),
      el('div', { class: 'rv-ann-rule' }),
      el('div', { class: 'rv-ann-body rv-typed', text: a.body ?? '' }));
    card.addEventListener('click', skip);
    card.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); skip(); }
    });
    layer.replaceChildren(card);
    const cur = { a, el: card, timer: 0, done: false };
    current = cur;
    // Reading time starts with complete text, not after a typewriter reveal.
    const seconds = Math.max(4.5, a.hold ?? 0, (a.body?.length ?? 0) / 24);
    cur.timer = window.setTimeout(() => finish(cur), seconds * 1000);
    if (!isReduced()) gsap.fromTo(card, { opacity: 0 }, { opacity: 1, duration: .2, clearProps: 'opacity' });
  }
  function finish(cur: NonNullable<typeof current>): void {
    if (cur.done) return;
    cur.done = true;
    clearTimeout(cur.timer);
    gsap.killTweensOf(cur.el);
    const gone = () => { cur.el.remove(); if (current === cur) current = null; next(); };
    if (isReduced()) gone();
    else gsap.to(cur.el, { opacity: 0, duration: .18, onComplete: gone });
  }
  function skip(): void { if (current) finish(current); }
  function reset(): void {
    queue.length = 0; recent.clear();
    if (current) { current.done = true; clearTimeout(current.timer); gsap.killTweensOf(current.el); current.el.remove(); current = null; }
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !current || held || ui.anyModal() || e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, a, [role="button"], [contenteditable="true"]')) return;
    e.preventDefault(); e.stopImmediatePropagation(); skip();
  };
  document.addEventListener('keydown', onKey, true);
  return { el: layer, announce, skip, hold, visible: () => !!current, reset,
    destroy() { reset(); document.removeEventListener('keydown', onKey, true); } };
}
