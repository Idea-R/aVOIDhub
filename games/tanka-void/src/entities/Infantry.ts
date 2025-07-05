import { Vector2 } from '../utils/Vector2.js';

export type InfantryType = 'rifleman' | 'rpg' | 'sniper' | 'medic';
export type InfantryState = 'patrol' | 'engage' | 'retreat' | 'dead';

export class Infantry {
  public position: Vector2;
  public velocity: Vector2 = new Vector2();
  public rotation: number = 0;
  public health: number;
  public maxHealth: number;
  public size: number = 8;
  public type: InfantryType;
  public state: InfantryState = 'patrol';
  public target: any = null;
  public lastFireTime: number = 0;
  public fireRate: number = 60; // RPM
  public damage: number = 5;
  public range: number = 150;
  public speed: number = 50;
  public alive: boolean = true;
  public bloodSplat: boolean = false;
  public deathTimer: number = 0;
  public maxDeathTimer: number = 5.0;
  public patrolTarget: Vector2;
  public patrolRadius: number = 100;
  public stateTimer: number = 0;
  public weaponSprite: string = '🔫';
  public accuracy: number = 0.7;

  constructor(x: number, y: number, type: InfantryType) {
    this.position = new Vector2(x, y);
    this.type = type;
    this.patrolTarget = new Vector2(x + (Math.random() - 0.5) * 200, y + (Math.random() - 0.5) * 200);
    this.initializeType();
  }

  private initializeType(): void {
    switch (this.type) {
      case 'rifleman':
        this.health = this.maxHealth = 25;
        this.damage = 8;
        this.fireRate = 90;
        this.range = 180;
        this.speed = 60;
        this.accuracy = 0.75;
        this.weaponSprite = '🔫';
        break;
      case 'rpg':
        this.health = this.maxHealth = 40;
        this.damage = 50;
        this.fireRate = 20;
        this.range = 250;
        this.speed = 45;
        this.accuracy = 0.85;
        this.weaponSprite = '🚀';
        break;
      case 'sniper':
        this.health = this.maxHealth = 20;
        this.damage = 35;
        this.fireRate = 30;
        this.range = 300;
        this.speed = 40;
        this.accuracy = 0.95;
        this.weaponSprite = '🎯';
        break;
      case 'medic':
        this.health = this.maxHealth = 30;
        this.damage = 3;
        this.fireRate = 60;
        this.range = 120;
        this.speed = 70;
        this.accuracy = 0.6;
        this.weaponSprite = '💉';
        break;
    }
  }

  update(deltaTime: number, player: any): void {
    if (!this.alive) {
      this.deathTimer += deltaTime;
      if (this.deathTimer > this.maxDeathTimer) {
        // Mark for cleanup
      }
      return;
    }

    this.stateTimer += deltaTime;
    this.updateAI(deltaTime, player);
    this.updateMovement(deltaTime);
    this.updateCombat(deltaTime, player);
  }

  private updateAI(deltaTime: number, player: any): void {
    const distanceToPlayer = this.position.distance(player.position);

    switch (this.state) {
      case 'patrol':
        if (distanceToPlayer < this.range) {
          this.state = 'engage';
          this.target = player;
          this.stateTimer = 0;
        } else {
          this.patrol(deltaTime);
        }
        break;

      case 'engage':
        if (distanceToPlayer > this.range * 1.5) {
          this.state = 'patrol';
          this.target = null;
        } else if (this.health < this.maxHealth * 0.3) {
          this.state = 'retreat';
        } else {
          this.engage(deltaTime, player);
        }
        break;

      case 'retreat':
        this.retreat(deltaTime, player);
        if (this.health > this.maxHealth * 0.6 || this.stateTimer > 5) {
          this.state = 'patrol';
        }
        break;
    }
  }

  private patrol(deltaTime: number): void {
    const distance = this.position.distance(this.patrolTarget);
    if (distance < 20) {
      // Pick new patrol target
      this.patrolTarget = new Vector2(
        this.position.x + (Math.random() - 0.5) * this.patrolRadius * 2,
        this.position.y + (Math.random() - 0.5) * this.patrolRadius * 2
      );
    }

    this.moveToward(this.patrolTarget, deltaTime);
  }

  private engage(deltaTime: number, player: any): void {
    const distance = this.position.distance(player.position);
    const optimalRange = this.range * 0.8;

    if (distance > optimalRange) {
      // Move closer
      this.moveToward(player.position, deltaTime);
    } else if (distance < optimalRange * 0.5) {
      // Back away
      const retreatDirection = this.position.subtract(player.position).normalize();
      const retreatTarget = this.position.add(retreatDirection.multiply(30));
      this.moveToward(retreatTarget, deltaTime);
    } else {
      // Strafe around player
      this.strafeAroundTarget(player.position, deltaTime);
    }
  }

