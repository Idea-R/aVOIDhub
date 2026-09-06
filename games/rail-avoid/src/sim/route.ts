/** Route planning: costs, plannable tiles, plan/unplan, A* auto-planning, auto-follow of pre-laid rail. */
import type { SimState } from '../core/types';
import type { SimContext, PlanResult } from './api';
import { TRACK_COST, TRAIN, MAX_CARS, LINE_NAMES } from '../core/config';
import { neighbors, edgeKey, hexDistance, tileKey } from '../core/hex';
import { CAR_DEFS } from '../core/cars';
import { tileAt, addResource, log } from './helpers';
import { blockedTrack } from '../core/trackEncounters';

// ---- link set cache (rebuilt when arrays change identity or length)
interface LinkCache { rail: Set<string>; built: Set<string>; railRef: string[]; railLen: number; builtRef: string[]; builtLen: number; }
const caches = new WeakMap<SimState, LinkCache>();
export function links(state: SimState): { rail: Set<string>; built: Set<string> } {
  let c = caches.get(state);
  const r = state.route;
  if (!c || c.railRef !== r.railLinks || c.railLen !== r.railLinks.length) {
    c = { ...(c ?? { built: new Set(), builtRef: r.builtLinks, builtLen: -1 }), rail: new Set(r.railLinks), railRef: r.railLinks, railLen: r.railLinks.length } as LinkCache;
    caches.set(state, c);
  }
  if (c.builtRef !== r.builtLinks || c.builtLen !== r.builtLinks.length) {
    c.built = new Set(r.builtLinks); c.builtRef = r.builtLinks; c.builtLen = r.builtLinks.length;
  }
  return c;
}

export function isLinked(state: SimState, c1: number, r1: number, c2: number, r2: number): boolean {
  const k = edgeKey(c1, r1, c2, r2);
  const l = links(state);
  return l.rail.has(k) || l.built.has(k);
}
export function isRail(state: SimState, c1: number, r1: number, c2: number, r2: number): boolean {
  return links(state).rail.has(edgeKey(c1, r1, c2, r2));
}
/** True if the tile has any pre-laid rail edge. */
export function tileHasRail(state: SimState, col: number, row: number): boolean {
  for (const [nc, nr] of neighbors(col, row)) if (isRail(state, col, row, nc, nr)) return true;
  return false;
}

export function planRange(state: SimState): number {
  let r = TRAIN.basePlanRange;
  for (const car of state.train.cars) if (car.hp > 0) r += CAR_DEFS[car.type].planRangeBonus;
  if (state.train.crew.some(c => c.specialty === 'surveyor' && c.carIndex >= 0)) r += 2;
  r += state.train.locoUpgrades?.crew ?? 0;
  if ((state.train.relics ?? []).includes('void_compass')) r += 1;
  return r;
}

export function trackCostBonus(state: SimState): number {
  let b = 0;
  for (const car of state.train.cars) if (car.hp > 0) b += CAR_DEFS[car.type].trackCostBonus;
  if (state.train.crew.some(c => c.specialty === 'surveyor' && c.carIndex >= 0)) b -= 1;
  return b;
}

/** Cost in rails to travel from (fc,fr) onto (col,row). */
export function edgeCost(state: SimState, fc: number, fr: number, col: number, row: number): { cost: number; free: boolean; blocked: string | null } {
  const t = tileAt(state, col, row);
  if (!t) return { cost: 0, free: false, blocked: 'Off the map' };
  if (t.void) return { cost: 0, free: false, blocked: 'Consumed by the void' };
  if (t.terrain === 'mountain') return { cost: 0, free: false, blocked: 'Mountains are impassable' };
  if (blockedTrack(state, [fc, fr], [col, row])) return { cost: 0, free: false, blocked: 'Barricade on this track · inspect from the near end or choose another route' };
  if (isLinked(state, fc, fr, col, row)) return { cost: 0, free: true, blocked: null };
  const base = TRACK_COST[t.terrain];
  const spike = (state.train.relics ?? []).includes('lucky_spike') && (t.terrain === 'plains' || t.terrain === 'ruins' || t.terrain === 'ash') ? -1 : 0;
  const cost = Math.max(1, base + trackCostBonus(state) + spike);
  return { cost, free: false, blocked: null };
}

export function pathEnd(state: SimState): [number, number] {
  const p = state.route.path;
  return p[p.length - 1];
}

export function aheadCount(state: SimState): number {
  return state.route.path.length - 1 - state.train.routeIndex;
}

