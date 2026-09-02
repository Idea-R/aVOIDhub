/**
 * Combat simulation: enemy AI (6 regular types), car weapons, projectiles, sapper charges.
 *
 * Pure, deterministic, data-only. Randomness ONLY via ctx.rng.combat. No Phaser / DOM.
 * Runs once per fixed tick (ctx.dt seconds) after the train module has computed
 * state.train.trailX/trailY/trailAngle and car.derived.powerRatio / hasAmmoSupply.
 *
 * Bosses (type 'boss_*') are driven by bosses.ts; here they only receive the shared
 * status ticks (burning / stun), take part in weapon targeting and projectile hits,
 * and push regular ground enemies out of their way during separation.
 */
import type { SimState, Enemy, EnemyLayer, DamageClass, Projectile, WeaponDef } from '../core/types';
import type { SimContext } from './api';
import { CAR_DEFS } from '../core/cars';
import { ENEMY_DEFS } from '../core/enemies';
import { TRAIN, DAY, DIRECTOR, HEX_R } from '../core/config';
import { hexToWorld } from '../core/hex';
import {
  spawnEnemy, damageEnemy, killEnemy, damageCar, carPos, locoPos, addResource,
  hasCar, log, nextId, weatherRangeMul, dist, carDamageMul,
} from './helpers';

// ---------- tuning (local to combat) ----------
const SPAWN_TIME = 0.4;            // s of 'spawn' state before an enemy acts
const LANE_GAP = 26;               // px beside the car centre line (plus enemy radius) for ground lanes
const BOARD_TIME = 2.6;            // s a raider needs to climb aboard (guns get a window)
const BURN_DPS = 6;                // fire damage per second while e.burning > 0
const HOUND_BITES = 3;             // bites before a hound retreats
const HOUND_RETREAT = 2.5;         // s of retreat
const CRAWLER_CHARGE_DIST = 120;   // px from the car centre at which a crawler charges
const CRAWLER_CHARGE_TIME = 1;     // s a charge may last
const CRAWLER_CHARGE_MUL = 2.2;    // charge speed multiplier
const CRAWLER_BACKOFF = 2;         // s of backing off after a ram
const SAPPER_PLANT_TIME = 2.5;
const SAPPER_CHARGE_TIMER = 90;
const SAPPER_REVEAL_SCOUT = 260;
const SAPPER_REVEAL_NEAR = 90;
const SAPPER_FLEE_REMOVE = 700;    // px from the loco at which a fleeing sapper is removed
const FLEE_REMOVE = 900;           // px for everyone else
const GIVE_UP_DIST = 650;          // px from the nearest car ...
const GIVE_UP_TIME = 4;            // ... for this long -> give up (fleeing)
const RETARGET_REAR_DIST = 350;    // px: when this far from its target, an approaching unit retargets the rear car
const PAX_LOSS_INTERVAL = 6;       // s per passenger lost per boarder (x2 with a medical car)
const WISP_AVOID_TIME = 3;         // s a wisp backs off from fire
const WISP_WOBBLE = 22;            // px lateral wobble amplitude
const HARPY_HOVER = 40;            // px above the car (unprojected y)
const HARPY_GROUNDED_SPEED = 0.4;
const TESLA_CHAIN_RANGE = 90;
const TESLA_CHAIN_FALLOFF = 0.7;
const TESLA_STUN = 0.3;
const FLAME_CONE = Math.PI / 3;    // +-60 degrees
const FLAME_BURN = 3;              // s of burning applied by the flamethrower
const GATLING_MISS = 0.12;
const TRACER_SPEED = 900;
const ENEMY_SHELL_HIT_RADIUS = 40;
const DAMAGE_CHUNK = 0.5;          // s between applying accumulated continuous damage (event throttling)

/** Per-tick cached frame data shared by all combat sub-steps. */
interface Frame {
  ctx: SimContext;
  state: SimState;
  dt: number;
  dirX: number; dirY: number;    // unit heading of the train
  velX: number; velY: number;    // train velocity px/s
  night: boolean;
  dmgMul: number;                // enemy attack damage multiplier (night)
  spdMul: number;                // enemy speed multiplier (night)
  scout: boolean;
  medical: boolean;
  stormy: boolean;               // storm with intensity > 0.5 (harpies grounded)
  cars: Array<{ x: number; y: number }>; // cached car positions (index = car index)
  last: number;                  // rearmost living car index (-1 if none)
  byId: Record<string, Enemy>;   // enemy lookup (never iterated)
}

// =====================================================================================
// Public API
// =====================================================================================

/** Main per-tick entry point. */
export function updateCombat(ctx: SimContext): void {
  const f = makeFrame(ctx);
  cleanup(f);                 // drop last tick's dead / far-fled enemies first (events already flushed)
  rebuildIndex(f);
  tickSapperCharges(f);
  updateEnemies(f);
  separateGround(f);
  updateWeapons(f);
  updateProjectiles(f);
  enforceCap(f);
}

/** Called by the train module when the locomotive enters a tile: detonate a sapper charge here. */
export function onTrainEnterTile(ctx: SimContext, col: number, row: number): void {
  const { state } = ctx;
  const charges = state.route.sapperCharges;
  let idx = -1;
  for (let i = 0; i < charges.length; i++) if (charges[i].col === col && charges[i].row === row) { idx = i; break; }
  if (idx < 0) return;
  charges.splice(idx, 1);
  const dmg = 55 + 25 * (state.train.speed / 0.34);
  const p = hexToWorld(col, row);
  ctx.bus.defer('sapper:detonate', { col, row, x: p.x, y: p.y, damage: dmg });
  ctx.bus.defer('ui:shake', { power: 0.9 });
  log(state, 'A sapper charge detonates under the locomotive!', 'bad');
  const loco = state.train.cars[0];
  if (loco) loco.heat = Math.min(120, loco.heat + 30);
  damageCar(ctx, 0, dmg, 'sapper');
  if (state.phase !== 'defeat' && state.train.cars[1]) damageCar(ctx, 1, 20, 'sapper');
}

/** Removes every enemy & projectile and clears boarders (warps / restarts). Boss bookkeeping is reset too. */
export function clearEnemies(ctx: SimContext): void {
  const { state } = ctx;
  state.enemies = [];
  state.projectiles = [];
  for (const car of state.train.cars) {
    car.boarders = [];
    car.derived.targetEnemyId = null;
    car.derived.marinesEngaged = false;
  }
  // An active boss no longer exists; bosses.ts treats a missing enemy as "silently gone" (no reward).
  state.boss.active = false;
  state.boss.enemyId = null;
  state.boss.type = null;
  state.boss.phase = 0;
  state.boss.timer = 0;
}

