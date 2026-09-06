/** Car inspector side panel. */
import { el, btn, setText, setWidth, cap, hexColor } from './dom';
import type { UiShared } from './shared';
import type { SimState, Car, Crew, CrewSpecialty } from '../core/types';
import { CAR_DEFS } from '../core/cars';
import { TRAIN } from '../core/config';
import { levelOf, levelPips, levelEffect, hasUpgrades, carUpgradeCost, upgradeApi, MAX_LEVEL, ROMAN } from './levels';
import { crewPortrait } from './crewArt';
import { carArtFor } from './carArt';
import { guardDamage } from '../core/guards';
import { fieldRepairTarget } from '../sim/service';

export interface Inspector { el: HTMLElement; update(s: SimState, force?: boolean): void; reset(): void }

const WHERE = (c: Crew, s: SimState): string => c.carIndex < 0 ? 'unassigned' : `car ${c.carIndex + 1} ${CAR_DEFS[s.train.cars[c.carIndex]?.type ?? 'locomotive']?.short ?? ''}`;

export const CREW_EFFECT: Record<CrewSpecialty, string> = {
  conductor: 'Leads the train and every expedition.',
  engineer: '+2 train power; +2 more when posted to a generator.',
  gunner: '+35% fire rate and +15% range when posted to a weapon.',
  medic: 'Heals every crew member while posted anywhere on the train.',
  surveyor: '+2 planning range and lower route threat while posted.',
  mechanic: 'Repairs the assigned car by 1 hull per second.',
  quartermaster: '+30% capacity for every stored resource while posted.',
};

export function repairCost(car: Car): number { return Math.max(0, Math.ceil((car.maxHp - car.hp) / 4)); }

function carRole(car: Car): string {
  const def = CAR_DEFS[car.type];
  if (car.type === 'locomotive') return 'Command car';
  if (def.weapon) return 'Defense system';
  if (def.powerGen > 0) return 'Power system';
  if (def.cooling > 0) return 'Thermal control';
  if (def.passengerCap > 0) return 'Passenger service';
  if (Object.values(def.storage).some(v => (v ?? 0) > 0)) return 'Logistics system';
  if (def.planRangeBonus || def.trackCostBonus) return 'Navigation system';
  return 'Support system';
}

function carShape(car: Car): string {
  const def = CAR_DEFS[car.type];
  if (car.type === 'locomotive') return 'engine';
  if (def.weapon) return 'weapon';
  if (def.powerGen > 0) return 'generator';
  if (def.cooling > 0) return 'cooler';
  if (def.passengerCap > 0) return 'coach';
  if (Object.values(def.storage).some(v => (v ?? 0) > 0)) return 'cargo';
  return 'utility';
}

