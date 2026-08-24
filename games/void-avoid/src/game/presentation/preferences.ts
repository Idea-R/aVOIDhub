export const PLAYER_PREFERENCES_KEY = 'voidavoid-player-preferences-v1';

export type MotionPreference = 'system' | 'reduced';

export interface PlayerPreferences {
  version: 1;
  soundEnabled: boolean;
  motion: MotionPreference;
}

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  version: 1,
  soundEnabled: true,
  motion: 'system',
};

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readPlayerPreferences(
  storage: PreferenceStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): PlayerPreferences {
  if (!storage) return DEFAULT_PLAYER_PREFERENCES;

  try {
    const parsed = JSON.parse(storage.getItem(PLAYER_PREFERENCES_KEY) ?? '') as Partial<PlayerPreferences>;
    if (parsed.version !== 1) return DEFAULT_PLAYER_PREFERENCES;
    return {
      version: 1,
      soundEnabled: parsed.soundEnabled !== false,
      motion: parsed.motion === 'reduced' ? 'reduced' : 'system',
    };
  } catch {
    return DEFAULT_PLAYER_PREFERENCES;
  }
}

export function writePlayerPreferences(
  preferences: PlayerPreferences,
  storage: PreferenceStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function resolveReducedMotion(
  preference: MotionPreference,
  systemRequestsReducedMotion: boolean,
): boolean {
  return preference === 'reduced' || systemRequestsReducedMotion;
}
