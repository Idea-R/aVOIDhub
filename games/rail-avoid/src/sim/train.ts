/** Train: composition, propagation (power/heat/ammo), movement along the route, production and consumption. */
import type { SimState, TrainState, Car, ResourceKey, CarType, Crew, CrewSpecialty } from '../core/types';
import type { SimContext } from './api';
import { CAR_DEFS } from '../core/cars';
import { TRAIN, HEX_R, TERRAIN_SPEED, WEATHER, MAX_CARS, UPGRADES } from '../core/config';
import { hexToWorld } from '../core/hex';
import { makeCar, recomputeCapacity, damageCar, addResource, log, tileAt, fixCrewIndices, nextId, carPos, damageEnemy, carPowerGen, carCooling, carPassengerCap } from './helpers';
import { autoFollow, aheadCount, unplanLast } from './route';

export const CAR_SPACING = 40; // px between car centres along the track

const CREW_NAMES = ['Ada', 'Bram', 'Cass', 'Dov', 'Elka', 'Finn', 'Greta', 'Hale', 'Ines', 'Jory', 'Kit', 'Lior', 'Mara', 'Nils', 'Orla', 'Pim', 'Rook', 'Sunny', 'Tovi', 'Uma', 'Vey', 'Wil', 'Yves', 'Zia'];

export function initTrain(state: SimState): TrainState {
  const t: TrainState = {
    cars: [], routeIndex: Math.max(0, state.route.path.length - 1), progress: 0, speed: 0, speedTarget: 0, moving: false, stopped: true, stopReason: 'no_route',
    stopTimer: 0, stopPressure: 0, hounds: 0, reversing: false, locoUpgrades: { speed: 0, power: 0, frame: 0, crew: 0 }, watchUntil: 0, relics: [], marks: 0,
    resources: { ...TRAIN.startResources }, capacity: { ...TRAIN.baseCapacity },
    passengers: 0, passengerCap: 0, passengersDelivered: 0, morale: 80, crew: [],
    trailX: [], trailY: [], trailAngle: [], burningScrap: false, distanceTravelled: 0,
    totalWeight: 0, totalPowerGen: 0, totalPowerUse: 0,
  };
  state.train = t;
  for (const type of ['locomotive', 'barracks', 'coal_bunker', 'gatling', 'cargo', 'coach'] as CarType[]) t.cars.push(makeCar(state, type));
  // the Conductor (player character) always rides the locomotive and leads expeditions
  const conductor = addCrew(state, 'conductor', 'The Conductor');
  conductor.carIndex = 0;
  t.cars[0].crewId = conductor.id;
  recomputeCapacity(state);
  computeTrail(state);
  return t;
}

export function addCrew(state: SimState, specialty: CrewSpecialty, name?: string): Crew {
  const n = name ?? CREW_NAMES[(state.nextId + state.train.crew.length * 7) % CREW_NAMES.length];
  const c: Crew = { id: nextId(state, 'crew'), name: n, specialty, carIndex: -1, hp: 100 };
  state.train.crew.push(c);
  return c;
}

export function assignCrew(ctx: SimContext, crewId: string, carIndex: number): boolean {
  const t = ctx.state.train;
  const c = t.crew.find(cr => cr.id === crewId);
  if (!c) return false;
  if (carIndex >= t.cars.length) return false;
  // unassign from previous
  if (c.carIndex >= 0 && t.cars[c.carIndex]) t.cars[c.carIndex].crewId = null;
  if (carIndex < 0) { c.carIndex = -1; ctx.bus.defer('crew:assigned', { crewId, carIndex: -1 }); return true; }
  const car = t.cars[carIndex];
  if (car.crewId && car.crewId !== crewId) {
    const other = t.crew.find(cr => cr.id === car.crewId);
    if (other) other.carIndex = -1;
  }
  car.crewId = crewId;
  c.carIndex = carIndex;
  ctx.bus.defer('crew:assigned', { crewId, carIndex });
  recomputeCapacity(ctx.state);
  return true;
}

export function crewIn(state: SimState, carIndex: number): Crew | null {
  const id = state.train.cars[carIndex]?.crewId;
  if (!id) return null;
  return state.train.crew.find(c => c.id === id) ?? null;
}

