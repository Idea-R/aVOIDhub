/** Passenger event modal. */
import { el, cap } from './dom';
import type { UiShared } from './shared';
import type { SimState, PassengerEventDef, PassengerEventOption } from '../core/types';
import { eventById } from '../core/passengerEvents';
import { CAR_DEFS } from '../core/cars';
import { gsap, D, isReduced, rowsIn } from './motion';

export interface EventModal { el: HTMLElement; show(defId?: string): void; update(s: SimState): void }

function unmet(s: SimState, o: PassengerEventOption): string | null {
  const r = o.requires;
  if (!r) return null;
  if (r.car) {
    const has = s.train.cars.some(c => c.type === r.car && c.hp > 0);
    if (!has) return `Requires a ${CAR_DEFS[r.car]?.name ?? r.car}`;
  }
  if (r.resource) {
    const need = r.amount ?? 1;
    const have = s.train.resources[r.resource] ?? 0;
    if (have < need) return `Requires ${need} ${r.resource} (have ${Math.floor(have)})`;
  }
  return null;
}

export function createEventModal(ui: UiShared): EventModal {
  const box = el('div', { class: 'rv-panel rv-modal rv-event' });
  const overlay = el('div', { class: 'rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Passenger event' }, box);
  let currentId: string | null = null;
  let optionButtons: Array<{ btn: HTMLButtonElement; why: HTMLElement; opt: PassengerEventOption }> = [];

  function render(def: PassengerEventDef, s: SimState | null): void {
    optionButtons = [];
    box.className = 'rv-panel rv-modal rv-event' + (def.negative ? ' rv-negative' : '');
    const options = el('div', { class: 'rv-options', role: 'group', 'aria-label': 'Choices' });
    def.options.forEach((o, i) => {
      const why = el('span', { class: 'rv-opt-why' });
      const b = el('button', { class: 'rv-btn rv-option', type: 'button', 'aria-label': `${o.label}. ${o.desc}` },
        el('span', { class: 'rv-opt-label', text: `${i + 1}. ${o.label}` }),
        el('span', { class: 'rv-opt-desc', text: o.desc }),
        why,
      );
      b.addEventListener('click', () => {
        const sim = ui.sim();
        if (!sim) return;
        const st = ui.state();
        if (st && unmet(st, o)) { ui.audio().ui('error'); return; }
        const ok = sim.chooseEventOption(i);
        if (ok) { ui.audio().ui('confirm'); currentId = null; ui.close('event'); }
        else ui.audio().ui('error');
      });
      options.appendChild(b);
      optionButtons.push({ btn: b, why, opt: o });
    });
    const h2 = el('h2', { text: def.title });
    box.replaceChildren(
      el('div', { class: 'rv-label rv-wire', text: def.negative ? 'Trouble aboard' : 'Aboard the train' }),
      h2,
      el('p', { class: 'rv-event-text', text: def.text }),
      options,
      el('div', { class: 'rv-hint', text: 'Press 1-3 to choose. The train waits while you decide.' }),
    );
    if (s) update(s);
    pendingWire = () => telegram(def.title, h2, options);
  }
  let pendingWire: (() => void) | null = null;

  /** Card drops in like a wire, the title types itself (< 1 s), options stagger in. */
  function telegram(title: string, h2: HTMLElement, options: HTMLElement): void {
    gsap.killTweensOf(box);
    gsap.fromTo(box, { y: -70, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { y: 0, opacity: 1, clipPath: 'inset(0 0 -2% 0)', duration: D(0.55), ease: 'power3.out', clearProps: 'transform,opacity,clipPath' });
    rowsIn(Array.from(options.children), { delay: D(0.4) }, { x: -24, y: 0 });
    if (isReduced()) return;
    const o = { i: 0 };
    h2.classList.add('rv-typing');
    h2.textContent = '';
    gsap.to(o, { i: title.length, duration: Math.min(0.85, title.length * 0.035), delay: 0.25, ease: 'none',
      onUpdate: () => { h2.textContent = title.slice(0, Math.round(o.i)); },
      onComplete: () => { h2.textContent = title; h2.classList.remove('rv-typing'); } });
  }

  function show(defId?: string): void {
    const s = ui.state();
    const id = defId ?? s?.activeEvent?.defId ?? null;
    if (!id) return;
    const def = eventById(id);
    if (!def) return;
    if (currentId === id && ui.isOpen('event')) return;
    currentId = id;
    render(def, s);
    ui.open('event');
    pendingWire?.(); pendingWire = null;
  }

  function update(s: SimState): void {
    if (!ui.isOpen('event')) return;
    for (const { btn: b, why, opt } of optionButtons) {
      const reason = unmet(s, opt);
      const dis = !!reason;
      if (b.disabled !== dis) b.disabled = dis;
      const txt = reason ? cap(reason) : '';
      if (why.textContent !== txt) why.textContent = txt;
    }
  }

  // number keys choose options
  overlay.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= optionButtons.length) {
      e.preventDefault();
      optionButtons[n - 1].btn.click();
    }
  });

  ui.registerPanel('event', { el: overlay, modal: true, escClosable: false, anim: 'fade', onClose: () => { currentId = null; } });
  return { el: overlay, show, update };
}
