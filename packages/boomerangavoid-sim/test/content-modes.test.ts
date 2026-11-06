import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARENAS,
  CHARACTERS,
  UPGRADES,
  NEUTRAL,
  RULES,
  createMatch,
  step,
  getBotInputs,
  stateHash,
  releaseRelaySeed,
} from '../src/index.js';
import type {
  Input,
  MatchState,
  Seat,
  UpgradeId,
  Weapon,
} from '../src/index.js';
const seats = (n = 2): Seat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    character: CHARACTERS[i]!.id,
    color: CHARACTERS[i]!.color,
    team: i % 2,
    bot: null,
  }));
function game(relay = false, mapId = 'moss-court', n = 2): MatchState {
  const s = createMatch(
    {
      mode: relay ? 'relay' : 'ffa',
      mapId,
      seed: 891,
      wins: 3,
      friendlyFire: false,
      upgrades: true,
    },
    seats(n),
  );
  s.phase = 'playing';
  s.tick = 200;
  s.roundStart = 200;
  Object.assign(s.players[0]!, { x: -1, y: 0 });
  Object.assign(s.players[1]!, { x: 8, y: 6 });
  return s;
}
const command = (fields: Partial<Input>): Input => ({ ...NEUTRAL, ...fields });
function run(
  s: MatchState,
  n: number,
  inputs: Record<string, Input> = {},
): void {
  for (let i = 0; i < n; i++) step(s, inputs);
}
function collect(s: MatchState, id: UpgradeId): void {
  const p = s.players[0]!;
  s.pickups.push({
    id: `fixture-${id}-${s.tick}`,
    x: p.x,
    y: p.y,
    upgrade: id,
    spawnTick: s.tick,
  });
  step(s, {});
}
function fly(s: MatchState, owner: string, fields: Partial<Weapon>): Weapon {
  const w = s.weapons.find((w) => w.ownerId === owner)!;
  Object.assign(
    w,
    {
      phase: 'outbound',
      phaseTick: s.tick - 20,
      vx: 13,
      vy: 0,
      x: 0,
      y: 0,
      heading: 0,
      launchHeading: 0,
      traveled: 0,
    },
    fields,
  );
  return w;
}
test('Relay earliest swept pickup wins and exact ties produce one deterministic carrier', () => {
  const s = game(true);
  Object.assign(s.players[0]!, { x: -0.8, y: 0, vx: 5.2 });
  Object.assign(s.players[1]!, { x: 0.7, y: 0 });
  step(s, { p0: command({ mx: 1 }) });
  assert.equal(s.relay.carrierId, 'p1');
  const tied = game(true);
  Object.assign(tied.players[0]!, { x: -0.7, y: 0 });
  Object.assign(tied.players[1]!, { x: 0.7, y: 0 });
  step(tied, {});
  const clone = JSON.parse(JSON.stringify(tied)) as MatchState;
  // Recreate the same pre-contact fixture; seeded arbitration must replay exactly.
  const replay = game(true);
  Object.assign(replay.players[0]!, { x: -0.7, y: 0 });
  Object.assign(replay.players[1]!, { x: 0.7, y: 0 });
  step(replay, {});
  assert.ok(tied.relay.carrierId === 'p0' || tied.relay.carrierId === 'p1');
  assert.equal(replay.relay.carrierId, tied.relay.carrierId);
  assert.equal(stateHash(replay), stateHash(clone));
  assert.equal(tied.events.filter((e) => e.type === 'seedPickup').length, 1);
});
test('seed pickup cancels airborne damage at that contact, disables throw and turns armed slash into shove', () => {
  const s = game(true);
  Object.assign(s.players[0]!, { x: 0, y: 0 });
  Object.assign(s.players[1]!, { x: 5, y: 0 });
  const w = fly(s, 'p0', { x: 4.5, y: 0 });
  step(s, {});
  assert.equal(s.relay.carrierId, 'p0');
  assert.equal(s.players[1]!.alive, true);
  assert.equal(w.harmless, true);
  assert.equal(w.phase, 'returning');
  w.phase = 'held';
  Object.assign(s.players[1]!, { x: 1, y: 0 });
  step(s, { p0: command({ throw: true, slash: true, ax: 1 }) });
  run(s, 3);
  assert.equal(w.phase, 'held');
  assert.equal(s.players[1]!.alive, true);
  assert.ok(s.players[1]!.stunUntil > s.tick);
});
test('Relay shield hit drops seed, former carrier lockout holds for 500ms, disconnect drops immediately', () => {
  const s = game(true);
  Object.assign(s.players[0]!, { x: 0, y: 0, shield: true });
  Object.assign(s.players[1]!, { x: 5, y: 0 });
  step(s, {});
  assert.equal(s.relay.carrierId, 'p0');
  fly(s, 'p1', { x: 0.5, y: 0, vx: -13 });
  step(s, {});
  assert.equal(s.players[0]!.alive, true);
  assert.equal(s.players[0]!.shield, false);
  assert.equal(s.relay.carrierId, null);
  const lock = s.relay.previousLockUntil;
  run(s, lock - s.tick - 1);
  assert.equal(s.relay.carrierId, null);
  step(s, {});
  assert.equal(s.relay.carrierId, 'p0');
  releaseRelaySeed(s, 'p0');
  assert.equal(s.relay.carrierId, null);
  assert.equal(
    s.events.some((e) => e.type === 'seedDrop'),
    true,
  );
});
test('Relay target dwell pauses when contested, resets when leaving, alternates and locks after delivery', () => {
  const s = game(true);
  Object.assign(s.players[0]!, { x: 0, y: 0 });
  step(s, {});
  Object.assign(s.players[0]!, { x: -7, y: 0 });
  run(s, 15);
  assert.equal(s.relay.progress, 15);
  Object.assign(s.players[1]!, { x: -6.5, y: 0 });
  run(s, 10);
  assert.equal(s.relay.progress, 15);
  Object.assign(s.players[0]!, { x: -5, y: 0 });
  step(s, {});
  assert.equal(s.relay.progress, 0);
  Object.assign(s.players[1]!, { x: 8, y: 6 });
  Object.assign(s.players[0]!, { x: -7, y: 0 });
  run(s, 30);
  assert.deepEqual(s.relay.scores, [1, 0]);
  assert.equal(s.relay.target, 1);
  assert.equal(s.relay.carrierId, null);
  assert.equal(s.relay.lockUntil, s.tick + 120);
  Object.assign(s.players[0]!, { x: 0, y: 0 });
  run(s, 119);
  assert.equal(s.relay.carrierId, null);
  step(s, {});
  assert.equal(s.relay.carrierId, 'p0');
});
test('Relay respawns after three seconds, protection prevents pickup and ends on deliberate attack', () => {
  const s = game(true);
  Object.assign(s.players[0]!, { x: 0, y: 0 });
  Object.assign(s.players[1]!, { x: 5, y: 0 });
  fly(s, 'p1', { x: 0.5, y: 0, vx: -13 });
  step(s, {});
  const p = s.players[0]!;
  assert.equal(p.alive, false);
  const respawn = p.respawnAt;
  run(s, respawn - s.tick - 1);
  assert.equal(p.alive, false);
  step(s, {});
  assert.equal(p.alive, true);
  assert.equal(p.protectedUntil, s.tick + 60);
  p.x = s.relay.x;
  p.y = s.relay.y;
  step(s, {});
  assert.equal(s.relay.carrierId, null);
  step(s, { p0: command({ slash: true }) });
  assert.equal(p.protectedUntil, 0);
  assert.equal(s.relay.carrierId, 'p0');
});
test('Relay first to three wins and tied five-minute clock uses next-delivery sudden death', () => {
  const s = game(true);
  s.relay.scores = [2, 0];
  s.relay.carrierId = 'p0';
  Object.assign(s.players[0]!, { x: -7, y: 0 });
  run(s, 30);
  assert.equal(s.phase, 'matchResults');
  assert.deepEqual(s.matchWinnerIds, ['p0']);
  assert.equal(s.players[0]!.score, 3);
  const sudden = game(true);
  sudden.relay.endTick = sudden.tick + 1;
  step(sudden, {});
  assert.equal(sudden.phase, 'playing');
  sudden.relay.carrierId = 'p1';
  Object.assign(sudden.players[1]!, { x: -7, y: 0 });
  run(sudden, 30);
  assert.equal(sudden.phase, 'matchResults');
  assert.deepEqual(sudden.matchWinnerIds, ['p1']);
});
test('Relay last-tick delivery by the trailing team still awards the higher-scoring team', () => {
  for (const carrierTeam of [0, 1] as const) {
    const s = game(true, 'moss-court', 4);
    s.relay.scores = carrierTeam === 0 ? [0, 2] : [2, 0];
    s.relay.carrierId = `p${carrierTeam}`;
    Object.assign(s.players[carrierTeam]!, { x: -7, y: 0 });
    s.relay.progress = 29;
    s.relay.endTick = s.tick + 1;
    step(s, {});
    const winningTeam = 1 - carrierTeam;
    assert.equal(s.tick, s.relay.endTick);
    assert.deepEqual(s.relay.scores, carrierTeam === 0 ? [1, 2] : [2, 1]);
    assert.equal(s.phase, 'matchResults');
    assert.deepEqual(
      s.matchWinnerIds,
      s.players.filter((p) => p.team === winningTeam).map((p) => p.id),
    );
    assert.deepEqual(
      s.players.map((p) => p.score),
      s.players.map((p) => s.relay.scores[p.team]),
    );
    assert.equal(s.events.filter((e) => e.type === 'delivery').length, 1);
    assert.equal(s.events.filter((e) => e.type === 'matchEnd').length, 1);
  }
});
test('Relay last-tick tying delivery continues overtime and the next delivery wins', () => {
  const s = game(true);
  s.relay.scores = [1, 2];
  s.relay.carrierId = 'p0';
  Object.assign(s.players[0]!, { x: -7, y: 0 });
  s.relay.progress = 29;
  s.relay.endTick = s.tick + 1;
  step(s, {});
  assert.deepEqual(s.relay.scores, [2, 2]);
  assert.equal(s.phase, 'playing');
  assert.deepEqual(s.matchWinnerIds, []);
  assert.equal(
    s.events.some((e) => e.type === 'matchEnd'),
    false,
  );
  s.relay.carrierId = 'p1';
  Object.assign(s.players[1]!, { x: 7, y: 0 });
  s.relay.progress = 29;
  step(s, {});
  assert.deepEqual(s.relay.scores, [2, 3]);
  assert.equal(s.phase, 'matchResults');
  assert.deepEqual(s.matchWinnerIds, ['p1']);
});
test('each upgrade can be collected; replacement is explicit and a shield is separate from two passives', () => {
  for (const upgrade of UPGRADES) {
    const s = game();
    collect(s, upgrade.id);
    if (upgrade.id === 'guard') assert.equal(s.players[0]!.shield, true);
    else assert.ok(s.players[0]!.upgrades.includes(upgrade.id));
  }
  const s = game();
  collect(s, 'twin');
  collect(s, 'tailwind');
  collect(s, 'guard');
  assert.equal(s.weapons.filter((w) => w.ownerId === 'p0').length, 2);
  collect(s, 'magnet');
  assert.deepEqual(s.players[0]!.upgrades, ['tailwind', 'magnet']);
  assert.equal(s.weapons.filter((w) => w.ownerId === 'p0').length, 1);
  assert.equal(s.players[0]!.shield, true);
  assert.equal(
    s.events.some((e) => e.type === 'upgradeReplaced' && e.detail === 'twin'),
    true,
  );
});
test('Twin Arc is a paired volley; caught slots wait and repeated pickup never duplicates slots', () => {
  const s = game();
  s.players[0]!.y = -6;
  collect(s, 'twin');
  collect(s, 'twin');
  assert.equal(s.weapons.filter((w) => w.ownerId === 'p0').length, 2);
  step(s, { p0: command({ throw: true, ax: 1 }) });
  const slots = s.weapons.filter((w) => w.ownerId === 'p0');
  assert.equal(
    slots.every((w) => w.phase === 'windup'),
    true,
  );
  assert.ok(slots[0]!.heading < slots[1]!.heading);
  run(s, 4);
  slots[0]!.phase = 'held';
  slots[1]!.phase = 'grounded';
  slots[1]!.x = 2;
  step(s, { p0: command({ throw: true }) });
  assert.equal(slots[0]!.phase, 'held');
  assert.equal(slots[1]!.phase, 'returning');
  assert.equal(slots[0]!.generation, 1);
});
test('Skipstone allows exactly one wall ricochet; Tailwind returns faster and Magnet catches farther away', () => {
  const s = game();
  collect(s, 'skipstone');
  Object.assign(s.players[0]!, { x: 0, y: -3 });
  const w = fly(s, 'p0', { x: 2, y: -3, vx: 60 });
  step(s, {});
  assert.equal(w.phase, 'outbound');
  assert.equal(w.ricochets, 1);
  assert.ok(w.vx < 0);
  Object.assign(w, { x: 2, y: -3, vx: 60, heading: 0, phaseTick: s.tick - 20 });
  step(s, {});
  assert.equal(w.phase, 'grounded');
  const fast = game(),
    slow = game();
  collect(fast, 'tailwind');
  const f = fly(fast, 'p0', { x: -6, y: 0, phase: 'returning' }),
    o = fly(slow, 'p0', { x: -6, y: 0, phase: 'returning' });
  step(fast, {});
  step(slow, {});
  assert.ok(f.x > o.x);
  const magnet = game();
  collect(magnet, 'magnet');
  const m = fly(magnet, 'p0', { x: -1.85, y: 0, phase: 'returning' });
  step(magnet, {});
  assert.equal(m.phase, 'held');
});
test('Frost Wake slows enemies, Ember Fuse warns then bursts once, Echo Step stays harmless', () => {
  const s = game();
  collect(s, 'frost');
  const w = fly(s, 'p0', { x: 0, y: 0 });
  s.tick = 203;
  step(s, {});
  assert.ok(s.effects.some((e) => e.kind === 'frost'));
  w.phase = 'grounded';
  w.y = 7;
  Object.assign(s.players[1]!, { x: 0, y: 0, vx: 5.2 });
  step(s, { p1: command({ mx: 1 }) });
  assert.equal(s.players[1]!.alive, true);
  assert.ok(s.players[1]!.vx < 5.2);
  const ember = game();
  collect(ember, 'ember');
  Object.assign(ember.players[0]!, { x: 0, y: -3 });
  Object.assign(ember.players[1]!, { x: 1.3, y: -2 });
  fly(ember, 'p0', { x: 2, y: -3, vx: 60 });
  step(ember, {});
  assert.equal(ember.effects.filter((e) => e.kind === 'ember').length, 1);
  assert.equal(ember.players[1]!.alive, true);
  run(ember, 59);
  assert.equal(ember.players[1]!.alive, true);
  step(ember, {});
  assert.equal(ember.players[1]!.alive, false);
  assert.equal(ember.players[0]!.kills, 1);
  const echo = game();
  collect(echo, 'echo');
  step(echo, { p0: command({ dash: true, mx: 1 }) });
  assert.equal(echo.effects.filter((e) => e.kind === 'echo').length, 1);
  run(echo, 40);
  assert.equal(echo.effects.length, 0);
  assert.equal(
    echo.players.every((p) => p.alive),
    true,
  );
});
test('all allowed passive pairs remain bounded through throws, dashes, recalls and duplicate pickups', () => {
  const passives = UPGRADES.filter((u) => u.id !== 'guard');
  for (let i = 0; i < passives.length; i++)
    for (let j = i + 1; j < passives.length; j++) {
      const s = game();
      s.players[0]!.y = -6;
      collect(s, passives[i]!.id);
      collect(s, passives[j]!.id);
      collect(s, passives[i]!.id);
      for (let t = 0; t < 180; t++)
        step(s, {
          p0: command({
            mx: Math.sin(t / 40),
            my: Math.cos(t / 40),
            throw: t % 45 === 0,
            dash: t % 60 === 0,
          }),
        });
      assert.ok(s.weapons.filter((w) => w.ownerId === 'p0').length <= 2);
      assert.ok(s.effects.length <= 20);
      assert.equal(s.players[0]!.upgrades.length, 2);
    }
});
test('wind lanes change only flying weapon path; paired gates rotate without teleport damage', () => {
  const s = game(false, 'windbell-garden');
  Object.assign(s.players[0]!, { x: -4, y: 0 });
  const w = fly(s, 'p0', { x: -4, y: 2, vx: 13 });
  step(s, {});
  assert.ok(w.vy > 0);
  assert.equal(s.players[0]!.vy, 0);
  const moon = game(false, 'moonwell');
  Object.assign(moon.players[0]!, { x: -8, y: 6 });
  Object.assign(moon.players[1]!, { x: 0, y: 0 });
  const gate = fly(moon, 'p0', { x: -5.7, y: -2, vx: 13 });
  step(moon, {});
  assert.ok(gate.x > 4);
  assert.ok(gate.vy > 12);
  assert.equal(moon.players[1]!.alive, true);
  assert.equal(
    moon.events.some((e) => e.type === 'gate'),
    true,
  );
});
test('gaps kill walking seats, dash crosses safely while remaining vulnerable to weapons', () => {
  const walk = game(false, 'tideglass-steps');
  Object.assign(walk.players[0]!, { x: -3.1, y: 3 });
  step(walk, {});
  assert.equal(walk.players[0]!.alive, false);
  const dash = game(false, 'tideglass-steps');
  Object.assign(dash.players[0]!, { x: -3.8, y: 3, fx: 1, fy: 0 });
  run(dash, 6, { p0: command({ mx: 1, dash: true }) });
  assert.equal(dash.players[0]!.alive, true);
  assert.ok(dash.players[0]!.x > -2.5);
  const hit = game(false, 'tideglass-steps');
  Object.assign(hit.players[0]!, { x: -3.8, y: 3, fx: 1, fy: 0 });
  Object.assign(hit.players[1]!, { x: 5, y: 3 });
  fly(hit, 'p1', { x: -3.3, y: 3, vx: -13 });
  step(hit, { p0: command({ mx: 1, dash: true }) });
  assert.equal(hit.players[0]!.alive, false);
});
test('all maps run six seeded bots with legal inputs, delayed actions and bounded finite state', () => {
  for (const a of ARENAS) {
    const s = game(false, a.id, 6);
    for (const [i, p] of s.players.entries()) {
      p.bot = ['easy', 'normal', 'hard'][i % 3] as 'easy' | 'normal' | 'hard';
      Object.assign(p, a.spawns[i]);
    }
    const first = getBotInputs(s);
    assert.equal(
      Object.values(first).every((i) => !i.throw && !i.dash && !i.slash),
      true,
    );
    for (let t = 0; t < 2500; t++) {
      const commands = getBotInputs(s);
      for (const i of Object.values(commands)) {
        assert.ok(Math.hypot(i.mx, i.my) <= 1.00001);
        assert.ok(Math.hypot(i.ax, i.ay) <= 1.00001);
      }
      step(s, commands);
      assert.ok(
        s.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      );
      assert.ok(s.weapons.length <= 12);
      assert.ok(s.effects.length <= 60);
      assert.ok(s.pickups.length <= 3);
    }
    const clone = JSON.parse(JSON.stringify(s)) as MatchState;
    assert.equal(stateHash(s), stateHash(clone));
  }
});
test('an open Tideglass bridge supports a continuous walking crossing from outside the gap', () => {
  const s = game(false, 'tideglass-steps');
  s.tick = s.roundStart + 100;
  Object.assign(s.players[0]!, { x: -3.8, y: 0, vx: 5.2 });
  run(s, 20, { p0: command({ mx: 1 }) });
  assert.equal(s.players[0]!.alive, true);
  assert.ok(s.players[0]!.x > -2.3);
});
