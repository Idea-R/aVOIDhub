/** Low-level procedural synthesis helpers (oscillators, noise, envelopes, rate limiting). */

export type NoiseKind = 'white' | 'pink' | 'brown';

export function createNoiseBuffer(ctx: AudioContext, seconds = 2, kind: NoiseKind = 'white'): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // deterministic LCG so sessions sound identical
  let s = 0x9e3779b9;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = rnd();
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd();
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * rnd()) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export interface FilterOpts { type: BiquadFilterType; freq: number; q?: number; endFreq?: number; slide?: number }

export interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  endFreq?: number;
  /** seconds for the freq slide (defaults to dur) */
  slide?: number;
  dur: number;
  gain: number;
  attack?: number;
  when?: number;
  detune?: number;
  filter?: FilterOpts;
  /** Optional FM: modulator frequency & index (Hz deviation). */
  fm?: { freq: number; index: number };
}

export interface NoiseOpts {
  dur: number;
  gain: number;
  attack?: number;
  when?: number;
  rate?: number;
  filter?: FilterOpts;
  hold?: number;
}

function applyFilter(ctx: AudioContext, f: FilterOpts, t0: number, dur: number): BiquadFilterNode {
  const bq = ctx.createBiquadFilter();
  bq.type = f.type;
  bq.frequency.setValueAtTime(Math.max(10, f.freq), t0);
  if (f.q !== undefined) bq.Q.value = f.q;
  if (f.endFreq !== undefined) bq.frequency.exponentialRampToValueAtTime(Math.max(10, f.endFreq), t0 + (f.slide ?? dur));
  return bq;
}

/** One-shot oscillator with an AD envelope. */
export function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const t0 = o.when ?? ctx.currentTime;
  const atk = Math.max(0.001, o.attack ?? 0.005);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(1, o.freq), t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.endFreq), t0 + (o.slide ?? o.dur));
  let modOsc: OscillatorNode | null = null;
  if (o.fm) {
    modOsc = ctx.createOscillator();
    modOsc.frequency.value = o.fm.freq;
    const mg = ctx.createGain();
    mg.gain.value = o.fm.index;
    modOsc.connect(mg).connect(osc.frequency);
    modOsc.start(t0);
    modOsc.stop(t0 + o.dur + 0.05);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let chain: AudioNode = osc;
  if (o.filter) { const f = applyFilter(ctx, o.filter, t0, o.dur); chain.connect(f); chain = f; }
  chain.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
  osc.onended = () => { try { g.disconnect(); } catch { /* */ } };
}

/** One-shot noise burst with an AD (or AHD) envelope. */
export function noise(ctx: AudioContext, dest: AudioNode, buffer: AudioBuffer, o: NoiseOpts): void {
  const t0 = o.when ?? ctx.currentTime;
  const atk = Math.max(0.001, o.attack ?? 0.003);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = buffer.duration;
  if (o.rate) src.playbackRate.value = o.rate;
  // random offset so repeated bursts do not phase
  const offset = (Math.random() * Math.max(0.01, buffer.duration - o.dur - 0.05));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + atk);
  const hold = o.hold ?? 0;
  if (hold > 0) g.gain.setValueAtTime(o.gain, t0 + atk + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let chain: AudioNode = src;
  if (o.filter) { const f = applyFilter(ctx, o.filter, t0, o.dur); chain.connect(f); chain = f; }
  chain.connect(g).connect(dest);
  src.start(t0, offset);
  src.stop(t0 + o.dur + 0.05);
  src.onended = () => { try { g.disconnect(); } catch { /* */ } };
}

/** Continuous looping noise source through an optional filter into a gain (returned for level control). */
export function noiseLoop(ctx: AudioContext, dest: AudioNode, buffer: AudioBuffer, filter?: FilterOpts): { gain: GainNode; filter: BiquadFilterNode | null; src: AudioBufferSourceNode } {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0;
  let f: BiquadFilterNode | null = null;
  if (filter) {
    f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    if (filter.q !== undefined) f.Q.value = filter.q;
    src.connect(f).connect(g);
  } else src.connect(g);
  g.connect(dest);
  src.start();
  return { gain: g, filter: f, src };
}

export function midiToFreq(m: number): number { return 440 * Math.pow(2, (m - 69) / 12); }

/** Smoothly move an AudioParam to a target. */
export function glide(param: AudioParam, value: number, now: number, tc = 0.1): void {
  try {
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, tc);
  } catch { /* param may be gone */ }
}

/** Per-key minimum gap limiter so machine-gun events do not stack up. */
export class RateLimiter {
  private last = new Map<string, number>();
  allow(key: string, minGap: number, now: number): boolean {
    const l = this.last.get(key) ?? -Infinity;
    if (now - l < minGap) return false;
    this.last.set(key, now);
    return true;
  }
}

/** Small deterministic RNG for musical decisions. */
export class MusicRng {
  constructor(private s = 0x2f6e2b1) {}
  next(): number { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  pick<T>(a: readonly T[]): T { return a[Math.floor(this.next() * a.length)]; }
  chance(p: number): boolean { return this.next() < p; }
}
