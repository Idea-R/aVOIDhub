import { GameEngineCore, type GameEngineDiagnostics } from './GameEngineCore';
import type { PauseReason } from './GameLoop';
import type { GameStateData } from '../state/GameState';
import type { RunEvidence } from '../run/runEvidence';

/** Public boundary between the React shell and the game simulation. */
export default class GameEngine {
  private readonly core: GameEngineCore;

  constructor(canvas: HTMLCanvasElement, seedFactory?: () => number) {
    this.core = new GameEngineCore(canvas, seedFactory);
  }

  start(): void { this.core.start(); }
  stop(): void { this.core.stop(); }
  resetGame(): void { this.core.resetGame(); }
  pause(reason: PauseReason = 'manual'): void { this.core.pause(reason); }
  resume(reason: PauseReason = 'manual'): void { this.core.resume(reason); }
  isStarted(): boolean { return this.core.isStarted(); }
  isPausedState(): boolean { return this.core.isPausedState(); }

  setStateUpdateCallback(callback: (state: GameStateData) => void): void {
    this.core.onStateUpdate = callback;
  }

  setPauseChangeCallback(
    callback: (isPaused: boolean, reasons: PauseReason[]) => void,
  ): void {
    this.core.onPauseChange = callback;
  }

  getDiagnostics(): GameEngineDiagnostics { return this.core.getDiagnostics(); }
  getRunEvidence(): RunEvidence | null { return this.core.getRunEvidence(); }
  forceGameOverForTest(): void { this.core.forceGameOverForTest(); }
}
