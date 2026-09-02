/** Settlement arrival, rewards, passengers, crew and the repair-yard shop. */
import type { Settlement, ResourceKey, CarType } from '../core/types';
import type { SimContext } from './api';
import { CAR_DEFS } from '../core/cars';
import { TRAIN, SCORE, MAX_CARS } from '../core/config';
import { addResource, log, recomputeCapacity } from './helpers';
import { hexToWorld as hexToWorldOf } from '../core/hex';
import { addCrew, boardPassengers, addCar, removeCar } from './train';
import { DIRECTOR } from '../core/config';
import { damageEnemy, locoPos } from './helpers';

export function onArrive(ctx: SimContext, s: Settlement): void {
  const { state } = ctx;
  const t = state.train;
  if (s.visited) return;
  s.visited = true;
  const w = hexToWorldOf(s.col, s.row);
  const rewards: Partial<Record<ResourceKey, number>> = {};
  for (const k of Object.keys(s.offers) as ResourceKey[]) {
    const amt = s.offers[k] ?? 0;
    if (amt > 0) { const got = addResource(ctx, k, amt, w.x, w.y); rewards[k] = got; }
  }
  // deliver passengers at yards & terminus
  let delivered = 0;
  if ((s.type === 'yard' || s.type === 'terminus') && t.passengers > 0) {
    delivered = t.passengers;
    for (const car of t.cars) car.passengers = 0;
    t.passengers = 0;
    t.passengersDelivered += delivered;
    const reward: Partial<Record<ResourceKey, number>> = { rails: delivered * 2, scrap: delivered };
    addResource(ctx, 'rails', reward.rails!, w.x, w.y);
    addResource(ctx, 'scrap', reward.scrap!, w.x, w.y);
    state.stats.score += delivered * SCORE.passenger;
    t.morale = Math.min(100, t.morale + 10);
    ctx.bus.defer('passengers:delivered', { count: delivered, reward });
    log(state, `${delivered} passengers delivered safely at ${s.name} (+${reward.rails} rails, +${reward.scrap} scrap)`, 'good');
  }
  // board passengers
  let boarded = 0;
  if (s.passengers > 0) {
    boarded = boardPassengers(ctx, s.passengers);
    if (boarded < s.passengers) {
      log(state, `${s.passengers - boarded} people could not board — no coach space`, 'warn');
      ctx.bus.defer('ui:notify', { text: `${s.passengers - boarded} left behind: no coach space`, kind: 'warn' });
    }
    s.passengers -= boarded;
    if (boarded > 0) s.rescued = true;
  }
  if (s.type !== 'start' && s.type !== 'terminus') {
    state.stats.settlementsRescued++;
    state.stats.score += SCORE.settlement;
    if (s.passengers === 0) s.rescued = true;
  }
  // crew
  if (s.crew) {
    const c = addCrew(state, s.crew);
    ctx.bus.defer('crew:joined', { specialty: s.crew, name: c.name });
    log(state, `${c.name} the ${s.crew} joins the crew`, 'good');
  }
  ctx.bus.defer('settlement:reached', { id: s.id, name: s.name, type: s.type, rewards, passengers: boarded, crew: s.crew });
  const parts = Object.entries(rewards).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `+${Math.round(v!)} ${k}`);
  log(state, `Reached ${s.name}${parts.length ? ': ' + parts.join(', ') : ''}${boarded ? `, ${boarded} passengers boarded` : ''}`, 'good');
  // stop
  t.stopped = true;
  t.stopTimer = 0;
  if (s.type === 'yard') {
    t.stopReason = 'settlement';
    state.phase = 'shop';
    ctx.bus.defer('phase:change', { phase: 'shop' });
    ctx.bus.defer('ui:openPanel', { panel: 'shop' });
  } else if (s.type === 'terminus') {
    t.stopReason = 'boss';
  } else {
    t.stopReason = 'settlement';
  }
  ctx.bus.defer('train:stop', { reason: t.stopReason });
}

/** Called each tick while stopped at a settlement. */
export function updateStop(ctx: SimContext): void {
  const { state, dt } = ctx;
  const t = state.train;
  if (!t.stopped || t.stopReason !== 'settlement') return;
  // settlement militia defend the haven while the train is in
  const lp = locoPos(state);
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.state === 'dead' || e.type.startsWith('boss_')) continue;
    if (Math.hypot(e.x - lp.x, e.y - lp.y) > DIRECTOR.havenRadius) continue;
    damageEnemy(ctx, e, DIRECTOR.havenMilitiaDps * dt, 'bullet');
  }
  if (state.phase === 'shop') return;
  if (t.stopTimer >= TRAIN.settlementStopTime && TRAIN.autoDepart) depart(ctx);
}

