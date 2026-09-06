import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { edgeKey } from '../core/hex';
import { VOID } from '../core/config';
import { blockedTrack, nearbyTrackEncounter, trackEncounterEvent } from '../core/trackEncounters';
import { createSim } from './sim';
import { junctionOptions, existingRailPath, isLinked } from './route';
import { updateMovement, computeTrail } from './train';
import { settleTrackAttempt } from './trackEncounters';
import { expeditionVoidCost } from './expedition';

type Point = [number, number];
const approach: Point[] = Array.from({ length: 8 }, (_, i) => [10, 20 - i]);
const from = approach.at(-1)!;
const to: Point = [10, 12];
function fixture(hp = 100) {
  const sim = createSim(12345, new EventBus()), s = sim.state;
  s.route.path = structuredClone(approach); s.train.routeIndex = approach.length - 1; s.train.progress = 0;
  s.route.railLinks = [...approach, to].slice(1).map((p, i) => edgeKey(...[...approach, to][i], ...p));
  s.route.builtLinks = [];
  for (const t of s.tiles) { t.terrain = 'plains'; t.void = false; t.settlementId = null; }
  s.train.crew[0].hp = hp;
  s.train.crew.push({ id: 'test-gunner', name: 'Nils', specialty: 'gunner', hp, carIndex: -1 }, { id: 'test-medic', name: 'Ines', specialty: 'medic', hp, carIndex: -1 });
  computeTrail(s);
  return sim;
}
function context(sim: ReturnType<typeof createSim>, dt = .05) {
  return { state: sim.state, bus: sim.bus, dt, invulnerable: false, rng: { world: new Rng(1), waves: new Rng(2), events: new Rng(3), combat: new Rng(4) } };
}
function arm(sim: ReturnType<typeof createSim>) {
  expect(sim.debug.placeTrackAmbush(from, to)).toBeTruthy();
  return sim.state.route.encounters![0];
}
function start(sim: ReturnType<typeof createSim>) {
  expect(sim.inspectTrackEncounter()).toBe(true);
  expect(sim.chooseEventOption(0)).toBe(true);
  expect(sim.startExpedition(sim.state.train.crew.map(c => c.id))).toBe(true);
}
function restore(sim: ReturnType<typeof createSim>) {
  const copy = createSim(1, new EventBus());
  expect(copy.restore(sim.serialize())).toBe(true);
  return copy;
}
function play(sim: ReturnType<typeof createSim>, stopAtGate = false) {
  for (let n = 0; n < 200 && !sim.state.expedition?.outcome; n++) {
    const x = sim.state.expedition!;
    if (x.awaitingAdvance) { if (stopAtGate) return; sim.advanceExpedition(true); }
    else if (x.pending) sim.expeditionResolve('good');
    else sim.expeditionAction('strike');
  }
}

