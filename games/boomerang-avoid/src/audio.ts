import type { Preferences } from "./input";
/** Original generated Web Audio score and game cues. No downloaded audio. */
export class GardenAudio {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private nextNote = 0;
  private note = 0;
  constructor(private preferences: Preferences) {}
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.context.destination);
      this.nextNote = this.context.currentTime + 0.05;
    }
    void this.context.resume();
    this.update();
  }
  update() {
    if (this.musicGain)
      this.musicGain.gain.value = this.preferences.music * 0.14;
    if (this.sfxGain) this.sfxGain.gain.value = this.preferences.sfx * 0.2;
  }
  private tone(
    frequency: number,
    time: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    music = false,
    endFrequency?: number,
  ) {
    const c = this.context;
    if (!c) return;
    const oscillator = c.createOscillator(),
      envelope = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        time + duration,
      );
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope);
    envelope.connect((music ? this.musicGain : this.sfxGain)!);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }
  tick() {
    const c = this.context;
    if (!c || c.state !== "running") return;
    this.nextNote = Math.max(this.nextNote, c.currentTime - 0.1);
    const melody = [0, 7, 12, 14, 7, 4, 12, 7, 0, 9, 12, 16, 14, 7, 4, -3];
    while (this.nextNote < c.currentTime + 0.1) {
      const i = this.note++ % melody.length;
      this.tone(
        164.8138 * Math.pow(2, melody[i] / 12),
        this.nextNote,
        1.2,
        0.35,
        "sine",
        true,
      );
      if (i % 4 === 0)
        this.tone(
          82.4069 * Math.pow(2, (i < 8 ? 0 : 5) / 12),
          this.nextNote,
          1.9,
          0.3,
          "triangle",
          true,
        );
      this.nextNote += 0.36;
    }
  }
  cue(kind: string) {
    const c = this.context;
    if (!c) return;
    const t = c.currentTime;
    switch (kind) {
      case "throw":
        this.tone(420, t, 0.18, 0.8, "triangle", false, 980);
        break;
      case "recall":
        this.tone(880, t, 0.16, 0.6, "sine", false, 460);
        break;
      case "catch":
        this.tone(660, t, 0.15, 0.7);
        this.tone(990, t + 0.06, 0.2, 0.4);
        break;
      case "dash":
        this.tone(150, t, 0.13, 0.7, "triangle", false, 55);
        break;
      case "slash":
      case "deflect":
        this.tone(1100, t, 0.13, 0.6, "triangle", false, 350);
        break;
      case "death":
        this.tone(300, t, 0.42, 0.8, "triangle", false, 70);
        break;
      case "roundEnd":
      case "matchEnd":
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, t + i * 0.08, 0.5, 0.5),
        );
        break;
      case "upgrade":
      case "delivery":
        [440, 660, 880].forEach((f, i) =>
          this.tone(f, t + i * 0.06, 0.25, 0.6),
        );
        break;
      default:
        this.tone(500, t, 0.07, 0.15);
    }
  }
}
