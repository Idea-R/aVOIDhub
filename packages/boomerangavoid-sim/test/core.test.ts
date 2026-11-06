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
  restartMatch,
} from '../src/index.js';
import type { Input, MatchState, Mode, Seat, Weapon } from '../src/index.js';
const seats = (n = 2): Seat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    character: CHARACTERS[i]!.id,
    color: CHARACTERS[i]!.color,
    team: i % 2,
    bot: null,
  }));
function game(mode: Mode = 'ffa', n = 2): MatchState {
  const s = createMatch(
    {
      mode,
      mapId: 'moss-court',
      seed: 12345,
      wins: 3,
      friendlyFire: false,
      upgrades: false,
    },
    seats(n),
  );
  s.phase = 'playing';
  s.tick = 200;
  s.roundStart = 200;
  for (const [i, p] of s.players.entries()) {
    p.x = i === 0 ? -1 : 1 + i * 2;
    p.y = 0;
  }
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
function flying(s: MatchState, owner: string, fields: Partial<Weapon>): Weapon {
  const w = s.weapons.find((w) => w.ownerId === owner)!;
  Object.assign(
    w,
    {
      phase: 'outbound',
      phaseTick: s.tick,
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
test('movement accelerates, stops, normalizes diagonals, clamps boundaries and sanitizes invalid inputs', () => {
  const a = game(),
    b = game();
  a.players[0]!.y = -6;
  b.players[0]!.y = -6;
  run(a, 30, { p0: command({ mx: 1 }) });
  run(b, 30, { p0: command({ mx: 1, my: 1 }) });
  assert.ok(
    Math.abs(
      Math.hypot(a.players[0]!.vx, a.players[0]!.vy) -
        Math.hypot(b.players[0]!.vx, b.players[0]!.vy),
    ) < 1e-8,
  );
  run(a, 10);
  assert.equal(a.players[0]!.vx, 0);
  const stop = a.players[0]!.x;
  run(a, 10);
  assert.equal(a.players[0]!.x, stop);
  a.players[0]!.x = 10.5;
  run(a, 30, { p0: command({ mx: Infinity, my: NaN }) });
  assert.ok(Number.isFinite(a.players[0]!.x));
  run(a, 100, { p0: command({ mx: 1 }) });
  assert.ok(a.players[0]!.x <= 11 - RULES.playerRadius);
});
test('dash is committed, does not repeat on held input, and buffers a new edge near cooldown expiry', () => {
  const s = game();
  s.players[0]!.y = -6;
  const start = s.players[0]!.x;
  run(s, 10, { p0: command({ mx: 1, dash: true }) });
  assert.ok(s.players[0]!.x - start > 2.4);
  const first = s.players[0]!.dashCooldown;
  run(s, 60, { p0: command({ dash: true }) });
  assert.equal(s.players[0]!.dashCooldown, first);
  step(s, {});
  s.players[0]!.dashCooldown = s.tick + 4;
  step(s, { p0: command({ dash: true }) });
  run(s, 3);
  assert.equal(s.players[0]!.dashCooldown, s.tick + RULES.dashCooldown);
});
test('throw windup, held input, limited curve, return and catch never auto-rethrow', () => {
  const s = game();
  s.players[0]!.x = -5;
  s.players[0]!.y = -6;
  s.players[1]!.x = 9;
  s.players[1]!.y = 6;
  step(s, { p0: command({ ax: 1, throw: true }) });
  assert.equal(s.weapons[0]!.phase, 'windup');
  run(s, 2, { p0: command({ mx: 0, my: 1, throw: true }) });
  assert.equal(s.weapons[0]!.phase, 'windup');
  run(s, 10, { p0: command({ my: 1, throw: true }) });
  const w = s.weapons[0]!;
  assert.equal(w.phase, 'outbound');
  assert.ok(w.heading > 0 && w.heading <= RULES.curveLimit + 1e-8);
  run(s, 100, { p0: command({ throw: true }) });
  assert.equal(w.phase, 'held');
  const generation = w.generation;
  run(s, 30, { p0: command({ throw: true }) });
  assert.equal(w.generation, generation);
  step(s, {});
  step(s, { p0: command({ throw: true }) });
  assert.equal(w.generation, generation + 1);
});
test('thin-wall sweep grounds a high-speed weapon before it can damage through cover', () => {
  const s = game();
  s.players[0]!.x = -6;
  s.players[0]!.y = -3;
  s.players[1]!.x = 5;
  s.players[1]!.y = -3;
  const w = flying(s, 'p0', { x: 1, y: -3, vx: 600, phaseTick: s.tick - 20 });
  step(s, {});
  assert.equal(w.phase, 'grounded');
  assert.ok(w.x < 2.2);
  assert.equal(s.players[1]!.alive, true);
});
test('blocked return needs a fresh recall and safe rematerialization cannot damage through a wall', () => {
  const s = game();
  s.players[0]!.x = 0;
  s.players[0]!.y = -3;
  s.players[1]!.x = 7;
  s.players[1]!.y = 6;
  const w = flying(s, 'p0', { x: 5, y: -3, phase: 'returning' });
  run(s, 20);
  assert.equal(w.phase, 'grounded');
  const groundTick = w.phaseTick;
  run(s, RULES.groundTimeout - (s.tick - groundTick));
  assert.equal(w.phase, 'rematerializing');
  assert.equal(w.harmless, true);
  run(s, RULES.rematerializeTicks);
  assert.equal(w.phase, 'held');
  assert.equal(w.x, s.players[0]!.x);
  assert.equal(s.players[1]!.alive, true);
});
test('armed slash trades batch both deaths and gives each exactly one kill', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -0.5, y: 0, fx: 1, fy: 0 });
  Object.assign(s.players[1]!, { x: 0.5, y: 0, fx: -1, fy: 0 });
  step(s, { p0: command({ slash: true }), p1: command({ slash: true }) });
  run(s, 3);
  assert.equal(s.players.filter((p) => p.alive).length, 0);
  assert.deepEqual(
    s.players.map((p) => p.kills),
    [1, 1],
  );
  assert.equal(s.phase, 'roundResults');
  assert.deepEqual(s.winnerIds, []);
  const deaths = s.events.filter((e) => e.type === 'death');
  assert.equal(deaths.length, 2);
  run(s, 50);
  assert.deepEqual(
    s.players.map((p) => p.kills),
    [1, 1],
  );
  assert.deepEqual(
    s.players.map((p) => p.score),
    [0, 0],
  );
});
test('unarmed slash shoves without eliminating, armed slash outside cone misses', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -0.5, y: 0, fx: 1, fy: 0 });
  Object.assign(s.players[1]!, { x: 0.5, y: 0 });
  flying(s, 'p0', { x: -8, y: 6, phase: 'grounded' });
  step(s, { p0: command({ slash: true }) });
  run(s, 3);
  assert.equal(s.players[1]!.alive, true);
  assert.ok(s.players[1]!.stunUntil > s.tick);
  const b = game();
  Object.assign(b.players[0]!, { x: -0.5, y: 0, fx: -1, fy: 0 });
  Object.assign(b.players[1]!, { x: 0.5, y: 0 });
  step(b, { p0: command({ slash: true }) });
  run(b, 8);
  assert.equal(b.players[1]!.alive, true);
});
test('shield absorbs coincident damage as one charge and grace expires exactly after six ticks', () => {
  const s = game('ffa', 3);
  const p = s.players[1]!;
  Object.assign(p, { x: 0, y: 0, shield: true });
  s.players[0]!.x = -7;
  s.players[2]!.x = 7;
  flying(s, 'p0', { x: -0.55, y: 0, vx: 13, phaseTick: s.tick - 20 });
  flying(s, 'p2', {
    x: 0.55,
    y: 0,
    vx: -13,
    phaseTick: s.tick - 20,
    heading: Math.PI,
    launchHeading: Math.PI,
  });
  step(s, {});
  assert.equal(p.alive, true);
  assert.equal(p.shield, false);
  assert.equal(s.events.filter((e) => e.type === 'shield').length, 1);
  const until = p.shieldGraceUntil;
  run(s, until - s.tick - 1);
  flying(s, 'p0', { x: -0.55, y: 0, vx: 13, phaseTick: s.tick - 20 });
  step(s, {});
  assert.equal(p.alive, false);
});
test('earlier death invalidates later weapon contacts but exact-time projectiles trade', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -1, y: 0 });
  Object.assign(s.players[1]!, { x: 1, y: 0 });
  flying(s, 'p0', { x: 0.5, y: 0, vx: 13, phaseTick: s.tick - 20 });
  flying(s, 'p1', {
    x: -0.5,
    y: 0,
    vx: -13,
    phaseTick: s.tick - 20,
    heading: Math.PI,
  });
  step(s, {});
  assert.equal(s.players.filter((p) => p.alive).length, 0);
  assert.deepEqual(
    s.players.map((p) => p.kills),
    [1, 1],
  );
  const b = game();
  Object.assign(b.players[0]!, { x: -1, y: 0 });
  Object.assign(b.players[1]!, { x: 1, y: 0 });
  flying(b, 'p0', { x: 0.5, y: 0, vx: 13, phaseTick: b.tick - 20 });
  flying(b, 'p1', { x: 0, y: 0, vx: -60, phaseTick: b.tick - 20 });
  step(b, {});
  assert.equal(b.players[1]!.alive, false);
  assert.equal(b.players[0]!.alive, true);
});
test('deflection retains return owner and permits reflected outbound to hit original owner', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -1.5, y: 0, fx: 1 });
  Object.assign(s.players[1]!, {
    x: 0,
    y: 0,
    fx: -1,
    fy: 0,
    slashStart: s.tick,
    slashUntil: s.tick + 6,
    slashCooldown: s.tick + 20,
  });
  const w = flying(s, 'p0', { x: -0.7, y: 0, vx: 13, phaseTick: s.tick - 20 });
  step(s, {});
  assert.equal(w.ownerId, 'p0');
  assert.equal(w.attackerId, 'p1');
  assert.equal(
    s.events.some((e) => e.type === 'deflect'),
    true,
  );
  run(s, 5);
  assert.equal(s.players[0]!.alive, false);
  assert.equal(s.players[1]!.kills, 1);
});
test('head-on flying weapons ground together before applying obsolete target hits', () => {
  const s = game();
  s.players[0]!.x = -5;
  s.players[1]!.x = 5;
  const a = flying(s, 'p0', { x: -0.2, y: 0, vx: 13, phaseTick: s.tick - 20 }),
    b = flying(s, 'p1', { x: 0.2, y: 0, vx: -13, phaseTick: s.tick - 20 });
  step(s, {});
  assert.equal(a.phase, 'grounded');
  assert.equal(b.phase, 'grounded');
  assert.equal(
    s.players.every((p) => p.alive),
    true,
  );
});
test('round score is awarded once, resets completely, and rematch resets totals and RNG', () => {
  const s = game();
  s.config.wins = 2;
  Object.assign(s.players[0]!, { x: -0.5, y: 0, fx: 1 });
  Object.assign(s.players[1]!, { x: 0.5, y: 0 });
  step(s, { p0: command({ slash: true }) });
  run(s, 3);
  assert.equal(s.players[0]!.score, 1);
  run(s, 120);
  assert.equal(s.phase, 'countdown');
  assert.equal(s.round, 2);
  assert.equal(
    s.players.every((p) => p.alive && p.upgrades.length === 0),
    true,
  );
  assert.equal(
    s.weapons.every((w) => w.phase === 'held'),
    true,
  );
  const fresh = restartMatch(s),
    original = createMatch(s.config, seats());
  assert.equal(stateHash(fresh), stateHash(original));
});
test('teams share round points, friendly fire obeys attacker team, and reflected attack uses deflector team', () => {
  const s = game('teams', 4);
  s.players[1]!.alive = false;
  s.players[3]!.alive = false;
  step(s, {});
  assert.deepEqual(s.winnerIds, ['p0', 'p2']);
  assert.deepEqual(
    s.players.map((p) => p.score),
    [1, 0, 1, 0],
  );
  const b = game('teams', 4);
  Object.assign(b.players[0]!, { x: -0.5, y: 0, fx: 1 });
  Object.assign(b.players[2]!, { x: 0.5, y: 0 });
  b.players[1]!.y = 6;
  b.players[3]!.y = 6;
  step(b, { p0: command({ slash: true }) });
  run(b, 3);
  assert.equal(b.players[2]!.alive, true);
});
test('replay cloning preserves buffers, edge memory, RNG, bots and hash for 1200 ticks', () => {
  const a = game('ffa', 6);
  for (const [i, p] of a.players.entries())
    p.bot = ['easy', 'normal', 'hard'][i % 3] as 'easy' | 'normal' | 'hard';
  const b = JSON.parse(JSON.stringify(a)) as MatchState;
  for (let t = 0; t < 1200; t++) {
    const ia = getBotInputs(a),
      ib = getBotInputs(b);
    assert.deepEqual(ia, ib);
    step(a, ia);
    step(b, ib);
    if (t % 30 === 0)
      assert.equal(
        stateHash(a),
        stateHash(b),
        `first hash difference near tick ${t}`,
      );
  }
  const c = JSON.parse(JSON.stringify(a)) as MatchState;
  c.players[0]!.score++;
  assert.notEqual(stateHash(a), stateHash(c));
});
test('authored arenas and upgrade compatibility have bounded, safe content', () => {
  assert.equal(ARENAS.length, 8);
  assert.equal(CHARACTERS.length, 6);
  assert.equal(UPGRADES.length, 8);
  for (const a of ARENAS) {
    assert.equal(a.spawns.length, 6);
    for (const [i, p] of a.spawns.entries()) {
      assert.ok(
        Math.abs(p.x) < a.width / 2 - 0.38 &&
          Math.abs(p.y) < a.height / 2 - 0.38,
      );
      for (const other of a.spawns.slice(i + 1))
        assert.ok(Math.hypot(p.x - other.x, p.y - other.y) > 1);
      for (const o of a.obstacles)
        assert.ok(
          Math.abs(p.x - o.x) > o.w / 2 + 0.38 ||
            Math.abs(p.y - o.y) > o.h / 2 + 0.38,
        );
    }
  }
  for (const u of UPGRADES)
    for (const v of UPGRADES)
      if (u !== v) assert.equal(u.compatible.includes(v.id), true);
});
