/**
 * Wave director: decides WHEN a wave comes, WHAT it is made of and WHERE it appears.
 *
 * Deterministic; randomness ONLY via ctx.rng.waves.
 *  - Timing: nextWaveIn counts down at `pressure` seconds per second, where pressure grows with
 *    tile threat, stop pressure and night. That equals "base interval / pressure" for a steady pressure
 *    while still reacting immediately when the player stops.
 *  - Composition: threat budget spent on enemy types weighted by REGION_WEIGHTS x adaptive bias
 *    (the director favours types that resist the damage classes that made recent kills).
 *  - Warning: the dominant type & direction are decided at warning time (stored in state.director.warning)
 *    and the spawned wave is built around that same dominant type so the warning is always honest.
 */
import type { EnemyType, WaveDirectorState, DamageClass, SimState, Tile } from '../core/types';
import type { SimContext } from './api';
import { DIRECTOR, HEX_R, HEX_H, REGION_W, LOOT } from '../core/config';
import { ENEMY_DEFS, REGULAR_ENEMIES, REGION_WEIGHTS, enemyCountersClass } from '../core/enemies';
import { hexToWorld, worldToHex } from '../core/hex';
import { spawnEnemy, tileAt, hasCar, locoPos, log } from './helpers';

type Dir = 'west' | 'north' | 'south' | 'east';

const GRACE_PERIOD = 55;        // s: enough time to learn route planning before combat
const FIRST_WAVE_DELAY = 22;    // s after the grace period (interval-seconds, pressure-scaled)
const MIN_WAVE = 2;
const MAX_WAVE = 14;
const MAX_SAPPERS = 2;
const DOMINANT_SHARE = 0.6;     // share of the budget spent on the announced type
const DOMINANT_MAX = 8;         // at most this many of the announced type
const KILL_DECAY = 0.6;         // killsByClass multiplier after each wave
const SPREAD = 40;              // +- px jitter per member (~80 px spread)
const CLASSES: DamageClass[] = ['bullet', 'shell', 'energy', 'fire', 'melee'];

export function initDirector(): WaveDirectorState {
  return {
    budget: 0,
    nextWaveIn: FIRST_WAVE_DELAY,
    waveCount: 0,
    killsByClass: { bullet: 0, shell: 0, energy: 0, fire: 0, melee: 0 },
    lastWaveTypes: [],
    warning: null,
  };
}

/** Per-tick director update (only while running). */
export function updateDirector(ctx: SimContext): void {
  const { state, dt } = ctx;
  const d = state.director;
  if (state.time < GRACE_PERIOD) return;
  if (state.boss.active) { d.warning = null; return; } // bosses bring their own adds

  const tile = locoTile(state);
  const region = clampRegion(tile ? tile.region : state.region);
  const threat = tile ? tile.threat : 0;
  // settlements are havens: the director holds its breath while the train is stopped at one
  if (state.train.stopped && (state.train.stopReason === 'settlement' || state.phase === 'shop')) {
    const p = state.route.path[state.train.routeIndex];
    const t = p ? state.tiles[p[1] * state.mapW + p[0]] : null;
    const st = t && t.settlementId ? state.settlements.find(x => x.id === t.settlementId) : null;
    if (!st || st.type !== 'crossroads') return;
  }
  const pressure = 1 + DIRECTOR.threatMul * threat + DIRECTOR.stopPressureMul * state.train.stopPressure + (state.isNight ? 0.35 : 0);

  d.budget = waveBudget(state, region, threat);
  d.nextWaveIn -= dt * pressure;

  const lead = DIRECTOR.warningLead * (hasCar(state, 'signal') ? 2 : 1) + (state.time < (state.train.watchUntil ?? 0) ? 4 : 0) + ((state.train.relics ?? []).includes('signal_lantern') ? 4 : 0);
  if (!d.warning && d.nextWaveIn <= lead) {
    const type = pickType(ctx, region, []);
    const from = pickDirection(ctx, type);
    d.warning = { type, from, in: Math.max(0, d.nextWaveIn) };
    ctx.bus.defer('wave:warning', { type, from, in: d.warning.in });
    log(state, `${ENEMY_DEFS[type].name}s sighted to the ${from}!`, 'warn');
  } else if (d.warning) {
    d.warning.in = Math.max(0, d.nextWaveIn);
  }

  if (d.nextWaveIn <= 0) {
    const dominant = d.warning ? d.warning.type : pickType(ctx, region, []);
    const from: Dir = d.warning ? d.warning.from : pickDirection(ctx, dominant);
    const types = composeWave(ctx, region, d.budget, dominant);
    spawnWave(ctx, types, from);
    for (const c of CLASSES) d.killsByClass[c] = (d.killsByClass[c] ?? 0) * KILL_DECAY;
    d.warning = null;
    d.nextWaveIn = DIRECTOR.baseInterval[region];
  }
}

