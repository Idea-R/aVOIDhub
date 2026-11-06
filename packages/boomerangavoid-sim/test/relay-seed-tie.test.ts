import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENAS, CHARACTERS, NEUTRAL, RULES, createMatch, stateHash, step, type MatchState, type Seat } from '../src/index.js';

const seeds = [...Array.from({ length: 32 }, (_, i) => i + 1), 1337, 41827];
const inputs = { p0: { ...NEUTRAL, mx: 1, ax: 1 }, p1: { ...NEUTRAL, mx: -1, ax: -1 } };
function fixture(seed: number, earlier?: 0 | 1): MatchState {
  const arena = structuredClone(ARENAS[0]!);
  arena.obstacles = []; arena.hazards = []; arena.platforms = []; arena.switches = [];
  // All positions are authored before match creation; no runtime teleport or timer override.
  // The tiny offset creates distinct TOIs inside the simultaneous-contact epsilon.
  arena.spawns[0] = { x: -1.2 - (earlier === 1 ? 1e-8 : 0), y: 0 };
  arena.spawns[1] = { x: 1.2 + (earlier === 0 ? 1e-8 : 0), y: 0 };
  const seats: Seat[] = CHARACTERS.slice(0, 2).map((c, i) => ({ id: `p${i}`, name: c.name, character: c.id, color: c.color, team: i, bot: null }));
  const s = createMatch({ mode: 'relay', wins: 3, mapId: arena.id, arenaDraft: arena, seed, upgrades: false, friendlyFire: false }, seats);
  for (let tick = 0; tick < RULES.countdown; tick++) step(s, {});
  return s;
}
function arrive(s: MatchState) {
  for (let tick = 0; tick < 60 && !s.relay.carrierId; tick++) step(s, inputs);
  assert.ok(s.relay.carrierId);
  assert.equal(s.events.filter(e => e.type === 'seedPickup').length, 1);
  return s.relay.carrierId;
}
function unorderedHash(s: MatchState) {
  const clone = JSON.parse(JSON.stringify(s)) as MatchState;
  clone.players.sort((a, b) => a.id < b.id ? -1 : 1);
  clone.weapons.sort((a, b) => a.id < b.id ? -1 : 1);
  return stateHash(clone);
}

test('exact symmetric human arrivals use reproducible seeded priority rather than always the lower ID', () => {
  const selected = new Set<string>();
  for (const seed of seeds) {
    const s = fixture(seed), rng = s.rng;
    const winner = arrive(s); selected.add(winner);
    assert.equal(s.tick, 189);
    assert.equal(s.rng, rng, 'Tie arbitration consumed world RNG');
    assert.equal(arrive(fixture(seed)), winner, 'Same declared fixture did not reproduce its winner');
  }
  assert.deepEqual([...selected].sort(), ['p0', 'p1']);
});

test('strictly earlier Relay contact wins even within simultaneous epsilon, regardless of seed rank', () => {
  for (const seed of seeds) for (const earlier of [0, 1] as const) {
    assert.equal(arrive(fixture(seed, earlier)), `p${earlier}`);
  }
});

test('exact seed arbitration ignores player/weapon array order and survives JSON continuation', () => {
  for (const seed of [1, 2, 1337, 41827]) {
    const a = fixture(seed), b = JSON.parse(JSON.stringify(a)) as MatchState;
    b.players.reverse(); b.weapons.reverse();
    assert.equal(arrive(a), arrive(b));
    assert.equal(unorderedHash(a), unorderedHash(b));
    const replay = JSON.parse(JSON.stringify(a)) as MatchState;
    const rng = a.rng;
    for (let tick = 0; tick < 120; tick++) {
      step(a, inputs); step(replay, inputs);
      assert.equal(stateHash(a), stateHash(replay));
    }
    assert.equal(a.rng, rng);
  }
});
