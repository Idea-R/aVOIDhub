import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NEUTRAL, RULES, createMatch, step, type Input, type MatchState, type Seat } from '@avoid/boomerangavoid-sim';
import { InputBuffer, type InputCommand, type Snapshot } from '@avoid/boomerangavoid-protocol';
import { MAX_PREDICTION_TICKS, elapsedTicks, interpolateRemote, predictMovement, snapshotIsOrdered, unacknowledged } from '../src/prediction';

const seats: Seat[] = [
  { id: 'a', name: 'A', character: 'pip', color: 1, team: 0, bot: null },
  { id: 'b', name: 'B', character: 'kiln', color: 2, team: 1, bot: null },
];
function game(): MatchState {
  const state = createMatch({ mode: 'ffa', wins: 3, mapId: 'moss-court', seed: 1, friendlyFire: false, upgrades: false }, seats);
  state.phase = 'playing'; state.tick = state.roundStart = 200;
  Object.assign(state.players[0]!, { x: -4, y: -6 });
  Object.assign(state.players[1]!, { x: 4, y: 6 });
  step(state);
  return state;
}
const command = (state: MatchState, seatId: string, sequence: number, offset: number, fields: Partial<Input>): InputCommand =>
  ({ ...NEUTRAL, seatId, sequence, round: state.round, tick: state.tick + offset, ...fields });

test('wall time maps 30Hz packets to 60Hz steps and bounds stalled/backward clocks', () => {
  assert.equal(elapsedTicks(100, 100 + 1000 / 30), 2);
  assert.equal(elapsedTicks(100, 100 + 1000 / 20), 3);
  assert.equal(elapsedTicks(100, 100 + 1000 / 10), 6);
  assert.equal(elapsedTicks(100, 1000000), MAX_PREDICTION_TICKS);
  assert.equal(elapsedTicks(100, 99), 0);
  assert.equal(elapsedTicks(100, NaN), 0);
});

test('three 30Hz samples predict six ticks with the same sample/hold timing as authoritative InputBuffer', () => {
  const state = game();
  const batches = [0, 2, 4].map((tick, n) => [
    command(state, 'a', n * 2 + 1, tick, { mx: 0.8, my: 0.1 }),
    command(state, 'b', n * 2 + 2, tick, { mx: -0.25, my: -0.5 }),
  ]);
  const buffer = new InputBuffer();
  for (const batch of batches) for (const c of batch) assert.equal(buffer.enqueue(c, ['a', 'b'], state.tick, state.round), true);
  const authority = structuredClone(state);
  for (let n = 0; n < 6; n++) {
    const inputs = Object.fromEntries(['a', 'b'].map(id => [id, buffer.consume(id, authority.tick)]));
    step(authority, inputs);
  }
  const before = structuredClone(state);
  const view = predictMovement(state, batches, ['a', 'b'], elapsedTicks(0, 100));
  for (const id of ['a', 'b']) {
    const expected = authority.players.find(p => p.id === id)!, actual = view.players.find(p => p.id === id)!;
    for (const key of ['x', 'y', 'vx', 'vy', 'fx', 'fy'] as const) assert.equal(actual[key], expected[key]);
  }
  assert.deepEqual(state, before, 'prediction never mutates authority');
  const oldPacketReplay = structuredClone(state);
  for (const batch of batches) step(oldPacketReplay, Object.fromEntries(batch.map(c => [c.seatId, c])));
  assert.ok(view.players[0]!.x - oldPacketReplay.players[0]!.x > 0.1, 'the old one-step-per-packet path under-predicts real travel');
});

test('commands arriving on different ticks and at the same tick retain server ordering and edges', () => {
  const state = game();
  const batches = [[command(state, 'a', 1, 0, { mx: 1, dash: true })],
    [command(state, 'a', 2, 0, { mx: 1 })], [command(state, 'a', 3, 4, { mx: 0, my: 1, dash: true })]];
  const buffer = new InputBuffer();
  for (const [c] of batches) buffer.enqueue(c!, ['a'], state.tick, state.round);
  const authority = structuredClone(state);
  for (let n = 0; n < 6; n++) step(authority, { a: buffer.consume('a', authority.tick) });
  const view = predictMovement(state, batches, ['a'], 6);
  assert.equal(view.players[0]!.x, authority.players[0]!.x);
  assert.equal(view.players[0]!.y, authority.players[0]!.y);
  assert.equal(view.players[0]!.dashUntil - view.tick, authority.players[0]!.dashUntil - authority.tick);
});

