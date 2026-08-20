import { RenderSystem } from './systems/RenderSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { DefenseSystem } from './systems/DefenseSystem';
import { ChainDetonationManager } from './entities/ChainDetonation';
import { ChainDetonationRenderer } from './systems/ChainDetonationRenderer';
import { PowerUpManager } from './entities/PowerUp';
import { InputHandler } from './InputHandler';
import { GameLogic, type GameSystems, type GameSettings } from './GameLogic';
import { SpatialGrid } from './utils/SpatialGrid';
import { RunRandomStreams } from './run/seededRandom';
import {
  RunEvidenceRecorder,
  type RunEvidence,
  type RunEvidenceSummary,
} from './run/runEvidence';

export interface PerformanceSettings {
  autoScaleEnabled: boolean;
  shadowsEnabled: boolean;
  dynamicMaxParticles: number;
  adaptiveTrailsActive: boolean;
  performanceModeActive: boolean;
  autoPerformanceModeEnabled: boolean;
  lowFPSThreshold: number;
  lowFPSDuration: number;
}

/** Owns one set of simulation systems. Global lifecycle belongs to GameEngineCore. */
export class EngineCore {
  private readonly renderSystem: RenderSystem;
  private readonly particleSystem = new ParticleSystem();
  private readonly collisionSystem: CollisionSystem;
  private readonly scoreSystem: ScoreSystem;
  private defenseSystem: DefenseSystem;
  private readonly chainDetonationManager: ChainDetonationManager;
  private readonly chainDetonationRenderer: ChainDetonationRenderer;
  private readonly inputHandler: InputHandler;
  private readonly powerUpManager: PowerUpManager;
  private readonly spatialGrid: SpatialGrid;
  private readonly gameLogic: GameLogic;
  private readonly runRandom = new RunRandomStreams();
  private readonly evidenceRecorder = new RunEvidenceRecorder();
  private cleanedUp = false;
  private knockbackCallback: () => void = () => {};
  private requestedPerformanceMode = false;
  private reducedMotion = false;

  private performanceSettings: PerformanceSettings = {
    autoScaleEnabled: true,
    shadowsEnabled: true,
    dynamicMaxParticles: 300,
    adaptiveTrailsActive: true,
    performanceModeActive: false,
    autoPerformanceModeEnabled: false,
    lowFPSThreshold: 45,
    lowFPSDuration: 3000,
  };

  private gameSettings: GameSettings = {
    volume: 0,
    soundEnabled: false,
    showUI: true,
    showFPS: false,
    showPerformanceStats: false,
    showTrails: false,
    performanceMode: false,
    cursorColor: '#06b6d4',
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const worldRandom = this.runRandom.getStream('world').next;
    const powerUpRandom = this.runRandom.getStream('power-up').next;
    const chainRandom = this.runRandom.getStream('chain').next;
    const scoreRandom = this.runRandom.getStream('score').next;
    const defenseRandom = this.runRandom.getStream('defense').next;

    this.renderSystem = new RenderSystem(canvas);
    this.scoreSystem = new ScoreSystem(
      scoreRandom,
      (event) => this.evidenceRecorder.record(event),
    );
    this.powerUpManager = new PowerUpManager(canvas.width, canvas.height, powerUpRandom);
    this.defenseSystem = new DefenseSystem(canvas, defenseRandom);
    this.chainDetonationManager = new ChainDetonationManager(
      canvas.width,
      canvas.height,
      chainRandom,
    );
    this.chainDetonationRenderer = new ChainDetonationRenderer(canvas);
    this.spatialGrid = new SpatialGrid(canvas.width, canvas.height, 150);
    this.collisionSystem = new CollisionSystem(this.spatialGrid);
    this.inputHandler = new InputHandler(canvas, () => this.knockbackCallback());

    const systems: GameSystems = this.buildSystems();
    this.gameLogic = new GameLogic(canvas, systems, this.gameSettings, worldRandom);
  }

  private buildSystems(): GameSystems {
    return {
      particleSystem: this.particleSystem,
      collisionSystem: this.collisionSystem,
      scoreSystem: this.scoreSystem,
      defenseSystem: this.defenseSystem,
      chainDetonationManager: this.chainDetonationManager,
      powerUpManager: this.powerUpManager,
      inputHandler: this.inputHandler,
    };
  }

  setKnockbackCallback(callback: () => void): void {
    this.knockbackCallback = callback;
  }

  resize(width: number, height: number): void {
    this.spatialGrid.resize(width, height);
    this.collisionSystem.updateSpatialGrid(this.spatialGrid);
    this.defenseSystem.updateCanvasSize(width, height);
    this.chainDetonationManager.updateCanvasSize(width, height);
    this.powerUpManager.updateCanvasSize(width, height);
    this.gameLogic.updateSpatialGrid(width, height);
  }

