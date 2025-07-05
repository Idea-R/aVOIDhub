import { EnemyTank } from './EnemyTank.js';
import { Vector2 } from '../utils/Vector2.js';

export type BossType = 'mega_heavy' | 'artillery_commander' | 'stealth_assassin';

export class BossTank extends EnemyTank {
  public bossType: BossType;
  public phase: number = 1;
  public maxPhases: number = 3;
  public specialAbilityTimer: number = 0;
  public specialAbilityCooldown: number = 5.0;
  public isUsingSpecialAbility: boolean = false;
  public originalMaxHealth: number;

  constructor(x: number, y: number, type: BossType) {
    super(x, y, 'heavy'); // Start with heavy tank base
    this.bossType = type;
    this.initializeBossType();
    this.originalMaxHealth = this.maxHealth;
  }

  private initializeBossType(): void {
    switch (this.bossType) {
      case 'mega_heavy':
        this.health = this.maxHealth = 500;
        this.maxSpeed = 80;
        this.size = 40;
        this.armor = 25;
        this.fireRate = 0.8;
        this.accuracy = 0.95;
        this.sightRange = 400;
        this.attackRange = 300;
        break;
        
      case 'artillery_commander':
        this.health = this.maxHealth = 350;
        this.maxSpeed = 60;
        this.size = 35;
        this.armor = 15;
        this.fireRate = 0.4;
        this.accuracy = 0.98;
        this.sightRange = 500;
        this.attackRange = 400;
        break;
        
      case 'stealth_assassin':
        this.health = this.maxHealth = 250;
        this.maxSpeed = 200;
        this.size = 30;
        this.armor = 10;
        this.fireRate = 2.0;
        this.accuracy = 0.9;
        this.sightRange = 350;
        this.attackRange = 200;
        break;
    }
  }

  update(deltaTime: number, player: any, obstacles: any[], pathfinder: any): void {
    super.update(deltaTime, player, obstacles, pathfinder);
    
    // Update phase based on health
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent <= 0.33 && this.phase < 3) {
      this.phase = 3;
      this.onPhaseChange();
    } else if (healthPercent <= 0.66 && this.phase < 2) {
      this.phase = 2;
      this.onPhaseChange();
    }
    