/**
 * Spawn an explicit list of enemy types around the train (also used by the debug API).
 * Wisps always rise from the void front regardless of `from`. Counts as a wave (waveCount, lastWaveTypes).
 */
export function spawnWave(ctx: SimContext, types: EnemyType[], from: Dir = 'west'): void {
  const { state } = ctx;
  if (types.length === 0) return;
  let ns = 0;
  const region = Math.max(0, Math.min(3, state.region));
  const eliteChance = LOOT.eliteChancePerWave[region] ?? 0;
  const eligible = types.map((t, i) => (t !== 'sapper' ? i : -1)).filter(i => i >= 0);
  const eliteIndex = eligible.length && ctx.rng.waves.chance(eliteChance) ? ctx.rng.waves.pick(eligible) : -1;
  let elitePicked = false;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (!ENEMY_DEFS[t]) continue;
    let dir: Dir = from;
    // only crawlers and sappers come from ahead; other members of an 'east' wave flank instead
    if (dir === 'east' && t !== 'crawler' && t !== 'sapper') dir = (ns++ % 2 === 0) ? 'north' : 'south';
    const p = spawnPoint(ctx, dir, t, i);
    const e = spawnEnemy(ctx, t, p.x, p.y);
    // one elite per wave (region-gated): tougher, glowing, drops a relic choice and Void Marks
    if (!elitePicked && i === eliteIndex) {
      elitePicked = true;
      e.extra.elite = 1;
      e.maxHp = Math.round(e.maxHp * LOOT.eliteHpMul);
      e.hp = e.maxHp;
      ctx.bus.defer('enemy:elite', { id: e.id, type: e.type });
    }
  }
  const d = state.director;
  d.waveCount++;
  d.lastWaveTypes = types.slice();
  ctx.bus.defer('wave:spawn', { count: types.length, types: types.slice() });
  log(state, `Wave ${d.waveCount}: ${describeWave(types)} from the ${from}`, 'warn');
}

// =====================================================================================
// Budget / composition
// =====================================================================================

function clampRegion(r: number): number { return Math.max(0, Math.min(3, Math.floor(r) || 0)); }

function locoTile(state: SimState): Tile | null {
  const p = state.route.path[Math.min(state.train.routeIndex, state.route.path.length - 1)];
  return p ? tileAt(state, p[0], p[1]) : null;
}

function waveBudget(state: SimState, region: number, threat: number): number {
  let b = DIRECTOR.budgetPerWave[region] + DIRECTOR.budgetGrowthPerMin[region] * (state.time / 60);
  if (hasCar(state, 'signal')) b *= 0.8;
  b *= Math.min(1, 0.55 + state.time / 420); // gentle ramp over the first 7 minutes
  b *= 1 + 0.6 * threat;
  return b;
}

/** Adaptive bias: 1 + adaptiveBias * (share of recent kills made by classes this type resists). */
function adaptiveBias(state: SimState, type: EnemyType): number {
  const k = state.director.killsByClass;
  let total = 0, resisted = 0;
  for (const c of CLASSES) {
    const v = k[c] ?? 0;
    total += v;
    if (enemyCountersClass(type, c)) resisted += v;
  }
  if (total <= 0) return 1;
  return 1 + DIRECTOR.adaptiveBias * (resisted / total);
}

function allowedTypes(region: number): EnemyType[] {
  const out: EnemyType[] = [];
  for (const t of REGULAR_ENEMIES) if (REGION_WEIGHTS[t][region] > 0) out.push(t);
  return out.length > 0 ? out : ['raider'];
}

/** Weighted pick of a type for this region (with adaptive bias), excluding `exclude` when possible. */
function pickType(ctx: SimContext, region: number, exclude: EnemyType[], maxCost = 1e9): EnemyType {
  const state = ctx.state;
  let pool = allowedTypes(region).filter(t => exclude.indexOf(t) < 0 && ENEMY_DEFS[t].threatCost <= maxCost);
  if (pool.length === 0) pool = allowedTypes(region).filter(t => ENEMY_DEFS[t].threatCost <= maxCost);
  if (pool.length === 0) return 'raider';
  // new enemy types ramp in over the first third of a region instead of appearing at the border
  const p = state.route.path[Math.min(state.train.routeIndex, state.route.path.length - 1)];
  const into = p ? Math.max(0, Math.min(1, ((p[0] % REGION_W) + 1) / (REGION_W / 3))) : 1;
  const weights = pool.map(t => {
    const w = REGION_WEIGHTS[t][region];
    const prev = region > 0 ? REGION_WEIGHTS[t][region - 1] : w;
    return (prev + (w - prev) * into) * adaptiveBias(state, t);
  });
  return ctx.rng.waves.weighted(pool, weights);
}

