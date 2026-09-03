/** localStorage persistence for settings, meta progress and the mid-run save. */
import type { Settings, MetaProgress } from './types';
import type { SettingsStore } from '../app';

const KEY_SETTINGS = 'railavoid.settings.v1';
const KEY_META = 'railavoid.meta.v1';
const KEY_SAVE = 'railavoid.save.v1';

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.8, ambienceVolume: 0.7, uiVolume: 0.7, muted: false,
  reducedMotion: false, screenShake: true, highContrast: false, largeText: false, uiScale: 0.75,
  colorblind: 'none', quality: 'auto', showTutorial: true, autoFollowRail: true, showSeedField: false, showLog: false, compactHud: false, customCursor: true,
};

export const DEFAULT_META: MetaProgress = {
  runs: 0, victories: 0, bestScore: 0, bestRegion: 0, totalKills: 0, lastSeed: 0, unlockedNotes: [],
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch { return fallback; }
}
function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota / private mode */ }
}

export function createSettingsStore(): SettingsStore {
  let settings = read<Settings>(KEY_SETTINGS, DEFAULT_SETTINGS);
  let meta = read<MetaProgress>(KEY_META, DEFAULT_META);
  const handlers: Array<(s: Settings) => void> = [];
  return {
    get: () => settings,
    set(patch) {
      settings = { ...settings, ...patch };
      write(KEY_SETTINGS, settings);
      for (const h of handlers) { try { h(settings); } catch (e) { console.error(e); } }
    },
    onChange(h) { handlers.push(h); return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); }; },
    meta: () => meta,
    setMeta(patch) { meta = { ...meta, ...patch }; write(KEY_META, meta); },
    hasSave() { try { return !!localStorage.getItem(KEY_SAVE); } catch { return false; } },
    writeSave(json) { try { localStorage.setItem(KEY_SAVE, json); } catch { /* ignore */ } },
    readSave() { try { return localStorage.getItem(KEY_SAVE); } catch { return null; } },
    clearSave() { try { localStorage.removeItem(KEY_SAVE); } catch { /* ignore */ } },
  };
}
