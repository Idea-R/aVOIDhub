import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENAS, CHARACTERS, RULES, createMatch, getBotInputs, stateHash, step, type Difficulty, type MatchState, type Mode, type Seat } from '../src/index.js';

const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
const delay = (d: Difficulty) => d === 'easy' ? 24 : d === 'normal' ? 12 : 6;
function fixture(difficulty: Difficulty, mode: Mode = 'ffa') {
  const seats: Seat[] = CHARACTERS.slice(0, 3).map((c, i) => ({ id: `p${i}`, name: c.name, character: c.id, color: c.color, team: i % 2, bot: i ? null : difficulty }));
  const arena = structuredClone(ARENAS[0]!); arena.obstacles = []; arena.hazards = [];
  const s = createMatch({ mode, wins: 3, mapId: arena.id, arenaDraft: arena, seed: 1337, upgrades: false, friendlyFire: false }, seats);
  s.phase = 'playing'; s.tick = s.roundStart = 200;
  Object.assign(s.players[0]!, { x: -4, y: 0 });
  Object.assign(s.players[1]!, { x: 2, y: 0, vx: 0, vy: 2 });
  Object.assign(s.players[2]!, { x: 8, y: 5 });
  return s;
}
function firstDecision(s: MatchState) {
  const d = delay(s.players[0]!.bot!);
  for (let t = 0; t <= 2 * d; t++) { s.tick = s.roundStart + t; getBotInputs(s); }
  return getBotInputs(s).p0!;
}

test('only approaching collision courses trigger delayed defense, with one defensive action at a time', () => {
  for (const d of difficulties) for (const [vx, y, near, expected] of [[13, 0, false, false], [0, 0, false, false], [-13, 2, false, false], [-13, 0, false, true], [-13, 0, true, true]] as const) {
    const s = fixture(d), w = s.weapons.find(w => w.ownerId === 'p1')!;
    Object.assign(w, { phase: 'outbound', phaseTick: 1, x: near ? -2.8 : -1, y, vx, vy: 0 });
    const command = firstDecision(s), defensive = d !== 'easy' && expected;
    assert.equal(command.dash, defensive && !near, `${d}/${vx}/${y}/${near}: dash`);
    assert.equal(command.slash, defensive && near, `${d}/${vx}/${y}/${near}: parry`);
    if (command.slash) assert.equal(command.throw, false, 'Parrying must retain the held weapon');
    step(s, { p0: command });
    assert.equal(s.players[0]!.dashCooldown > s.tick, defensive && !near);
    assert.equal(s.players[0]!.slashCooldown > s.tick, defensive && near);
  }
});

test('outbound weapons get flight time; grounded weapons can be recalled without spamming returning weapons', () => {
  for (const phase of ['outbound', 'returning', 'grounded'] as const) {
    const s = fixture('hard'), w = s.weapons.find(w => w.ownerId === 'p0')!;
    Object.assign(w, { phase, phaseTick: s.tick, x: -3.4, y: 0, traveled: .6 });
    let requested = firstDecision(s).throw;
    for (let t = 1; t <= 10; t++) { s.tick += 6; requested ||= getBotInputs(s).p0!.throw; }
    assert.equal(requested, phase === 'grounded', phase);
  }
  const s = fixture('hard');
  s.players[1]!.protectedUntil = s.players[2]!.protectedUntil = 99999;
  let launch = -1, distanceFlown = 0;
  for (let t = 0; t < 120; t++) {
    const c = getBotInputs(s).p0!;
    step(s, { p0: { ...c, mx: 0, my: 0 } });
    const w = s.weapons.find(w => w.ownerId === 'p0')!;
    if (launch < 0 && s.events.some(e => e.type === 'throw')) launch = s.tick;
    if (launch >= 0 && s.tick - launch < 18) assert.equal(s.events.some(e => e.type === 'recall'), false);
    distanceFlown = Math.max(distanceFlown, w.traveled);
  }
  assert.ok(launch >= 0 && distanceFlown > 5, `Real throw reached only ${distanceFlown}`);
  const twin = fixture('hard'), held = twin.weapons.find(w => w.ownerId === 'p0')!;
  twin.weapons.push({ ...held, id: `${held.id}-second`, phase: 'outbound', traveled: .6 });
  assert.equal(firstDecision(twin).throw, false, 'One caught Twin slot must not recall its short-flight partner');
});