    // Special ability system
    this.specialAbilityTimer += deltaTime;
    if (this.specialAbilityTimer >= this.specialAbilityCooldown && !this.isUsingSpecialAbility) {
      this.useSpecialAbility(player);
    }
  }

  private onPhaseChange(): void {
    // Increase stats when entering new phase
    this.fireRate *= 1.3;
    this.maxSpeed *= 1.2;
    this.accuracy = Math.min(0.99, this.accuracy * 1.1);
    
    // Visual effect for phase change
    const event = new CustomEvent('bossPhaseChange', {
      detail: { boss: this, phase: this.phase }
    });
    window.dispatchEvent(event);
  }

  private useSpecialAbility(player: any): void {
    this.isUsingSpecialAbility = true;
    this.specialAbilityTimer = 0;
    
    switch (this.bossType) {
      case 'mega_heavy':
        this.megaBarrage(player);
        break;
      case 'artillery_commander':
        this.artilleryStrike(player);
        break;
      case 'stealth_assassin':
        this.stealthDash(player);
        break;
    }
    
    // Reset ability after 2 seconds
    setTimeout(() => {
      this.isUsingSpecialAbility = false;
    }, 2000);
  }

  private megaBarrage(player: any): void {
    // Fire multiple projectiles in a spread
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const event = new CustomEvent('bossSpecialAttack', {
        detail: {
          boss: this,
          type: 'barrage',
          angle: angle,
          damage: 60
        }
      });
      window.dispatchEvent(event);
    }
  }

  private artilleryStrike(player: any): void {
    // Predict player position and fire there
    const predictedPos = player.position.add(player.velocity.multiply(2));
    const angleToTarget = this.position.angleTo(predictedPos);
    
    const event = new CustomEvent('bossSpecialAttack', {
      detail: {
        boss: this,
        type: 'artillery',
        angle: angleToTarget,
        target: predictedPos,
        damage: 100
      }
    });
    window.dispatchEvent(event);
  }

  private stealthDash(player: any): void {
    // Quick dash towards player
    const toPlayer = player.position.subtract(this.position).normalize();
    this.velocity = this.velocity.add(toPlayer.multiply(300));
    
    const event = new CustomEvent('bossSpecialAttack', {
      detail: {
        boss: this,
        type: 'dash',
        direction: toPlayer
      }
    });
    window.dispatchEvent(event);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Boss glow effect
    ctx.shadowColor = this.getBossColor();
    ctx.shadowBlur = 20;

    // Damage flash effect
    if (this.damageFlashTimer > 0) {
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 30;
    }

    // Draw tank body with boss-specific colors
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotation);

    const bodyColor = this.getBossColor();

    // Tank body (larger for boss)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-this.size, -this.size * 0.6, this.size * 2, this.size * 1.2);

    // Tank tracks (wider for boss)
    ctx.fillStyle = this.darkenColor(bodyColor, 0.3);
    ctx.fillRect(-this.size * 1.2, -this.size * 0.9, this.size * 2.4, this.size * 0.4);
    ctx.fillRect(-this.size * 1.2, this.size * 0.5, this.size * 2.4, this.size * 0.4);

    // Boss identification marks
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(-this.size * 0.8, -this.size * 0.4, this.size * 0.4, this.size * 0.4);
    ctx.fillRect(this.size * 0.4, -this.size * 0.4, this.size * 0.4, this.size * 0.4);

    // Phase indicators
    for (let i = 0; i < this.phase; i++) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-this.size * 0.6 + i * 8, this.size * 0.2, 6, 6);
    }

    ctx.restore();

    // Draw turret (larger)
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.turretRotation);

    // Turret base
    ctx.fillStyle = this.lightenColor(bodyColor, 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Cannon barrel (longer and thicker for boss)
    const barrelLength = this.size * 1.6;
    const barrelWidth = this.size * 0.25;
    ctx.fillStyle = this.darkenColor(bodyColor, 0.2);
    ctx.fillRect(this.size * 0.6, -barrelWidth / 2, barrelLength, barrelWidth);

    ctx.restore();

    // Render health bar (larger for boss)
    this.renderBossHealthBar(ctx);
  }

  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = this.size * 2;
    const barHeight = 8;
    const x = this.position.x - barWidth / 2;
    const y = this.position.y - this.size - 20;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Health
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = healthPercent > 0.6 ? '#0f0' : healthPercent > 0.3 ? '#ff0' : '#f00';
    ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Boss name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.getBossName(), this.position.x, y - 5);
  }

  private getBossColor(): string {
    switch (this.bossType) {
      case 'mega_heavy': return '#8B0000'; // Dark red
      case 'artillery_commander': return '#4B0082'; // Indigo
      case 'stealth_assassin': return '#2F4F4F'; // Dark slate gray
      default: return '#800080';
    }
  }

  private getBossName(): string {
    switch (this.bossType) {
      case 'mega_heavy': return 'MEGA DESTROYER';
      case 'artillery_commander': return 'ARTILLERY COMMANDER';
      case 'stealth_assassin': return 'STEALTH ASSASSIN';
      default: return 'BOSS';
    }
  }

  private darkenColor(color: string, factor: number): string {
    // Simple color darkening
    const colors = {
      '#8B0000': '#5B0000',
      '#4B0082': '#2B0052',
      '#2F4F4F': '#1F2F2F'
    };
    return colors[color as keyof typeof colors] || '#333333';
  }

  private lightenColor(color: string, factor: number): string {
    // Simple color lightening
    const colors = {
      '#8B0000': '#BB0000',
      '#4B0082': '#7B00B2',
      '#2F4F4F': '#5F7F7F'
    };
    return colors[color as keyof typeof colors] || '#666666';
  }

  reset(x: number, y: number, type: BossType): void {
    this.position.set(x, y);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.rotation = 0;
    this.turretRotation = 0;
    this.bossType = type;
    this.phase = 1;
    this.specialAbilityTimer = 0;
    this.isUsingSpecialAbility = false;
    this.damageFlashTimer = 0;
    this.lastFireTime = 0;
    this.initializeBossType();
    this.originalMaxHealth = this.maxHealth;
  }
}