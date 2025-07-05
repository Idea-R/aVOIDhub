import { Vector2 } from '../utils/Vector2.js';

export type PowerUpType = 'ammo' | 'health' | 'speed' | 'damage' | 'multishot' | 'rapidfire' | 'shield' | 'landmine';

export class PowerUp {
  public position: Vector2;
  public type: PowerUpType;
  public value: number;
  public lifetime: number = 30; // 30 seconds before disappearing
  public size: number = 15;
  public collected: boolean = false;
  public bobOffset: number = 0;
  public rotationSpeed: number = 2;
  public rotation: number = 0;
  public glowIntensity: number = 0;

  constructor(x: number, y: number, type: PowerUpType, value: number = 1) {
    this.position = new Vector2(x, y);
    this.type = type;
    this.value = value;
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  update(deltaTime: number): void {
    this.lifetime -= deltaTime;
    this.rotation += this.rotationSpeed * deltaTime;
    this.glowIntensity = Math.sin(performance.now() * 0.005) * 0.5 + 0.5;
    
    if (this.lifetime <= 0) {
      this.collected = true; // Mark for removal
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    const bobAmount = Math.sin(performance.now() * 0.003 + this.bobOffset) * 3;
    const renderY = this.position.y + bobAmount;
    
    ctx.translate(this.position.x, renderY);
    ctx.rotate(this.rotation);
    
    // Glow effect
    ctx.shadowColor = this.getColor();
    ctx.shadowBlur = 15 + this.glowIntensity * 10;
    
    // Draw power-up based on type
    switch (this.type) {
      case 'ammo':
        this.drawAmmoBox(ctx);
        break;
      case 'health':
        this.drawHealthPack(ctx);
        break;
      case 'speed':
        this.drawSpeedBoost(ctx);
        break;
      case 'damage':
        this.drawDamageBoost(ctx);
        break;
      case 'multishot':
        this.drawMultiShot(ctx);
        break;
      case 'rapidfire':
        this.drawRapidFire(ctx);
        break;
      case 'shield':
        this.drawShield(ctx);
        break;
      case 'landmine':
        this.drawLandmine(ctx);
        break;
    }
    
    ctx.restore();
  }

  private drawAmmoBox(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('A', 0, 4);
  }

  private drawHealthPack(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillRect(-8, -2, 16, 4);
  }

  private drawSpeedBoost(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(-this.size/2, this.size/2);
    ctx.lineTo(this.size/2, 0);
    ctx.lineTo(-this.size/2, -this.size/2);
    ctx.closePath();
    ctx.fill();
  }

  private drawDamageBoost(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(0, -this.size/2);
    ctx.lineTo(this.size/3, 0);
    ctx.lineTo(0, this.size/2);
    ctx.lineTo(-this.size/3, 0);
    ctx.closePath();
    ctx.fill();
  }

  private drawMultiShot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#9900ff';
    for (let i = 0; i < 3; i++) {
      const angle = (i - 1) * 0.5;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillRect(-1, -this.size/2, 2, this.size);
      ctx.restore();
    }
  }

  private drawRapidFire(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.arc(0, 0, this.size/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('R', 0, 3);
  }

  private drawShield(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(0, -this.size/2);
    ctx.lineTo(this.size/2, 0);
    ctx.lineTo(0, this.size/2);
    ctx.lineTo(-this.size/2, 0);
    ctx.closePath();
    ctx.fill();
  }

  private drawLandmine(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(0, 0, this.size/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(0, 0, this.size/4, 0, Math.PI * 2);
    ctx.fill();
  }

  private getColor(): string {
    switch (this.type) {
      case 'ammo': return '#ffff00';
      case 'health': return '#ff0000';
      case 'speed': return '#00ff00';
      case 'damage': return '#ff6600';
      case 'multishot': return '#9900ff';
      case 'rapidfire': return '#ff9900';
      case 'shield': return '#00ffff';
      case 'landmine': return '#666666';
      default: return '#ffffff';
    }
  }

  getBounds(): { x: number, y: number, radius: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      radius: this.size
    };
  }

  reset(x: number, y: number, type: PowerUpType, value: number = 1): void {
    this.position.set(x, y);
    this.type = type;
    this.value = value;
    this.lifetime = 30;
    this.collected = false;
    this.rotation = 0;
    this.bobOffset = Math.random() * Math.PI * 2;
  }
}