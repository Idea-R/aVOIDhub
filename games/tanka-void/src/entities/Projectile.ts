import { Vector2 } from '../utils/Vector2.js';

export type ProjectileType = 'machinegun' | 'cannon' | 'rocket';

export class Projectile {
  public position: Vector2;
  public velocity: Vector2;
  public alive: boolean = true;
  public lifetime: number;
  public maxLifetime: number;
  public damage: number;
  public explosionRadius: number;
  public size: number;
  public color: string;
  public trail: Vector2[] = [];
  public isHoming: boolean;
  public target: Vector2 | null = null;
  public homingStrength: number = 2.0;
  public maxTurnRate: number = 3.0; // radians per second
  public isEnemyProjectile: boolean = false;

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    type: ProjectileType,
    target: Vector2 | null = null,
    isEnemyProjectile: boolean = false
  ) {
    this.position = new Vector2(x, y);
    this.velocity = Vector2.fromAngle(angle, speed);
    this.damage = damage;
    this.target = target;
    this.isEnemyProjectile = isEnemyProjectile;

    switch (type) {
      case 'machinegun':
        this.maxLifetime = 2.0;
        this.explosionRadius = 0;
        this.size = 3;
        this.color = '#ffff00';
        this.isHoming = false;
        break;
      case 'cannon':
        this.maxLifetime = 4.0;
        this.explosionRadius = 40;
        this.size = 6;
        this.color = '#ff6600';
        this.isHoming = false;
        break;
      case 'rocket':
        this.maxLifetime = 6.0;
        this.explosionRadius = 60;
        this.size = 8;
        this.color = '#ff0000';
        this.isHoming = true;
        this.homingStrength = 4.0;
        this.maxTurnRate = 5.0;
        break;
    }

    this.lifetime = this.maxLifetime;
  }

  update(deltaTime: number): void {
    // Advanced homing behavior for rockets
    if (this.isHoming && this.target) {
      const toTarget = this.target.subtract(this.position);
      const distanceToTarget = toTarget.magnitude();
      
      if (distanceToTarget > 10) { // Only track if not too close
        const targetDirection = toTarget.normalize();
        const currentDirection = this.velocity.normalize();
        
        // Calculate the angle difference
        const targetAngle = Math.atan2(targetDirection.y, targetDirection.x);
        const currentAngle = Math.atan2(currentDirection.y, currentDirection.x);
        
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Limit turn rate
        const maxTurn = this.maxTurnRate * deltaTime;
        const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
        
        const newAngle = currentAngle + actualTurn;
        const speed = this.velocity.magnitude();
        
        // Apply homing strength based on distance (closer = stronger tracking)
        const homingFactor = Math.min(1, this.homingStrength / Math.max(1, distanceToTarget / 100));
        this.velocity = Vector2.fromAngle(newAngle, speed * (1 + homingFactor * 0.1));
      }
    }

    // Update position
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Update trail
    this.trail.push(this.position.clone());
    if (this.trail.length > (this.isHoming ? 15 : 8)) {
      this.trail.shift();
    }

    // Update lifetime
    this.lifetime -= deltaTime;
    if (this.lifetime <= 0) {
      this.alive = false;
    }
  }

  getBounds(): { x: number, y: number, radius: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      radius: this.size
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Render trail
    if (this.trail.length > 1) {
      ctx.globalAlpha = this.isHoming ? 0.8 : 0.6;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * (this.isHoming ? 0.8 : 0.5);
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.globalAlpha = (i / this.trail.length) * (this.isHoming ? 0.8 : 0.6);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    // Render projectile
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Add glow effect (stronger for homing missiles)
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.size * (this.isHoming ? 3 : 2);
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Render homing indicator
    if (this.isHoming && this.target) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.position.x, this.position.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  reset(x: number, y: number, angle: number, speed: number, damage: number, type: ProjectileType, target: Vector2 | null = null, isEnemyProjectile: boolean = false): void {
    this.position.set(x, y);
    this.velocity = Vector2.fromAngle(angle, speed);
    this.damage = damage;
    this.alive = true;
    this.trail = [];
    this.target = target;
    this.isEnemyProjectile = isEnemyProjectile;
    
    // Reset projectile properties based on type
    switch (type) {
      case 'machinegun':
        this.maxLifetime = 2.0;
        this.explosionRadius = 0;
        this.size = 3;
        this.color = '#ffff00';
        this.isHoming = false;
        break;
      case 'cannon':
        this.maxLifetime = 4.0;
        this.explosionRadius = 40;
        this.size = 6;
        this.color = '#ff6600';
        this.isHoming = false;
        break;
      case 'rocket':
        this.maxLifetime = 6.0;
        this.explosionRadius = 60;
        this.size = 8;
        this.color = '#ff0000';
        this.isHoming = true;
        this.homingStrength = 4.0;
        this.maxTurnRate = 5.0;
        break;
    }
    
    this.lifetime = this.maxLifetime;
  }
}