/**
 * Bosses: Iron Wagon (end of region 2), Brood Mother (end of region 3), Void Maw (the Last Gate).
 *
 * Deterministic; randomness ONLY via ctx.rng.combat. Bosses are regular Enemy records in
 * state.enemies (so weapons / projectiles / status ticks in combat.ts apply to them) whose behaviour
 * is driven here instead of by the regular enemy AI. state.boss tracks the encounter.
 *
 * Damage rules: base resist/armor live in ENEMY_DEFS. Phase-specific overrides are written into
 * e.extra and honoured by combat.hitEnemy:
 *   e.extra.bulletMul  - replaces the def's bullet resist (Brood Mother plates fall: 0.25 -> 0.6)
 *   e.extra.dmgMul     - multiplies all incoming damage (Brood Mother core exposed: x1.5)
 */
import type { SimState, Enemy, EnemyType, BossState } from '../core/types';
import type { SimContext } from './api';
import { ENEMY_DEFS } from '../core/enemies';
import { REGION_W, MAP_W, SCORE, DAY } from '../core/config';
import { hexToWorld } from '../core/hex';
import { spawnEnemy, damageCar, carPos, locoPos, addResource, log, nextId, dist } from './helpers';
import { trainHeading, trainVelocity, moveEnemyToward } from './combat';

export type BossType = 'boss_wagon' | 'boss_brood' | 'boss_maw';

// ---------- tuning ----------
const TRIGGER_WINDOW = 3;         // columns past the trigger column in which a boss may still trigger
const WAGON_DX = -60, WAGON_DY = -170;
const WAGON_SHELL_SPEED = 300;
const WAGON_SHELL_AOE = 30;
const WAGON_RAID_INTERVAL = 9;
const WAGON_RAIDERS = 3;
const WAGON_RAM_INTERVAL = 16;
const WAGON_RAM_DAMAGE = 25;
const WAGON_SWERVE_TIME = 1.2;
const WAGON_SWERVE_DEPTH = 130;
const WAGON_STOPPED_RATE = 1.5;   // fire rate multiplier while the train is stopped
const WAGON_ESCAPE_COL = 2 * REGION_W + 18; // a fast train can outrun the rival line instead of damage-racing forever
const WAGON_LOOT_SCRAP = 30, WAGON_LOOT_AMMO = 20;

const BROOD_HOUND_INTERVAL = 8;
const BROOD_HOUND_CAP = 10;
const BROOD_PLATES_BULLET_MUL = 0.6;
const BROOD_CORE_DMG_MUL = 1.5;
const BROOD_CORE_SPEED_MUL = 1.3;
const BROOD_SPAWN_BEHIND = 380;

const MAW_BOLT_INTERVAL = 2;
const MAW_BOLT_DAMAGE = 12;
const MAW_BOLT_SPEED = 260;
const MAW_RIFT_INTERVAL = 14;
const MAW_WISP_INTERVAL = 10;
const MAW_WISPS = 3;
const MAW_PULL_INTERVAL = 9;
const MAW_PULL_DAMAGE = 25, MAW_PULL_HEAT = 20;

export function initBoss(): BossState {
  return { active: false, type: null, enemyId: null, phase: 0, timer: 0, defeated: [], loopTiles: [], gateOpen: false };
}

/** The living boss enemy, or null. */
export function bossAlive(state: SimState): Enemy | null {
  const b = state.boss;
  if (!b.active || !b.enemyId) return null;
  for (const e of state.enemies) if (e.id === b.enemyId) return e.hp > 0 && e.state !== 'dead' ? e : null;
  return null;
}