// ---------- geometry ----------
interface Poly { xs: number[]; ys: number[]; cum: number[]; len: number; ref: Array<[number, number]> | null; first: string; }
const polyCache = new WeakMap<SimState, Poly>();

function pathPoly(state: SimState): Poly {
  const p = state.route.path;
  let poly = polyCache.get(state);
  const first = p.length ? p[0][0] + ',' + p[0][1] : '';
  if (!poly || poly.len !== p.length || poly.ref !== p || poly.first !== first) {
    if (!poly) { poly = { xs: [], ys: [], cum: [0], len: 0, ref: p, first }; polyCache.set(state, poly); }
    if (poly.len > p.length || poly.ref !== p || poly.first !== first) { poly.xs.length = 0; poly.ys.length = 0; poly.cum.length = 1; poly.len = 0; poly.ref = p; poly.first = first; }
    for (let i = poly.len; i < p.length; i++) {
      const w = hexToWorld(p[i][0], p[i][1]);
      poly.xs.push(w.x); poly.ys.push(w.y);
      if (i > 0) {
        const dx = w.x - poly.xs[i - 1], dy = w.y - poly.ys[i - 1];
        poly.cum[i] = poly.cum[i - 1] + Math.sqrt(dx * dx + dy * dy);
      }
    }
    poly.len = p.length;
  }
  return poly;
}

/** Arc position of the loco along the path polyline (px). */
export function locoArc(state: SimState): number {
  const poly = pathPoly(state);
  const i = state.train.routeIndex;
  if (i + 1 >= poly.len) return poly.cum[Math.max(0, poly.len - 1)] ?? 0;
  return poly.cum[i] + state.train.progress * (poly.cum[i + 1] - poly.cum[i]);
}

function sampleArc(poly: Poly, s: number, segHint: number): { x: number; y: number; a: number; seg: number } {
  if (poly.len <= 1) return { x: poly.xs[0] ?? 0, y: poly.ys[0] ?? 0, a: 0, seg: 0 };
  let seg = Math.min(segHint, poly.len - 2);
  while (seg > 0 && poly.cum[seg] > s) seg--;
  while (seg < poly.len - 2 && poly.cum[seg + 1] < s) seg++;
  const l = poly.cum[seg + 1] - poly.cum[seg] || 1;
  const t = Math.max(0, Math.min(1, (s - poly.cum[seg]) / l));
  const x = poly.xs[seg] + (poly.xs[seg + 1] - poly.xs[seg]) * t;
  const y = poly.ys[seg] + (poly.ys[seg + 1] - poly.ys[seg]) * t;
  const a = Math.atan2(poly.ys[seg + 1] - poly.ys[seg], poly.xs[seg + 1] - poly.xs[seg]);
  return { x, y, a, seg };
}

export function computeTrail(state: SimState): void {
  const t = state.train;
  const poly = pathPoly(state);
  const s0 = locoArc(state);
  t.trailX.length = t.cars.length; t.trailY.length = t.cars.length; t.trailAngle.length = t.cars.length;
  let seg = t.routeIndex;
  for (let i = 0; i < t.cars.length; i++) {
    const s = s0 - i * CAR_SPACING;
    if (s <= 0) {
      // before the start of the path: extend backwards along the first segment direction (or west)
      const a = poly.len >= 2 ? Math.atan2(poly.ys[1] - poly.ys[0], poly.xs[1] - poly.xs[0]) : 0;
      t.trailX[i] = (poly.xs[0] ?? 0) + Math.cos(a) * s;
      t.trailY[i] = (poly.ys[0] ?? 0) + Math.sin(a) * s;
      t.trailAngle[i] = a;
      continue;
    }
    const p = sampleArc(poly, s, seg);
    seg = p.seg;
    t.trailX[i] = p.x; t.trailY[i] = p.y; t.trailAngle[i] = p.a;
  }
}

