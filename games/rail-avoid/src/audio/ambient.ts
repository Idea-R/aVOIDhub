/** Continuous beds: engine chuff loop, weather (rain/wind/hiss), void rumble. */
import { noiseLoop, glide } from './synth';

export class AmbientEngine {
  private out: GainNode;
  // engine
  private engineGain: GainNode;
  private sub: OscillatorNode;
  private subGain: GainNode;
  private chuffGain: GainNode;
  private chuffLfo: OscillatorNode;
  private chuffFilter: BiquadFilterNode;
  private rattleGain: GainNode;
  private stressOsc: OscillatorNode;
  private stressGain: GainNode;
  // weather
  private rain: GainNode; private wind: GainNode; private windFilter: BiquadFilterNode; private hiss: GainNode;
  private windLfo: OscillatorNode;
  // void
  private voidGain: GainNode;
  private voidSub: OscillatorNode;
  private voidSubGain: GainNode;
  private lastEngine = { i: -1, s: -1 };

  constructor(private ctx: AudioContext, dest: AudioNode, white: AudioBuffer, pink: AudioBuffer, brown: AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(dest);

    // ---- engine ----
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineGain.connect(this.out);
    this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = 42;
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0.35;
    this.sub.connect(this.subGain).connect(this.engineGain);
    this.sub.start();

    const chuffSrc = ctx.createBufferSource(); chuffSrc.buffer = pink; chuffSrc.loop = true; chuffSrc.start();
    this.chuffFilter = ctx.createBiquadFilter(); this.chuffFilter.type = 'bandpass'; this.chuffFilter.frequency.value = 220; this.chuffFilter.Q.value = 1.1;
    this.chuffGain = ctx.createGain(); this.chuffGain.gain.value = 0;
    chuffSrc.connect(this.chuffFilter).connect(this.chuffGain).connect(this.engineGain);
    // LFO gates the chuff: triangle LFO 0..1 (offset via ConstantSource)
    this.chuffLfo = ctx.createOscillator(); this.chuffLfo.type = 'triangle'; this.chuffLfo.frequency.value = 2;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.5;
    const offset = ctx.createConstantSource(); offset.offset.value = 0.5;
    this.chuffLfo.connect(lfoAmt).connect(this.chuffGain.gain);
    offset.connect(this.chuffGain.gain);
    this.chuffLfo.start(); offset.start();

    const rattleSrc = ctx.createBufferSource(); rattleSrc.buffer = white; rattleSrc.loop = true; rattleSrc.start();
    const rattleFilter = ctx.createBiquadFilter(); rattleFilter.type = 'highpass'; rattleFilter.frequency.value = 2600;
    this.rattleGain = ctx.createGain(); this.rattleGain.gain.value = 0;
    rattleSrc.connect(rattleFilter).connect(this.rattleGain).connect(this.engineGain);
    // stress: detuned buzz that rises with heat/damage
    this.stressOsc = ctx.createOscillator(); this.stressOsc.type = 'sawtooth'; this.stressOsc.frequency.value = 84;
    const stressFilter = ctx.createBiquadFilter(); stressFilter.type = 'lowpass'; stressFilter.frequency.value = 500;
    this.stressGain = ctx.createGain(); this.stressGain.gain.value = 0;
    this.stressOsc.connect(stressFilter).connect(this.stressGain).connect(this.engineGain);
    this.stressOsc.start();

    // ---- weather ----
    const rainA = noiseLoop(ctx, this.out, white, { type: 'bandpass', freq: 2800, q: 0.5 });
    const rainB = noiseLoop(ctx, this.out, white, { type: 'highpass', freq: 900 });
    this.rain = ctx.createGain(); this.rain.gain.value = 0;
    rainA.gain.gain.value = 0.6; rainB.gain.gain.value = 0.25;
    rainA.gain.disconnect(); rainB.gain.disconnect();
    rainA.gain.connect(this.rain); rainB.gain.connect(this.rain);
    this.rain.connect(this.out);

    const windLoop = noiseLoop(ctx, this.out, pink, { type: 'lowpass', freq: 420, q: 0.8 });
    windLoop.gain.gain.value = 1;
    windLoop.gain.disconnect();
    this.windFilter = windLoop.filter!;
    this.wind = ctx.createGain(); this.wind.gain.value = 0;
    windLoop.gain.connect(this.wind); this.wind.connect(this.out);
    this.windLfo = ctx.createOscillator(); this.windLfo.type = 'sine'; this.windLfo.frequency.value = 0.11;
    const windDepth = ctx.createGain(); windDepth.gain.value = 260;
    this.windLfo.connect(windDepth).connect(this.windFilter.frequency);
    this.windLfo.start();

    const hissLoop = noiseLoop(ctx, this.out, white, { type: 'highpass', freq: 5200 });
    hissLoop.gain.gain.value = 1;
    hissLoop.gain.disconnect();
    this.hiss = ctx.createGain(); this.hiss.gain.value = 0;
    hissLoop.gain.connect(this.hiss); this.hiss.connect(this.out);

    // ---- void ----
    const rumble = noiseLoop(ctx, this.out, brown, { type: 'lowpass', freq: 90, q: 0.7 });
    rumble.gain.gain.value = 1;
    rumble.gain.disconnect();
    this.voidGain = ctx.createGain(); this.voidGain.gain.value = 0;
    rumble.gain.connect(this.voidGain);
    this.voidSub = ctx.createOscillator(); this.voidSub.type = 'sine'; this.voidSub.frequency.value = 29;
    this.voidSubGain = ctx.createGain(); this.voidSubGain.gain.value = 0.5;
    const voidLfo = ctx.createOscillator(); voidLfo.type = 'sine'; voidLfo.frequency.value = 0.21;
    const voidLfoAmt = ctx.createGain(); voidLfoAmt.gain.value = 0.3;
    voidLfo.connect(voidLfoAmt).connect(this.voidSubGain.gain);
    this.voidSub.connect(this.voidSubGain).connect(this.voidGain);
    this.voidGain.connect(this.out);
    this.voidSub.start(); voidLfo.start();
  }

