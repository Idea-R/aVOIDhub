/** Repair-yard shop panel (phase === 'shop'). Resources are read from the HUD top bar — the shop shows none of its own. */
import { el, btn, hexColor, setText } from './dom';
import type { UiShared } from './shared';
import type { SimState, CarDef, CarType } from '../core/types';
import { CAR_DEFS, BUYABLE_CARS } from '../core/cars';
import { MAX_CARS, TRAIN } from '../core/config';
import { repairCost } from './inspector';
import { gsap, D, isReduced } from './motion';
import { levelOf, levelPips, levelEffect, hasUpgrades, hasLocoUpgrades, carUpgradeCost, locoUpgradeCost, locoLevel, upgradeApi, LOCO_TRACKS, MAX_LEVEL, ROMAN } from './levels';
import { carArtFor } from './carArt';

export interface Shop { el: HTMLElement; update(s: SimState, force?: boolean): void; reset(): void }

function nums(def: CarDef): HTMLElement {
  const parts: Array<[string, string]> = [['hp', String(def.hp)], ['wt', `${def.weight}t`]];
  if (def.powerGen) parts.push(['power', `+${def.powerGen}`]);
  if (def.powerUse) parts.push(['power', `−${def.powerUse}`]);
  if (def.heatGen) parts.push(['heat', `+${def.heatGen}/s`]);
  if (def.cooling) parts.push(['cool', `−${def.cooling}/s`]);
  if (def.passengerCap) parts.push(['pax', String(def.passengerCap)]);
  if (def.type === 'foundry') parts.push(['ammo', 'production']);
  const st = Object.entries(def.storage).filter(([, v]) => (v ?? 0) > 0);
  if (st.length) parts.push(['store', st.map(([k, v]) => `+${v} ${k}`).join(' ')]);
  if (def.weapon) {
    parts.push(['dmg', `${def.weapon.damage}/${def.weapon.cooldown}s`, ]);
    parts.push(['feed', def.weapon.ammoPerShot > 0 ? 'shared stock' : 'self-fed']);
  }
  return el('div', { class: 'rv-si-nums' }, ...parts.map(([k, v]) => el('span', null, k + ' ', el('b', { text: v }))));
}

