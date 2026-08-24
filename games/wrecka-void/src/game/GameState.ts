import { GameState } from "../types/Game";
import {
  WRECK_RUN_BOSS_BREAK_BONUS,
  WRECK_RUN_WAVE_CLEAR_BONUS,
  type WreckRunSnapshot,
} from "./WreckRunDirector";

const CLOCK_PRESENTATION_INTERVAL_SECONDS = 0.1;

export class GameStateManager {
  private state: GameState;
  private listeners: ((state: GameState) => void)[] = [];
  private lastClockNotification = 0;

  constructor() {
    this.state = {
      score: 0,
      wave: 1,
      act: 1,
      bossesDefeated: 0,
      runOutcome: "playing",
      health: 100,
      maxHealth: 100,
      gameTime: 0,
      isGameOver: false,
      isPaused: false,
      isWindowFocused: true,
    };
  }

  getState(): GameState {
    return { ...this.state };
  }

  setState(updates: Partial<GameState>): void {
    this.state = { ...this.state, ...updates };
    this.lastClockNotification = this.state.gameTime;
    this.notifyListeners();
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }

  updateScore(points: number): void {
    this.setState({ score: this.state.score + points });
  }

  updateHealth(damage: number): void {
    const newHealth = Math.max(0, this.state.health - damage);
    this.setState({
      health: newHealth,
      isGameOver: newHealth <= 0,
      runOutcome: newHealth <= 0 ? "defeat" : this.state.runOutcome,
    });
  }

  syncEncounter(snapshot: Pick<WreckRunSnapshot, "act" | "wave">): void {
    if (snapshot.act === this.state.act && snapshot.wave === this.state.wave) return;
    const wavesCleared = Math.max(0, snapshot.wave - this.state.wave);
    this.setState({
      act: snapshot.act,
      wave: snapshot.wave,
      score: this.state.score + wavesCleared * WRECK_RUN_WAVE_CLEAR_BONUS,
    });
  }

  recordBossDefeat(): void {
    if (this.state.isGameOver) return;
    const bossesDefeated = Math.min(3, this.state.bossesDefeated + 1);
    this.setState({
      bossesDefeated,
      act: Math.min(3, bossesDefeated + 1) as 1 | 2 | 3,
      score: this.state.score + WRECK_RUN_BOSS_BREAK_BONUS,
      runOutcome: bossesDefeated === 3 ? "victory" : "playing",
      isGameOver: bossesDefeated === 3,
    });
  }

  updateGameTime(deltaTime: number): void {
    if (!this.state.isPaused && !this.state.isGameOver) {
      this.state.gameTime += deltaTime / 1000;
      if (
        this.state.gameTime - this.lastClockNotification >=
        CLOCK_PRESENTATION_INTERVAL_SECONDS
      ) {
        this.lastClockNotification = this.state.gameTime;
        this.notifyListeners();
      }
    }
  }

  togglePause(): void {
    this.setState({ isPaused: !this.state.isPaused });
  }

  setWindowFocus(focused: boolean): void {
    this.setState({ isWindowFocused: focused });
  }

  reset(): void {
    this.state = {
      score: 0,
      wave: 1,
      act: 1,
      bossesDefeated: 0,
      runOutcome: "playing",
      health: 100,
      maxHealth: 100,
      gameTime: 0,
      isGameOver: false,
      isPaused: false,
      isWindowFocused: true,
    };
    this.lastClockNotification = 0;
    this.notifyListeners();
  }
}