/** Per-tick boss update: drives the active boss, or checks the map-position triggers. */
export function updateBosses(ctx: SimContext): void {
  const { state, dt } = ctx;
  const b = state.boss;
  if (b.active) {
    let e: Enemy | null = null;
    for (const en of state.enemies) if (en.id === b.enemyId) { e = en; break; }
    if (!e) { // enemy vanished (clearEnemies / warp): no reward, just deactivate
      b.active = false; b.enemyId = null; b.type = null; b.phase = 0; b.timer = 0;
      return;
    }
    if (e.state === 'dead' || e.hp <= 0) { onBossDeath(ctx, e); return; }
    b.timer += dt;
    updatePhase(ctx, e);
    if (e.type === 'boss_wagon') updateWagon(ctx, e);
    else if (e.type === 'boss_brood') updateBrood(ctx, e);
    else if (e.type === 'boss_maw') updateMaw(ctx, e);
    return;
  }
  const p = state.route.path[state.train.routeIndex];
  if (!p) return;
  const col = p[0];
  const want = triggerFor(col);
  if (want && b.defeated.indexOf(want) < 0) spawnBoss(ctx, want);
}

function triggerFor(col: number): BossType | null {
  if (col >= MAP_W - 3) return 'boss_maw';
  const brood = 3 * REGION_W - 3, wagon = 2 * REGION_W - 3;
  if (col >= brood && col < brood + TRIGGER_WINDOW) return 'boss_brood';
  if (col >= wagon && col < wagon + TRIGGER_WINDOW) return 'boss_wagon';
  return null;
}

/** Spawns a boss and opens the encounter. */
export function spawnBoss(ctx: SimContext, type: BossType): void {
  const { state } = ctx;
  const def = ENEMY_DEFS[type];
  const lp = locoPos(state);
  let x = lp.x, y = lp.y;
  if (type === 'boss_wagon') { x = lp.x + WAGON_DX; y = lp.y + WAGON_DY; }
  else if (type === 'boss_brood') { const h = trainHeading(state); x = lp.x - h.x * BROOD_SPAWN_BEHIND; y = lp.y - h.y * BROOD_SPAWN_BEHIND; }
  else { const t = terminusPos(state); x = t.x; y = t.y; }
  const e = spawnEnemy(ctx, type, x, y);
  e.state = 'attack';
  e.revealed = true;
  e.targetCar = rearCar(state);
  e.attackTimer = def.attackCooldown;
  e.extra = { t1: 0, t2: 0, t3: 0, t4: 0, swerve: 0, swerveHit: 0 };
  const b = state.boss;
  b.active = true; b.type = type; b.enemyId = e.id; b.phase = 0; b.timer = 0;
  ctx.bus.defer('boss:spawn', { type, name: def.name });
  log(state, `${def.name} approaches!`, 'bad');
}

// =====================================================================================
// Shared
// =====================================================================================

function rearCar(state: SimState): number {
  const cars = state.train.cars;
  for (let i = cars.length - 1; i >= 0; i--) if (cars[i].hp > 0) return i;
  return 0;
}

function nightMul(state: SimState): number { return state.isNight ? DAY.nightAggression : 1; }

function terminusPos(state: SimState): { x: number; y: number } {
  for (const s of state.settlements) if (s.type === 'terminus') return hexToWorld(s.col, s.row);
  const lp = locoPos(state);
  const h = trainHeading(state);
  return { x: lp.x + h.x * 400, y: lp.y + h.y * 400 };
}

/** HP-based phase transitions (thresholds per boss). */
function updatePhase(ctx: SimContext, e: Enemy): void {
  const { state } = ctx;
  const frac = e.hp / Math.max(1, e.maxHp);
  const [p1, p2] = e.type === 'boss_wagon' ? [0.65, 0.30] : [0.66, 0.33];
  const phase = frac < p2 ? 2 : frac < p1 ? 1 : 0;
  if (phase <= e.phase) return;
  e.phase = phase;
  state.boss.phase = phase;
  if (e.type === 'boss_brood') {
    if (phase >= 1) { e.extra.plates = 1; e.extra.bulletMul = BROOD_PLATES_BULLET_MUL; }
    if (phase >= 2) { e.extra.core = 1; e.extra.dmgMul = BROOD_CORE_DMG_MUL; }
  }
  ctx.bus.defer('boss:phase', { type: e.type, phase });
  log(state, phaseText(e.type, phase), 'warn');
}

