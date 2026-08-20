import type { GameSettings, GameStats, LocalDataStatus } from '../types/game';

export const WORDAVOID_STATS_KEY = 'wordavoid-progress-v1';
export const WORDAVOID_LEGACY_STATS_KEY = 'wordavoid-stats';
export const WORDAVOID_SETTINGS_KEY = 'wordavoid-settings-v1';

const STORAGE_VERSION = 1;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type VersionedEnvelope<T> = {
  version: typeof STORAGE_VERSION;
  value: T;
};

export type LocalLoadResult<T> = {
  value: T;
  status: LocalDataStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, fallback: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  const bounded = Math.min(value, max);
  return integer ? Math.round(bounded) : bounded;
}

export function sanitizeStats(value: unknown, fallback: GameStats): GameStats | null {
  if (!isRecord(value)) return null;
  return {
    totalGames: boundedNumber(value.totalGames, fallback.totalGames, 1_000_000, true),
    totalWordsTyped: boundedNumber(value.totalWordsTyped, fallback.totalWordsTyped, 100_000_000, true),
    totalCharactersTyped: boundedNumber(value.totalCharactersTyped, fallback.totalCharactersTyped, 1_000_000_000, true),
    bestWPM: boundedNumber(value.bestWPM, fallback.bestWPM, 500, true),
    bestAccuracy: boundedNumber(value.bestAccuracy, fallback.bestAccuracy, 100, true),
    longestStreak: boundedNumber(value.longestStreak, fallback.longestStreak, 1_000_000, true),
    totalPlaytime: boundedNumber(value.totalPlaytime, fallback.totalPlaytime, 315_576_000),
    averageAccuracy: boundedNumber(value.averageAccuracy, fallback.averageAccuracy, 100, true),
    improvementRate: boundedNumber(value.improvementRate, fallback.improvementRate, 100, true),
  };
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function volumeOr(value: unknown, fallback: number): number {
  return Math.min(1, boundedNumber(value, fallback, 1));
}

export function sanitizeSettings(value: unknown, fallback: GameSettings): GameSettings | null {
  if (!isRecord(value) || !isRecord(value.audio) || !isRecord(value.graphics) || !isRecord(value.gameplay)) {
    return null;
  }

  return {
    audio: {
      masterVolume: volumeOr(value.audio.masterVolume, fallback.audio.masterVolume),
      musicVolume: volumeOr(value.audio.musicVolume, fallback.audio.musicVolume),
      sfxVolume: volumeOr(value.audio.sfxVolume, fallback.audio.sfxVolume),
      spatialAudio: booleanOr(value.audio.spatialAudio, fallback.audio.spatialAudio),
      dynamicMusic: booleanOr(value.audio.dynamicMusic, fallback.audio.dynamicMusic),
    },
    graphics: {
      particles: booleanOr(value.graphics.particles, fallback.graphics.particles),
      screenShake: booleanOr(value.graphics.screenShake, fallback.graphics.screenShake),
      backgroundAnimation: booleanOr(value.graphics.backgroundAnimation, fallback.graphics.backgroundAnimation),
      reducedMotion: booleanOr(value.graphics.reducedMotion, fallback.graphics.reducedMotion),
    },
    gameplay: {
      showWPM: booleanOr(value.gameplay.showWPM, fallback.gameplay.showWPM),
      showAccuracy: booleanOr(value.gameplay.showAccuracy, fallback.gameplay.showAccuracy),
      showNextWords: booleanOr(value.gameplay.showNextWords, fallback.gameplay.showNextWords),
      autoCapitalize: booleanOr(value.gameplay.autoCapitalize, fallback.gameplay.autoCapitalize),
    },
  };
}

function parseEnvelope<T>(raw: string | null, sanitize: (value: unknown) => T | null): T | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) return null;
  return sanitize(parsed.value);
}

function saveEnvelope<T>(storage: StorageLike, key: string, value: T): void {
  const envelope: VersionedEnvelope<T> = { version: STORAGE_VERSION, value };
  storage.setItem(key, JSON.stringify(envelope));
}

export function loadLocalStats(storage: StorageLike, fallback: GameStats): LocalLoadResult<GameStats> {
  try {
    const current = parseEnvelope(storage.getItem(WORDAVOID_STATS_KEY), (value) => sanitizeStats(value, fallback));
    if (current) return { value: current, status: 'loaded' };

    const legacyRaw = storage.getItem(WORDAVOID_LEGACY_STATS_KEY);
    if (!legacyRaw) return { value: fallback, status: 'loaded' };
    const legacy = sanitizeStats(JSON.parse(legacyRaw), fallback);
    if (!legacy) return { value: fallback, status: 'recovered' };
    saveEnvelope(storage, WORDAVOID_STATS_KEY, legacy);
    return { value: legacy, status: 'migrated' };
  } catch {
    return { value: fallback, status: 'recovered' };
  }
}

export function saveLocalStats(storage: StorageLike, stats: GameStats): boolean {
  try {
    saveEnvelope(storage, WORDAVOID_STATS_KEY, stats);
    return true;
  } catch {
    return false;
  }
}

export function loadLocalSettings(storage: StorageLike, fallback: GameSettings): LocalLoadResult<GameSettings> {
  try {
    const settings = parseEnvelope(storage.getItem(WORDAVOID_SETTINGS_KEY), (value) => sanitizeSettings(value, fallback));
    return settings
      ? { value: settings, status: 'loaded' }
      : { value: fallback, status: storage.getItem(WORDAVOID_SETTINGS_KEY) ? 'recovered' : 'loaded' };
  } catch {
    return { value: fallback, status: 'recovered' };
  }
}

export function saveLocalSettings(storage: StorageLike, settings: GameSettings): boolean {
  try {
    saveEnvelope(storage, WORDAVOID_SETTINGS_KEY, settings);
    return true;
  } catch {
    return false;
  }
}
