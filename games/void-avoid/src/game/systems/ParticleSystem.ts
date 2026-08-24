import { ParticleSystemCore } from './particles/ParticleSystemCore';
import { StandardParticleEffects } from './particles/StandardParticleEffects';
import { ChainDetonationEffects } from './particles/ChainDetonationEffects';
import { Particle } from '../entities/Particle';

export class ParticleSystem {
  private core: ParticleSystemCore;
  private standardEffects: StandardParticleEffects;
  private chainDetonationEffects: ChainDetonationEffects;
  private reducedMotion = false;

  constructor() {
    this.core = new ParticleSystemCore();
    this.standardEffects = new StandardParticleEffects(this.core);
    this.chainDetonationEffects = new ChainDetonationEffects(this.core);
  }

  // Core management methods - delegate to core
  setMaxParticles(maxParticles: number): void {
    this.core.setMaxParticles(maxParticles);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) this.core.clear();
  }

  update(deltaTime: number): void {
    this.core.update(deltaTime);
    this.chainDetonationEffects.update(); // Update frame-based delays
  }

  getActiveParticles(): Particle[] {
    return this.core.getActiveParticles();
  }

  getParticleCount(): number {
    return this.core.getParticleCount();
  }

  getPoolSize(): number {
    return this.core.getPoolSize();
  }

  getMaxParticles(): number {
    return this.core.getMaxParticles();
  }

  clear(): void {
    this.core.clear();
    this.chainDetonationEffects.clear();
  }

  reset(): void {
    this.core.reset();
    this.chainDetonationEffects.clear();
  }

  // Standard particle effects - delegate to standardEffects
  createExplosion(x: number, y: number, color: string, isSuper: boolean = false): void {
    if (this.reducedMotion) return;
    this.standardEffects.createExplosion(x, y, color, isSuper);
  }

  createShockwave(x: number, y: number, cursorColor?: string): void {
    if (this.reducedMotion) return;
    this.standardEffects.createShockwave(x, y, cursorColor);
  }

  createDefenseEffect(x: number, y: number, type: 'destroy' | 'deflect'): void {
    if (this.reducedMotion) return;
    this.standardEffects.createDefenseEffect(x, y, type);
  }

  createEnergyAbsorption(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.standardEffects.createEnergyAbsorption(x, y);
  }

  // Chain detonation effects - delegate to chainDetonationEffects
  createChainDetonationExplosion(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.chainDetonationEffects.createChainDetonationExplosion(x, y);
  }

  createEnhancedChainDetonation(meteors: Array<{ x: number; y: number; color: string; isSuper: boolean }>, centerX: number, centerY: number): void {
    if (this.reducedMotion) return;
    this.chainDetonationEffects.createEnhancedChainDetonation(meteors, centerX, centerY);
  }
}
