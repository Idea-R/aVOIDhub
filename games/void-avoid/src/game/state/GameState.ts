import type { ScoreBreakdown, ComboInfo } from '../systems/ScoreSystem';
import type { GameSettings } from '../GameLogic';

/** Session-local state relay. Platform identity and score trust are separate V2 work. */
export class GameState {
  private onStateUpdate: (state: GameStateData) => void = () => {};
  private onGameOver: () => void = () => {};

  setCallbacks(
    onStateUpdate: (state: GameStateData) => void,
    onGameOver: () => void,
  ): void {
    this.onStateUpdate = onStateUpdate;
    this.onGameOver = onGameOver;
  }

  publish(state: GameStateData): void { this.onStateUpdate(state); }
  handleGameOver(): void { this.onGameOver(); }
  reset(): void { /* no state is retained here */ }
}

export interface GameStateData {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  comboInfo: ComboInfo;
  powerUpCharges: number;
  maxPowerUpCharges: number;
  time: number;
  isGameOver: boolean;
  fps: number;
  meteors: number;
  particles: number;
  poolSizes: { meteors: number; particles: number };
  autoScaling: { enabled: boolean; shadowsEnabled: boolean; maxParticles: number; adaptiveTrailsActive: boolean };
  performance: { averageFrameTime: number; memoryUsage: number; lastScalingEvent: string };
  settings: GameSettings;
}