/**
 * World position an enemy is trying to reach given its target car and layer:
 * ground units take a lane beside the car, air units hover above it, phase units drift straight in (with wobble).
 */
export function enemyTargetPos(ctx: SimContext, e: Enemy): { x: number; y: number } {
  const state = ctx.state;
  const idx = validCar(state, e.targetCar) ? e.targetCar : 0;
  const c = carPos(state, idx);
  const def = ENEMY_DEFS[e.type];
  const layer = effectiveLayer(e);
  const t = state.time;
  const ph = e.extra.ph ?? 0;
  if (layer === 'air') {
    return { x: c.x + Math.sin(t * 2.1 + ph) * 10, y: c.y - HARPY_HOVER + Math.cos(t * 2.7 + ph) * 7 };
  }
  if (layer === 'phase') {
    const dx = c.x - e.x, dy = c.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / d, py = dx / d;
    const w = Math.sin(t * 1.6 + ph) * WISP_WOBBLE;
    return { x: c.x + px * w, y: c.y + py * w };
  }
  const side = (e.extra.side ?? 1) >= 0 ? 1 : -1;
  const ang = carAngle(state, idx);
  const gap = LANE_GAP + def.radius;
  return { x: c.x - Math.sin(ang) * gap * side, y: c.y + Math.cos(ang) * gap * side };
}

/** Layer used for targeting/behaviour (harpies grounded by storms count as ground). */
export function effectiveLayer(e: Enemy): EnemyLayer {
  if (e.type === 'harpy' && e.extra.grounded === 1) return 'ground';
  return ENEMY_DEFS[e.type].layer;
}

/** Unit heading of the train (from the route path, falling back to the loco trail angle). */
export function trainHeading(state: SimState): { x: number; y: number } {
  const path = state.route.path;
  const i = state.train.routeIndex;
  const a = path[i], b = path[i + 1];
  if (a && b) {
    const wa = hexToWorld(a[0], a[1]), wb = hexToWorld(b[0], b[1]);
    const dx = wb.x - wa.x, dy = wb.y - wa.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.001) return { x: dx / d, y: dy / d };
  }
  if (state.train.trailAngle.length > 0) {
    const ang = state.train.trailAngle[0];
    return { x: Math.cos(ang), y: Math.sin(ang) };
  }
  return { x: 1, y: 0 };
}

/** Train velocity in world px/s (speed is hex/s; train.ts advances HEX_R*sqrt(3) px per hex). */
export function trainVelocity(state: SimState): { x: number; y: number } {
  const h = trainHeading(state);
  const px = state.train.stopped ? 0 : state.train.speed * HEX_R * Math.sqrt(3);
  return { x: h.x * px, y: h.y * px };
}

/** Moves an enemy toward a point at `speed` px/s; returns the remaining distance after the move. */
export function moveEnemyToward(e: Enemy, tx: number, ty: number, speed: number, dt: number): number {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = speed * dt;
  if (d <= step || d < 0.001) {
    e.vx = d > 0.001 ? dx / dt : 0;
    e.vy = d > 0.001 ? dy / dt : 0;
    e.x = tx; e.y = ty;
    if (d > 0.001) e.angle = Math.atan2(dy, dx);
    return 0;
  }
  const nx = dx / d, ny = dy / d;
  e.x += nx * step; e.y += ny * step;
  e.vx = nx * speed; e.vy = ny * speed;
  e.angle = Math.atan2(ny, nx);
  return d - step;
}

/**
 * All weapon damage funnels through here so bosses can override class multipliers via e.extra:
 *  - e.extra.bulletMul: replaces the def's bullet resist (Brood Mother plates fall: 0.25 -> 0.6).
 *  - e.extra.dmgMul:    multiplies every incoming hit (Brood Mother core exposed: x1.5).
 * Beyond that it is helpers.damageEnemy (resist / armor / immune events / kill credit).
 */
export function hitEnemy(ctx: SimContext, e: Enemy, amount: number, cls: DamageClass): number {
  if (e.hp <= 0 || e.state === 'dead') return 0;
  let a = amount;
  const bm = e.extra.bulletMul;
  if (cls === 'bullet' && bm !== undefined && bm > 0) {
    const base = ENEMY_DEFS[e.type].resist.bullet ?? 1;
    if (base > 0) a *= bm / base;
  }
  const dm = e.extra.dmgMul;
  if (dm !== undefined && dm > 0) a *= dm;
  return damageEnemy(ctx, e, a, cls);
}

/** Puts an enemy inside a car as a boarder (raider drop / boarding complete). */
export function boardCar(ctx: SimContext, e: Enemy, idx: number): void {
  const car = ctx.state.train.cars[idx];
  if (!car || car.hp <= 0) return;
  const p = carPos(ctx.state, idx);
  e.x = p.x; e.y = p.y; e.vx = 0; e.vy = 0;
  e.state = 'boarded';
  e.boardedCar = idx;
  e.targetCar = idx;
  e.timer = 0;
  e.extra.pax = 0;
  e.extra.dAcc = 0;
  if (car.boarders.indexOf(e.id) < 0) car.boarders.push(e.id);
  ctx.bus.defer('enemy:boarded', { id: e.id, type: e.type, carIndex: idx });
}

// =====================================================================================
// Frame setup / cleanup
// =====================================================================================

function makeFrame(ctx: SimContext): Frame {
  const state = ctx.state;
  const h = trainHeading(state);
  const v = trainVelocity(state);
  const night = state.isNight;
  const f: Frame = {
    ctx, state, dt: ctx.dt,
    dirX: h.x, dirY: h.y, velX: v.x, velY: v.y,
    night, dmgMul: night ? DAY.nightAggression : 1, spdMul: night ? 1.15 : 1,
    scout: hasCar(state, 'scout'), medical: hasCar(state, 'medical'),
    stormy: state.weather.kind === 'storm' && state.weather.intensity > 0.5,
    cars: [], last: -1, byId: {},
  };
  rebuildCars(f);
  return f;
}

