export * from './types';
export * from './content';
import { ARENAS, UPGRADES } from './content';
import { CONTENT_VERSION, NEUTRAL, RULESET, TICK_RATE } from './types';
import type {
  Arena,
  GameEvent,
  Input,
  MatchConfig,
  MatchState,
  Player,
  Seat,
  Vec,
  Weapon,
  UpgradeId,
  Hazard,
  MovingPlatform,
} from './types';
import {
  angleDelta,
  circleTOI,
  clamp,
  distance,
  inside,
  rectTOI,
  sectorTOI,
  unit,
} from './geometry';
export const RULES = Object.freeze({
  tickRate: TICK_RATE,
  playerRadius: 0.38,
  weaponRadius: 0.15,
  runSpeed: 5.2,
  acceleration: 45,
  deceleration: 55,
  dashSpeed: 15,
  dashTicks: 10,
  dashCooldown: 48,
  slashWindup: 3,
  slashActive: 6,
  slashRecovery: 12,
  slashReach: 1.2,
  slashArc: (110 * Math.PI) / 180,
  throwWindup: 3,
  throwSpeed: 13,
  throwRange: 7,
  returnSpeed: 16,
  curveTicks: 12,
  curveRate: (100 * Math.PI) / 180 / TICK_RATE,
  curveLimit: (20 * Math.PI) / 180,
  inputBuffer: 5,
  shieldGrace: 6,
  groundTimeout: 180,
  rematerializeTicks: 60,
  countdown: 180,
  roundResults: 120,
  warning: 2700,
  closing: 3600,
  roundLimit: 5400,
  relayDuration: 18000,
  relayDwell: 30,
  relayRespawn: 180,
  relayProtection: 60,
  relayPickupRadius: 0.75,
  relayTargetRadius: 1.15,
  relayDropLock: 30,
  relayDeliveryLock: 120,
  windForce: 2,
  conveyorSpeed: 1.2,
  gateLock: 12,
  gateExit: 0.7,
  frostSlow: 0.6,
  frostLife: 90,
  frostRadius: 0.7,
  frostInterval: 12,
  frostCap: 6,
  emberFuse: 60,
  emberRadius: 1.35,
  echoLife: 36,
  effectCap: 2,
  tailwindMultiplier: 1.3,
  magnetRadius: 0.95,
  twinFan: 0.12,
  pickupInterval: 480,
  pickupOffset: 240,
  pickupCap: 3,
  pickupRadius: 0.7,
  passiveCap: 2,
  shoveTicks: 12,
  stunDamping: 0.65,
  facingDeadzone: 0.15,
  moveDeadzone: 0.05,
  botEasyDelay: 24,
  botNormalDelay: 12,
  botHardDelay: 6,
  contactBudget: 64,
  simultaneousEpsilon: 0.0001,
});
type ControlMemory = {
  previous: Input;
  dash: number;
  slash: number;
  throw: number;
};
type BotMemory = {
  next: number;
  input: Input;
  nextAttack?: number;
  observed: {
    x: number;
    y: number;
    enemyX: number;
    enemyY: number;
    threatX: number;
    threatY: number;
    threat: boolean;
    away: boolean;
    carrier: boolean;
    targetX: number;
    targetY: number;
    // Optional fields keep previously serialized perception snapshots readable.
    enemyVx?: number;
    enemyVy?: number;
    hasEnemy?: boolean;
    clearShot?: boolean;
    held?: boolean;
    recall?: boolean;
    threatVx?: number;
    threatVy?: number;
    role?: 'combat' | 'seed' | 'deliver' | 'escort' | 'intercept';
  } | null;
};
export interface SimulationInternal {
  controls: Record<string, ControlMemory>;
  bots: Record<string, BotMemory>;
  timers: Record<string, number>;
}
const EPS = 1e-7;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const memory = (s: MatchState): SimulationInternal =>
  s.internal ?? (s.internal = { controls: {}, bots: {}, timers: {} });
export const getArena = (s: MatchState): Arena => {
  const stageId = s.config.stageIds?.length
    ? s.config.stageIds[(s.round - 1) % s.config.stageIds.length]!
    : s.config.mapId;
  return (s.config.arenaDraft && stageId === s.config.mapId ? s.config.arenaDraft : undefined)
    ?? ARENAS.find(a => a.id === stageId) ?? ARENAS[0]!;
};
const arena = getArena;
const sortedPlayers = (s: MatchState) =>
  [...s.players].sort((a, b) => compare(a.id, b.id));
const alive = (s: MatchState, id: string) =>
  s.players.find((p) => p.id === id && p.alive);
const weaponHeld = (s: MatchState, p: Player) =>
  s.weapons.some((w) => w.ownerId === p.id && w.phase === 'held');
const carrying = (s: MatchState, p: Player) =>
  s.config.mode === 'relay' && s.relay.carrierId === p.id;