describe('opt-in blocked-track encounter contract', () => {
  it('does not populate ordinary worlds or require a save migration', () => {
    const sim = createSim(1, new EventBus());
    expect(sim.state.route.encounters).toBeUndefined();
    expect(restore(sim).state.route.encounters).toBeUndefined();
  });
  it('blocks one undirected edge without removing its rail or charging resources', () => {
    const sim = fixture(), s = sim.state, rails = s.train.resources.rails;
    arm(sim);
    expect(blockedTrack(s, from, to)).toBe(blockedTrack(s, to, from));
    expect(isLinked(s, ...from, ...to)).toBe(true);
    const before = sim.serialize();
    expect(sim.previewPlan(...to).ok).toBe(false);
    expect(sim.planTile(...to).ok).toBe(false);
    expect(s.train.resources.rails).toBe(rails);
    expect(JSON.parse(sim.serialize()).state).toEqual(JSON.parse(before).state);
    expect(junctionOptions(s)).toHaveLength(0);
    expect(existingRailPath(s, ...to)).toBeNull();
  });
  it('can follow a separate existing route around the obstruction without construction', () => {
    const sim = fixture(), s = sim.state;
    const detour: Point[] = [from, [11, 13], [11, 12], to];
    s.route.railLinks.push(...detour.slice(1).map((p, i) => edgeKey(...detour[i], ...p)));
    arm(sim);
    expect(sim.planPathTo(...to)).toEqual({ ok: true, cost: 0 });
    expect(s.route.path.slice(-3)).toEqual(detour.slice(1));
    expect(s.route.builtLinks).toHaveLength(0);
  });
  it('rejects invalid, duplicate, non-rail and occupied edges without mutating state', () => {
    const sim = fixture(); arm(sim);
    const before = sim.serialize();
    for (const [a, b] of [[from, to], [from, [10, 5]], [[-1, 3], [0, 3]], [from, [11, 13]], [approach[1], approach[2]]] as [Point, Point][]) expect(sim.debug.placeTrackAmbush(a, b)).toBeNull();
    expect(JSON.parse(sim.serialize()).state).toEqual(JSON.parse(before).state);
  });
  it('rejects placement on an edge the locomotive has already entered', () => {
    const sim = fixture(); sim.planTile(...to); sim.state.train.progress = .2;
    expect(sim.debug.placeTrackAmbush(from, to)).toBeNull();
  });
  it('can inspect from the far endpoint and rejects an old attempt ticket or early clear', () => {
    const sim = fixture(); const e = arm(sim);
    sim.state.route.path = [to]; sim.state.train.routeIndex = 0;
    expect(sim.inspectTrackEncounter()).toBe(true);
    sim.chooseEventOption(0); sim.startExpedition(sim.state.train.crew.map(c => c.id));
    const x = sim.state.expedition!;
    x.outcome = 'won';
    expect(settleTrackAttempt(context(sim), x)).toBe(false);
    x.outcome = 'fled';
    x.trackAttempt!.attempt = 0;
    expect(settleTrackAttempt(context(sim), x)).toBe(false);
    expect(e.settledAttempt).toBe(0);
    expect(e.status).toBe('blocked');
  });
  it('a barricade at the current anchor consumes no fictitious travel or fuel', () => {
    const sim = fixture(), s = sim.state; sim.planTile(...to); arm(sim);
    const fuel = s.train.resources.coal, distance = s.train.distanceTravelled;
    updateMovement(context(sim), () => {});
    expect(s.phase).toBe('event');
    expect(s.train.distanceTravelled).toBe(distance);
    expect(s.train.resources.coal).toBe(fuel);
  });
  it('stops an already-planned train at the near end and keeps the consist on its approach', () => {
    const sim = fixture(), s = sim.state;
    sim.planTile(...to); arm(sim);
    s.train.routeIndex--; s.train.progress = .99; s.train.stopped = false; s.train.speed = .8;
    const entered: Point[] = [];
    updateMovement(context(sim), (c, r) => entered.push([c, r]));
    expect(s.train.routeIndex).toBe(approach.length - 1);
    expect(s.train.progress).toBe(0);
    expect(s.phase).toBe('event');
    expect(entered).toEqual([from]);
    expect(s.train.trailX).toHaveLength(6);
    const expected = fixture().state.train;
    expect(s.train.trailX).toEqual(expected.trailX);
    expect(s.train.trailY).toEqual(expected.trailY);
  });
  it('cancel/stay aboard are free, leave the blockade and do not auto-reopen it', () => {
    const sim = fixture(); sim.planTile(...to); const e = arm(sim);
    expect(sim.inspectTrackEncounter()).toBe(true);
    const front = [...sim.state.void.front], resources = { ...sim.state.train.resources };
    sim.chooseEventOption(0); expect(sim.cancelExpeditionPreparation()).toBe(true);
    expect(e.attempts).toBe(0);
    expect(sim.chooseEventOption(1)).toBe(true);
    expect(sim.state.route.path).toEqual(approach);
    expect(sim.state.void.front).toEqual(front);
    expect(sim.state.train.resources).toEqual(resources);
    updateMovement(context(sim), () => {});
    expect(sim.state.phase).toBe('running');
    expect(nearbyTrackEncounter(sim.state)?.id).toBe(e.id);
    expect(sim.inspectTrackEncounter()).toBe(true);
  });
  it('saves preparation as an unspent decision; low-health crew retain the exit', () => {
    let sim = fixture(); arm(sim); sim.inspectTrackEncounter(); sim.chooseEventOption(0);
    sim = restore(sim);
    expect(sim.state.activeEvent?.preparingExpedition).toBe(false);
    expect(sim.state.route.encounters![0].attempts).toBe(0);
    sim.state.train.crew.forEach(c => c.hp = 20);
    expect(sim.chooseEventOption(0)).toBe(false);
    expect(sim.chooseEventOption(1)).toBe(true);
  });
  it('withdrawal charges once, preserves wounds and restarts enemies on re-entry', () => {
    let sim = fixture(55); arm(sim); start(sim);
    sim.state.expedition!.actors[0].hp = 31;
    const front = sim.state.void.front[0];
    sim.expeditionAction('flee'); sim = restore(sim);
    expect(sim.state.void.front[0] - front).toBeCloseTo(VOID.baseSpeed * expeditionVoidCost(0));
    expect(sim.state.train.crew[0].hp).toBe(31);
    expect(sim.state.route.encounters![0].status).toBe('blocked');
    expect(sim.endExpedition()).toBe(true);
    expect(trackEncounterEvent(sim.state).options[0].label).toContain('another attempt');
    sim.chooseEventOption(0); sim.startExpedition(sim.state.train.crew.map(c => c.id));
    expect(sim.state.expedition!.actors[0].hp).toBe(31);
    expect(sim.state.expedition!.stage).toBe(1);
    expect(sim.state.expedition!.foes.every(f => f.hp === f.maxHp)).toBe(true);
    expect(sim.state.expedition!.trackAttempt?.attempt).toBe(2);
  });
  it('a partial clear or defeat does not open the track or grant rewards', () => {
    const sim = fixture(); const e = arm(sim); start(sim); play(sim, true);
    expect(sim.state.expedition!.awaitingAdvance).toBe(true);
    expect(e.status).toBe('blocked');
    sim.advanceExpedition(false);
    expect(sim.state.train.marks).toBe(0);
    expect(e.status).toBe('blocked');
    sim.endExpedition(); sim.chooseEventOption(0); sim.startExpedition(sim.state.train.crew.map(c => c.id));
    const x = sim.state.expedition!;
    x.actors.forEach(a => { a.hp = 1; a.down = false; });
    x.foes[0].atk = 100; // failure fixture only, not balance evidence
    play(sim);
    expect(x.outcome).toBe('lost');
    expect(e.status).toBe('blocked');
    expect(e.settledAttempt).toBe(2);
  });
  it.each([100, 45])('two ordinary stages complete on Good timing at %s starting HP; save/result/relic are single-award', hp => {
    let sim = fixture(hp); arm(sim); start(sim); play(sim, true);
    sim = restore(sim); play(sim);
    const x = sim.state.expedition!;
    expect(x.outcome).toBe('won');
    expect(sim.state.route.encounters![0].status).toBe('cleared');
    expect(sim.previewPlan(...to).ok).toBe(true);
    const snapshot = sim.serialize();
    expect(settleTrackAttempt(context(sim), x)).toBe(false);
    expect(JSON.parse(sim.serialize()).state).toEqual(JSON.parse(snapshot).state);
    sim = restore(sim);
    const marks = sim.state.train.marks, front = [...sim.state.void.front];
    expect(sim.endExpedition()).toBe(true);
    expect(sim.endExpedition()).toBe(false);
    sim = restore(sim);
    expect(sim.chooseRelic(0)).toBe(true);
    expect(sim.chooseRelic(0)).toBe(false);
    expect(sim.state.phase).toBe('running');
    expect(sim.state.train.marks).toBe(marks);
    expect(sim.state.void.front).toEqual(front);
    expect(sim.inspectTrackEncounter()).toBe(false);
  });
});