function rebuildCars(f: Frame): void {
  const state = f.state;
  const cars: Array<{ x: number; y: number }> = [];
  let last = -1;
  for (let i = 0; i < state.train.cars.length; i++) {
    cars.push(carPos(state, i));
    if (state.train.cars[i].hp > 0) last = i;
  }
  f.cars = cars;
  f.last = last;
}

/** damageCar may destroy & splice cars mid-tick; refresh the cache whenever the car count changed. */
function syncCars(f: Frame): void {
  if (f.cars.length !== f.state.train.cars.length) rebuildCars(f);
}

function rebuildIndex(f: Frame): void {
  const m: Record<string, Enemy> = {};
  for (const e of f.state.enemies) m[e.id] = e;
  f.byId = m;
}

function isBoss(e: Enemy): boolean { return e.type.startsWith('boss_'); }

/** Remove enemies that died last tick (events already emitted) and far-away fleeing enemies. */
function cleanup(f: Frame): void {
  const { state } = f;
  const lp = locoPos(state);
  const out: Enemy[] = [];
  for (const e of state.enemies) {
    if (e.state === 'dead') {
      // keep a dead boss until bosses.ts has processed its death
      if (isBoss(e) && state.boss.active && state.boss.enemyId === e.id) out.push(e);
      continue;
    }
    if (e.state === 'fleeing' && e.extra.tmp !== 1) {
      const lim = e.type === 'sapper' ? SAPPER_FLEE_REMOVE : FLEE_REMOVE;
      if (dist(e.x, e.y, lp.x, lp.y) > lim) continue;
    }
    out.push(e);
  }
  state.enemies = out;
}

/** Keep state.enemies.length <= maxEnemies + bosses; silently drop the oldest regular enemies. */
function enforceCap(f: Frame): void {
  const { state } = f;
  let bosses = 0;
  for (const e of state.enemies) if (isBoss(e)) bosses++;
  const limit = DIRECTOR.maxEnemies + bosses;
  while (state.enemies.length > limit) {
    let victim = -1;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!isBoss(e) && e.boardedCar < 0) { victim = i; break; }
    }
    if (victim < 0) for (let i = 0; i < state.enemies.length; i++) if (!isBoss(state.enemies[i])) { victim = i; break; }
    if (victim < 0) break;
    const e = state.enemies[victim];
    if (e.boardedCar >= 0) {
      const car = state.train.cars[e.boardedCar];
      if (car) car.boarders = car.boarders.filter(id => id !== e.id);
    }
    state.enemies.splice(victim, 1);
  }
}

// =====================================================================================
// Sapper charges
// =====================================================================================

function tickSapperCharges(f: Frame): void {
  const { state, dt, ctx } = f;
  const charges = state.route.sapperCharges;
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    if (f.scout) c.revealed = true;
    c.timer -= dt;
    if (c.timer <= 0) {
      charges.splice(i, 1);
      ctx.bus.defer('sapper:defused', { col: c.col, row: c.row });
    }
  }
}

// =====================================================================================
// Enemy AI
// =====================================================================================

function validCar(state: SimState, idx: number): boolean {
  const c = state.train.cars[idx];
  return !!c && c.hp > 0;
}

function carAngle(state: SimState, idx: number): number {
  const ta = state.train.trailAngle;
  if (idx < ta.length) return ta[idx];
  const h = trainHeading(state);
  return Math.atan2(h.y, h.x);
}

function enemySpeed(f: Frame, e: Enemy): number {
  let s = ENEMY_DEFS[e.type].speed * f.spdMul;
  if (e.type === 'harpy' && e.extra.grounded === 1) s *= HARPY_GROUNDED_SPEED;
  return s;
}

/** Distance from an enemy to the nearest living car (cached positions) and that car's index. */
function nearestCarTo(f: Frame, x: number, y: number): { idx: number; d: number } {
  let best = -1, bd = 1e9;
  syncCars(f);
  for (let i = 0; i < f.cars.length; i++) {
    const car = f.state.train.cars[i];
    if (!car || car.hp <= 0) continue;
    const d = dist(x, y, f.cars[i].x, f.cars[i].y);
    if (d < bd) { bd = d; best = i; }
  }
  return { idx: best, d: bd };
}

/** Choose a target car: nearest for most units; raiders pick among the three nearest (spread boarding). */
function pickTarget(f: Frame, e: Enemy): void {
  if (e.type === 'sapper') { e.targetCar = -1; return; }
  syncCars(f);
  const order: number[] = [];
  for (let i = 0; i < f.cars.length; i++) { const c = f.state.train.cars[i]; if (c && c.hp > 0) order.push(i); }
  if (order.length === 0) { e.targetCar = -1; return; }
  const dOf = (i: number) => dist(e.x, e.y, f.cars[i].x, f.cars[i].y);
  // stable insertion sort by distance (tiny arrays, deterministic)
  for (let i = 1; i < order.length; i++) {
    const v = order[i]; const dv = dOf(v);
    let j = i - 1;
    while (j >= 0 && dOf(order[j]) > dv) { order[j + 1] = order[j]; j--; }
    order[j + 1] = v;
  }
  if (e.type === 'raider') {
    const n = Math.min(3, order.length);
    e.targetCar = order[f.ctx.rng.combat.int(0, n - 1)];
  } else {
    e.targetCar = order[0];
  }
}

/** Make sure the target car is alive; retarget the rear car when falling far behind the target. */
function ensureTarget(f: Frame, e: Enemy): boolean {
  syncCars(f);
  if (!validCar(f.state, e.targetCar)) pickTarget(f, e);
  if (e.targetCar < 0) return false;
  if (e.state === 'approach' && f.last >= 0 && e.targetCar !== f.last) {
    const c = f.cars[e.targetCar];
    if (dist(e.x, e.y, c.x, c.y) > RETARGET_REAR_DIST) e.targetCar = f.last;
  }
  return true;
}

/** Enemies that stay far from every car for a while give up (fleeing, removed when far enough). */
function giveUpCheck(f: Frame, e: Enemy): void {
  const n = nearestCarTo(f, e.x, e.y);
  if (n.idx < 0 || n.d > GIVE_UP_DIST) {
    e.extra.far = (e.extra.far ?? 0) + f.dt;
    if (e.extra.far > GIVE_UP_TIME) { e.state = 'fleeing'; e.extra.tmp = 0; e.timer = 0; }
  } else {
    e.extra.far = 0;
  }
}