function random(s: MatchState): number {
  let x = s.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
function emit(
  s: MatchState,
  type: string,
  p: Vec,
  actor?: string,
  target?: string,
  weaponId?: string,
  detail?: string,
): void {
  s.events.push({
    id: `e${s.nextId++}`,
    tick: s.tick,
    type,
    x: p.x,
    y: p.y,
    ...(actor ? { actor } : {}),
    ...(target ? { target } : {}),
    ...(weaponId ? { weaponId } : {}),
    ...(detail ? { detail } : {}),
  });
}
function input(raw: Input | undefined): Input {
  if (!raw) return { ...NEUTRAL };
  const finite = (v: number) => (Number.isFinite(v) ? clamp(v, -1, 1) : 0);
  let mx = finite(raw.mx),
    my = finite(raw.my),
    ax = finite(raw.ax),
    ay = finite(raw.ay);
  const m = Math.hypot(mx, my),
    a = Math.hypot(ax, ay);
  if (m > 1) {
    mx /= m;
    my /= m;
  }
  if (a > 1) {
    ax /= a;
    ay /= a;
  }
  return {
    mx,
    my,
    ax,
    ay,
    dash: raw.dash === true,
    slash: raw.slash === true,
    throw: raw.throw === true,
  };
}
function makeWeapon(s: MatchState, p: Player): Weapon {
  return {
    id: `w${s.nextId++}`,
    ownerId: p.id,
    attackerId: p.id,
    generation: 0,
    phase: 'held',
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    heading: 0,
    launchHeading: 0,
    phaseTick: s.tick,
    traveled: 0,
    ricochets: 0,
    harmless: false,
  };
}
function player(seat: Seat, pos: Vec): Player {
  return {
    ...seat,
    ...pos,
    vx: 0,
    vy: 0,
    fx: pos.x > 0 ? -1 : 1,
    fy: 0,
    alive: true,
    score: 0,
    kills: 0,
    dashUntil: 0,
    dashCooldown: 0,
    slashUntil: 0,
    slashStart: 0,
    slashCooldown: 0,
    throwAt: 0,
    stunUntil: 0,
    shieldGraceUntil: 0,
    respawnAt: 0,
    protectedUntil: 0,
    shield: false,
    upgrades: [],
  };
}
export function createMatch(config: MatchConfig, seats: Seat[]): MatchState {
  if (seats.length < 2 || seats.length > 6)
    throw new Error('A match needs two to six seats');
  if (
    new Set(seats.map((p) => p.id)).size !== seats.length ||
    seats.some((p) => !p.id)
  )
    throw new Error('Seat IDs must be unique and nonempty');
  if (!['ffa', 'teams', 'relay'].includes(config.mode))
    throw new Error('Unknown match mode');
  if (
    config.mode !== 'ffa' &&
    (seats.some((p) => p.team !== 0 && p.team !== 1) ||
      new Set(seats.map((p) => p.team)).size !== 2)
  )
    throw new Error('Team modes need two opposing teams numbered zero and one');
  if (config.stageIds && (!config.stageIds.length || config.stageIds.length > 6 ||
    config.stageIds.some(id => !ARENAS.some(a => a.id === id))))
    throw new Error('Stage order needs one to six canonical arena IDs');
  const stageId = config.stageIds?.[0] ?? config.mapId;
  const a = stageId === config.mapId && config.arenaDraft
    ? config.arenaDraft : ARENAS.find(a => a.id === stageId);
  if (!a) throw new Error('Unknown arena');
  if (a.spawns.length < seats.length) throw new Error('Arena needs a spawn for each seat');
  const s: MatchState = {
    version: `${RULESET}/${CONTENT_VERSION}`,
    tick: 0,
    round: 1,
    phase: 'countdown',
    phaseUntil: RULES.countdown,
    config: {
      ...config,
      ...(config.arenaDraft ? { arenaDraft: JSON.parse(JSON.stringify(config.arenaDraft)) as Arena } : {}),
      ...(config.enabledUpgrades ? { enabledUpgrades: [...config.enabledUpgrades] } : {}),
      ...(config.stageIds ? { stageIds: [...config.stageIds] } : {}),
      wins: clamp(Math.floor(config.wins) || 5, 1, 99),
      seed: config.seed >>> 0,
    },
    rng: config.seed >>> 0 || 0x9e3779b9,
    nextId: 1,
    players: seats.map((p, i) => player(p, a.spawns[i]!)),
    weapons: [],
    pickups: [],
    effects: [],
    events: [],
    roundStart: RULES.countdown,
    winnerIds: [],
    matchWinnerIds: [],
    relay: {
      carrierId: null,
      x: 0,
      y: 0,
      target: 0,
      progress: 0,
      lockUntil: 0,
      previousCarrier: null,
      previousLockUntil: 0,
      scores: [0, 0],
      endTick: RULES.countdown + RULES.relayDuration,
    },
    internal: { controls: {}, bots: {}, timers: {} },
    switches: {},
  };
  for (const p of sortedPlayers(s)) s.weapons.push(makeWeapon(s, p));
  return s;
}
export function restartMatch(s: MatchState): MatchState {
  return createMatch(
    s.config,
    s.players.map(({ id, name, character, color, team, bot }) => ({
      id,
      name,
      character,
      color,
      team,
      bot,
    })),
  );
}
function isActive(
  s: MatchState,
  h: {
    period: number;
    offset: number;
    active: number;
  },
): boolean {
  return (
    (((s.tick - s.roundStart + h.offset) % h.period) + h.period) % h.period <
    h.active
  );
}
function solidRects(s: MatchState) {
  return [
    ...arena(s).obstacles,
    ...arena(s).hazards.filter((h) => h.kind === 'shutter' && isShutterClosed(s, h)),
  ];
}
export function isShutterClosed(s: MatchState, h: Hazard): boolean {
  return h.kind === 'shutter' && (s.switches?.[h.id] ?? 0) <= s.tick && isActive(s, h);
}
export function platformPosition(s: MatchState, p: MovingPlatform, tick = s.tick): Vec {
  const elapsed = Math.max(0, tick - s.roundStart);
  const phase = ((elapsed + p.offset) % p.period + p.period) % p.period / p.period;
  const amount = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return { x: p.x + (p.to.x - p.x) * amount, y: p.y + (p.to.y - p.y) * amount };
}
function pressurePlates(s: MatchState): void {
  for (const plate of arena(s).switches ?? []) {
    const occupant = sortedPlayers(s).find(p => p.alive && inside(p, plate));
    if (!occupant) continue;
    const overrides = s.switches ?? (s.switches = {});
    if ((overrides[plate.target] ?? 0) <= s.tick)
      emit(s, 'switch', plate, occupant.id, undefined, undefined, plate.id);
    overrides[plate.target] = s.tick + plate.duration;
  }
}

/** Interval in [0,1] during which a swept point lies in an axis-aligned rectangle. */
function rectInterval(start: Vec, end: Vec, rect: Vec & { w: number; h: number }): [number, number] | null {
  let lo = 0, hi = 1;
  for (const [position, delta, center, size] of [
    [start.x, end.x - start.x, rect.x, rect.w],
    [start.y, end.y - start.y, rect.y, rect.h],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (Math.abs(position - center) > size / 2) return null;
    } else {
      const a = (center - size / 2 - position) / delta;
      const b = (center + size / 2 - position) / delta;
      lo = Math.max(lo, Math.min(a, b));
      hi = Math.min(hi, Math.max(a, b));
      if (lo > hi) return null;
    }
  }
  return [lo, hi];
}
/** Earliest unsupported pit contact. Floor support is swept relative to the moving platform. */
function pitContact(s: MatchState, gap: Hazard, start: Vec, end: Vec, from = 0): number | null {
  const interval = rectInterval(start, end, gap);
  if (!interval) return null;
  const supports: [number, number][] = [];
  for (const p of arena(s).platforms ?? []) {
    const previous = platformPosition(s, p, s.tick - 1);
    const current = platformPosition(s, p);
    const atStart = { x: previous.x + (current.x - previous.x) * from,
      y: previous.y + (current.y - previous.y) * from };
    const supported = rectInterval({ x: start.x - atStart.x, y: start.y - atStart.y },
      { x: end.x - current.x, y: end.y - current.y }, { x: 0, y: 0, w: p.w, h: p.h });
    if (supported) supports.push(supported);
  }
  let cursor = interval[0];
  for (const [lo, hi] of supports.sort((a, b) => a[0] - b[0])) {
    if (hi < cursor - EPS) continue;
    if (lo > cursor + EPS) return cursor;
    cursor = Math.max(cursor, hi);
    if (cursor >= interval[1] - EPS) return null;
  }
  return cursor;
}
function movePlayer(s: MatchState, p: Player, dx: number, dy: number): void {
  const a = arena(s);
  let start = { x: p.x, y: p.y },
    remaining = { x: dx, y: dy };
  // A shutter can close around a stationary seat. Resolve its overlap toward the nearest open edge.
  for (const r of solidRects(s))
    if (inside(start, r, RULES.playerRadius - EPS)) {
      const left = r.x - r.w / 2 - RULES.playerRadius,
        right = r.x + r.w / 2 + RULES.playerRadius,
        top = r.y - r.h / 2 - RULES.playerRadius,
        bottom = r.y + r.h / 2 + RULES.playerRadius;
      const edges = [
        { d: start.x - left, x: left - EPS, y: start.y },
        { d: right - start.x, x: right + EPS, y: start.y },
        { d: start.y - top, x: start.x, y: top - EPS },
        { d: bottom - start.y, x: start.x, y: bottom + EPS },
      ].sort((a, b) => a.d - b.d);
      start = { x: edges[0]!.x, y: edges[0]!.y };
    }
  for (let i = 0; i < 3; i++) {
    let hit: {
      t: number;
      nx: number;
      ny: number;
    } | null = null;
    const end = { x: start.x + remaining.x, y: start.y + remaining.y };
    for (const r of solidRects(s)) {
      const q = rectTOI(start, end, r, RULES.playerRadius);
      if (q && (!hit || q.t < hit.t)) hit = q;
    }
    if (!hit) {
      start = end;
      break;
    }
    const t = Math.max(0, hit.t - EPS);
    start = { x: start.x + remaining.x * t, y: start.y + remaining.y * t };
    remaining = { x: remaining.x * (1 - t), y: remaining.y * (1 - t) };
    if (hit.nx) {
      remaining.x = 0;
      p.vx = 0;
    }
    if (hit.ny) {
      remaining.y = 0;
      p.vy = 0;
    }
    if (!hit.nx && !hit.ny) break;
  }
  p.x = clamp(
    start.x,
    -a.width / 2 + RULES.playerRadius,
    a.width / 2 - RULES.playerRadius,
  );
  p.y = clamp(
    start.y,
    -a.height / 2 + RULES.playerRadius,
    a.height / 2 - RULES.playerRadius,
  );
}
function effect(
  s: MatchState,
  kind: 'frost' | 'ember' | 'echo',
  p: Vec,
  ownerId: string,
): void {
  const same = s.effects.filter(
    (e) => e.ownerId === ownerId && e.kind === kind,
  );
  if (same.length >= (kind === 'frost' ? RULES.frostCap : RULES.effectCap))
    return;
  s.effects.push({
    id: `fx${s.nextId++}`,
    kind,
    x: p.x,
    y: p.y,
    ownerId,
    start: s.tick,
    end:
      s.tick +
      (kind === 'ember'
        ? RULES.emberFuse
        : kind === 'frost'
          ? RULES.frostLife
          : RULES.echoLife),
    radius:
      kind === 'ember'
        ? RULES.emberRadius
        : kind === 'frost'
          ? RULES.frostRadius
          : RULES.playerRadius,
    triggered: false,
  });
}
function grounded(s: MatchState, w: Weapon): void {
  w.phase = 'grounded';
  w.phaseTick = s.tick;
  w.vx = 0;
  w.vy = 0;
  memory(s).timers[`stuck:${w.id}`] ??= s.tick;
  emit(s, 'ground', w, w.attackerId, undefined, w.id);
  const p = alive(s, w.ownerId);
  if (p?.upgrades.includes('ember') && !w.harmless)
    effect(s, 'ember', w, w.attackerId);
}
function dropSeed(s: MatchState, p: Player): void {
  if (!carrying(s, p)) return;
  s.relay.carrierId = null;
  s.relay.x = p.x;
  s.relay.y = p.y;
  s.relay.progress = 0;
  s.relay.previousCarrier = p.id;
  s.relay.previousLockUntil = s.tick + RULES.relayDropLock;
  emit(s, 'seedDrop', p, p.id);
}
/** Server disconnect boundary: drops the objective without eliminating or granting immunity. */
export function releaseRelaySeed(s: MatchState, seatId: string): void {
  const p = s.players.find((p) => p.id === seatId);
  if (p) dropSeed(s, p);
}
function eliminate(
  s: MatchState,
  p: Player,
  attacker?: string,
  detail = 'weapon',
): void {
  if (!p.alive) return;
  dropSeed(s, p);
  p.alive = false;
  p.vx = 0;
  p.vy = 0;
  p.dashUntil = 0;
  p.slashUntil = 0;
  p.respawnAt = s.config.mode === 'relay' ? s.tick + RULES.relayRespawn : 0;
  for (const w of s.weapons.filter((w) => w.ownerId === p.id)) {
    w.phase = 'inert';
    w.harmless = true;
    w.vx = 0;
    w.vy = 0;
  }
  const a = s.players.find((a) => a.id === attacker);
  if (a && a.id !== p.id && (s.config.mode === 'ffa' || a.team !== p.team))
    a.kills++;
  emit(s, 'death', p, attacker, p.id, undefined, detail);
}
function mayDamage(s: MatchState, attackerId: string, target: Player): boolean {
  const a = alive(s, attackerId);
  return (
    !!a &&
    a.id !== target.id &&
    (s.config.mode === 'ffa' || s.config.friendlyFire || a.team !== target.team)
  );
}
function defense(s: MatchState, p: Player, attackerId?: string): boolean {
  if (p.protectedUntil > s.tick) return true;
  if (
    attackerId &&
    carrying(s, p) &&
    s.players.find((a) => a.id === attackerId)?.team !== p.team
  )
    dropSeed(s, p);
  if (p.shieldGraceUntil > s.tick) return true;
  if (p.shield) {
    p.shield = false;
    p.shieldGraceUntil = s.tick + RULES.shieldGrace;
    emit(s, 'shield', p, attackerId, p.id);
    return true;
  }
  return false;
}
function armed(s: MatchState, p: Player): boolean {
  return weaponHeld(s, p) && !carrying(s, p);
}
function slashActive(s: MatchState, p: Player): boolean {
  return p.slashStart <= s.tick && p.slashUntil > s.tick && p.slashCooldown > 0;
}
function beginReturn(s: MatchState, w: Weapon, harmless = w.harmless): void {
  w.phase = 'returning';
  w.phaseTick = s.tick;
  w.harmless = harmless;
  w.attackerId = w.ownerId;
}
function controls(
  s: MatchState,
  inputs: Record<string, Input>,
): Record<string, Input> {
  const result: Record<string, Input> = {};
  const mem = memory(s);
  for (const p of sortedPlayers(s)) {
    const i = input(inputs[p.id]);
    result[p.id] = i;
    const c =
      mem.controls[p.id] ??
      (mem.controls[p.id] = {
        previous: { ...NEUTRAL },
        dash: -1,
        slash: -1,
        throw: -1,
      });
    for (const key of ['dash', 'slash', 'throw'] as const)
      if (i[key] && !c.previous[key]) c[key] = s.tick + RULES.inputBuffer;
    c.previous = i;
    if (!p.alive || s.phase !== 'playing') {
      c.dash = c.slash = c.throw = -1;
      continue;
    }
    if (Math.hypot(i.ax, i.ay) > RULES.facingDeadzone) {
      const u = unit(i.ax, i.ay);
      p.fx = u.x;
      p.fy = u.y;
    } else if (
      Math.hypot(i.mx, i.my) > RULES.moveDeadzone &&
      p.dashUntil <= s.tick
    ) {
      const u = unit(i.mx, i.my);
      p.fx = u.x;
      p.fy = u.y;
    }
    if (p.stunUntil > s.tick) continue;
    if (c.dash >= s.tick && p.dashCooldown <= s.tick) {
      p.dashUntil = s.tick + RULES.dashTicks;
      p.dashCooldown = s.tick + RULES.dashCooldown;
      const dash = Math.hypot(i.mx, i.my) > RULES.moveDeadzone ? unit(i.mx, i.my) : { x: p.fx, y: p.fy };
      mem.timers[`dashx:${p.id}`] = dash.x;
      mem.timers[`dashy:${p.id}`] = dash.y;
      c.dash = -1;
      emit(s, 'dash', p, p.id);
      if (p.upgrades.includes('echo')) effect(s, 'echo', p, p.id);
    }
    if (c.slash >= s.tick && p.slashCooldown <= s.tick) {
      p.slashStart = s.tick + RULES.slashWindup;
      p.slashUntil = p.slashStart + RULES.slashActive;
      p.slashCooldown = p.slashUntil + RULES.slashRecovery;
      p.protectedUntil = 0;
      c.slash = -1;
      emit(s, armed(s, p) ? 'slash' : 'shove', p, p.id);
    }
    if (carrying(s, p)) c.throw = -1;
    if (c.throw >= s.tick && !carrying(s, p)) {
      const slots = s.weapons.filter((w) => w.ownerId === p.id);
      if (slots.every((w) => w.phase === 'held')) {
        p.throwAt = s.tick + RULES.throwWindup;
        p.protectedUntil = 0;
        for (const [index, w] of slots.entries()) {
          w.phase = 'windup';
          w.phaseTick = s.tick;
          w.heading =
            Math.atan2(p.fy, p.fx) +
            (slots.length === 2
              ? index === 0
                ? -RULES.twinFan
                : RULES.twinFan
              : 0);
          w.launchHeading = w.heading;
          w.generation++;
          w.ricochets = 0;
          w.traveled = 0;
          w.attackerId = p.id;
          w.harmless = false;
        }
        emit(s, 'throw', p, p.id);
      } else {
        let recalled = false;
        for (const w of slots)
          if (['outbound', 'grounded'].includes(w.phase)) {
            beginReturn(s, w);
            recalled = true;
          }
        if (recalled) emit(s, 'recall', p, p.id);
      }
      c.throw = -1;
    }
  }
  return result;
}
interface Path {
  start: Vec;
  end: Vec;
}
interface Contact {
  t: number;
  kind:
    | 'wall'
    | 'gate'
    | 'clash'
    | 'deflect'
    | 'catch'
    | 'hit'
    | 'slash'
    | 'shove'
    | 'hazard'
    | 'seed'
    | 'ember';
  id: string;
  w?: Weapon;
  other?: Weapon;
  p?: Player;
  a?: Player;
  nx?: number;
  ny?: number;
  gate?: Arena['hazards'][number];
  pit?: boolean;
}
const at = (path: Path, t: number): Vec => ({
  x: path.start.x + (path.end.x - path.start.x) * t,
  y: path.start.y + (path.end.y - path.start.y) * t,
});
function combat(s: MatchState, paths: Record<string, Path>): void {
  let now = 0;
  const deflected = new Set<string>(),
    resolved = new Set<string>();
  const mem = memory(s);
  const a = arena(s);
  const bursts: Contact[] = [];
  for (const e of s.effects.filter(
    (e) => e.kind === 'ember' && !e.triggered && s.tick >= e.end,
  )) {
    e.triggered = true;
    emit(s, 'emberBurst', e, e.ownerId);
    const attacker = alive(s, e.ownerId);
    if (!attacker) continue;
    for (const p of sortedPlayers(s))
      if (
        p.alive &&
        mayDamage(s, e.ownerId, p) &&
        distance(paths[p.id]!.start, e) <= e.radius + RULES.playerRadius
      )
        bursts.push({
          t: 0,
          kind: 'ember',
          id: `ember:${e.id}:${p.id}`,
          p,
          a: attacker,
        });
  }
  // Rebuild the remaining paths after each contact group: reflected or grounded paths never retain obsolete hits.
  for (
    let iteration = 0;
    iteration < RULES.contactBudget && now < 1 - EPS;
    iteration++
  ) {
    const flying = s.weapons
      .filter((w) => w.phase === 'outbound' || w.phase === 'returning')
      .sort((x, y) => compare(x.id, y.id));
    const ends = new Map<string, Vec>();
    for (const w of flying)
      ends.set(w.id, {
        x: w.x + (w.vx / TICK_RATE) * (1 - now),
        y: w.y + (w.vy / TICK_RATE) * (1 - now),
      });
    const contacts: Contact[] = [];
    const add = (c: Contact) => {
      if (!resolved.has(c.id)) contacts.push(c);
    };
    if (now === 0) for (const burst of bursts) add(burst);
    for (const w of flying) {
      const end = ends.get(w.id)!;
      for (const r of solidRects(s)) {
        const q = rectTOI(w, end, r, RULES.weaponRadius);
        if (q)
          add({
            t: now + q.t * (1 - now),
            kind: 'wall',
            id: `wall:${w.id}:${r.id}`,
            w,
            nx: q.nx,
            ny: q.ny,
          });
      }
      const bounds = [
        { id: 'left', x: -a.width / 2 - 1, y: 0, w: 2, h: a.height + 4 },
        { id: 'right', x: a.width / 2 + 1, y: 0, w: 2, h: a.height + 4 },
        { id: 'top', x: 0, y: -a.height / 2 - 1, w: a.width + 4, h: 2 },
        { id: 'bottom', x: 0, y: a.height / 2 + 1, w: a.width + 4, h: 2 },
      ];
      for (const r of bounds) {
        const q = rectTOI(w, end, r, RULES.weaponRadius);
        if (q)
          add({
            t: now + q.t * (1 - now),
            kind: 'wall',
            id: `wall:${w.id}:${r.id}`,
            w,
            nx: q.nx,
            ny: q.ny,
          });
      }
      for (const h of a.hazards)
        if (h.kind === 'gate' && (mem.timers[`gate:${w.id}`] ?? -1) < s.tick) {
          const q = rectTOI(w, end, h, RULES.weaponRadius);
          if (q)
            add({
              t: now + q.t * (1 - now),
              kind: 'gate',
              id: `gate:${w.id}:${h.id}`,
              w,
              gate: h,
            });
        }
      for (const p of sortedPlayers(s).filter((p) => p.alive)) {
        const pp = paths[p.id]!,
          start = at(pp, now);
        const q = circleTOI(
          w,
          end,
          start,
          pp.end,
          RULES.playerRadius + RULES.weaponRadius,
        );
        if (p.id === w.ownerId && w.phase === 'returning') {
          const radius = p.upgrades.includes('magnet')
            ? RULES.magnetRadius
            : RULES.playerRadius + RULES.weaponRadius;
          const c = circleTOI(w, end, start, pp.end, radius);
          if (c !== null)
            add({
              t: now + c * (1 - now),
              kind: 'catch',
              id: `catch:${w.id}`,
              w,
              p,
            });
          continue;
        }
        if (w.harmless || !mayDamage(s, w.attackerId, p)) continue;
        if (armed(s, p) && slashActive(s, p) && !deflected.has(w.id)) {
          const d = sectorTOI(
            start,
            pp.end,
            w,
            end,
            Math.atan2(p.fy, p.fx),
            RULES.slashReach + RULES.weaponRadius,
            RULES.slashArc / 2,
          );
          if (d !== null)
            add({
              t: now + d * (1 - now),
              kind: 'deflect',
              id: `deflect:${w.id}:${p.id}`,
              w,
              p,
            });
        }
        if (q !== null)
          add({
            t: now + q * (1 - now),
            kind: 'hit',
            id: `hit:${w.id}:${p.id}`,
            w,
            p,
          });
      }
    }
    for (let i = 0; i < flying.length; i++)
      for (let j = i + 1; j < flying.length; j++) {
        const w = flying[i]!,
          o = flying[j]!;
        if (w.ownerId === o.ownerId || w.harmless || o.harmless) continue;
        const q = circleTOI(
          w,
          ends.get(w.id)!,
          o,
          ends.get(o.id)!,
          RULES.weaponRadius * 2,
        );
        if (q !== null)
          add({
            t: now + q * (1 - now),
            kind: 'clash',
            id: `clash:${w.id}:${o.id}`,
            w,
            other: o,
          });
      }
    for (const p of sortedPlayers(s).filter((p) => p.alive)) {
      const pp = paths[p.id]!;
      const start = at(pp, now);
      if (
        s.config.mode === 'relay' &&
        !s.relay.carrierId &&
        s.tick >= s.relay.lockUntil &&
        p.protectedUntil <= s.tick &&
        !(
          p.id === s.relay.previousCarrier && s.tick < s.relay.previousLockUntil
        )
      ) {
        const q = circleTOI(
          start,
          pp.end,
          s.relay,
          s.relay,
          RULES.relayPickupRadius,
        );
        if (q !== null)
          add({ t: now + q * (1 - now), kind: 'seed', id: `seed:${p.id}`, p });
      }
      for (const h of a.hazards) {
        if (h.kind !== 'vent' && h.kind !== 'gap') continue;
        if (!isActive(s, h) || (h.kind === 'gap' && p.dashUntil > s.tick))
          continue;
        const t = h.kind === 'gap'
          ? pitContact(s, h, start, pp.end, now)
          : rectTOI(start, pp.end, h, 0)?.t ?? null;
        if (t !== null)
          add({
            t: now + t * (1 - now),
            kind: 'hazard',
            id: `hazard:${h.id}:${p.id}`,
            p,
            pit: h.kind === 'gap',
          });
      }
      if (s.config.mode !== 'relay' && s.tick - s.roundStart >= RULES.closing) {
        const margin = Math.min(
          7,
          (s.tick - s.roundStart - RULES.closing) / 240,
        );
        if (
          Math.abs(p.x) > a.width / 2 - margin ||
          Math.abs(p.y) > a.height / 2 - margin
        )
          add({ t: now, kind: 'hazard', id: `closing:${p.id}`, p });
      }
      if (!slashActive(s, p)) continue;
      for (const target of sortedPlayers(s).filter(
        (t) => t.alive && mayDamage(s, p.id, t),
      )) {
        const tp = paths[target.id]!,
          q = sectorTOI(
            start,
            pp.end,
            at(tp, now),
            tp.end,
            Math.atan2(p.fy, p.fx),
            RULES.slashReach + RULES.playerRadius,
            RULES.slashArc / 2,
          );
        if (q === null) continue;
        const t = now + q * (1 - now);
        const id = `slash:${p.id}:${p.slashStart}:${target.id}`;
        if ((mem.timers[`slashhit:${p.id}:${target.id}`] ?? -1) >= p.slashStart)
          continue;
        add({ t, kind: armed(s, p) ? 'slash' : 'shove', id, p: target, a: p });
      }
    }
    if (!contacts.length) {
      for (const w of flying) {
        const end = ends.get(w.id)!;
        w.traveled += distance(w, end);
        w.x = end.x;
        w.y = end.y;
      }
      break;
    }
    contacts.sort((a, b) => a.t - b.t || compare(a.id, b.id));
    const time = contacts[0]!.t;
    const group = contacts.filter(
      (c) => Math.abs(c.t - time) <= RULES.simultaneousEpsilon,
    );
    for (const w of flying) {
      const fraction = (time - now) / (1 - now),
        end = ends.get(w.id)!;
      const pos = {
        x: w.x + (end.x - w.x) * fraction,
        y: w.y + (end.y - w.y) * fraction,
      };
      w.traveled += distance(w, pos);
      w.x = pos.x;
      w.y = pos.y;
    }
    now = time;
    const invalid = new Set<string>();
    for (const c of group.filter(
      (c) => c.kind === 'wall' || c.kind === 'clash' || c.kind === 'gate',
    )) {
      resolved.add(c.id);
      const w = c.w!;
      if (invalid.has(w.id) || !['outbound', 'returning'].includes(w.phase))
        continue;
      if (c.kind === 'clash') {
        const o = c.other!;
        if (!['outbound', 'returning'].includes(o.phase)) continue;
        grounded(s, w);
        grounded(s, o);
        invalid.add(w.id);
        invalid.add(o.id);
        emit(s, 'clash', w, undefined, undefined, w.id);
      } else if (c.kind === 'gate') {
        const paired = a.hazards.find((h) => h.id === c.gate!.pair);
        if (paired) {
          const rotation = paired.angle - c.gate!.angle;
          const heading = Math.atan2(w.vy, w.vx) + rotation,
            speed = Math.hypot(w.vx, w.vy);
          w.x =
            paired.x +
            Math.cos(heading) * (RULES.gateExit + RULES.weaponRadius);
          w.y =
            paired.y +
            Math.sin(heading) * (RULES.gateExit + RULES.weaponRadius);
          w.vx = Math.cos(heading) * speed;
          w.vy = Math.sin(heading) * speed;
          w.heading = heading;
          w.launchHeading = heading;
          mem.timers[`gate:${w.id}`] = s.tick + RULES.gateLock;
          invalid.add(w.id);
          emit(s, 'gate', w, w.attackerId, undefined, w.id);
        }
      } else if (
        w.phase === 'outbound' &&
        alive(s, w.ownerId)?.upgrades.includes('skipstone') &&
        w.ricochets < 1 &&
        (c.nx || c.ny)
      ) {
        if (c.nx) w.vx = -w.vx;
        if (c.ny) w.vy = -w.vy;
        w.heading = Math.atan2(w.vy, w.vx);
        w.launchHeading = w.heading;
        w.ricochets++;
        w.x += (c.nx ?? 0) * EPS;
        w.y += (c.ny ?? 0) * EPS;
        invalid.add(w.id);
        emit(s, 'ricochet', w, w.attackerId, undefined, w.id);
      } else {
        grounded(s, w);
        invalid.add(w.id);
      }
    }
    for (const c of group.filter((c) => c.kind === 'deflect')) {
      resolved.add(c.id);
      const w = c.w!,
        p = c.p!;
      if (invalid.has(w.id) || !p.alive) continue;
      w.attackerId = p.id;
      w.phase = 'outbound';
      w.phaseTick = s.tick;
      w.heading = Math.atan2(p.fy, p.fx);
      w.launchHeading = w.heading;
      w.vx = p.fx * RULES.throwSpeed;
      w.vy = p.fy * RULES.throwSpeed;
      w.traveled = 0;
      deflected.add(w.id);
      invalid.add(w.id);
      emit(s, 'deflect', w, p.id, w.ownerId, w.id);
    }
    for (const c of group.filter((c) => c.kind === 'catch')) {
      resolved.add(c.id);
      const w = c.w!,
        p = c.p!;
      if (invalid.has(w.id) || !p.alive || w.phase !== 'returning') continue;
      w.phase = 'held';
      w.phaseTick = s.tick;
      w.harmless = false;
      w.attackerId = p.id;
      w.x = p.x;
      w.y = p.y;
      w.vx = 0;
      w.vy = 0;
      delete mem.timers[`stuck:${w.id}`];
      invalid.add(w.id);
      emit(s, 'catch', p, p.id, undefined, w.id);
    }
    const seedContact = group
      .filter((c) => c.kind === 'seed')
      .sort((a, b) => {
        if (a.t !== b.t) return a.t - b.t;
        // Only exact arrival ties use a seeded seat rank; earlier contact always wins.
        // Pure arbitration leaves world RNG and all other contact ordering untouched.
        const priority = (id: string) => {
          let h = s.config.seed ^ Math.imul(s.round, 0x9e3779b9) ^ Math.imul(s.tick, 0x85ebca6b);
          for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
          h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
          return h >>> 0;
        };
        return priority(a.p!.id) - priority(b.p!.id) || compare(a.p!.id, b.p!.id);
      })[0];
    for (const c of group.filter((c) => c.kind === 'seed')) resolved.add(c.id);
    if (seedContact && !s.relay.carrierId) {
      const p = seedContact.p!;
      s.relay.carrierId = p.id;
      s.relay.progress = 0;
      emit(s, 'seedPickup', p, p.id);
      for (const w of s.weapons.filter(
        (w) =>
          w.ownerId === p.id &&
          !['held', 'inert', 'rematerializing'].includes(w.phase),
      )) {
        beginReturn(s, w, true);
        const u = unit(p.x - w.x, p.y - w.y);
        w.vx = u.x * RULES.returnSpeed;
        w.vy = u.y * RULES.returnSpeed;
        invalid.add(w.id);
      }
    }
    const hits = new Map<string, Contact[]>();
    for (const c of group.filter((c) =>
      ['hit', 'slash', 'shove', 'hazard', 'ember'].includes(c.kind),
    )) {
      resolved.add(c.id);
      if (!c.p!.alive || (c.w && invalid.has(c.w.id)) || (c.a && !c.a.alive))
        continue;
      if (c.kind === 'shove' || (c.kind === 'slash' && carrying(s, c.a!))) {
        mem.timers[`slashhit:${c.a!.id}:${c.p!.id}`] = c.a!.slashStart;
        c.p!.stunUntil = s.tick + RULES.shoveTicks;
        if (c.a!.team !== c.p!.team) dropSeed(s, c.p!);
        emit(s, 'shoveHit', c.p!, c.a!.id, c.p!.id);
        continue;
      }
      if (c.kind === 'slash')
        mem.timers[`slashhit:${c.a!.id}:${c.p!.id}`] = c.a!.slashStart;
      const list = hits.get(c.p!.id) ?? [];
      list.push(c);
      hits.set(c.p!.id, list);
    }
    const deaths: {
      p: Player;
      attacker?: string;
      detail: string;
    }[] = [];
    for (const [id, list] of hits) {
      const p = alive(s, id)!;
      list.sort((a, b) => a.t - b.t || compare(a.id, b.id));
      const chosen = list[0]!,
        attacker = chosen.w?.attackerId ?? chosen.a?.id;
      const fell = list.some(c => c.pit);
      const defended = !fell && defense(s, p, attacker);
      for (const c of list)
        if (c.w) {
          grounded(s, c.w);
          invalid.add(c.w.id);
        }
      if (!defended)
        deaths.push({
          p,
          attacker,
          detail: fell ? 'fall' : list
            .map((c) => c.w?.attackerId ?? c.a?.id ?? 'hazard')
            .join(','),
        });
    }
    // Capture the whole simultaneous group before invalidating any attacker's weapons.
    for (const d of deaths) eliminate(s, d.p, d.attacker, d.detail);
    if (time >= 1 - EPS) break;
    if (group.length === 0) break;
  }
}
function resetRound(s: MatchState): void {
  s.round++;
  const a = arena(s);
  s.phase = 'countdown';
  s.phaseUntil = s.tick + RULES.countdown;
  s.roundStart = s.phaseUntil;
  s.winnerIds = [];
  s.weapons = [];
  s.pickups = [];
  s.effects = [];
  s.switches = {};
  s.internal = { controls: {}, bots: {}, timers: {} };
  s.players = s.players.map((p, i) => ({
    ...player(p, a.spawns[(i + s.round - 1) % a.spawns.length]!),
    score: p.score,
    kills: p.kills,
  }));
  for (const p of sortedPlayers(s)) s.weapons.push(makeWeapon(s, p));
}
function finishRound(s: MatchState, winners: Player[]): void {
  if (s.phase !== 'playing') return;
  s.winnerIds = winners.map((p) => p.id).sort();
  for (const p of winners) p.score++;
  const match = winners.some((p) => p.score >= s.config.wins);
  s.phase = match ? 'matchResults' : 'roundResults';
  s.phaseUntil = s.tick + RULES.roundResults;
  if (match) s.matchWinnerIds = [...s.winnerIds];
  emit(
    s,
    match ? 'matchEnd' : 'roundEnd',
    { x: 0, y: 0 },
    undefined,
    undefined,
    undefined,
    s.winnerIds.join(','),
  );
}
function grantUpgrade(s: MatchState, p: Player, id: UpgradeId): void {
  if (id === 'guard') {
    p.shield = true;
    emit(s, 'upgrade', p, p.id, undefined, undefined, id);
    return;
  }
  if (p.upgrades.includes(id)) return;
  if (p.upgrades.length >= RULES.passiveCap) {
    const replaced = p.upgrades.shift()!;
    emit(s, 'upgradeReplaced', p, p.id, undefined, undefined, replaced);
    if (replaced === 'twin') {
      const slots = s.weapons.filter((w) => w.ownerId === p.id);
      const keep = slots.find((w) => w.phase === 'held') ?? slots[0];
      s.weapons = s.weapons.filter((w) => w.ownerId !== p.id || w === keep);
    }
  }
  p.upgrades.push(id);
  if (id === 'twin' && s.weapons.filter((w) => w.ownerId === p.id).length < 2)
    s.weapons.push(makeWeapon(s, p));
  emit(s, 'upgrade', p, p.id, undefined, undefined, id);
}
function pickups(s: MatchState, paths: Record<string, Path>): void {
  if (!s.config.upgrades) return;
  const pool = UPGRADES.filter(u => !s.config.enabledUpgrades || s.config.enabledUpgrades.includes(u.id));
  if (
    (s.tick - s.roundStart) % RULES.pickupInterval === RULES.pickupOffset &&
    s.pickups.length < RULES.pickupCap && pool.length > 0
  ) {
    const a = arena(s);
    for (let n = 0; n < 20; n++) {
      const pos = {
        x: (random(s) - 0.5) * (a.width - 4),
        y: (random(s) - 0.5) * (a.height - 4),
      };
      if (
        solidRects(s).some((r) => inside(pos, r, 0.8)) ||
        a.hazards.some((h) => inside(pos, h, 1))
      )
        continue;
      const id = pool[Math.floor(random(s) * pool.length)]!.id;
      s.pickups.push({
        id: `pickup${s.nextId++}`,
        upgrade: id,
        ...pos,
        spawnTick: s.tick,
      });
      emit(s, 'pickupSpawn', pos, undefined, undefined, undefined, id);
      break;
    }
  }
  for (const pickup of [...s.pickups]) {
    const contacts = sortedPlayers(s)
      .filter((p) => p.alive)
      .map((p) => ({
        p,
        t: circleTOI(paths[p.id]!.start, paths[p.id]!.end, pickup, pickup, 0.7),
      }))
      .filter((c) => c.t !== null)
      .sort((a, b) => a.t! - b.t! || compare(a.p.id, b.p.id));
    if (contacts[0]) {
      grantUpgrade(s, contacts[0].p, pickup.upgrade);
      s.pickups = s.pickups.filter((p) => p.id !== pickup.id);
    }
  }
}
function relay(s: MatchState, paths: Record<string, Path>): void {
  const r = s.relay;
  const carrier = r.carrierId ? alive(s, r.carrierId) : undefined;
  if (carrier) {
    r.x = carrier.x;
    r.y = carrier.y;
    const target = arena(s).targets[r.target % 2]!;
    if (distance(carrier, target) > RULES.relayTargetRadius) r.progress = 0;
    else if (
      !s.players.some(
        (p) =>
          p.alive &&
          p.team !== carrier.team &&
          distance(p, target) <= RULES.relayTargetRadius,
      )
    )
      r.progress++;
    if (r.progress >= RULES.relayDwell) {
      r.scores[carrier.team] = (r.scores[carrier.team] ?? 0) + 1;
      emit(
        s,
        'delivery',
        carrier,
        carrier.id,
        undefined,
        undefined,
        String(r.scores[carrier.team]),
      );
      r.carrierId = null;
      r.x = 0;
      r.y = 0;
      r.progress = 0;
      r.target = (r.target + 1) % 2;
      r.lockUntil = s.tick + RULES.relayDeliveryLock;
      r.previousCarrier = null;
      if (r.scores[carrier.team]! >= 3) {
        finishRelay(s, carrier.team);
        return;
      }
    }
  }
  if (s.tick >= r.endTick && r.scores[0] !== r.scores[1])
    finishRelay(s, r.scores[0]! > r.scores[1]! ? 0 : 1);
}
function finishRelay(s: MatchState, team: number): void {
  s.winnerIds = s.players
    .filter((p) => p.team === team)
    .map((p) => p.id)
    .sort();
  s.matchWinnerIds = [...s.winnerIds];
  for (const p of s.players) p.score = rScore(s, p.team);
  s.phase = 'matchResults';
  s.phaseUntil = s.tick + RULES.roundResults;
  emit(
    s,
    'matchEnd',
    { x: 0, y: 0 },
    undefined,
    undefined,
    undefined,
    s.winnerIds.join(','),
  );
}
const rScore = (s: MatchState, team: number) => s.relay.scores[team] ?? 0;
function respawn(s: MatchState, p: Player): void {
  const a = arena(s);
  const valid = a.spawns.filter(
    (pos) =>
      !solidRects(s).some((r) => inside(pos, r, 0.6)) &&
      !a.hazards.some(
        (h) => ['gap', 'vent'].includes(h.kind) && inside(pos, h, 0.6),
      ),
  );
  const spawn =
    [...valid].sort(
      (x, y) =>
        Math.min(
          ...s.players
            .filter((t) => t.alive && t.team !== p.team)
            .map((t) => distance(y, t)),
          100,
        ) -
        Math.min(
          ...s.players
            .filter((t) => t.alive && t.team !== p.team)
            .map((t) => distance(x, t)),
          100,
        ),
    )[0] ?? a.spawns[0]!;
  const replacement = {
    ...player(p, spawn),
    score: p.score,
    kills: p.kills,
    upgrades: [...p.upgrades],
    protectedUntil: s.tick + RULES.relayProtection,
  };
  Object.assign(p, replacement);
  s.weapons = s.weapons.filter((w) => w.ownerId !== p.id);
  s.weapons.push(makeWeapon(s, p));
  if (p.upgrades.includes('twin')) s.weapons.push(makeWeapon(s, p));
  emit(s, 'respawn', p, p.id);
}
export function step(
  s: MatchState,
  rawInputs: Record<string, Input> = {},
): void {
  if (s.phase === 'matchResults') return;
  s.tick++;
  s.events = [];
  if (s.phase === 'roundResults') {
    controls(s, rawInputs);
    if (s.tick >= s.phaseUntil) resetRound(s);
    return;
  }
  if (s.phase === 'countdown' && s.tick >= s.phaseUntil) {
    s.phase = 'playing';
    s.roundStart = s.tick;
    emit(s, 'roundStart', { x: 0, y: 0 });
  }
  const carrier = s.players.find((p) => p.id === s.relay.carrierId);
  if (carrier && !carrier.alive) dropSeed(s, carrier);
  const inputs = controls(s, rawInputs);
  if (s.phase !== 'playing') return;
  const elapsed = s.tick - s.roundStart;
  if (elapsed === RULES.warning) emit(s, 'suddenDeathWarning', { x: 0, y: 0 });
  if (elapsed === RULES.closing) emit(s, 'arenaClosing', { x: 0, y: 0 });
  for (const h of arena(s).hazards)
    if (
      (h.kind === 'vent' || h.kind === 'shutter') &&
      (((elapsed + h.offset + 45) % h.period) + h.period) % h.period === 0
    )
      emit(s, 'hazardWarning', h, undefined, undefined, undefined, h.id);
  if (s.tick % 600 === 0) {
    const ids = new Set(s.weapons.map((w) => w.id));
    for (const key of Object.keys(memory(s).timers))
      if (
        (key.startsWith('gate:') && !ids.has(key.slice(5))) ||
        (key.startsWith('stuck:') && !ids.has(key.slice(6)))
      )
        delete memory(s).timers[key];
  }
  if (s.config.mode === 'relay')
    for (const p of s.players)
      if (!p.alive && p.respawnAt && s.tick >= p.respawnAt) respawn(s, p);
  pressurePlates(s);
  const paths: Record<string, Path> = {};
  for (const p of sortedPlayers(s)) {
    const start = { x: p.x, y: p.y };
    if (p.alive) {
      const i = inputs[p.id]!;
      let speed = RULES.runSpeed;
      if (
        s.effects.some(
          (e) =>
            e.kind === 'frost' &&
            e.ownerId !== p.id &&
            distance(p, e) < e.radius + RULES.playerRadius,
        )
      )
        speed *= RULES.frostSlow;
      if (p.dashUntil === s.tick) {
        p.vx = i.mx * speed;
        p.vy = i.my * speed;
      }
      if (p.stunUntil > s.tick) {
        p.vx *= RULES.stunDamping;
        p.vy *= RULES.stunDamping;
      } else if (p.dashUntil > s.tick) {
        p.vx = (memory(s).timers[`dashx:${p.id}`] ?? p.fx) * RULES.dashSpeed;
        p.vy = (memory(s).timers[`dashy:${p.id}`] ?? p.fy) * RULES.dashSpeed;
      } else {
        const tx = i.mx * speed,
          ty = i.my * speed,
          delta = unit(tx - p.vx, ty - p.vy),
          amount = Math.min(
            Math.hypot(tx - p.vx, ty - p.vy),
            (Math.hypot(i.mx, i.my) > RULES.moveDeadzone
              ? RULES.acceleration
              : RULES.deceleration) / TICK_RATE,
          );
        p.vx += delta.x * amount;
        p.vy += delta.y * amount;
      }
      let dx = p.vx / TICK_RATE,
        dy = p.vy / TICK_RATE;
      // Moving floors carry grounded riders, but an airborne dash remains committed.
      if (p.dashUntil <= s.tick) {
        const floor = (arena(s).platforms ?? []).find(platform =>
          inside(p, { ...platform, ...platformPosition(s, platform, s.tick - 1) }));
        if (floor) {
          const previous = platformPosition(s, floor, s.tick - 1);
          const current = platformPosition(s, floor);
          dx += current.x - previous.x;
          dy += current.y - previous.y;
        }
      }
      for (const h of arena(s).hazards)
        if (h.kind === 'conveyor' && inside(p, h)) {
          dx += (Math.cos(h.angle) * RULES.conveyorSpeed) / TICK_RATE;
          dy += (Math.sin(h.angle) * RULES.conveyorSpeed) / TICK_RATE;
        }
      movePlayer(s, p, dx, dy);
    }
    paths[p.id] = { start, end: { x: p.x, y: p.y } };
  }
  pressurePlates(s);
  for (const w of s.weapons) {
    const p = alive(s, w.ownerId);
    if (!p) {
      w.phase = 'inert';
      w.harmless = true;
      continue;
    }
    if (w.phase === 'held' || w.phase === 'windup') {
      w.x = p.x;
      w.y = p.y;
      if (w.phase === 'windup' && s.tick >= p.throwAt) {
        w.phase = 'outbound';
        w.phaseTick = s.tick;
        delete memory(s).timers[`stuck:${w.id}`];
        w.vx = Math.cos(w.heading) * RULES.throwSpeed;
        w.vy = Math.sin(w.heading) * RULES.throwSpeed;
      }
    }
    if (
      w.phase === 'grounded' &&
      s.tick - (memory(s).timers[`stuck:${w.id}`] ?? w.phaseTick) >=
        RULES.groundTimeout
    ) {
      w.phase = 'rematerializing';
      w.phaseTick = s.tick;
      w.harmless = true;
      emit(s, 'rematerialize', w, p.id, undefined, w.id);
    }
    if (
      w.phase === 'rematerializing' &&
      s.tick - w.phaseTick >= RULES.rematerializeTicks
    ) {
      w.phase = 'held';
      w.phaseTick = s.tick;
      w.x = p.x;
      w.y = p.y;
      w.harmless = false;
      w.attackerId = p.id;
      delete memory(s).timers[`stuck:${w.id}`];
      emit(s, 'catch', p, p.id, undefined, w.id);
    }
    if (w.phase === 'outbound') {
      if (w.traveled >= RULES.throwRange) beginReturn(s, w);
      else if (s.tick - w.phaseTick < RULES.curveTicks) {
        const i = inputs[w.attackerId] ?? NEUTRAL;
        const steer =
          -Math.sin(w.launchHeading) * i.mx + Math.cos(w.launchHeading) * i.my;
        w.heading =
          w.launchHeading +
          clamp(
            angleDelta(w.heading, w.launchHeading) + steer * RULES.curveRate,
            -RULES.curveLimit,
            RULES.curveLimit,
          );
        w.vx = Math.cos(w.heading) * RULES.throwSpeed;
        w.vy = Math.sin(w.heading) * RULES.throwSpeed;
      }
    }
    if (w.phase === 'returning') {
      const u = unit(p.x - w.x, p.y - w.y),
        speed =
          RULES.returnSpeed *
          (p.upgrades.includes('tailwind') ? RULES.tailwindMultiplier : 1);
      w.vx = u.x * speed;
      w.vy = u.y * speed;
      w.heading = Math.atan2(u.y, u.x);
    }
    if (w.phase === 'outbound' || w.phase === 'returning') {
      for (const h of arena(s).hazards)
        if (h.kind === 'wind' && inside(w, h)) {
          w.vx += Math.cos(h.angle) * RULES.windForce;
          w.vy += Math.sin(h.angle) * RULES.windForce;
        }
      if (
        p.upgrades.includes('frost') &&
        !w.harmless &&
        s.tick % RULES.frostInterval === 0
      )
        effect(s, 'frost', w, p.id);
    }
  }
  combat(s, paths);
  s.effects = s.effects.filter((e) =>
    e.kind === 'ember' ? s.tick <= e.end : s.tick < e.end,
  );
  pickups(s, paths);
  if (s.config.mode === 'relay') {
    relay(s, paths);
    return;
  }
  const living = s.players.filter((p) => p.alive);
  if (s.config.mode === 'ffa') {
    if (living.length <= 1) finishRound(s, living);
  } else {
    const teams = new Set(living.map((p) => p.team));
    if (teams.size <= 1)
      finishRound(
        s,
        teams.size ? s.players.filter((p) => p.team === living[0]!.team) : [],
      );
  }
  if (s.phase === 'playing' && elapsed >= RULES.roundLimit) finishRound(s, []);
}
/** Bot variation is independent of pickup/world RNG and stable under repeated reads. */
function botSample(s: MatchState, p: Player, tick: number, channel: string): number {
  let h = s.config.seed >>> 0;
  for (const c of `${p.id}:${tick}:${channel}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Local linear estimate, not a future simulation: curves and delayed changes can still beat it. */
function botThreatTime(p: Player, w: Weapon): number | null {
  const x = w.x - p.x, y = w.y - p.y, vx = w.vx - p.vx, vy = w.vy - p.vy;
  const speed2 = vx * vx + vy * vy, closing = x * vx + y * vy;
  if (speed2 < .01 || closing >= 0) return null;
  const t = -closing / speed2;
  return t <= .45 && Math.hypot(x + vx * t, y + vy * t) < .85 ? t : null;
}
export function getBotInputs(s: MatchState): Record<string, Input> {
  const result: Record<string, Input> = {};
  const mem = memory(s);
  for (const p of sortedPlayers(s).filter((p) => p.bot)) {
    const delay =
      p.bot === 'easy'
        ? RULES.botEasyDelay
        : p.bot === 'normal'
          ? RULES.botNormalDelay
          : RULES.botHardDelay;
    const b =
      mem.bots[p.id] ??
      (mem.bots[p.id] = {
        next: s.tick + delay,
        input: { ...NEUTRAL },
        observed: null,
      });
    if (!p.alive || s.phase !== 'playing') {
      result[p.id] = { ...NEUTRAL };
      continue;
    }
    if (s.tick >= b.next) {
      const old = b.observed;
      const carrier = s.config.mode === 'relay' && s.relay.carrierId ? alive(s, s.relay.carrierId) : undefined;
      const enemies = sortedPlayers(s)
        .filter(
          (t) =>
            t.alive &&
            t.id !== p.id &&
            (s.config.mode === 'ffa' || t.team !== p.team),
        )
        .sort(
          (a, b) => distance(p, a) - distance(p, b) || compare(a.id, b.id),
        );
      const enemy = p.bot !== 'easy' && carrier && carrier.team !== p.team ? carrier : enemies[0];
      const threat = s.weapons
        .filter(
          (w) =>
            (w.phase === 'outbound' || w.phase === 'returning') &&
            !w.harmless &&
            mayDamage(s, w.attackerId, p) &&
            distance(p, w) < 4 && botThreatTime(p, w) !== null,
        )
        .sort(
          (a, b) => botThreatTime(p, a)! - botThreatTime(p, b)! || compare(a.id, b.id),
        )[0];
      let target = carrying(s, p)
        ? arena(s).targets[s.relay.target % 2]!
        : s.config.mode === 'relay'
          ? { x: s.relay.x, y: s.relay.y }
          : (enemy ?? { x: 0, y: 0 });
      let role: NonNullable<BotMemory['observed']>['role'] = s.config.mode !== 'relay' ? 'combat' : carrying(s, p) ? 'deliver' : 'seed';
      if (s.config.mode === 'relay' && carrier && carrier.id !== p.id && p.bot !== 'easy') {
        const goal = arena(s).targets[s.relay.target % 2]!;
        if (carrier.team !== p.team) {
          role = 'intercept';
          const lead = p.bot === 'hard' ? .25 : .12;
          target = { x: carrier.x + carrier.vx * lead, y: carrier.y + carrier.vy * lead };
          if (distance(carrier, goal) < 2) target = goal; // Contest the delivery circle instead of trailing its carrier.
        } else {
          role = 'escort';
          const forward = unit(goal.x - carrier.x, goal.y - carrier.y);
          target = enemy && distance(enemy, carrier) < 6 ? enemy : { x: carrier.x - forward.x * 1.8 - forward.y, y: carrier.y - forward.y * 1.8 + forward.x };
        }
      }
      const ownWeapons = s.weapons.filter(w => w.ownerId === p.id);
      b.observed = {
        x: p.x,
        y: p.y,
        enemyX: enemy?.x ?? 0,
        enemyY: enemy?.y ?? 0,
        threatX: threat?.x ?? 0,
        threatY: threat?.y ?? 0,
        threat: !!threat,
        away: ownWeapons.some(w => w.phase !== 'held'),
        carrier: carrying(s, p),
        targetX: target.x,
        targetY: target.y,
        enemyVx: enemy?.vx ?? 0,
        enemyVy: enemy?.vy ?? 0,
        hasEnemy: !!enemy,
        clearShot: !!enemy && !solidRects(s).some(r => rectTOI(p, enemy, r, RULES.weaponRadius)),
        held: ownWeapons.length > 0 && ownWeapons.every(w => w.phase === 'held'),
        recall: ownWeapons.some(w => w.phase === 'grounded' || (w.phase === 'outbound' && w.traveled >= Math.min(RULES.throwRange - .4, (enemy ? distance(p, enemy) : RULES.throwRange) + .6))),
        threatVx: threat?.vx ?? 0,
        threatVy: threat?.vy ?? 0,
        role,
      };
      let next: Input = { ...NEUTRAL };
      if (old) {
        const range = Math.hypot(old.enemyX - old.x, old.enemyY - old.y);
        const lead = p.bot === 'easy' ? 0 : Math.min(p.bot === 'hard' ? .3 : .22, range / RULES.throwSpeed);
        const heading = Math.atan2(old.enemyY + (old.enemyVy ?? 0) * lead - old.y, old.enemyX + (old.enemyVx ?? 0) * lead - old.x);
        const error = (botSample(s, p, s.tick, 'aim') * 2 - 1) * (p.bot === 'easy' ? .22 : p.bot === 'normal' ? .09 : .06);
        let aim = { x: Math.cos(heading + error), y: Math.sin(heading + error) };
        const to = unit(old.targetX - old.x, old.targetY - old.y),
          side = botSample(s, p, 0, 'side') < .5 ? -1 : 1;
        let mx = to.x,
          my = to.y;
        if (s.config.mode !== 'relay' && range < 2.8) {
          mx = -to.x;
          my = -to.y;
        }
        if (s.config.mode !== 'relay' && p.bot !== 'easy' && range >= 2.8 && range < 5) {
          const advance = range > 4 ? .55 : .1;
          const strafe = unit(to.x * advance - to.y * side, to.y * advance + to.x * side);
          mx = strafe.x; my = strafe.y;
        }
        if (old.threat) {
          const velocity = unit(old.threatVx ?? 0, old.threatVy ?? 0);
          const away = unit(old.x - old.threatX, old.y - old.threatY);
          const normal = { x: -velocity.y, y: velocity.x };
          const dodge = Math.hypot(velocity.x, velocity.y) ? { x: normal.x * (normal.x * away.x + normal.y * away.y >= 0 ? 1 : -1), y: normal.y * (normal.x * away.x + normal.y * away.y >= 0 ? 1 : -1) } : away;
          mx = dodge.x;
          my = dodge.y;
        }
        const look = { x: p.x + mx * 1.2, y: p.y + my * 1.2 };
        const blocked = solidRects(s).some((r) =>
          rectTOI(p, look, r, RULES.playerRadius),
        );
        if (blocked) {
          const sign = side;
          [mx, my] = [-my * sign, mx * sign];
        }
        const inTarget =
          s.config.mode === 'relay' &&
          old.carrier &&
          Math.hypot(old.x - old.targetX, old.y - old.targetY) < 0.8;
        if (inTarget) {
          mx = 0;
          my = 0;
        }
        const parry = old.threat && p.bot !== 'easy' && p.slashCooldown <= s.tick && Math.hypot(old.threatX - old.x, old.threatY - old.y) < 1.7;
        if (parry) aim = unit(old.threatX - old.x, old.threatY - old.y);
        const attackReady = s.tick >= (b.nextAttack ?? 0);
        const recall = old.recall ?? old.away;
        const launch = (old.held ?? !old.away) && old.hasEnemy !== false && range > 1.5 && range < RULES.throwRange && (p.bot === 'easy' || old.clearShot !== false);
        const attack = !old.carrier && !parry && attackReady && (recall || launch) && botSample(s, p, s.tick, 'attack') > (p.bot === 'easy' ? .45 : p.bot === 'normal' ? .2 : .1);
        if (attack) b.nextAttack = s.tick + (p.bot === 'easy' ? 48 : p.bot === 'normal' ? 24 : 18);
        next = {
          mx,
          my,
          ax: aim.x,
          ay: aim.y,
          dash: old.threat && p.bot !== 'easy' && !parry && p.dashCooldown <= s.tick,
          slash: parry || (old.hasEnemy !== false && range < 1.55 && p.slashCooldown <= s.tick),
          throw: attack,
        };
      }
      b.input = next;
      b.next = s.tick + delay;
    }
    // Action pulses cannot become repeated automatic holds; movement persists between decisions.
    const command: Input = {
      ...b.input,
      dash: s.tick === b.next - delay && b.input.dash,
      slash: s.tick === b.next - delay && b.input.slash,
      throw: s.tick === b.next - delay && b.input.throw,
    };
    result[p.id] = safeBotMovement(s, p, command);
  }
  return result;
}
/** Environmental steering runs each tick, so delayed combat decisions cannot walk into pits. */
function safeBotMovement(s: MatchState, p: Player, command: Input): Input {
  // The next step restores walking on the exact end tick; steer that input before landing.
  if (p.dashUntil > s.tick + 1 || !Math.hypot(command.mx, command.my)) return command;
  const direction = unit(command.mx, command.my);
  const pits = arena(s).hazards.filter(h => h.kind === 'gap');
  const endpoint = (u: Vec, length: number) => ({ x: p.x + u.x * length, y: p.y + u.y * length });
  const a = arena(s);
  const fitsArena = (point: Vec) => Math.abs(point.x) <= a.width / 2 - RULES.playerRadius &&
    Math.abs(point.y) <= a.height / 2 - RULES.playerRadius;
  const isSafe = (u: Vec) => {
    const look = endpoint(u, 1.15);
    // Arena walls constrain the next walking step; retain the existing longer pit/cover probe.
    return fitsArena(endpoint(u, RULES.runSpeed / TICK_RATE)) &&
      !solidRects(s).some(r => rectTOI(p, look, r, RULES.playerRadius)) &&
      !pits.some(h => pitContact(s, h, p, look) !== null);
  };
  const landing = endpoint(direction, RULES.dashSpeed * RULES.dashTicks / TICK_RATE);
  const dashSafe = fitsArena(landing) && !solidRects(s).some(r => rectTOI(p, landing, r, RULES.playerRadius)) &&
    !pits.some(h => inside(landing, h, 0.25));
  const pitAhead = pits.some(h => pitContact(s, h, p, endpoint(direction, 1.15)) !== null);
  const canDash = p.bot !== 'easy' && p.dashCooldown <= s.tick + 1 && p.stunUntil <= s.tick;
  if (pitAhead && canDash && dashSafe) return { ...command, dash: true };
  if (isSafe(direction)) return { ...command, dash: command.dash && dashSafe };
  // Follow the nearest pit edge toward an outer route instead of waiting at a lethal lip.
  const gap = pits.find(h => pitContact(s, h, p, endpoint(direction, 1.15)) !== null);
  const tangent = gap && gap.h >= gap.w
    ? { x: 0, y: p.y >= gap.y ? 1 : -1 }
    : { x: p.x >= (gap?.x ?? 0) ? 1 : -1, y: 0 };
  const candidates = [tangent, { x: -tangent.x, y: -tangent.y },
    { x: -direction.y, y: direction.x }, { x: direction.y, y: -direction.x },
    { x: -direction.x, y: -direction.y }];
  const steer = candidates.find(isSafe) ?? { x: 0, y: 0 };
  return { ...command, mx: steer.x, my: steer.y, dash: false };
}
export function stateHash(s: MatchState): string {
  const canonical = (v: unknown): string => {
    if (v === null || typeof v !== 'object')
      return JSON.stringify(
        typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v,
      );
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => compare(a, b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  };
  const text = canonical({
    rules: RULES,
    content: ARENAS,
    upgrades: UPGRADES,
    state: s,
  });
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Admit a whole waiting local party only at a safe round boundary. */
export function addSeatsAtRoundBoundary(s:MatchState,seats:Seat[]):boolean {
 if(s.phase!=='countdown'||!seats.length||s.players.length+seats.length>6||new Set([...s.players,...seats].map(p=>p.id)).size!==s.players.length+seats.length)return false;
 if(s.config.mode!=='ffa'&&seats.some(p=>p.team!==0&&p.team!==1))return false;
 for(const seat of seats){const available=[...arena(s).spawns].sort((a,b)=>Math.min(...s.players.map(p=>Math.hypot(b.x-p.x,b.y-p.y)))-Math.min(...s.players.map(p=>Math.hypot(a.x-p.x,a.y-p.y))));const p=player(seat,available[0]);s.players.push(p);s.weapons.push(makeWeapon(s,p));}
 return true;
}