test('attack cadence and delayed aim precision differ without advancing world RNG', () => {
  const meanErrors: number[] = [], meanTargetMisses: number[] = [], pulseCounts: number[] = [];
  for (const d of difficulties) {
    const s = fixture(d), rng = s.rng, pulses: number[] = [], errors: number[] = [], misses: number[] = [];
    const lead = d === 'easy' ? 0 : d === 'normal' ? .22 : .3;
    const intended = Math.atan2(2 * lead, 6), bound = d === 'easy' ? .22 : d === 'normal' ? .09 : .06;
    for (let tick = 0; tick < 1200; tick++) {
      s.tick = s.roundStart + tick;
      const c = getBotInputs(s).p0!;
      if (c.throw) pulses.push(tick);
      if (tick >= 2 * delay(d)) {
        const error = Math.abs(Math.atan2(c.ay, c.ax) - intended);
        assert.ok(error <= bound + 1e-8);
        if (tick % delay(d) === 0) {
          errors.push(error);
          // Compare actual firing lines with a constant-speed target at flight-time,
          // independent of the bot's chosen lead and aim-error settings.
          misses.push(Math.abs(6 * c.ay / c.ax - 2 * (6 / RULES.throwSpeed)));
        }
      }
    }
    const minimum = d === 'easy' ? 48 : d === 'normal' ? 24 : 18;
    assert.ok(pulses.length > 5);
    for (let i = 1; i < pulses.length; i++) assert.ok(pulses[i]! - pulses[i - 1]! >= minimum);
    assert.equal(s.rng, rng);
    pulseCounts.push(pulses.length); meanErrors.push(errors.reduce((a, b) => a + b) / errors.length);
    meanTargetMisses.push(misses.reduce((a, b) => a + b) / misses.length);
  }
  assert.ok(pulseCounts[0]! < pulseCounts[1]! && pulseCounts[1]! < pulseCounts[2]!);
  assert.ok(meanErrors[0]! > meanErrors[1]! && meanErrors[1]! > meanErrors[2]!);
  assert.ok(meanTargetMisses[0]! > meanTargetMisses[1]! && meanTargetMisses[1]! > meanTargetMisses[2]!);
});

test('normal and hard withhold blocked shots and use only the preceding combat snapshot', () => {
  for (const d of difficulties) {
    const s = fixture(d);
    s.config.arenaDraft!.obstacles.push({ id: 'cover', x: -1, y: 0, w: 1, h: 2, height: 1, kind: 'stone' });
    firstDecision(s);
    const pulses: boolean[] = [];
    for (let n = 0; n < 20; n++) { s.tick += delay(d); pulses.push(getBotInputs(s).p0!.throw); }
    assert.equal(pulses.some(Boolean), d === 'easy');
    const a = fixture(d); getBotInputs(a); a.tick += delay(d); getBotInputs(a);
    const b = JSON.parse(JSON.stringify(a)) as MatchState;
    Object.assign(b.players[1]!, { x: -4, y: -5, vx: -5, vy: 0 });
    a.tick += delay(d); b.tick += delay(d);
    assert.deepEqual(getBotInputs(a), getBotInputs(b), `${d} reacted to information not yet observed`);
  }
});

test('Relay decisions distinguish simple pursuit, escort and carrier interception', () => {
  for (const d of difficulties) {
    const escort = fixture(d, 'relay');
    escort.players[1]!.team = 0;
    escort.relay.carrierId = 'p1'; escort.relay.x = 2; escort.relay.y = 0;
    Object.assign(escort.players[2]!, { team: 1, x: 3, y: 4 });
    const command = firstDecision(escort);
    assert.equal(escort.internal!.bots.p0!.observed!.role, d === 'easy' ? 'seed' : 'escort');
    assert.ok(d === 'easy' ? Math.abs(command.my) < 1e-8 : command.my > .3);
    const intercept = fixture(d, 'relay');
    intercept.relay.carrierId = 'p1'; intercept.relay.x = 2; intercept.relay.y = 0;
    Object.assign(intercept.players[2]!, { team: 1, x: -3, y: 0 }); // Harmless distraction nearer than the carrier.
    firstDecision(intercept);
    const seen = intercept.internal!.bots.p0!.observed!;
    assert.equal(seen.enemyX, d === 'easy' ? -3 : 2);
    assert.equal(seen.role, d === 'easy' ? 'seed' : 'intercept');
  }
});

test('bot decisions are same-tick idempotent, order independent and replay-safe with older snapshots', () => {
  const s = fixture('hard');
  for (const p of s.players) p.bot = 'normal';
  for (let tick = 0; tick < 120; tick++) step(s, getBotInputs(s));
  const first = getBotInputs(s), initialized = stateHash(s);
  assert.deepEqual(getBotInputs(s), first); assert.equal(stateHash(s), initialized);
  const clone = JSON.parse(JSON.stringify(s)) as MatchState;
  clone.players.reverse(); clone.weapons.reverse();
  assert.deepEqual(getBotInputs(s), getBotInputs(clone));
  const continuation = JSON.parse(JSON.stringify(s)) as MatchState;
  for (let tick = 0; tick < 300; tick++) { step(s, getBotInputs(s)); step(continuation, getBotInputs(continuation)); assert.equal(stateHash(s), stateHash(continuation)); }
  const old = fixture('hard'); firstDecision(old);
  const memory = old.internal!.bots.p0!;
  delete memory.nextAttack;
  for (const key of ['enemyVx', 'enemyVy', 'hasEnemy', 'clearShot', 'held', 'recall', 'threatVx', 'threatVy', 'role'] as const) delete memory.observed![key];
  old.tick += 6;
  assert.doesNotThrow(() => getBotInputs(old));
});
