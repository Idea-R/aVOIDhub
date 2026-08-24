type ToneShape = OscillatorType;

interface ToneOptions {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  shape: ToneShape;
  delay?: number;
}

export class SoundManager {
  private context: AudioContext | null = null;
  private enabled: boolean;
  private lastImpactAt = 0;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      await this.context?.suspend().catch(() => undefined);
      return;
    }
    await this.resume();
  }

  async resume(): Promise<void> {
    if (!this.enabled) return;
    const context = this.getContext();
    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }
  }

  impact(points: number): void {
    const now = performance.now();
    if (now - this.lastImpactAt < 45) return;
    this.lastImpactAt = now;
    const strength = Math.min(1, Math.max(0.25, points / 40));
    this.tone({
      frequency: 105 + strength * 35,
      endFrequency: 48,
      duration: 0.07,
      gain: 0.018 + strength * 0.014,
      shape: "sawtooth",
    });
  }

  damage(): void {
    this.tone({
      frequency: 150,
      endFrequency: 68,
      duration: 0.14,
      gain: 0.035,
      shape: "square",
    });
  }

  powerUp(): void {
    this.tone({
      frequency: 430,
      endFrequency: 560,
      duration: 0.1,
      gain: 0.025,
      shape: "sine",
    });
    this.tone({
      frequency: 650,
      endFrequency: 820,
      duration: 0.12,
      gain: 0.02,
      shape: "sine",
      delay: 0.08,
    });
  }

  pause(): void {
    this.tone({
      frequency: 260,
      endFrequency: 180,
      duration: 0.08,
      gain: 0.018,
      shape: "sine",
    });
  }

  gameOver(): void {
    this.tone({
      frequency: 190,
      endFrequency: 58,
      duration: 0.42,
      gain: 0.04,
      shape: "triangle",
    });
  }

  destroy(): void {
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
  }

  private getContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  private tone(options: ToneOptions): void {
    if (!this.enabled) return;
    const context = this.context;
    if (!context || context.state !== "running") return;

    const start = context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = options.shape;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency),
      end,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }
}