function phaseText(type: EnemyType, phase: number): string {
  if (type === 'boss_wagon') return phase === 1 ? 'The Iron Wagon launches boarding parties!' : 'The Iron Wagon swerves to ram!';
  if (type === 'boss_brood') return phase === 1 ? 'Armour plates fall from the Brood Mother!' : 'The Brood Mother\'s core is exposed!';
  return phase === 1 ? 'The Void Maw reaches for the rear car!' : 'The Void Maw howls - bolts intensify!';
}

function onBossDeath(ctx: SimContext, e: Enemy): void {
  const { state } = ctx;
  const b = state.boss;
  const type = e.type as BossType;
  b.active = false;
  b.enemyId = null;
  b.type = null;
  b.phase = 0;
  b.timer = 0;
  if (b.defeated.indexOf(type) < 0) b.defeated.push(type);
  state.stats.bossesDefeated++;
  state.stats.score += SCORE.boss;
  ctx.bus.defer('boss:died', { type });
  ctx.bus.defer('ui:shake', { power: 1 });
  if (type === 'boss_wagon') {
    ctx.bus.defer('projectile:explode', { x: e.x, y: e.y, radius: 140, kind: 'boss' });
    addResource(ctx, 'scrap', WAGON_LOOT_SCRAP, e.x, e.y);
    addResource(ctx, 'ammo', WAGON_LOOT_AMMO, e.x, e.y);
    log(state, 'The Iron Wagon is wrecked. Salvage: 30 scrap, 20 ammo.', 'good');
  } else if (type === 'boss_brood') {
    ctx.bus.defer('projectile:explode', { x: e.x, y: e.y, radius: 120, kind: 'boss' });
    log(state, 'The Brood Mother collapses.', 'good');
  } else {
    b.gateOpen = true;
    ctx.bus.defer('projectile:explode', { x: e.x, y: e.y, radius: 200, kind: 'boss' });
    ctx.bus.defer('gate:open', {});
    log(state, 'The Last Gate opens', 'good');
  }
}

/** Fires a hostile projectile at the predicted position of car `idx`. */
function fireAtCar(ctx: SimContext, e: Enemy, idx: number, kind: 'enemy_shell' | 'bolt', speed: number, damage: number, aoe: number): void {
  const { state } = ctx;
  const c = carPos(state, idx);
  const v = trainVelocity(state);
  const d0 = dist(e.x, e.y, c.x, c.y);
  const t = d0 / speed;
  const tx = c.x + v.x * t, ty = c.y + v.y * t;
  const d = dist(e.x, e.y, tx, ty);
  state.projectiles.push({
    id: nextId(state, 'p'), kind, x: e.x, y: e.y, tx, ty, speed, damage,
    damageClass: kind === 'bolt' ? 'energy' : 'shell', aoe, targetId: null, fromCar: -1,
    life: d / speed + 0.5, hitsAir: false,
  });
}

// =====================================================================================
// Iron Wagon: rival armoured train on a phantom parallel line
// =====================================================================================

