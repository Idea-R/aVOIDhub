/**
 * RAILaVOID procedural audio. No sample files: everything is synthesized with Web Audio.
 * The AudioContext is created lazily in unlock() (first user gesture). All API methods are safe before that.
 */
import type { AudioApi, SettingsStore } from '../app';
import type { EventBus } from '../core/events';
import type { Settings } from '../core/types';
import { createNoiseBuffer } from './synth';
import { Sfx } from './sfx';
import { MusicEngine, type Mood } from './music';
import { AmbientEngine } from './ambient';
import { TrackPlayer } from './tracks';

/** Concrete engine surface: AudioApi plus extras the UI drives directly. */
export interface RailAudioApi extends AudioApi {
  /** 0..1 how close the void is (drives the rumble bed). */
  setVoidProximity(p: number): void;
  /** Repeating boarding alarm while boarders are aboard. */
  setBoardingAlert(on: boolean): void;
  isUnlocked(): boolean;
}

const MOODS: Mood[] = ['title', 'calm', 'tense', 'combat', 'boss', 'victory', 'defeat'];

class RailAudio implements RailAudioApi {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private sfx: Sfx | null = null;
  private music: MusicEngine | null = null;
  private ambient: AmbientEngine | null = null;
  private tracks: TrackPlayer | null = null;
  private synthDuck: GainNode | null = null;
  private unsubs: Array<() => void> = [];
  private disposed = false;
  // pending state applied once the context exists
  private mood: Mood = 'title';
  private engine = { intensity: 0, stress: 0 };
  private weather = { kind: 'clear', intensity: 0 };
  private voidP = 0;
  private boardingTimer: number | null = null;
  private gestureHandler: (() => void) | null = null;
  private lastSettlementAt = -1;

