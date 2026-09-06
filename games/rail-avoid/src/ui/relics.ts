/**
 * Relic choice: a 1-of-3 card modal shown while state.phase === 'relic' (elite kills, bosses, expeditions, markets).
 * Cards tilt toward the pointer; picking one lifts it, drops the others and flies a chip to the HUD relic bar.
 */
import { el, btn, focusables } from './dom';
import type { UiShared } from './shared';
import type { SimState } from '../core/types';
import { relicDef, type RelicDef } from '../core/relics';
import { gsap, D, isReduced, rowsIn, shake } from './motion';

export interface RelicModal { el: HTMLElement; show(): void; update(s: SimState): void; gamepad(button: number): boolean }

const SOURCE_LABEL: Record<string, string> = {
  elite: 'Elite salvage', boss: 'Boss trophy', expedition: 'Expedition spoils', market: 'Bought at the market', debug: 'Dev offer', shrine: 'Shrine blessing',
};
const RARITY_LABEL: Record<string, string> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

export function createRelicModal(ui: UiShared, hooks: { relicBarAnchor(): HTMLElement | null }): RelicModal {
  const box = el('div', { class: 'rv-panel rv-modal rv-relic-modal' });
  const overlay = el('div', { class: 'rv-overlay rv-relic-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose a relic' }, box);
  let cards: HTMLButtonElement[] = [];
  let sig = '';
  let picking = false;

  function render(options: string[], source: string): void {
    picking = false;
    const defs = options.map(id => relicDef(id) ?? ({ id, name: id, desc: '', rarity: 'common', icon: '✦' } as RelicDef));
    const row = el('div', { class: 'rv-relic-cards', role: 'group', 'aria-label': 'Relic choices' });
    cards = defs.map((d, i) => {
      const card = el('button', {
        class: 'rv-relic-card rv-r-' + d.rarity, type: 'button',
        'aria-label': `${i + 1}. ${d.name}, ${RARITY_LABEL[d.rarity] ?? d.rarity}. ${d.desc}`,
        ...(i === 0 ? { 'data-autofocus': '' } : {}),
      },
        el('span', { class: 'rv-relic-key', 'aria-hidden': 'true', text: String(i + 1) }),
        el('span', { class: 'rv-relic-shine', 'aria-hidden': 'true' }),
        el('span', { class: 'rv-relic-icon', 'aria-hidden': 'true', text: d.icon }),
        el('span', { class: 'rv-relic-name', text: d.name }),
        el('span', { class: 'rv-relic-rarity', text: RARITY_LABEL[d.rarity] ?? d.rarity }),
        el('span', { class: 'rv-relic-desc', text: d.desc }),
        el('span', { class: 'rv-relic-source', text: SOURCE_LABEL[source] ?? source }),
      );
      card.addEventListener('click', () => pick(i));
      card.addEventListener('pointermove', (e) => tilt(card, e));
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); card.style.setProperty('--gx', '50%'); card.style.setProperty('--gy', '50%'); });
      card.addEventListener('pointerenter', () => ui.audio().ui('hover'));
      row.appendChild(card);
      return card;
    });
    box.replaceChildren(
      el('div', { class: 'rv-label rv-relic-label', text: SOURCE_LABEL[source] ?? 'A relic surfaces' }),
      el('h2', { text: 'Choose a relic' }),
      el('p', { class: 'rv-relic-lead', text: 'One permanent passive for the rest of the run. The other two are lost.' }),
      row,
      el('div', { class: 'rv-hint', text: 'Press 1-3 or click a card. Left / right to browse, Enter to take.' }),
    );
  }

  function tilt(card: HTMLElement, e: PointerEvent): void {
    if (isReduced() || picking) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
    const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
    card.style.setProperty('--ry', (px * 16).toFixed(2) + 'deg');
    card.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
    card.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
    card.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
  }

  function pick(i: number): void {
    const sim = ui.sim();
    const s = ui.state();
    if (!sim || !s || picking) return;
    const pc = s.pendingRelicChoice;
    if (!pc || !pc.options[i]) { ui.audio().ui('error'); return; }
    picking = true;
    ui.audio().ui('confirm');
    const chosen = cards[i];
    const others = cards.filter((_, k) => k !== i);
    for (const c of cards) { c.disabled = true; c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
    chosen.classList.add('rv-picked');
    const commit = () => {
      const ok = sim.chooseRelic(i);
      if (!ok) { picking = false; for (const c of cards) c.disabled = false; ui.audio().ui('error'); return; }
      sig = '';
      ui.close('relic');
    };
    if (isReduced()) { commit(); return; }
    const tl = gsap.timeline();
    tl.to(others, { y: 40, opacity: 0, scale: 0.92, duration: 0.28, ease: 'power2.in', stagger: 0.04 }, 0)
      .to(chosen, { scale: 1.08, y: -10, duration: 0.3, ease: 'back.out(2)' }, 0)
      .add(() => shake(box, 3, 0.25), 0.28)
      .to(chosen, { scale: 1, y: 0, duration: 0.2, ease: 'power2.inOut' }, 0.5)
      .add(() => flyToBar(chosen), 0.5)
      .add(commit, 0.85);
  }

  /** A glyph chip flies from the chosen card to the HUD relic bar. */
  function flyToBar(card: HTMLElement): void {
    const anchor = hooks.relicBarAnchor();
    const icon = card.querySelector<HTMLElement>('.rv-relic-icon');
    if (!icon) return;
    const from = icon.getBoundingClientRect();
    const fly = el('span', { class: 'rv-fly', 'aria-hidden': 'true' }, el('span', { class: 'rv-fly-chip rv-relic-fly', text: icon.textContent ?? '✦' }));
    ui.root.appendChild(fly);
    const rootR = ui.root.getBoundingClientRect();
    const sx = from.left + from.width / 2 - rootR.left, sy = from.top + from.height / 2 - rootR.top;
    let tx = 40, ty = 40;
    if (anchor && anchor.isConnected) {
      const r = anchor.getBoundingClientRect();
      tx = (r.width > 0 ? r.right - 14 : r.left + 20) - rootR.left; ty = (r.height > 0 ? r.top + r.height / 2 : r.top + 12) - rootR.top;
    }
    gsap.set(fly, { x: sx, y: sy });
    gsap.timeline({ onComplete: () => fly.remove() })
      .to(fly, { x: tx, y: ty, duration: 0.55, ease: 'power2.in' })
      .to(fly, { scale: 0.4, opacity: 0, duration: 0.15 }, '-=0.05');
  }

  function show(): void {
    const s = ui.state();
    const pc = s?.pendingRelicChoice;
    if (!s || !pc) return;
    const k = pc.options.join(',') + '|' + pc.source;
    if (k === sig && ui.isOpen('relic')) return;
    sig = k;
    render(pc.options, pc.source);
    ui.open('relic');
    // deal the cards in from below, one after another
    gsap.killTweensOf(cards);
    if (!isReduced()) {
      gsap.fromTo(cards, { y: 60, opacity: 0, rotateY: -25, scale: 0.9 }, { y: 0, opacity: 1, rotateY: 0, scale: 1, duration: 0.55, ease: 'back.out(1.4)', stagger: 0.1, delay: 0.15, clearProps: 'transform,opacity' });
    }
    rowsIn(Array.from(box.children).filter(c => !c.classList.contains('rv-relic-cards')), { delay: D(0.05) });
  }

  function update(s: SimState): void {
    if (!ui.isOpen('relic')) return;
    if (s.phase !== 'relic' || !s.pendingRelicChoice) { sig = ''; ui.close('relic'); }
  }

  function moveFocus(dir: number): void {
    const f = focusables(box);
    if (!f.length) return;
    const cur = f.indexOf(document.activeElement as HTMLElement);
    const next = f[(cur < 0 ? (dir > 0 ? 0 : f.length - 1) : (cur + dir + f.length) % f.length)];
    next.focus({ preventScroll: true });
    ui.audio().ui('hover');
  }

  overlay.addEventListener('keydown', (e) => {
    if (e.repeat) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= cards.length) { e.preventDefault(); e.stopPropagation(); pick(n - 1); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
  });

  function gamepad(button: number): boolean {
    if (!ui.isOpen('relic')) return false;
    if (button === 14) { moveFocus(-1); return true; }
    if (button === 15) { moveFocus(1); return true; }
    if (button === 0) {
      const a = document.activeElement as HTMLElement | null;
      const i = cards.indexOf(a as HTMLButtonElement);
      pick(i >= 0 ? i : 0);
      return true;
    }
    return false;
  }

  ui.registerPanel('relic', { el: overlay, modal: true, escClosable: false, anim: 'fade', onClose: () => { sig = ''; } });
  void btn;
  return { el: overlay, show, update, gamepad };
}
