export const VOIDAVOID_RULESET = 'voidavoid-v2' as const;
export const RUN_EVIDENCE_VERSION = 1 as const;
export const RUN_RANDOM_ALGORITHM = 'mulberry32-v1' as const;
export const FIXED_STEP_HZ = 60;
export const MAX_EVIDENCE_EVENTS = 4096;
export const MAX_RUN_TICKS = FIXED_STEP_HZ * 60 * 60 * 6;

export type RunRandomStreamName = 'world' | 'power-up' | 'chain' | 'score' | 'defense';

const STREAM_NAMES: RunRandomStreamName[] = ['world', 'power-up', 'chain', 'score', 'defense'];

export interface ScoreBreakdown {
  survival: number;
  meteors: number;
  combos: number;
  total: number;
}

export type ScoreEvidenceEvent =
  | { type: 'meteor'; isSuper: boolean; source: 'defense' | 'knockback' }
  | { type: 'chain-fragment' }
  | { type: 'chain-detonation'; meteorsDestroyed: number }
  | { type: 'combo-bonus'; comboCount: number; streakMultiplier: number }
  | { type: 'perfect-bonus'; destroyedCount: number; streakMultiplier: number };

export type RunEvidenceEvent = ScoreEvidenceEvent & { tick: number };

export interface RunViewport {
  width: number;
  height: number;
  pixelRatio: 1;
}

export interface RunEvidence {
  version: typeof RUN_EVIDENCE_VERSION;
  ruleset: typeof VOIDAVOID_RULESET;
  randomAlgorithm: typeof RUN_RANDOM_ALGORITHM;
  seed: number;
  viewport: RunViewport;
  fixedStepHz: typeof FIXED_STEP_HZ;
  durationTicks: number;
  events: RunEvidenceEvent[];
  truncated: boolean;
  final: ScoreBreakdown;
  randomDraws: Record<RunRandomStreamName, number>;
  integrity: string;
}

export interface VoidAvoidRunManifest {
  runId: string;
  seed: number;
  rulesetVersion: typeof VOIDAVOID_RULESET;
}

export interface RunEvidenceVerification {
  valid: boolean;
  recomputed: ScoreBreakdown;
  errors: string[];
}

function fnv1a32Number(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

export function normalizeRunSeed(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Run seed must be a finite number.');
    return Math.trunc(value) >>> 0;
  }
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Run seed cannot be empty.');
  if (/^(?:0x)?[0-9a-f]{1,8}$/i.test(trimmed)) return Number.parseInt(trimmed.replace(/^0x/i, ''), 16) >>> 0;
  return fnv1a32Number(trimmed);
}

export function deriveStreamSeed(runSeed: number, stream: RunRandomStreamName): number {
  return fnv1a32Number(`${runSeed >>> 0}:${stream}`);
}

