import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENAS, NEUTRAL, RULES, createMatch, getArena, getBotInputs, isShutterClosed,
  platformPosition, stateHash, step, type Input, type MatchState, type Seat } from '../src/index.js';

const seats: Seat[] = [
  { id: 'a', name: 'A', character: 'pip', color: 1, team: 0, bot: null },
  { id: 'b', name: 'B', character: 'kiln', color: 2, team: 1, bot: null },
];
const command = (fields: Partial<Input>): Input => ({ ...NEUTRAL, ...fields });
function game(mapId = 'tideglass-steps'): MatchState {
  const state = createMatch({ mode: 'ffa', wins: 3, mapId, seed: 574, friendlyFire: false, upgrades: false }, seats);
  state.phase = 'playing';
  state.tick = state.roundStart = 200;
  Object.assign(state.players[1]!, { x: 9, y: 6 });
  return state;
}
function run(state: MatchState, ticks: number, input: Input = { ...NEUTRAL }) {
  for (let n = 0; n < ticks; n++) step(state, { a: input });
}

test('fractional movement, continuous facing and thrown heading preserve arbitrary stick angles', () => {
  for (const degrees of [7, 23, 37, 82, 127, 193, 271, 346]) {
    const s = game('moss-court');
    const angle = degrees * Math.PI / 180;
    const x = Math.cos(angle), y = Math.sin(angle);
    Object.assign(s.players[0]!, { x: 0, y: 0 });
    run(s, 12, command({ mx: x * 0.4, my: y * 0.4 }));
    const p = s.players[0]!;
    assert.ok(Math.abs(p.vx - x * RULES.runSpeed * 0.4) < 1e-10);
    assert.ok(Math.abs(p.vy - y * RULES.runSpeed * 0.4) < 1e-10);
    assert.ok(Math.abs(p.fx - x) < 1e-10 && Math.abs(p.fy - y) < 1e-10);
    step(s, { a: command({ ax: x, ay: y, throw: true }) });
    const weapon = s.weapons.find(w => w.ownerId === 'a')!;
    assert.ok(Math.abs(Math.sin(weapon.heading) - y) < 1e-10);
    assert.ok(Math.abs(Math.cos(weapon.heading) - x) < 1e-10);
  }
});

test('dash follows movement while independent aim keeps its facing, and idle dash follows aim', () => {
  const moving = game('moss-court');
  Object.assign(moving.players[0]!, { x: 0, y: 0 });
  step(moving, { a: command({ mx: -0.5, ax: 0, ay: -1, dash: true }) });
  assert.equal(moving.players[0]!.x, -0.25);
  assert.equal(moving.players[0]!.y, 0);
  assert.equal(moving.players[0]!.fy, -1);
  const idle = game('moss-court');
  Object.assign(idle.players[0]!, { x: 0, y: 0 });
  step(idle, { a: command({ ax: 0, ay: -1, dash: true }) });
  assert.equal(idle.players[0]!.y, -0.25);
});

test('moving floors carry resting riders and reverse at the deterministic endpoint', () => {
  const s = game();
  const platform = getArena(s).platforms![0]!;
  Object.assign(s.players[0]!, platformPosition(s, platform));
  run(s, 50);
  assert.equal(s.players[0]!.alive, true);
  assert.ok(Math.abs(s.players[0]!.y - platformPosition(s, platform).y) < 1e-10);
  assert.ok(s.players[0]!.y > -1.01 && s.players[0]!.y < -0.99);
  assert.deepEqual(platformPosition(s, platform, s.roundStart + 200), platform.to);
  assert.deepEqual(platformPosition(s, platform, s.roundStart + 400), { x: platform.x, y: platform.y });
  assert.ok(platformPosition(s, platform, s.roundStart + 201).y < platform.to.y);
});

test('walking off a moving floor falls; a shield and spawn protection do not support a pit', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -3, y: -2, shield: true, protectedUntil: 99999 });
  run(s, 30, command({ my: 1 }));
  assert.equal(s.players[0]!.alive, false);
  assert.equal(s.players[0]!.shield, true, 'falling does not spend a combat shield');
  const uncovered = game();
  Object.assign(uncovered.players[0]!, { x: -3, y: 3, shield: true, protectedUntil: 99999 });
  step(uncovered);
  assert.equal(uncovered.players[0]!.alive, false);
  assert.ok(uncovered.events.some(e => e.type === 'death' && e.detail === 'fall'));
});

test('dash clears a narrow gap but cannot hover when it ends over unsupported floor', () => {
  const crossing = game();
  Object.assign(crossing.players[0]!, { x: -4, y: 3 });
  run(crossing, 12, command({ mx: 1, dash: true }));
  assert.equal(crossing.players[0]!.alive, true);
  assert.ok(crossing.players[0]!.x > -2);
  const short = game();
  Object.assign(short.players[0]!, { x: -5.5, y: 3 });
  run(short, 12, command({ mx: 1, dash: true }));
  assert.equal(short.players[0]!.alive, false);
});

test('swept support detects leaving a floor even if the player ends beyond the entire gap', () => {
  const s = game();
  Object.assign(s.players[0]!, { x: -3, y: -2, vx: 0, vy: 600, stunUntil: 999 });
  step(s);
  assert.equal(s.players[0]!.alive, false);
});

