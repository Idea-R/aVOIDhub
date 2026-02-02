import { Vector2, ChainSegment, Enemy, SecondChain } from '../types/Game';
import { ActiveEffects, PlayerUpgrades } from '../types/PowerUps';
import { PowerUpManager } from '../components/Game/PowerUpManager';
import { ParticleSystem } from './ParticleSystem';
import { ChainRenderer } from './renderers/ChainRenderer';
import { PlayerRenderer } from './renderers/PlayerRenderer';
import { EnemyRenderer } from './renderers/EnemyRenderer';
import { EffectsRenderer } from './renderers/EffectsRenderer';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  
  // Specialized renderers
  private chainRenderer: ChainRenderer;
  private playerRenderer: PlayerRenderer;
  private enemyRenderer: EnemyRenderer;
  private effectsRenderer: EffectsRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Initialize specialized renderers
    this.chainRenderer = new ChainRenderer(this.ctx);
    this.playerRenderer = new PlayerRenderer(this.ctx);
    this.enemyRenderer = new EnemyRenderer(this.ctx);
    this.effectsRenderer = new EffectsRenderer(canvas);
  }

  clear(): void {
    this.effectsRenderer.clear();
  }

  drawGrid(): void {
    this.effectsRenderer.drawGrid();
  }

  drawParticles(particleSystem: ParticleSystem): void {
    this.effectsRenderer.drawParticles(particleSystem);
  }

  drawPowerUps(powerUpManager: PowerUpManager): void {
    this.effectsRenderer.drawPowerUps(powerUpManager);
  }

  drawChain(chain: ChainSegment[], ball: Vector2, isRetracting: boolean, activeEffects: ActiveEffects, playerUpgrades?: { chainDamage: number }): void {
    this.chainRenderer.drawChain(chain, ball, isRetracting, activeEffects, playerUpgrades);
  }

  drawSecondChain(secondChain: SecondChain, isRetracting: boolean, activeEffects: ActiveEffects, playerUpgrades?: PlayerUpgrades): void {
    this.chainRenderer.drawSecondChain(secondChain, isRetracting, activeEffects, playerUpgrades);
  }

  drawSecondBall(ball: Vector2, activeEffects: ActiveEffects): void {
    this.playerRenderer.drawSecondBall(ball, activeEffects);
  }

  drawPlayer(player: Vector2, playerSize: number, activeEffects: ActiveEffects): void {
    this.playerRenderer.drawPlayer(player, playerSize, activeEffects);
  }

  drawBall(ball: Vector2, ballRadius: number, activeEffects: ActiveEffects): void {
    this.playerRenderer.drawBall(ball, ballRadius, activeEffects);
  }

  drawEnemies(enemies: Enemy[]): void {
    this.enemyRenderer.drawEnemies(enemies);
  }

  drawProjectiles(projectiles: any[]): void {
    this.effectsRenderer.drawProjectiles(projectiles);
  }

  drawMouseCursor(mouse: Vector2): void {
    this.playerRenderer.drawMouseCursor(mouse);
  }

  // Additional effect methods for enhanced gameplay
  drawExplosion(pos: Vector2, size: number, progress: number): void {
    this.effectsRenderer.drawExplosion(pos, size, progress);
  }

  drawShockwave(pos: Vector2, radius: number, alpha: number): void {
    this.effectsRenderer.drawShockwave(pos, radius, alpha);
  }

  drawLightning(startPos: Vector2, endPos: Vector2): void {
    this.effectsRenderer.drawLightning(startPos, endPos);
  }

  // Utility methods for renderer management
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  // Performance optimization: batch rendering operations
  batchRender(renderOperations: (() => void)[]): void {
    renderOperations.forEach(operation => operation());
  }
} 