export function formatRunSeed(runSeed: number): string {
  return (runSeed >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export class SeededRandom {
  private state = 0;
  private draws = 0;

  constructor(seed: number) { this.reset(seed); }

  reset(seed: number): void {
    this.state = seed >>> 0;
    this.draws = 0;
  }

  next = (): number => {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this.draws += 1;
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };

  getDrawCount(): number { return this.draws; }
}

export class RunRandomStreams {
  private runSeed = 0;
  private readonly streams = new Map<RunRandomStreamName, SeededRandom>();

  constructor(seed = 0) {
    for (const name of STREAM_NAMES) this.streams.set(name, new SeededRandom(deriveStreamSeed(seed, name)));
    this.runSeed = seed >>> 0;
  }

  reset(seed: number): void {
    this.runSeed = seed >>> 0;
    for (const name of STREAM_NAMES) this.getStream(name).reset(deriveStreamSeed(this.runSeed, name));
  }

  getSeed(): number { return this.runSeed; }

  getStream(name: RunRandomStreamName): SeededRandom {
    const stream = this.streams.get(name);
    if (!stream) throw new Error(`Unknown run random stream: ${name}`);
    return stream;
  }

  getDrawCounts(): Record<RunRandomStreamName, number> {
    return Object.fromEntries(STREAM_NAMES.map((name) => [name, this.getStream(name).getDrawCount()])) as Record<RunRandomStreamName, number>;
  }
}

export function calculateSurvivalScore(seconds: number): number {
  return Math.floor(Math.max(0, seconds) * 5);
}

export function calculateMeteorScore(isSuper: boolean, randomUnit: number): number {
  const clampedRandom = Math.min(0.999999, Math.max(0, randomUnit));
  return (isSuper ? 15 : 5) + Math.floor(clampedRandom * (isSuper ? 16 : 11));
}

export function calculateComboBonus(comboCount: number, streakMultiplier: number): number {
  let baseBonus = 0;
  if (comboCount >= 15) baseBonus = 500;
  else if (comboCount >= 12) baseBonus = 350;
  else if (comboCount >= 10) baseBonus = 250;
  else if (comboCount >= 8) baseBonus = 175;
  else if (comboCount >= 6) baseBonus = 125;
  else if (comboCount >= 5) baseBonus = 100;
  else if (comboCount >= 4) baseBonus = 75;
  else if (comboCount >= 3) baseBonus = 50;
  return Math.floor(baseBonus * Math.max(1, streakMultiplier));
}

export function calculatePerfectKnockbackBonus(destroyedCount: number, streakMultiplier: number): number {
  const baseBonus = destroyedCount >= 5 ? 50 : destroyedCount >= 4 ? 35 : destroyedCount >= 3 ? 25 : 0;
  return Math.floor(baseBonus * Math.max(1, streakMultiplier));
}

export function calculateChainDetonationScore(meteorsDestroyed: number): number {
  if (meteorsDestroyed <= 0) return 0;
  const multiplier = meteorsDestroyed >= 20 ? 4
    : meteorsDestroyed >= 15 ? 3
      : meteorsDestroyed >= 10 ? 2.5
        : meteorsDestroyed >= 5 ? 2
          : meteorsDestroyed >= 3 ? 1.5
            : 1;
  return 250 + Math.floor(meteorsDestroyed * 30 * multiplier);
}

export function computeEvidenceIntegrity(evidence: Omit<RunEvidence, 'integrity'>): string {
  return `fnv1a32:${fnv1a32Number(stableSerialize(evidence)).toString(16).padStart(8, '0')}`;
}

export function createVoidAvoidManifest(runId: string, seed: number): VoidAvoidRunManifest {
  return { runId, seed: normalizeRunSeed(seed), rulesetVersion: VOIDAVOID_RULESET };
}

export function verifyRunEvidence(evidence: RunEvidence): RunEvidenceVerification {
  const errors: string[] = [];
  const recomputed: ScoreBreakdown = { survival: 0, meteors: 0, combos: 0, total: 0 };

  if (evidence.version !== RUN_EVIDENCE_VERSION) errors.push('Unsupported evidence version.');
  if (evidence.ruleset !== VOIDAVOID_RULESET) errors.push('Unsupported ruleset.');
  if (evidence.randomAlgorithm !== RUN_RANDOM_ALGORITHM) errors.push('Unsupported random algorithm.');
  if (evidence.fixedStepHz !== FIXED_STEP_HZ) errors.push('Unexpected fixed-step rate.');
  if (!Number.isInteger(evidence.seed) || evidence.seed < 0 || evidence.seed > 0xffffffff) errors.push('Seed must be an unsigned 32-bit integer.');
  if (!Number.isInteger(evidence.durationTicks) || evidence.durationTicks < 0 || evidence.durationTicks > MAX_RUN_TICKS) errors.push('Run duration is outside the accepted boundary.');
  if (!Array.isArray(evidence.events) || evidence.events.length > MAX_EVIDENCE_EVENTS || evidence.truncated) errors.push('Evidence event limit was exceeded.');
  if (!Number.isInteger(evidence.viewport?.width) || evidence.viewport.width < 1 || evidence.viewport.width > 3840
    || !Number.isInteger(evidence.viewport?.height) || evidence.viewport.height < 1 || evidence.viewport.height > 2160
    || evidence.viewport.pixelRatio !== 1) errors.push('Viewport is outside the V2 replay contract.');

  const random = new RunRandomStreams(evidence.seed);
  const scoreRandom = random.getStream('score');
  let previousTick = -1;
  let scoreDraws = 0;
  for (const event of evidence.events ?? []) {
    if (!Number.isInteger(event.tick) || event.tick < previousTick || event.tick > evidence.durationTicks) {
      errors.push('Evidence events are not in deterministic tick order.');
      break;
    }
    previousTick = event.tick;
    if (event.type === 'meteor') {
      if (typeof event.isSuper !== 'boolean' || (event.source !== 'defense' && event.source !== 'knockback')) {
        errors.push('Meteor evidence has an invalid shape.');
        break;
      }
      recomputed.meteors += calculateMeteorScore(event.isSuper, scoreRandom.next());
      scoreDraws += 1;
    } else if (event.type === 'chain-fragment') {
      recomputed.meteors += 10;
    } else if (event.type === 'chain-detonation') {
      if (!Number.isInteger(event.meteorsDestroyed) || event.meteorsDestroyed < 1 || event.meteorsDestroyed > 50) {
        errors.push('Chain detonation count is outside the accepted boundary.');
        break;
      }
      recomputed.meteors += calculateChainDetonationScore(event.meteorsDestroyed);
    } else if (event.type === 'combo-bonus') {
      if (!Number.isInteger(event.comboCount) || event.comboCount < 3 || event.comboCount > 10_000
        || !Number.isFinite(event.streakMultiplier) || event.streakMultiplier < 1 || event.streakMultiplier > 3) {
        errors.push('Combo evidence is outside the accepted boundary.');
        break;
      }
      recomputed.combos += calculateComboBonus(event.comboCount, event.streakMultiplier);
    } else if (event.type === 'perfect-bonus') {
      if (!Number.isInteger(event.destroyedCount) || event.destroyedCount < 3 || event.destroyedCount > 10_000
        || !Number.isFinite(event.streakMultiplier) || event.streakMultiplier < 1 || event.streakMultiplier > 3) {
        errors.push('Perfect knockback evidence is outside the accepted boundary.');
        break;
      }
      recomputed.combos += calculatePerfectKnockbackBonus(event.destroyedCount, event.streakMultiplier);
    } else {
      errors.push('Evidence contains an unknown score event.');
      break;
    }
  }

  recomputed.survival = calculateSurvivalScore(evidence.durationTicks / FIXED_STEP_HZ);
  recomputed.total = recomputed.survival + recomputed.meteors + recomputed.combos;
  if (!Number.isInteger(evidence.randomDraws?.score) || evidence.randomDraws.score !== scoreDraws) errors.push('Score random draw count does not match the recorded score events.');
  for (const key of ['survival', 'meteors', 'combos', 'total'] as const) {
    if (!Number.isInteger(evidence.final?.[key]) || evidence.final[key] < 0 || recomputed[key] !== evidence.final[key]) errors.push(`Final ${key} does not match the evidence replay.`);
  }
  const { integrity, ...unsignedEvidence } = evidence;
  if (integrity !== computeEvidenceIntegrity(unsignedEvidence)) errors.push('Evidence integrity code does not match.');
  return { valid: errors.length === 0, recomputed, errors };
}