  beginRun(seed: number): void {
    this.runRandom.reset(seed);
    this.evidenceRecorder.begin(seed, {
      width: this.canvas.width,
      height: this.canvas.height,
      pixelRatio: 1,
    });
    this.resetSystems();
  }

  update(deltaTime: number): void {
    this.evidenceRecorder.advanceTick();
    this.gameLogic.update(
      deltaTime,
      this.performanceSettings.adaptiveTrailsActive,
      this.performanceSettings.performanceModeActive,
    );
  }

  applyPerformanceMode(enabled: boolean): void {
    this.requestedPerformanceMode = enabled;
    this.applyPresentationSettings();
  }

  setReducedMotion(enabled: boolean): void {
    if (this.reducedMotion === enabled) return;
    this.reducedMotion = enabled;
    this.gameLogic.setReducedMotion(enabled);
    this.particleSystem.setReducedMotion(enabled);
    this.defenseSystem.setReducedMotion(enabled);
    this.applyPresentationSettings();
  }

  private applyPresentationSettings(): void {
    const compactEffects = this.requestedPerformanceMode || this.reducedMotion;
    this.performanceSettings.performanceModeActive = compactEffects;
    this.performanceSettings.shadowsEnabled = !compactEffects;
    this.performanceSettings.dynamicMaxParticles = this.reducedMotion ? 48 : compactEffects ? 150 : 300;
    this.performanceSettings.adaptiveTrailsActive = !compactEffects;
    this.performanceSettings.autoScaleEnabled = !compactEffects;
    this.gameSettings.performanceMode = compactEffects;
    this.particleSystem.setMaxParticles(this.performanceSettings.dynamicMaxParticles);
    this.renderSystem.setShadowsEnabled(this.performanceSettings.shadowsEnabled);
    this.powerUpManager.updatePerformanceMode(compactEffects);
    this.chainDetonationRenderer.updatePerformanceMode(compactEffects);
  }

  resetSystems(): void {
    this.particleSystem.reset();
    this.powerUpManager.reset();
    this.scoreSystem.reset();
    this.defenseSystem.clear();
    this.chainDetonationManager.reset();
    this.defenseSystem = new DefenseSystem(
      this.canvas,
      this.runRandom.getStream('defense').next,
    );
    this.defenseSystem.setReducedMotion(this.reducedMotion);
    this.inputHandler.reset();
    this.gameLogic.updateSystems(this.buildSystems());
    this.gameLogic.resetGame();
    this.resize(this.canvas.width, this.canvas.height);
    this.particleSystem.setMaxParticles(this.performanceSettings.dynamicMaxParticles);
    this.renderSystem.setShadowsEnabled(this.performanceSettings.shadowsEnabled);
  }

  cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    this.defenseSystem.clear();
    this.chainDetonationManager.reset();
    this.particleSystem.clear();
    this.scoreSystem.clear();
    this.inputHandler.cleanup();
    this.renderSystem.destroy();
  }

  getRenderSystem(): RenderSystem { return this.renderSystem; }
  getParticleSystem(): ParticleSystem { return this.particleSystem; }
  getCollisionSystem(): CollisionSystem { return this.collisionSystem; }
  getScoreSystem(): ScoreSystem { return this.scoreSystem; }
  getDefenseSystem(): DefenseSystem { return this.defenseSystem; }
  getChainDetonationManager(): ChainDetonationManager { return this.chainDetonationManager; }
  getChainDetonationRenderer(): ChainDetonationRenderer { return this.chainDetonationRenderer; }
  getInputHandler(): InputHandler { return this.inputHandler; }
  getPowerUpManager(): PowerUpManager { return this.powerUpManager; }
  getGameLogic(): GameLogic { return this.gameLogic; }
  getSettings(): GameSettings { return { ...this.gameSettings }; }
  getPerformanceSettings(): PerformanceSettings { return { ...this.performanceSettings }; }
  getAutoScalingEnabled(): boolean { return this.performanceSettings.autoScaleEnabled; }
  getAutoPerformanceModeEnabled(): boolean { return this.performanceSettings.autoPerformanceModeEnabled; }
  isReducedMotion(): boolean { return this.reducedMotion; }

  finishRunEvidence(): RunEvidence {
    return this.evidenceRecorder.finish(
      this.scoreSystem.getScoreBreakdown(),
      this.runRandom.getDrawCounts(),
    );
  }

  getRunEvidence(): RunEvidence | null { return this.evidenceRecorder.getEvidence(); }
  getRunSummary(): RunEvidenceSummary { return this.evidenceRecorder.getSummary(); }
}
