import { GameLoop, type GameLoopDiagnostics, type PauseReason } from './GameLoop';
import { PerformanceManager } from './PerformanceManager';
import { SystemManager } from './SystemManager';
import { InputSystem } from '../systems/InputSystem';
import { GameState, type GameStateData } from '../state/GameState';
import { CanvasManager } from './CanvasManager';
import type { InputDiagnostics } from '../InputHandler';
import { createRunSeed } from '../run/seededRandom';
import type { RunEvidence, RunEvidenceSummary } from '../run/runEvidence';

export interface GameEngineDiagnostics {
  loop: GameLoopDiagnostics;
  input: InputDiagnostics;
  canvas: { width: number; height: number; pixelRatio: number };
  sessionsStarted: number;
  sessionsFinished: number;
  resets: number;
  cleanedUp: boolean;
  run: RunEvidenceSummary;
}

export class GameEngineCore {
  private readonly canvasManager: CanvasManager;
  private readonly gameLoop = new GameLoop();
  private readonly performanceManager = new PerformanceManager();
  private readonly systemManager: SystemManager;
  private readonly inputSystem: InputSystem;
  private readonly gameState = new GameState();
  private lastStateUpdateTime = 0;
  private sessionsStarted = 0;
  private sessionsFinished = 0;
  private resets = 0;
  private cleanedUp = false;
  private gameOverPublished = false;

  onStateUpdate: (state: GameStateData) => void = () => {};
  onPauseChange: (isPaused: boolean, reasons: PauseReason[]) => void = () => {};

  constructor(
    canvas: HTMLCanvasElement,
    private readonly seedFactory: () => number = createRunSeed,
  ) {
    this.canvasManager = new CanvasManager(canvas, {
      preventZoom: false,
      handleDevicePixelRatio: false,
      maintainAspectRatio: false,
      minWidth: 1,
      minHeight: 1,
      maxWidth: 3840,
      maxHeight: 2160,
    }, { resizeManager: { logResizeEvents: false } });

    this.systemManager = new SystemManager(canvas);
    const core = this.systemManager.getEngineCore();
    this.inputSystem = new InputSystem(
      core.getInputHandler(),
      core.getCollisionSystem(),
      core.getParticleSystem(),
      core.getPowerUpManager(),
      core.getGameLogic(),
    );
    core.getInputHandler().setCanvasManager(this.canvasManager);
    core.setKnockbackCallback(() => this.inputSystem.handleKnockbackActivation());
    this.canvasManager.onResize((state) => this.systemManager.handleCanvasResize(state));
    this.canvasManager.forceResize();

    this.gameLoop.setCallbacks(
      (deltaTime) => this.update(deltaTime),
      () => this.systemManager.render(),
      (timestamp) => this.updateFPS(timestamp),
    );
    this.gameLoop.setPauseChangeCallback((isPaused, reasons) => this.onPauseChange(isPaused, reasons));
    this.performanceManager.setCallbacks(
      () => this.applyPerformanceSettings(),
      (enabled) => core.applyPerformanceMode(enabled),
    );
    this.gameState.setCallbacks(
      (state) => this.onStateUpdate(state),
      () => this.handleGameOver(),
    );
    core.getGameLogic().onGameOver = () => this.gameState.handleGameOver();
  }

  private update(deltaTime: number): void {
    this.systemManager.update(deltaTime);
    this.inputSystem.update();
    const now = performance.now();
    if (now - this.lastStateUpdateTime >= 200) {
      this.publishState();
      this.lastStateUpdateTime = now;
    }
  }

  private updateFPS(timestamp: number): void {
    const core = this.systemManager.getEngineCore();
    const performance = core.getPerformanceSettings();
    this.performanceManager.updateFPS(
      timestamp,
      performance,
      core.getGameLogic().getMeteorCount(),
      core.getParticleSystem().getParticleCount(),
      performance.autoPerformanceModeEnabled,
    );
  }

  private applyPerformanceSettings(): void {
    const core = this.systemManager.getEngineCore();
    const performance = core.getPerformanceSettings();
    core.getParticleSystem().setMaxParticles(performance.dynamicMaxParticles);
    core.getRenderSystem().setShadowsEnabled(performance.shadowsEnabled);
  }