// ---------- propagation ----------
export function propagate(ctx: SimContext): void {
  const { state, dt } = ctx;
  const t = state.train;
  const n = t.cars.length;
  const defs = t.cars.map(c => CAR_DEFS[c.type]);
  const alive = t.cars.map(c => c.hp > 0 && !c.disabled);
  const gens: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    let g = carPowerGen(state, t.cars[i], i);
    const cr = crewIn(state, i);
    if (cr && cr.specialty === 'engineer' && g > 0) g += 2;
    gens[i] = g;
  }
  // demand per generator span
  const ratio: number[] = new Array(n).fill(0);
  const supply: number[] = new Array(n).fill(0);
  for (let g = 0; g < n; g++) {
    if (gens[g] <= 0) continue;
    let demand = 0;
    for (let i = Math.max(0, g - TRAIN.powerRange); i <= Math.min(n - 1, g + TRAIN.powerRange); i++) if (alive[i]) demand += defs[i].powerUse;
    const r = demand > 0 ? Math.min(1, gens[g] / demand) : 1;
    for (let i = Math.max(0, g - TRAIN.powerRange); i <= Math.min(n - 1, g + TRAIN.powerRange); i++) if (alive[i]) supply[i] += r * defs[i].powerUse;
  }
  for (let i = 0; i < n; i++) {
    const use = defs[i].powerUse;
    ratio[i] = use > 0 ? Math.min(1, supply[i] / use) : 1;
    if (!alive[i]) ratio[i] = 0;
  }
  // ammo supply
  const ammoSup: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!defs[i].weapon || defs[i].weapon!.ammoPerShot === 0) { ammoSup[i] = true; continue; }
    for (let j = Math.max(0, i - TRAIN.ammoRange); j <= Math.min(n - 1, i + TRAIN.ammoRange); j++) {
      if (t.cars[j].hp > 0 && defs[j].ammoSupplier) { ammoSup[i] = true; break; }
    }
  }
  // heat: generation, cooling, diffusion, fire
  const cooling = WEATHER[state.weather.kind].cooling * state.weather.intensity;
  const heatIn: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const car = t.cars[i];
    const d = defs[i];
    let gen = 0;
    if (car.hp > 0 && !car.disabled) {
      if (d.powerGen > 0) gen += d.heatGen;                    // generators run constantly
      else gen += d.heatGen * car.derived.activity * (ratio[i] > 0 ? 1 : 0.3);
    }
    let cool = TRAIN.baseCooling + cooling + carCooling(car);
    for (const j of [i - 1, i + 1]) if (t.cars[j] && t.cars[j].hp > 0 && defs[j].type === 'radiator') cool += 3 + (t.cars[j].level - 1);
    heatIn[i] += gen - cool;
    if (car.onFire) {
      for (const j of [i - 1, i + 1]) if (t.cars[j]) heatIn[j] += TRAIN.fireSpreadHeat;
    }
  }
  for (let i = 0; i + 1 < n; i++) {
    const flow = (t.cars[i].heat - t.cars[i + 1].heat) * TRAIN.heatDiffusion;
    heatIn[i] -= flow; heatIn[i + 1] += flow;
  }
  for (let i = 0; i < n; i++) {
    const car = t.cars[i];
    const before = car.heat;
    car.heat = Math.max(0, Math.min(120, car.heat + heatIn[i] * dt));
    car.derived.heatFlowIn = i + 1 < n ? (t.cars[i + 1].heat - car.heat) * TRAIN.heatDiffusion : 0;
    car.derived.powerRatio = ratio[i];
    car.derived.hasAmmoSupply = ammoSup[i];
    car.derived.activity = Math.max(0, car.derived.activity - 2 * dt);
    if (car.disabled) { car.disabledFor -= dt; if (car.disabledFor <= 0) { car.disabled = false; car.disabledFor = 0; } }
    if (car.heat >= TRAIN.heatFireAt && !car.onFire) { car.onFire = true; ctx.bus.defer('car:fire', { carIndex: i, on: true }); ctx.bus.defer('car:overheat', { carIndex: i }); log(state, `${defs[i].name} is on fire!`, 'bad'); }
    if (car.onFire && car.heat < 60) { car.onFire = false; ctx.bus.defer('car:fire', { carIndex: i, on: false }); }
    const emberMul = (t.relics ?? []).includes('ember_gloves') ? 0.5 : 1;
    if (car.onFire) damageCar(ctx, i, TRAIN.fireDamage * dt * emberMul, 'fire');
    else if (car.heat >= TRAIN.heatDamageAt) damageCar(ctx, i, TRAIN.heatDamage * dt * emberMul, 'heat');
    if (before < TRAIN.heatDamageAt && car.heat >= TRAIN.heatDamageAt && !car.onFire) ctx.bus.defer('car:overheat', { carIndex: i });
    if (state.phase === 'defeat') return;
  }
}

