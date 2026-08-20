import { describe, expect, it, vi } from "vitest";
import {
  GameRuntime,
  type InputPort,
  type LoopPort,
  type RendererPort,
  type ViewportPort,
} from "./GameRuntime";
import { TankSimulation } from "./TankSimulation";
import { computeViewport } from "./Viewport";
import type { AudioCue, AudioDiagnostics, AudioPort } from "./AudioController";

class FakeInput implements InputPort {
  listeners = 0;
  fire = false;
  attach(): void {
    this.listeners = 12;
  }
  destroy(): void {
    this.listeners = 0;
  }
  setEnabled(): void {}
  snapshot() {
    return {
      throttle: 1,
      turn: 0,
      aim: { x: 900, y: 360 },
      fire: this.fire,
    };
  }
  listenerCount(): number {
    return this.listeners;
  }
}

class FakeAudio implements AudioPort {
  cues: AudioCue[] = [];
  muted = false;
  silences = 0;
  destroyed = false;
  async unlock(): Promise<boolean> {
    return true;
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  play(cue: AudioCue): void {
    this.cues.push(cue);
  }
  silence(): void {
    this.silences += 1;
  }
  diagnostics(): AudioDiagnostics {
    return {
      state: "ready",
      muted: this.muted,
      contexts: 1,
      activeVoices: 0,
      voiceCapacity: 8,
    };
  }
  destroy(): void {
    this.destroyed = true;
  }
}

class FakeViewport implements ViewportPort {
  observers = 0;
  attach(): void {
    this.observers = 1;
  }
  destroy(): void {
    this.observers = 0;
  }
  getLayout() {
    return computeViewport(1200, 720, 1);
  }
  observerCount(): number {
    return this.observers;
  }
}

class FakeLoop implements LoopPort {
  pending = false;
  steps = 0;
  constructor(
    readonly step: () => void,
    readonly render: () => void,
  ) {}
  start(): void {
    this.pending = true;
  }
  pause(): void {
    this.pending = false;
  }
  stop(): void {
    this.pending = false;
    this.steps = 0;
  }
  diagnostics() {
    return {
      framePending: this.pending,
      simulationSteps: this.steps,
      renderedFrames: this.steps,
      longFrames: 0,
      averageFrameDeltaMilliseconds: 16.7,
      droppedMilliseconds: 0,
      maximumFrameDeltaMilliseconds: 16.7,
      maximumStepsPerFrame: 5,
    };
  }
  advance(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.step();
      this.steps += 1;
    }
    this.render();
  }
}

describe("GameRuntime", () => {
  it("keeps one ownership boundary through twenty complete/restart cycles", () => {
    const input = new FakeInput();
    const viewport = new FakeViewport();
    const renderer: RendererPort = { render: vi.fn(() => 7) };
    let loop: FakeLoop | undefined;
    const runtime = new GameRuntime(
      new TankSimulation(),
      input,
      viewport,
      renderer,
      (step, render) => (loop = new FakeLoop(step, render)),
      { onSnapshot: vi.fn(), onDiagnostics: vi.fn() },
    );

    runtime.start(1);
    for (let cycle = 0; cycle < 20; cycle += 1) {
      loop?.advance(12);
      runtime.finish();
      if (cycle < 19) runtime.restart(cycle + 2);
    }

    expect(runtime.diagnostics()).toMatchObject({
      starts: 20,
      finishes: 20,
      resets: 19,
      inputListeners: 12,
      resizeObservers: 1,
      framePending: false,
      activeEnemies: 1,
      enemyCapacity: 3,
      coverCount: 4,
      coverCapacity: 4,
      particleCount: 0,
      particleCapacity: 0,
      drawItems: 7,
      drawItemCapacity: 64,
      destroyed: false,
    });
    runtime.destroy();
    expect(runtime.diagnostics()).toMatchObject({
      inputListeners: 0,
      resizeObservers: 0,
      framePending: false,
      destroyed: true,
    });
  });

  it("routes combat cues through one audio owner and silences pause/destroy", () => {
    const input = new FakeInput();
    const viewport = new FakeViewport();
    const audio = new FakeAudio();
    let loop: FakeLoop | undefined;
    const runtime = new GameRuntime(
      new TankSimulation(),
      input,
      viewport,
      { render: () => 7 },
      (step, render) => (loop = new FakeLoop(step, render)),
      { onSnapshot: vi.fn(), onDiagnostics: vi.fn() },
      audio,
    );
    runtime.start(4);
    loop?.advance(180);
    input.fire = true;
    loop?.advance(1);
    input.fire = false;
    expect(audio.cues).toContain("fire");
    expect(runtime.diagnostics()).toMatchObject({
      audioState: "ready",
      audioContexts: 1,
      audioVoiceCapacity: 8,
    });

    runtime.pause("manual");
    expect(audio.silences).toBeGreaterThan(0);
    runtime.setAudioMuted(true);
    expect(runtime.diagnostics().soundMuted).toBe(true);
    runtime.destroy();
    expect(audio.destroyed).toBe(true);
  });
});
