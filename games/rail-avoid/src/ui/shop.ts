/** Repair-yard shop panel (phase === 'shop'). */
import { el, btn, hexColor, setText } from './dom';
import type { UiShared } from './shared';
import type { SimState, CarDef, CarType } from '../core/types';
import { CAR_DEFS, BUYABLE_CARS } from '../core/cars';
import { MAX_CARS, TRAIN } from '../core/config';
import { repairCost } from './inspector';
import { gsap, D, isReduced } from './motion';

export interface Shop { el: HTMLElement; update(s: SimState, force?: boolean): void; reset(): void }

function nums(def: CarDef): HTMLElement {
  const parts: Array<[string, string]> = [['hp', String(def.hp)], ['wt', `${def.weight}t`]];
  if (def.powerGen) parts.push(['power', `+${def.powerGen}`]);
  if (def.powerUse) parts.push(['power', `−${def.powerUse}`]);
  if (def.heatGen) parts.push(['heat', `+${def.heatGen}/s`]);
  if (def.cooling) parts.push(['cool', `−${def.cooling}/s`]);
  if (def.passengerCap) parts.push(['pax', String(def.passengerCap)]);
  if (def.ammoSupplier) parts.push(['ammo', 'supplier']);
  const st = Object.entries(def.storage).filter(([, v]) => (v ?? 0) > 0);
  if (st.length) parts.push(['store', st.map(([k, v]) => `+${v} ${k}`).join(' ')]);
  if (def.weapon) parts.push(['dmg', `${def.weapon.damage}/${def.weapon.cooldown}s`, ]);
  return el('div', { class: 'rv-si-nums' }, ...parts.map(([k, v]) => el('span', null, k + ' ', el('b', { text: v }))));
}

