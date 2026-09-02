/** Shared simulation helpers. Both the train/world modules and the combat modules use these. */
import type { SimState, Tile, Car, CarType, Enemy, DamageClass, ResourceKey, Settlement, CarDerived } from '../core/types';
import type { SimContext } from './api';
import { CAR_DEFS } from '../core/cars';
import { ENEMY_DEFS } from '../core/enemies';
import { TRAIN, SCORE, UPGRADES } from '../core/config';
import { hexToWorld } from '../core/hex';

export function tileAt(state: SimState, col: number, row: number): Tile | null {
  if (col < 0 || row < 0 || col >= state.mapW || row >= state.mapH) return null;
  return state.tiles[row * state.mapW + col];
}

export function settlementAt(state: SimState, col: number, row: number): Settlement | null {
  const t = tileAt(state, col, row);
  if (!t || !t.settlementId) return null;
  return state.settlements.find(s => s.id === t.settlementId) ?? null;
}

export function nextId(state: SimState, prefix: string): string {
  return prefix + (state.nextId++).toString(36);
}

export function log(state: SimState, text: string, kind: 'info' | 'warn' | 'good' | 'bad' = 'info'): void {
  state.log.push({ t: state.time, text, kind });
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

export function newDerived(): CarDerived {
  return { powerRatio: 1, hasAmmoSupply: false, activity: 0, targetEnemyId: null, heatFlowIn: 0, marinesEngaged: false };
}

export function makeCar(state: SimState, type: CarType): Car {
  const def = CAR_DEFS[type];
  return {
    id: nextId(state, 'car'), type, hp: def.hp, maxHp: def.hp, heat: 0, onFire: false, boarders: [],
    crewId: null, cooldown: 0, workTimer: 0, passengers: 0, disabled: false, disabledFor: 0, level: 1, derived: newDerived(),
  };
}

/** World px (unprojected) of a car centre. Uses the trail computed by the train module. */
export function carPos(state: SimState, idx: number): { x: number; y: number } {
  const t = state.train;
  if (idx < t.trailX.length) return { x: t.trailX[idx], y: t.trailY[idx] };
  const p = state.route.path[Math.min(t.routeIndex, state.route.path.length - 1)];
  const w = p ? hexToWorld(p[0], p[1]) : { x: 0, y: 0 };
  return w;
}

export function locoPos(state: SimState): { x: number; y: number } { return carPos(state, 0); }

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Nearest car index to a world point (and its distance). */
export function nearestCar(state: SimState, x: number, y: number): { idx: number; d: number } {
  let best = -1, bd = Infinity;
  for (let i = 0; i < state.train.cars.length; i++) {
    const p = carPos(state, i);
    const d = dist(x, y, p.x, p.y);
    if (d < bd) { bd = d; best = i; }
  }
  return { idx: best, d: bd };
}

export function addResource(ctx: SimContext, key: ResourceKey, delta: number, x?: number, y?: number): number {
  const t = ctx.state.train;
  const before = t.resources[key];
  const cap = t.capacity[key];
  const after = Math.max(0, Math.min(cap, before + delta));
  t.resources[key] = after;
  const real = after - before;
  if (Math.abs(real) >= 0.5) ctx.bus.defer('resource:change', { key, delta: real, x, y });
  if (delta > 0 && before + delta > cap + 0.5) ctx.bus.defer('resource:full', { key });
  if (delta < 0 && after <= 0 && before > 0) ctx.bus.defer('resource:empty', { key });
  return real;
}

export function hasCar(state: SimState, type: CarType): boolean {
  return state.train.cars.some(c => c.type === type && c.hp > 0);
}
export function countCars(state: SimState, type: CarType): number {
  return state.train.cars.filter(c => c.type === type && c.hp > 0).length;
}

/**
 * Apply damage to a car. Handles destruction, reactor explosions and train splitting.
 * Returns the damage actually applied.
 */
export function damageCar(ctx: SimContext, idx: number, amount: number, source: 'bullet' | 'shell' | 'energy' | 'fire' | 'melee' | 'void' | 'heat' | 'boarder' | 'ram' | 'sapper' | 'lightning'): number {
  const { state } = ctx;
  const t = state.train;
  const car = t.cars[idx];
  if (!car || car.hp <= 0) return 0;
  if (ctx.invulnerable) amount = Math.min(amount, Math.max(0, car.hp - 1));
  // Barracks / armour mitigate melee & boarder damage a bit
  if ((source === 'melee' || source === 'boarder') && (car.type === 'barracks' || car.type === 'armor_plate')) amount *= 0.6;
  const p = carPos(state, idx);
  car.hp = Math.max(0, car.hp - amount);
  state.stats.damageTaken += amount;
  ctx.bus.defer('train:damage', { carIndex: idx, amount, source, x: p.x, y: p.y });
  if (car.hp <= 0) destroyCar(ctx, idx, source);
  return amount;
}

export function destroyCar(ctx: SimContext, idx: number, source: string): void {
  const { state } = ctx;
  const t = state.train;
  const car = t.cars[idx];
  if (!car) return;
  const p = carPos(state, idx);
  const explode = car.type === 'reactor';
  ctx.bus.defer('car:destroyed', { carIndex: idx, type: car.type, x: p.x, y: p.y, explode });
  log(state, `${CAR_DEFS[car.type].name} destroyed (${source})`, 'bad');
  state.stats.carsLost++;
  if (idx === 0) {
    state.phase = 'defeat';
    state.defeatReason = source === 'void' ? 'The void swallowed the locomotive.' : `The locomotive was destroyed by ${describeSource(source)}.`;
    state.train.stopReason = 'derailed';
    return;
  }
  // boarders inside die with the car
  for (const eid of car.boarders) {
    const e = state.enemies.find(en => en.id === eid);
    if (e) { e.hp = 0; e.state = 'dead'; }
  }
  // passengers lost
  if (car.passengers > 0) {
    ctx.bus.defer('passengers:lost', { count: car.passengers, cause: 'car destroyed' });
    t.passengers = Math.max(0, t.passengers - car.passengers);
    car.passengers = 0;
  }
  // crew unassigned (survives, hurt)
  if (car.crewId) {
    const c = t.crew.find(cr => cr.id === car.crewId);
    if (c) { c.carIndex = -1; c.hp = Math.max(10, c.hp - 40); }
    car.crewId = null;
  }
  // reactor explosion damages neighbours
  if (explode) {
    for (const n of [idx - 1, idx + 1]) {
      if (t.cars[n] && t.cars[n].hp > 0) {
        t.cars[n].heat = Math.min(120, t.cars[n].heat + 40);
        damageCar(ctx, n, 60, 'fire');
      }
    }
    ctx.bus.defer('projectile:explode', { x: p.x, y: p.y, radius: 90, kind: 'reactor' });
    ctx.bus.defer('ui:shake', { power: 1 });
  }
  if (state.phase === 'defeat') return;
  // split: everything behind is lost
  const lostCount = t.cars.length - idx - 1;
  if (TRAIN.splitOnDestroy && lostCount > 0 && !(t.relics ?? []).includes('iron_couplings')) {
    let lostPassengers = 0;
    for (let i = idx + 1; i < t.cars.length; i++) {
      lostPassengers += t.cars[i].passengers;
      if (t.cars[i].crewId) {
        const c = t.crew.find(cr => cr.id === t.cars[i].crewId);
        if (c) { c.carIndex = -1; c.hp = Math.max(5, c.hp - 50); }
      }
      for (const eid of t.cars[i].boarders) {
        const e = state.enemies.find(en => en.id === eid);
        if (e) { e.hp = 0; e.state = 'dead'; }
      }
    }
    if (lostPassengers > 0) {
      ctx.bus.defer('passengers:lost', { count: lostPassengers, cause: 'train split' });
      t.passengers = Math.max(0, t.passengers - lostPassengers);
    }
    state.stats.carsLost += lostCount;
    ctx.bus.defer('train:split', { atIndex: idx, lost: lostCount });
    log(state, `Coupling sheared: ${lostCount} car${lostCount > 1 ? 's' : ''} lost behind the wreck`, 'bad');
    t.cars.splice(idx, t.cars.length - idx);
  } else {
    t.cars.splice(idx, 1);
  }
  fixCrewIndices(state, idx);
  recomputeCapacity(state);
}

function describeSource(s: string): string {
  switch (s) {
    case 'ram': return 'a ramming attack';
    case 'boarder': return 'boarders';
    case 'sapper': return 'a sapper charge';
    case 'fire': return 'fire';
    case 'heat': return 'overheating';
    case 'lightning': return 'lightning';
    default: return 'enemy fire';
  }
}

/** After removing a car at `removedIdx`, shift crew car indices. */
export function fixCrewIndices(state: SimState, removedIdx: number): void {
  for (const c of state.train.crew) {
    if (c.carIndex === removedIdx) c.carIndex = -1;
    else if (c.carIndex > removedIdx) c.carIndex--;
  }
  // rebuild crewId pointers from crew array (source of truth)
  for (const car of state.train.cars) car.crewId = null;
  for (const c of state.train.crew) {
    if (c.carIndex >= 0 && c.carIndex < state.train.cars.length) state.train.cars[c.carIndex].crewId = c.id;
    else c.carIndex = -1;
  }
}

/** Upgrade-level multipliers for a car. */
export function carLevel(car: Car): number { return Math.max(1, Math.min(3, car.level || 1)); }
export function carDamageMul(car: Car): number { return 1 + UPGRADES.carDamageMul * (carLevel(car) - 1); }
export function carStorageMul(car: Car): number { return 1 + UPGRADES.carStorageMul * (carLevel(car) - 1); }
export function carPowerGen(state: SimState, car: Car, idx: number): number {
  const d = CAR_DEFS[car.type];
  let g = d.powerGen;
  if (g > 0) g += UPGRADES.carPowerAdd * (carLevel(car) - 1);
  if (idx === 0) g += UPGRADES.locoPowerPerLevel * (state.train.locoUpgrades?.power ?? 0);
  return g;
}
export function carCooling(car: Car): number {
  const d = CAR_DEFS[car.type];
  return d.cooling > 0 ? d.cooling + UPGRADES.carCoolingAdd * (carLevel(car) - 1) : 0;
}
export function carPassengerCap(car: Car): number {
  const d = CAR_DEFS[car.type];
  return d.passengerCap > 0 ? d.passengerCap + UPGRADES.coachPaxAdd * (carLevel(car) - 1) : 0;
}

export function recomputeCapacity(state: SimState): void {
  const t = state.train;
  const cap: Record<ResourceKey, number> = { ...TRAIN.baseCapacity };
  let pcap = 0, weight = 0, gen = 0, use = 0;
  const qm = t.crew.some(c => c.specialty === 'quartermaster' && c.carIndex >= 0);
  for (let i = 0; i < t.cars.length; i++) {
    const car = t.cars[i];
    if (car.hp <= 0) continue;
    const d = CAR_DEFS[car.type];
    const sm = carStorageMul(car);
    for (const k of Object.keys(d.storage) as ResourceKey[]) cap[k] += Math.round((d.storage[k] ?? 0) * sm);
    pcap += carPassengerCap(car);
    weight += d.weight;
    gen += carPowerGen(state, car, i);
    use += d.powerUse;
  }
  if (qm) for (const k of Object.keys(cap) as ResourceKey[]) cap[k] = Math.round(cap[k] * 1.3);
  if ((t.relics ?? []).includes('ledger')) for (const k of Object.keys(cap) as ResourceKey[]) cap[k] = Math.round(cap[k] * 1.2);
  t.capacity = cap;
  for (const k of Object.keys(cap) as ResourceKey[]) t.resources[k] = Math.min(t.resources[k], cap[k]);
  t.passengerCap = pcap;
  t.totalWeight = weight + t.passengers * 0.5;
  t.totalPowerGen = gen;
  t.totalPowerUse = use;
}

// ---------- Enemies ----------

export function spawnEnemy(ctx: SimContext, type: Enemy['type'], x: number, y: number): Enemy {
  const def = ENEMY_DEFS[type];
  const e: Enemy = {
    id: nextId(ctx.state, 'e'), type, x, y, vx: 0, vy: 0, hp: def.hp, maxHp: def.hp, state: 'spawn',
    targetCar: -1, boardedCar: -1, timer: 0, attackTimer: 0, revealed: type !== 'sapper', phase: 0,
    burning: 0, stunned: 0, angle: 0, spawnT: ctx.state.time, lastHitBy: null, extra: {},
  };
  ctx.state.enemies.push(e);
  ctx.bus.defer('enemy:spawn', { id: e.id, type, x, y });
  return e;
}

/** Apply damage to an enemy with resist/armor rules. Returns actual damage. */
export function damageEnemy(ctx: SimContext, e: Enemy, amount: number, cls: DamageClass): number {
  if (e.hp <= 0) return 0;
  const def = ENEMY_DEFS[e.type];
  const mul = (def.resist as Record<string, number>)[cls] ?? 1;
  let dmg = amount * mul;
  if (cls === 'bullet') dmg *= 1 - def.armor;
  const immune = mul <= 0;
  dmg = Math.max(0, dmg);
  e.hp -= dmg;
  e.lastHitBy = cls;
  if (e.type === 'sapper') e.revealed = true;
  ctx.state.stats.damageDealt += dmg;
  ctx.bus.defer('enemy:hit', { id: e.id, type: e.type, x: e.x, y: e.y, amount: dmg, damageClass: cls, immune });
  if (e.hp <= 0) killEnemy(ctx, e, cls);
  return dmg;
}

/** Hooks registered by loot/bounty modules (avoids import cycles). */
export const killHooks: Array<(ctx: SimContext, e: Enemy) => void> = [];

export function killEnemy(ctx: SimContext, e: Enemy, cls: DamageClass | null): void {
  if (e.state === 'dead') return;
  e.hp = 0;
  e.state = 'dead';
  const { state } = ctx;
  if (e.boardedCar >= 0) {
    const car = state.train.cars[e.boardedCar];
    if (car) car.boarders = car.boarders.filter(id => id !== e.id);
    e.boardedCar = -1;
  }
  state.stats.kills[e.type] = (state.stats.kills[e.type] ?? 0) + 1;
  state.stats.score += SCORE.kill;
  if (cls) state.director.killsByClass[cls] = (state.director.killsByClass[cls] ?? 0) + 1;
  ctx.bus.defer('enemy:died', { id: e.id, type: e.type, x: e.x, y: e.y, killedBy: cls });
  for (const h of killHooks) { try { h(ctx, e); } catch (err) { console.error('[killHook]', err); } }
}

export function isNight(state: SimState): boolean { return state.isNight; }

export function weatherRangeMul(state: SimState): number {
  const k = state.weather.kind;
  const i = state.weather.intensity;
  const full = k === 'fog' ? 0.7 : k === 'ashfall' ? 0.8 : k === 'storm' ? 0.85 : k === 'rain' ? 0.9 : 1;
  return 1 - (1 - full) * i;
}