export function createShop(ui: UiShared): Shop {
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
  const subEl = el('span', { class: 'rv-side-sub', text: 'Resources in the top bar' });
  const root = el('aside', { class: 'rv-side rv-wide rv-panel', 'data-panel': 'shop', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Repair yard' },
    el('div', { class: 'rv-side-head' }, el('h2', { text: 'Repair Yard' }), subEl), body, foot);
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
    const scrollTop = body.scrollTop;
    const sections: HTMLElement[] = [];
    const upgrades = hasUpgrades(sim);
    const locoUp = hasLocoUpgrades(sim);
    const api = upgradeApi(sim);

    sections.push(el('div', { class: 'rv-yard-intro' },
      el('b', { text: 'Service the consist, then improve it.' }),
      el('span', { text: 'Each car has its own repair and level controls. The locomotive uses four permanent engine-system tracks below.' })),
    el('details', { class: 'rv-rules rv-yard-rules' },
      el('summary', { text: 'Train system rules' }),
      el('span', null, el('b', { class: 'rv-tip', title: 'A generator (locomotive, boiler, reactor) powers cars within 3 positions. If demand exceeds output, every consumer in the span runs at output/demand.', text: 'Power' }), ` reaches ±${TRAIN.powerRange} cars; overload → brownout.`),
      el('span', null, el('b', { class: 'rv-tip', title: 'Every ballistic weapon draws from shared stock regardless of position. Cargo adds capacity; Foundries produce ammo.', text: 'Ammo stock' }), ' feeds every gun. No supply-car adjacency required.'),
      el('span', null, el('b', { class: 'rv-tip', title: 'Heat diffuses 15%/s of the difference to adjacent cars. ≥80 damages, ≥100 catches fire. Radiators cool neighbours.', text: 'Heat' }), ' spreads to neighbours — pad hot cars with radiators.'),
      el('span', null, el('b', { class: 'rv-tip', title: 'Boarders walk one car toward the locomotive every 4 s. Armour Plate stops them; Barracks and Flamethrowers clear adjacent cars.', text: 'Boarders' }), ' walk forward; put a shield near the rear.')));

    // current train
    const trainEl = el('div', { class: 'rv-shop-train', role: 'list', 'aria-label': 'Current train' });
    t.cars.forEach((car, i) => {
      const def = CAR_DEFS[car.type];
      const cost = repairCost(car);
      const lvl = levelOf(car);
      const hpFill = el('i');
      const artSrc = carArtFor(car.type, lvl);
      const chip = el('div', { class: 'rv-shop-car', role: 'listitem', style: `--accent:${hexColor(def.color)}` },
        el('div', { class: 'rv-shop-car-head' },
          el('span', { class: 'rv-shop-car-index', text: String(i + 1) }),
          el('span', { class: 'rv-sc-name' }, el('b', { text: def.name }), levelPips(lvl, 'rv-sc-lvl'))),
        el('div', { class: 'rv-shop-car-visual' },
          artSrc ? el('img', { class: 'rv-car-art', src: artSrc, alt: '', draggable: 'false' }) : el('span', { class: 'rv-shop-car-fallback', text: def.short })),
        el('div', { class: 'rv-shop-car-health' },
          el('span', { text: 'Hull' }), el('span', { class: 'rv-dim', text: `${Math.ceil(car.hp)}/${car.maxHp}` })),
        el('div', { class: 'rv-bar rv-hp', title: 'Hull integrity' }, hpFill),
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
      if (i === 0 && locoUp) {
        chip.appendChild(btn('Engine systems ↓', () => {
          const target = body.querySelector<HTMLElement>('.rv-loco-card');
          target?.scrollIntoView({ behavior: isReduced() ? 'auto' : 'smooth', block: 'start' });
          target?.focus({ preventScroll: true });
        }, { class: 'rv-small rv-loco-jump', aria: 'Show locomotive upgrade systems' }));
      }
      if (upgrades && i > 0) {
        const uc = carUpgradeCost(sim, i);
        const maxed = uc < 0 || lvl >= MAX_LEVEL;
        const up = btn(maxed ? `Lv ${ROMAN[lvl]} max` : `Upgrade to Lv ${ROMAN[lvl + 1]} (${uc})`, () => {
          let ok = false;
          try { ok = !!api.upgradeCar?.(i); } catch { ok = false; }
          ui.audio().ui(ok ? 'confirm' : 'error');
          if (!ok) ui.notify('Cannot upgrade: not enough scrap or already at max level.', 'warn');
          else if (!isReduced()) gsap.fromTo(chip, { boxShadow: '0 0 0 0 rgba(232,193,112,0)' }, { boxShadow: '0 0 18px 2px rgba(232,193,112,0.55)', duration: 0.35, yoyo: true, repeat: 1, clearProps: 'boxShadow' });
          sig = '';
        }, { class: 'rv-small rv-upgrade' + (maxed ? '' : ' rv-primary'), aria: maxed ? `${def.name} is at maximum level` : `Upgrade ${def.name} to level ${lvl + 1} for ${uc} scrap`, title: levelEffect(car.type) });
        up.disabled = maxed || scrap < uc;
        chip.appendChild(up);
      }
      // The yard card is already the car editor. Selecting it may highlight the model,
      // but must not open the separate inspector over this workspace.
      chip.addEventListener('click', (e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') ui.selectCar(i, false); });
      trainEl.appendChild(chip);
    });
    sections.push(el('div', { class: 'rv-label rv-yard-section', text: `Rolling stock · ${t.cars.length}/${MAX_CARS} cars` }), trainEl);

    // upgrades: locomotive tracks
    if (locoUp) {
      const tracks = el('div', { class: 'rv-loco-tracks' });
      for (const tr of LOCO_TRACKS) {
        const lvl = locoLevel(t, tr.kind);
        const cost = locoUpgradeCost(sim, tr.kind);
        const maxed = cost < 0 || lvl >= MAX_LEVEL;
        const buy = btn(maxed ? 'MAX' : `Buy ${cost}`, () => {
          let ok = false;
          try { ok = !!api.upgradeLoco?.(tr.kind); } catch { ok = false; }
          ui.audio().ui(ok ? 'confirm' : 'error');
          if (!ok) ui.notify('Cannot upgrade the locomotive: not enough scrap or already at max level.', 'warn');
          sig = '';
        }, { class: 'rv-small' + (maxed ? '' : ' rv-primary'), aria: maxed ? `${tr.name} is at maximum level` : `Buy ${tr.name} level ${lvl + 1} for ${cost} scrap`, title: tr.per });
        buy.disabled = maxed || scrap < cost;
        tracks.appendChild(el('div', { class: 'rv-loco-track', title: tr.per },
          el('span', { class: 'rv-lt-ico', 'aria-hidden': 'true', text: tr.icon }),
          el('span', { class: 'rv-lt-name' }, el('b', { text: tr.name }), el('span', { class: 'rv-lt-per', text: tr.per })),
          levelPips(lvl, 'rv-lt-pips'),
          buy,
        ));
      }
      sections.push(el('div', { class: 'rv-label rv-tier rv-yard-section', text: 'Locomotive systems · engine only' }),
        el('div', { class: 'rv-loco-card', style: `--accent:${hexColor(CAR_DEFS.locomotive.color)}`, tabindex: '-1' },
          el('div', { class: 'rv-si-name' }, el('span', { class: 'rv-si-short', text: CAR_DEFS.locomotive.short }), 'Locomotive', el('span', { class: 'rv-dim rv-lt-hint', text: 'four tracks · 3 levels each' })),
          el('p', { class: 'rv-loco-explain', text: 'These upgrades affect the locomotive and whole-train performance. They are separate from the Level I–III upgrades on the rolling-stock cards above.' }),
          tracks,
          upgrades ? el('div', { class: 'rv-hint', text: 'Cars upgrade from their chip above: +25% max HP per level; weapons +20% damage, generators +1 power, radiators +2 cooling, storage +20%, coaches +4 passengers.' }) : undefined,
        ));
    }

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
          else {
            flyChip(buy, def);
            if (def.weapon?.ammoPerShot) ui.notify(`${def.name} loaded with commissioning ammo. It can use shared ammo from any position.`, 'good', 6000, 'weapon-supply');
          }
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
    setText(subEl, `${scrap} scrap to spend · resources in the top bar`);
  }

  function update(s: SimState, force = false): void {
    if (!ui.isOpen('shop')) return;
    const t = s.train;
    const sim = ui.sim();
    const lu = (t as unknown as { locoUpgrades?: Record<string, number> }).locoUpgrades;
    const next = [t.cars.map(c => `${c.id}:${Math.ceil(c.hp)}:${levelOf(c)}:${c.maxHp}`).join(','), Math.floor(t.resources.scrap), Math.floor(t.resources.rails), Math.floor(t.resources.ammo), Math.floor(t.resources.coal), Math.floor(t.resources.food), sim && sim.canShop() ? 1 : 0, lu ? Object.values(lu).join('') : ''].join('|');
    if (!force && next === sig) return;
    sig = next;
    render(s);
  }

  function reset(): void { sig = ''; prevHp.clear(); body.replaceChildren(); }

  ui.registerPanel('shop', { el: root, modal: true, escClosable: false, anim: 'side', onOpen: () => { sig = ''; prevHp.clear(); }, onClose: () => { sig = ''; untilt(); } });
  return { el: root, update, reset };
}
