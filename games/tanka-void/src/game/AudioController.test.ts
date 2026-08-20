import { describe, expect, it, vi } from "vitest";
import { TankAudioController } from "./AudioController";

class FakeOscillator {
  type: OscillatorType = "sine";
  onended: (() => void) | null = null;
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class FakeAudioContext {
  currentTime = 10;
  destination = {} as AudioNode;
  state: AudioContextState = "suspended";
  oscillators: FakeOscillator[] = [];
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
  createGain(): GainNode {
    return new FakeGain() as unknown as GainNode;
  }
}

describe("TankAudioController", () => {
  it("creates one gesture-owned context and bounds active voices", async () => {
    const context = new FakeAudioContext();
    const factory = vi.fn(() => context);
    const audio = new TankAudioController(factory);
    expect(audio.diagnostics()).toMatchObject({
      state: "locked",
      contexts: 0,
      activeVoices: 0,
      voiceCapacity: 8,
    });

    expect(await audio.unlock()).toBe(true);
    expect(await audio.unlock()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 12; index += 1) audio.play("fire");
    expect(audio.diagnostics()).toMatchObject({
      state: "ready",
      contexts: 1,
      activeVoices: 8,
    });
    expect(context.oscillators).toHaveLength(8);

    audio.silence();
    expect(audio.diagnostics().activeVoices).toBe(0);
    expect(
      context.oscillators.every((voice) => voice.stop.mock.calls.length > 0),
    ).toBe(true);
    audio.destroy();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(audio.diagnostics()).toMatchObject({ contexts: 0, activeVoices: 0 });
  });

  it("fails closed when muted or Web Audio is unavailable", async () => {
    const muted = new TankAudioController(() => new FakeAudioContext());
    muted.setMuted(true);
    expect(await muted.unlock()).toBe(false);
    expect(muted.diagnostics()).toMatchObject({ muted: true, contexts: 0 });

    const unavailable = new TankAudioController(() => {
      throw new Error("unavailable");
    });
    expect(await unavailable.unlock()).toBe(false);
    expect(unavailable.diagnostics().state).toBe("unavailable");
    expect(await unavailable.unlock()).toBe(false);
  });
});
