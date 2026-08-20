import { describe, expect, it } from 'vitest';
import {
  calculateAccuracy,
  calculateWordScore,
  calculateWpm,
  DEFERRED_MODE_CONTRACTS,
  isV1GameMode,
  TIME_ATTACK_DURATION_MS,
  V1_MODE_CONTRACTS,
  WORDAVOID_MODE_CONTRACTS,
} from './v1';

describe('WORDaVOID V1 contract', () => {
  it('publishes only Classic and Time Attack as V1 modes', () => {
    expect(V1_MODE_CONTRACTS.map((mode) => mode.id)).toEqual(['classic', 'timeAttack']);
    expect(DEFERRED_MODE_CONTRACTS).toHaveLength(6);
    expect(WORDAVOID_MODE_CONTRACTS.map((mode) => mode.id)).toHaveLength(8);
    expect(new Set(WORDAVOID_MODE_CONTRACTS.map((mode) => mode.id)).size).toBe(8);
    expect(isV1GameMode('classic')).toBe(true);
    expect(isV1GameMode('perfectRun')).toBe(false);
  });

  it('locks Time Attack to two minutes', () => {
    expect(TIME_ATTACK_DURATION_MS).toBe(120_000);
  });

  it('calculates word score from explicit bounded inputs', () => {
    expect(calculateWordScore({
      length: 4,
      difficulty: 'easy',
      responseMs: 1_000,
      currentStreak: 2,
      level: 3,
    })).toBe(170);

    expect(calculateWordScore({
      length: 4,
      difficulty: 'hard',
      responseMs: 60_000,
      currentStreak: 0,
      level: 1,
    })).toBe(100);
  });

  it('allows honest accuracy below 60 percent and bounds malformed counters', () => {
    expect(calculateAccuracy(1, 3)).toBe(33);
    expect(calculateAccuracy(0, 4)).toBe(0);
    expect(calculateAccuracy(12, 4)).toBe(100);
    expect(calculateAccuracy(0, 0)).toBe(100);
  });

  it('uses five correct characters as one standardized word for WPM', () => {
    expect(calculateWpm(50, 60_000)).toBe(10);
    expect(calculateWpm(25, 30_000)).toBe(10);
    expect(calculateWpm(0, 60_000)).toBe(0);
  });
});