  constructor(private settings: SettingsStore, private bus: EventBus) {
    this.unsubs.push(settings.onChange(s => this.applySettings(s)));
    this.subscribe();
    // first-gesture unlock (main also calls unlock(); both are idempotent)
    const h = () => this.unlock();
    this.gestureHandler = h;
    window.addEventListener('pointerdown', h, { passive: true });
    window.addEventListener('keydown', h);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'visible' && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* */ });
    });
  }

  // ---------- lifecycle ----------
  unlock(): void {
    if (this.disposed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* */ });
      this.tracks?.resume();
      return;
    }
    const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return; }
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();   // engine / weather / void beds
    this.uiBus = ctx.createGain();    // interface blips + notifications
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.uiBus.connect(this.master);
    const white = createNoiseBuffer(ctx, 2, 'white');
    const pink = createNoiseBuffer(ctx, 2, 'pink');
    const brown = createNoiseBuffer(ctx, 3, 'brown');
    this.sfx = new Sfx(ctx, this.sfxBus, white, pink, this.uiBus);
    // procedural score goes through a duck gain so real tracks (when present) can take over
    this.synthDuck = ctx.createGain();
    this.synthDuck.gain.value = 1;
    this.synthDuck.connect(this.musicBus);
    this.music = new MusicEngine(ctx, this.synthDuck, white);
    this.tracks = new TrackPlayer(ctx, this.musicBus);
    this.tracks.onActiveChange = (usingTrack) => {
      if (!this.synthDuck || !this.ctx) return;
      this.synthDuck.gain.setTargetAtTime(usingTrack ? 0.0001 : 1, this.ctx.currentTime, 0.8);
    };
    this.tracks.setMood(this.mood);
    this.ambient = new AmbientEngine(ctx, this.ambBus, white, pink, brown);
    this.applySettings(this.settings.get());
    this.music.setMood(this.mood);
    this.music.start();
    this.ambient.setEngine(this.engine.intensity, this.engine.stress);
    this.ambient.setWeather(this.weather.kind, this.weather.intensity);
    this.ambient.setVoid(this.voidP);
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* */ });
    if (this.gestureHandler) {
      window.removeEventListener('pointerdown', this.gestureHandler);
      window.removeEventListener('keydown', this.gestureHandler);
      this.gestureHandler = null;
    }
  }
  isUnlocked(): boolean { return !!this.ctx; }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsubs) { try { u(); } catch { /* */ } }
    this.unsubs = [];
    this.setBoardingAlert(false);
    if (this.gestureHandler) {
      window.removeEventListener('pointerdown', this.gestureHandler);
      window.removeEventListener('keydown', this.gestureHandler);
      this.gestureHandler = null;
    }
    this.music?.dispose();
    this.tracks?.dispose();
    this.ambient?.dispose();
    if (this.ctx) { this.ctx.close().catch(() => { /* */ }); }
    this.ctx = null; this.music = null; this.ambient = null; this.sfx = null;
  }

  // ---------- mixer ----------
  private applySettings(s: Settings): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const master = s.muted ? 0 : Math.max(0, Math.min(1, s.masterVolume));
    this.master.gain.setTargetAtTime(master, now, 0.05);
    this.musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, s.musicVolume)) * 0.55, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(Math.max(0, Math.min(1, s.sfxVolume)), now, 0.05);
    const amb = typeof s.ambienceVolume === 'number' ? s.ambienceVolume : 0.7;
    const uiV = typeof s.uiVolume === 'number' ? s.uiVolume : 0.7;
    this.ambBus?.gain.setTargetAtTime(Math.max(0, Math.min(1, amb)), now, 0.05);
    this.uiBus?.gain.setTargetAtTime(Math.max(0, Math.min(1, uiV)), now, 0.05);
  }
  setMaster(v: number): void { this.settings.set({ masterVolume: Math.max(0, Math.min(1, v)) }); }
  setMusic(v: number): void { this.settings.set({ musicVolume: Math.max(0, Math.min(1, v)) }); }
  setSfx(v: number): void { this.settings.set({ sfxVolume: Math.max(0, Math.min(1, v)) }); }
  setAmbience(v: number): void { this.settings.set({ ambienceVolume: Math.max(0, Math.min(1, v)) }); }
  setUi(v: number): void { this.settings.set({ uiVolume: Math.max(0, Math.min(1, v)) }); }
  setMuted(m: boolean): void { this.settings.set({ muted: !!m }); }

  // ---------- state-driven beds ----------
  setMusicMood(mood: string): void {
    const m = (MOODS as string[]).includes(mood) ? (mood as Mood) : 'calm';
    if (m === this.mood) return;
    this.mood = m;
    this.music?.setMood(m);
    this.tracks?.setMood(m);
  }
  setEngine(intensity: number, stress: number): void {
    this.engine = { intensity, stress };
    this.ambient?.setEngine(intensity, stress);
  }
  setWeather(kind: string, intensity: number): void {
    this.weather = { kind, intensity };
    this.ambient?.setWeather(kind, intensity);
  }
  setVoidProximity(p: number): void {
    this.voidP = p;
    this.ambient?.setVoid(p);
  }
  setBoardingAlert(on: boolean): void {
    if (on && this.boardingTimer === null) {
      this.sfx?.boardingAlarm();
      this.boardingTimer = window.setInterval(() => this.sfx?.boardingAlarm(), 3500);
    } else if (!on && this.boardingTimer !== null) {
      clearInterval(this.boardingTimer);
      this.boardingTimer = null;
    }
  }
  ui(kind: 'click' | 'hover' | 'open' | 'close' | 'error' | 'confirm' | 'notify'): void { this.sfx?.ui(kind); }

  // ---------- gameplay events ----------
  private subscribe(): void {
    const b = this.bus;
    const u = this.unsubs;
    u.push(b.on('weapon:fire', p => this.sfx?.weapon(p.kind)));
    u.push(b.on('enemy:hit', p => this.sfx?.enemyHit(p.immune)));
    u.push(b.on('enemy:died', p => this.sfx?.enemyDeath(p.type)));
    u.push(b.on('enemy:boarded', () => this.sfx?.boardingAlarm()));
    u.push(b.on('enemy:ram', () => this.sfx?.ram()));
    u.push(b.on('car:destroyed', p => this.sfx?.explosion(p.explode ? 90 : 45)));
    u.push(b.on('projectile:explode', p => this.sfx?.explosion(p.radius)));
    u.push(b.on('train:split', () => this.sfx?.metalShriek()));
    u.push(b.on('train:detach', () => { this.sfx?.brakes(); }));
    u.push(b.on('sapper:detonate', () => this.sfx?.sapperDetonate()));
    u.push(b.on('sapper:planted', () => this.sfx?.notifyBlip('warn')));
    u.push(b.on('settlement:reached', () => { this.sfx?.settlementChime(); this.lastSettlementAt = performance.now(); }));
    u.push(b.on('settlement:depart', () => this.sfx?.whistle()));
    u.push(b.on('train:start', () => {
      // whistle when leaving a settlement (recent arrival), otherwise a soft chuff-up handled by the engine bed
      if (this.lastSettlementAt >= 0 && performance.now() - this.lastSettlementAt < 120000) this.sfx?.whistle();
      this.lastSettlementAt = -1;
    }));
    u.push(b.on('train:stop', () => this.sfx?.brakes()));
    u.push(b.on('resource:change', p => { if (p.delta > 0) this.sfx?.resourceTick(true); }));
    u.push(b.on('passengers:board', () => this.sfx?.passengersMurmur()));
    u.push(b.on('passengers:delivered', () => this.sfx?.settlementChime()));
    u.push(b.on('wave:warning', () => this.sfx?.waveHorn()));
    u.push(b.on('boss:spawn', () => this.sfx?.bossDrone()));
    u.push(b.on('boss:died', () => this.sfx?.bossTriumph()));
    u.push(b.on('gate:open', () => this.sfx?.gateOpen()));
    u.push(b.on('lightning', () => this.sfx?.thunder()));
    u.push(b.on('rift:open', () => this.sfx?.riftWhoomp()));
    u.push(b.on('void:consume', () => this.sfx?.voidCrackle()));
    u.push(b.on('ui:notify', p => this.sfx?.notifyBlip(p.kind)));
    u.push(b.on('event:show', () => this.sfx?.eventBell()));
    u.push(b.on('crew:joined', () => this.sfx?.ui('confirm')));
    u.push(b.on('car:bought', () => this.sfx?.ui('confirm')));
    u.push(b.on('car:repaired', () => this.sfx?.resourceTick(true)));
    u.push(b.on('run:victory', () => { this.setMusicMood('victory'); this.sfx?.victory(); }));
    u.push(b.on('run:defeat', () => { this.setMusicMood('defeat'); this.sfx?.defeat(); }));
    u.push(b.on('run:start', () => { this.setBoardingAlert(false); this.lastSettlementAt = -1; }));
  }
}

export function createAudio(settings: SettingsStore, bus: EventBus): RailAudioApi {
  return new RailAudio(settings, bus);
}
