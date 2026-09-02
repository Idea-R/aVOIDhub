/** One-shot sound effects, all synthesized. */
import { tone, noise, RateLimiter } from './synth';
import type { EnemyType, WeaponKind } from '../core/types';

export class Sfx {
  private limiter = new RateLimiter();
  /** Long opening-cinematic beds (rail-tick loop, crossroads drone) routed through their own gains so a skip can fade them. */
  private openBeds: Record<string, GainNode> = {};
  /** `uiDest` (optional) carries interface blips and notifications so they can be mixed separately from world SFX. */
  constructor(private ctx: AudioContext, private dest: AudioNode, private white: AudioBuffer, private pink: AudioBuffer, private uiDest: AudioNode = dest) {}

  private get now(): number { return this.ctx.currentTime; }
  private ok(key: string, gap: number): boolean { return this.limiter.allow(key, gap, this.now); }

  // ---------- weapons ----------
  weapon(kind: WeaponKind): void {
    switch (kind) {
      case 'gatling': this.gatling(); break;
      case 'cannon': this.cannon(); break;
      case 'flak': this.flak(); break;
      case 'tesla': this.tesla(); break;
      case 'flame': this.flame(); break;
      case 'marines': this.marines(); break;
    }
  }
  gatling(): void {
    if (!this.ok('gatling', 0.045)) return;
    noise(this.ctx, this.dest, this.white, { dur: 0.06, gain: 0.16, filter: { type: 'bandpass', freq: 2600, q: 0.8 } });
    tone(this.ctx, this.dest, { type: 'square', freq: 520, endFreq: 180, dur: 0.05, gain: 0.05 });
  }
  cannon(): void {
    if (!this.ok('cannon', 0.12)) return;
    tone(this.ctx, this.dest, { type: 'sine', freq: 150, endFreq: 38, dur: 0.55, gain: 0.55, slide: 0.3 });
    noise(this.ctx, this.dest, this.pink, { dur: 0.45, gain: 0.5, filter: { type: 'lowpass', freq: 1400, endFreq: 200 } });
    noise(this.ctx, this.dest, this.white, { dur: 0.08, gain: 0.25, filter: { type: 'highpass', freq: 2000 } });
  }
  flak(): void {
    if (!this.ok('flak', 0.08)) return;
    noise(this.ctx, this.dest, this.white, { dur: 0.12, gain: 0.22, filter: { type: 'bandpass', freq: 1500, q: 1.5, endFreq: 500 } });
    tone(this.ctx, this.dest, { type: 'triangle', freq: 300, endFreq: 90, dur: 0.1, gain: 0.12 });
  }
  tesla(): void {
    if (!this.ok('tesla', 0.1)) return;
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 180, endFreq: 90, dur: 0.28, gain: 0.16, fm: { freq: 57, index: 260 }, filter: { type: 'bandpass', freq: 1800, q: 2 } });
    noise(this.ctx, this.dest, this.white, { dur: 0.2, gain: 0.14, filter: { type: 'highpass', freq: 4000 } });
    tone(this.ctx, this.dest, { type: 'square', freq: 2400, endFreq: 700, dur: 0.12, gain: 0.05 });
  }
  flame(): void {
    if (!this.ok('flame', 0.22)) return;
    noise(this.ctx, this.dest, this.pink, { dur: 0.4, gain: 0.22, attack: 0.04, hold: 0.15, filter: { type: 'lowpass', freq: 900, endFreq: 2400, slide: 0.15 } });
  }
  marines(): void {
    if (!this.ok('marines', 0.14)) return;
    noise(this.ctx, this.dest, this.white, { dur: 0.09, gain: 0.2, filter: { type: 'bandpass', freq: 1800, q: 0.7 } });
    tone(this.ctx, this.dest, { type: 'square', freq: 260, endFreq: 100, dur: 0.06, gain: 0.07 });
  }

  // ---------- enemies ----------
  enemyHit(immune: boolean): void {
    if (!this.ok('hit', 0.05)) return;
    if (immune) {
      tone(this.ctx, this.dest, { type: 'sine', freq: 1200, endFreq: 1500, dur: 0.08, gain: 0.05 });
      return;
    }
    tone(this.ctx, this.dest, { type: 'triangle', freq: 220, endFreq: 110, dur: 0.07, gain: 0.12 });
    noise(this.ctx, this.dest, this.white, { dur: 0.04, gain: 0.08, filter: { type: 'lowpass', freq: 1200 } });
  }
  enemyDeath(type: EnemyType): void {
    if (!this.ok('death:' + type, 0.08)) return;
    const c = this.ctx, d = this.dest;
    switch (type) {
      case 'raider':
        tone(c, d, { type: 'sawtooth', freq: 240, endFreq: 70, dur: 0.22, gain: 0.12, filter: { type: 'lowpass', freq: 1500, endFreq: 300 } });
        break;
      case 'hound':
        tone(c, d, { type: 'square', freq: 900, endFreq: 1400, dur: 0.09, gain: 0.07, slide: 0.05 });
        tone(c, d, { type: 'sawtooth', freq: 1300, endFreq: 300, dur: 0.22, gain: 0.08, when: c.currentTime + 0.07 });
        break;
      case 'crawler':
        tone(c, d, { type: 'sine', freq: 90, endFreq: 30, dur: 0.5, gain: 0.35 });
        noise(c, d, this.pink, { dur: 0.4, gain: 0.3, filter: { type: 'lowpass', freq: 800, endFreq: 150 } });
        break;
      case 'harpy':
        tone(c, d, { type: 'sawtooth', freq: 1800, endFreq: 200, dur: 0.45, gain: 0.1, fm: { freq: 30, index: 400 } });
        noise(c, d, this.white, { dur: 0.25, gain: 0.12, filter: { type: 'bandpass', freq: 3000, q: 2, endFreq: 600 } });
        break;
      case 'sapper':
        noise(c, d, this.white, { dur: 0.12, gain: 0.2, filter: { type: 'bandpass', freq: 900, q: 1 } });
        tone(c, d, { type: 'triangle', freq: 400, endFreq: 120, dur: 0.15, gain: 0.1 });
        break;
      case 'wisp':
        tone(c, d, { type: 'sine', freq: 600, endFreq: 2400, dur: 0.5, gain: 0.08, attack: 0.2 });
        tone(c, d, { type: 'sine', freq: 900, endFreq: 3600, dur: 0.5, gain: 0.05, attack: 0.25, detune: 8 });
        break;
      default:
        this.bossTriumph();
    }
  }
  boardingAlarm(): void {
    if (!this.ok('board', 0.3)) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      tone(this.ctx, this.dest, { type: 'square', freq: 880, dur: 0.09, gain: 0.08, when: t + i * 0.12, filter: { type: 'lowpass', freq: 2500 } });
      tone(this.ctx, this.dest, { type: 'square', freq: 660, dur: 0.09, gain: 0.08, when: t + i * 0.12 + 0.06, filter: { type: 'lowpass', freq: 2500 } });
    }
  }
  ram(): void {
    if (!this.ok('ram', 0.12)) return;
    tone(this.ctx, this.dest, { type: 'sine', freq: 120, endFreq: 40, dur: 0.3, gain: 0.4 });
    noise(this.ctx, this.dest, this.pink, { dur: 0.25, gain: 0.3, filter: { type: 'lowpass', freq: 600 } });
    tone(this.ctx, this.dest, { type: 'triangle', freq: 2200, endFreq: 900, dur: 0.12, gain: 0.05 });
  }
  explosion(radius: number): void {
    if (!this.ok('explosion', 0.06)) return;
    const s = Math.min(1.6, 0.5 + radius / 60);
    tone(this.ctx, this.dest, { type: 'sine', freq: 110 * (1 / s), endFreq: 28, dur: 0.6 * s, gain: 0.5 * Math.min(1, s), slide: 0.25 * s });
    noise(this.ctx, this.dest, this.pink, { dur: 0.7 * s, gain: 0.45 * Math.min(1, s), filter: { type: 'lowpass', freq: 3000, endFreq: 120 } });
    noise(this.ctx, this.dest, this.white, { dur: 0.12, gain: 0.2, filter: { type: 'highpass', freq: 3000 } });
  }
  metalShriek(): void {
    const t = this.now;
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 1400, endFreq: 2600, dur: 0.9, gain: 0.12, attack: 0.05, fm: { freq: 9, index: 120 }, filter: { type: 'bandpass', freq: 2200, q: 3 } });
    tone(this.ctx, this.dest, { type: 'square', freq: 700, endFreq: 190, dur: 0.7, gain: 0.08, when: t + 0.1 });
    noise(this.ctx, this.dest, this.white, { dur: 0.6, gain: 0.25, filter: { type: 'bandpass', freq: 3500, q: 1.2, endFreq: 500 } });
    this.explosion(40);
  }
  sapperDetonate(): void {
    this.explosion(70);
    tone(this.ctx, this.dest, { type: 'square', freq: 1600, endFreq: 200, dur: 0.25, gain: 0.08 });
  }

  // ---------- world ----------
  settlementChime(): void {
    const t = this.now;
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((f, i) => tone(this.ctx, this.dest, { type: 'sine', freq: f, dur: 0.9, gain: 0.12, attack: 0.01, when: t + i * 0.11 }));
    notes.forEach((f, i) => tone(this.ctx, this.dest, { type: 'triangle', freq: f * 2, dur: 0.5, gain: 0.03, attack: 0.01, when: t + i * 0.11 }));
  }
  resourceTick(positive: boolean): void {
    if (!this.ok('res', 0.09)) return;
    if (positive) tone(this.ctx, this.dest, { type: 'sine', freq: 1320, endFreq: 1760, dur: 0.09, gain: 0.05, slide: 0.05 });
    else tone(this.ctx, this.dest, { type: 'sine', freq: 660, endFreq: 440, dur: 0.09, gain: 0.04, slide: 0.05 });
  }
  passengersMurmur(): void {
    if (!this.ok('murmur', 0.5)) return;
    const t = this.now;
    for (let i = 0; i < 6; i++) {
      tone(this.ctx, this.dest, { type: 'triangle', freq: 180 + Math.random() * 160, endFreq: 150 + Math.random() * 120, dur: 0.18, gain: 0.03, attack: 0.03, when: t + i * 0.09 + Math.random() * 0.04, filter: { type: 'lowpass', freq: 900 } });
    }
    noise(this.ctx, this.dest, this.pink, { dur: 0.7, gain: 0.05, attack: 0.1, filter: { type: 'bandpass', freq: 500, q: 0.7 } });
  }
  waveHorn(): void {
    if (!this.ok('horn', 1)) return;
    const t = this.now;
    for (let i = 0; i < 2; i++) {
      tone(this.ctx, this.dest, { type: 'sawtooth', freq: 174, dur: 0.5, gain: 0.12, attack: 0.03, when: t + i * 0.6, filter: { type: 'lowpass', freq: 900 } });
      tone(this.ctx, this.dest, { type: 'sawtooth', freq: 233, dur: 0.5, gain: 0.09, attack: 0.03, when: t + i * 0.6, filter: { type: 'lowpass', freq: 900 } });
    }
  }
  bossDrone(): void {
    const t = this.now;
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 55, dur: 3.2, gain: 0.25, attack: 0.8, filter: { type: 'lowpass', freq: 200, endFreq: 900, slide: 2.5 } });
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 58, dur: 3.2, gain: 0.2, attack: 0.8, filter: { type: 'lowpass', freq: 200, endFreq: 900, slide: 2.5 } });
    tone(this.ctx, this.dest, { type: 'sine', freq: 36, dur: 3.5, gain: 0.35, attack: 0.5 });
    for (let i = 0; i < 3; i++) tone(this.ctx, this.dest, { type: 'sine', freq: 90, endFreq: 40, dur: 0.6, gain: 0.35, when: t + 0.6 + i * 0.8 });
  }
  bossTriumph(): void {
    const t = this.now;
    const seq = [587.33, 698.46, 880, 1174.66, 1396.9];
    seq.forEach((f, i) => {
      tone(this.ctx, this.dest, { type: 'square', freq: f, dur: 0.45, gain: 0.07, attack: 0.01, when: t + i * 0.13, filter: { type: 'lowpass', freq: 2500 } });
      tone(this.ctx, this.dest, { type: 'sine', freq: f / 2, dur: 0.6, gain: 0.1, attack: 0.01, when: t + i * 0.13 });
    });
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 146.83, dur: 2.2, gain: 0.12, attack: 0.05, when: t + 0.65, filter: { type: 'lowpass', freq: 1200 } });
  }
  gateOpen(): void {
    const t = this.now;
    tone(this.ctx, this.dest, { type: 'sine', freq: 40, endFreq: 70, dur: 3, gain: 0.4, attack: 0.6 });
    noise(this.ctx, this.dest, this.pink, { dur: 3, gain: 0.25, attack: 0.5, filter: { type: 'lowpass', freq: 300, endFreq: 3000 } });
    [293.66, 440, 587.33, 880].forEach((f, i) => tone(this.ctx, this.dest, { type: 'triangle', freq: f, dur: 2.5, gain: 0.08, attack: 0.3, when: t + 0.5 + i * 0.25 }));
  }
  thunder(): void {
    if (!this.ok('thunder', 0.4)) return;
    const t = this.now;
    noise(this.ctx, this.dest, this.white, { dur: 0.1, gain: 0.35, filter: { type: 'highpass', freq: 3000 } });
    noise(this.ctx, this.dest, this.pink, { dur: 2.4, gain: 0.35, attack: 0.05, hold: 0.3, filter: { type: 'lowpass', freq: 900, endFreq: 100 }, when: t + 0.05 });
    tone(this.ctx, this.dest, { type: 'sine', freq: 70, endFreq: 30, dur: 1.6, gain: 0.3, when: t + 0.08 });
  }
  riftWhoomp(): void {
    if (!this.ok('rift', 0.5)) return;
    tone(this.ctx, this.dest, { type: 'sine', freq: 30, endFreq: 55, dur: 1.4, gain: 0.5, attack: 0.25, slide: 0.4 });
    noise(this.ctx, this.dest, this.pink, { dur: 1.2, gain: 0.2, attack: 0.3, filter: { type: 'lowpass', freq: 240 } });
    tone(this.ctx, this.dest, { type: 'sine', freq: 1200, endFreq: 200, dur: 0.9, gain: 0.04, attack: 0.3 });
  }
  voidCrackle(): void {
    if (!this.ok('void', 0.35)) return;
    noise(this.ctx, this.dest, this.white, { dur: 0.25, gain: 0.05, filter: { type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 4 } });
    tone(this.ctx, this.dest, { type: 'sine', freq: 90, endFreq: 50, dur: 0.3, gain: 0.05 });
  }
  // ---------- UI / flow ----------
  notifyBlip(kind: string): void {
    if (!this.ok('notify', 0.12)) return;
    const f = kind === 'bad' ? 330 : kind === 'warn' ? 520 : kind === 'good' ? 990 : 780;
    tone(this.ctx, this.uiDest, { type: 'sine', freq: f, endFreq: f * 1.25, dur: 0.12, gain: 0.06, slide: 0.06 });
  }
  eventBell(): void {
    const t = this.now;
    tone(this.ctx, this.dest, { type: 'sine', freq: 1046.5, dur: 1.4, gain: 0.1, attack: 0.005 });
    tone(this.ctx, this.dest, { type: 'sine', freq: 1568, dur: 1.1, gain: 0.05, attack: 0.005, when: t + 0.01 });
    tone(this.ctx, this.dest, { type: 'sine', freq: 2093 * 1.01, dur: 0.6, gain: 0.02, when: t + 0.02 });
  }
  whistle(): void {
    if (!this.ok('whistle', 1.5)) return;
    const t = this.now;
    for (const f of [622.25, 783.99, 932.33]) {
      tone(this.ctx, this.dest, { type: 'triangle', freq: f * 0.97, endFreq: f, dur: 1.3, gain: 0.07, attack: 0.08, slide: 0.15, when: t });
      tone(this.ctx, this.dest, { type: 'sine', freq: f * 2, dur: 1.1, gain: 0.02, attack: 0.1, when: t });
    }
    noise(this.ctx, this.dest, this.white, { dur: 1.3, gain: 0.05, attack: 0.1, filter: { type: 'bandpass', freq: 1800, q: 1.5 } });
  }
  brakes(): void {
    if (!this.ok('brakes', 1)) return;
    noise(this.ctx, this.dest, this.white, { dur: 1.1, gain: 0.12, attack: 0.15, filter: { type: 'bandpass', freq: 2600, q: 6, endFreq: 1500 } });
    noise(this.ctx, this.dest, this.pink, { dur: 1.4, gain: 0.2, attack: 0.05, filter: { type: 'lowpass', freq: 600, endFreq: 150 } });
    tone(this.ctx, this.dest, { type: 'sine', freq: 60, endFreq: 30, dur: 0.9, gain: 0.2, when: this.now + 0.6 });
  }
  victory(): void {
    const t = this.now;
    const seq = [587.33, 739.99, 880, 1174.66, 1479.98, 1760];
    seq.forEach((f, i) => {
      tone(this.ctx, this.dest, { type: 'triangle', freq: f, dur: 1.2, gain: 0.09, attack: 0.02, when: t + i * 0.16 });
      tone(this.ctx, this.dest, { type: 'sine', freq: f * 0.5, dur: 1.5, gain: 0.08, attack: 0.02, when: t + i * 0.16 });
    });
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 146.83, dur: 3.5, gain: 0.1, attack: 0.3, when: t + 0.9, filter: { type: 'lowpass', freq: 900 } });
    tone(this.ctx, this.dest, { type: 'sawtooth', freq: 220, dur: 3.5, gain: 0.08, attack: 0.3, when: t + 0.9, filter: { type: 'lowpass', freq: 900 } });
  }
  defeat(): void {
    const t = this.now;
    [293.66, 277.18, 261.63, 233.08].forEach((f, i) => {
      tone(this.ctx, this.dest, { type: 'sawtooth', freq: f, dur: 1.6, gain: 0.1, attack: 0.05, when: t + i * 0.5, filter: { type: 'lowpass', freq: 700 } });
      tone(this.ctx, this.dest, { type: 'sine', freq: f / 2, dur: 1.8, gain: 0.14, attack: 0.05, when: t + i * 0.5 });
    });
    tone(this.ctx, this.dest, { type: 'sine', freq: 50, endFreq: 25, dur: 3.5, gain: 0.35, attack: 0.5, when: t + 1.6 });
    noise(this.ctx, this.dest, this.pink, { dur: 3, gain: 0.15, attack: 1, filter: { type: 'lowpass', freq: 300 } });
  }
  ui(kind: 'click' | 'hover' | 'open' | 'close' | 'error' | 'confirm' | 'notify'): void {
    if (!this.ok('ui:' + kind, kind === 'hover' ? 0.05 : 0.03)) return;
    const c = this.ctx, d = this.uiDest, t = this.now;
    switch (kind) {
      case 'click': tone(c, d, { type: 'sine', freq: 1100, endFreq: 800, dur: 0.05, gain: 0.05 }); break;
      case 'hover': tone(c, d, { type: 'sine', freq: 1600, dur: 0.02, gain: 0.015 }); break;
      case 'open': tone(c, d, { type: 'triangle', freq: 660, dur: 0.08, gain: 0.05 }); tone(c, d, { type: 'triangle', freq: 990, dur: 0.12, gain: 0.05, when: t + 0.06 }); break;
      case 'close': tone(c, d, { type: 'triangle', freq: 990, dur: 0.08, gain: 0.04 }); tone(c, d, { type: 'triangle', freq: 660, dur: 0.12, gain: 0.04, when: t + 0.06 }); break;
      case 'error': tone(c, d, { type: 'square', freq: 220, endFreq: 160, dur: 0.16, gain: 0.06, filter: { type: 'lowpass', freq: 1200 } }); break;
      case 'confirm': tone(c, d, { type: 'sine', freq: 880, dur: 0.1, gain: 0.06 }); tone(c, d, { type: 'sine', freq: 1320, dur: 0.18, gain: 0.06, when: t + 0.08 }); break;
      case 'notify': this.notifyBlip('info'); break;
    }
  }

  // ---------- expedition / relic / bounty cues (driven by the DOM UI at judged moments) ----------
  cue(name: string): void {
    const c = this.ctx, d = this.dest, u = this.uiDest, t = this.now;
    switch (name) {
      case 'windup':   // rising tick as the strike ring closes
        if (!this.ok('cue:windup', 0.2)) return;
        tone(c, d, { type: 'triangle', freq: 320, endFreq: 760, dur: 0.85, gain: 0.05, attack: 0.05, slide: 0.85, filter: { type: 'lowpass', freq: 2200 } });
        break;
      case 'foe_windup':
        if (!this.ok('cue:foe', 0.2)) return;
        tone(c, d, { type: 'sawtooth', freq: 140, endFreq: 70, dur: 0.9, gain: 0.07, attack: 0.1, slide: 0.9, filter: { type: 'lowpass', freq: 700 } });
        noise(c, d, this.pink, { dur: 0.8, gain: 0.05, attack: 0.4, filter: { type: 'bandpass', freq: 500, q: 2 } });
        break;
      case 'perfect':
        tone(c, d, { type: 'sine', freq: 180, endFreq: 40, dur: 0.35, gain: 0.5, slide: 0.2 });
        noise(c, d, this.white, { dur: 0.16, gain: 0.35, filter: { type: 'highpass', freq: 1800 } });
        tone(c, d, { type: 'triangle', freq: 1318, dur: 0.35, gain: 0.08, when: t + 0.02 });
        tone(c, d, { type: 'triangle', freq: 1975, dur: 0.5, gain: 0.07, when: t + 0.09 });
        break;
      case 'good':
        tone(c, d, { type: 'sine', freq: 160, endFreq: 50, dur: 0.28, gain: 0.38, slide: 0.18 });
        noise(c, d, this.white, { dur: 0.1, gain: 0.22, filter: { type: 'bandpass', freq: 2200, q: 0.8 } });
        tone(c, d, { type: 'triangle', freq: 988, dur: 0.25, gain: 0.06, when: t + 0.02 });
        break;
      case 'miss':
        noise(c, d, this.pink, { dur: 0.22, gain: 0.18, filter: { type: 'lowpass', freq: 900, endFreq: 300 } });
        tone(c, d, { type: 'square', freq: 200, endFreq: 120, dur: 0.18, gain: 0.05, filter: { type: 'lowpass', freq: 900 } });
        break;
      case 'block':
        tone(c, d, { type: 'square', freq: 660, endFreq: 440, dur: 0.12, gain: 0.1, filter: { type: 'bandpass', freq: 1800, q: 3 } });
        noise(c, d, this.white, { dur: 0.08, gain: 0.18, filter: { type: 'highpass', freq: 3000 } });
        break;
      case 'block_perfect':
        tone(c, d, { type: 'square', freq: 880, endFreq: 660, dur: 0.16, gain: 0.12, filter: { type: 'bandpass', freq: 2400, q: 3 } });
        noise(c, d, this.white, { dur: 0.12, gain: 0.25, filter: { type: 'highpass', freq: 3500 } });
        tone(c, d, { type: 'sine', freq: 1760, dur: 0.6, gain: 0.07, attack: 0.01, when: t + 0.05 });
        tone(c, d, { type: 'sine', freq: 2637, dur: 0.7, gain: 0.04, attack: 0.01, when: t + 0.1 });
        break;
      case 'stun':
        for (let i = 0; i < 3; i++) tone(c, d, { type: 'sine', freq: 1500 - i * 200, dur: 0.1, gain: 0.05, when: t + i * 0.09 });
        break;
      case 'down':
        tone(c, d, { type: 'sawtooth', freq: 220, endFreq: 55, dur: 0.7, gain: 0.14, slide: 0.6, filter: { type: 'lowpass', freq: 800 } });
        noise(c, d, this.pink, { dur: 0.5, gain: 0.2, filter: { type: 'lowpass', freq: 400 } });
        break;
      case 'heal':
        [784, 988, 1175].forEach((f, i) => tone(c, d, { type: 'sine', freq: f, dur: 0.35, gain: 0.06, attack: 0.02, when: t + i * 0.07 }));
        break;
      case 'rally': this.whistle(); break;
      case 'exp_start':
        tone(c, d, { type: 'sine', freq: 70, endFreq: 40, dur: 1.2, gain: 0.3, attack: 0.05 });
        [330, 415, 494].forEach((f, i) => tone(c, d, { type: 'triangle', freq: f, dur: 0.8, gain: 0.06, attack: 0.03, when: t + 0.1 + i * 0.12 }));
        break;
      case 'exp_won':
        [523, 659, 784, 1047].forEach((f, i) => tone(c, d, { type: 'triangle', freq: f, dur: 0.9, gain: 0.08, attack: 0.02, when: t + i * 0.13 }));
        tone(c, d, { type: 'sawtooth', freq: 131, dur: 2.2, gain: 0.07, attack: 0.2, when: t + 0.4, filter: { type: 'lowpass', freq: 700 } });
        break;
      case 'exp_lost':
        [330, 311, 294].forEach((f, i) => tone(c, d, { type: 'sawtooth', freq: f, dur: 1.1, gain: 0.07, attack: 0.05, when: t + i * 0.4, filter: { type: 'lowpass', freq: 600 } }));
        break;
      case 'relic_offer':
        [880, 1109, 1319, 1760].forEach((f, i) => tone(c, d, { type: 'sine', freq: f, dur: 1.4, gain: 0.05, attack: 0.05, when: t + i * 0.08 }));
        break;
      case 'relic_take':
        tone(c, d, { type: 'sine', freq: 1319, dur: 0.9, gain: 0.08, attack: 0.005 });
        tone(c, d, { type: 'sine', freq: 1976, dur: 1.2, gain: 0.05, attack: 0.005, when: t + 0.05 });
        noise(c, d, this.white, { dur: 0.3, gain: 0.05, filter: { type: 'highpass', freq: 5000 } });
        break;
      case 'bounty_new': tone(c, u, { type: 'triangle', freq: 660, dur: 0.1, gain: 0.05 }); tone(c, u, { type: 'triangle', freq: 880, dur: 0.18, gain: 0.05, when: t + 0.1 }); break;
      case 'bounty_done': [784, 988, 1319].forEach((f, i) => tone(c, u, { type: 'sine', freq: f, dur: 0.4, gain: 0.06, when: t + i * 0.1 })); break;
      case 'bounty_failed': tone(c, u, { type: 'square', freq: 330, endFreq: 220, dur: 0.3, gain: 0.05, filter: { type: 'lowpass', freq: 1000 } }); break;
      case 'marks':
        if (!this.ok('cue:marks', 0.15)) return;
        tone(c, u, { type: 'sine', freq: 1568, dur: 0.12, gain: 0.05 }); tone(c, u, { type: 'sine', freq: 2093, dur: 0.2, gain: 0.04, when: t + 0.07 });
        break;
      // ---------- opening cinematic ----------
      case 'open_whistle': {
        // a whistle from far down the line: darker, quieter, with a late echo
        if (!this.ok('cue:open_whistle', 2)) return;
        for (const [i, f] of [622.25, 783.99, 932.33].entries()) {
          tone(c, d, { type: 'triangle', freq: f * 0.96, endFreq: f, dur: 2.2, gain: 0.03 - i * 0.004, attack: 0.35, slide: 0.5, filter: { type: 'lowpass', freq: 1500 } });
          tone(c, d, { type: 'triangle', freq: f * 0.98, endFreq: f * 0.99, dur: 1.6, gain: 0.012, attack: 0.3, when: t + 0.55, filter: { type: 'lowpass', freq: 900 } });
        }
        noise(c, d, this.pink, { dur: 2.4, gain: 0.03, attack: 0.5, filter: { type: 'bandpass', freq: 1200, q: 1.2 } });
        break;
      }
      case 'open_ticks': {
        // soft rail joints under a rolling train: clack-clack pairs for ~7 s, fading out on their own
        this.stopBed('ticks', 0.2);
        const g = this.bed('ticks', 0.9);
        g.gain.setTargetAtTime(0.0001, t + 5.6, 0.5);
        const period = 0.58;
        for (let i = 0; i < 12; i++) {
          const at = t + 0.2 + i * period;
          for (const off of [0, 0.11]) {
            noise(c, g, this.white, { dur: 0.05, gain: 0.09, when: at + off, filter: { type: 'bandpass', freq: 1900 + off * 3000, q: 1.6 } });
            tone(c, g, { type: 'triangle', freq: 140, endFreq: 70, dur: 0.07, gain: 0.05, when: at + off });
          }
        }
        noise(c, g, this.pink, { dur: 7, gain: 0.04, attack: 0.8, filter: { type: 'lowpass', freq: 220 } });
        break;
      }
      case 'open_ticks_stop': this.stopBed('ticks', 0.4); break;
      case 'open_tone1': case 'open_tone2': case 'open_tone3': {
        const idx = Number(name.slice(-1)) - 1;
        const f = [523.25, 659.25, 783.99][idx] ?? 523.25;
        tone(c, d, { type: 'sine', freq: f, dur: 0.9, gain: 0.08, attack: 0.01 });
        tone(c, d, { type: 'triangle', freq: f * 2, dur: 0.6, gain: 0.025, attack: 0.01 });
        tone(c, d, { type: 'sine', freq: f / 2, dur: 1.1, gain: 0.04, attack: 0.02 });
        break;
      }
      case 'open_drone': {
        // the Crossroads: a low, slightly detuned drone with a slow filter opening and a distant bell
        this.stopBed('drone', 0.3);
        const g = this.bed('drone', 1);
        g.gain.setTargetAtTime(0.0001, t + 5.2, 0.6);
        tone(c, g, { type: 'sawtooth', freq: 43.65, dur: 6.5, gain: 0.16, attack: 1.4, filter: { type: 'lowpass', freq: 120, endFreq: 520, slide: 4.5 } });
        tone(c, g, { type: 'sawtooth', freq: 44.1, dur: 6.5, gain: 0.13, attack: 1.4, filter: { type: 'lowpass', freq: 120, endFreq: 520, slide: 4.5 } });
        tone(c, g, { type: 'sine', freq: 32.7, dur: 6.5, gain: 0.26, attack: 1 });
        tone(c, g, { type: 'sine', freq: 392, dur: 2.6, gain: 0.035, attack: 0.01, when: t + 1.6 });
        tone(c, g, { type: 'sine', freq: 587.33, dur: 2.2, gain: 0.02, attack: 0.01, when: t + 1.62 });
        break;
      }
      case 'open_sting': {
        // the wordmark lands: a low impact, a shimmer, and a rising D-minor stack that hands over to the title music
        this.stopBed('drone', 0.25); this.stopBed('ticks', 0.25);
        tone(c, d, { type: 'sine', freq: 90, endFreq: 30, dur: 1.1, gain: 0.5, slide: 0.5 });
        noise(c, d, this.pink, { dur: 0.9, gain: 0.3, filter: { type: 'lowpass', freq: 1800, endFreq: 120 } });
        noise(c, d, this.white, { dur: 1.6, gain: 0.08, attack: 0.02, filter: { type: 'highpass', freq: 5000 } });
        [293.66, 349.23, 440, 587.33, 880].forEach((f, i) => {
          tone(c, d, { type: 'triangle', freq: f, dur: 2.6, gain: 0.09, attack: 0.02, when: t + 0.12 + i * 0.09 });
          tone(c, d, { type: 'sine', freq: f * 2, dur: 1.8, gain: 0.025, attack: 0.02, when: t + 0.12 + i * 0.09 });
        });
        tone(c, d, { type: 'sawtooth', freq: 146.83, dur: 3.8, gain: 0.11, attack: 0.4, when: t + 0.5, filter: { type: 'lowpass', freq: 700 } });
        tone(c, d, { type: 'sawtooth', freq: 220, dur: 3.8, gain: 0.07, attack: 0.5, when: t + 0.5, filter: { type: 'lowpass', freq: 700 } });
        break;
      }
      case 'open_stop': this.stopBed('ticks', 0.3); this.stopBed('drone', 0.3); break;
    }
  }

  /** Create (or replace) a named bed gain for the opening cinematic. */
  private bed(key: string, gain: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.dest);
    this.openBeds[key] = g;
    return g;
  }
  private stopBed(key: string, fade: number): void {
    const g = this.openBeds[key];
    if (!g) return;
    delete this.openBeds[key];
    const t = this.now;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + fade);
    } catch { /* */ }
    window.setTimeout(() => { try { g.disconnect(); } catch { /* */ } }, fade * 1000 + 100);
  }
}
