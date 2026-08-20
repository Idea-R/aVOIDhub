import {
  calculateChainDetonationScore,
  calculateMeteorScore,
  calculateSurvivalScore,
  type ScoreBreakdown,
  type ScoreEvidenceEvent,
} from '../systems/ScoreSystem';
import {
  formatRunSeed,
  RUN_RANDOM_ALGORITHM,
  RunRandomStreams,
  type RunRandomStreamName,
} from './seededRandom';

export const VOIDAVOID_RULESET = 'voidavoid-v2' as const;
export const RUN_EVIDENCE_VERSION = 1 as const;
export const FIXED_STEP_HZ = 60;
export const MAX_EVIDENCE_EVENTS = 4096;
export const MAX_RUN_TICKS = FIXED_STEP_HZ * 60 * 60 * 6;

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

export interface RunEvidenceSummary {
  ruleset: typeof VOIDAVOID_RULESET;
  seed: string;
  code: string;
  eventCount: number;
  status: 'active' | 'replayable-local' | 'invalid-local';
}

export interface RunEvidenceVerification {
  valid: boolean;
  recomputed: ScoreBreakdown;
  errors: string[];
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  )).join(',')}}`;
}

function evidencePayload(evidence: Omit<RunEvidence, 'integrity'>): string {
  return stableSerialize(evidence);
}

export function computeEvidenceIntegrity(evidence: Omit<RunEvidence, 'integrity'>): string {
  return `fnv1a32:${fnv1a32(evidencePayload(evidence))}`;
}

function emptyBreakdown(): ScoreBreakdown {
  return { survival: 0, meteors: 0, combos: 0, total: 0 };
}

export function verifyRunEvidence(evidence: RunEvidence): RunEvidenceVerification {
  const errors: string[] = [];
  const recomputed = emptyBreakdown();

  if (evidence.version !== RUN_EVIDENCE_VERSION) errors.push('Unsupported evidence version.');
  if (evidence.ruleset !== VOIDAVOID_RULESET) errors.push('Unsupported ruleset.');
  if (evidence.randomAlgorithm !== RUN_RANDOM_ALGORITHM) errors.push('Unsupported random algorithm.');
  if (evidence.fixedStepHz !== FIXED_STEP_HZ) errors.push('Unexpected fixed-step rate.');
  if (!Number.isInteger(evidence.seed) || evidence.seed < 0 || evidence.seed > 0xffffffff) {
    errors.push('Seed must be an unsigned 32-bit integer.');
  }
  if (!Number.isInteger(evidence.durationTicks) || evidence.durationTicks < 0 || evidence.durationTicks > MAX_RUN_TICKS) {
    errors.push('Run duration is outside the accepted local boundary.');
  }
  if (evidence.events.length > MAX_EVIDENCE_EVENTS || evidence.truncated) {
    errors.push('Evidence event limit was exceeded.');
  }
  if (!Number.isInteger(evidence.viewport.width) || evidence.viewport.width < 1 || evidence.viewport.width > 3840
    || !Number.isInteger(evidence.viewport.height) || evidence.viewport.height < 1 || evidence.viewport.height > 2160
    || evidence.viewport.pixelRatio !== 1) {
    errors.push('Viewport is outside the V2 replay contract.');
  }
  for (const key of ['survival', 'meteors', 'combos', 'total'] as const) {
    if (!Number.isInteger(evidence.final[key]) || evidence.final[key] < 0) {
      errors.push(`Final ${key} must be a non-negative integer.`);
    }
  }

  const random = new RunRandomStreams(evidence.seed);
  const scoreRandom = random.getStream('score');
  let previousTick = -1;
  let scoreDraws = 0;

  for (const event of evidence.events) {
    if (!Number.isInteger(event.tick) || event.tick < previousTick || event.tick > evidence.durationTicks) {
      errors.push('Evidence events are not in deterministic tick order.');
      break;
    }
    previousTick = event.tick;

    if (event.type === 'meteor') {
      if (typeof event.isSuper !== 'boolean'
        || (event.source !== 'defense' && event.source !== 'knockback')) {
        errors.push('Meteor evidence has an invalid shape.');
        break;
      }
      recomputed.meteors += calculateMeteorScore(event.isSuper, scoreRandom.next());
      scoreDraws += 1;
    } else if (event.type === 'chain-fragment') {
      recomputed.meteors += 10;
    } else if (event.type === 'chain-detonation') {
      if (!Number.isInteger(event.meteorsDestroyed) || event.meteorsDestroyed < 1 || event.meteorsDestroyed > 50) {
        errors.push('Chain detonation meteor count is outside the accepted boundary.');
        break;
      }
      recomputed.meteors += calculateChainDetonationScore(event.meteorsDestroyed);
    } else {
      errors.push('Evidence contains an unknown score event.');
      break;
    }
  }

  recomputed.survival = calculateSurvivalScore(evidence.durationTicks / FIXED_STEP_HZ);
  recomputed.total = recomputed.survival + recomputed.meteors + recomputed.combos;

  if (!Number.isInteger(evidence.randomDraws.score) || evidence.randomDraws.score !== scoreDraws) {
    errors.push('Score random draw count does not match the recorded score events.');
  }

  for (const key of ['survival', 'meteors', 'combos', 'total'] as const) {
    if (recomputed[key] !== evidence.final[key]) errors.push(`Final ${key} does not match the evidence replay.`);
  }

  const { integrity, ...unsignedEvidence } = evidence;
  if (integrity !== computeEvidenceIntegrity(unsignedEvidence)) errors.push('Evidence integrity code does not match.');

  return { valid: errors.length === 0, recomputed, errors };
}

export class RunEvidenceRecorder {
  private seed = 0;
  private viewport: RunViewport = { width: 1, height: 1, pixelRatio: 1 };
  private tick = 0;
  private events: RunEvidenceEvent[] = [];
  private truncated = false;
  private finalEvidence: RunEvidence | null = null;

  begin(seed: number, viewport: RunViewport): void {
    this.seed = seed >>> 0;
    this.viewport = { ...viewport };
    this.tick = 0;
    this.events = [];
    this.truncated = false;
    this.finalEvidence = null;
  }

  advanceTick(): void {
    if (!this.finalEvidence) this.tick += 1;
  }

  record(event: ScoreEvidenceEvent): void {
    if (this.finalEvidence) return;
    if (this.events.length >= MAX_EVIDENCE_EVENTS) {
      this.truncated = true;
      return;
    }
    this.events.push({ tick: this.tick, ...event });
  }

  finish(final: ScoreBreakdown, randomDraws: Record<RunRandomStreamName, number>): RunEvidence {
    if (this.finalEvidence) return this.finalEvidence;
    const unsignedEvidence: Omit<RunEvidence, 'integrity'> = {
      version: RUN_EVIDENCE_VERSION,
      ruleset: VOIDAVOID_RULESET,
      randomAlgorithm: RUN_RANDOM_ALGORITHM,
      seed: this.seed,
      viewport: { ...this.viewport },
      fixedStepHz: FIXED_STEP_HZ,
      durationTicks: this.tick,
      events: this.events.map((event) => ({ ...event })),
      truncated: this.truncated,
      final: { ...final },
      randomDraws: { ...randomDraws },
    };
    this.finalEvidence = {
      ...unsignedEvidence,
      integrity: computeEvidenceIntegrity(unsignedEvidence),
    };
    return this.finalEvidence;
  }

  getEvidence(): RunEvidence | null {
    return this.finalEvidence ? structuredClone(this.finalEvidence) : null;
  }

  getSummary(): RunEvidenceSummary {
    const seed = formatRunSeed(this.seed);
    if (!this.finalEvidence) {
      return { ruleset: VOIDAVOID_RULESET, seed, code: `${seed}-ACTIVE`, eventCount: this.events.length, status: 'active' };
    }
    const verification = verifyRunEvidence(this.finalEvidence);
    return {
      ruleset: VOIDAVOID_RULESET,
      seed,
      code: `${seed}-${this.finalEvidence.integrity.slice(-8).toUpperCase()}`,
      eventCount: this.finalEvidence.events.length,
      status: verification.valid ? 'replayable-local' : 'invalid-local',
    };
  }

  getTick(): number {
    return this.tick;
  }
}
