import { Meteor, createMeteor, resetMeteor, initializeMeteor } from '../entities/Meteor';
import { ObjectPool } from '../utils/ObjectPool';
import { SpatialGrid } from '../utils/SpatialGrid';
import { InputHandler } from '../InputHandler';

export interface MeteorSpawnSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSuper: boolean;
}

export function createMeteorSpawnSpec(
  width: number,
  height: number,
  target: { x: number; y: number },
  gameTime: number,
  random: () => number,
): MeteorSpawnSpec {
  const side = Math.floor(random() * 4);
  let x: number;
  let y: number;

  switch (side) {
    case 0: x = random() * width; y = -20; break;
    case 1: x = width + 20; y = random() * height; break;
    case 2: x = random() * width; y = height + 20; break;
    default: x = -20; y = random() * height; break;
  }

  const angle = Math.atan2(target.y - y, target.x - x);
  const isSuper = random() < 0.15;
  const speedIncrease = Math.min(gameTime / 90, 2);
  let speed = (0.8 + speedIncrease) * (0.8 + random() * 0.4);
  if (isSuper) speed *= 2;

  const baseRadius = isSuper ? 12 : 6;
  const radiusVariation = isSuper ? 4 : 6;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: baseRadius + random() * radiusVariation,
    isSuper,
  };
}

export class MeteorManager {
  private canvas: HTMLCanvasElement;
  private inputHandler: InputHandler;
  private meteorPool: ObjectPool<Meteor>;
  private activeMeteors: Meteor[] = [];
  private spatialGrid: SpatialGrid;
  private readonly MAX_METEORS = 50;
  private spawnSequence = 0;

  constructor(
    canvas: HTMLCanvasElement,
    inputHandler: InputHandler,
    spatialGrid: SpatialGrid,
    private readonly gameplayRandom: () => number,
    private readonly visualRandom: () => number = Math.random,
  ) {
    this.canvas = canvas;
    this.inputHandler = inputHandler;
    this.spatialGrid = spatialGrid;
    this.meteorPool = new ObjectPool(createMeteor, resetMeteor, 20, this.MAX_METEORS);
  }

  update(_gameTime: number, adaptiveTrailsActive: boolean, performanceModeActive: boolean, showTrails: boolean): void {
    this.updateMeteors(adaptiveTrailsActive, performanceModeActive, showTrails);
  }

  spawnMeteor(gameTime: number): void {
    if (this.activeMeteors.length >= this.MAX_METEORS) return;

    const mousePos = this.inputHandler.getMousePosition();
    const spawn = createMeteorSpawnSpec(
      this.canvas.width,
      this.canvas.height,
      mousePos,
      gameTime,
      this.gameplayRandom,
    );
    const color = spawn.isSuper ? '#ff4040' : this.getRandomColor();
    
    const meteor = this.meteorPool.get();
    initializeMeteor(
      meteor,
      `meteor-${this.spawnSequence}`,
      spawn.x,
      spawn.y,
      spawn.vx,
      spawn.vy,
      spawn.radius,
      color,
      spawn.isSuper,
    );

    this.spawnSequence += 1;
    this.activeMeteors.push(meteor);
  }

  private updateMeteors(adaptiveTrailsActive: boolean, performanceModeActive: boolean, showTrails: boolean): void {
    for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
      const meteor = this.activeMeteors[i];
      if (!meteor.active) continue;

      meteor.x += meteor.vx;
      meteor.y += meteor.vy;

      // Update trail with length limit (only if trails are enabled)
      if (showTrails && adaptiveTrailsActive && !performanceModeActive) {
        meteor.trail.unshift({ x: meteor.x, y: meteor.y, alpha: 1 });
        const maxTrailLength = performanceModeActive ? 3 : 6;
        if (meteor.trail.length > maxTrailLength) meteor.trail.pop();
        meteor.trail.forEach(point => point.alpha *= 0.85);
      } else {
        meteor.trail.length = 0;
      }

      // Add to spatial grid
      this.spatialGrid.insert({
        x: meteor.x,
        y: meteor.y,
        radius: meteor.radius,
        id: meteor.id
      });

      // Remove meteors that are off-screen
      if (meteor.x < -50 || meteor.x > this.canvas.width + 50 ||
          meteor.y < -50 || meteor.y > this.canvas.height + 50) {
        this.releaseMeteor(meteor);
      }
    }
  }

  releaseMeteor(meteor: Meteor): void {
    const index = this.activeMeteors.indexOf(meteor);
    if (index > -1) {
      this.activeMeteors.splice(index, 1);
      this.meteorPool.release(meteor);
    }
  }

  clearAllMeteors(): number {
    const meteorCount = this.activeMeteors.length;
    
    this.activeMeteors.forEach(meteor => {
      this.meteorPool.release(meteor);
    });
    
    this.activeMeteors.length = 0;
    
    console.log(`🔗 Cleared ${meteorCount} meteors from screen`);
    return meteorCount;
  }

  processDestroyedMeteors(destroyedMeteors: Meteor[]): void {
    for (const meteor of destroyedMeteors) {
      this.releaseMeteor(meteor);
    }
  }

  private getRandomColor(): string {
    const hue = this.visualRandom() * 360;
    return `hsla(${hue}, 100%, 60%, 1)`;
  }

  reset(): void {
    this.activeMeteors.forEach(meteor => this.meteorPool.release(meteor));
    this.activeMeteors.length = 0;
    this.spawnSequence = 0;
  }

  updateSpatialGrid(spatialGrid: SpatialGrid): void {
    this.spatialGrid = spatialGrid;
  }

  // Getters
  getActiveMeteors(): Meteor[] {
    return this.activeMeteors;
  }

  getMeteorCount(): number {
    return this.activeMeteors.length;
  }

  getPoolSize(): number {
    return this.meteorPool.getPoolSize();
  }

  shouldSpawnMeteor(gameTime: number): boolean {
    const baseSpawnChance = 0.003;
    const maxSpawnChance = 0.02;
    const spawnIncrease = Math.min(gameTime / 150, maxSpawnChance - baseSpawnChance);
    return this.gameplayRandom() < baseSpawnChance + spawnIncrease;
  }
}