/** Spend the budget: ~60% on the announced dominant type, the rest on other region types. */
function composeWave(ctx: SimContext, region: number, budget: number, dominant: EnemyType): EnemyType[] {
  const cost = (t: EnemyType) => ENEMY_DEFS[t].threatCost;
  const types: EnemyType[] = [];
  let spent = 0;
  let sappers = 0;
  const push = (t: EnemyType) => { types.push(t); spent += cost(t); if (t === 'sapper') sappers++; };
  const canAdd = (t: EnemyType) => types.length < MAX_WAVE && !(t === 'sapper' && sappers >= MAX_SAPPERS);

  // dominant block (capped so cheap types cannot fill the whole wave)
  const domBudget = budget * DOMINANT_SHARE;
  while (canAdd(dominant) && types.length < DOMINANT_MAX && (types.length === 0 || spent + cost(dominant) <= domBudget)) push(dominant);

  // remaining budget on other types (weighted, adaptive)
  let guard = 0;
  while (types.length < MAX_WAVE && guard++ < 40) {
    const remaining = budget - spent;
    const exclude: EnemyType[] = [dominant];
    if (sappers >= MAX_SAPPERS) exclude.push('sapper');
    const options = allowedTypes(region).filter(t => exclude.indexOf(t) < 0 && cost(t) <= remaining);
    if (options.length === 0) {
      // no other type affordable: top up with the dominant type if it fits, else stop
      if (canAdd(dominant) && cost(dominant) <= remaining) { push(dominant); continue; }
      break;
    }
    push(pickType(ctx, region, exclude, remaining));
  }

  // minimum size: cheapest affordable types
  while (types.length < MIN_WAVE) {
    const pool = allowedTypes(region).filter(t => canAdd(t));
    if (pool.length === 0) break;
    let cheapest = pool[0];
    for (const t of pool) if (cost(t) < cost(cheapest)) cheapest = t;
    push(cheapest);
  }

  // never a single-type wave when the region offers a second type
  if (uniqueTypes(types).length === 1) {
    const alt = allowedTypes(region).filter(t => t !== types[0] && !(t === 'sapper' && sappers >= MAX_SAPPERS));
    if (alt.length > 0) {
      const t = pickType(ctx, region, [types[0]]);
      if (types.length >= MAX_WAVE) types[types.length - 1] = t; else push(t);
    }
  }

  // avoid repeating the exact same mix as the previous wave
  if (sameMix(types, ctx.state.director.lastWaveTypes)) {
    const present = uniqueTypes(types);
    const alt = allowedTypes(region).filter(t => present.indexOf(t) < 0 && !(t === 'sapper' && sappers >= MAX_SAPPERS));
    if (alt.length > 0) {
      const t = pickType(ctx, region, present);
      // replace the last non-dominant member (or append) so the mix changes
      let idx = -1;
      for (let i = types.length - 1; i >= 0; i--) if (types[i] !== dominant) { idx = i; break; }
      if (idx >= 0) types[idx] = t; else if (types.length < MAX_WAVE) types.push(t); else types[types.length - 1] = t;
    }
  }
  return types;
}

function uniqueTypes(types: EnemyType[]): EnemyType[] {
  const out: EnemyType[] = [];
  for (const t of types) if (out.indexOf(t) < 0) out.push(t);
  return out;
}

function sameMix(a: EnemyType[], b: EnemyType[]): boolean {
  const ua = uniqueTypes(a).sort(), ub = uniqueTypes(b).sort();
  if (ua.length !== ub.length || ua.length === 0) return false;
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
  return true;
}

function describeWave(types: EnemyType[]): string {
  const counts: Array<{ t: EnemyType; n: number }> = [];
  for (const t of types) {
    let hit = false;
    for (const c of counts) if (c.t === t) { c.n++; hit = true; break; }
    if (!hit) counts.push({ t, n: 1 });
  }
  return counts.map(c => `${c.n} ${ENEMY_DEFS[c.t].name}${c.n > 1 ? 's' : ''}`).join(', ');
}

