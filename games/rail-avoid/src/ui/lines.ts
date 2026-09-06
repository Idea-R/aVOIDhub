/**
 * Rail-line presentation helpers (Plan 3 — Three Lines): colours, flavour lines, the line an edge / settlement / the
 * locomotive sits on, and a defensive junction-option reader. Everything here tolerates a world without `railLines`
 * (empty record) and a sim without `junctionOptions()` — it then falls back to walking `railLinks` itself.
 */
import type { SimState, Settlement } from '../core/types';
import type { SimApi } from '../sim/api';
import { LINE_NAMES, LINE_COLORS } from '../core/config';
import { edgeKey, neighbors, tileKey } from '../core/hex';

/** One-line character of each line (index = line id; 3 = crossover). */
export const LINE_FLAVOUR = ['balanced', 'rich · dangerous', 'passengers · calm', 'crossover'];
/** Short key for CSS / data attributes. */
export const LINE_KEYS = ['central', 'northern', 'southern', 'cross'];

/** Line id for "track the player laid" (not a pre-laid line). */
export const LINE_BUILT = -1;
/** Line id for pre-laid rail whose line is unknown (railLines not populated yet). */
export const LINE_UNKNOWN = -2;

export function lineName(id: number): string {
  if (id === LINE_BUILT) return 'Your track';
  if (id === LINE_UNKNOWN) return 'Old rail';
  return LINE_NAMES[id] ?? 'Rail line';
}
export function lineFlavour(id: number): string {
  if (id === LINE_BUILT) return 'cut by hand';
  if (id === LINE_UNKNOWN) return '';
  return LINE_FLAVOUR[id] ?? '';
}
/** CSS colour for a line id (built track = gold, unknown = neutral). */
export function lineCss(id: number): string {
  if (id === LINE_BUILT) return '#e8c170';
  const c = LINE_COLORS[id];
  if (typeof c !== 'number') return '#9aa3b8';
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}
export function lineKey(id: number): string {
  if (id === LINE_BUILT) return 'built';
  return LINE_KEYS[id] ?? 'unknown';
}

/** Line id of the edge a→b: railLines entry, LINE_BUILT for player track, LINE_UNKNOWN for unlabelled rail, null when no link. */
export function lineOfEdge(s: SimState, a: [number, number], b: [number, number]): number | null {
  const k = edgeKey(a[0], a[1], b[0], b[1]);
  const lines = s.route.railLines;
  if (lines && typeof lines[k] === 'number') return lines[k];
  if (s.route.builtLinks && s.route.builtLinks.includes(k)) return LINE_BUILT;
  if (s.route.railLinks && s.route.railLinks.includes(k)) return LINE_UNKNOWN;
  return null;
}

/** Line the locomotive is currently on: the edge behind it (path[routeIndex-1] → path[routeIndex]); null with no edge. */
export function currentLine(s: SimState): number | null {
  const p = s.route.path;
  if (!p || p.length < 2) return null;
  const i = Math.min(Math.max(1, s.train.routeIndex), p.length - 1);
  const a = p[i - 1], b = p[i];
  if (!a || !b) return null;
  return lineOfEdge(s, a, b);
}

/** Most common main-line id among pre-laid rail edges touching the settlement tile; null when none is labelled. */
export function settlementLine(s: SimState, st: Pick<Settlement, 'col' | 'row'>): number | null {
  const lines = s.route.railLines;
  if (!lines) return null;
  const counts = new Map<number, number>();
  for (const [nc, nr] of neighbors(st.col, st.row)) {
    const id = lines[edgeKey(st.col, st.row, nc, nr)];
    if (typeof id !== 'number') continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (!counts.size) return null;
  let best = -1, bestN = -1;
  // main lines win ties over crossovers (3) so a crossover stop still reads as the line it sits on
  for (const [id, n] of counts) if (n > bestN || (n === bestN && id < best)) { best = id; bestN = n; }
  return best;
}

export interface JunctionOption {
  col: number; row: number;
  trace?: Array<[number, number]>;
  line: number;
  lineName: string;
  next: { id: string; name: string; type: string; distance: number } | null;
}

/** Walk pre-laid rail from `start` (never back through `from`) and report the first settlement met. */
function nextSettlementAlong(s: SimState, from: [number, number], start: [number, number], maxDepth = 48): JunctionOption['next'] {
  const rail = new Set(s.route.railLinks ?? []);
  const seen = new Set<string>([tileKey(from[0], from[1]), tileKey(start[0], start[1])]);
  let frontier: Array<[number, number]> = [start];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const nextFrontier: Array<[number, number]> = [];
    for (const [c, r] of frontier) {
      const t = s.tiles[r * s.mapW + c];
      if (!t || t.void) continue;
      if (t.settlementId) {
        const st = s.settlements.find(x => x.id === t.settlementId);
        if (st && !st.consumed) return { id: st.id, name: st.name, type: st.type, distance: depth };
      }
      for (const [nc, nr] of neighbors(c, r)) {
        const k = tileKey(nc, nr);
        if (seen.has(k) || !rail.has(edgeKey(c, r, nc, nr))) continue;
        seen.add(k);
        nextFrontier.push([nc, nr]);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

/** Fallback for sims that do not implement junctionOptions(): rail continuations at the plan end. */
export function fallbackJunctionOptions(s: SimState): JunctionOption[] {
  const p = s.route.path;
  if (!p || !p.length) return [];
  const end = p[p.length - 1];
  const prev = p.length >= 2 ? p[p.length - 2] : null;
  const onPath = new Set(p.map(([c, r]) => tileKey(c, r)));
  const out: JunctionOption[] = [];
  for (const [nc, nr] of neighbors(end[0], end[1])) {
    if (prev && prev[0] === nc && prev[1] === nr) continue;
    if (onPath.has(tileKey(nc, nr))) continue;
    const t = s.tiles[nr * s.mapW + nc];
    if (!t || t.void) continue;
    const line = lineOfEdge(s, end, [nc, nr]);
    if (line === null || line === LINE_BUILT) continue;
    out.push({ col: nc, row: nr, line, lineName: lineName(line), next: nextSettlementAlong(s, end, [nc, nr]) });
  }
  return out;
}

/** Junction options from the sim when it provides them, else computed locally. Never throws. */
export function readJunctionOptions(sim: SimApi | null, s: SimState | null): JunctionOption[] {
  if (!s) return [];
  const fn = (sim as unknown as { junctionOptions?: () => JunctionOption[] } | null)?.junctionOptions;
  if (sim && typeof fn === 'function') {
    try {
      const opts = fn.call(sim);
      if (Array.isArray(opts)) {
        const end = s.route.path[s.route.path.length - 1];
        return opts.filter(o => o && Number.isFinite(o.col) && Number.isFinite(o.row)).map(o => {
          const line = typeof o.line === 'number' ? o.line : LINE_UNKNOWN;
          // the sim may not resolve a next stop on crossovers; walk the rail ourselves before calling it a dead end
          let next = o.next ?? null;
          if (!next && !o.trace && end) { try { next = nextSettlementAlong(s, end, [o.col, o.row]); } catch { next = null; } }
          return { col: o.col, row: o.row, line, lineName: o.lineName || lineName(line), trace: o.trace, next };
        });
      }
    } catch { /* fall through to the local reader */ }
  }
  try { return fallbackJunctionOptions(s); } catch { return []; }
}