// ---------- production / crew / passengers ----------
function production(ctx: SimContext): void {
  const { state, dt } = ctx;
  const t = state.train;
  for (let i = 0; i < t.cars.length; i++) {
    const car = t.cars[i];
    if (car.hp <= 0 || car.disabled) continue;
    const pr = car.derived.powerRatio;
    const cr = crewIn(state, i);
    if (car.type === 'fabricator' || car.type === 'foundry') {
      if (pr > 0.3 && t.resources.scrap >= (car.type === 'fabricator' ? 2 : 1)) {
        car.workTimer += dt * pr;
        car.derived.activity = 1;
        if (car.workTimer >= 4) {
          car.workTimer = 0;
          if (car.type === 'fabricator') { if (t.resources.rails < t.capacity.rails) { addResource(ctx, 'scrap', -2); addResource(ctx, 'rails', 1); } }
          else if (t.resources.ammo < t.capacity.ammo) { addResource(ctx, 'scrap', -1); addResource(ctx, 'ammo', 6); }
        }
      }
    }
    if (cr && cr.specialty === 'mechanic' && car.hp < car.maxHp) car.hp = Math.min(car.maxHp, car.hp + TRAIN.mechanicRepair * dt);
    if ((t.relics ?? []).includes('tinkers_kit') && car.hp < car.maxHp) car.hp = Math.min(car.maxHp, car.hp + 0.4 * dt);
    if (car.type === 'medical' && pr > 0.5) {
      for (const c of t.crew) c.hp = Math.min(100, c.hp + TRAIN.crewHeal * dt);
    }
  }
  // the engine crew fights boarders in the locomotive (weakly) so the loco is never defenceless
  const loco = t.cars[0];
  if (loco && loco.boarders.length) {
    for (const eid of loco.boarders) {
      const e = state.enemies.find(en => en.id === eid);
      if (e && e.hp > 0) damageEnemy(ctx, e, 2.5 * dt, 'melee');
    }
  }
  // medic crew heals crew slowly anywhere
  if (t.crew.some(c => c.specialty === 'medic' && c.carIndex >= 0)) for (const c of t.crew) c.hp = Math.min(100, c.hp + 0.5 * dt);
  // passengers: food & morale
  if (t.passengers > 0) {
    const need = t.passengers * TRAIN.passengerFoodPerMin / 60 * dt;
    if (t.resources.food > 0) { t.resources.food = Math.max(0, t.resources.food - need); t.morale = Math.min(100, t.morale + 0.15 * dt); }
    else { t.morale = Math.max(0, t.morale - 1.2 * dt); }
    if (state.weather.kind === 'ashfall' && state.weather.intensity > 0.5 && !t.cars.some(c => c.type === 'sleeper' && c.hp > 0) && !(t.relics ?? []).includes('ashfall_cloak')) {
      t.morale = Math.max(0, t.morale - 0.4 * dt);
      const hasMed = t.cars.some(c => c.type === 'medical' && c.hp > 0);
      state.train.stopTimer; // no-op; ashfall passenger loss is handled by the periodic block below
      if (!hasMed && Math.floor(state.time / 25) !== Math.floor((state.time - dt) / 25)) {
        removePassengers(ctx, 1, 'ashfall');
      }
    }
    if (t.morale <= 0 && Math.floor(state.time / 15) !== Math.floor((state.time - dt) / 15)) removePassengers(ctx, 1, 'despair');
  } else {
    t.morale = Math.min(100, t.morale + 0.1 * dt);
  }
}

