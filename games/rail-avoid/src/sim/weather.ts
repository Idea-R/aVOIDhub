/** Weather, day/night cycle and the advancing void (front + rifts). */
import type { WeatherKind, WeatherState, VoidState, SimState } from '../core/types';
import type { SimContext } from './api';
import { WEATHER, DAY, VOID, HEX_R, MAP_W } from '../core/config';
import { hexToWorld, hash2 } from '../core/hex';
import { tileAt, damageCar, carPos, log, locoPos } from './helpers';

export function initWeather(): WeatherState {
  return { kind: 'clear', next: 'clear', timer: 70, intensity: 1, lightningTimer: 10 };
}
export function initVoid(): VoidState {
  return { front: [], speed: VOID.baseSpeed, rifts: [] };
}

function pickWeather(ctx: SimContext, region: number, current: WeatherKind): WeatherKind {
  const kinds = (Object.keys(WEATHER) as WeatherKind[]).filter(k => WEATHER[k].regions.includes(region) && k !== current);
  const weights = kinds.map(k => k === 'clear' ? 5 : k === 'storm' ? 1.6 : k === 'ashfall' ? 2.2 : 2.5);
  return ctx.rng.events.weighted(kinds, weights);
}

export function updateWeather(ctx: SimContext): void {
  const { state, dt } = ctx;
  const w = state.weather;
  w.timer -= dt;
  if (w.timer <= 0) {
    if (w.kind !== w.next) {
      w.kind = w.next;
      const def = WEATHER[w.kind];
      w.timer = ctx.rng.events.range(def.minDur, def.maxDur);
      w.intensity = 0;
      ctx.bus.defer('weather:change', { kind: w.kind });
      if (w.kind !== 'clear') log(state, `Weather: ${w.kind}`, 'info');
    } else {
      w.next = pickWeather(ctx, state.region, w.kind);
      w.timer = 8; // forecast window before the change
    }
  }
  w.intensity = Math.min(1, w.intensity + dt / 5);
  if (w.kind === 'storm' && w.intensity > 0.5) {
    w.lightningTimer -= dt;
    if (w.lightningTimer <= 0) {
      w.lightningTimer = ctx.rng.events.range(8, 16);
      const cars = state.train.cars;
      if (cars.length) {
        const idx = ctx.rng.events.int(0, cars.length - 1);
        const p = carPos(state, idx);
        cars[idx].heat = Math.min(120, cars[idx].heat + 25);
        damageCar(ctx, idx, 8, 'lightning');
        ctx.bus.defer('lightning', { carIndex: idx, x: p.x, y: p.y });
      }
    }
  }
}

export function updateDayNight(ctx: SimContext): void {
  const { state } = ctx;
  state.dayTime = (state.time / DAY.cycleSeconds + 0.1) % 1;
  const night = state.dayTime >= DAY.nightStart && state.dayTime < DAY.nightEnd;
  if (night !== state.isNight) {
    state.isNight = night;
    ctx.bus.defer('day:phase', { night });
    log(state, night ? 'Night falls. Enemies grow bolder.' : 'Dawn.', night ? 'warn' : 'info');
  }
}

/** Row of a world y (unprojected) — approximate via inverse of hexToWorld on column 0. */
export function rowOfY(y: number, mapH: number): number {
  const r = Math.round(y / (HEX_R * Math.sqrt(3)));
  return Math.max(0, Math.min(mapH - 1, r));
}

export function voidFrontAt(state: SimState, y: number): number {
  const f = state.void.front;
  if (!f.length) return -Infinity;
  const rf = y / (HEX_R * Math.sqrt(3));
  const r0 = Math.max(0, Math.min(f.length - 1, Math.floor(rf)));
  const r1 = Math.max(0, Math.min(f.length - 1, r0 + 1));
  const t = Math.max(0, Math.min(1, rf - r0));
  return f[r0] + (f[r1] - f[r0]) * t;
}

export function voidDistance(state: SimState): number {
  const p = locoPos(state);
  return p.x - voidFrontAt(state, p.y);
}

