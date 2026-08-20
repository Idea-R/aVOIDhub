export type AudioCue = "fire" | "impact" | "cover" | "victory" | "defeat";

export type AudioState = "locked" | "ready" | "unavailable";

export interface AudioDiagnostics {
  state: AudioState;
  muted: boolean;
  contexts: number;
  activeVoices: number;
  voiceCapacity: number;
}

export interface AudioPort {
  unlock(): Promise<boolean>;
  setMuted(muted: boolean): void;
  play(cue: AudioCue): void;
  silence(): void;
  diagnostics(): AudioDiagnostics;
  destroy(): void;
}

interface AudioContextPort {
  readonly currentTime: number;
  readonly destination: AudioNode;
  readonly state: AudioContextState;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  resume(): Promise<void>;
  close(): Promise<void>;
}

type AudioContextFactory = () => AudioContextPort;

const VOICE_CAPACITY = 8;

const CUES: Record<
  AudioCue,
  { frequency: number; endFrequency: number; duration: number; gain: number }
> = {
  fire: { frequency: 92, endFrequency: 54, duration: 0.12, gain: 0.13 },
  impact: { frequency: 170, endFrequency: 74, duration: 0.16, gain: 0.11 },
  cover: { frequency: 420, endFrequency: 210, duration: 0.08, gain: 0.07 },
  victory: { frequency: 240, endFrequency: 520, duration: 0.34, gain: 0.1 },
  defeat: { frequency: 150, endFrequency: 48, duration: 0.42, gain: 0.11 },
};

function browserAudioContext(): AudioContextPort {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio is unavailable.");
  return new AudioContextConstructor();
}

export class TankAudioController implements AudioPort {
  private context: AudioContextPort | null = null;
  private state: AudioState = "locked";
  private muted = false;
  private destroyed = false;
  private readonly voices = new Set<OscillatorNode>();

  constructor(
    private readonly createContext: AudioContextFactory = browserAudioContext,
  ) {}

  async unlock(): Promise<boolean> {
    if (this.destroyed || this.muted || this.state === "unavailable")
      return false;
    try {
      this.context ??= this.createContext();
      if (this.context.state !== "running") await this.context.resume();
      this.state = this.context.state === "running" ? "ready" : "locked";
      return this.state === "ready";
    } catch {
      this.state = "unavailable";
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.silence();
  }

  play(cue: AudioCue): void {
    const context = this.context;
    if (
      this.destroyed ||
      this.muted ||
      this.state !== "ready" ||
      !context ||
      this.voices.size >= VOICE_CAPACITY
    )
      return;

    const profile = CUES[cue];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const end = start + profile.duration;
    oscillator.type = cue === "cover" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(profile.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      profile.endFrequency,
      end,
    );
    gain.gain.setValueAtTime(profile.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => this.voices.delete(oscillator);
    this.voices.add(oscillator);
    oscillator.start(start);
    oscillator.stop(end);
  }

  silence(): void {
    for (const voice of this.voices) {
      voice.onended = null;
      try {
        voice.stop();
      } catch {
        // A voice that has already ended is still safe to forget.
      }
    }
    this.voices.clear();
  }

  diagnostics(): AudioDiagnostics {
    return {
      state: this.state,
      muted: this.muted,
      contexts: this.context ? 1 : 0,
      activeVoices: this.voices.size,
      voiceCapacity: VOICE_CAPACITY,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.silence();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}

export const SILENT_AUDIO: AudioPort = {
  unlock: async () => false,
  setMuted: () => undefined,
  play: () => undefined,
  silence: () => undefined,
  diagnostics: () => ({
    state: "unavailable",
    muted: true,
    contexts: 0,
    activeVoices: 0,
    voiceCapacity: 0,
  }),
  destroy: () => undefined,
};
