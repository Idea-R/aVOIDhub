export type SoundStatus = 'idle' | 'ready' | 'muted' | 'unavailable';
export type SoundCue = 'start' | 'impact' | 'charge' | 'pause' | 'game-over';

interface Tone {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  shape: OscillatorType;
  delay?: number;
}

export interface SoundDiagnostics {
  enabled: boolean;
  status: SoundStatus;
  contextState: AudioContextState | 'none';
  activeVoices: number;
  contextsCreated: number;
  contextsClosed: number;
}

type AudioContextFactory = () => AudioContext;

function createBrowserAudioContext(): AudioContext {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  return new AudioContextConstructor();
}

/** A small, local sound palette. It never fetches audio and does not start before a player gesture. */
export class SoundManager {
  private context: AudioContext | null = null;
  private enabled: boolean;
  private status: SoundStatus;
  private activeVoices = new Set<OscillatorNode>();
  private contextsCreated = 0;
  private contextsClosed = 0;
  private lastImpactAt = Number.NEGATIVE_INFINITY;

  constructor(
    enabled = true,
    private readonly contextFactory: AudioContextFactory = createBrowserAudioContext,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.enabled = enabled;
    this.status = enabled ? 'idle' : 'muted';
  }

  async activate(): Promise<SoundStatus> {
    if (!this.enabled) return this.setStatus('muted');

    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = this.contextFactory();
        this.contextsCreated += 1;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.setStatus(this.context.state === 'running' ? 'ready' : 'unavailable');
    } catch {
      await this.closeContext();
      return this.setStatus('unavailable');
    }
  }

  async setEnabled(enabled: boolean): Promise<SoundStatus> {
    this.enabled = enabled;
    if (!enabled) {
      this.stopVoices();
      try { await this.context?.suspend(); } catch { /* muting still succeeds */ }
      return this.setStatus('muted');
    }
    return this.activate();
  }

  play(cue: SoundCue, strength = 1): boolean {
    if (!this.enabled || this.status !== 'ready' || this.context?.state !== 'running') return false;

    if (cue === 'impact') {
      const now = this.now();
      if (now - this.lastImpactAt < 70) return false;
      this.lastImpactAt = now;
    }

    const tones = this.getTones(cue, strength);
    tones.forEach((tone) => this.playTone(tone));
    return tones.length > 0;
  }

  getStatus(): SoundStatus { return this.status; }

  getDiagnostics(): SoundDiagnostics {
    return {
      enabled: this.enabled,
      status: this.status,
      contextState: this.context?.state ?? 'none',
      activeVoices: this.activeVoices.size,
      contextsCreated: this.contextsCreated,
      contextsClosed: this.contextsClosed,
    };
  }

  async destroy(): Promise<void> {
    this.enabled = false;
    this.stopVoices();
    await this.closeContext();
    this.setStatus('muted');
  }

  private setStatus(status: SoundStatus): SoundStatus {
    this.status = status;
    return status;
  }

  private getTones(cue: SoundCue, strength: number): Tone[] {
    const safeStrength = Math.min(1, Math.max(0.2, strength));
    switch (cue) {
      case 'start':
        return [
          { frequency: 180, endFrequency: 310, duration: 0.11, gain: 0.022, shape: 'triangle' },
          { frequency: 330, endFrequency: 520, duration: 0.14, gain: 0.016, shape: 'sine', delay: 0.08 },
        ];
      case 'impact':
        return [{
          frequency: 115 + safeStrength * 45,
          endFrequency: 52,
          duration: 0.075,
          gain: 0.012 + safeStrength * 0.018,
          shape: 'sawtooth',
        }];
      case 'charge':
        return [
          { frequency: 410, endFrequency: 610, duration: 0.09, gain: 0.02, shape: 'sine' },
          { frequency: 620, endFrequency: 840, duration: 0.11, gain: 0.016, shape: 'sine', delay: 0.07 },
        ];
      case 'pause':
        return [{ frequency: 245, endFrequency: 155, duration: 0.085, gain: 0.015, shape: 'triangle' }];
      case 'game-over':
        return [
          { frequency: 185, endFrequency: 66, duration: 0.38, gain: 0.032, shape: 'triangle' },
          { frequency: 94, endFrequency: 42, duration: 0.32, gain: 0.014, shape: 'sine', delay: 0.1 },
        ];
    }
  }

  private playTone(tone: Tone): void {
    const context = this.context;
    if (!context) return;

    const start = context.currentTime + (tone.delay ?? 0);
    const end = start + tone.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    this.activeVoices.add(oscillator);

    oscillator.type = tone.shape;
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener('ended', () => {
      this.activeVoices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  private stopVoices(): void {
    for (const voice of this.activeVoices) {
      try { voice.stop(); } catch { /* a scheduled voice may already be stopped */ }
      try { voice.disconnect(); } catch { /* no-op */ }
    }
    this.activeVoices.clear();
  }

  private async closeContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    if (!context || context.state === 'closed') return;
    try {
      await context.close();
      this.contextsClosed += 1;
    } catch {
      // The reference is still released; the browser owns any failed close.
    }
  }
}