export function plannableTiles(state: SimState): Array<{ col: number; row: number; cost: number; free: boolean }> {
  if (aheadCount(state) >= planRange(state)) return [];
  const p = state.route.path;
  const [ec, er] = pathEnd(state);
  const prev = p.length >= 2 ? p[p.length - 2] : null;
  const out: Array<{ col: number; row: number; cost: number; free: boolean }> = [];
  for (const [nc, nr] of neighbors(ec, er)) {
    if (prev && prev[0] === nc && prev[1] === nr) continue;
    if (isRevisit(state, nc, nr)) continue;
    const c = edgeCost(state, ec, er, nc, nr);
    if (c.blocked) continue;
    if (!c.free && state.train.resources.rails < c.cost) continue;
    out.push({ col: nc, row: nr, cost: c.cost, free: c.free });
  }
  return out;
}

/** A tile already occupied by the train or in the unreached plan cannot be planned again (except on the Maw loop). */
export function isRevisit(state: SimState, col: number, row: number): boolean {
  if (state.boss.active && state.boss.type === 'boss_maw') return false;
  const p = state.route.path;
  for (let i = Math.max(0, state.train.routeIndex - 1); i < p.length; i++) if (p[i][0] === col && p[i][1] === row) return true;
  return false;
}

export function previewPlan(state: SimState, col: number, row: number): PlanResult {
  if (state.train.reversing) return { ok: false, reason: 'Stop reversing first' };
  const [ec, er] = pathEnd(state);
  if (hexDistance(ec, er, col, row) !== 1) return { ok: false, reason: 'Not adjacent to the plan' };
  const p = state.route.path;
  const prev = p.length >= 2 ? p[p.length - 2] : null;
  if (prev && prev[0] === col && prev[1] === row) return { ok: false, reason: 'Cannot reverse' };
  if (isRevisit(state, col, row)) return { ok: false, reason: 'Already on the route' };
  if (aheadCount(state) >= planRange(state)) return { ok: false, reason: `Plan range ${planRange(state)} reached` };
  const c = edgeCost(state, ec, er, col, row);
  if (c.blocked) return { ok: false, reason: c.blocked };
  if (!c.free && state.train.resources.rails < c.cost) return { ok: false, reason: `Need ${c.cost} rails`, cost: c.cost };
  return { ok: true, cost: c.cost };
}

const blockedNotice = new WeakMap<SimState, { reason: string; at: number }>();

export function planTile(ctx: SimContext, col: number, row: number): PlanResult {
  const { state } = ctx;
  const pre = previewPlan(state, col, row);
  if (!pre.ok) {
    // notify the UI at most once per reason every 2.5 s (autopilot / auto-follow retries would otherwise spam)
    const last = blockedNotice.get(state);
    const reason = pre.reason ?? 'Blocked';
    if (!last || last.reason !== reason || state.time - last.at > 2.5) {
      blockedNotice.set(state, { reason, at: state.time });
      ctx.bus.defer('track:blocked', { reason });
    }
    return pre;
  }
  const [ec, er] = pathEnd(state);
  const cost = pre.cost ?? 0;
  if (cost > 0) {
    addResource(ctx, 'rails', -cost);
    state.route.builtLinks.push(edgeKey(ec, er, col, row));
    state.stats.railsLaid += cost;
  }
  state.route.path.push([col, row]);
  state.route.blocked = false;
  ctx.bus.defer('track:planned', { col, row, cost });
  if (state.train.stopReason === 'no_route' || state.train.stopReason === 'junction') {
    state.train.stopped = false; state.train.stopReason = 'none';
  }
  return { ok: true, cost };
}

export function unplanLast(ctx: SimContext): PlanResult {
  const { state } = ctx;
  const p = state.route.path;
  const t = state.train;
  const minIndex = t.routeIndex + (t.progress > 0 ? 1 : 0);
  if (p.length - 1 <= minIndex) return { ok: false, reason: 'Nothing to undo' };
  const last = p[p.length - 1];
  const prev = p[p.length - 2];
  const k = edgeKey(prev[0], prev[1], last[0], last[1]);
  let refund = 0;
  const bi = state.route.builtLinks.lastIndexOf(k);
  if (bi >= 0 && !links(state).rail.has(k)) {
    // refund only if the edge is not used elsewhere in the path
    let usedElsewhere = false;
    for (let i = 0; i + 2 < p.length; i++) if (edgeKey(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) === k) { usedElsewhere = true; break; }
    if (!usedElsewhere) {
      state.route.builtLinks.splice(bi, 1);
      const tile = tileAt(state, last[0], last[1]);
      refund = tile ? Math.max(1, TRACK_COST[tile.terrain] + trackCostBonus(state)) : 0;
      addResource(ctx, 'rails', refund);
      state.stats.railsLaid = Math.max(0, state.stats.railsLaid - refund);
    }
  }
  p.pop();
  ctx.bus.defer('track:unplanned', { col: last[0], row: last[1], refund });
  return { ok: true, cost: refund };
}