/** Move toward the enemy's layer-specific target point. Returns remaining distance. */
function follow(f: Frame, e: Enemy, speedMul = 1): number {
  const tp = enemyTargetPos(f.ctx, e);
  return moveEnemyToward(e, tp.x, tp.y, enemySpeed(f, e) * speedMul, f.dt);
}

/** Move directly away from a point. */
function moveAway(f: Frame, e: Enemy, fx: number, fy: number, speed: number): void {
  let dx = e.x - fx, dy = e.y - fy;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) { dx = -f.dirX; dy = -f.dirY; d = 1; }
  moveEnemyToward(e, e.x + dx / d * 200, e.y + dy / d * 200, speed, f.dt);
}

/** Direct hp reduction with resist rules but throttled 'enemy:hit' events (continuous damage sources). */
function dealDirect(f: Frame, e: Enemy, amount: number, cls: DamageClass): void {
  if (e.hp <= 0 || e.state === 'dead') return;
  const def = ENEMY_DEFS[e.type];
  const mul = (def.resist as Record<string, number>)[cls] ?? 1;
  if (mul <= 0) return;
  let dmg = amount * mul;
  if (cls === 'bullet') dmg *= 1 - def.armor;
  const dm = e.extra.dmgMul;
  if (dm !== undefined && dm > 0) dmg *= dm;
  e.hp -= dmg;
  e.lastHitBy = cls;
  f.state.stats.damageDealt += dmg;
  e.extra.fxAcc = (e.extra.fxAcc ?? 0) + dmg;
  e.extra.fxT = (e.extra.fxT ?? 0) + f.dt;
  if (e.extra.fxT >= DAMAGE_CHUNK || e.hp <= 0) {
    f.ctx.bus.defer('enemy:hit', { id: e.id, type: e.type, x: e.x, y: e.y, amount: e.extra.fxAcc, damageClass: cls, immune: false });
    e.extra.fxAcc = 0; e.extra.fxT = 0;
  }
  if (e.hp <= 0) killEnemy(f.ctx, e, cls);
}

function tickBurn(f: Frame, e: Enemy): void {
  if (e.burning <= 0) return;
  e.burning = Math.max(0, e.burning - f.dt);
  dealDirect(f, e, BURN_DPS * f.dt, 'fire');
}

function updateEnemies(f: Frame): void {
  const { state } = f;
  const n = state.enemies.length; // enemies spawned during this loop act next tick
  for (let i = 0; i < n; i++) {
    const e = state.enemies[i];
    if (e.state === 'dead') continue;
    if (state.phase !== 'running') return; // locomotive destroyed this tick
    syncCars(f);
    // shared status ticks (bosses included)
    tickBurn(f, e);
    if (e.hp <= 0) continue; // burned to death this tick (state is now 'dead')
    if (e.stunned > 0) {
      e.stunned = Math.max(0, e.stunned - f.dt);
      e.vx = 0; e.vy = 0;
      continue;
    }
    if (isBoss(e)) continue;          // behaviour owned by bosses.ts
    if (e.attackTimer > 0) e.attackTimer -= f.dt;
    if (e.type === 'harpy') e.extra.grounded = f.stormy ? 1 : 0;
    if (e.type === 'sapper') updateReveal(f, e);
    if (e.extra.ph === undefined) {
      e.extra.ph = f.ctx.rng.combat.range(0, Math.PI * 2);
      e.extra.side = f.ctx.rng.combat.chance(0.5) ? 1 : -1;
    }
    switch (e.state) {
      case 'spawn':
        e.timer += f.dt;
        if (e.timer >= SPAWN_TIME) { e.timer = 0; e.state = 'approach'; pickTarget(f, e); }
        break;
      case 'fleeing': updateFleeing(f, e); break;
      case 'boarding': updateBoarding(f, e); break;
      case 'boarded': updateBoarded(f, e); break;
      case 'planting': updatePlanting(f, e); break;
      case 'approach':
      case 'attack':
        switch (e.type) {
          case 'raider': updateRaider(f, e); break;
          case 'hound': updateHound(f, e); break;
          case 'crawler': updateCrawler(f, e); break;
          case 'harpy': updateHarpy(f, e); break;
          case 'sapper': updateSapper(f, e); break;
          case 'wisp': updateWisp(f, e); break;
          default: break;
        }
        break;
      default: break;
    }
  }
}

function updateFleeing(f: Frame, e: Enemy): void {
  const n = nearestCarTo(f, e.x, e.y);
  const from = n.idx >= 0 ? f.cars[n.idx] : locoPos(f.state);
  moveAway(f, e, from.x, from.y, enemySpeed(f, e));
  if (e.extra.tmp === 1) {
    e.timer -= f.dt;
    if (e.timer <= 0) { e.extra.tmp = 0; e.timer = 0; e.state = 'approach'; }
  }
}

// ---------- Raider ----------

function updateRaider(f: Frame, e: Enemy): void {
  if (!ensureTarget(f, e)) return;
  const def = ENEMY_DEFS.raider;
  const d = follow(f, e);
  if (d <= def.range) {
    e.state = 'boarding';
    e.timer = 0;
  } else {
    e.state = 'approach';
    giveUpCheck(f, e);
  }
}

function updateBoarding(f: Frame, e: Enemy): void {
  if (!validCar(f.state, e.targetCar)) { e.state = 'approach'; return; }
  const c = f.cars[e.targetCar];
  e.timer += f.dt;
  moveEnemyToward(e, c.x, c.y, enemySpeed(f, e), f.dt);
  if (e.timer >= BOARD_TIME) boardCar(f.ctx, e, e.targetCar);
}

function findCarWithBoarder(state: SimState, id: string): number {
  const cars = state.train.cars;
  for (let i = 0; i < cars.length; i++) if (cars[i].boarders.indexOf(id) >= 0) return i;
  return -1;
}

