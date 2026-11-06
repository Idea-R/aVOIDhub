import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENAS, CHARACTERS, CONTENT_VERSION, NEUTRAL, RULES, createMatch, getArena, isShutterClosed, platformPosition, step, type Arena, type Input, type Seat } from '../src/index.js';
import { inside } from '../src/geometry.js';

const additions = ['reedwater-crossing', 'copperleaf-locks'];
const seats: Seat[] = CHARACTERS.slice(0, 2).map((c, i) => ({ id: `p${i}`, name: c.name, character: c.id, color: c.color, team: i, bot: null }));
function start(arena: Arena, spawn: { x: number; y: number }) {
  const draft = structuredClone(arena);
  draft.spawns[0] = spawn; // Test fixture begins on a real safe approach; runtime never teleports.
  const s = createMatch({ mode: 'ffa', wins: 3, mapId: arena.id, arenaDraft: draft, seed: 1337, upgrades: false, friendlyFire: false }, seats);
  for (let tick = 0; tick < RULES.countdown; tick++) step(s, {});
  return s;
}
test('garden-3 adds distinct route layouts with six safe spawns and usable objective floors', () => {
  assert.equal(CONTENT_VERSION, 'garden-3');
  assert.deepEqual(ARENAS.slice(6).map(a => a.id), additions);
  for (const id of additions) {
    const a = ARENAS.find(a => a.id === id)!;
    assert.equal(a.spawns.length, 6);
    assert.ok(a.platforms!.length >= 2 && a.switches!.length >= 2);
    for (const p of [{ x: 0, y: 0 }, ...a.targets, ...a.spawns]) {
      assert.ok(Math.abs(p.x) < a.width / 2 - RULES.playerRadius && Math.abs(p.y) < a.height / 2 - RULES.playerRadius);
      for (const wall of a.obstacles) assert.equal(inside(p, wall, .75), false, `${id} blocked objective/spawn`);
      for (const gap of a.hazards.filter(h => h.kind === 'gap')) assert.equal(inside(p, gap, .4), false, `${id} unsafe objective/spawn`);
    }
    const gap = a.hazards.find(h => h.kind === 'gap')!;
    assert.ok(Math.min(gap.w, gap.h) < RULES.dashSpeed * RULES.dashTicks / RULES.tickRate - .8, 'Cut leaves meaningful landing margin');
  }
});

test('new narrow cuts allow committed dashes while uncovered walking falls', () => {
  const cases = [
    { id: additions[0]!, spawn: { x: -5.8, y: .6 }, direction: { mx: 0, my: 1 } },
    { id: additions[1]!, spawn: { x: -5.1, y: -1.8 }, direction: { mx: 1, my: 0 } },
  ];
  for (const { id, spawn, direction } of cases) {
    const arena = ARENAS.find(a => a.id === id)!;
    const crossing = start(arena, spawn), walking = start(arena, spawn);
    for (let tick = 0; tick < 20; tick++) {
      step(crossing, { p0: { ...NEUTRAL, ...direction, dash: tick === 0 } as Input });
      step(walking, { p0: { ...NEUTRAL, ...direction } as Input });
    }
    assert.equal(crossing.players[0]!.alive, true, `${id} dash must land on safe floor`);
    assert.equal(walking.players[0]!.alive, false, `${id} painted cut must be a real pit`);
    assert.ok(walking.events.some(e => e.type === 'death' && e.detail === 'fall') || walking.phase === 'roundResults');
  }
});

test('pressure plates on both new maps override their real shutter timers and collision state', () => {
  for (const id of additions) {
    const arena = ARENAS.find(a => a.id === id)!;
    const plate = arena.switches![0]!;
    const s = start(arena, { x: plate.x, y: plate.y });
    const shutter = getArena(s).hazards.find(h => h.id === plate.target)!;
    assert.ok(s.switches![shutter.id]! > s.tick);
    assert.equal(isShutterClosed(s, shutter), false);
    step(s, {});
    assert.equal(s.switches![shutter.id], s.tick + plate.duration, 'An occupied plate refreshes the authored hold duration');
    const direction = id === additions[0] ? { my: 1 } : { mx: 1 };
    for (let tick = 0; tick < 40; tick++) step(s, { p0: { ...NEUTRAL, ...direction } });
    const p = s.players[0]!;
    assert.equal(p.alive, true);
    assert.ok(id === additions[0] ? p.y > shutter.y + shutter.h / 2 + RULES.playerRadius : p.x > shutter.x + shutter.w / 2 + RULES.playerRadius, 'A player actually crosses the pressure-opened collision shutter');
  }
});

test('new moving floors carry an unsteered rider safely through a full authored cycle', () => {
  for (const id of additions) {
    const arena = ARENAS.find(a => a.id === id)!;
    const floor = arena.platforms![0]!;
    const s = start(arena, { x: floor.x, y: floor.y });
    for (let tick = 0; tick < floor.period; tick++) {
      step(s, {});
      const p = s.players[0]!, position = platformPosition(s, floor);
      assert.equal(p.alive, true, `${id} rider fell at tick ${s.tick}`);
      assert.ok(Math.hypot(p.x - position.x, p.y - position.y) < 1e-8);
    }
  }
});
