import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_PREFERENCES,
  PLAYER_PREFERENCES_KEY,
  readPlayerPreferences,
  resolveReducedMotion,
  writePlayerPreferences,
} from './preferences';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => key === PLAYER_PREFERENCES_KEY ? value : null,
    setItem: (key: string, next: string) => {
      if (key === PLAYER_PREFERENCES_KEY) value = next;
    },
    value: () => value,
  };
}

describe('player preferences', () => {
  it('fails closed to the versioned defaults for missing or damaged storage', () => {
    expect(readPlayerPreferences(memoryStorage())).toEqual(DEFAULT_PLAYER_PREFERENCES);
    expect(readPlayerPreferences(memoryStorage('{not-json'))).toEqual(DEFAULT_PLAYER_PREFERENCES);
    expect(readPlayerPreferences(memoryStorage(JSON.stringify({ version: 2 })))).toEqual(DEFAULT_PLAYER_PREFERENCES);
  });

  it('persists only the supported sound and motion choices', () => {
    const storage = memoryStorage();
    const preferences = { version: 1 as const, soundEnabled: false, motion: 'reduced' as const };
    expect(writePlayerPreferences(preferences, storage)).toBe(true);
    expect(readPlayerPreferences(storage)).toEqual(preferences);
    expect(storage.value()).toContain('"version":1');
  });

  it('always honors the operating-system reduced-motion request', () => {
    expect(resolveReducedMotion('system', false)).toBe(false);
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('reduced', false)).toBe(true);
  });
});
