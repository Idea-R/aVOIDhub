import { describe, expect, it } from 'vitest';
import {
  ScoreSystem,
  calculateChainDetonationScore,
  calculateComboBonus,
  calculateMeteorScore,
  calculatePerfectKnockbackBonus,
  calculateSurvivalScore,
} from './ScoreSystem';

describe('VOIDaVOID V0 score contract', () => {
  it('awards five survival points per completed second', () => {
    expect(calculateSurvivalScore(0)).toBe(0);
    expect(calculateSurvivalScore(12.9)).toBe(64);
    expect(calculateSurvivalScore(-3)).toBe(0);
  });

  it('keeps meteor random bonuses inside the documented bounds', () => {
    expect(calculateMeteorScore(false, 0)).toBe(5);
    expect(calculateMeteorScore(false, 1)).toBe(15);
    expect(calculateMeteorScore(true, 0)).toBe(15);
    expect(calculateMeteorScore(true, 1)).toBe(30);
  });

  it('preserves combo, perfect, and chain thresholds', () => {
    expect(calculateComboBonus(2, 3)).toBe(0);
    expect(calculateComboBonus(3, 1.5)).toBe(75);
    expect(calculateComboBonus(15, 3)).toBe(1500);
    expect(calculatePerfectKnockbackBonus(5, 2)).toBe(100);
    expect(calculateChainDetonationScore(0)).toBe(0);
    expect(calculateChainDetonationScore(3)).toBe(385);
    expect(calculateChainDetonationScore(20)).toBe(2650);
  });

  it('resets all score categories and combo state', () => {
    const scores = new ScoreSystem(() => 0);
    scores.updateSurvivalScore(10);
    scores.addMeteorScore(0, 0, false);
    scores.reset();
    expect(scores.getScoreBreakdown()).toEqual({ survival: 0, meteors: 0, combos: 0, total: 0 });
    expect(scores.getComboInfo()).toMatchObject({ count: 0, isActive: false, highestCombo: 0 });
  });
});
