/** Car inspector side panel. */
import { el, btn, setText, setWidth, cap, hexColor } from './dom';
import type { UiShared } from './shared';
import type { SimState, Car, Crew } from '../core/types';
import { CAR_DEFS } from '../core/cars';
import { TRAIN } from '../core/config';

export interface Inspector { el: HTMLElement; update(s: SimState, force?: boolean): void; reset(): void }

const WHERE = (c: Crew, s: SimState): string => c.carIndex < 0 ? 'unassigned' : `car ${c.carIndex + 1} ${CAR_DEFS[s.train.cars[c.carIndex]?.type ?? 'locomotive']?.short ?? ''}`;

export function repairCost(car: Car): number { return Math.max(0, Math.ceil((car.maxHp - car.hp) / 4)); }

export function createInspector(ui: UiShared): Inspector {
  const titleEl = el('h2', { text: 'Car' });
  const body = el('div', { class: 'rv-side-body' });
  const foot = el('div', { class: 'rv-side-foot' });
  const closeBtn = btn('✕', () => { ui.audio().ui('close'); ui.selectCar(-1); }, { class: 'rv-icon rv-small', aria: 'Close inspector' });
  const root = el('aside', { class: 'rv-side rv-inspector rv-panel', 'data-panel': 'train', role: 'complementary', 'aria-label': 'Car inspector' },
    el('div', { class: 'rv-side-head' }, titleEl, closeBtn), body, foot);

  let structSig = '';
  let lastDyn = 0;
  interface Dyn {
    hpText: HTMLElement; hpFill: HTMLElement; heatText: HTMLElement; heatFill: HTMLElement;
    powerText: HTMLElement; ammoText: HTMLElement; paxText: HTMLElement | null; boardText: HTMLElement; statusText: HTMLElement;
    repairBtn: HTMLButtonElement; sellBtn: HTMLButtonElement; leftBtn: HTMLButtonElement; rightBtn: HTMLButtonElement; detachBtn: HTMLButtonElement;
    crewHp: Array<{ id: string; el: HTMLElement }>;
  }
  let dyn: Dyn | null = null;

  function build(s: SimState, i: number): void {
    const car = s.train.cars[i];
    const def = CAR_DEFS[car.type];
    const sim = ui.sim();
    const canShop = !!sim && sim.canShop();
    titleEl.replaceChildren(el('span', { style: `color:${hexColor(def.color)}`, text: def.short }), ' ', def.name);

    const hpText = el('span'); const hpFill = el('i');
    const heatText = el('span'); const heatFill = el('i');
    const powerText = el('span'); const ammoText = el('span'); const boardText = el('span'); const statusText = el('span');
    const paxText = def.passengerCap > 0 ? el('span') : null;
    const kv = el('div', { class: 'rv-kv-grid' },
      el('span', { class: 'rv-k', text: 'Hull' }), el('span', { class: 'rv-v' }, el('div', { class: 'rv-bar' }, hpFill), hpText),
      el('span', { class: 'rv-k', text: 'Heat' }), el('span', { class: 'rv-v' }, el('div', { class: 'rv-bar' }, heatFill), heatText),
      el('span', { class: 'rv-k', text: 'Power' }), el('span', { class: 'rv-v' }, powerText),
      el('span', { class: 'rv-k', text: 'Ammo' }), el('span', { class: 'rv-v' }, ammoText),
      ...(paxText ? [el('span', { class: 'rv-k', text: 'Passengers' }), el('span', { class: 'rv-v' }, paxText)] : []),
      el('span', { class: 'rv-k', text: 'Boarders' }), el('span', { class: 'rv-v' }, boardText),
      el('span', { class: 'rv-k', text: 'Status' }), el('span', { class: 'rv-v' }, statusText),
      el('span', { class: 'rv-k', text: 'Weight' }), el('span', { class: 'rv-v', text: `${def.weight} t` }),
    );
    if (def.powerGen > 0) kv.append(el('span', { class: 'rv-k', text: 'Generates' }), el('span', { class: 'rv-v', text: `+${def.powerGen} power (range ${TRAIN.powerRange})` }));
    if (def.heatGen > 0 || def.cooling > 0) kv.append(el('span', { class: 'rv-k', text: 'Thermal' }), el('span', { class: 'rv-v', text: `${def.heatGen > 0 ? `+${def.heatGen} heat/s active` : ''}${def.cooling > 0 ? ` −${def.cooling}/s cooling` : ''}`.trim() }));
    const storage = Object.entries(def.storage).filter(([, v]) => (v ?? 0) > 0);
    if (storage.length) kv.append(el('span', { class: 'rv-k', text: 'Storage' }), el('span', { class: 'rv-v', text: storage.map(([k, v]) => `+${v} ${k}`).join(', ') }));
    if (def.ammoSupplier) kv.append(el('span', { class: 'rv-k', text: 'Supplies' }), el('span', { class: 'rv-v', text: `ammo to weapons within ${TRAIN.ammoRange} cars` }));
    if (def.planRangeBonus || def.trackCostBonus) kv.append(el('span', { class: 'rv-k', text: 'Planning' }), el('span', { class: 'rv-v', text: `${def.planRangeBonus ? `+${def.planRangeBonus} range` : ''} ${def.trackCostBonus ? `${def.trackCostBonus} track cost` : ''}`.trim() }));

    const sections: HTMLElement[] = [el('p', { class: 'rv-desc', text: def.desc }), kv];

    if (def.weapon) {
      const w = def.weapon;
      const targets = [w.hitsGround && 'ground', w.hitsAir && 'air', w.hitsPhase && 'wisps'].filter(Boolean).join(' + ');
      sections.push(el('div', { class: 'rv-label', text: 'Weapon' }), el('div', { class: 'rv-kv-grid' },
        el('span', { class: 'rv-k', text: 'Type' }), el('span', { class: 'rv-v', text: `${cap(w.kind)} (${w.damageClass})` }),
        el('span', { class: 'rv-k', text: 'Damage' }), el('span', { class: 'rv-v', text: `${w.damage}${w.aoe ? ` splash ${w.aoe}px` : ''}${w.chain ? ` chain ×${w.chain}` : ''}` }),
        el('span', { class: 'rv-k', text: 'Rate' }), el('span', { class: 'rv-v', text: `${(1 / w.cooldown).toFixed(2)}/s (${w.cooldown}s)` }),
        el('span', { class: 'rv-k', text: 'Range' }), el('span', { class: 'rv-v', text: `${w.range} px` }),
        el('span', { class: 'rv-k', text: 'Targets' }), el('span', { class: 'rv-v', text: targets || 'none' }),
        el('span', { class: 'rv-k', text: 'Ammo' }), el('span', { class: 'rv-v', text: w.ammoPerShot ? `${w.ammoPerShot}/shot` : 'none needed' }),
        el('span', { class: 'rv-k', text: 'Heat' }), el('span', { class: 'rv-v', text: `+${w.heatPerShot}/shot` }),
      ));
    }

    // crew slot
    const unassigned = s.train.crew.filter(c => c.carIndex < 0);
    const current = car.crewId ? s.train.crew.find(c => c.id === car.crewId) ?? null : null;
    const sel = el('select', { 'aria-label': 'Assign crew member to this car' });
    sel.appendChild(el('option', { value: '', text: unassigned.length ? 'Choose crew…' : 'No unassigned crew' }));
    for (const c of unassigned) sel.appendChild(el('option', { value: c.id, text: `${c.name} — ${cap(c.specialty)} (${Math.round(c.hp)} hp)` }));
    sel.disabled = unassigned.length === 0 || i === 0;
    const assignBtn = btn('Assign', () => {
      const simA = ui.sim(); if (!simA || !sel.value) { ui.audio().ui('error'); return; }
      const ok = simA.assignCrew(sel.value, i);
      ui.audio().ui(ok ? 'confirm' : 'error');
      if (!ok) ui.notify('Could not assign crew here.', 'warn');
      structSig = '';
    }, { class: 'rv-small', aria: 'Assign selected crew member' });
    const unassignBtn = btn('Unassign', () => {
      const simA = ui.sim(); if (!simA || !current) return;
      const ok = simA.assignCrew(current.id, -1);
      ui.audio().ui(ok ? 'click' : 'error');
      structSig = '';
    }, { class: 'rv-small', aria: 'Unassign current crew member' });
    unassignBtn.disabled = !current;
    sections.push(el('div', { class: 'rv-label', text: 'Crew slot' }),
      el('div', { class: 'rv-desc', text: current ? `${current.name} — ${cap(current.specialty)} (${Math.round(current.hp)} hp)` : (i === 0 ? 'Unassigned crew ride in the locomotive.' : 'Empty. Specialists boost this car.') }),
      el('div', { class: 'rv-row' }, sel, assignBtn, unassignBtn));

    // crew roster
    const crewHp: Array<{ id: string; el: HTMLElement }> = [];
    if (s.train.crew.length) {
      const list = el('div', { class: 'rv-col', style: 'gap:3px' });
      for (const c of s.train.crew) {
        const hpEl = el('span', { class: 'rv-where', text: `${Math.round(c.hp)} hp · ${WHERE(c, s)}` });
        crewHp.push({ id: c.id, el: hpEl });
        list.appendChild(el('div', { class: 'rv-crew-line' }, el('span', null, c.name, ' ', el('span', { class: 'rv-spec', text: c.specialty })), hpEl));
      }
      sections.push(el('div', { class: 'rv-label', text: `Crew (${s.train.crew.length})` }), list);
    }
    body.replaceChildren(...sections);

    // footer actions
    const repairBtn = btn('Repair', () => {
      const simA = ui.sim(); if (!simA) return;
      const ok = simA.repairCar(i);
      ui.audio().ui(ok ? 'confirm' : 'error');
      if (!ok) ui.notify('Cannot repair: need a yard and enough scrap.', 'warn');
    }, { class: 'rv-small', aria: 'Repair this car' });
    const sellBtn = btn('Sell', async () => {
      const simA = ui.sim(); if (!simA) return;
      if (await ui.confirm({ title: 'Sell car', text: `Sell the ${def.name}? Cargo and passengers aboard it are lost.`, yes: 'Sell', danger: true })) {
        const ok = simA.sellCar(i);
        ui.audio().ui(ok ? 'confirm' : 'error');
        if (ok) ui.selectCar(-1);
      }
    }, { class: 'rv-small', aria: 'Sell this car' });
    const leftBtn = btn('◀ Move', () => { const simA = ui.sim(); if (!simA) return; const ok = simA.moveCar(i, i - 1); ui.audio().ui(ok ? 'click' : 'error'); if (ok) ui.selectCar(i - 1, true); }, { class: 'rv-small', aria: 'Move this car forward' });
    const rightBtn = btn('Move ▶', () => { const simA = ui.sim(); if (!simA) return; const ok = simA.moveCar(i, i + 1); ui.audio().ui(ok ? 'click' : 'error'); if (ok) ui.selectCar(i + 1, true); }, { class: 'rv-small', aria: 'Move this car backward' });
    const detachBtn = btn('Detach from here', async () => {
      const simA = ui.sim(); const st = ui.state(); if (!simA || !st) return;
      const n = st.train.cars.length - i;
      if (await ui.confirm({ title: 'Detach cars', text: `Uncouple ${n} car${n === 1 ? '' : 's'} from position ${i + 1} backward? They are abandoned to the void but lure enemies for ${TRAIN.detachLureTime}s.`, yes: 'Detach', danger: true })) {
        const ok = simA.detachFrom(i);
        ui.audio().ui(ok ? 'confirm' : 'error');
        if (ok) ui.selectCar(-1);
      }
    }, { class: 'rv-small rv-danger', aria: 'Detach this car and everything behind it' });
    const isLoco = i === 0;
    repairBtn.disabled = !canShop;
    sellBtn.disabled = !canShop || isLoco;
    leftBtn.disabled = !canShop || i <= 1;
    rightBtn.disabled = !canShop || isLoco || i >= s.train.cars.length - 1;
    detachBtn.disabled = isLoco;
    foot.replaceChildren(repairBtn, sellBtn, leftBtn, rightBtn, detachBtn, btn('Close', () => { ui.audio().ui('close'); ui.selectCar(-1); }, { class: 'rv-small', aria: 'Close inspector (Tab)' }));
    if (!canShop) foot.appendChild(el('div', { class: 'rv-hint', text: 'Repair, sell and reorder are available at repair yards.' }));

    dyn = { hpText, hpFill, heatText, heatFill, powerText, ammoText, paxText, boardText, statusText, repairBtn, sellBtn, leftBtn, rightBtn, detachBtn, crewHp };
  }

  function updateDyn(s: SimState, i: number): void {
    if (!dyn) return;
    const car = s.train.cars[i];
    const def = CAR_DEFS[car.type];
    const hpR = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    setText(dyn.hpText, `${Math.ceil(car.hp)} / ${car.maxHp}`);
    setWidth(dyn.hpFill, hpR * 100);
    dyn.hpFill.style.background = hpR < 0.3 ? 'var(--danger)' : hpR < 0.6 ? 'var(--gold)' : 'var(--good)';
    setText(dyn.heatText, `${Math.round(car.heat)}${car.heat >= TRAIN.heatFireAt ? ' FIRE' : car.heat >= TRAIN.heatDamageAt ? ' damaging' : ''}`);
    setWidth(dyn.heatFill, Math.min(120, car.heat) / 120 * 100);
    dyn.heatFill.style.background = car.heat >= TRAIN.heatDamageAt ? 'var(--danger)' : 'var(--heat)';
    const pr = car.derived?.powerRatio ?? 1;
    setText(dyn.powerText, def.powerUse > 0 ? `${Math.round(pr * 100)}% of ${def.powerUse} needed${pr < 0.999 ? ' — brownout' : ''}` : def.powerGen > 0 ? `generator +${def.powerGen}` : 'none needed');
    dyn.powerText.style.color = def.powerUse > 0 && pr < 0.999 ? 'var(--danger)' : '';
    if (def.weapon) {
      if (def.weapon.ammoPerShot > 0) {
        const has = !!car.derived?.hasAmmoSupply;
        setText(dyn.ammoText, has ? `supplied (${Math.floor(s.train.resources.ammo)} in stores)` : 'NO SUPPLIER within 2 cars');
        dyn.ammoText.style.color = has ? 'var(--good)' : 'var(--danger)';
      } else { setText(dyn.ammoText, 'not needed'); dyn.ammoText.style.color = ''; }
    } else { setText(dyn.ammoText, def.ammoSupplier ? 'supplier' : '—'); dyn.ammoText.style.color = ''; }
    if (dyn.paxText) setText(dyn.paxText, `${car.passengers} / ${def.passengerCap}`);
    setText(dyn.boardText, car.boarders.length ? `${car.boarders.length} aboard!` : 'none');
    dyn.boardText.style.color = car.boarders.length ? 'var(--danger)' : '';
    const status: string[] = [];
    if (car.hp <= 0) status.push('destroyed');
    if (car.onFire) status.push('on fire');
    if (car.disabled) status.push(`disabled ${Math.ceil(car.disabledFor)}s`);
    if (car.derived?.marinesEngaged) status.push('marines engaged');
    if (car.derived?.targetEnemyId) status.push('engaging');
    setText(dyn.statusText, status.length ? status.join(', ') : 'operational');
    dyn.statusText.style.color = car.hp <= 0 || car.onFire ? 'var(--danger)' : '';
    const sim = ui.sim();
    const canShop = !!sim && sim.canShop();
    const cost = repairCost(car);
    setText(dyn.repairBtn, cost > 0 ? `Repair (${cost} scrap)` : 'Repair (full)');
    dyn.repairBtn.disabled = !canShop || cost <= 0 || s.train.resources.scrap < 1;
    for (const c of dyn.crewHp) {
      const crew = s.train.crew.find(x => x.id === c.id);
      if (crew) setText(c.el, `${Math.round(crew.hp)} hp · ${WHERE(crew, s)}`);
    }
  }

  function update(s: SimState, force = false): void {
    const i = ui.selectedCar();
    if (i < 0 || i >= s.train.cars.length) { if (ui.isOpen('inspector')) ui.close('inspector'); return; }
    const car = s.train.cars[i];
    const sim = ui.sim();
    const canShop = !!sim && sim.canShop();
    const sig = [i, car.id, car.type, car.crewId ?? '', s.train.crew.map(c => `${c.id}:${c.carIndex}`).join(','), canShop ? 1 : 0, s.train.cars.length].join('|');
    if (sig !== structSig) { structSig = sig; build(s, i); force = true; }
    const now = performance.now();
    if (!force && now - lastDyn < 200) return;
    lastDyn = now;
    updateDyn(s, i);
  }

  function reset(): void { structSig = ''; dyn = null; body.replaceChildren(); foot.replaceChildren(); }

  ui.registerPanel('inspector', { el: root, modal: false, anim: 'side', onOpen: () => { structSig = ''; }, onClose: () => { /* selection handled by ui.selectCar */ } });
  ui.onSelectCar(() => { structSig = ''; });
  return { el: root, update, reset };
}