export function removePassengers(ctx: SimContext, count: number, cause: string): number {
  const t = ctx.state.train;
  let left = Math.min(count, t.passengers);
  const removed = left;
  for (let i = t.cars.length - 1; i >= 0 && left > 0; i--) {
    const car = t.cars[i];
    const take = Math.min(car.passengers, left);
    car.passengers -= take; left -= take;
  }
  t.passengers -= removed;
  if (removed > 0) ctx.bus.defer('passengers:lost', { count: removed, cause });
  return removed;
}

/** Board passengers into coaches; returns how many boarded. */
export function boardPassengers(ctx: SimContext, count: number): number {
  const t = ctx.state.train;
  let left = count, boarded = 0;
  for (const car of t.cars) {
    const cap = carPassengerCap(car);
    if (cap <= 0 || car.hp <= 0) continue;
    const room = cap - car.passengers;
    const take = Math.max(0, Math.min(room, left));
    car.passengers += take; left -= take; boarded += take;
    if (left <= 0) break;
  }
  t.passengers += boarded;
  if (boarded > 0) ctx.bus.defer('passengers:board', { count: boarded });
  recomputeCapacity(ctx.state);
  return boarded;
}

// ---------- movement ----------
export function speedTarget(state: SimState): number {
  const t = state.train;
  if (t.cars.length === 0 || t.cars[0].hp <= 0) return 0;
  const loco = t.cars[0];
  let gen = t.totalPowerGen;
  if (state.train.crew.some(c => c.specialty === 'engineer' && c.carIndex >= 0)) gen += 2;
  const ratio = gen / Math.max(1, t.totalWeight / TRAIN.weightPerPower);
  let f = Math.max(TRAIN.minSpeedFactor, Math.min(TRAIN.maxSpeedFactor, ratio));
  f *= 0.6 + 0.4 * (loco.hp / loco.maxHp);
  if (loco.disabled) f *= 0.5;
  const p = state.route.path[Math.min(t.routeIndex, state.route.path.length - 1)];
  const tile = p ? tileAt(state, p[0], p[1]) : null;
  if (tile) f *= TERRAIN_SPEED[tile.terrain];
  const w = WEATHER[state.weather.kind];
  f *= 1 - (1 - w.speedMul) * state.weather.intensity;
  if (!(t.relics ?? []).includes('hound_whistle')) f *= Math.max(0.4, 1 - t.hounds * TRAIN.houndSlowPerStack);
  f *= 1 + UPGRADES.locoSpeedPerLevel * (t.locoUpgrades?.speed ?? 0);
  if ((t.relics ?? []).includes('grease_tin')) f *= 1.08;
  if (t.resources.coal <= 0 && t.resources.scrap <= 0) f *= 0.3;
  return TRAIN.baseSpeed * f;
}

export interface MoveEvents { enteredTiles: Array<[number, number]>; }

