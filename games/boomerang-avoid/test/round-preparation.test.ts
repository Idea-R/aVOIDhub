import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatch, type MatchState } from '@avoid/boomerangavoid-sim';
import { RoundPreparation } from '../src/round-preparation';
const state = () => createMatch({ mode: 'ffa', wins: 3, mapId: 'moss-court', seed: 1, friendlyFire: false, upgrades: false },
  ['a', 'b'].map((id, i) => ({ id, name: id, character: 'pip', color: i, team: i, bot: null })));
const pause = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => resolve = done); return { promise, resolve }; }

test('loading acknowledgement waits for every detached preparation hook and deduplicates repeated loading snapshots', async () => {
  const preparation = new RoundPreparation(1000), slow = deferred();
  const source = state(); let ready = 0, calls = 0;
  const hooks = [async (copy: MatchState) => { calls++; copy.players[0]!.x = 999; await slow.promise; }];
  preparation.start('1', source, hooks, () => ready++, assert.fail);
  preparation.start('1', source, hooks, () => ready++, assert.fail);
  await pause(); assert.equal(ready, 0); assert.equal(calls, 1);
  slow.resolve(); await pause();
  assert.equal(ready, 1); assert.notEqual(source.players[0]!.x, 999);
  preparation.cancel();
});

test('failed preparation retries once, then reports failure without acknowledging incomplete content', async () => {
  const preparation = new RoundPreparation(1000); let ready = 0, failures = 0, calls = 0;
  const hooks = [async () => { calls++; throw new Error('missing asset'); }];
  preparation.start('1', state(), hooks, () => ready++, error => { failures++; assert.match(error.message, /missing/); });
  await pause();
  assert.equal(calls, 2); assert.equal(failures, 1); assert.equal(ready, 0);
  preparation.start('1', state(), hooks, () => ready++, assert.fail);
  await pause(); assert.equal(calls, 2, 'ordinary snapshots must not start an infinite retry loop');
  preparation.cancel();
});

test('a transient error may succeed on the bounded retry', async () => {
  const preparation = new RoundPreparation(1000); let calls = 0, ready = 0;
  preparation.start('1', state(), [async () => { if (++calls === 1) throw new Error('transient'); }], () => ready++, assert.fail);
  await pause(); assert.equal(calls, 2); assert.equal(ready, 1);
  preparation.cancel();
});

test('timeouts abort both attempts and old round/left-room completions cannot acknowledge later', async () => {
  const preparation = new RoundPreparation(5); const signals: AbortSignal[] = []; let ready = 0, failures = 0;
  preparation.start('timeout', state(), [async (_, signal) => { signals.push(signal); await new Promise(() => {}); }], () => ready++, () => failures++);
  await pause(30);
  assert.equal(signals.length, 2); assert.ok(signals.every(signal => signal.aborted));
  assert.equal(ready, 0); assert.equal(failures, 1);
  const late = deferred();
  preparation.start('old', state(), [() => late.promise], () => ready++, assert.fail);
  await pause(); preparation.cancel(); late.resolve(); await pause();
  assert.equal(ready, 0);
  preparation.start('new', state(), [async () => {}], () => ready++, assert.fail);
  await pause(); assert.equal(ready, 1);
  preparation.cancel();
});