export function updateVoid(ctx: SimContext): void {
  const { state, dt } = ctx;
  const v = state.void;
  if (!v.front.length) return;
  const loco = locoPos(state);
  const d = voidDistance(state);
  let speed = VOID.baseSpeed * VOID.regionSpeedMul[Math.max(0, Math.min(3, state.region))];
  if (d > VOID.catchUpDistance) speed *= VOID.catchUpBoost;
  else if (d < VOID.slowNearDistance) speed *= VOID.slowNearMul;
  if (state.boss.active && state.boss.type === 'boss_maw') speed *= 0.4;
  v.speed = speed;
  const rows = v.front.length;
  const mean = v.front.reduce((a, b) => a + b, 0) / rows;
  for (let r = 0; r < rows; r++) {
    const wob = 0.8 + 0.4 * hash2(r, Math.floor(state.time / 6), state.seed);
    // rows far ahead of the mean slow down, rows behind catch up (keeps the front coherent)
    const cohesion = (mean - v.front[r]) * 0.02;
    v.front[r] += (speed * wob + cohesion) * dt;
  }
  // rifts grow
  for (const rift of v.rifts) {
    if (state.time < rift.openAt) continue;
    if (!rift.opened) { rift.opened = true; const w = hexToWorld(rift.col, rift.row); ctx.bus.defer('rift:open', { col: rift.col, row: rift.row, x: w.x, y: w.y }); log(state, 'A rift tears open ahead!', 'bad'); }
    rift.radius = Math.min(HEX_R * 3.2, rift.radius + VOID.riftGrowth * dt);
  }
  // consume tiles (check a band of columns near the front for efficiency)
  if (Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4)) {
    const minX = Math.min(...v.front) - HEX_R * 2, maxX = Math.max(...v.front) + HEX_R * 2;
    for (const t of state.tiles) {
      if (t.void) continue;
      const w = hexToWorld(t.col, t.row);
      let eat = false;
      if (w.x >= minX && w.x <= maxX && w.x + HEX_R * 0.4 < v.front[t.row]) eat = true;
      else if (w.x < minX) eat = true;
      if (!eat) {
        for (const rift of v.rifts) {
          if (!rift.opened) continue;
          const rw = hexToWorld(rift.col, rift.row);
          if (Math.hypot(rw.x - w.x, rw.y - w.y) < rift.radius) { eat = true; break; }
        }
      }
      if (eat) {
        t.void = true; t.voidAt = state.time;
        ctx.bus.defer('void:consume', { col: t.col, row: t.row });
        if (t.settlementId) {
          const s = state.settlements.find(x => x.id === t.settlementId);
          if (s && !s.visited && !s.consumed) {
            s.consumed = true;
            state.stats.settlementsLost++;
            ctx.bus.defer('settlement:consumed', { id: s.id, name: s.name, hadPassengers: s.passengers });
            log(state, `${s.name} was taken by the void`, 'bad');
          }
        }
      }
    }
    // refresh deadlines
    for (const s of state.settlements) {
      if (s.consumed || s.visited) continue;
      const w = hexToWorld(s.col, s.row);
      s.deadline = state.time + Math.max(0, (w.x - v.front[s.row]) / Math.max(1, v.speed));
    }
    // planned path tiles consumed -> blocked
    const p = state.route.path;
    let blocked = false;
    for (let i = state.train.routeIndex + 1; i < p.length; i++) {
      const t = tileAt(state, p[i][0], p[i][1]);
      if (t && t.void) { blocked = true; break; }
    }
    if (blocked && !state.route.blocked) { state.route.blocked = true; ctx.bus.defer('track:blocked', { reason: 'The void has cut your planned route' }); log(state, 'Planned route cut by the void!', 'bad'); }
    if (!blocked) state.route.blocked = false;
  }
  // damage cars inside the void
  const t = state.train;
  for (let i = t.cars.length - 1; i >= 0; i--) {
    const p = carPos(state, i);
    const inVoid = p.x < voidFrontAt(state, p.y) || v.rifts.some(r => r.opened && Math.hypot(hexToWorld(r.col, r.row).x - p.x, hexToWorld(r.col, r.row).y - p.y) < r.radius);
    if (!inVoid) continue;
    if (i === 0) { damageCar(ctx, 0, 1e6, 'void'); return; }
    damageCar(ctx, i, 15 * dt, 'void');
    if (state.phase === 'defeat') return;
  }
  ctx.bus.defer('void:advance', { x: voidFrontAt(state, loco.y) });
  void MAP_W;
}