export function updateMovement(ctx: SimContext, onEnterTile: (col: number, row: number) => void): void {
  const { state, dt } = ctx;
  const t = state.train;
  t.hounds = Math.max(0, t.hounds - TRAIN.houndDecay * dt);

  // stopped logic
  if (t.stopped) {
    t.stopTimer += dt;
    // stalling in the wild draws attention; settlements are havens
    if (t.stopReason === 'no_route' || t.stopReason === 'junction') t.stopPressure = Math.min(1, t.stopPressure + TRAIN.stopPressureRate * dt);
    else t.stopPressure = Math.max(0, t.stopPressure - TRAIN.stopPressureDecay * dt);
    if (t.stopReason === 'no_route' || t.stopReason === 'junction') {
      if (aheadCount(state) > 0) { t.stopped = false; t.stopReason = 'none'; t.stopTimer = 0; ctx.bus.defer('train:start', {}); }
      else if (state.phase === 'running') {
        const af = autoFollow(ctx);
        if (af === 'extended') { t.stopped = false; t.stopReason = 'none'; t.stopTimer = 0; ctx.bus.defer('train:start', {}); }
        else if (af === 'junction' && t.stopReason !== 'junction') { t.stopReason = 'junction'; ctx.bus.defer('train:stop', { reason: 'junction' }); }
      }
    }
    t.speed = Math.max(0, t.speed - 0.5 * dt);
    if (t.stopped) { computeTrail(state); return; }
  } else {
    t.stopPressure = Math.max(0, t.stopPressure - TRAIN.stopPressureDecay * dt);
  }

  t.speedTarget = speedTarget(state);
  if (t.reversing) { updateReverse(ctx); return; }
  // approach the end of the plan: decelerate so we stop at the last tile
  const poly = pathPoly(state);
  const s = locoArc(state);
  const remaining = (poly.cum[poly.len - 1] ?? 0) - s;
  const stopDist = 30;
  let target = t.speedTarget;
  if (remaining < HEX_R * 2) target = Math.min(target, Math.max(0.08, t.speedTarget * remaining / (HEX_R * 2)));
  const accel = 0.22;
  if (t.speed < target) t.speed = Math.min(target, t.speed + accel * dt);
  else t.speed = Math.max(target, t.speed - accel * 2 * dt);
  const pxPerHex = HEX_R * Math.sqrt(3);
  const step = t.speed * pxPerHex * dt;
  // coal / scrap burn
  const hexes = step / pxPerHex;
  const coalNeed = hexes * (TRAIN.coalPerHex + t.totalWeight * TRAIN.coalPerTonPerHex) * ((t.relics ?? []).includes('coal_heart') ? 0.8 : 1);
  if (t.resources.coal >= coalNeed) { t.resources.coal -= coalNeed; t.burningScrap = false; }
  else if (t.resources.scrap >= coalNeed * TRAIN.scrapBurnRatio) {
    t.resources.coal = 0; t.resources.scrap -= coalNeed * TRAIN.scrapBurnRatio;
    if (!t.burningScrap) { t.burningScrap = true; log(state, 'Out of coal: burning scrap to keep moving', 'warn'); ctx.bus.defer('ui:notify', { text: 'Out of coal — burning scrap', kind: 'warn' }); }
  } else { t.resources.coal = 0; t.burningScrap = false; }
  t.distanceTravelled += hexes;
  // advance along the polyline
  let s2 = s + step;
  const end = poly.cum[poly.len - 1] ?? 0;
  if (s2 >= end - 0.01) {
    s2 = end;
    t.routeIndex = poly.len - 1; t.progress = 0;
    t.stopped = true; t.stopReason = 'no_route'; t.stopTimer = 0; t.speed = 0;
    if (poly.len - 1 > 0) onEnterTile(state.route.path[poly.len - 1][0], state.route.path[poly.len - 1][1]);
    const af = state.phase === 'running' ? autoFollow(ctx) : 'none';
    if (af === 'extended') { t.stopped = false; t.stopReason = 'none'; }
    else {
      ctx.bus.defer('train:stop', { reason: af === 'junction' ? 'junction' : 'no_route' });
      if (af === 'junction') t.stopReason = 'junction';
    }
    computeTrail(state);
    return;
  }
  let idx = t.routeIndex;
  while (idx + 1 < poly.len && poly.cum[idx + 1] <= s2) {
    idx++;
    onEnterTile(state.route.path[idx][0], state.route.path[idx][1]);
    if (state.phase !== 'running' || t.stopped) break;
  }
  if (t.stopped) {
    // arrival at a settlement stop: snap to tile centre
    t.routeIndex = idx; t.progress = 0; t.speed = 0;
    computeTrail(state);
    return;
  }
  t.routeIndex = idx;
  const segLen = (poly.cum[idx + 1] ?? poly.cum[idx]) - poly.cum[idx] || 1;
  t.progress = idx + 1 < poly.len ? Math.max(0, Math.min(1, (s2 - poly.cum[idx]) / segLen)) : 0;
  void stopDist;
  computeTrail(state);
}

