/** Bottom train strip: one chip per car, diff-based updates. Lives in the HUD dock. */
import { el, setText, setWidth, toggleClass, setAttr, hexColor } from './dom';
import type { UiShared } from './shared';
import type { SimState, Car, CrewSpecialty } from '../core/types';
import { CAR_DEFS } from '../core/cars';
import { MAX_CARS, TRAIN } from '../core/config';
import { gsap, D, isReduced, popIn, shake } from './motion';
import { levelOf, ROMAN } from './levels';

const CREW_CODE: Record<CrewSpecialty, string> = { engineer: 'EN', gunner: 'GU', medic: 'MD', surveyor: 'SV', mechanic: 'MC', quartermaster: 'QM', conductor: 'CD' };

interface Chip {
  id: string;
  root: HTMLButtonElement;
  hpBar: HTMLElement; hpFill: HTMLElement;
  heatFill: HTMLElement;
  badges: HTMLElement;
  crew: HTMLElement;
  pips: HTMLElement[];
  sig: string;
}

export interface StripHooks { hover?(index: number, x: number, y: number): void; leave?(): void }
export interface Strip { el: HTMLElement; update(s: SimState, force?: boolean): void; reset(): void; carsEl: HTMLElement; hit(carIndex: number): void }

export function createStrip(ui: UiShared, hooks: StripHooks = {}): Strip {
  const weightV = el('b', { text: '0' });
  const powerV = el('b', { text: '0/0' });
  const speedV = el('b', { text: '0.00' });
  const countV = el('b', { text: '0' });
  const head = el('div', { class: 'rv-strip-head' },
    el('span', { class: 'rv-label', text: 'Train' }),
    el('span', { class: 'rv-stat' }, el('span', { class: 'rv-stat-k', text: 'cars ' }), countV, ' / ' + MAX_CARS),
    el('span', { class: 'rv-stat' }, el('span', { class: 'rv-stat-k', text: 'weight ' }), weightV, ' t'),
    el('span', { class: 'rv-stat', title: 'Power generated / power demanded' }, el('span', { class: 'rv-stat-k', text: 'power ' }), powerV),
    el('span', { class: 'rv-stat' }, el('span', { class: 'rv-stat-k', text: 'speed ' }), speedV, ' hex/s'),
  );
  const carsEl = el('div', { class: 'rv-cars', role: 'listbox', 'aria-label': 'Train cars, locomotive first' });
  const root = el('div', { class: 'rv-strip rv-panel' }, head, carsEl);

  let chips: Chip[] = [];
  let flows: HTMLElement[] = [];
  let spans: HTMLElement[] = [];
  let structSig = '';
  let lastHead = '';
  let lastUpdate = 0;
  let selectedShown = -2;
  let needSpans = false;

  /** Chips for cars that vanished fall out of the strip; new chips pop in. */
  function animateDiff(prev: Chip[], next: Chip[]): void {
    if (!prev.length) return;
    const nextIds = new Set(next.map(c => c.id)), prevIds = new Set(prev.map(c => c.id));
    for (const c of prev) {
      if (nextIds.has(c.id)) continue;
      const ghost = c.root.cloneNode(true) as HTMLElement;
      ghost.className = 'rv-car rv-ghost';
      ghost.style.cssText += `;position:absolute;left:${carsEl.offsetLeft + c.root.offsetLeft - carsEl.scrollLeft}px;top:${carsEl.offsetTop + c.root.offsetTop}px;pointer-events:none`;
      root.appendChild(ghost);
      if (isReduced()) { ghost.remove(); continue; }
      gsap.to(ghost, { y: 70, rotation: 18, scale: 0.6, opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: () => ghost.remove() });
    }
    const fresh = next.filter(c => !prevIds.has(c.id)).map(c => c.root);
    if (fresh.length) popIn(fresh, { scale: 0.5, y: 24 }, { stagger: D(0.06), ease: 'back.out(2)' });
  }

  function build(s: SimState): void {
    const prev = chips;
    chips = []; flows = []; spans = [];
    carsEl.replaceChildren();
    s.train.cars.forEach((car, i) => {
      const def = CAR_DEFS[car.type];
      if (i > 0) {
        const f = el('span', { class: 'rv-flow', 'aria-hidden': 'true', text: '·' });
        flows.push(f);
        carsEl.appendChild(f);
      }
      const hpFill = el('i');
      const heatFill = el('i');
      const hpBar = el('div', { class: 'rv-bar rv-hp', title: 'Hull' }, hpFill);
      const badges = el('span', { class: 'rv-car-badges' });
      const crew = el('span', { class: 'rv-crewb', 'aria-hidden': 'true' });
      crew.hidden = true;
      const pips = [1, 2, 3].map(() => el('i'));
      const pipsEl = el('span', { class: 'rv-pips rv-car-lvl', 'aria-hidden': 'true' }, ...pips);
      const chip = el('button', {
        class: 'rv-car', type: 'button', role: 'option', 'data-i': String(i),
        style: `--accent:${hexColor(def.color)}`,
        'aria-label': `${def.name}, car ${i + 1}`,
      },
        el('span', { class: 'rv-car-short' }, def.short, pipsEl, el('span', { class: 'rv-car-idx', text: String(i + 1) })),
        hpBar,
        el('div', { class: 'rv-bar rv-heat', title: 'Heat' }, heatFill),
        badges, crew,
      );
      chip.addEventListener('click', () => { ui.audio().ui('click'); ui.selectCar(i, true); });
      chip.addEventListener('mouseenter', (e) => { ui.audio().ui('hover'); hooks.hover?.(i, e.clientX, e.clientY); });
      chip.addEventListener('mouseleave', () => hooks.leave?.());
      chip.addEventListener('focus', () => { const r = chip.getBoundingClientRect(); hooks.hover?.(i, r.left + r.width / 2, r.top); });
      chip.addEventListener('blur', () => hooks.leave?.());
      carsEl.appendChild(chip);
      chips.push({ id: car.id, root: chip, hpBar, hpFill, heatFill, badges, crew, pips, sig: '' });
    });
    animateDiff(prev, chips);
    // power spans (generators reach ±3 cars)
    s.train.cars.forEach((car, i) => {
      const def = CAR_DEFS[car.type];
      if (def.powerGen <= 0) return;
      const span = el('span', { class: 'rv-power-span', 'aria-hidden': 'true', 'data-gen': String(i), title: `${def.name} powers cars within ${TRAIN.powerRange} positions` });
      spans.push(span);
      carsEl.appendChild(span);
    });
    needSpans = true;
  }

  function layoutSpans(s: SimState): void {
    if (!spans.length || !chips.length) return;
    const n = chips.length;
    let k = 0;
    for (const span of spans) {
      const gi = Number(span.dataset.gen);
      const car = s.train.cars[gi];
      const dead = !car || car.hp <= 0;
      const a = chips[Math.max(0, gi - TRAIN.powerRange)].root;
      const b = chips[Math.min(n - 1, gi + TRAIN.powerRange)].root;
      const left = a.offsetLeft, right = b.offsetLeft + b.offsetWidth;
      span.style.left = left + 'px';
      span.style.width = Math.max(0, right - left) + 'px';
      span.style.bottom = (k % 3) * 3 + 'px';
      span.style.opacity = dead ? '0.15' : '0.6';
      k++;
    }
  }

  function badgesFor(car: Car, i: number): string {
    const def = CAR_DEFS[car.type];
    const parts: string[] = [];
    if (def.powerUse > 0) {
      const pr = car.derived?.powerRatio ?? 1;
      parts.push(`<span class="rv-badge rv-power${pr < 0.999 ? ' rv-dimmed' : ''}" title="Power ${Math.round(pr * 100)}%">⚡${Math.round(pr * 100)}%</span>`);
    }
    if (def.weapon && def.weapon.ammoPerShot > 0) {
      const has = !!car.derived?.hasAmmoSupply;
      parts.push(`<span class="rv-badge rv-ammo${has ? '' : ' rv-noammo'}" title="${has ? 'Ammo supplied' : 'No ammo supplier within 2 cars'}">●</span>`);
    }
    if (car.boarders.length > 0) parts.push(`<span class="rv-badge rv-boarders" title="${car.boarders.length} boarders inside">⚔${car.boarders.length}</span>`);
    if (car.onFire) parts.push('<span class="rv-badge rv-fireb" title="On fire">🔥</span>');
    if (car.disabled) parts.push('<span class="rv-badge rv-dis" title="Disabled">✕</span>');
    if (def.passengerCap > 0) parts.push(`<span class="rv-badge rv-pax" title="Passengers">⚇${car.passengers}</span>`);
    if (car.derived?.marinesEngaged) parts.push('<span class="rv-badge" title="Marines engaged">⚔</span>');
    if (i === 0 && car.hp <= 0) parts.push('<span class="rv-badge rv-dis">DEAD</span>');
    return parts.join('');
  }

  function updateChips(s: SimState): void {
    const sel = ui.selectedCar();
    const cars = s.train.cars;
    const crewByCar = new Map<number, CrewSpecialty>();
    for (const c of s.train.crew) if (c.carIndex >= 0) crewByCar.set(c.carIndex, c.specialty);
    for (let i = 0; i < chips.length; i++) {
      const car = cars[i]; const ch = chips[i];
      if (!car) continue;
      const def = CAR_DEFS[car.type];
      const hpR = car.maxHp > 0 ? car.hp / car.maxHp : 0;
      const crewSpec = crewByCar.get(i);
      const lvl = levelOf(car);
      const sig = [Math.round(hpR * 100), Math.round(car.heat), Math.round((car.derived?.powerRatio ?? 1) * 100), car.derived?.hasAmmoSupply ? 1 : 0,
        car.boarders.length, car.onFire ? 1 : 0, car.disabled ? 1 : 0, car.passengers, crewSpec ?? '', sel === i ? 1 : 0, car.derived?.marinesEngaged ? 1 : 0, lvl, car.maxHp].join(',');
      if (sig === ch.sig) continue;
      ch.sig = sig;
      setWidth(ch.hpFill, hpR * 100);
      toggleClass(ch.hpBar, 'rv-mid', hpR < 0.6 && hpR >= 0.3);
      toggleClass(ch.hpBar, 'rv-lowhp', hpR < 0.3);
      setWidth(ch.heatFill, Math.min(120, car.heat) / 120 * 100);
      // heat ramps gold → orange → red
      const hue = Math.round(48 - 48 * Math.min(1, car.heat / TRAIN.heatFireAt));
      const heatBg = car.heat >= TRAIN.heatFireAt ? 'var(--danger)' : `hsl(${hue} 92% 56%)`;
      if (ch.heatFill.style.background !== heatBg) ch.heatFill.style.background = heatBg;
      const html = badgesFor(car, i);
      if (ch.badges.innerHTML !== html) ch.badges.innerHTML = html;
      if (crewSpec) { ch.crew.hidden = false; setText(ch.crew, CREW_CODE[crewSpec]); ch.crew.title = crewSpec; }
      else ch.crew.hidden = true;
      ch.pips.forEach((p, k) => toggleClass(p, 'rv-on', k < lvl));
      toggleClass(ch.root, 'rv-selected', sel === i);
      toggleClass(ch.root, 'rv-fire', car.onFire);
      toggleClass(ch.root, 'rv-disabled', car.disabled);
      toggleClass(ch.root, 'rv-dead', car.hp <= 0);
      setAttr(ch.root, 'aria-selected', sel === i ? 'true' : 'false');
      setAttr(ch.root, 'aria-label', `${def.name}${lvl > 1 ? ` level ${ROMAN[lvl]}` : ''}, car ${i + 1}, hull ${Math.round(hpR * 100)}%, heat ${Math.round(car.heat)}${car.boarders.length ? `, ${car.boarders.length} boarders` : ''}${car.onFire ? ', on fire' : ''}`);
    }
    for (let i = 0; i < flows.length; i++) {
      const a = cars[i], b = cars[i + 1];
      if (!a || !b) continue;
      const d = a.heat - b.heat;
      const flowIn = Math.abs(b.derived?.heatFlowIn ?? 0) + Math.abs(a.derived?.heatFlowIn ?? 0);
      const txt = d > 2 ? '→' : d < -2 ? '←' : '·';
      setText(flows[i], txt);
      toggleClass(flows[i], 'rv-hot', txt !== '·' && (flowIn > 0.5 || Math.abs(d) > 15));
      setAttr(flows[i], 'title', txt === '·' ? 'No heat flow' : `Heat flows ${txt === '→' ? 'backward' : 'forward'} (${Math.abs(d).toFixed(0)}° difference)`);
    }
  }

  function update(s: SimState, force = false): void {
    const now = performance.now();
    const cars = s.train.cars;
    const sig = cars.map(c => c.id + ':' + c.type).join('|');
    if (sig !== structSig) { structSig = sig; build(s); force = true; }
    const sel = ui.selectedCar();
    if (!force && now - lastUpdate < 200 && sel === selectedShown) return;
    lastUpdate = now; selectedShown = sel;
    updateChips(s);
    const t = s.train;
    const headSig = `${cars.length}|${Math.round(t.totalWeight)}|${t.totalPowerGen}|${t.totalPowerUse}|${t.speed.toFixed(2)}`;
    if (headSig !== lastHead) {
      lastHead = headSig;
      setText(countV, String(cars.length));
      setText(weightV, String(Math.round(t.totalWeight)));
      setText(powerV, `${t.totalPowerGen}/${t.totalPowerUse}`);
      setText(speedV, t.speed.toFixed(2));
      powerV.style.color = t.totalPowerUse > t.totalPowerGen ? 'var(--danger)' : '';
    }
    if (needSpans || force) { needSpans = false; layoutSpans(s); }
  }

  function reset(): void { structSig = ''; lastHead = ''; selectedShown = -2; chips = []; flows = []; spans = []; carsEl.replaceChildren(); }

  const hitAt: number[] = [];
  /** Damage flash + tiny shake on one car chip (train:damage). */
  function hit(carIndex: number): void {
    const ch = chips[carIndex];
    const now = performance.now();
    if (!ch || (hitAt[carIndex] ?? 0) > now - 140) return;
    hitAt[carIndex] = now;
    ch.root.classList.remove('rv-hit');
    void ch.root.offsetWidth;
    ch.root.classList.add('rv-hit');
    window.setTimeout(() => ch.root.classList.remove('rv-hit'), 320);
    shake(ch.root, 3, 0.22);
  }

  window.addEventListener('resize', () => { needSpans = true; });
  return { el: root, update, reset, carsEl, hit };
}
