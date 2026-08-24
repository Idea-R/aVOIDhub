import {
  FIXED_STEP_HZ,
  MAX_EVIDENCE_EVENTS,
  RUN_EVIDENCE_VERSION,
  RUN_RANDOM_ALGORITHM,
  VOIDAVOID_RULESET,
  computeEvidenceIntegrity,
  formatRunSeed,
  verifyRunEvidence,
  type RunEvidence,
  type RunEvidenceEvent,
  type RunRandomStreamName,
  type RunViewport,
  type ScoreBreakdown,
  type ScoreEvidenceEvent,
} from '@avoid/voidavoid-contract';

export {
  FIXED_STEP_HZ,
  MAX_EVIDENCE_EVENTS,
  RUN_EVIDENCE_VERSION,
  VOIDAVOID_RULESET,
  computeEvidenceIntegrity,
  verifyRunEvidence,
  type RunEvidence,
  type RunEvidenceEvent,
  type RunViewport,
} from '@avoid/voidavoid-contract';

export interface RunEvidenceSummary {
  ruleset: typeof VOIDAVOID_RULESET;
  seed: string;
  code: string;
  eventCount: number;
  status: 'active' | 'replayable-local' | 'invalid-local';
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
