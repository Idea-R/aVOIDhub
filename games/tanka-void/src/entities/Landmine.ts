import { Vector2 } from '../utils/Vector2.js';

export class Landmine {
  public position: Vector2;
  public armed: boolean = false;
  public armingTime: number = 1.0; // 1 second to arm
  public currentArmingTime: number = 0;
  public explosionRadius: number = 80;
  public damage: number = 150;
  public size: number = 12;
  public triggered: boolean = false;
  public blinkTimer: number = 0;
  public isPlayerMine: boolean = true;

  constructor(x: number, y: number, isPlayerMine: boolean = true) {
    this.position = new Vector2(x, y);
    this.isPlayerMine = isPlayerMine;
  }

  update(deltaTime: number): void {
    if (!this.armed) {
      this.currentArmingTime += deltaTime;
      if (this.currentArmingTime >= this.armingTime) {
        this.armed = true;
      }
    }

    if (this.armed) {
      this.blinkTimer += deltaTime;
    }
  }

  checkTrigger(entities: any[]): boolean {
    if (!this.armed || this.triggered) return false;

    for (const entity of entities) {
      // Don't trigger on the entity that placed it
      if (this.isPlayerMine && entity.isPlayer) continue;
      if (!this.isPlayerMine && !entity.isPlayer) continue;

      const distance = this.position.distance(entity.position);
      if (distance < 30) { // Trigger radius
        this.triggered = true;
        return true;
      }
    }

    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Don't render if not armed and not visible
    if (!this.armed && this.currentArmingTime < 0.5) {
      ctx.restore();
      return;
    }

    ctx.translate(this.position.x, this.position.y);

    // Blink when armed
    if (this.armed && Math.sin(this.blinkTimer * 8) > 0) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
    }

    // Mine body
    ctx.fillStyle = this.armed ? '#333333' : '#666666';
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Spikes
    ctx.fillStyle = '#222222';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * this.size * 0.8;
      const y = Math.sin(angle) * this.size * 0.8;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    // Armed indicator
    if (this.armed) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getBounds(): { x: number, y: number, radius: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      radius: this.size
    };
  }

  reset(x: number, y: number, isPlayerMine: boolean = true): void {
    this.position.set(x, y);
    this.armed = false;
    this.currentArmingTime = 0;
    this.triggered = false;
    this.blinkTimer = 0;
    this.isPlayerMine = isPlayerMine;
  }
}