function updateBoarded(f: Frame, e: Enemy): void {
  const { state, ctx, dt } = f;
  let idx = e.boardedCar;
  let car = state.train.cars[idx];
  if (!car || car.hp <= 0 || car.boarders.indexOf(e.id) < 0) {
    idx = findCarWithBoarder(state, e.id);
    if (idx < 0) { e.hp = 0; e.state = 'dead'; e.boardedCar = -1; return; } // car gone (detached etc.)
    e.boardedCar = idx;
    car = state.train.cars[idx];
  }
  const p = carPos(state, idx);
  e.x = p.x; e.y = p.y; e.vx = f.velX; e.vy = f.velY;

  // continuous hull damage, applied in chunks to keep event volume sane
  e.extra.dAcc = (e.extra.dAcc ?? 0) + TRAIN.boarderDamage * f.dmgMul * dt;
  e.extra.dT = (e.extra.dT ?? 0) + dt;
  if (e.extra.dT >= DAMAGE_CHUNK) {
    damageCar(ctx, idx, e.extra.dAcc, 'boarder');
    e.extra.dAcc = 0; e.extra.dT = 0;
    if (e.state !== 'boarded' || state.phase === 'defeat') return; // car destroyed -> helper killed us
    car = state.train.cars[idx];
    if (!car || car.hp <= 0) return;
  }

  // passengers in a boarded car take casualties
  if (car.passengers > 0) {
    e.extra.pax = (e.extra.pax ?? 0) + dt;
    const interval = f.medical ? PAX_LOSS_INTERVAL * 2 : PAX_LOSS_INTERVAL;
    if (e.extra.pax >= interval) {
      e.extra.pax = 0;
      car.passengers = Math.max(0, car.passengers - 1);
      state.train.passengers = Math.max(0, state.train.passengers - 1);
      ctx.bus.defer('passengers:lost', { count: 1, cause: 'boarders' });
    }
  }

  // walk toward the locomotive
  e.timer += dt;
  if (e.timer >= TRAIN.boarderWalkTime) {
    e.timer = 0;
    if (idx > 0) {
      const next = state.train.cars[idx - 1];
      if (next && next.hp > 0 && !CAR_DEFS[next.type].blocksBoarders) {
        car.boarders = car.boarders.filter(id => id !== e.id);
        next.boarders.push(e.id);
        e.boardedCar = idx - 1;
        e.targetCar = idx - 1;
        ctx.bus.defer('enemy:walk', { id: e.id, from: idx, to: idx - 1 });
      }
    }
  }
}

// ---------- Hound ----------

function updateHound(f: Frame, e: Enemy): void {
  if (!ensureTarget(f, e)) return;
  const def = ENEMY_DEFS.hound;
  const c = f.cars[e.targetCar];
  if (e.extra.mode === 1) {           // retreating after a bite volley
    e.timer -= f.dt;
    moveAway(f, e, c.x, c.y, enemySpeed(f, e));
    e.state = 'approach';
    if (e.timer <= 0) { e.extra.mode = 0; e.extra.bites = 0; }
    return;
  }
  const d = follow(f, e);
  if (d <= def.range) {
    e.state = 'attack';
    e.angle = Math.atan2(c.y - e.y, c.x - e.x);
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackCooldown;
      damageCar(f.ctx, e.targetCar, def.damage * f.dmgMul, 'melee');
      f.state.train.hounds = Math.min(8, f.state.train.hounds + 1);
      e.extra.bites = (e.extra.bites ?? 0) + 1;
      if (e.extra.bites >= HOUND_BITES) { e.extra.mode = 1; e.timer = HOUND_RETREAT; }
    }
  } else {
    e.state = 'approach';
    giveUpCheck(f, e);
  }
}

// ---------- Crawler ----------

function updateCrawler(f: Frame, e: Enemy): void {
  if (!ensureTarget(f, e)) return;
  const def = ENEMY_DEFS.crawler;
  const c = f.cars[e.targetCar];
  const mode = e.extra.mode ?? 0;
  if (mode === 2) {                   // backing off after a ram
    e.timer -= f.dt;
    moveAway(f, e, c.x, c.y, enemySpeed(f, e));
    e.state = 'approach';
    if (e.timer <= 0) e.extra.mode = 0;
    return;
  }
  if (mode === 1) {                   // charging straight at the car
    e.timer -= f.dt;
    e.state = 'attack';
    const d = moveEnemyToward(e, c.x, c.y, enemySpeed(f, e) * CRAWLER_CHARGE_MUL, f.dt);
    if (d <= def.range) {
      damageCar(f.ctx, e.targetCar, def.damage * f.dmgMul, 'ram');
      f.ctx.bus.defer('enemy:ram', { id: e.id, carIndex: e.targetCar, x: e.x, y: e.y });
      f.ctx.bus.defer('ui:shake', { power: 0.5 });
      e.attackTimer = def.attackCooldown;
      e.extra.mode = 2; e.timer = CRAWLER_BACKOFF;
    } else if (e.timer <= 0) {
      e.extra.mode = 0;
    }
    return;
  }
  follow(f, e);
  e.state = 'approach';
  if (dist(e.x, e.y, c.x, c.y) <= CRAWLER_CHARGE_DIST && e.attackTimer <= 0) {
    e.extra.mode = 1; e.timer = CRAWLER_CHARGE_TIME;
  } else {
    giveUpCheck(f, e);
  }
}

// ---------- Harpy ----------

function updateHarpy(f: Frame, e: Enemy): void {
  if (!ensureTarget(f, e)) return;
  const def = ENEMY_DEFS.harpy;
  const d = follow(f, e);
  if (d <= def.range) {
    e.state = 'attack';
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackCooldown;
      const idx = e.targetCar;
      const car = f.state.train.cars[idx];
      if (f.ctx.rng.combat.chance(0.65)) {
        // sap: disable the car's systems for a few seconds
        car.disabled = true;
        car.disabledFor = Math.max(car.disabledFor, 3);
        damageCar(f.ctx, idx, 5 * f.dmgMul, 'energy');
      } else {
        // drop a raider straight onto the car
        const c = f.cars[idx];
        const r = spawnEnemy(f.ctx, 'raider', c.x, c.y);
        r.extra.ph = f.ctx.rng.combat.range(0, Math.PI * 2);
        r.extra.side = f.ctx.rng.combat.chance(0.5) ? 1 : -1;
        boardCar(f.ctx, r, idx);
      }
    }
  } else {
    e.state = 'approach';
    giveUpCheck(f, e);
  }
}

// ---------- Sapper ----------

function updateReveal(f: Frame, e: Enemy): void {
  const n = nearestCarTo(f, e.x, e.y);
  const damaged = e.hp < e.maxHp;
  e.revealed = damaged || n.d <= SAPPER_REVEAL_NEAR || (f.scout && n.d <= SAPPER_REVEAL_SCOUT);
}

