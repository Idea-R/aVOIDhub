import { Vector2 } from '../utils/Vector2.js';
import { ObjectPool } from '../utils/ObjectPool.js';

interface ParticleConfig {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
  life: number;
  gravity?: number;
  friction?: number;
  fade?: boolean;
}

class Particle {
  public position: Vector2 = new Vector2();
  public velocity: Vector2 = new Vector2();
  public color: string = '#ffffff';
  public size: number = 1;
  public life: number = 1;
  public maxLife: number = 1;
  public gravity: number = 0;
  public friction: number = 1;
  public fade: boolean = true;
  public alive: boolean = true;

  reset(config: ParticleConfig): void {
    this.position.set(config.x, config.y);
    this.velocity.set(config.velocityX, config.velocityY);
    this.color = config.color;
    this.size = config.size;
    this.life = config.life;
    this.maxLife = config.life;
    this.gravity = config.gravity || 0;
    this.friction = config.friction || 1;
    this.fade = config.fade !== false;
    this.alive = true;
  }

  update(deltaTime: number): void {
    if (!this.alive) return;

    // Apply gravity
    this.velocity.y += this.gravity * deltaTime;

    // Apply friction
    this.velocity = this.velocity.multiply(this.friction);

    // Update position
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Update life
    this.life -= deltaTime;
    if (this.life <= 0) {
      this.alive = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    ctx.save();

    if (this.fade) {
      ctx.globalAlpha = this.life / this.maxLife;
    }

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class ParticleSystem {
  private particlePool: ObjectPool<Particle>;
  private activeParticles: Particle[] = [];

  constructor() {
    this.particlePool = new ObjectPool(
      () => new Particle(),
      (particle) => {
        particle.alive = false;
        particle.life = 0;
      },
      200
    );
  }

  createExplosion(x: number, y: number, intensity: number = 1): void {
    const particleCount = Math.floor(20 * intensity);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.particlePool.get();
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = (50 + Math.random() * 100) * intensity;
      const size = 2 + Math.random() * 4 * intensity;
      
      particle.reset({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: `hsl(${Math.random() * 60 + 15}, 100%, ${60 + Math.random() * 30}%)`,
        size: size,
        life: 0.5 + Math.random() * 1.0,
        gravity: 50,
        friction: 0.98
      });
      
      this.activeParticles.push(particle);
    }

    // Add smoke particles
    for (let i = 0; i < 10; i++) {
      const particle = this.particlePool.get();
      particle.reset({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        velocityX: (Math.random() - 0.5) * 30,
        velocityY: -Math.random() * 50,
        color: `rgba(${100 + Math.random() * 50}, ${100 + Math.random() * 50}, ${100 + Math.random() * 50}, 0.8)`,
        size: 3 + Math.random() * 8,
        life: 2.0 + Math.random() * 2.0,
        gravity: -10,
        friction: 0.99
      });
      
      this.activeParticles.push(particle);
    }
  }

  createMuzzleFlash(x: number, y: number, angle: number): void {
    const particleCount = 8;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.particlePool.get();
      const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
      const speed = 100 + Math.random() * 100;
      
      particle.reset({
        x: x,
        y: y,
        velocityX: Math.cos(spreadAngle) * speed,
        velocityY: Math.sin(spreadAngle) * speed,
        color: `hsl(${45 + Math.random() * 15}, 100%, ${80 + Math.random() * 20}%)`,
        size: 1 + Math.random() * 3,
        life: 0.1 + Math.random() * 0.2,
        friction: 0.95
      });
      
      this.activeParticles.push(particle);
    }
  }

  createDustCloud(x: number, y: number, size: number = 1): void {
    const particleCount = Math.floor(15 * size);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.particlePool.get();
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      
      particle.reset({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 20,
        color: `rgba(${139 + Math.random() * 50}, ${115 + Math.random() * 30}, ${85 + Math.random() * 30}, 0.6)`,
        size: 1 + Math.random() * 4,
        life: 1.0 + Math.random() * 2.0,
        gravity: 20,
        friction: 0.98
      });
      
      this.activeParticles.push(particle);
    }
  }

  createShellCasing(x: number, y: number, angle: number): void {
    const particle = this.particlePool.get();
    const ejectAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    
    particle.reset({
      x: x,
      y: y,
      velocityX: Math.cos(ejectAngle) * 80,
      velocityY: Math.sin(ejectAngle) * 80,
      color: '#DAA520',
      size: 2,
      life: 3.0,
      gravity: 200,
      friction: 0.99
    });
    
    this.activeParticles.push(particle);
  }
  
  createBloodSplat(x: number, y: number): void {
    const particleCount = 8;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.particlePool.get();
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      
      particle.reset({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: `hsl(${Math.random() * 20}, 80%, ${20 + Math.random() * 20}%)`, // Dark red variations
        size: 1 + Math.random() * 3,
        life: 2.0 + Math.random() * 3.0,
        gravity: 100,
        friction: 0.95
      });
      
      this.activeParticles.push(particle);
    }
  }
  
  createLevelUpEffect(x: number, y: number): void {
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.particlePool.get();
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 100 + Math.random() * 100;
      
      particle.reset({
        x: x,
        y: y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: `hsl(${Math.random() * 60 + 45}, 100%, ${70 + Math.random() * 30}%)`, // Gold/yellow
        size: 3 + Math.random() * 5,
        life: 1.5 + Math.random() * 2.0,
        gravity: -50, // Float upward
        friction: 0.98
      });
      
      this.activeParticles.push(particle);
    }
    
    // Add sparkle effects
    for (let i = 0; i < 20; i++) {
      const particle = this.particlePool.get();
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 100;
      
      particle.reset({
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        velocityX: (Math.random() - 0.5) * 20,
        velocityY: -Math.random() * 30,
        color: '#FFD700',
        size: 2,
        life: 3.0,
        gravity: 0,
        friction: 1.0
      });
      
      this.activeParticles.push(particle);
    }
  }

  update(deltaTime: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const particle = this.activeParticles[i];
      particle.update(deltaTime);
      
      if (!particle.alive) {
        this.activeParticles.splice(i, 1);
        this.particlePool.release(particle);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.activeParticles) {
      particle.render(ctx);
    }
  }

  getActiveCount(): number {
    return this.activeParticles.length;
  }

  clear(): void {
    for (const particle of this.activeParticles) {
      this.particlePool.release(particle);
    }
    this.activeParticles = [];
  }
}