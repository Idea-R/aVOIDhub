/**
 * Bounty tracker: a compact quest list in the left rail under the route panel. Collapses to an icon strip with the
 * rail; hovering (or focusing) expands it to show the poster, the reward and the time left. Completed bounties
 * flash gold and fade out; failed ones strike through and fade.
 */
import { el, btn, setAttr, setText, setWidth, toggleClass, show, fmtTime, clamp } from './dom';
import type { UiShared } from './shared';
import type { SimState, Bounty } from '../core/types';
import { gsap, D, isReduced } from './motion';

export interface BountyTracker { el: HTMLElement; update(s: SimState): void; reset(): void; flash(id: string, kind: 'done' | 'failed'): void; pulse(id: string): void }

interface Row { id: string; el: HTMLElement; fill: HTMLElement; prog: HTMLElement; left: HTMLElement; sig: string; leaving: boolean }

const KIND_ICON: Record<Bounty['kind'], string> = { kill: '☠', deliver: '⚇', reach: '⚑' };

function fmtReward(r: Bounty['reward']): string {
  const parts: string[] = [];
  if (r.marks) parts.push(`◆ ${r.marks}`);
  if (r.rails) parts.push(`═ ${r.rails}`);
  if (r.scrap) parts.push(`⚙ ${r.scrap}`);
  return parts.join(' · ');
}

export function createBountyTracker(ui: UiShared): BountyTracker {
  const countEl = el('span', { class: 'rv-bounty-count', text: '0' });
  const listEl = el('div', { class: 'rv-bounty-list', role: 'list' });
  listEl.id = 'rv-bounty-list';
  const toggle = btn('Bounties', () => {
    const open = ui.root.classList.toggle('rv-bounties-open');
    setAttr(toggle, 'aria-expanded', String(open));
  }, { class: 'rv-small rv-bounties-toggle', aria: 'Bounties' });
  setAttr(toggle, 'aria-expanded', 'false'); setAttr(toggle, 'aria-controls', listEl.id);
  const root = el('div', { class: 'rv-bounties rv-panel', role: 'group', 'aria-label': 'Bounties', tabindex: '-1' },
    toggle,
    el('div', { class: 'rv-bounty-head' }, el('span', { class: 'rv-bounty-ico', 'aria-hidden': 'true', text: '◎' }), el('span', { class: 'rv-label', text: 'Bounties' }), countEl),
    listEl,
  );
  root.hidden = true;
  const rows = new Map<string, Row>();
  let lastTick = 0;

  function build(b: Bounty): Row {
    const fill = el('i');
    const prog = el('b', { class: 'rv-bounty-prog', text: `${b.progress}/${b.count}` });
    const left = el('span', { class: 'rv-bounty-left', text: '' });
    const node = el('div', { class: 'rv-bounty rv-b-' + b.kind, role: 'listitem' },
      el('div', { class: 'rv-bounty-row' },
        el('span', { class: 'rv-bounty-kico', 'aria-hidden': 'true', text: KIND_ICON[b.kind] ?? '◎' }),
        el('span', { class: 'rv-bounty-title', text: b.title }),
        prog),
      el('div', { class: 'rv-bar rv-bounty-bar' }, fill),
      el('div', { class: 'rv-bounty-meta' }, el('span', { class: 'rv-bounty-from', text: b.fromName }), left),
      el('div', { class: 'rv-bounty-more' },
        el('div', { class: 'rv-bounty-desc', text: b.desc }),
        el('div', { class: 'rv-bounty-reward', text: 'Reward ' + fmtReward(b.reward) })),
    );
    return { id: b.id, el: node, fill, prog, left, sig: '', leaving: false };
  }

  function update(s: SimState): void {
    const now = performance.now();
    if (now - lastTick < 250) return;
    lastTick = now;
    const list = (s.bounties ?? []).filter(b => b.status === 'active' || rows.has(b.id));
    const seen = new Set<string>();
    let active = 0;
    for (const b of list) {
      seen.add(b.id);
      let r = rows.get(b.id);
      if (!r) {
        if (b.status !== 'active') continue;
        r = build(b);
        rows.set(b.id, r);
        listEl.appendChild(r.el);
        if (!isReduced()) gsap.fromTo(r.el, { x: -24, opacity: 0, height: 0 }, { x: 0, opacity: 1, height: 'auto', duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity,height' });
      }
      if (b.status === 'active') active++;
      if (r.leaving) continue;
      const remain = Math.max(0, b.expiresAt - s.time);
      const sig = `${b.progress}/${b.count}|${Math.floor(remain)}|${b.status}`;
      if (sig === r.sig) continue;
      r.sig = sig;
      setText(r.prog, `${Math.min(b.progress, b.count)}/${b.count}`);
      setWidth(r.fill, clamp(b.count > 0 ? b.progress / b.count : 0, 0, 1) * 100);
      setText(r.left, b.status === 'active' ? fmtTime(remain) : b.status === 'done' ? 'done' : 'failed');
      toggleClass(r.el, 'rv-urgent', b.status === 'active' && remain < 60);
      if (b.status !== 'active') flash(b.id, b.status === 'done' ? 'done' : 'failed');
    }
    for (const [id, r] of rows) if (!seen.has(id) && !r.leaving) leave(r, 0);
    setText(countEl, String(active));
    show(root, rows.size > 0);
  }

  function flash(id: string, kind: 'done' | 'failed'): void {
    const r = rows.get(id);
    if (!r || r.leaving) return;
    r.leaving = true;
    r.el.classList.add(kind === 'done' ? 'rv-done' : 'rv-failed');
    setText(r.left, kind === 'done' ? 'complete' : 'failed');
    if (kind === 'done') { setWidth(r.fill, 100); if (!isReduced()) gsap.fromTo(r.el, { scale: 1.06 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' }); }
    leave(r, kind === 'done' ? 3600 : 2600);
  }

  function leave(r: Row, delay: number): void {
    r.leaving = true;
    const gone = () => { r.el.remove(); rows.delete(r.id); if (!rows.size) root.hidden = true; };
    window.setTimeout(() => {
      if (!r.el.isConnected) return;
      if (isReduced()) { gone(); return; }
      gsap.to(r.el, { x: -20, opacity: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to(r.el, { height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, duration: 0.3, delay: 0.2, ease: 'power2.inOut', onComplete: gone });
    }, delay);
  }

  function pulse(id: string): void {
    const r = rows.get(id);
    if (!r || isReduced()) return;
    gsap.fromTo(r.prog, { scale: 1.5, color: '#fff' }, { scale: 1, color: '', duration: D(0.4), ease: 'power2.out', clearProps: 'transform,color' });
  }

  function reset(): void {
    ui.root.classList.remove('rv-bounties-open'); setAttr(toggle, 'aria-expanded', 'false');
    rows.clear(); listEl.replaceChildren(); root.hidden = true; lastTick = 0;
  }

  return { el: root, update, reset, flash, pulse };
}