/** Pick a route tile 2..6 ahead of the loco, preferring tiles without a charge. Returns false if none. */
function chooseSapperTile(f: Frame, e: Enemy): boolean {
  const { state } = f;
  const path = state.route.path;
  const base = state.train.routeIndex;
  const cands: number[] = [];
  const spare: number[] = [];
  for (let k = 2; k <= 6; k++) {
    const p = path[base + k];
    if (!p) break;
    let charged = false;
    for (const c of state.route.sapperCharges) if (c.col === p[0] && c.row === p[1]) { charged = true; break; }
    (charged ? spare : cands).push(base + k);
  }
  const pool = cands.length > 0 ? cands : spare;
  if (pool.length === 0) return false;
  const ti = pool[f.ctx.rng.combat.int(0, pool.length - 1)];
  const p = path[ti];
  e.extra.ti = ti; e.extra.tc = p[0]; e.extra.tr = p[1]; e.extra.hasT = 1;
  return true;
}

function updateSapper(f: Frame, e: Enemy): void {
  const { state } = f;
  if (e.extra.hasT !== 1 || state.train.routeIndex > (e.extra.ti ?? -1)) {
    // (re)target: the train already passed the tile, or we have none yet
    e.extra.retry = (e.extra.retry ?? 0) + (e.extra.hasT === 1 ? 1 : 0);
    if (e.extra.retry > 2 || !chooseSapperTile(f, e)) { e.state = 'fleeing'; e.extra.tmp = 0; return; }
  }
  const tp = hexToWorld(e.extra.tc, e.extra.tr);
  const d = moveEnemyToward(e, tp.x, tp.y, enemySpeed(f, e), f.dt);
  e.state = 'approach';
  if (d <= 6) { e.state = 'planting'; e.timer = 0; e.vx = 0; e.vy = 0; }
}

function updatePlanting(f: Frame, e: Enemy): void {
  const { state, ctx } = f;
  e.vx = 0; e.vy = 0;
  e.timer += f.dt;
  if (e.timer < SAPPER_PLANT_TIME) return;
  const col = e.extra.tc, row = e.extra.tr;
  let exists = false;
  for (const c of state.route.sapperCharges) if (c.col === col && c.row === row) { exists = true; break; }
  if (!exists) {
    const id = nextId(state, 'chg');
    state.route.sapperCharges.push({ col, row, revealed: f.scout || (state.train.relics ?? []).includes('sappers_manual'), timer: SAPPER_CHARGE_TIMER, id });
    ctx.bus.defer('sapper:planted', { id, col, row });
    if (f.scout) log(state, 'Scout car spots a sapper charge on the track ahead!', 'warn');
  }
  e.state = 'fleeing'; e.extra.tmp = 0; e.timer = 0;
}

// ---------- Wisp ----------

/** True when the wisp's target car is burning or an active flamethrower can reach it. */
function wispShouldAvoid(f: Frame, e: Enemy): boolean {
  const cars = f.state.train.cars;
  const t = cars[e.targetCar];
  if (t && t.onFire) return true;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (car.type !== 'flamethrower' || car.hp <= 0 || car.disabled || car.derived.powerRatio <= 0.01) continue;
    const w = CAR_DEFS.flamethrower.weapon;
    if (w && dist(e.x, e.y, f.cars[i].x, f.cars[i].y) <= w.range + 30) return true;
  }
  return false;
}

function updateWisp(f: Frame, e: Enemy): void {
  if (!ensureTarget(f, e)) return;
  const def = ENEMY_DEFS.wisp;
  if (wispShouldAvoid(f, e)) {
    e.state = 'fleeing'; e.extra.tmp = 1; e.timer = WISP_AVOID_TIME;
    return;
  }
  const d = follow(f, e);
  if (d <= def.range) {
    e.state = 'attack';
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackCooldown;
      const idx = e.targetCar;
      const car = f.state.train.cars[idx];
      const c = f.cars[idx];
      addResource(f.ctx, 'coal', -1.5, c.x, c.y);
      car.heat = Math.min(120, car.heat + 8);
      damageCar(f.ctx, idx, def.damage * f.dmgMul, 'energy');
    }
  } else {
    e.state = 'approach';
    giveUpCheck(f, e);
  }
}

// ---------- Separation ----------

/** Push apart overlapping ground-layer enemies (bosses push but are not pushed). */
function separateGround(f: Frame): void {
  const list = f.state.enemies;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const a = list[i];
    if (a.state === 'dead' || a.boardedCar >= 0 || a.state === 'boarded' || effectiveLayer(a) !== 'ground') continue;
    const ra = ENEMY_DEFS[a.type].radius;
    for (let j = i + 1; j < n; j++) {
      const b = list[j];
      if (b.state === 'dead' || b.boardedCar >= 0 || b.state === 'boarded' || effectiveLayer(b) !== 'ground') continue;
      const rb = ENEMY_DEFS[b.type].radius;
      const min = ra + rb;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2);
      if (d < 0.001) { dx = 1; dy = 0; d = 1; } // exact stack: deterministic split along +x
      const push = (min - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      const aBoss = isBoss(a), bBoss = isBoss(b);
      if (!aBoss) { a.x -= nx * push * (bBoss ? 2 : 1); a.y -= ny * push * (bBoss ? 2 : 1); }
      if (!bBoss) { b.x += nx * push * (aBoss ? 2 : 1); b.y += ny * push * (aBoss ? 2 : 1); }
    }
  }
}

// =====================================================================================
// Car weapons
// =====================================================================================

function crewSpecialtyIn(state: SimState, carIdx: number, specialty: string): boolean {
  const car = state.train.cars[carIdx];
  if (!car || !car.crewId) return false;
  for (const c of state.train.crew) if (c.id === car.crewId) return c.specialty === specialty && c.hp > 0;
  return false;
}

/** Can this weapon engage that enemy layer? */
function layerOk(w: WeaponDef, layer: EnemyLayer): boolean {
  return layer === 'ground' ? w.hitsGround : layer === 'air' ? w.hitsAir : w.hitsPhase;
}

/** Enemies the guns may engage: alive, past spawn-in, revealed (sappers). */
function targetable(e: Enemy): boolean {
  return e.hp > 0 && e.state !== 'dead' && e.state !== 'spawn' && e.revealed;
}