export function clearPlan(ctx: SimContext): void {
  let guard = 0;
  while (unplanLast(ctx).ok && guard++ < 500) { /* pop */ }
}

/** Find a forward route using ONLY existing rail (including track the player built).
 * Search the connected network, not just the visible planning range: a curved line
 * must not lose to a paid shortcut because its destination is farther than the plan. */
export function existingRailPath(state: SimState, col: number, row: number): Array<[number, number]> | null {
  const start = pathEnd(state), goalK = tileKey(col, row), startK = tileKey(...start);
  const queue: Array<[number, number]> = [start];
  const came = new Map<string, string | null>([[startK, null]]);
  for (let head = 0; head < queue.length; head++) {
    const [cc, cr] = queue[head];
    const current = tileKey(cc, cr);
    if (current === goalK) {
      const path: Array<[number, number]> = [];
      let k: string | null = current;
      while (k && k !== startK) {
        const [c, r] = k.split(',').map(Number); path.push([c, r]); k = came.get(k) ?? null;
      }
      return path.reverse();
    }
    for (const [nc, nr] of neighbors(cc, cr)) {
      const key = tileKey(nc, nr);
      if (came.has(key) || isRevisit(state, nc, nr) || !isLinked(state, cc, cr, nc, nr)) continue;
      if (edgeCost(state, cc, cr, nc, nr).blocked) continue;
      came.set(key, current); queue.push([nc, nr]);
    }
  }
  return null;
}

function appendSequence(ctx: SimContext, seq: Array<[number, number]>): PlanResult {
  let planned = 0, spent = 0;
  const available = planRange(ctx.state) - aheadCount(ctx.state);
  for (const [c, r] of seq.slice(0, Math.max(0, available))) {
    const result = planTile(ctx, c, r);
    if (!result.ok) return planned ? { ok: true, cost: spent } : result;
    planned++; spent += result.cost ?? 0;
  }
  return planned ? { ok: true, cost: spent } : { ok: false, reason: `Plan range ${planRange(ctx.state)} reached` };
}

/** Follow connected rail first; use affordable construction only when no rail route exists. */
export function planPathTo(ctx: SimContext, col: number, row: number): PlanResult {
  const { state } = ctx;
  const target = tileAt(state, col, row);
  if (!target) return { ok: false, reason: 'Off the map' };
  if (target.void || target.terrain === 'mountain') return { ok: false, reason: 'Unreachable tile' };
  const [sc, sr] = pathEnd(state);
  if (sc === col && sr === row) return { ok: false, reason: 'Already planned' };
  if (state.train.reversing) return { ok: false, reason: 'Stop reversing first' };
  if (aheadCount(state) >= planRange(state)) return { ok: false, reason: `Plan range ${planRange(state)} reached` };
  const railPath = existingRailPath(state, col, row);
  if (railPath) return appendSequence(ctx, railPath);
  const goalK = tileKey(col, row);
  const startK = tileKey(sc, sr);
  const g = new Map<string, number>([[startK, 0]]);
  const rails = new Map<string, number>([[startK, 0]]);
  const depths = new Map<string, number>([[startK, 0]]);
  const came = new Map<string, string>();
  const open: Array<{ k: string; f: number }> = [{ k: startK, f: 0 }];
  const closed = new Set<string>();
  const budget = state.train.resources.rails;
  const maxSteps = planRange(state) - aheadCount(state) + 12; // search beyond range; we plan what fits
  const prevTile = state.route.path.length >= 2 ? state.route.path[state.route.path.length - 2] : null;
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.k === goalK) { found = true; break; }
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const [cc, cr] = cur.k.split(',').map(Number);
    const depth = depths.get(cur.k) ?? 0;
    if (depth >= maxSteps) continue;
    for (const [nc, nr] of neighbors(cc, cr)) {
      if (cur.k === startK && prevTile && prevTile[0] === nc && prevTile[1] === nr) continue;
      if (isRevisit(state, nc, nr)) continue;
      const e = edgeCost(state, cc, cr, nc, nr);
      if (e.blocked) continue;
      const nk = tileKey(nc, nr);
      const spentRails = (rails.get(cur.k) ?? 0) + e.cost;
      if (spentRails > budget) continue;
      // cost: 1000 per step (depth) + rails weight so free rail is preferred
      const ng = (g.get(cur.k) ?? 0) + 1000 + e.cost * 350 + (e.free ? 0 : 120);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); rails.set(nk, spentRails); depths.set(nk, depth + 1); came.set(nk, cur.k);
        open.push({ k: nk, f: ng + hexDistance(nc, nr, col, row) * 1000 });
      }
    }
  }
  if (!found) return { ok: false, reason: 'No affordable route' };
  const seq: Array<[number, number]> = [];
  let k: string | undefined = goalK;
  while (k && k !== startK) { const [c, r] = k.split(',').map(Number); seq.push([c, r]); k = came.get(k); }
  seq.reverse();
  return appendSequence(ctx, seq);
}