/** Backing down the traversed track. The plan ahead was discarded when reversing began. */
function updateReverse(ctx: SimContext): void {
  const { state, dt } = ctx;
  const t = state.train;
  const poly = pathPoly(state);
  const hasCaboose = t.cars.some(c => c.type === 'caboose' && c.hp > 0);
  const target = t.speedTarget * (hasCaboose ? 1 : TRAIN.reverseSpeedMul);
  const accel = 0.22;
  if (t.speed < target) t.speed = Math.min(target, t.speed + accel * dt);
  else t.speed = Math.max(target, t.speed - accel * 2 * dt);
  const pxPerHex = HEX_R * Math.sqrt(3);
  const step = t.speed * pxPerHex * dt;
  const hexes = step / pxPerHex;
  const coalNeed = hexes * (TRAIN.coalPerHex + t.totalWeight * TRAIN.coalPerTonPerHex) * 0.7;
  if (t.resources.coal >= coalNeed) t.resources.coal -= coalNeed; else t.resources.coal = 0;
  // the rear car leads: it must stay on the path (arc >= 0)
  const tail = (t.cars.length - 1) * CAR_SPACING;
  let s2 = locoArc(state) - step;
  if (s2 <= tail + 1) { s2 = Math.max(0, Math.min(s2, tail + 1)); stopReversing(ctx, true); }
  let idx = 0;
  while (idx + 1 < poly.len && poly.cum[idx + 1] <= s2) idx++;
  t.routeIndex = idx;
  const segLen = (poly.cum[idx + 1] ?? poly.cum[idx]) - poly.cum[idx] || 1;
  t.progress = idx + 1 < poly.len ? Math.max(0, Math.min(1, (s2 - poly.cum[idx]) / segLen)) : 0;
  computeTrail(state);
}

export function startReversing(ctx: SimContext): boolean {
  const { state } = ctx;
  const t = state.train;
  if (t.reversing) return true;
  if (state.phase !== 'running' && state.phase !== 'shop') return false;
  const tail = (t.cars.length - 1) * CAR_SPACING;
  if (locoArc(state) <= tail + 2) { ctx.bus.defer('ui:notify', { text: 'Nothing behind to reverse onto', kind: 'warn' }); return false; }
  // discard the plan ahead (refunds unbuilt rails)
  let guard = 0;
  while (unplanLast(ctx).ok && guard++ < 500) { /* pop */ }
  t.reversing = true;
  t.stopped = false;
  t.stopReason = 'none';
  t.stopTimer = 0;
  t.speed = 0;
  log(state, 'Reversing down the line', 'info');
  ctx.bus.defer('train:start', {});
  return true;
}

/** Stop reversing: snap to the nearest tile centre, cut the path there, and wait for a new plan. */
export function stopReversing(ctx: SimContext, atEnd = false): void {
  const { state } = ctx;
  const t = state.train;
  if (!t.reversing) return;
  const poly = pathPoly(state);
  const p = state.route.path;
  let idx = t.routeIndex;
  if (t.progress >= 0.5 && idx + 1 < poly.len) idx++;
  t.routeIndex = idx;
  t.progress = 0;
  t.reversing = false;
  t.speed = 0;
  // drop everything ahead of the new anchor
  if (p.length > idx + 1) {
    const removed = p.splice(idx + 1);
    // built links that are no longer on the path get refunded at half value
    for (let i = 0; i < removed.length; i++) {
      const a = i === 0 ? p[idx] : removed[i - 1];
      const b = removed[i];
      const k = a[0] + ',' + a[1] < b[0] + ',' + b[1] ? a[0] + ',' + a[1] + '|' + b[0] + ',' + b[1] : b[0] + ',' + b[1] + '|' + a[0] + ',' + a[1];
      const bi = state.route.builtLinks.indexOf(k);
      if (bi >= 0) state.route.builtLinks.splice(bi, 1);
    }
  }
  t.stopped = true;
  t.stopReason = 'no_route';
  t.stopTimer = 0;
  computeTrail(state);
  ctx.bus.defer('train:stop', { reason: atEnd ? 'no_route' : 'no_route' });
  log(state, 'Stopped. Plan a new route from here.', 'info');
}