  private publishState(forceGameOver = false): void {
    const core = this.systemManager.getEngineCore();
    const performance = this.performanceManager.getPerformanceStats(core.getPerformanceSettings());
    const logic = core.getGameLogic();
    this.gameState.publish({
      score: core.getScoreSystem().getTotalScore(),
      scoreBreakdown: core.getScoreSystem().getScoreBreakdown(),
      comboInfo: core.getScoreSystem().getComboInfo(),
      powerUpCharges: core.getPowerUpManager().getCharges(),
      maxPowerUpCharges: core.getPowerUpManager().getMaxCharges(),
      time: logic.getGameTime(),
      isGameOver: forceGameOver || logic.isGameOverState(),
      fps: performance.fps,
      meteors: logic.getMeteorCount(),
      particles: core.getParticleSystem().getParticleCount(),
      poolSizes: {
        meteors: logic.getMeteorPoolSize(),
        particles: core.getParticleSystem().getPoolSize(),
      },
      autoScaling: {
        enabled: core.getAutoScalingEnabled(),
        shadowsEnabled: performance.shadowsEnabled,
        maxParticles: performance.maxParticles,
        adaptiveTrailsActive: performance.adaptiveTrailsActive,
      },
      performance: {
        averageFrameTime: performance.averageFrameTime,
        memoryUsage: performance.memoryUsage,
        lastScalingEvent: performance.lastScalingEvent,
      },
      settings: core.getSettings(),
      run: core.getRunSummary(),
    });
  }

  private handleGameOver(): void {
    if (this.gameOverPublished) return;
    this.gameOverPublished = true;
    this.sessionsFinished += 1;
    this.gameLoop.pause('terminal');
    this.systemManager.getEngineCore().finishRunEvidence();
    this.publishState(true);
  }

  start(): void {
    if (this.cleanedUp || this.gameLoop.isStarted()) return;
    this.systemManager.beginRun(this.seedFactory());
    this.gameState.reset();
    this.performanceManager.reset();
    this.gameOverPublished = false;
    this.sessionsStarted += 1;
    this.publishState();
    this.gameLoop.start();
  }

  stop(): void {
    if (this.cleanedUp) return;
    this.gameLoop.cleanup();
    this.inputSystem.cleanup();
    this.systemManager.cleanup();
    this.canvasManager.cleanup();
    this.cleanedUp = true;
  }

  resetGame(): void {
    if (this.cleanedUp || !this.gameLoop.isStarted()) return;
    this.gameLoop.reset();
    this.performanceManager.reset();
    this.systemManager.beginRun(this.seedFactory());
    this.gameState.reset();
    this.gameOverPublished = false;
    this.resets += 1;
    this.sessionsStarted += 1;
    this.publishState();
  }

  pause(reason: PauseReason): void { this.gameLoop.pause(reason); }
  resume(reason: PauseReason): void { this.gameLoop.resume(reason); }
  isStarted(): boolean { return this.gameLoop.isStarted(); }
  isPausedState(): boolean { return this.gameLoop.isPausedState(); }

  forceGameOverForTest(): void {
    if (!import.meta.env.DEV || this.cleanedUp) return;
    this.systemManager.getEngineCore().getGameLogic().forceGameOverForTest();
  }

  getDiagnostics(): GameEngineDiagnostics {
    const canvasState = this.canvasManager.getState();
    return {
      loop: this.gameLoop.getDiagnostics(),
      input: this.systemManager.getEngineCore().getInputHandler().getDiagnostics(),
      canvas: {
        width: canvasState.displayWidth,
        height: canvasState.displayHeight,
        pixelRatio: canvasState.pixelRatio,
      },
      sessionsStarted: this.sessionsStarted,
      sessionsFinished: this.sessionsFinished,
      resets: this.resets,
      cleanedUp: this.cleanedUp,
      run: this.systemManager.getEngineCore().getRunSummary(),
    };
  }

  getRunEvidence(): RunEvidence | null {
    return this.systemManager.getEngineCore().getRunEvidence();
  }
}