test('per-seat acknowledgements discard acknowledged actions even when a sibling command remains pending', () => {
  const state = game();
  const batches = [[command(state, 'a', 1, 0, { dash: true, mx: 1 }), command(state, 'b', 2, 0, { mx: 1 })]];
  const remaining = unacknowledged(batches, { a: 1, b: -1 }, state.round, ['a', 'b']);
  assert.deepEqual(remaining.map(batch => batch.map(c => c.seatId)), [['b']]);
  const view = predictMovement(state, remaining, ['a', 'b'], 6);
  assert.equal(view.players[0]!.x, state.players[0]!.x, 'an acknowledged dash must not reappear');
  assert.ok(view.players[1]!.x > state.players[1]!.x);
  assert.deepEqual(unacknowledged(batches, {}, state.round + 1, ['a', 'b']), []);
  assert.deepEqual(unacknowledged(batches, {}, state.round, ['foreign']), []);
});

test('acknowledged held movement continues smoothly between snapshots without replaying held dash or throw', () => {
  const state = game();
  const p = state.players[0]!;
  p.vx = RULES.runSpeed; p.dashUntil = state.tick + 2; p.dashCooldown = state.tick;
  state.internal!.controls.a!.previous = { ...NEUTRAL, mx: 1, dash: true, throw: true };
  const view = predictMovement(state, [], ['a'], 6);
  assert.equal(view.players[0]!.dashUntil, view.tick, 'held dash does not gain a fresh edge after ending');
  assert.ok(view.players[0]!.x > p.x);
  assert.deepEqual(view.weapons, state.weapons);
  assert.deepEqual(view.internal, state.internal);
  assert.equal(view.players[0]!.throwAt, p.throwAt);
});

test('prediction keeps combat/results/remote seats authoritative and ignores old rounds, future inputs and catch-up beyond six ticks', () => {
  const state = game();
  const batches = [[command(state, 'a', 1, 0, { mx: 1, throw: true, slash: true })],
    [{ ...command(state, 'a', 2, 2, { mx: -1 }), round: state.round - 1 }]];
  const view = predictMovement(state, batches, ['a'], 10000);
  assert.deepEqual(view, predictMovement(state, batches, ['a'], 6));
  assert.deepEqual(view.players[1], state.players[1]);
  for (const key of ['weapons', 'events', 'effects', 'relay', 'phase', 'tick', 'winnerIds', 'matchWinnerIds'] as const)
    assert.deepEqual(view[key], state[key]);
  assert.equal(view.players[0]!.slashUntil, state.players[0]!.slashUntil);
  const future = predictMovement(state, [[command(state, 'a', 4, 7, { mx: 1 })]], ['a'], 6);
  assert.equal(future.players[0]!.x, state.players[0]!.x);
  state.phase = 'countdown';
  assert.deepEqual(predictMovement(state, batches, ['a'], 6), state);
});

test('remote interpolation respects ownership and skips old rounds, stale/discontinuous or eliminated state', () => {
  const current = game(), prior = structuredClone(current);
  current.tick += 3; current.players[1]!.x += 0.5;
  const half = interpolateRemote(current, prior, ['a'], 50, 100, 125);
  assert.equal(half.players[1]!.x, prior.players[1]!.x + 0.25);
  assert.deepEqual(half.players[0], current.players[0]);
  for (const old of [null, { ...prior, round: prior.round + 1 }, { ...prior, tick: current.tick }])
    assert.deepEqual(interpolateRemote(current, old, [], 50, 100, 125), current);
  assert.deepEqual(interpolateRemote(current, prior, [], 0, 500, 525), current);
  assert.deepEqual(interpolateRemote(current, prior, [], 50, 100, 500), current);
  prior.players[1]!.alive = false;
  assert.equal(interpolateRemote(current, prior, [], 50, 100, 125).players[1]!.x, current.players[1]!.x);
  prior.players[1]!.alive = true; prior.players[1]!.x -= 10;
  assert.equal(interpolateRemote(current, prior, [], 50, 100, 125).players[1]!.x, current.players[1]!.x);
});

test('out-of-order snapshots cannot rewind a live round or refresh the freshness clock', () => {
  const state = game();
  const before = { serverTime: 1000, state } as Snapshot;
  assert.equal(snapshotIsOrdered(null, before), true);
  assert.equal(snapshotIsOrdered(before, { ...before, serverTime: 999 }), false);
  assert.equal(snapshotIsOrdered(before, { ...before, serverTime: 1001, state: { ...state, tick: state.tick - 1 } }), false);
  assert.equal(snapshotIsOrdered(before, { ...before, serverTime: 1001, state: { ...state, tick: state.tick + 1 } }), true);
});
