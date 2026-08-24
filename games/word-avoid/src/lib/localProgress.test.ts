import { describe, expect, it } from 'vitest';
import type { GameSettings, GameStats } from '../types/game';
import {
  loadLocalSettings,
  loadLocalStats,
  saveLocalSettings,
  saveLocalStats,
  WORDAVOID_LEGACY_STATS_KEY,
  WORDAVOID_SETTINGS_KEY,
  WORDAVOID_STATS_KEY,
} from './localProgress';

const stats: GameStats = {
  totalGames: 2,
  totalWordsTyped: 18,
  totalCharactersTyped: 94,
  bestWPM: 42,
  bestAccuracy: 98,
  longestStreak: 11,
  totalPlaytime: 75,
  averageAccuracy: 91,
  improvementRate: 7,
};

const settings: GameSettings = {
  audio: { masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.8, spatialAudio: true, dynamicMusic: true },
  graphics: { particles: true, screenShake: true, backgroundAnimation: true, reducedMotion: false },
  gameplay: { showWPM: true, showAccuracy: true, showNextWords: true, autoCapitalize: false },
};

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('versioned local WORDaVOID progress', () => {
  it('migrates bounded legacy stats without deleting the legacy record', () => {
    const storage = memoryStorage({ [WORDAVOID_LEGACY_STATS_KEY]: JSON.stringify({ ...stats, bestAccuracy: 500 }) });
    const result = loadLocalStats(storage, { ...stats, totalGames: 0 });
    expect(result).toMatchObject({ status: 'migrated', value: { bestAccuracy: 100 } });
    expect(storage.values.has(WORDAVOID_STATS_KEY)).toBe(true);
    expect(storage.values.has(WORDAVOID_LEGACY_STATS_KEY)).toBe(true);
  });

  it('ignores corrupt progress and returns a clean recovery state', () => {
    const storage = memoryStorage({ [WORDAVOID_STATS_KEY]: '{broken', [WORDAVOID_LEGACY_STATS_KEY]: '{also-broken' });
    expect(loadLocalStats(storage, stats)).toEqual({ value: stats, status: 'recovered' });
  });

  it('round-trips versioned stats and settings', () => {
    const storage = memoryStorage();
    expect(saveLocalStats(storage, stats)).toBe(true);
    expect(saveLocalSettings(storage, settings)).toBe(true);
    expect(loadLocalStats(storage, { ...stats, totalGames: 0 })).toEqual({ value: stats, status: 'loaded' });
    expect(loadLocalSettings(storage, { ...settings, graphics: { ...settings.graphics, reducedMotion: true } })).toEqual({
      value: settings,
      status: 'loaded',
    });
    expect(storage.values.has(WORDAVOID_SETTINGS_KEY)).toBe(true);
  });
});
