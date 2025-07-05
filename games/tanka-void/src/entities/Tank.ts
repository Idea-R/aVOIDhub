import { Vector2 } from '../utils/Vector2.js';
import { Rectangle } from '../utils/Rectangle.js';

export class Tank {
  public position: Vector2;
  public velocity: Vector2 = new Vector2();
  public acceleration: Vector2 = new Vector2();
  public rotation: number = 0;
  public turretRotation: number = 0;
  public health: number;
  public maxHealth: number;
  public armor: number;
  public size: number = 25;
  
  // Movement properties
  public maxSpeed: number = 150;
  public turnSpeed: number = 2.5;
  public turretTurnSpeed: number = 8.0;
  public friction: number = 0.85;
  public enginePower: number = 400;

  // Visual effects
  public damageFlashTimer: number = 0;
  public lastFireTime: number = 0;

  constructor(x: number, y: number, health: number = 100) {
    this.position = new Vector2(x, y);
    this.health = health;
    this.maxHealth = health;
    this.armor = 0;
  }

  update(deltaTime: number): void {
    // Apply friction
    this.velocity = this.velocity.multiply(this.friction);

    // Apply acceleration
    this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));

    // Limit max speed
    if (this.velocity.magnitude() > this.maxSpeed) {
      this.velocity = this.velocity.normalize().multiply(this.maxSpeed);
    }

    // Update position
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Reset acceleration
    this.acceleration = new Vector2();

    // Update damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= deltaTime;
    }
  }

  takeDamage(damage: number): void {
    const actualDamage = Math.max(1, damage - this.armor);
    this.health -= actualDamage;
    this.damageFlashTimer = 0.2;
    
    // Screen shake on player damage
    if ((this as any).isPlayer) {
      const event = new CustomEvent('playerDamaged', {
        detail: { damage: actualDamage }
      });
      window.dispatchEvent(event);
    }
    
    if (this.health < 0) {
      this.health = 0;
    }
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x - this.size,
      this.position.y - this.size,
      this.size * 2,
      this.size * 2
    );
  }

  getCollisionCircle(): { center: Vector2, radius: number } {
    return {
      center: this.position.clone(),
      radius: this.size
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Damage flash effect
    if (this.damageFlashTimer > 0) {
      ctx.globalAlpha = 0.7;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
    }

    // Draw tank body
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotation);

    // Tank body
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(-this.size, -this.size * 0.6, this.size * 2, this.size * 1.2);

    // Tank tracks
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-this.size * 1.1, -this.size * 0.8, this.size * 2.2, this.size * 0.3);
    ctx.fillRect(-this.size * 1.1, this.size * 0.5, this.size * 2.2, this.size * 0.3);

    // Tank details
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(-this.size * 0.8, -this.size * 0.4, this.size * 1.6, this.size * 0.8);

    ctx.restore();

    // Draw turret
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.turretRotation);

    // Turret base
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Cannon barrel
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(this.size * 0.5, -this.size * 0.1, this.size * 1.2, this.size * 0.2);

    // Barrel tip
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(this.size * 1.6, -this.size * 0.05, this.size * 0.1, this.size * 0.1);

    ctx.restore();
  }

  renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = this.size * 1.5;
    const barHeight = 4;
    const x = this.position.x - barWidth / 2;
    const y = this.position.y - this.size - 10;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Health
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = healthPercent > 0.6 ? '#0f0' : healthPercent > 0.3 ? '#ff0' : '#f00';
    ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }
}