  private retreat(deltaTime: number, player: any): void {
    const retreatDirection = this.position.subtract(player.position).normalize();
    const retreatTarget = this.position.add(retreatDirection.multiply(100));
    this.moveToward(retreatTarget, deltaTime);
  }

  private moveToward(target: Vector2, deltaTime: number): void {
    const direction = target.subtract(this.position).normalize();
    this.velocity = direction.multiply(this.speed);
    
    // Update rotation to face movement direction
    this.rotation = Math.atan2(direction.y, direction.x);
  }

  private strafeAroundTarget(target: Vector2, deltaTime: number): void {
    const toTarget = target.subtract(this.position);
    const perpendicular = new Vector2(-toTarget.y, toTarget.x).normalize();
    const strafeDirection = Math.sin(this.stateTimer * 3) > 0 ? 1 : -1;
    
    this.velocity = perpendicular.multiply(strafeDirection * this.speed * 0.7);
  }

  private updateMovement(deltaTime: number): void {
    this.position = this.position.add(this.velocity.multiply(deltaTime));
    this.velocity = this.velocity.multiply(0.9); // Friction
  }

  private updateCombat(deltaTime: number, player: any): void {
    if (this.state !== 'engage' || !this.target) return;

    const distance = this.position.distance(player.position);
    if (distance <= this.range && this.canFire()) {
      this.fireAtPlayer(player);
    }
    
    // Face the player when engaging
    if (this.target) {
      const toTarget = player.position.subtract(this.position);
      this.rotation = Math.atan2(toTarget.y, toTarget.x);
    }
  }

  private canFire(): boolean {
    const timeSinceLastFire = (performance.now() - this.lastFireTime) / 1000;
    return timeSinceLastFire >= (60 / this.fireRate);
  }

  private fireAtPlayer(player: any): void {
    this.lastFireTime = performance.now();

    // Add inaccuracy
    const baseAngle = this.position.angleTo(player.position);
    const inaccuracy = (1 - this.accuracy) * 0.3;
    const angle = baseAngle + (Math.random() - 0.5) * inaccuracy;

    // Fire event
    const event = new CustomEvent('infantryFire', {
      detail: {
        infantry: this,
        angle: angle,
        damage: this.damage,
        type: this.type
      }
    });
    window.dispatchEvent(event);
  }

  takeDamage(damage: number): void {
    this.health -= damage;
    if (this.health <= 0) {
      this.die();
    }
  }

  die(): void {
    this.alive = false;
    this.bloodSplat = true;
    this.deathTimer = 0;
    
    // Create blood splat particles
    const event = new CustomEvent('infantryDeath', {
      detail: {
        position: this.position.clone(),
        type: this.type
      }
    });
    window.dispatchEvent(event);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive && this.deathTimer > 1) return; // Fade out after 1 second

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    if (this.alive) {
      // Rotate to face movement direction
      ctx.rotate(this.rotation);

      // Body color based on type
      const bodyColors = {
        rifleman: '#4a5d23',
        rpg: '#5d4a23',
        sniper: '#2d3d1a',
        medic: '#5d2323'
      };

      // Draw body
      ctx.fillStyle = bodyColors[this.type];
      ctx.fillRect(-4, -6, 8, 12);

      // Draw head
      ctx.fillStyle = '#d4a574';
      ctx.beginPath();
      ctx.arc(0, -8, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw weapon
      ctx.fillStyle = '#333';
      ctx.fillRect(4, -2, 8, 2);

      // Draw weapon icon
      ctx.font = '8px Arial';
      ctx.fillText(this.weaponSprite, 6, -6);

      // Health bar
      if (this.health < this.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(-6, -12, 12, 2);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.6 ? '#0f0' : healthPercent > 0.3 ? '#ff0' : '#f00';
        ctx.fillRect(-6, -12, 12 * healthPercent, 2);
      }
    } else {
      // Draw blood splat
      ctx.fillStyle = '#8B0000';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw smaller blood spots
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const distance = 10 + Math.random() * 5;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw body (dead)
      ctx.fillStyle = '#666';
      ctx.fillRect(-4, -2, 8, 4);
    }

    ctx.restore();
  }

  reset(x: number, y: number, type: InfantryType): void {
    this.position.set(x, y);
    this.velocity.set(0, 0);
    this.rotation = 0;
    this.type = type;
    this.state = 'patrol';
    this.target = null;
    this.lastFireTime = 0;
    this.alive = true;
    this.bloodSplat = false;
    this.deathTimer = 0;
    this.stateTimer = 0;
    this.patrolTarget = new Vector2(x + (Math.random() - 0.5) * 200, y + (Math.random() - 0.5) * 200);
    this.initializeType();
  }
}