// ---------- composition ops ----------
export function detachFrom(ctx: SimContext, idx: number): boolean {
  const { state } = ctx;
  const t = state.train;
  if (idx < 1 || idx >= t.cars.length) return false;
  const count = t.cars.length - idx;
  const p = carPos(state, idx);
  let lostPassengers = 0;
  for (let i = idx; i < t.cars.length; i++) {
    lostPassengers += t.cars[i].passengers;
    for (const eid of t.cars[i].boarders) {
      const e = state.enemies.find(en => en.id === eid);
      if (e) { e.boardedCar = -1; e.state = 'fleeing'; e.stunned = TRAIN.detachLureTime; }
    }
  }
  t.cars.splice(idx, count);
  fixCrewIndices(state, idx);
  for (const c of t.crew) if (c.carIndex >= idx) c.carIndex = -1;
  if (lostPassengers > 0) { t.passengers -= lostPassengers; ctx.bus.defer('passengers:lost', { count: lostPassengers, cause: 'detached' }); }
  // lure: enemies near the dropped cars stop to loot them
  for (const e of state.enemies) {
    if (e.type.startsWith('boss_')) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < 380) e.stunned = Math.max(e.stunned, 6 + (380 - d) / 60);
  }
  recomputeCapacity(state);
  computeTrail(state);
  ctx.bus.defer('train:detach', { count, x: p.x, y: p.y });
  log(state, `Detached ${count} car${count > 1 ? 's' : ''} — the convoy is lighter`, 'warn');
  return true;
}

export function moveCar(ctx: SimContext, from: number, to: number): boolean {
  const t = ctx.state.train;
  if (from < 1 || to < 1 || from >= t.cars.length || to >= t.cars.length || from === to) return false;
  const [car] = t.cars.splice(from, 1);
  t.cars.splice(to, 0, car);
  // crew indices follow their cars
  for (const c of t.crew) {
    if (c.carIndex === from) c.carIndex = to;
    else if (from < to && c.carIndex > from && c.carIndex <= to) c.carIndex--;
    else if (from > to && c.carIndex >= to && c.carIndex < from) c.carIndex++;
  }
  // boarders follow their cars
  for (const e of ctx.state.enemies) {
    if (e.boardedCar === from) e.boardedCar = to;
    else if (from < to && e.boardedCar > from && e.boardedCar <= to) e.boardedCar--;
    else if (from > to && e.boardedCar >= to && e.boardedCar < from) e.boardedCar++;
  }
  ctx.bus.defer('car:moved', { from, to });
  computeTrail(ctx.state);
  return true;
}

export function addCar(ctx: SimContext, type: CarType, insertAt?: number): Car | null {
  const { state } = ctx;
  const t = state.train;
  if (t.cars.length >= MAX_CARS) return null;
  const car = makeCar(state, type);
  const at = insertAt === undefined ? t.cars.length : Math.max(1, Math.min(t.cars.length, insertAt));
  t.cars.splice(at, 0, car);
  for (const c of t.crew) if (c.carIndex >= at) c.carIndex++;
  for (const e of state.enemies) if (e.boardedCar >= at) e.boardedCar++;
  recomputeCapacity(state);
  computeTrail(state);
  return car;
}

export function removeCar(ctx: SimContext, idx: number): Car | null {
  const { state } = ctx;
  const t = state.train;
  if (idx < 1 || idx >= t.cars.length) return null;
  const car = t.cars[idx];
  if (car.passengers > 0) {
    // move passengers to other coaches or they disembark
    const n = car.passengers; car.passengers = 0; t.passengers -= n;
    const boarded = boardPassengers(ctx, n);
    if (boarded < n) ctx.bus.defer('passengers:lost', { count: n - boarded, cause: 'no room' });
  }
  for (const eid of car.boarders) { const e = state.enemies.find(en => en.id === eid); if (e) { e.hp = 0; e.state = 'dead'; } }
  t.cars.splice(idx, 1);
  fixCrewIndices(state, idx);
  for (const e of state.enemies) if (e.boardedCar > idx) e.boardedCar--; else if (e.boardedCar === idx) e.boardedCar = -1;
  recomputeCapacity(state);
  computeTrail(state);
  return car;
}

export function updateTrain(ctx: SimContext, onEnterTile: (col: number, row: number) => void): void {
  recomputeCapacity(ctx.state);
  propagate(ctx);
  if (ctx.state.phase === 'defeat') return;
  production(ctx);
  updateMovement(ctx, onEnterTile);
}

export function resourceKeyList(): ResourceKey[] { return ['rails', 'scrap', 'coal', 'ammo', 'food']; }
