import { Particle, Vector2 } from "../types/Game";

const STANDARD_PARTICLE_LIMIT = 480;
const REDUCED_MOTION_PARTICLE_LIMIT = 96;

export class ParticleSystem {
  private particles: Particle[] = [];
  private nextParticleId = 0;
  private reducedMotion = false;

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.trimToLimit();
  }

  private get limit(): number {
    return this.reducedMotion
      ? REDUCED_MOTION_PARTICLE_LIMIT
      : STANDARD_PARTICLE_LIMIT;
  }

  private trimToLimit(): void {
    const overflow = this.particles.length - this.limit;
    if (overflow > 0) this.particles.splice(0, overflow);
  }

  addParticle(
    pos: Vector2,
    velocity: Vector2,
    color: string,
    life: number = 30,
  ): void {
    this.particles.push({
      id: this.nextParticleId++,
      pos: { ...pos },
      velocity: { ...velocity },
      life,
      maxLife: life,
      color,
      size: Math.random() * 4 + 2,
    });
    this.trimToLimit();
  }

  createExplosion(pos: Vector2, color: string): void {
    const count = this.reducedMotion ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = Math.random() * 150 + 75;
      this.addParticle(
        pos,
        {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        color,
        this.reducedMotion ? 30 : 80,
      );
    }
  }

  createLightningBolt(start: Vector2, end: Vector2): void {
    // Create multiple particles along the lightning path
    const segments = this.reducedMotion ? 3 : 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Add some randomness to make it look like lightning
      const randomOffset = (Math.random() - 0.5) * 20;
      const pos = {
        x: start.x + (end.x - start.x) * t + randomOffset,
        y: start.y + (end.y - start.y) * t + randomOffset,
      };
      
      this.addParticle(
        pos,
        { x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50 },
        "#ffff00",
        30,
      );
    }
    
    // Add bright flash at both ends
    this.addParticle(start, { x: 0, y: 0 }, "#ffffff", 20);
    this.addParticle(end, { x: 0, y: 0 }, "#ffffff", 20);
  }

  createElectricSparks(pos: Vector2): void {
    if (this.reducedMotion) return;
    // Create electric sparks around the electrified ball
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 40 + 20;
      const sparkPos = {
        x: pos.x + Math.cos(angle) * distance,
        y: pos.y + Math.sin(angle) * distance,
      };
      
      this.addParticle(
        sparkPos,
        { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 },
        "#ffff88",
        25,
      );
    }
  }

  update(deltaTime: number): void {
    const dt = deltaTime / 1000;
    
    this.particles.forEach((particle) => {
      particle.pos.x += particle.velocity.x * dt;
      particle.pos.y += particle.velocity.y * dt;
      particle.velocity.x *= 0.98;
      particle.velocity.y *= 0.98;
      particle.life--;
    });

    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife;
      ctx.fillStyle =
        particle.color +
        Math.floor(alpha * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.beginPath();
      ctx.arc(particle.pos.x, particle.pos.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  clear(): void {
    this.particles = [];
  }

  getParticles(): Particle[] {
    return this.particles;
  }
}
