import { FixedStepLoop } from "./FixedStepLoop";
import { InputController } from "./InputController";
import {
  SILENT_AUDIO,
  TankAudioController,
  type AudioPort,
} from "./AudioController";
import { TankRenderer } from "./Renderer";
import { TankSimulation } from "./TankSimulation";
import { CanvasViewport } from "./Viewport";
import type {
  PauseReason,
  RuntimeCallbacks,
  RuntimeDiagnostics,
  RunSnapshot,
  ViewportLayout,
} from "./types";
import type { TankCosmeticId } from "../api/playerContext";

export interface InputPort {
  attach(): void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  snapshot(): ReturnType<InputController["snapshot"]>;
  listenerCount(): number;
}

export interface ViewportPort {
  attach(): void;
  destroy(): void;
  getLayout(): ViewportLayout;
  observerCount(): number;
}

export interface LoopPort {
  start(): void;
  pause(): void;
  stop(): void;
  diagnostics(): ReturnType<FixedStepLoop["diagnostics"]>;
}

export interface RendererPort {
  render(snapshot: RunSnapshot, layout: ViewportLayout): number;
  setPlayerCosmetic?(cosmetic: TankCosmeticId): void;
}

export type LoopFactory = (step: () => void, render: () => void) => LoopPort;

export class GameRuntime {
  private readonly pauseReasons = new Set<PauseReason>();
  private readonly loop: LoopPort;
  private starts = 0;
  private finishes = 0;
  private resets = 0;
  private drawItems = 0;
  private destroyed = false;

  constructor(
    private readonly simulation: TankSimulation,
    private readonly input: InputPort,
    private readonly viewport: ViewportPort,
    private readonly renderer: RendererPort,
    loopFactory: LoopFactory,
    private readonly callbacks: RuntimeCallbacks,
    private readonly audio: AudioPort = SILENT_AUDIO,
  ) {
    this.loop = loopFactory(
      () => this.step(),
      () => this.render(),
    );
    this.input.attach();
    this.viewport.attach();
    this.render();
    this.emit();
  }

  static create(
    canvas: HTMLCanvasElement,
    touchSurface: HTMLElement,
    callbacks: RuntimeCallbacks,
  ): GameRuntime {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("TankaVOID requires a 2D canvas context.");

    let runtime: GameRuntime | null = null;
    const renderer = new TankRenderer(context);
    const viewport = new CanvasViewport(canvas, () => runtime?.render());
    const simulation = new TankSimulation();
    const input = new InputController(
      canvas,
      () => viewport.getLayout(),
      (intent) =>
        intent === "manual"
          ? runtime?.toggleManualPause()
          : runtime?.pause("focus"),
      window,
      touchSurface,
      () => simulation.snapshot().tank,
    );
    runtime = new GameRuntime(
      simulation,
      input,
      viewport,
      renderer,
      (step, render) => new FixedStepLoop(step, render),
      callbacks,
      new TankAudioController(),
    );
    return runtime;
  }

  start(seed: number): void {
    if (this.destroyed) return;
    this.loop.pause();
    this.audio.silence();
    this.pauseReasons.clear();
    this.simulation.start(seed);
    this.input.setEnabled(false);
    this.starts += 1;
    this.loop.start();
    this.emit();
  }

  restart(seed: number): void {
    if (this.destroyed) return;
    this.resets += 1;
    this.start(seed);
  }

  pause(reason: PauseReason): void {
    const snapshot = this.simulation.snapshot();
    if (
      this.destroyed ||
      snapshot.phase !== "running" ||
      snapshot.stage !== "combat"
    )
      return;
    this.pauseReasons.add(reason);
    this.simulation.pause();
    this.input.setEnabled(false);
    this.audio.silence();
    this.loop.pause();
    this.render();
    this.emit();
  }

  resume(): void {
    if (this.destroyed || this.simulation.snapshot().phase !== "paused") return;
    this.pauseReasons.clear();
    this.simulation.resume();
    this.input.setEnabled(this.simulation.snapshot().stage === "combat");
    this.loop.start();
    this.emit();
  }

  toggleManualPause(): void {
    const phase = this.simulation.snapshot().phase;
    if (phase === "running" && this.simulation.snapshot().stage === "combat")
      this.pause("manual");
    else if (phase === "paused") this.resume();
  }

  finish(): void {
    const phase = this.simulation.snapshot().phase;
    if (this.destroyed || (phase !== "running" && phase !== "paused")) return;
    this.simulation.finish();
    this.pauseReasons.clear();
    this.input.setEnabled(false);
    this.audio.silence();
    this.loop.pause();
    this.finishes += 1;
    this.render();
    this.emit();
  }