function pickWeaponTarget(f: Frame, carIdx: number, w: WeaponDef, range: number): Enemy | null {
  const cp = f.cars[carIdx];
  let best: Enemy | null = null;
  let bestScore = 1e12;
  for (const e of f.state.enemies) {
    if (!targetable(e)) continue;
    let score: number;
    if (e.boardedCar >= 0) {
      // only marines engage boarders (in their own or adjacent cars) - and they prefer them
      if (w.kind !== 'marines') continue;
      const gap = Math.abs(e.boardedCar - carIdx);
      if (gap > 1) continue;
      score = -2000 + gap;
    } else {
      if (!layerOk(w, effectiveLayer(e))) continue;
      // don't waste ammo on targets immune to this damage class (e.g. bullets vs grounded harpies)
      if (((ENEMY_DEFS[e.type].resist as Record<string, number>)[w.damageClass] ?? 1) <= 0) continue;
      const d = dist(cp.x, cp.y, e.x, e.y);
      if (d > range) continue;
      score = d;
      if (e.type === 'sapper' && e.state === 'planting') score -= 1000;
      // boarders-to-be are the real threat: prefer raiders climbing aboard, then any raider, over hounds
      if (e.state === 'boarding') score -= 400;
      else if (ENEMY_DEFS[e.type].boards) score -= 140;
    }
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function updateWeapons(f: Frame): void {
  const { state, ctx, dt } = f;
  const cars = state.train.cars;
  for (let i = 0; i < cars.length; i++) {
    if (state.phase !== 'running') return;
    syncCars(f);
    const car = cars[i];
    const def = CAR_DEFS[car.type];
    const w = def.weapon;
    if (!w) continue;
    // (derived.activity decays toward 0 at 2/s in train.ts; combat only raises it to 1 when firing)
    car.derived.marinesEngaged = false;
    if (car.hp <= 0) { car.derived.targetEnemyId = null; continue; }
    car.cooldown = Math.max(0, car.cooldown - dt);
    if (car.disabled) { car.derived.targetEnemyId = null; continue; }

    const powered = def.powerUse === 0 ? 1 : Math.max(0, Math.min(1, car.derived.powerRatio));
    const gunner = crewSpecialtyIn(state, i, 'gunner');

    // continuous close-quarters effects (no target needed)
    if (w.kind === 'marines') marinesPurge(f, i);
    if (w.kind === 'flame' && powered > 0.01) flamePurge(f, i);

    if (w.kind === 'tesla' && powered < 0.99) { car.derived.targetEnemyId = null; continue; }

    const rateMul = (powered >= 0.99 ? 1 : TRAIN.unpoweredFireRate + (1 - TRAIN.unpoweredFireRate) * powered) * (gunner ? 1.35 : 1);
    const range = w.range * weatherRangeMul(state) * (gunner ? 1.15 : 1);
    const target = pickWeaponTarget(f, i, w, range);
    car.derived.targetEnemyId = target ? target.id : null;
    if (!target || car.cooldown > 0) continue;
    if (w.ammoPerShot > 0 && (!car.derived.hasAmmoSupply || state.train.resources.ammo < w.ammoPerShot)) continue;

    // fire
    car.cooldown = w.cooldown / rateMul;
    if (w.ammoPerShot > 0) addResource(ctx, 'ammo', -w.ammoPerShot);
    car.heat = Math.min(120, car.heat + w.heatPerShot);
    car.derived.activity = 1;
    fireWeapon(f, i, w, target, range);
  }
}

function predictPos(e: Enemy, fromX: number, fromY: number, speed: number): { x: number; y: number } {
  const d = dist(fromX, fromY, e.x, e.y);
  const t = speed > 0 ? d / speed : 0;
  return { x: e.x + e.vx * t, y: e.y + e.vy * t };
}

function pushProjectile(f: Frame, p: Omit<Projectile, 'id'>): void {
  f.state.projectiles.push({ id: nextId(f.state, 'p'), ...p });
}

function fireWeapon(f: Frame, carIdx: number, w: WeaponDef, target: Enemy, range: number): void {
  const { ctx, state } = f;
  const cp = f.cars[carIdx];
  const emitFire = (tx: number, ty: number) =>
    ctx.bus.defer('weapon:fire', { carIndex: carIdx, kind: w.kind, x: cp.x, y: cp.y, tx, ty, targetId: target.id });

  switch (w.kind) {
    case 'gatling': {
      const miss = ctx.rng.combat.chance(GATLING_MISS);
      let tx = target.x, ty = target.y;
      if (miss) { tx += ctx.rng.combat.range(-24, 24); ty += ctx.rng.combat.range(-24, 24); }
      emitFire(tx, ty);
      const d = dist(cp.x, cp.y, tx, ty);
      pushProjectile(f, { kind: 'tracer', x: cp.x, y: cp.y, tx, ty, speed: TRACER_SPEED, damage: 0, damageClass: 'bullet', aoe: 0, targetId: null, fromCar: carIdx, life: d / TRACER_SPEED + 0.05, hitsAir: false });
      if (!miss) hitEnemy(ctx, target, w.damage * carDamageMul(f.state.train.cars[carIdx]), 'bullet');
      break;
    }
    case 'cannon':
    case 'flak': {
      const aim = predictPos(target, cp.x, cp.y, w.projectileSpeed);
      const d = dist(cp.x, cp.y, aim.x, aim.y);
      emitFire(aim.x, aim.y);
      pushProjectile(f, {
        kind: w.kind === 'cannon' ? 'shell' : 'flak', x: cp.x, y: cp.y, tx: aim.x, ty: aim.y,
        speed: w.projectileSpeed, damage: w.damage * carDamageMul(f.state.train.cars[carIdx]), damageClass: w.damageClass, aoe: w.aoe,
        targetId: target.id, fromCar: carIdx, life: d / Math.max(1, w.projectileSpeed) + 0.6, hitsAir: w.hitsAir,
      });
      break;
    }
    case 'tesla': {
      const pts: Array<[number, number]> = [[cp.x, cp.y]];
      const hitIds: string[] = [];
      let cur: Enemy | null = target;
      let dmg = w.damage * carDamageMul(f.state.train.cars[carIdx]);
      for (let n = 0; n <= w.chain && cur; n++) {
        pts.push([cur.x, cur.y]);
        hitIds.push(cur.id);
        hitEnemy(ctx, cur, dmg, 'energy');
        cur.stunned = Math.max(cur.stunned, TESLA_STUN);
        dmg *= TESLA_CHAIN_FALLOFF;
        // next link: nearest un-hit enemy (any layer) within chain range of the previous one
        let next: Enemy | null = null, bd = TESLA_CHAIN_RANGE;
        for (const o of state.enemies) {
          if (!targetable(o) || o.boardedCar >= 0 || hitIds.indexOf(o.id) >= 0) continue;
          const dd = dist(cur.x, cur.y, o.x, o.y);
          if (dd < bd) { bd = dd; next = o; }
        }
        cur = next;
      }
      emitFire(target.x, target.y);
      ctx.bus.defer('tesla:chain', { points: pts });
      break;
    }
    case 'flame': {
      const ang = Math.atan2(target.y - cp.y, target.x - cp.x);
      emitFire(target.x, target.y);
      for (const e of state.enemies) {
        if (!targetable(e) || e.boardedCar >= 0 || effectiveLayer(e) === 'air') continue;
        const d = dist(cp.x, cp.y, e.x, e.y);
        if (d > range) continue;
        const a = angleDiff(Math.atan2(e.y - cp.y, e.x - cp.x), ang);
        if (Math.abs(a) > FLAME_CONE) continue;
        hitEnemy(ctx, e, w.damage * carDamageMul(f.state.train.cars[carIdx]), 'fire');
        if (e.state !== 'dead') e.burning = Math.max(e.burning, FLAME_BURN);
      }
      // visual-only flame tongue
      const tx = cp.x + Math.cos(ang) * range, ty = cp.y + Math.sin(ang) * range;
      pushProjectile(f, { kind: 'flame', x: cp.x, y: cp.y, tx, ty, speed: range / 0.25, damage: 0, damageClass: 'fire', aoe: w.aoe, targetId: null, fromCar: carIdx, life: 0.3, hitsAir: false });
      break;
    }
    case 'marines': {
      emitFire(target.x, target.y);
      hitEnemy(ctx, target, w.damage * carDamageMul(f.state.train.cars[carIdx]), 'melee');
      break;
    }
    default: break;
  }
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Barracks marines: continuous damage to boarders in this car and its neighbours. */
function marinesPurge(f: Frame, idx: number): void {
  const cars = f.state.train.cars;
  let engaged = false;
  for (let j = idx - 1; j <= idx + 1; j++) {
    const car = cars[j];
    if (!car || car.hp <= 0 || car.boarders.length === 0) continue;
    const ids = car.boarders.slice();
    for (const id of ids) {
      const e = f.byId[id];
      if (!e || e.state === 'dead') continue;
      engaged = true;
      dealDirect(f, e, TRAIN.marineDps * f.dt, 'melee');
    }
  }
  cars[idx].derived.marinesEngaged = engaged;
}

/** Flamethrower: continuous purge of boarders in adjacent cars while the car is powered and enabled. */
function flamePurge(f: Frame, idx: number): void {
  const cars = f.state.train.cars;
  for (let j = idx - 1; j <= idx + 1; j++) {
    const car = cars[j];
    if (!car || car.hp <= 0 || car.boarders.length === 0) continue;
    const ids = car.boarders.slice();
    for (const id of ids) {
      const e = f.byId[id];
      if (!e || e.state === 'dead') continue;
      dealDirect(f, e, TRAIN.flameBoarderDps * f.dt, 'fire');
      cars[idx].derived.activity = 1;
    }
  }
}

// =====================================================================================
// Projectiles
// =====================================================================================

function updateProjectiles(f: Frame): void {
  const { state, dt } = f;
  const list = state.projectiles;
  const keep: Projectile[] = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    p.life -= dt;
    // flak bursts track their (fast, air) target; shells fly to the predicted point
    if (p.kind === 'flak' && p.targetId) {
      const t = f.byId[p.targetId];
      if (t && t.state !== 'dead') { p.tx = t.x; p.ty = t.y; }
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * dt;
    if (d <= step || p.life <= 0) {
      if (d <= step) { p.x = p.tx; p.y = p.ty; }
      resolveProjectile(f, p);
      continue;
    }
    p.x += dx / d * step;
    p.y += dy / d * step;
    keep.push(p);
  }
  state.projectiles = keep;
}

function resolveProjectile(f: Frame, p: Projectile): void {
  const { ctx, state } = f;
  switch (p.kind) {
    case 'shell': {
      for (const e of state.enemies) {
        if (!targetable(e) || e.boardedCar >= 0) continue;
        const layer = effectiveLayer(e);
        if (layer !== 'ground') continue; // shells do not hit air or phase
        const within = p.aoe > 0 ? dist(p.x, p.y, e.x, e.y) <= p.aoe + ENEMY_DEFS[e.type].radius * 0.5 : e.id === p.targetId;
        if (within) hitEnemy(ctx, e, p.damage, 'shell');
      }
      ctx.bus.defer('projectile:explode', { x: p.x, y: p.y, radius: Math.max(p.aoe, 20), kind: 'shell' });
      break;
    }
    case 'flak': {
      for (const e of state.enemies) {
        if (!targetable(e) || e.boardedCar >= 0 || effectiveLayer(e) !== 'air') continue;
        if (dist(p.x, p.y, e.x, e.y) <= p.aoe + ENEMY_DEFS[e.type].radius * 0.5) hitEnemy(ctx, e, p.damage, 'shell');
      }
      ctx.bus.defer('projectile:explode', { x: p.x, y: p.y, radius: Math.max(p.aoe, 16), kind: 'flak' });
      break;
    }
    case 'enemy_shell':
    case 'bolt': {
      // hostile: hits the nearest car within a small radius
      syncCars(f);
      let best = -1, bd = ENEMY_SHELL_HIT_RADIUS;
      for (let i = 0; i < f.cars.length; i++) {
        const car = state.train.cars[i];
        if (!car || car.hp <= 0) continue;
        const d = dist(p.x, p.y, f.cars[i].x, f.cars[i].y);
        if (d <= bd) { bd = d; best = i; }
      }
      if (best >= 0) damageCar(ctx, best, p.damage, p.kind === 'bolt' ? 'energy' : 'shell');
      ctx.bus.defer('projectile:explode', { x: p.x, y: p.y, radius: Math.max(p.aoe, 18), kind: p.kind });
      break;
    }
    case 'tracer':
    case 'flame':
    default:
      break; // visual only: damage was applied at fire time
  }
}