test('pressure plates open real collision shutters, hold them open and expire after release', () => {
  const s = game('lantern-foundry');
  const shutter = getArena(s).hazards.find(h => h.id === 'shutter-west')!;
  const plate = getArena(s).switches![0]!;
  assert.equal(isShutterClosed(s, shutter), true);
  Object.assign(s.players[0]!, { x: plate.x, y: plate.y });
  step(s);
  assert.equal(isShutterClosed(s, shutter), false);
  assert.equal(s.switches![shutter.id], s.tick + plate.duration);
  assert.ok(s.events.some(e => e.type === 'switch' && e.actor === 'a'));
  run(s, 20);
  assert.equal(s.switches![shutter.id], s.tick + plate.duration);
  Object.assign(s.players[0]!, { x: -5, y: 0, vx: RULES.runSpeed });
  run(s, 23, command({ mx: 1 }));
  assert.ok(s.players[0]!.x > -3.5, 'the opened shutter permits an actual crossing');
  Object.assign(s.players[0]!, { x: -8, y: -5, vx: 0, vy: 0 });
  const until = s.switches![shutter.id]!;
  s.tick = until;
  s.roundStart = until; // phase the authored shutter closed at exact override expiry
  assert.equal(isShutterClosed(s, shutter), true);
  Object.assign(s.players[0]!, { x: -5, y: 0, vx: RULES.runSpeed });
  run(s, 23, command({ mx: 1 }));
  assert.ok(s.players[0]!.x < -4.6, 'closed shutters block collision again');
});

test('platform and plate state survive JSON replay cloning with identical hashes', () => {
  for (const map of ['tideglass-steps', 'lantern-foundry']) {
    const a = game(map);
    Object.assign(a.players[0]!, map === 'tideglass-steps' ? { x: -3, y: -2 } : { x: -6, y: 0 });
    run(a, 4);
    const b = JSON.parse(JSON.stringify(a)) as MatchState;
    for (let n = 0; n < 250; n++) {
      step(a); step(b);
      assert.equal(stateHash(a), stateHash(b));
    }
  }
});

test('bots route around pits or dash to safe landing even when combat aim points elsewhere', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const s = game();
    s.players[0]!.bot = difficulty;
    Object.assign(s.players[0]!, { x: -4.8, y: 3 });
    Object.assign(s.players[1]!, { x: 8, y: 3 });
    // Keep the target harmless and stationary; this checks navigation, not battle outcomes.
    s.players[1]!.protectedUntil = 99999;
    for (let tick = 0; tick < 500 && s.phase === 'playing'; tick++) {
      const commands = getBotInputs(s);
      commands.a!.throw = commands.a!.slash = false;
      step(s, commands);
      assert.equal(s.players[0]!.alive, true, `${difficulty} fell at tick ${s.tick}`);
    }
    assert.ok(s.players[0]!.x > -2, `${difficulty} must make progress across or around the first pit`);
  }
});

test('local authored arenas and chosen upgrade pools serialize and control the simulation', () => {
  const draft = structuredClone(ARENAS[0]!);
  draft.id = 'authored-court';
  draft.obstacles = [];
  draft.spawns[0] = { x: -2, y: -2 };
  const s = createMatch({ mode: 'ffa', wins: 3, mapId: draft.id, seed: 1, friendlyFire: false,
    upgrades: true, arenaDraft: draft, enabledUpgrades: ['frost'] }, seats);
  assert.equal(getArena(s).id, draft.id);
  assert.equal(s.players[0]!.x, -2);
  draft.name = 'Edited after match creation';
  assert.notEqual(getArena(s).name, draft.name, 'playing state owns a stable copy of the draft');
  s.phase = 'playing';
  s.tick = s.roundStart = 200;
  run(s, RULES.pickupOffset);
  assert.deepEqual(s.pickups.map(p => p.upgrade), ['frost']);
  const clone = JSON.parse(JSON.stringify(s)) as MatchState;
  assert.equal(stateHash(s), stateHash(clone));
  const empty = game('moss-court');
  empty.config.upgrades = true;
  empty.config.enabledUpgrades = [];
  run(empty, RULES.pickupOffset);
  assert.equal(empty.pickups.length, 0);
});

test('local stage order rotates at round boundaries with the next arena spawns and resets switches', () => {
  const s = game('moss-court');
  s.config.stageIds = ['tideglass-steps', 'lantern-foundry'];
  assert.equal(getArena(s).id, 'tideglass-steps');
  for (const id of ['lantern-foundry', 'tideglass-steps', 'lantern-foundry']) {
    s.phase = 'roundResults';
    s.phaseUntil = s.tick + 1;
    s.switches = { 'shutter-west': 999999 };
    step(s);
    assert.equal(getArena(s).id, id);
    assert.equal(s.phase, 'countdown');
    assert.deepEqual(s.switches, {});
    assert.deepEqual({ x: s.players[0]!.x, y: s.players[0]!.y },
      getArena(s).spawns[(s.round - 1) % getArena(s).spawns.length]);
  }
  const config = { ...s.config, stageIds: ['moonwell', 'moss-court'] };
  const first = createMatch(config, seats);
  assert.equal(getArena(first).id, 'moonwell');
  config.stageIds[0] = 'tideglass-steps';
  assert.equal(getArena(first).id, 'moonwell', 'stage sequence is copied into the running state');
  assert.throws(() => createMatch({ ...config, stageIds: [] }, seats), /Stage order/);
  assert.throws(() => createMatch({ ...config, stageIds: ['missing'] }, seats), /Stage order/);
  assert.throws(() => createMatch({ ...config, stageIds: Array(7).fill('moss-court') }, seats), /Stage order/);
});
