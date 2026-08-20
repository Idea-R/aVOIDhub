export interface ScreenShake {
  x: number;
  y: number;
  intensity: number;
  duration: number;
}

export class GameStateManager {
  private gameTime: number = 0;
  private simulationTicks: number = 0;
  private isGameOver: boolean = false;
  private gracePeriodActive: boolean = false;
  private gracePeriodDuration: number = 3000; // 3 seconds
  private knockbackCooldown: number = 0;
  private playerRingPhase: number = 0;
  private screenShake: ScreenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
  private reducedMotion = false;

  private onGameOver: () => void = () => {};

  setGameOverCallback(callback: () => void): void {
    this.onGameOver = callback;
  }

  updateGameTime(): void {
    if (this.isGameOver) return;
    this.simulationTicks += 1;
    this.gameTime = this.simulationTicks / 60;
  }

  updateGracePeriod(): boolean {
    if (this.gracePeriodActive) {
      if (this.gameTime * 1000 >= this.gracePeriodDuration) {
        this.gracePeriodActive = false;
        console.log('🎮 Grace period ended - meteors will now spawn');
        return false;
      }
      return true;
    }
    return false;
  }

  updateKnockbackCooldown(deltaTime: number): void {
    if (this.knockbackCooldown > 0) {
      this.knockbackCooldown -= deltaTime / 1000;
    }
  }

  updatePlayerRingPhase(deltaTime: number, hasCharges: boolean): void {
    if (hasCharges) {
      this.playerRingPhase += deltaTime * 0.008;
    }
  }

  updateScreenShake(deltaTime: number): void {
    if (this.reducedMotion) {
      this.screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
      return;
    }
    if (this.screenShake.duration > 0) {
      this.screenShake.duration -= deltaTime;
      const intensity = (this.screenShake.duration / 500) * this.screenShake.intensity;
      this.screenShake.x = (Math.random() - 0.5) * intensity;
      this.screenShake.y = (Math.random() - 0.5) * intensity;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }
  }

  setScreenShake(shake: ScreenShake): void {
    this.screenShake = this.reducedMotion
      ? { x: 0, y: 0, intensity: 0, duration: 0 }
      : shake;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) this.screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
  }

  triggerGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.onGameOver();
  }

  resetPlayerRingPhase(): void {
    this.playerRingPhase = 0;
  }

  reset(): void {
    this.isGameOver = false;
    this.gameTime = 0;
    this.simulationTicks = 0;
    this.gracePeriodActive = true;
    this.knockbackCooldown = 0;
    this.playerRingPhase = 0;
    this.screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
  }

  // Getters
  getGameTime(): number {
    return this.gameTime;
  }

  isGameOverState(): boolean {
    return this.isGameOver;
  }

  isGracePeriodActive(): boolean {
    return this.gracePeriodActive;
  }

  getPlayerRingPhase(): number {
    return this.playerRingPhase;
  }

  getScreenShake(): ScreenShake {
    return this.screenShake;
  }

  getKnockbackCooldown(): number {
    return this.knockbackCooldown;
  }
}