function updateWagon(ctx: SimContext, e: Enemy): void {
  const { state, dt } = ctx;
  const def = ENEMY_DEFS.boss_wagon;
  const tile = state.route.path[Math.min(state.train.routeIndex, state.route.path.length - 1)];
  if (tile && tile[0] >= WAGON_ESCAPE_COL) {
    const i = state.enemies.indexOf(e);
    if (i >= 0) state.enemies.splice(i, 1);
    state.boss.active = false;
    state.boss.enemyId = null;
    state.boss.type = null;
    state.boss.phase = 0;
    state.boss.timer = 0;
    if (state.boss.defeated.indexOf('boss_wagon') < 0) state.boss.defeated.push('boss_wagon');
    ctx.bus.defer('ui:notify', { text: 'The Iron Wagon falls behind — the rival line ends here.', kind: 'good' });
    log(state, 'The Iron Wagon falls behind at the end of its rival line.', 'good');
    return;
  }
  const lp = locoPos(state);
  const v = trainVelocity(state);

  // swerve (phase 2 ram): dips toward the track, hits at the deepest point
  let off = 0;
  if (e.extra.swerve > 0) {
    e.extra.swerve = Math.max(0, e.extra.swerve - dt);
    const t = 1 - e.extra.swerve / WAGON_SWERVE_TIME;
    off = Math.sin(Math.PI * t) * WAGON_SWERVE_DEPTH;
    if (e.extra.swerveHit !== 1 && t >= 0.5) {
      e.extra.swerveHit = 1;
      let best = -1, bd = 1e9;
      for (let i = 0; i < state.train.cars.length; i++) {
        if (state.train.cars[i].hp <= 0) continue;
        const c = carPos(state, i);
        const d = dist(e.x, e.y, c.x, c.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        damageCar(ctx, best, WAGON_RAM_DAMAGE * nightMul(state), 'ram');
        ctx.bus.defer('enemy:ram', { id: e.id, carIndex: best, x: e.x, y: e.y });
        ctx.bus.defer('ui:shake', { power: 0.8 });
      }
    }
  }
  e.x = lp.x + WAGON_DX;
  e.y = lp.y + WAGON_DY + off;
  e.vx = v.x; e.vy = v.y;
  const h = trainHeading(state);
  e.angle = Math.atan2(h.y, h.x);
  e.targetCar = 0;

  // main gun: a shell at a random living car (faster while the train is stopped)
  if (e.stunned <= 0) {
    e.attackTimer -= dt * (state.train.stopped ? WAGON_STOPPED_RATE : 1);
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attackCooldown;
      const n = state.train.cars.length;
      if (n > 0) {
        let idx = ctx.rng.combat.int(0, n - 1);
        if (state.train.cars[idx].hp <= 0) idx = rearCar(state);
        fireAtCar(ctx, e, idx, 'enemy_shell', WAGON_SHELL_SPEED, def.damage * nightMul(state), WAGON_SHELL_AOE);
      }
    }
  }

  // phase 1: boarding parties
  if (e.phase >= 1) {
    e.extra.t1 += dt;
    if (e.extra.t1 >= WAGON_RAID_INTERVAL) {
      e.extra.t1 = 0;
      for (let i = 0; i < WAGON_RAIDERS; i++) {
        const r = spawnEnemy(ctx, 'raider', e.x + ctx.rng.combat.range(-30, 30), e.y + 30 + ctx.rng.combat.range(-10, 10));
        r.extra.side = -1; // approach from the wagon's side of the track
      }
      log(state, 'Boarding party launched from the Iron Wagon!', 'warn');
    }
  }

  // phase 2: periodic ram
  if (e.phase >= 2) {
    e.extra.t2 += dt;
    if (e.extra.t2 >= WAGON_RAM_INTERVAL && e.extra.swerve <= 0) {
      e.extra.t2 = 0;
      e.extra.swerve = WAGON_SWERVE_TIME;
      e.extra.swerveHit = 0;
    }
  }
}

// =====================================================================================
// Brood Mother: giant crawler chasing the rear of the train, spawning hounds
// =====================================================================================

