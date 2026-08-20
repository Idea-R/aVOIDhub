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
import { ObjectPool } from './utils/ObjectPool';
import { SpatialGrid } from './utils/SpatialGrid';
import { type Meteor, createMeteor, resetMeteor } from './entities/Meteor';

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
  private readonly scoreSystem = new ScoreSystem();
  private defenseSystem: DefenseSystem;
  private readonly chainDetonationManager: ChainDetonationManager;
  private readonly chainDetonationRenderer: ChainDetonationRenderer;
  private readonly inputHandler: InputHandler;
  private readonly powerUpManager = new PowerUpManager();
  private readonly meteorPool = new ObjectPool<Meteor>(createMeteor, resetMeteor, 20, 50);
  private readonly spatialGrid: SpatialGrid;
  private readonly gameLogic: GameLogic;
  private cleanedUp = false;
  private knockbackCallback: () => void = () => {};

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
    this.renderSystem = new RenderSystem(canvas);
    this.defenseSystem = new DefenseSystem(canvas);
    this.chainDetonationManager = new ChainDetonationManager(canvas.width, canvas.height);
    this.chainDetonationRenderer = new ChainDetonationRenderer(canvas);
    this.spatialGrid = new SpatialGrid(canvas.width, canvas.height, 150);
    this.collisionSystem = new CollisionSystem(this.spatialGrid);
    this.inputHandler = new InputHandler(canvas, () => this.knockbackCallback());

    const systems: GameSystems = this.buildSystems();
    this.gameLogic = new GameLogic(canvas, systems, this.gameSettings);
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
    this.gameLogic.updateSpatialGrid(width, height);
  }

  applyPerformanceMode(enabled: boolean): void {
    this.performanceSettings.performanceModeActive = enabled;
    this.performanceSettings.shadowsEnabled = !enabled;
    this.performanceSettings.dynamicMaxParticles = enabled ? 150 : 300;
    this.performanceSettings.adaptiveTrailsActive = !enabled;
    this.performanceSettings.autoScaleEnabled = !enabled;
    this.gameSettings.performanceMode = enabled;
    this.particleSystem.setMaxParticles(this.performanceSettings.dynamicMaxParticles);
    this.renderSystem.setShadowsEnabled(this.performanceSettings.shadowsEnabled);
  }

  resetSystems(): void {
    this.particleSystem.reset();
    this.powerUpManager.reset();
    this.scoreSystem.reset();
    this.defenseSystem.clear();
    this.chainDetonationManager.reset();
    this.defenseSystem = new DefenseSystem(this.canvas);
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
    this.meteorPool.clear();
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
  getMeteorPool(): ObjectPool<Meteor> { return this.meteorPool; }
  getSettings(): GameSettings { return { ...this.gameSettings }; }
  getPerformanceSettings(): PerformanceSettings { return { ...this.performanceSettings }; }
  getAutoScalingEnabled(): boolean { return this.performanceSettings.autoScaleEnabled; }
  getAutoPerformanceModeEnabled(): boolean { return this.performanceSettings.autoPerformanceModeEnabled; }
}
