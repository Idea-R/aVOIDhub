import { describe, expect, it } from 'vitest';
import {
  FIXED_STEP_HZ,
  RUN_EVIDENCE_VERSION,
  RUN_RANDOM_ALGORITHM,
  RunRandomStreams,
  VOIDAVOID_RULESET,
  calculateComboBonus,
  calculateMeteorScore,
  calculatePerfectKnockbackBonus,
  computeEvidenceIntegrity,
  verifyRunEvidence,
  type RunEvidence,
} from './index';

describe('VOIDaVOID evidence contract', () => {
  it('recomputes every ranked score category', () => {
    const seed = 42;
    const random = new RunRandomStreams(seed);
    const meteor = calculateMeteorScore(false, random.getStream('score').next());
    const unsigned: Omit<RunEvidence, 'integrity'> = {
      version: RUN_EVIDENCE_VERSION,
      ruleset: VOIDAVOID_RULESET,
      randomAlgorithm: RUN_RANDOM_ALGORITHM,
      seed,
      viewport: { width: 1280, height: 720, pixelRatio: 1 },
      fixedStepHz: FIXED_STEP_HZ,
      durationTicks: 600,
      events: [
        { tick: 20, type: 'meteor', isSuper: false, source: 'defense' },
        { tick: 30, type: 'combo-bonus', comboCount: 3, streakMultiplier: 1 },
        { tick: 31, type: 'perfect-bonus', destroyedCount: 3, streakMultiplier: 1 },
      ],
      truncated: false,
      final: {
        survival: 50,
        meteors: meteor,
        combos: calculateComboBonus(3, 1) + calculatePerfectKnockbackBonus(3, 1),
        total: 50 + meteor + calculateComboBonus(3, 1) + calculatePerfectKnockbackBonus(3, 1),
      },
      randomDraws: { world: 0, 'power-up': 0, chain: 0, score: 1, defense: 0 },
    };
    const evidence = { ...unsigned, integrity: computeEvidenceIntegrity(unsigned) };
    expect(verifyRunEvidence(evidence)).toEqual({ valid: true, recomputed: evidence.final, errors: [] });
  });

  it('rejects a client-authored score change', () => {
    const unsigned: Omit<RunEvidence, 'integrity'> = {
      version: RUN_EVIDENCE_VERSION,
      ruleset: VOIDAVOID_RULESET,
      randomAlgorithm: RUN_RANDOM_ALGORITHM,
      seed: 1,
      viewport: { width: 800, height: 600, pixelRatio: 1 },
      fixedStepHz: FIXED_STEP_HZ,
      durationTicks: 60,
      events: [],
      truncated: false,
      final: { survival: 6, meteors: 0, combos: 0, total: 6 },
      randomDraws: { world: 0, 'power-up': 0, chain: 0, score: 0, defense: 0 },
    };
    const evidence = { ...unsigned, integrity: computeEvidenceIntegrity(unsigned) };
    expect(verifyRunEvidence(evidence).valid).toBe(false);
  });
});
