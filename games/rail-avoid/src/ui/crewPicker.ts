/**
 * Crew picker for Expedition Sites: after the 'node_site' event resolves with "Send an expedition" the player picks
 * up to three crew members (HP > 20). The Conductor always goes and is locked in. START → sim.startExpedition(ids).
 */
import { el, btn, setText, toggleClass, cap } from './dom';
import type { UiShared } from './shared';
import type { Crew } from '../core/types';
import { SPECIALS } from '../sim/expedition';
import { EXPEDITION } from '../core/config';
import { gsap, D, isReduced, rowsIn, shake } from './motion';
import { crewSilhouette } from './silhouettes';
import conductorPortrait from '/art/crew/conductor.webp?url&inline';

export interface CrewPicker { el: HTMLElement; open(): void; gamepad(button: number): boolean }

export function createCrewPicker(ui: UiShared, hooks: { onCancel(): void }): CrewPicker {
  const box = el('div', { class: 'rv-panel rv-modal rv-crewpick' });
  const overlay = el('div', { class: 'rv-overlay rv-zone', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose the expedition crew' }, box);
  let rows: Array<{ crew: Crew; el: HTMLButtonElement; locked: boolean }> = [];
  let chosen = new Set<string>();
  let started = false;
  let countEl: HTMLElement = el('span');
  let startBtn: HTMLButtonElement = el('button');

  function eligible(): Crew[] {
    const s = ui.state();
    return (s?.train.crew ?? []).filter(c => c.hp > 20);
  }

  function render(): void {
    const crew = eligible();
    const conductor = crew.find(c => c.specialty === 'conductor');
    chosen = new Set(conductor ? [conductor.id] : []);
    rows = crew.map((c, i) => {
      const locked = c.specialty === 'conductor';
      const sp = SPECIALS[c.specialty];
      const hpR = Math.max(0, Math.min(1, c.hp / 100));
      const row = el('button', {
        class: 'rv-crewpick-row' + (locked ? ' rv-locked rv-on' : ''), type: 'button', role: 'checkbox', 'aria-checked': locked ? 'true' : 'false',
        'aria-label': `${c.name}, ${c.specialty}, ${Math.round(c.hp)} HP${locked ? ', always goes' : ''}`,
      },
        el('span', { class: 'rv-cp-key', 'aria-hidden': 'true', text: String(i + 1) }),
        c.specialty === 'conductor'
          ? el('span', { class: 'rv-cp-fig rv-cp-portrait', 'aria-hidden': 'true' }, el('img', { src: conductorPortrait, alt: '' }))
          : el('span', { class: 'rv-cp-fig', 'aria-hidden': 'true', html: crewSilhouette(c.specialty, 42) }),
        el('span', { class: 'rv-cp-main' },
          el('span', { class: 'rv-cp-name' }, el('b', { text: c.name }), el('span', { class: 'rv-cp-spec', text: cap(c.specialty) }), locked ? el('span', { class: 'rv-cp-tag', text: 'always goes' }) : null),
          el('span', { class: 'rv-cp-hp' }, el('span', { class: 'rv-bar' }, el('i', { style: `width:${Math.round(hpR * 100)}%;background:${hpR < 0.35 ? 'var(--danger)' : hpR < 0.6 ? 'var(--gold)' : 'var(--good)'}` })), el('span', { text: `${Math.round(c.hp)} HP` })),
          el('span', { class: 'rv-cp-special' }, el('b', { text: sp?.name ?? 'Special' }), ' — ', sp?.desc ?? ''),
        ),
        el('span', { class: 'rv-cp-check', 'aria-hidden': 'true', text: locked ? '🔒' : '' }),
      );
      row.addEventListener('click', () => toggle(c.id));
      return { crew: c, el: row, locked };
    });
    countEl = el('span', { class: 'rv-cp-count' });
    startBtn = btn('Start expedition', () => start(), { class: 'rv-primary', aria: 'Start the expedition (Enter)' });
    startBtn.dataset.autofocus = '';
    box.replaceChildren(
      el('div', { class: 'rv-label', text: 'Expedition site' }),
      el('h2', { text: 'Who goes?' }),
      el('p', { class: 'rv-crewpick-lead', text: `Pick up to ${EXPEDITION.maxCrew}. The void gains ${EXPEDITION.voidSecondsPerRound} s of travel for every round the crew is away. Wounded crew (20 HP or less) stay aboard.` }),
      el('div', { class: 'rv-crewpick-list rv-rows', role: 'group', 'aria-label': 'Crew' }, ...rows.map(r => r.el)),
      el('div', { class: 'rv-actions rv-crewpick-actions' }, countEl, startBtn, btn('Cancel', () => cancel(), { aria: 'Cancel (Esc)' })),
      el('div', { class: 'rv-hint', text: 'Press 1-9 to toggle a crew member · Enter to start · Esc to stay aboard.' }),
    );
    sync();
  }

  function toggle(id: string): void {
    const r = rows.find(x => x.crew.id === id);
    if (!r) return;
    if (r.locked) { ui.audio().ui('error'); shake(r.el, 3, 0.2); return; }
    if (chosen.has(id)) { chosen.delete(id); ui.audio().ui('click'); }
    else if (chosen.size >= EXPEDITION.maxCrew) { ui.audio().ui('error'); shake(r.el, 4, 0.25); return; }
    else { chosen.add(id); ui.audio().ui('confirm'); if (!isReduced()) gsap.fromTo(r.el, { scale: 1.03 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', clearProps: 'transform' }); }
    sync();
  }

  function sync(): void {
    for (const r of rows) {
      const on = chosen.has(r.crew.id);
      toggleClass(r.el, 'rv-on', on);
      r.el.setAttribute('aria-checked', on ? 'true' : 'false');
      const chk = r.el.querySelector('.rv-cp-check');
      setText(chk, r.locked ? '🔒' : on ? '✓' : '');
      const full = chosen.size >= EXPEDITION.maxCrew && !on;
      toggleClass(r.el, 'rv-full', full);
    }
    setText(countEl, `${chosen.size} / ${EXPEDITION.maxCrew} chosen`);
    startBtn.disabled = chosen.size === 0;
  }

  function start(): void {
    const sim = ui.sim();
    if (!sim || chosen.size === 0) { ui.audio().ui('error'); return; }
    const ids = rows.filter(r => chosen.has(r.crew.id)).map(r => r.crew.id);
    const ok = sim.startExpedition(ids);
    if (!ok) { ui.audio().ui('error'); ui.notify('The crew cannot leave right now.', 'warn'); return; }
    started = true;
    ui.audio().ui('confirm');
    ui.close('crewpick');
  }
  function cancel(): void {
    ui.audio().ui('close');
    ui.close('crewpick');
  }

  overlay.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= rows.length) { e.preventDefault(); toggle(rows[n - 1].crew.id); return; }
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement && e.target.classList.contains('rv-crewpick-row'))) { e.preventDefault(); start(); }
  });

  function gamepad(button: number): boolean {
    if (!ui.isOpen('crewpick')) return false;
    if (button === 0) { const a = document.activeElement as HTMLElement | null; if (a && box.contains(a)) a.click(); else start(); return true; }
    if (button === 1) { cancel(); return true; }
    if (button === 2) { start(); return true; }
    if (button === 12 || button === 13) {
      const f = Array.from(box.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      const cur = f.indexOf(document.activeElement as HTMLElement);
      const next = f[(cur + (button === 12 ? -1 : 1) + f.length) % f.length];
      next?.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  ui.registerPanel('crewpick', {
    el: overlay, modal: true, escClosable: true, anim: 'modal',
    onOpen: () => { started = false; },
    onClose: () => { if (!started) hooks.onCancel(); },
  });

  return {
    el: overlay,
    open() {
      const s = ui.state();
      if (!s) return;
      if (!eligible().length) { ui.notify('Nobody is fit to leave the train.', 'warn'); hooks.onCancel(); return; }
      render();
      ui.open('crewpick');
      rowsIn(rows.map(r => r.el), { delay: D(0.1) }, { x: -20, y: 0 });
    },
    gamepad,
  };
}