export function createInspector(ui: UiShared): Inspector {
  const titleEl = el('h2', { text: 'Car' });
  const subEl = el('span', { class: 'rv-side-sub', text: 'Rolling stock' });
  const body = el('div', { class: 'rv-side-body' });
  const foot = el('div', { class: 'rv-side-foot' });
  const closeBtn = btn('✕', () => { ui.audio().ui('close'); ui.selectCar(-1); }, { class: 'rv-icon rv-small', aria: 'Close inspector' });
  const root = el('aside', { class: 'rv-side rv-inspector rv-panel', 'data-panel': 'train', role: 'complementary', 'aria-label': 'Car inspector' },
    el('div', { class: 'rv-side-head' }, el('div', { class: 'rv-side-title' }, subEl, titleEl), closeBtn), body, foot);

  let structSig = '';
  let builtCarId = '';
  let focusCrewAfterBuild = false;
  let lastDyn = 0;
  interface Dyn {
    hpText: HTMLElement; hpFill: HTMLElement; heatText: HTMLElement; heatFill: HTMLElement;
    powerText: HTMLElement; ammoText: HTMLElement; paxText: HTMLElement | null; boardText: HTMLElement; statusText: HTMLElement;
    heroStatus: HTMLElement; guardText: HTMLElement;
    repairBtn: HTMLButtonElement; sellBtn: HTMLButtonElement; leftBtn: HTMLButtonElement; rightBtn: HTMLButtonElement; detachBtn: HTMLButtonElement;
    crewHp: Array<{ id: string; el: HTMLElement }>;
  }
  let dyn: Dyn | null = null;

  function build(s: SimState, i: number): void {
    const car = s.train.cars[i];
    const sameCar = builtCarId === car.id;
    const oldScroll = sameCar ? body.scrollTop : 0;
    const rosterOpen = sameCar && !!body.querySelector<HTMLDetailsElement>('.rv-insp-roster')?.open;
    builtCarId = car.id;
    const def = CAR_DEFS[car.type];
    const sim = ui.sim();
    const canShop = !!sim && sim.canShop();
    const canReorder = !!sim?.canReorder();
    const lvl = levelOf(car);
    titleEl.replaceChildren(def.name, levelPips(lvl, 'rv-insp-lvl'));
    setText(subEl, `Car ${String(i + 1).padStart(2, '0')} · ${def.short} · ${carRole(car)}`);

    const hpText = el('span'); const hpFill = el('i');
    const heatText = el('span'); const heatFill = el('i');
    const powerText = el('span'); const ammoText = el('span'); const boardText = el('span'); const statusText = el('span');
    const heroStatus = el('span', { class: 'rv-inspector-status', text: 'Operational' });
    const paxText = def.passengerCap > 0 ? el('span') : null;
    const statusCell = (label: string, value: HTMLElement | string, extra = '') => el('div', { class: `rv-insp-status-cell${extra ? ` ${extra}` : ''}` },
      el('span', { class: 'rv-insp-status-label', text: label }),
      typeof value === 'string' ? el('strong', { text: value }) : value,
    );
    const telemetry = el('section', { class: 'rv-insp-telemetry', 'aria-label': 'Car condition' },
      el('article', { class: 'rv-insp-gauge rv-insp-hull' },
        el('div', { class: 'rv-insp-gauge-head' }, el('span', { text: 'Hull integrity' }), el('strong', null, hpText)),
        el('div', { class: 'rv-bar', role: 'meter', 'aria-label': 'Hull integrity' }, hpFill)),
      el('article', { class: 'rv-insp-gauge rv-insp-heat' },
        el('div', { class: 'rv-insp-gauge-head' }, el('span', { text: 'Thermal load' }), el('strong', null, heatText)),
        el('div', { class: 'rv-bar', role: 'meter', 'aria-label': 'Thermal load' }, heatFill)),
    );
    const statusGrid = el('section', { class: 'rv-insp-status-grid', 'aria-label': 'System status' },
      statusCell('Power grid', powerText),
      statusCell('Ammunition', ammoText),
      ...(paxText ? [statusCell('Passengers', paxText)] : []),
      statusCell('Boarders', boardText),
      statusCell('Current state', statusText, 'rv-insp-state'),
      statusCell('Mass', `${def.weight} t`),
      statusCell('Upgrade', el('span', { class: 'rv-insp-level', title: levelEffect(car.type) }, levelPips(lvl), el('span', { text: lvl >= MAX_LEVEL ? 'Maximum' : `Level ${ROMAN[lvl]}` }))),
    );
    const capabilityRows: HTMLElement[] = [];
    const guardText = el('strong');
    capabilityRows.push(el('div', { class: 'rv-insp-capability' }, el('span', { text: 'Emergency guard' }), guardText));
    const capability = (label: string, value: string) => capabilityRows.push(el('div', { class: 'rv-insp-capability' },
      el('span', { text: label }), el('strong', { text: value })));
    if (def.powerGen > 0) capability('Generation', `+${def.powerGen} power · ${TRAIN.powerRange}-car range`);
    if (def.heatGen > 0 || def.cooling > 0) capability('Thermal', `${def.heatGen > 0 ? `+${def.heatGen} heat/s active` : ''}${def.cooling > 0 ? ` −${def.cooling}/s cooling` : ''}`.trim());
    const storage = Object.entries(def.storage).filter(([, v]) => (v ?? 0) > 0);
    if (storage.length) capability('Storage', storage.map(([k, v]) => `+${v} ${k}`).join(' · '));
    if (def.type === 'foundry') capability('Production', '6 shared ammo / 1 scrap every 4s when powered');
    if (def.planRangeBonus || def.trackCostBonus) capability('Planning', `${def.planRangeBonus ? `+${def.planRangeBonus} range` : ''} ${def.trackCostBonus ? `${def.trackCostBonus} track cost` : ''}`.trim());

    const artSrc = carArtFor(car.type, lvl);
    const heroMachine = artSrc
      ? el('img', { class: 'rv-car-art', src: artSrc, alt: '', draggable: 'false' })
      : el('span', { class: 'rv-machine' },
          el('i', { class: 'rv-machine-top' }),
          el('i', { class: 'rv-machine-body' }),
          el('i', { class: 'rv-machine-detail' }),
          el('i', { class: 'rv-machine-wheel rv-wheel-a' }),
          el('i', { class: 'rv-machine-wheel rv-wheel-b' }));
    const hero = el('section', { class: `rv-inspector-hero rv-car-${carShape(car)}${artSrc ? ' rv-has-car-art' : ''}`, style: `--accent:${hexColor(def.color)}` },
      el('div', { class: 'rv-inspector-machine', 'aria-hidden': 'true' },
        heroMachine),
      el('div', { class: 'rv-inspector-hero-copy' },
        el('span', { class: 'rv-inspector-role', text: carRole(car) }),
        heroStatus,
        el('p', { class: 'rv-desc', text: def.desc })));
    const sections: HTMLElement[] = [hero, telemetry, statusGrid];
    if (capabilityRows.length) sections.push(el('section', { class: 'rv-insp-capabilities', 'aria-label': 'Car capabilities' }, ...capabilityRows));

    let weaponSection: HTMLElement | null = null;
    if (def.weapon) {
      const w = def.weapon;
      const targets = [w.hitsGround && 'ground', w.hitsAir && 'air', w.hitsPhase && 'wisps'].filter(Boolean).join(' + ');
      const weaponMetric = (label: string, value: string) => el('div', { class: 'rv-weapon-metric' }, el('span', { text: label }), el('strong', { text: value }));
      weaponSection = el('section', { class: 'rv-insp-module rv-insp-weapon' },
        el('div', { class: 'rv-insp-module-head' },
          el('div', null, el('span', { class: 'rv-label', text: 'Weapon system' }), el('strong', { text: `${cap(w.kind)} · ${cap(w.damageClass)}` })),
          el('span', { class: 'rv-insp-targets', text: targets || 'no valid targets' })),
        el('div', { class: 'rv-weapon-grid' },
          weaponMetric('Damage', `${w.damage}${w.aoe ? ` + ${w.aoe}px splash` : ''}${w.chain ? ` · chain ×${w.chain}` : ''}`),
          weaponMetric('Fire rate', `${(1 / w.cooldown).toFixed(2)} / sec`),
          weaponMetric('Range', `${w.range} px`)),
        el('div', { class: 'rv-weapon-costs' },
          el('span', { text: w.ammoPerShot ? `${w.ammoPerShot} ammo / shot` : 'No ammunition needed' }),
          el('span', { text: `+${w.heatPerShot} heat / shot` })),
      );
    }

    // crew slot
    const unassigned = s.train.crew.filter(c => c.carIndex < 0);
    const current = car.crewId ? s.train.crew.find(c => c.id === car.crewId) ?? null : null;
    const unassignBtn = btn('Unassign', () => {
      const simA = ui.sim(); if (!simA || !current) return;
      const ok = simA.assignCrew(current.id, -1);
      ui.audio().ui(ok ? 'click' : 'error');
      focusCrewAfterBuild = ok;
      structSig = '';
    }, { class: 'rv-small', aria: 'Unassign current crew member' });
    unassignBtn.disabled = !current;
    const slotLead = current
      ? `${current.name} · ${cap(current.specialty)} · ${Math.round(current.hp)} HP`
      : i === 0 ? 'The Conductor commands from here.' : unassigned.length ? `${unassigned.length} specialist${unassigned.length === 1 ? '' : 's'} ready to post.` : 'Crew berth open';
    const slotEffect = current ? CREW_EFFECT[current.specialty] : 'Posting is immediate and can be changed at any time.';
    const choices = el('div', { class: 'rv-crew-choices', role: 'group', 'aria-label': 'Available specialists' });
    if (i > 0 && unassigned.length) {
      for (const c of unassigned) {
        const choice = el('button', {
          class: 'rv-crew-choice', type: 'button',
          'aria-label': `Post ${c.name}, ${c.specialty}, to ${def.name}. ${CREW_EFFECT[c.specialty]}`,
        },
          crewPortrait(c.specialty, 'rv-crew-choice-mark rv-crew-role-portrait'),
          el('span', { class: 'rv-crew-choice-copy' },
            el('span', { class: 'rv-crew-choice-head' }, el('strong', { text: c.name }), el('span', { text: cap(c.specialty) }), el('b', { text: `${Math.round(c.hp)} HP` })),
            el('span', { class: 'rv-crew-choice-effect', text: CREW_EFFECT[c.specialty] })),
          el('span', { class: 'rv-crew-choice-action', text: 'Post' }),
        );
        choice.addEventListener('click', () => {
          const simA = ui.sim(); if (!simA) return;
          const ok = simA.assignCrew(c.id, i);
          focusCrewAfterBuild = ok;
          ui.audio().ui(ok ? 'confirm' : 'error');
          if (ok) ui.notify(`${c.name} posted to ${def.name}. ${CREW_EFFECT[c.specialty]}`, 'good', 4800, 'crew-posted');
          else ui.notify('Could not post that specialist here.', 'warn');
          structSig = '';
        });
        choices.appendChild(choice);
      }
    } else if (i > 0 && !current) {
      choices.appendChild(el('div', { class: 'rv-crew-empty' },
        el('strong', { text: 'No specialist waiting' }),
        el('span', { text: 'Unassign crew from another car or rescue a specialist along the line.' })));
    }
    sections.push(el('section', { class: 'rv-crew-slot rv-insp-module' },
      el('div', { class: 'rv-crew-slot-head' },
        current ? crewPortrait(current.specialty, 'rv-crew-portrait', `${current.name}, ${current.specialty}`) : el('span', { class: 'rv-crew-ready-lamp', 'aria-hidden': 'true' }),
        el('div', null,
        el('div', { class: 'rv-label', text: current ? 'Crew posted here' : 'Crew berth' }),
        el('strong', { text: slotLead }))),
      el('div', { class: 'rv-crew-effect', text: slotEffect }),
      current && current.specialty !== 'conductor' ? el('div', { class: 'rv-row rv-crew-controls' }, unassignBtn) : null,
      choices.childElementCount ? el('div', { class: 'rv-crew-posting' }, el('div', { class: 'rv-label', text: 'Available specialists' }), choices) : null,
    ));
    if (weaponSection) sections.push(weaponSection);

    // crew roster
    const crewHp: Array<{ id: string; el: HTMLElement }> = [];
    if (s.train.crew.length) {
      const list = el('div', { class: 'rv-col rv-insp-roster-list' });
      for (const c of s.train.crew) {
        const hpEl = el('span', { class: 'rv-where', text: `${Math.round(c.hp)} hp · ${WHERE(c, s)}` });
        crewHp.push({ id: c.id, el: hpEl });
        list.appendChild(el('div', { class: 'rv-crew-line', title: CREW_EFFECT[c.specialty] },
          crewPortrait(c.specialty, 'rv-roster-portrait'),
          el('span', null, c.name, ' ', el('span', { class: 'rv-spec', text: c.specialty }), el('small', { text: CREW_EFFECT[c.specialty] })), hpEl));
      }
      sections.push(el('details', { class: 'rv-insp-roster' },
        el('summary', null,
          el('span', { text: 'Train crew' }),
          el('strong', { text: `${s.train.crew.length} aboard` })),
        list));
    }
    body.replaceChildren(...sections);
    const roster = body.querySelector<HTMLDetailsElement>('.rv-insp-roster');
    if (roster) roster.open = rosterOpen;
    body.scrollTop = oldScroll;
    if (focusCrewAfterBuild) {
      focusCrewAfterBuild = false;
      const next = body.querySelector<HTMLElement>('.rv-crew-controls button, .rv-crew-choice');
      next?.focus({ preventScroll: true });
      // Keep the posting task visible rather than jumping back to the car hero.
      body.querySelector('.rv-crew-slot')?.scrollIntoView({ block: 'nearest' });
    }

    // footer actions
    const repairBtn = btn('Repair', () => {
      const simA = ui.sim(); if (!simA) return;
      const ok = simA.canShop() ? simA.repairCar(i) : simA.setFieldRepair(!simA.state.train.service?.repairing);
      ui.audio().ui(ok ? 'confirm' : 'error');
      if (!ok) ui.notify('Need a staffed stop, scrap, and a hull below the repair limit.', 'warn');
    }, { class: 'rv-small', aria: canShop ? 'Repair this car' : 'Toggle field repairs for the train (P)' });
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
    leftBtn.disabled = !canReorder || i <= 1;
    rightBtn.disabled = !canReorder || isLoco || i >= s.train.cars.length - 1;
    detachBtn.disabled = isLoco;
    const upgradeBtns: HTMLElement[] = [];
    if (canShop && !isLoco && hasUpgrades(sim)) {
      const uc = carUpgradeCost(sim, i);
      const maxed = uc < 0 || lvl >= MAX_LEVEL;
      const up = btn(maxed ? `Level ${ROMAN[lvl]} (max)` : `Upgrade to ${ROMAN[lvl + 1]} (${uc} scrap)`, () => {
        let ok = false;
        try { ok = !!upgradeApi(ui.sim()).upgradeCar?.(i); } catch { ok = false; }
        ui.audio().ui(ok ? 'confirm' : 'error');
        if (!ok) ui.notify('Cannot upgrade: not enough scrap or already at max level.', 'warn');
        structSig = '';
      }, { class: 'rv-small' + (maxed ? '' : ' rv-primary'), aria: maxed ? 'Car is at maximum level' : `Upgrade this car to level ${lvl + 1} for ${uc} scrap`, title: levelEffect(car.type) });
      up.disabled = maxed || s.train.resources.scrap < uc;
      upgradeBtns.push(up);
    }
    foot.replaceChildren(repairBtn, ...upgradeBtns, sellBtn, leftBtn, rightBtn, detachBtn, btn('Close', () => { ui.audio().ui('close'); ui.selectCar(-1); }, { class: 'rv-small', aria: 'Close inspector (T)' }));
    if (!canShop) foot.appendChild(el('div', { class: 'rv-hint', text: canReorder
      ? 'Reorder here. Field repairs (P) hold the train and mend the weakest cars to 80%; 1 scrap / 8 HP. The Void keeps moving. Depart with X.'
      : 'Staffed stops: reorder and repair slowly to 80%. Yards: instant full repair, upgrades and trading.' }));

    dyn = { hpText, hpFill, heatText, heatFill, powerText, ammoText, paxText, boardText, statusText, heroStatus, guardText, repairBtn, sellBtn, leftBtn, rightBtn, detachBtn, crewHp };
  }

  function updateDyn(s: SimState, i: number): void {
    if (!dyn) return;
    const car = s.train.cars[i];
    const def = CAR_DEFS[car.type];
    const hpR = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    setText(dyn.guardText, `${guardDamage(s, car)} damage / ${TRAIN.guardCooldown}s · short range · no ammo · ground & air, not wisps`);
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
        setText(dyn.ammoText, has ? `Shared stock: ${Math.floor(s.train.resources.ammo)}` : 'Out of ammo — replenish shared stock');
        dyn.ammoText.style.color = has ? 'var(--good)' : 'var(--danger)';
      } else { setText(dyn.ammoText, 'not needed'); dyn.ammoText.style.color = ''; }
    } else { setText(dyn.ammoText, def.type === 'foundry' ? 'produces shared ammo' : 'not needed'); dyn.ammoText.style.color = ''; }
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
    setText(dyn.heroStatus, status.length ? status.join(' · ') : 'Operational');
    dyn.heroStatus.dataset.tone = car.hp <= 0 || car.onFire || car.boarders.length ? 'danger' : car.disabled || pr < .999 ? 'warn' : 'good';
    dyn.statusText.style.color = car.hp <= 0 || car.onFire ? 'var(--danger)' : '';
    const sim = ui.sim();
    const canShop = !!sim && sim.canShop();
    const cost = repairCost(car);
    const repairing = !!s.train.service?.repairing;
    setText(dyn.repairBtn, canShop ? cost > 0 ? `Repair (${cost} scrap)` : 'Repair (full)' : repairing ? 'Stop field repairs (P)' : 'Field repair fleet (P)');
    dyn.repairBtn.title = canShop ? 'Instant repair for this car' : 'Slowly repair the weakest cars to 80%; 1 scrap / 8 HP. World time continues.';
    dyn.repairBtn.disabled = canShop ? cost <= 0 || s.train.resources.scrap < 1 : !sim?.canService() || (!repairing && (!fieldRepairTarget(s) || s.train.resources.scrap <= 0));
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
    const sig = [i, car.id, car.type, car.crewId ?? '', s.train.crew.map(c => `${c.id}:${c.carIndex}`).join(','), canShop ? 1 : 0, sim?.canReorder(), s.train.cars.length, levelOf(car), canShop ? Math.floor(s.train.resources.scrap) : 0].join('|');
    if (sig !== structSig) { structSig = sig; build(s, i); force = true; }
    const now = performance.now();
    if (!force && now - lastDyn < 200) return;
    lastDyn = now;
    updateDyn(s, i);
  }

  function reset(): void { structSig = ''; builtCarId = ''; focusCrewAfterBuild = false; dyn = null; body.replaceChildren(); foot.replaceChildren(); }

  ui.registerPanel('inspector', { el: root, modal: false, anim: 'side', onOpen: () => { structSig = ''; }, onClose: () => { /* selection handled by ui.selectCar */ } });
  ui.onSelectCar(() => { structSig = ''; });
  return { el: root, update, reset };
}
