import { EngineCore } from '../EngineCore';
import type { CanvasState } from './CanvasManager';

/** Coordinates simulation update/render without owning any global listeners. */
export class SystemManager {
  private readonly engineCore: EngineCore;

  constructor(canvas: HTMLCanvasElement) {
    this.engineCore = new EngineCore(canvas);
  }

  handleCanvasResize(state: CanvasState): void {
    this.engineCore.resize(state.displayWidth, state.displayHeight);
  }

  update(deltaTime: number): void {
    this.engineCore.update(deltaTime);
  }

  render(): void {
    const input = this.engineCore.getInputHandler().getMousePosition();
    const logic = this.engineCore.getGameLogic();
    const performance = this.engineCore.getPerformanceSettings();
    this.engineCore.getRenderSystem().render({
      mouseX: input.x,
      mouseY: input.y,
      activeMeteors: logic.getActiveMeteors(),
      activeParticles: this.engineCore.getParticleSystem().getActiveParticles(),
      powerUps: this.engineCore.getPowerUpManager().getPowerUps(),
      scoreTexts: this.engineCore.getScoreSystem().getActiveScoreTexts(),
      playerTrail: logic.getPlayerTrail(),
      powerUpCharges: this.engineCore.getPowerUpManager().getCharges(),
      maxPowerUpCharges: this.engineCore.getPowerUpManager().getMaxCharges(),
      isGameOver: logic.isGameOverState(),
      playerRingPhase: logic.getPlayerRingPhase(),
      screenShake: logic.getScreenShake(),
      adaptiveTrailsActive: performance.adaptiveTrailsActive && !performance.performanceModeActive,
      gameSettings: this.engineCore.getSettings(),
    });

    this.engineCore.getDefenseSystem().render();
    const activeChain = this.engineCore.getChainDetonationManager().getActiveChain();
    if (activeChain) {
      this.engineCore.getChainDetonationRenderer().renderChainDetonation(activeChain);
      this.engineCore.getChainDetonationRenderer().renderUI(activeChain);
    }
  }

  beginRun(seed: number): void { this.engineCore.beginRun(seed); }
  cleanup(): void { this.engineCore.cleanup(); }
  getEngineCore(): EngineCore { return this.engineCore; }
}
