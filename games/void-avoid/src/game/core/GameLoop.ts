export type PauseReason = 'manual' | 'focus' | 'visibility' | 'help' | 'terminal';

export interface GameLoopEnvironment {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (frameId: number) => void;
  now: () => number;
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener'>;
  isDocumentHidden: () => boolean;
}

export interface GameLoopDiagnostics {
  started: boolean;
  paused: boolean;
  framePending: boolean;
  pauseReasons: PauseReason[];
  framesRequested: number;
  framesCancelled: number;
  simulationSteps: number;
}

const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 100;
const MAX_STEPS_PER_FRAME = 6;

function browserEnvironment(): GameLoopEnvironment {
  return {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
    now: () => performance.now(),
    windowTarget: window,
    documentTarget: document,
    isDocumentHidden: () => document.hidden,
  };
}

export class GameLoop {
  private readonly environment: GameLoopEnvironment;
  private animationFrame: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private started = false;
  private pauseReasons = new Set<PauseReason>();
  private cleanedUp = false;
  private framesRequested = 0;
  private framesCancelled = 0;
  private simulationSteps = 0;

  private updateCallback: (deltaTime: number) => void = () => {};
  private renderCallback: () => void = () => {};
  private fpsUpdateCallback: (timestamp: number) => void = () => {};
  private pauseChangeCallback: (isPaused: boolean, reasons: PauseReason[]) => void = () => {};

  constructor(environment: GameLoopEnvironment = browserEnvironment()) {
    this.environment = environment;
    this.environment.windowTarget.addEventListener('blur', this.handleWindowBlur);
    this.environment.windowTarget.addEventListener('focus', this.handleWindowFocus);
    this.environment.documentTarget.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  setCallbacks(
    updateCallback: (deltaTime: number) => void,
    renderCallback: () => void,
    fpsUpdateCallback: (timestamp: number) => void,
  ): void {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.fpsUpdateCallback = fpsUpdateCallback;
  }

  setPauseChangeCallback(callback: (isPaused: boolean, reasons: PauseReason[]) => void): void {
    this.pauseChangeCallback = callback;
  }

  private handleWindowBlur = (): void => {
    if (this.started) this.pause('focus');
  };

  private handleWindowFocus = (): void => {
    if (this.started && !this.environment.isDocumentHidden()) this.resume('focus');
  };

  private handleVisibilityChange = (): void => {
    if (!this.started) return;
    if (this.environment.isDocumentHidden()) this.pause('visibility');
    else this.resume('visibility');
  };

  private requestNextFrame(): void {
    if (!this.started || this.isPausedState() || this.animationFrame !== null) return;
    this.animationFrame = this.environment.requestFrame(this.gameLoop);
    this.framesRequested += 1;
  }

  private cancelPendingFrame(): void {
    if (this.animationFrame === null) return;
    this.environment.cancelFrame(this.animationFrame);
    this.animationFrame = null;
    this.framesCancelled += 1;
  }

  private gameLoop = (timestamp: number): void => {
    this.animationFrame = null;
    if (!this.started || this.isPausedState()) return;

    const frameDelta = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, timestamp - this.lastTime));
    this.lastTime = timestamp;
    this.accumulator += frameDelta;
    this.fpsUpdateCallback(timestamp);

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.updateCallback(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      this.simulationSteps += 1;
      steps += 1;
      if (!this.started || this.isPausedState()) break;
    }

    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (this.started && !this.isPausedState()) {
      this.renderCallback();
      this.requestNextFrame();
    }
  };

  start(): void {
    if (this.started || this.cleanedUp) return;
    this.started = true;
    this.pauseReasons.clear();
    this.accumulator = 0;
    this.lastTime = this.environment.now();
    this.notifyPauseChange();
    this.requestNextFrame();
  }

  stop(): void {
    this.cancelPendingFrame();
    this.started = false;
    this.pauseReasons.clear();
    this.accumulator = 0;
    this.notifyPauseChange();
  }

  pause(reason: PauseReason = 'manual'): void {
    if (!this.started || this.pauseReasons.has(reason)) return;
    this.pauseReasons.add(reason);
    this.cancelPendingFrame();
    this.notifyPauseChange();
  }

  resume(reason: PauseReason = 'manual'): void {
    if (!this.started || !this.pauseReasons.delete(reason)) return;
    if (!this.isPausedState()) {
      this.lastTime = this.environment.now();
      this.accumulator = 0;
      this.requestNextFrame();
    }
    this.notifyPauseChange();
  }

  reset(): void {
    this.pauseReasons.clear();
    this.accumulator = 0;
    this.lastTime = this.environment.now();
    this.notifyPauseChange();
    this.requestNextFrame();
  }

  cleanup(): void {
    if (this.cleanedUp) return;
    this.stop();
    this.environment.windowTarget.removeEventListener('blur', this.handleWindowBlur);
    this.environment.windowTarget.removeEventListener('focus', this.handleWindowFocus);
    this.environment.documentTarget.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.cleanedUp = true;
  }

  private notifyPauseChange(): void {
    this.pauseChangeCallback(this.isPausedState(), [...this.pauseReasons]);
  }

  isStarted(): boolean {
    return this.started;
  }

  isPausedState(): boolean {
    return this.pauseReasons.size > 0;
  }

  hasPauseReason(reason: PauseReason): boolean {
    return this.pauseReasons.has(reason);
  }

  getDiagnostics(): GameLoopDiagnostics {
    return {
      started: this.started,
      paused: this.isPausedState(),
      framePending: this.animationFrame !== null,
      pauseReasons: [...this.pauseReasons],
      framesRequested: this.framesRequested,
      framesCancelled: this.framesCancelled,
      simulationSteps: this.simulationSteps,
    };
  }
}
