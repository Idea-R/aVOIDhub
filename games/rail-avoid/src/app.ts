/**
 * Application-level contracts wiring sim, render, ui and audio together.
 * main.ts creates the AppContext; each module receives it.
 */
import type { SimApi } from './sim/api';
import type { EventBus } from './core/events';
import type { Settings, MetaProgress } from './core/types';

/** Implemented by the Phaser GameScene (src/render). */
export interface ViewApi {
  zoomIn(): void;
  zoomOut(): void;
  setZoom(z: number): void;
  getZoom(): number;
  centerOnTrain(): void;
  setFollow(on: boolean): void;
  isFollowing(): boolean;
  panBy(dx: number, dy: number): void;
  /** Screen px -> hex [col,row] or null. */
  screenToHex(sx: number, sy: number): [number, number] | null;
  /** Hex -> screen px (centre). */
  hexToScreen(col: number, row: number): { x: number; y: number };
  /** World px (unprojected) -> screen px. */
  worldToScreen(x: number, y: number): { x: number; y: number };
  /** Highlight a car (inspector selection); -1 clears. */
  selectCar(index: number): void;
  getSelectedCar(): number;
  /** Ask the view for a PNG data URL of the current frame (verification). */
  snapshot(): string | null;
  /** Rendering performance counters. */
  perf(): { fps: number; frameMs: number; worstFrameMs: number; drawCalls: number; quality: string };
  setQuality(q: Settings['quality']): void;
  setReducedMotion(on: boolean): void;
  /** Keyboard-cursor planning (gamepad / keys): move cursor and confirm. */
  moveCursor(dCol: number, dRow: number): void;
  confirmCursor(): void;
  /** Called by UI when the DOM layout changes (e.g. side panel opened). */
  resize(): void;
  /**
   * Cinematic camera choreography (letterbox/title cards are drawn by the DOM UI, which listens for
   * window CustomEvent 'railavoid:cine' with detail { phase: 'start'|'card'|'end', name, title?, subtitle? }).
   * Resolves when finished or skipped. Must be safe to call when the view is not ready (resolve immediately).
   */
  playCinematic(name: 'run_intro' | 'region_enter' | 'boss_intro' | 'victory' | 'defeat', data?: { title?: string; subtitle?: string; x?: number; y?: number }): Promise<void>;
  skipCinematic(): void;
  isCinematicPlaying(): boolean;
}

/** Implemented by src/audio. All methods are safe to call before the AudioContext is unlocked. */
export interface AudioApi {
  unlock(): void;                      // call on first user gesture
  setMaster(v: number): void;
  setMusic(v: number): void;
  setSfx(v: number): void;
  setMuted(m: boolean): void;
  /** 'title' | 'calm' | 'tense' | 'combat' | 'boss' | 'victory' | 'defeat' */
  setMusicMood(mood: string): void;
  /** Engine loop intensity 0..1 (speed) and stress 0..1 (heat/damage). */
  setEngine(intensity: number, stress: number): void;
  setWeather(kind: string, intensity: number): void;
  ui(kind: 'click' | 'hover' | 'open' | 'close' | 'error' | 'confirm' | 'notify'): void;
  dispose(): void;
}

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): void;
  onChange(h: (s: Settings) => void): () => void;
  meta(): MetaProgress;
  setMeta(patch: Partial<MetaProgress>): void;
  hasSave(): boolean;
  writeSave(json: string): void;
  readSave(): string | null;
  clearSave(): void;
}

export interface AppContext {
  sim: SimApi;
  bus: EventBus;
  settings: SettingsStore;
  view: ViewApi | null;   // set once the Phaser scene has booted
  audio: AudioApi;
  /** Start a new run (creates a fresh Sim behind the same `sim` reference via replaceSim). */
  newRun(seed?: number): void;
  continueRun(): boolean;
  quitToTitle(): void;
  /** For hot-swapping the sim instance; listeners should re-read ctx.sim each frame. */
  replaceSim(sim: SimApi): void;
}
