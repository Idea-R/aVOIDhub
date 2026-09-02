/**
 * Generative music: D dorian / minor pentatonic, ~92 BPM.
 * Layers: pad (detuned saws → lowpass), arpeggio (pluck), bass pulse, percussion (noise hats / kick / snare).
 * Moods enable layers and change cutoff / tempo / progression; all changes crossfade over 2 s.
 */
import { midiToFreq, MusicRng, noise, glide } from './synth';

export type Mood = 'title' | 'calm' | 'tense' | 'combat' | 'boss' | 'victory' | 'defeat';

interface MoodCfg {
  pad: number; arp: number; bass: number; perc: number;
  kick: boolean; snare: boolean;
  cutoff: number; tempo: number;
  prog: Array<[number, 'm' | 'M']>;
  scale: number[];
  arpDensity: number;
  arpOctave: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MINOR_PENT = [0, 3, 5, 7, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];
const PROG_CALM: Array<[number, 'm' | 'M']> = [[0, 'm'], [3, 'M'], [-2, 'M'], [5, 'm']];
const PROG_DARK: Array<[number, 'm' | 'M']> = [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']];
const PROG_BRIGHT: Array<[number, 'm' | 'M']> = [[0, 'M'], [5, 'M'], [7, 'M'], [9, 'm']];
const PROG_LOW: Array<[number, 'm' | 'M']> = [[0, 'm'], [8, 'M'], [5, 'm'], [0, 'm']];

const MOODS: Record<Mood, MoodCfg> = {
  title:   { pad: 0.8, arp: 0.45, bass: 0.0, perc: 0.0, kick: false, snare: false, cutoff: 1100, tempo: 84, prog: PROG_CALM, scale: MINOR_PENT, arpDensity: 0.35, arpOctave: 0 },
  calm:    { pad: 0.7, arp: 0.55, bass: 0.45, perc: 0.18, kick: false, snare: false, cutoff: 1700, tempo: 92, prog: PROG_CALM, scale: DORIAN, arpDensity: 0.45, arpOctave: 0 },
  tense:   { pad: 0.6, arp: 0.7, bass: 0.6, perc: 0.45, kick: true, snare: false, cutoff: 2500, tempo: 100, prog: PROG_DARK, scale: MINOR_PENT, arpDensity: 0.6, arpOctave: 0 },
  combat:  { pad: 0.5, arp: 0.8, bass: 0.85, perc: 0.9, kick: true, snare: true, cutoff: 4200, tempo: 112, prog: PROG_DARK, scale: MINOR_PENT, arpDensity: 0.8, arpOctave: 1 },
  boss:    { pad: 0.75, arp: 0.9, bass: 1.0, perc: 1.0, kick: true, snare: true, cutoff: 5200, tempo: 120, prog: PROG_DARK, scale: MINOR_PENT, arpDensity: 0.9, arpOctave: 1 },
  victory: { pad: 1.0, arp: 0.75, bass: 0.5, perc: 0.3, kick: true, snare: false, cutoff: 3200, tempo: 96, prog: PROG_BRIGHT, scale: MAJOR_PENT, arpDensity: 0.6, arpOctave: 1 },
  defeat:  { pad: 0.6, arp: 0.12, bass: 0.2, perc: 0.0, kick: false, snare: false, cutoff: 700, tempo: 70, prog: PROG_LOW, scale: MINOR_PENT, arpDensity: 0.2, arpOctave: -1 },
};

const KEY_ROOT = 50; // D3
const XFADE = 2.0;

export class MusicEngine {
  private out: GainNode;
  private padGain: GainNode; private arpGain: GainNode; private bassGain: GainNode; private percGain: GainNode;
  private padFilter: BiquadFilterNode; private arpFilter: BiquadFilterNode;
  private delay: DelayNode; private delayFb: GainNode; private delaySend: GainNode;
  private timer: number | null = null;
  private step = 0;
  private nextStepTime = 0;
  private tempo = 92;
  private mood: Mood = 'title';
  private cfg: MoodCfg = MOODS.title;
  private activeProg = PROG_CALM;
  private pendingCfg: MoodCfg | null = null;
  private rng = new MusicRng();
  private arpPattern: number[] = [];
  private lastArpMidi = 62;
  private running = false;

  constructor(private ctx: AudioContext, dest: AudioNode, private white: AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(dest);

    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 1100; this.padFilter.Q.value = 0.7;
    this.arpFilter = ctx.createBiquadFilter(); this.arpFilter.type = 'lowpass'; this.arpFilter.frequency.value = 1800; this.arpFilter.Q.value = 0.9;

    this.padGain = ctx.createGain(); this.arpGain = ctx.createGain(); this.bassGain = ctx.createGain(); this.percGain = ctx.createGain();
    for (const g of [this.padGain, this.arpGain, this.bassGain, this.percGain]) g.gain.value = 0;

    this.padFilter.connect(this.padGain).connect(this.out);
    this.arpFilter.connect(this.arpGain).connect(this.out);
    this.bassGain.connect(this.out);
    this.percGain.connect(this.out);

    // simple dub delay as space for arp + pad
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 60 / 92 * 0.75;
    this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.32;
    const dlpf = ctx.createBiquadFilter(); dlpf.type = 'lowpass'; dlpf.frequency.value = 2200;
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.35;
    this.delay.connect(dlpf).connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.out);
    this.arpGain.connect(this.delaySend);
    this.delaySend.connect(this.delay);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.tempo = this.cfg.tempo;
    this.applyLevels(this.cfg, 1.5);
    glide(this.out.gain, 1, this.ctx.currentTime, 0.6);
    this.timer = window.setInterval(() => this.tick(), 60);
  }
  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.running = false;
    glide(this.out.gain, 0.0001, this.ctx.currentTime, 0.4);
  }
  dispose(): void { this.stop(); try { this.out.disconnect(); } catch { /* */ } }

  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    const cfg = MOODS[m] ?? MOODS.calm;
    this.cfg = cfg;
    this.pendingCfg = cfg; // progression switches at the next bar boundary
    this.applyLevels(cfg, XFADE);
  }

  private applyLevels(cfg: MoodCfg, time: number): void {
    const now = this.ctx.currentTime;
    const tc = time / 3;
    glide(this.padGain.gain, cfg.pad * 0.5, now, tc);
    glide(this.arpGain.gain, cfg.arp * 0.34, now, tc);
    glide(this.bassGain.gain, cfg.bass * 0.5, now, tc);
    glide(this.percGain.gain, cfg.perc * 0.5, now, tc);
    glide(this.padFilter.frequency, Math.max(300, cfg.cutoff * 0.5), now, tc);
    glide(this.arpFilter.frequency, cfg.cutoff, now, tc);
  }

  private tick(): void {
    const horizon = this.ctx.currentTime + 0.25;
    let guard = 0;
    while (this.nextStepTime < horizon && guard++ < 32) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.tempo += (this.cfg.tempo - this.tempo) * 0.06;
      const stepDur = 60 / this.tempo / 4;
      this.nextStepTime += stepDur;
      this.step++;
    }
  }

  private chordAt(bar: number): { root: number; intervals: number[] } {
    const [r, q] = this.activeProg[bar % this.activeProg.length];
    const intervals = q === 'm' ? [0, 3, 7, 10] : [0, 4, 7, 14];
    return { root: r, intervals };
  }

  private scheduleStep(step: number, t: number): void {
    const cfg = this.cfg;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const stepDur = 60 / this.tempo / 4;
    if (inBar === 0) {
      if (this.pendingCfg) { this.activeProg = this.pendingCfg.prog; this.pendingCfg = null; }
      this.delay.delayTime.setTargetAtTime(60 / this.tempo * 0.75, t, 0.5);
      this.schedulePad(bar, t, stepDur * 16);
      this.arpPattern = this.makeArpPattern(bar);
    }
    const chord = this.chordAt(bar);
    // bass: syncopated root pulse
    if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 14) {
      const vel = inBar === 0 ? 1 : 0.7;
      this.bass(midiToFreq(KEY_ROOT - 12 + chord.root), t, stepDur * 2.2, vel);
    }
    // arp
    const note = this.arpPattern[inBar];
    if (note >= 0) {
      const accent = inBar % 4 === 0 ? 1 : 0.7;
      this.pluck(midiToFreq(note), t, accent);
    }
    // percussion
    const hatOn = cfg.perc > 0.3 ? true : inBar % 2 === 0;
    if (hatOn) this.hat(t, inBar % 4 === 0 ? 0.55 : 0.28 + (inBar % 2 ? 0.07 : 0));
    if (cfg.kick && (inBar === 0 || inBar === 8 || (cfg.snare && inBar === 10))) this.kick(t);
    if (cfg.snare && (inBar === 4 || inBar === 12)) this.snare(t);
    if (cfg.snare && inBar === 15 && this.rng.chance(0.3)) this.snare(t, 0.5);
  }

  private makeArpPattern(bar: number): number[] {
    const cfg = this.cfg;
    const chord = this.chordAt(bar);
    const pool: number[] = [];
    const base = KEY_ROOT + 12 + cfg.arpOctave * 12;
    for (let oct = 0; oct < 2; oct++) {
      for (const iv of chord.intervals) { pool.push(base + chord.root + iv + oct * 12, base + chord.root + iv + oct * 12); }
      for (const sc of cfg.scale) pool.push(base + sc + oct * 12);
    }
    const pattern: number[] = [];
    let cur = this.lastArpMidi;
    for (let i = 0; i < 16; i++) {
      const play = i % 4 === 0 ? this.rng.chance(Math.min(1, cfg.arpDensity + 0.35)) : this.rng.chance(cfg.arpDensity);
      if (!play) { pattern.push(-1); continue; }
      // random walk: prefer notes near the previous one
      const candidates = pool.filter(n => Math.abs(n - cur) <= 7);
      const pick = this.rng.pick(candidates.length ? candidates : pool);
      cur = pick;
      pattern.push(pick);
    }
    this.lastArpMidi = cur;
    return pattern;
  }

  private schedulePad(bar: number, t: number, barDur: number): void {
    const chord = this.chordAt(bar);
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.16, t + 1.4);
    env.gain.setValueAtTime(0.16, t + barDur);
    env.gain.linearRampToValueAtTime(0.0001, t + barDur + 1.8);
    env.connect(this.padFilter);
    const end = t + barDur + 2;
    chord.intervals.forEach((iv, i) => {
      const midi = KEY_ROOT + chord.root + iv;
      const f = midiToFreq(midi);
      const level = i === 3 ? 0.5 : 1;
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.5 * level;
        o.connect(g).connect(env);
        o.start(t);
        o.stop(end);
      }
    });
    // sub root for warmth
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midiToFreq(KEY_ROOT - 12 + chord.root);
    const sg = ctx.createGain(); sg.gain.value = 0.6;
    sub.connect(sg).connect(env);
    sub.start(t); sub.stop(end);
    sub.onended = () => { try { env.disconnect(); } catch { /* */ } };
  }

  private pluck(freq: number, t: number, vel: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600 * vel + 600, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    for (const [type, det, lvl] of [['triangle', -4, 1], ['triangle', 5, 0.7], ['square', 0, 0.12]] as Array<[OscillatorType, number, number]>) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = lvl;
      o.connect(og).connect(f);
      o.start(t); o.stop(t + 0.42);
    }
    f.connect(g).connect(this.arpFilter);
  }

  private bass(freq: number, t: number, dur: number, vel: number): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = freq;
    const w = ctx.createOscillator(); w.type = 'sawtooth'; w.frequency.value = freq;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.setValueAtTime(600, t); wf.frequency.exponentialRampToValueAtTime(120, t + dur);
    const wg = ctx.createGain(); wg.gain.value = 0.35;
    s.connect(g); w.connect(wf).connect(wg).connect(g);
    g.connect(this.bassGain);
    s.start(t); s.stop(t + dur + 0.05); w.start(t); w.stop(t + dur + 0.05);
  }

  private hat(t: number, vel: number): void {
    noise(this.ctx, this.percGain, this.white, { dur: 0.05 + vel * 0.04, gain: 0.11 * vel, when: t, filter: { type: 'highpass', freq: 7500 } });
  }
  private kick(t: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.percGain);
    o.start(t); o.stop(t + 0.35);
  }
  private snare(t: number, vel = 1): void {
    noise(this.ctx, this.percGain, this.white, { dur: 0.16, gain: 0.3 * vel, when: t, filter: { type: 'bandpass', freq: 1900, q: 0.8 } });
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.25 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.percGain); o.start(t); o.stop(t + 0.15);
  }
}