function pickDirection(ctx: SimContext, dominant: EnemyType): Dir {
  const r = ctx.rng.waves;
  if (dominant === 'wisp') return 'west';
  if (dominant === 'crawler' || dominant === 'sapper') return r.weighted<Dir>(['west', 'north', 'south', 'east'], [2, 2, 2, 3]);
  return r.weighted<Dir>(['west', 'north', 'south'], [3, 2, 2]);
}

// =====================================================================================
// Spawn positions
// =====================================================================================

/** World point for wave member `i` of `type` arriving from `dir`; never void / off-map. */
function spawnPoint(ctx: SimContext, dir: Dir, type: EnemyType, i: number): { x: number; y: number } {
  const { state } = ctx;
  const r = ctx.rng.waves;
  const lp = locoPos(state);
  let base: { x: number; y: number };
  if (type === 'wisp') {
    const p = state.route.path[Math.min(state.train.routeIndex, state.route.path.length - 1)];
    const row = p ? p[1] : 0;
    const fx = state.void.front[row];
    const x = (fx !== undefined && Number.isFinite(fx)) ? fx + 20 : lp.x - 500;
    base = { x, y: lp.y + (r.chance(0.5) ? 1 : -1) * r.range(60, 120) };
  } else {
    switch (dir) {
      case 'west': base = pointAlongPath(state, -r.range(420, 520)); break;
      case 'east': base = pointAlongPath(state, r.range(420, 520)); break;
      case 'north': base = { x: lp.x, y: lp.y - DIRECTOR.spawnDistance }; break;
      case 'south':
      default: base = { x: lp.x, y: lp.y + DIRECTOR.spawnDistance }; break;
    }
  }
  base = { x: base.x + r.range(-SPREAD, SPREAD), y: base.y + r.range(-SPREAD, SPREAD) };
  return sanitizeSpawn(state, base, lp, i);
}

/** Point `signedDist` px along the route from the loco (negative = behind), extrapolating past the ends. */
function pointAlongPath(state: SimState, signedDist: number): { x: number; y: number } {
  const path = state.route.path;
  const start = Math.min(state.train.routeIndex, path.length - 1);
  if (start < 0 || path.length === 0) {
    const lp = locoPos(state);
    return { x: lp.x + signedDist, y: lp.y };
  }
  const step = signedDist < 0 ? -1 : 1;
  const want = Math.abs(signedDist);
  let acc = 0;
  let cur = hexToWorld(path[start][0], path[start][1]);
  let prev = cur;
  let i = start;
  while (true) {
    const j = i + step;
    if (j < 0 || j >= path.length) break;
    const next = hexToWorld(path[j][0], path[j][1]);
    const seg = Math.sqrt((next.x - cur.x) ** 2 + (next.y - cur.y) ** 2);
    if (acc + seg >= want) {
      const t = seg > 0 ? (want - acc) / seg : 0;
      return { x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t };
    }
    acc += seg; prev = cur; cur = next; i = j;
  }
  // ran out of path: continue straight in the last direction
  let dx = cur.x - prev.x, dy = cur.y - prev.y;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) { dx = step; dy = 0; d = 1; }
  const rem = want - acc;
  return { x: cur.x + dx / d * rem, y: cur.y + dy / d * rem };
}

function validSpawn(state: SimState, x: number, y: number): boolean {
  const [c, r] = worldToHex(x, y);
  const t = tileAt(state, c, r);
  return !!t && !t.void;
}

/** Nudge an invalid point toward the loco; fall back to flank offsets; last resort: just beside the loco. */
function sanitizeSpawn(state: SimState, p: { x: number; y: number }, lp: { x: number; y: number }, i: number): { x: number; y: number } {
  const maxX = HEX_R * 1.5 * (state.mapW - 1), maxY = HEX_H * state.mapH;
  let x = Math.max(0, Math.min(maxX, p.x)), y = Math.max(0, Math.min(maxY, p.y));
  for (let k = 0; k < 10; k++) {
    if (validSpawn(state, x, y)) return { x, y };
    const dx = lp.x - x, dy = lp.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 60) break;
    x += dx / d * 50; y += dy / d * 50;
  }
  const flanks: Array<[number, number]> = [[0, -300], [0, 300], [260, 0], [-260, 0], [0, -180], [0, 180]];
  for (const [fx, fy] of flanks) {
    const cx = Math.max(0, Math.min(maxX, lp.x + fx)), cy = Math.max(0, Math.min(maxY, lp.y + fy));
    if (validSpawn(state, cx, cy)) return { x: cx, y: cy };
  }
  return { x: lp.x + 120, y: lp.y + (i % 2 === 0 ? -90 : 90) };
}
