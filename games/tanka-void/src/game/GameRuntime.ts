import { FixedStepLoop } from "./FixedStepLoop";
import { InputController } from "./InputController";
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
  render(snapshot: RunSnapshot, layout: ViewportLayout): void;
}

export type LoopFactory = (step: () => void, render: () => void) => LoopPort;

export class GameRuntime {
  private readonly pauseReasons = new Set<PauseReason>();
  private readonly loop: LoopPort;
  private starts = 0;
  private finishes = 0;
  private resets = 0;
  private destroyed = false;

  constructor(
    private readonly simulation: TankSimulation,
    private readonly input: InputPort,
    private readonly viewport: ViewportPort,
    private readonly renderer: RendererPort,
    loopFactory: LoopFactory,
    private readonly callbacks: RuntimeCallbacks,
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
    callbacks: RuntimeCallbacks,
  ): GameRuntime {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("TankaVOID requires a 2D canvas context.");

    let runtime: GameRuntime | null = null;
    const renderer = new TankRenderer(context);
    const viewport = new CanvasViewport(canvas, () => runtime?.render());
    const input = new InputController(
      canvas,
      () => viewport.getLayout(),
      (intent) =>
        intent === "manual"
          ? runtime?.toggleManualPause()
          : runtime?.pause("focus"),
    );
    runtime = new GameRuntime(
      new TankSimulation(),
      input,
      viewport,
      renderer,
      (step, render) => new FixedStepLoop(step, render),
      callbacks,
    );
    return runtime;
  }

  start(seed: number): void {
    if (this.destroyed) return;
    this.loop.pause();
    this.pauseReasons.clear();
    this.simulation.start(seed);
    this.input.setEnabled(true);
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
    if (this.destroyed || this.simulation.snapshot().phase !== "running")
      return;
    this.pauseReasons.add(reason);
    this.simulation.pause();
    this.input.setEnabled(false);
    this.loop.pause();
    this.render();
    this.emit();
  }

  resume(): void {
    if (this.destroyed || this.simulation.snapshot().phase !== "paused") return;
    this.pauseReasons.clear();
    this.simulation.resume();
    this.input.setEnabled(true);
    this.loop.start();
    this.emit();
  }

  toggleManualPause(): void {
    const phase = this.simulation.snapshot().phase;
    if (phase === "running") this.pause("manual");
    else if (phase === "paused") this.resume();
  }

  finish(): void {
    const phase = this.simulation.snapshot().phase;
    if (this.destroyed || (phase !== "running" && phase !== "paused")) return;
    this.simulation.finish();
    this.pauseReasons.clear();
    this.input.setEnabled(false);
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
    this.simulation.returnToBriefing();
    this.render();
    this.emit();
  }

  snapshot(): RunSnapshot {
    return this.simulation.snapshot();
  }

  diagnostics(): RuntimeDiagnostics {
    const loop = this.loop.diagnostics();
    return {
      starts: this.starts,
      finishes: this.finishes,
      resets: this.resets,
      inputListeners: this.input.listenerCount(),
      resizeObservers: this.viewport.observerCount(),
      framePending: loop.framePending,
      simulationSteps: loop.simulationSteps,
      droppedMilliseconds: loop.droppedMilliseconds,
      activeProjectiles: this.simulation.snapshot().projectiles.length,
      projectileCapacity: this.simulation.projectileCapacity(),
      impactHistory: this.simulation.snapshot().impacts.length,
      destroyed: this.destroyed,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.destroy();
    this.viewport.destroy();
    this.callbacks.onDiagnostics(this.diagnostics());
  }

  render(): void {
    this.renderer.render(this.simulation.snapshot(), this.viewport.getLayout());
  }

  private step(): void {
    this.simulation.step(this.input.snapshot());
    if (this.simulation.snapshot().phase === "complete") {
      this.pauseReasons.clear();
      this.input.setEnabled(false);
      this.loop.pause();
      this.finishes += 1;
      this.render();
      this.emit();
      return;
    }
    if (this.simulation.snapshot().tick % 6 === 0) this.emit();
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.simulation.snapshot());
    this.callbacks.onDiagnostics(this.diagnostics());
  }
}
