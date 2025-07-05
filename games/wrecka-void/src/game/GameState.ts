import { GameState } from '../types/Game';

export class GameStateManager {
  private state: GameState;
  private listeners: ((state: GameState) => void)[] = [];

  constructor() {
    this.state = {
      score: 0,
      wave: 1,
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
    this.listeners.forEach(listener => listener(this.state));
  }

  updateScore(points: number): void {
    this.setState({ score: this.state.score + points });
  }

  updateHealth(damage: number): void {
    const newHealth = Math.max(0, this.state.health - damage);
    this.setState({ 
      health: newHealth,
      isGameOver: newHealth <= 0
    });
  }

  updateWave(): void {
    if (this.state.score > this.state.wave * 150) {
      this.setState({ wave: this.state.wave + 1 });
    }
  }

  updateGameTime(deltaTime: number): void {
    if (!this.state.isPaused && !this.state.isGameOver) {
      this.setState({ gameTime: this.state.gameTime + deltaTime / 1000 });
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
      health: 100,
      maxHealth: 100,
      gameTime: 0,
      isGameOver: false,
      isPaused: false,
      isWindowFocused: true,
    };
    this.notifyListeners();
  }
}