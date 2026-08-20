import { FIXED_STEP_MS } from "./types";

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(frameId: number): void;
}

export interface LoopDiagnostics {
  framePending: boolean;
  simulationSteps: number;
  droppedMilliseconds: number;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (frameId) => cancelAnimationFrame(frameId),
};

export class FixedStepLoop {
  private frameId: number | null = null;
  private running = false;
  private previousTimestamp: number | null = null;
  private accumulator = 0;
  private simulationSteps = 0;
  private droppedMilliseconds = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (interpolation: number) => void,
    private readonly scheduler: FrameScheduler = browserScheduler,
    private readonly fixedStepMs = FIXED_STEP_MS,
    private readonly maximumStepsPerFrame = 5,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTimestamp = null;
    this.frameId = this.scheduler.request(this.onFrame);
  }

  pause(): void {
    this.running = false;
    if (this.frameId !== null) this.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  stop(): void {
    this.pause();
    this.simulationSteps = 0;
    this.droppedMilliseconds = 0;
  }

  diagnostics(): LoopDiagnostics {
    return {
      framePending: this.running,
      simulationSteps: this.simulationSteps,
      droppedMilliseconds: this.droppedMilliseconds,
    };
  }

  private readonly onFrame: FrameRequestCallback = (timestamp) => {
    this.frameId = null;
    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
      this.render(0);
      if (this.running) this.frameId = this.scheduler.request(this.onFrame);
      return;
    }

    const elapsed = Math.max(
      0,
      Math.min(250, timestamp - this.previousTimestamp),
    );
    this.previousTimestamp = timestamp;
    this.accumulator += elapsed;

    let steps = 0;
    while (
      this.accumulator >= this.fixedStepMs &&
      steps < this.maximumStepsPerFrame
    ) {
      this.step();
      this.accumulator -= this.fixedStepMs;
      this.simulationSteps += 1;
      steps += 1;
    }
    if (this.accumulator >= this.fixedStepMs) {
      this.droppedMilliseconds += this.accumulator;
      this.accumulator = 0;
    }

    this.render(this.accumulator / this.fixedStepMs);
    if (this.running) this.frameId = this.scheduler.request(this.onFrame);
  };
}
