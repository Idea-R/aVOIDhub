import { describe, it, expect } from 'vitest';
import { createSim } from './sim';
import { EventBus } from '../core/events';
import { edgeKey } from '../core/hex';
import { existingRailPath, junctionOptions } from './route';

type Point = [number, number];
const curve: Point[] = [[10, 10], [10, 9], [11, 9], [12, 9], [11, 10]];
function fixture(points: Point[] = curve, built = false) {
  const sim = createSim(12345, new EventBus()), s = sim.state;
  s.route.path = [points[0]]; s.train.routeIndex = 0; s.train.progress = 0;
  s.route.railLinks = []; s.route.builtLinks = []; s.train.resources.rails = 20;
  for (const t of s.tiles) { t.terrain = 'plains'; t.void = false; }
  const edges = points.slice(1).map((p, i) => edgeKey(...points[i], ...p));
  if (built) s.route.builtLinks = edges; else s.route.railLinks = edges;
  return sim;
}
describe('rail-first destination planning', () => {
  it('exports the actual bent rail trace without mutating the route', () => {
    const sim = fixture(), s = sim.state;
    for (const tile of s.tiles) tile.settlementId = null;
    const before = JSON.stringify(s.route);
    const branch = junctionOptions(s).find(b => b.col === curve[1][0] && b.row === curve[1][1]);
    expect(branch?.trace).toEqual(curve);
    expect(JSON.stringify(s.route)).toBe(before);
  });
  it('never includes a void tile or repeats a tile in the displayed rail trace', () => {
    const sim = fixture(), s = sim.state;
    for (const tile of s.tiles) tile.settlementId = null;
    s.route.railLinks.push(edgeKey(...curve.at(-1)!, ...curve[0]));
    for (const branch of junctionOptions(s)) {
      expect(new Set(branch.trace.map(p => p.join(','))).size).toBe(branch.trace.length);
    }
    s.tiles[9 * s.mapW + 11].void = true;
    expect(junctionOptions(s).every(b => b.trace.every(([c,r]) => !s.tiles[r*s.mapW+c].void))).toBe(true);
  });
  it.each([false, true])('follows a curve instead of building an adjacent shortcut (built=%s)', built => {
    const sim = fixture(curve, built), s = sim.state;
    const before = s.train.resources.rails;
    expect(sim.planPathTo(...curve.at(-1)!)).toEqual({ ok: true, cost: 0 });
    expect(s.route.path).toEqual(curve);
    expect(s.train.resources.rails).toBe(before);
    expect(s.stats.railsLaid).toBe(0);
  });
  it('finds rail beyond planning range and only appends the in-range prefix', () => {
    const long: Point[] = Array.from({ length: 28 }, (_, i) => [15, 30 - i]);
    const sim = fixture(long), s = sim.state;
    s.train.resources.rails = 0;
    expect(sim.planPathTo(...long.at(-1)!)).toEqual({ ok: true, cost: 0 });
    expect(s.route.path).toEqual(long.slice(0, sim.currentPlanRange() + 1));
    expect(s.route.builtLinks).toHaveLength(0);
  });
  it('constructs an affordable link only when the target is disconnected', () => {
    const sim = fixture(), s = sim.state;
    s.route.railLinks = [];
    expect(sim.planPathTo(11, 10)).toEqual({ ok: true, cost: 1 });
    expect(s.route.builtLinks).toEqual([edgeKey(10, 10, 11, 10)]);
    expect(s.train.resources.rails).toBe(19);
  });
  it('does not route through void or mountains on an existing line', () => {
    const sim = fixture(), s = sim.state;
    s.tiles[9 * s.mapW + 10].void = true;
    expect(existingRailPath(s, 11, 10)).toBeNull();
    s.tiles[9 * s.mapW + 10].void = false;
    s.tiles[9 * s.mapW + 10].terrain = 'mountain';
    expect(existingRailPath(s, 11, 10)).toBeNull();
  });
  it('does not reverse into the occupied route, and fails safely without rails', () => {
    const sim = fixture(), s = sim.state;
    s.route.path = [[10, 9], [10, 10]]; s.train.routeIndex = 1;
    s.train.resources.rails = 0;
    const before = JSON.stringify(s.route);
    expect(sim.planPathTo(11, 10).ok).toBe(false);
    expect(JSON.stringify(s.route)).toBe(before);
  });
  it('does not mutate the route when reversing or at the planning limit', () => {
    const sim = fixture();
    sim.state.train.reversing = true;
    expect(sim.planPathTo(11, 10).reason).toBe('Stop reversing first');
    expect(sim.state.route.path).toHaveLength(1);
    sim.state.train.reversing = false;
    sim.state.route.path = Array.from({ length: sim.currentPlanRange() + 1 }, (_, i) => [10, 20 - i]);
    const before = JSON.stringify(sim.state.route);
    expect(sim.planPathTo(11, 10).ok).toBe(false);
    expect(JSON.stringify(sim.state.route)).toBe(before);
  });
});
