import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENAS, CHARACTERS, NEUTRAL, RULES, createMatch, getBotInputs, step, type Difficulty, type Seat } from '../src/index.js';

test('difficulty preserves two-interval perception delay and ignores a stationary airborne decoy', () => {
  const firstDecision: number[] = [];
  for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
    const seats: Seat[] = CHARACTERS.slice(0, 2).map((c, i) => ({ id: `p${i}`, name: c.name, character: c.id, color: c.color, team: i, bot: i ? null : difficulty }));
    const arena = structuredClone(ARENAS[0]!);
    arena.obstacles = [];
    arena.hazards = [];
    const s = createMatch({ mode: 'ffa', wins: 3, mapId: arena.id, seed: 1337, friendlyFire: false, upgrades: false, arenaDraft: arena }, seats);
    s.phase = 'playing';
    s.tick = s.roundStart = 200;
    Object.assign(s.players[0]!, { x: -7, y: -5, protectedUntil: 99999 });
    Object.assign(s.players[1]!, { x: -1, y: -5, protectedUntil: 99999 });
    // A stationary airborne threat stays in perception range without killing the probe.
    Object.assign(s.weapons.find(w => w.ownerId === 'p1')!, { phase: 'outbound', phaseTick: 1, x: -4, y: -3, vx: 0, vy: 0 });
    const delay = difficulty === 'easy' ? RULES.botEasyDelay : difficulty === 'normal' ? RULES.botNormalDelay : RULES.botHardDelay;
    for (let tick = 0; tick < 2 * delay; tick++) {
      const commands = getBotInputs(s);
      assert.deepEqual(commands.p0, NEUTRAL, `${difficulty} reacted before two perception intervals`);
      step(s, commands);
    }
    const decision = getBotInputs(s).p0!;
    firstDecision.push(s.tick - s.roundStart);
    assert.ok(Math.hypot(decision.mx, decision.my) > .9);
    assert.equal(decision.dash, false);
    assert.equal(decision.slash, false);
    step(s, { p0: decision });
    assert.equal(s.players[0]!.dashCooldown > s.tick, false, 'a stationary decoy must not waste a defensive cooldown');
    const nextTick = getBotInputs(s).p0!;
    assert.equal(nextTick.dash, false);
    assert.equal(nextTick.slash, false);
    assert.equal(nextTick.throw, false);
  }
  assert.deepEqual(firstDecision, [48, 24, 12]);
});