  setEngine(intensity: number, stress: number): void {
    const i = Math.max(0, Math.min(1, intensity || 0));
    const s = Math.max(0, Math.min(1, stress || 0));
    if (Math.abs(i - this.lastEngine.i) < 0.01 && Math.abs(s - this.lastEngine.s) < 0.01) return;
    this.lastEngine = { i, s };
    const now = this.ctx.currentTime;
    glide(this.engineGain.gain, i > 0.02 ? 0.1 + 0.28 * i : 0, now, 0.35);
    glide(this.sub.frequency, 36 + 42 * i, now, 0.4);
    glide(this.chuffLfo.frequency, 1.1 + 7.5 * i, now, 0.4);
    glide(this.chuffFilter.frequency, 180 + 260 * i, now, 0.4);
    glide(this.rattleGain.gain, 0.02 * i + 0.09 * s, now, 0.3);
    glide(this.stressGain.gain, 0.12 * s * s, now, 0.3);
    glide(this.stressOsc.frequency, 70 + 40 * s, now, 0.3);
  }

  setWeather(kind: string, intensity: number): void {
    const k = Math.max(0, Math.min(1, intensity || 0));
    let rain = 0, wind = 0, hiss = 0;
    switch (kind) {
      case 'rain': rain = 0.32; wind = 0.04; break;
      case 'storm': rain = 0.24; wind = 0.3; break;
      case 'fog': hiss = 0.045; wind = 0.03; break;
      case 'ashfall': wind = 0.16; hiss = 0.025; break;
      default: break;
    }
    const now = this.ctx.currentTime;
    glide(this.rain.gain, rain * k, now, 1.2);
    glide(this.wind.gain, wind * k, now, 1.5);
    glide(this.hiss.gain, hiss * k, now, 1.5);
  }

  setVoid(p: number): void {
    const v = Math.max(0, Math.min(1, p || 0));
    glide(this.voidGain.gain, v * v * 0.55, this.ctx.currentTime, 0.8);
  }

  dispose(): void {
    try { this.out.disconnect(); } catch { /* */ }
  }
}