export function currentSettlement(ctx: SimContext): Settlement | null {
  const { state } = ctx;
  const p = state.route.path[state.train.routeIndex];
  if (!p) return null;
  const tile = state.tiles[p[1] * state.mapW + p[0]];
  if (!tile || !tile.settlementId) return null;
  return state.settlements.find(s => s.id === tile.settlementId) ?? null;
}

export function depart(ctx: SimContext): void {
  const { state } = ctx;
  const t = state.train;
  if (!t.stopped) return;
  if (t.stopReason !== 'settlement' && t.stopReason !== 'boss') return;
  const s = currentSettlement(ctx);
  t.stopped = false;
  t.stopReason = 'none';
  t.stopTimer = 0;
  if (state.phase === 'shop') { state.phase = 'running'; ctx.bus.defer('phase:change', { phase: 'running' }); ctx.bus.defer('ui:openPanel', { panel: 'none' }); }
  ctx.bus.defer('settlement:depart', { id: s?.id ?? '' });
  ctx.bus.defer('train:start', {});
  // a route may still be missing: movement code will flag no_route
}

// ---------- shop ----------
export function canShop(ctx: SimContext): boolean {
  return ctx.state.phase === 'shop';
}

export function buyCar(ctx: SimContext, type: CarType, insertAt?: number): boolean {
  const { state } = ctx;
  if (!canShop(ctx)) return false;
  const def = CAR_DEFS[type];
  if (type === 'locomotive') return false;
  if (state.train.cars.length >= MAX_CARS) { ctx.bus.defer('ui:notify', { text: `Maximum ${MAX_CARS} cars`, kind: 'warn' }); return false; }
  if (state.train.resources.scrap < def.cost) { ctx.bus.defer('ui:notify', { text: `Need ${def.cost} scrap`, kind: 'warn' }); return false; }
  addResource(ctx, 'scrap', -def.cost);
  const car = addCar(ctx, type, insertAt);
  if (!car) return false;
  ctx.bus.defer('car:bought', { type });
  log(state, `Coupled a ${def.name}`, 'good');
  return true;
}

export function sellCar(ctx: SimContext, idx: number): boolean {
  const { state } = ctx;
  if (!canShop(ctx)) return false;
  const car = state.train.cars[idx];
  if (!car || idx === 0) return false;
  const def = CAR_DEFS[car.type];
  const refund = Math.round(def.cost * 0.5 * (car.hp / car.maxHp));
  removeCar(ctx, idx);
  addResource(ctx, 'scrap', refund);
  ctx.bus.defer('car:sold', { type: car.type });
  log(state, `Sold ${def.name} for ${refund} scrap`, 'info');
  return true;
}

export function repairCost(hpMissing: number): number { return Math.ceil(hpMissing / 4); }

export function repairCar(ctx: SimContext, idx: number): boolean {
  const { state } = ctx;
  if (!canShop(ctx)) return false;
  const car = state.train.cars[idx];
  if (!car) return false;
  const missing = car.maxHp - car.hp;
  if (missing <= 0) return false;
  const cost = repairCost(missing);
  const scrap = state.train.resources.scrap;
  if (scrap <= 0) return false;
  if (scrap >= cost) { addResource(ctx, 'scrap', -cost); car.hp = car.maxHp; }
  else { addResource(ctx, 'scrap', -scrap); car.hp = Math.min(car.maxHp, car.hp + scrap * 4); }
  car.heat = Math.min(car.heat, 40);
  car.onFire = false;
  ctx.bus.defer('car:repaired', { carIndex: idx });
  return true;
}

export function repairAll(ctx: SimContext): boolean {
  let any = false;
  for (let i = 0; i < ctx.state.train.cars.length; i++) if (repairCar(ctx, i)) any = true;
  if (any) log(ctx.state, 'Repairs complete', 'good');
  recomputeCapacity(ctx.state);
  return any;
}

export function closeShop(ctx: SimContext): void {
  if (ctx.state.phase !== 'shop') return;
  depart(ctx);
}