  returnToBriefing(): void {
    if (this.destroyed) return;
    this.loop.pause();
    this.pauseReasons.clear();
    this.input.setEnabled(false);
    this.audio.silence();
    this.simulation.returnToBriefing();
    this.render();
    this.emit();
  }

  snapshot(): RunSnapshot {
    return this.simulation.snapshot();
  }

  async unlockAudio(): Promise<boolean> {
    const unlocked = await this.audio.unlock();
    this.emit();
    return unlocked;
  }

  setAudioMuted(muted: boolean): void {
    this.audio.setMuted(muted);
    this.emit();
  }

  setPlayerCosmetic(cosmetic: TankCosmeticId): void {
    this.renderer.setPlayerCosmetic?.(cosmetic);
    this.render();
  }

  diagnostics(): RuntimeDiagnostics {
    const loop = this.loop.diagnostics();
    const snapshot = this.simulation.snapshot();
    const limits = this.simulation.limits();
    const audio = this.audio.diagnostics();
    return {
      starts: this.starts,
      finishes: this.finishes,
      resets: this.resets,
      inputListeners: this.input.listenerCount(),
      resizeObservers: this.viewport.observerCount(),
      framePending: loop.framePending,
      simulationSteps: loop.simulationSteps,
      renderedFrames: loop.renderedFrames,
      longFrames: loop.longFrames,
      averageFrameDeltaMilliseconds: loop.averageFrameDeltaMilliseconds,
      droppedMilliseconds: loop.droppedMilliseconds,
      maximumFrameDeltaMilliseconds: loop.maximumFrameDeltaMilliseconds,
      maximumStepsPerFrame: loop.maximumStepsPerFrame,
      activeProjectiles: snapshot.projectiles.length,
      projectileCapacity: this.simulation.projectileCapacity(),
      activeEnemies: snapshot.enemies.filter((enemy) => !enemy.disabled).length,
      enemyCapacity: limits.enemies,
      coverCount: snapshot.cover.length,
      coverCapacity: limits.cover,
      impactHistory: snapshot.impacts.length,
      impactHistoryCapacity: limits.impacts,
      coverStrikeHistory: snapshot.coverStrikes.length,
      coverStrikeHistoryCapacity: limits.coverStrikes,
      particleCount: 0,
      particleCapacity: limits.particles,
      drawItems: this.drawItems,
      drawItemCapacity: limits.drawItems,
      audioState: audio.state,
      soundMuted: audio.muted,
      audioContexts: audio.contexts,
      activeAudioVoices: audio.activeVoices,
      audioVoiceCapacity: audio.voiceCapacity,
      destroyed: this.destroyed,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.destroy();
    this.viewport.destroy();
    this.audio.destroy();
    this.callbacks.onDiagnostics(this.diagnostics());
  }

  render(): void {
    this.drawItems = this.renderer.render(
      this.simulation.snapshot(),
      this.viewport.getLayout(),
    );
  }

  private step(): void {
    const before = this.simulation.snapshot();
    this.simulation.step(this.input.snapshot());
    const snapshot = this.simulation.snapshot();
    this.emitAudio(before, snapshot);
    this.input.setEnabled(
      snapshot.phase === "running" && snapshot.stage === "combat",
    );
    if (snapshot.phase === "complete") {
      this.pauseReasons.clear();
      this.input.setEnabled(false);
      this.loop.pause();
      this.finishes += 1;
      this.render();
      this.emit();
      return;
    }
    if (snapshot.tick % 6 === 0) this.emit();
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.simulation.snapshot());
    this.callbacks.onDiagnostics(this.diagnostics());
  }

  private emitAudio(before: RunSnapshot, after: RunSnapshot): void {
    if (after.stats.shotsFired > before.stats.shotsFired)
      this.audio.play("fire");
    const beforeImpact = before.impacts[before.impacts.length - 1]?.id ?? 0;
    const afterImpact = after.impacts[after.impacts.length - 1]?.id ?? 0;
    if (afterImpact > beforeImpact) this.audio.play("impact");
    const beforeCover =
      before.coverStrikes[before.coverStrikes.length - 1]?.id ?? 0;
    const afterCover =
      after.coverStrikes[after.coverStrikes.length - 1]?.id ?? 0;
    if (afterCover > beforeCover) this.audio.play("cover");
    if (before.stage !== "wave-clear" && after.stage === "wave-clear")
      this.audio.play("wave");
    if (before.stage !== "resolved" && after.stage === "resolved")
      this.audio.play(
        after.completionReason === "run-cleared" ? "victory" : "defeat",
      );
  }
}