export function createShop(ui: UiShared): Shop {
  const resEl = el('div', { class: 'rv-shop-res', role: 'group', 'aria-label': 'Resources' });
  const body = el('div', { class: 'rv-side-body' });
  const repairAllBtn = btn('Repair all', () => {
    const sim = ui.sim(); if (!sim) return;
    const ok = sim.repairAll();
    ui.audio().ui(ok ? 'confirm' : 'error');
    const s = ui.state();
    if (ok && s) ui.notify(`Repairs done. Scrap left: ${Math.floor(s.train.resources.scrap)}`, 'good');
    else ui.notify('Nothing to repair, or not enough scrap.', 'warn');
    sig = '';
  }, { class: 'rv-primary', aria: 'Repair every car' });
  const departBtn = btn('Depart', () => { ui.audio().ui('confirm'); ui.sim()?.closeShop(); }, { class: 'rv-primary', aria: 'Leave the yard and depart' });
  const foot = el('div', { class: 'rv-side-foot' }, repairAllBtn, departBtn);
  const root = el('aside', { class: 'rv-side rv-wide rv-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Repair yard' },
    el('div', { class: 'rv-side-head' }, el('h2', { text: 'Repair Yard' }), resEl), body, foot);
  departBtn.dataset.autofocus = '';

  let sig = '';
  const prevHp = new Map<string, number>();

  // catalogue cards tilt toward the cursor (CSS vars → perspective transform)
  let tilted: HTMLElement | null = null;
  const untilt = () => { if (tilted) { tilted.style.setProperty('--rx', '0deg'); tilted.style.setProperty('--ry', '0deg'); tilted = null; } };
  body.addEventListener('pointermove', (e) => {
    const item = (e.target as HTMLElement).closest?.('.rv-shop-item') as HTMLElement | null;
    if (tilted !== item) untilt();
    if (!item || isReduced()) return;
    tilted = item;
    const r = item.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    item.style.setProperty('--rx', (-py * 10).toFixed(1) + 'deg');
    item.style.setProperty('--ry', (px * 12).toFixed(1) + 'deg');
  });
  body.addEventListener('pointerleave', untilt);

  /** A chip flies from the Buy button to the train strip. */
  function flyChip(from: HTMLElement, def: CarDef): void {
    if (isReduced()) return;
    const cars = document.querySelectorAll<HTMLElement>('#ui .rv-strip .rv-car');
    const target = (cars[cars.length - 1] ?? document.querySelector<HTMLElement>('#ui .rv-strip'))?.getBoundingClientRect();
    if (!target) return;
    const a = from.getBoundingClientRect();
    const inner = el('span', { class: 'rv-fly-chip', text: def.short, style: `--accent:${hexColor(def.color)}` });
    const fly = el('div', { class: 'rv-fly', style: `left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px` }, inner);
    ui.root.appendChild(fly);
    gsap.to(fly, { x: target.left + target.width / 2 - (a.left + a.width / 2), y: target.top + target.height / 2 - (a.top + a.height / 2), duration: 0.85, ease: 'power2.inOut', onComplete: () => fly.remove() });
    gsap.fromTo(inner, { y: 0, scale: 0.7 }, { y: -100, scale: 1.15, duration: 0.42, ease: 'power2.out', yoyo: true, repeat: 1 });
  }

  function render(s: SimState): void {
    const sim = ui.sim();
    const t = s.train;
    const scrap = Math.floor(t.resources.scrap);
    resEl.replaceChildren(...(['scrap', 'rails', 'coal', 'ammo', 'food'] as const).map(k =>
      el('span', { class: 'rv-chip', 'aria-label': `${k} ${Math.floor(t.resources[k])} of ${Math.floor(t.capacity[k])}` },
        el('span', { class: 'rv-chip-k', text: k }), el('span', { class: 'rv-chip-v', text: String(Math.floor(t.resources[k])) }), el('span', { class: 'rv-chip-cap', text: '/' + Math.floor(t.capacity[k]) }))));

    const scrollTop = body.scrollTop;
    const sections: HTMLElement[] = [];

    sections.push(el('div', { class: 'rv-rules' },
      el('span', null, el('b', { class: 'rv-tip', title: 'A generator (locomotive, boiler, reactor) powers cars within 3 positions. If demand exceeds output, every consumer in the span runs at output/demand.', text: 'Power' }), ` reaches ±${TRAIN.powerRange} cars; overload → brownout.`),
      el('span', null, el('b', { class: 'rv-tip', title: 'Weapons need an Armory, Cargo Hold, Foundry or Armoured Cargo within 2 positions or they cannot fire.', text: 'Ammo' }), ` suppliers reach ±${TRAIN.ammoRange} cars.`),
      el('span', null, el('b', { class: 'rv-tip', title: 'Heat diffuses 15%/s of the difference to adjacent cars. ≥80 damages, ≥100 catches fire. Radiators cool neighbours.', text: 'Heat' }), ' spreads to neighbours — pad hot cars with radiators.'),
      el('span', null, el('b', { class: 'rv-tip', title: 'Boarders walk one car toward the locomotive every 4 s. Armour Plate stops them; Barracks and Flamethrowers clear adjacent cars.', text: 'Boarders' }), ' walk forward; put a shield near the rear.'),
    ));

    // current train
    const trainEl = el('div', { class: 'rv-shop-train', role: 'list', 'aria-label': 'Current train' });
    t.cars.forEach((car, i) => {
      const def = CAR_DEFS[car.type];
      const cost = repairCost(car);
      const hpFill = el('i');
      const chip = el('div', { class: 'rv-shop-car', role: 'listitem', style: `--accent:${hexColor(def.color)}` },
        el('span', { class: 'rv-sc-name', text: `${i + 1} ${def.short}` }),
        el('span', { class: 'rv-dim', text: `${Math.ceil(car.hp)}/${car.maxHp}` }),
        el('div', { class: 'rv-bar rv-hp', title: 'Hull' }, hpFill),
      );
      const pct = car.maxHp > 0 ? (car.hp / car.maxHp) * 100 : 0;
      const old = prevHp.get(car.id);
      hpFill.style.background = pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--gold)' : 'var(--good)';
      if (old !== undefined && pct > old + 0.5) { // repaired: bar fills up
        gsap.fromTo(hpFill, { width: old + '%' }, { width: pct + '%', duration: D(0.7), ease: 'power2.out' });
        chip.classList.add('rv-repaired');
      } else hpFill.style.width = pct + '%';
      prevHp.set(car.id, pct);
      const btns = el('div', { class: 'rv-sc-btns' });
      if (i > 0) {
        const l = btn('◀', () => { const ok = !!sim && sim.moveCar(i, i - 1); ui.audio().ui(ok ? 'click' : 'error'); sig = ''; }, { class: 'rv-small rv-icon', aria: `Move ${def.name} forward` });
        l.disabled = i <= 1;
        const r = btn('▶', () => { const ok = !!sim && sim.moveCar(i, i + 1); ui.audio().ui(ok ? 'click' : 'error'); sig = ''; }, { class: 'rv-small rv-icon', aria: `Move ${def.name} backward` });
        r.disabled = i >= t.cars.length - 1;
        const sell = btn('Sell', async () => {
          if (await ui.confirm({ title: 'Sell car', text: `Sell the ${def.name}?`, yes: 'Sell', danger: true })) {
            const ok = !!sim && sim.sellCar(i); ui.audio().ui(ok ? 'confirm' : 'error'); sig = '';
          }
        }, { class: 'rv-small', aria: `Sell ${def.name}` });
        btns.append(l, r, sell);
      }
      const fix = btn(cost > 0 ? `Fix ${cost}` : 'OK', () => { const ok = !!sim && sim.repairCar(i); ui.audio().ui(ok ? 'confirm' : 'error'); sig = ''; }, { class: 'rv-small', aria: `Repair ${def.name} for ${cost} scrap` });
      fix.disabled = cost <= 0 || scrap < 1;
      btns.appendChild(fix);
      chip.appendChild(btns);
      chip.addEventListener('click', (e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') ui.selectCar(i, true); });
      trainEl.appendChild(chip);
    });
    sections.push(el('div', { class: 'rv-label', text: `Your train (${t.cars.length}/${MAX_CARS})` }), trainEl);

    // catalogue
    const full = t.cars.length >= MAX_CARS;
    for (const tier of [1, 2, 3] as const) {
      const items = BUYABLE_CARS.map(ty => CAR_DEFS[ty]).filter(d => d.tier === tier);
      const list = el('div', { class: 'rv-col', style: 'gap:5px' });
      for (const def of items) {
        const poor = scrap < def.cost;
        const buy = btn('Buy', () => {
          if (!sim) return;
          const ok = sim.buyCar(def.type as CarType);
          ui.audio().ui(ok ? 'confirm' : 'error');
          if (!ok) ui.notify(full ? 'Train is at maximum length.' : 'Not enough scrap.', 'warn');
          else flyChip(buy, def);
          sig = '';
        }, { class: 'rv-small rv-primary', aria: `Buy ${def.name} for ${def.cost} scrap` });
        buy.disabled = poor || full;
        list.appendChild(el('div', { class: 'rv-shop-item', style: `--accent:${hexColor(def.color)}` },
          el('div', { class: 'rv-si-name' }, el('span', { class: 'rv-si-short', text: def.short }), def.name),
          el('div', { class: 'rv-row' }, el('span', { class: 'rv-si-cost' + (poor ? ' rv-poor' : ''), text: `${def.cost} scrap` }), buy),
          el('div', { class: 'rv-si-desc', text: def.desc }),
          nums(def),
        ));
      }
      sections.push(el('div', { class: 'rv-label rv-tier', text: `Tier ${tier}` }), list);
    }
    body.replaceChildren(...sections);
    body.scrollTop = scrollTop;

    const total = t.cars.reduce((a, c) => a + repairCost(c), 0);
    setText(repairAllBtn, total > 0 ? `Repair all (${total} scrap)` : 'Repair all (nothing to fix)');
    repairAllBtn.disabled = total <= 0 || scrap < 1;
  }

  function update(s: SimState, force = false): void {
    if (!ui.isOpen('shop')) return;
    const t = s.train;
    const sim = ui.sim();
    const next = [t.cars.map(c => `${c.id}:${Math.ceil(c.hp)}`).join(','), Math.floor(t.resources.scrap), Math.floor(t.resources.rails), Math.floor(t.resources.ammo), Math.floor(t.resources.coal), Math.floor(t.resources.food), sim && sim.canShop() ? 1 : 0].join('|');
    if (!force && next === sig) return;
    sig = next;
    render(s);
  }

  function reset(): void { sig = ''; prevHp.clear(); body.replaceChildren(); }

  ui.registerPanel('shop', { el: root, modal: true, escClosable: false, anim: 'side', onOpen: () => { sig = ''; prevHp.clear(); }, onClose: () => { sig = ''; untilt(); } });
  return { el: root, update, reset };
}
