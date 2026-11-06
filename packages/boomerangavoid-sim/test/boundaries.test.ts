import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARENAS,
  CHARACTERS,
  NEUTRAL,
  RULES,
  createMatch,
  step,
} from '../src/index.js';
import { sectorTOI } from '../src/geometry.js';
import type { Input, MatchState, Seat, Weapon } from '../src/index.js';
const seats: Seat[] = CHARACTERS.slice(0, 4).map((c, i) => ({
  id: `p${i}`,
  name: c.name,
  character: c.id,
  color: c.color,
  team: i % 2,
  bot: null,
}));
const command = (fields: Partial<Input>): Input => ({ ...NEUTRAL, ...fields });
function game(n = 2, teams = false): MatchState {
  const s = createMatch(
    {
      mode: teams ? 'teams' : 'ffa',
      mapId: 'moss-court',
      seed: 9,
      wins: 1,
      upgrades: false,
      friendlyFire: false,
    },
    seats.slice(0, n),
  );
  s.phase = 'playing';
  s.tick = 200;
  s.roundStart = 200;
  for (const [i, p] of s.players.entries())
    Object.assign(p, { x: i * 3 - 5, y: 6 });
  return s;
}
function run(
  s: MatchState,
  n: number,
  inputs: Record<string, Input> = {},
): void {
  for (let i = 0; i < n; i++) step(s, inputs);
}
function fly(s: MatchState, owner: string, fields: Partial<Weapon>): Weapon {
  const w = s.weapons.find((w) => w.ownerId === owner)!;
  Object.assign(
    w,
    {
      phase: 'outbound',
      phaseTick: s.tick - 20,
      x: 0,
      y: 0,
      vx: 13,
      vy: 0,
      heading: 0,
      launchHeading: 0,
    },
    fields,
  );
  return w;
}
test('countdown lasts exactly 180 fixed steps and held countdown actions do not execute at start', () => {
  const s = createMatch(
    {
      mode: 'ffa',
      mapId: 'moss-court',
      seed: 8,
      wins: 1,
      upgrades: false,
      friendlyFire: false,
    },
    seats.slice(0, 2),
  );
  run(s, 179, { p0: command({ throw: true }) });
  assert.equal(s.phase, 'countdown');
  step(s, { p0: command({ throw: true }) });
  assert.equal(s.phase, 'playing');
  assert.equal(s.weapons[0]!.phase, 'held');
  step(s, {});
  step(s, { p0: command({ throw: true }) });
  assert.equal(s.weapons[0]!.phase, 'windup');
});
test('slash active interval includes its first tick and excludes its exact end tick', () => {
  const before = game();
  Object.assign(before.players[0]!, {
    x: -0.5,
    y: 0,
    fx: 1,
    fy: 0,
    slashStart: 205,
    slashUntil: 211,
    slashCooldown: 223,
  });
  Object.assign(before.players[1]!, { x: 0.5, y: 0 });
  run(before, 4);
  assert.equal(before.players[1]!.alive, true);
  step(before, {});
  assert.equal(before.players[1]!.alive, false);
  const after = game();
  after.tick = 210;
  Object.assign(after.players[0]!, {
    x: -0.5,
    y: 0,
    fx: 1,
    fy: 0,
    slashStart: 205,
    slashUntil: 211,
    slashCooldown: 223,
  });
  Object.assign(after.players[1]!, { x: 0.5, y: 0 });
  step(after, {});
  assert.equal(after.players[1]!.alive, true);
});
test('dash travels two and a half units in ten ticks, then returns immediately to walking control', () => {
  const s = game();
  const start = s.players[0]!.x;
  run(s, 10, { p0: command({ dash: true, mx: 1 }) });
  assert.ok(Math.abs(s.players[0]!.x - start - 2.5) < 1e-8);
  const end = s.players[0]!.x;
  step(s, {});
  assert.equal(s.players[0]!.x, end);
  assert.equal(s.players[0]!.vx, 0);
});
test('sector sweep notices angular entry after radial entry, and rejects a backward crossing', () => {
  const q = sectorTOI(
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 1, y: 0 },
    0,
    2,
    Math.PI / 4,
  );
  assert.ok(q !== null && Math.abs(q - 0.5) < 1e-8);
  assert.equal(
    sectorTOI(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -1, y: 2 },
      { x: -1, y: 0 },
      0,
      2,
      Math.PI / 4,
    ),
    null,
  );
});
test('deflection uses current attacker team, original return-owner has outbound vulnerability, and friendly fire is optional', () => {
  const s = game(4, true);
  Object.assign(s.players[0]!, { x: -1.5, y: 0 });
  Object.assign(s.players[1]!, {
    x: 0,
    y: 0,
    fx: -1,
    fy: 0,
    slashStart: 200,
    slashUntil: 206,
    slashCooldown: 218,
  });
  Object.assign(s.players[2]!, { x: 6, y: 6 });
  Object.assign(s.players[3]!, { x: -0.8, y: 0 });
  const w = fly(s, 'p0', { x: -0.7, y: 0 });
  step(s, {});
  assert.equal(w.attackerId, 'p1');
  run(s, 5);
  assert.equal(s.players[3]!.alive, true);
  assert.equal(s.players[0]!.alive, false);
  assert.equal(s.players[1]!.kills, 1);
  const ff = game(4, true);
  ff.config.friendlyFire = true;
  Object.assign(ff.players[0]!, { x: -0.5, y: 0, fx: 1, fy: 0 });
  Object.assign(ff.players[2]!, { x: 0.5, y: 0 });
  step(ff, { p0: command({ slash: true }) });
  run(ff, 3);
  assert.equal(ff.players[2]!.alive, false);
  assert.equal(ff.players[0]!.kills, 0);
});
test('a dead owner cannot leave a damaging weapon, and explicit recalls do not postpone stuck timeout forever', () => {
  const s = game(3);
  Object.assign(s.players[0]!, { x: 0, y: -3 });
  Object.assign(s.players[1]!, { x: 8, y: 6 });
  Object.assign(s.players[2]!, { x: -8, y: 6 });
  const w = fly(s, 'p0', { x: 5, y: -3, phase: 'returning' });
  run(s, 20);
  assert.equal(w.phase, 'grounded');
  const start = s.internal!.timers[`stuck:${w.id}`]!;
  for (let i = 0; i < 200 && (w as Weapon).phase !== 'rematerializing'; i++)
    step(s, { p0: command({ throw: i % 2 === 0 }) });
  assert.equal(w.phase, 'rematerializing');
  assert.ok(s.tick - start <= 182);
  const dead = game(3);
  Object.assign(dead.players[0]!, { alive: false });
  const orphan = fly(dead, 'p0', {
    x: dead.players[1]!.x,
    y: dead.players[1]!.y,
  });
  step(dead, {});
  assert.equal(dead.players[1]!.alive, true);
  assert.equal(orphan.phase, 'inert');
});
test('sudden-death warning, closing damage and match terminal state are deterministic and score once', () => {
  const s = game();
  s.tick = s.roundStart + RULES.warning - 1;
  step(s, {});
  assert.equal(
    s.events.some((e) => e.type === 'suddenDeathWarning'),
    true,
  );
  s.tick = s.roundStart + RULES.closing + 240 - 1;
  Object.assign(s.players[1]!, { x: 10.5, y: 0 });
  Object.assign(s.players[0]!, { x: 0, y: 0 });
  step(s, {});
  assert.equal(s.phase, 'matchResults');
  assert.deepEqual(s.matchWinnerIds, ['p0']);
  assert.equal(s.players[0]!.score, 1);
  const terminalTick = s.tick;
  run(s, 300);
  assert.equal(s.tick, terminalTick);
  assert.equal(s.players[0]!.score, 1);
});
test('every authored map has an accessible central seed and usable alternating delivery zones', () => {
  for (const a of ARENAS) {
    for (const p of [{ x: 0, y: 0 }, ...a.targets]) {
      assert.ok(
        Math.abs(p.x) < a.width / 2 - 1 && Math.abs(p.y) < a.height / 2 - 1,
      );
      for (const r of a.obstacles)
        assert.ok(
          Math.abs(p.x - r.x) > r.w / 2 + 0.75 ||
            Math.abs(p.y - r.y) > r.h / 2 + 0.75,
          `${a.id} objective occluded by ${r.id}`,
        );
    }
  }
});