function updateBrood(ctx: SimContext, e: Enemy): void {
  const { state, dt } = ctx;
  const def = ENEMY_DEFS.boss_brood;
  const target = rearCar(state);
  e.targetCar = target;
  const c = carPos(state, target);
  let speed = def.speed * (state.isNight ? 1.15 : 1);
  if (e.phase >= 2) speed *= BROOD_CORE_SPEED_MUL;

  const reach = def.range + def.radius;
  let d = dist(e.x, e.y, c.x, c.y);
  if (e.stunned <= 0) {
    if (d > reach) d = moveEnemyToward(e, c.x, c.y, speed, dt);
    else { e.vx = 0; e.vy = 0; e.angle = Math.atan2(c.y - e.y, c.x - e.x); }
    e.attackTimer -= dt;
    if (d <= reach && e.attackTimer <= 0) {
      e.attackTimer = def.attackCooldown;
      damageCar(ctx, target, def.damage * nightMul(state), 'ram');
      ctx.bus.defer('enemy:ram', { id: e.id, carIndex: target, x: e.x, y: e.y });
      ctx.bus.defer('ui:shake', { power: 0.7 });
    }
  }

  // hound broods
  e.extra.t1 += dt;
  if (e.extra.t1 >= BROOD_HOUND_INTERVAL) {
    e.extra.t1 = 0;
    let living = 0;
    for (const o of state.enemies) if (o.type === 'hound' && o.hp > 0 && o.state !== 'dead') living++;
    const n = e.phase >= 2 ? 4 : 2;
    for (let i = 0; i < n && living < BROOD_HOUND_CAP; i++, living++) {
      const a = ctx.rng.combat.range(0, Math.PI * 2);
      spawnEnemy(ctx, 'hound', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50);
    }
  }
}

// =====================================================================================
// Void Maw: stationary at the terminus; bolts, rifts, wisps, pulls the rear car
// =====================================================================================

function updateMaw(ctx: SimContext, e: Enemy): void {
  const { state, dt } = ctx;
  const def = ENEMY_DEFS.boss_maw;
  e.vx = 0; e.vy = 0;
  const rear = rearCar(state);
  e.targetCar = rear;
  const c = carPos(state, rear);
  const inRange = dist(e.x, e.y, c.x, c.y) <= def.range;
  e.angle = Math.atan2(c.y - e.y, c.x - e.x);

  // void bolts at the rear car (rate doubles in phase 2)
  e.attackTimer -= dt * (e.phase >= 2 ? 2 : 1);
  if (e.attackTimer <= 0) {
    e.attackTimer = MAW_BOLT_INTERVAL;
    if (inRange) fireAtCar(ctx, e, rear, 'bolt', MAW_BOLT_SPEED, MAW_BOLT_DAMAGE * nightMul(state), 0);
  }

  // rifts on the route ahead (the void module grows them)
  e.extra.t1 += dt;
  if (e.extra.t1 >= MAW_RIFT_INTERVAL) {
    e.extra.t1 = 0;
    const path = state.route.path;
    const idx = state.train.routeIndex + ctx.rng.combat.int(3, 6);
    const p = path[Math.min(idx, path.length - 1)];
    if (p && idx > state.train.routeIndex) {
      const w = hexToWorld(p[0], p[1]);
      state.void.rifts.push({ col: p[0], row: p[1], radius: 0, openAt: state.time, id: nextId(state, 'rift'), opened: false });
      ctx.bus.defer('rift:open', { col: p[0], row: p[1], x: w.x, y: w.y });
      log(state, 'The Void Maw tears a rift in the track ahead!', 'bad');
    }
  }

  // wisps around itself
  e.extra.t2 += dt;
  if (e.extra.t2 >= MAW_WISP_INTERVAL) {
    e.extra.t2 = 0;
    for (let i = 0; i < MAW_WISPS; i++) {
      const a = (i / MAW_WISPS) * Math.PI * 2 + ctx.rng.combat.range(-0.5, 0.5);
      const r = ctx.rng.combat.range(70, 110);
      spawnEnemy(ctx, 'wisp', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
    }
  }

  // phase 1+: pulls the rear car
  if (e.phase >= 1) {
    e.extra.t3 += dt;
    if (e.extra.t3 >= MAW_PULL_INTERVAL && inRange) {
      e.extra.t3 = 0;
      const car = state.train.cars[rear];
      if (car && car.hp > 0) {
        car.heat = Math.min(120, car.heat + MAW_PULL_HEAT);
        damageCar(ctx, rear, MAW_PULL_DAMAGE, 'energy');
        ctx.bus.defer('ui:shake', { power: 0.8 });
        log(state, 'The Maw drags at the rear car!', 'bad');
      }
    }
  }
}