/**
 * When the plan runs out on pre-laid rail with exactly one forward continuation, extend it automatically.
 * Returns true if a tile was appended. At junctions (2+ options) it stops and reports 'junction'.
 */
export function autoFollow(ctx: SimContext): 'extended' | 'junction' | 'none' {
  const { state } = ctx;
  const p = state.route.path;
  const [ec, er] = pathEnd(state);
  const prev = p.length >= 2 ? p[p.length - 2] : null;
  const opts: Array<[number, number]> = [];
  for (const [nc, nr] of neighbors(ec, er)) {
    if (prev && prev[0] === nc && prev[1] === nr) continue;
    if (!isRail(state, ec, er, nc, nr)) continue;
    if (blockedTrack(state, [ec, er], [nc, nr])) continue;
    if (isRevisit(state, nc, nr)) continue;
    const t = tileAt(state, nc, nr);
    if (!t || t.void) continue;
    // avoid the maw loop bouncing: prefer eastward tiles first
    opts.push([nc, nr]);
  }
  if (opts.length === 1) {
    const r = planTile(ctx, opts[0][0], opts[0][1]);
    if (r.ok) { ctx.bus.defer('track:autofollow', { col: opts[0][0], row: opts[0][1] }); return 'extended'; }
    return 'none';
  }
  if (opts.length >= 2) return 'junction';
  return 'none';
}

export function maxCars(): number { return MAX_CARS; }

export function logRoute(ctx: SimContext, text: string): void { log(ctx.state, text); }


/** Rail continuations at the plan end, with their line and the next settlement along each branch. */
export interface RailBranch {
  col: number; row: number; line: number; lineName: string;
  /** Actual connected rail tiles, including the junction and advertised destination. */
  trace: Array<[number, number]>;
  next: { id: string; name: string; type: string; distance: number } | null;
}
export function junctionOptions(state: SimState): RailBranch[] {
  const p = state.route.path;
  if (!p.length) return [];
  const [ec, er] = pathEnd(state);
  const prev = p.length >= 2 ? p[p.length - 2] : null;
  const out: RailBranch[] = [];
  const lines = state.route.railLines ?? {};
  for (const [nc, nr] of neighbors(ec, er)) {
    if (prev && prev[0] === nc && prev[1] === nr) continue;
    if (!isRail(state, ec, er, nc, nr)) continue;
    if (blockedTrack(state, [ec, er], [nc, nr])) continue;
    if (isRevisit(state, nc, nr)) continue;
    const t = tileAt(state, nc, nr);
    if (!t || t.void) continue;
    const line = lines[edgeKey(ec, er, nc, nr)] ?? 0;
    // walk the branch until a settlement, a junction or 40 steps
    let cur: [number, number] = [nc, nr];
    let from: [number, number] = [ec, er];
    const trace: Array<[number, number]> = [[ec, er]];
    const seen = new Set([tileKey(ec, er)]);
    let next: { id: string; name: string; type: string; distance: number } | null = null;
    for (let step = 1; step <= 40; step++) {
      trace.push(cur);
      seen.add(tileKey(cur[0], cur[1]));
      const tile = tileAt(state, cur[0], cur[1]);
      if (tile?.settlementId) {
        const st = state.settlements.find(x => x.id === tile.settlementId);
        if (st && !st.consumed && (!st.visited || st.type === 'yard')) { next = { id: st.id, name: st.name, type: st.type, distance: step }; break; }
      }
      let conts = neighbors(cur[0], cur[1]).filter(([c, r]) => !seen.has(tileKey(c, r)) && !(c === from[0] && r === from[1]) && !tileAt(state, c, r)?.void && isRail(state, cur[0], cur[1], c, r) && !blockedTrack(state, cur, [c, r]));
      if (conts.length === 0) break;
      if (conts.length > 1) {
        // at a junction prefer continuations that carry this branch's line id, then the east-most one
        const same = conts.filter(([c, r]) => (lines[edgeKey(cur[0], cur[1], c, r)] ?? -1) === line);
        const pool = same.length ? same : conts;
        pool.sort((p1, p2) => p2[0] - p1[0]);
        conts = [pool[0]];
      }
      from = cur; cur = conts[0];
    }
    out.push({ col: nc, row: nr, line, lineName: LINE_NAMES[line] ?? 'Line', trace, next });
  }
  return out;
}
