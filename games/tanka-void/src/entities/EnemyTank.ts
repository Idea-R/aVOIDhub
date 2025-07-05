import { Tank } from './Tank.js';
import { Vector2 } from '../utils/Vector2.js';

export type EnemyType = 'scout' | 'heavy' | 'artillery';
export type AIState = 'patrol' | 'seek' | 'engage' | 'retreat';

export class EnemyTank extends Tank {
  public enemyType: EnemyType;
  public aiState: AIState = 'patrol';
  public target: Vector2 | null = null;
  public lastSeenTarget: Vector2 | null = null;
  public sightRange: number = 200;
  public attackRange: number = 150;
  public patrolCenter: Vector2;
  public patrolRadius: number = 100;
  public patrolAngle: number = 0;
  public stateTimer: number = 0;
  public fireRate: number = 1.0; // shots per second
  public accuracy: number = 0.8;
  public aggressionLevel: number = 0.7;

  constructor(x: number, y: number, type: EnemyType) {
    super(x, y);
    this.enemyType = type;
    this.patrolCenter = new Vector2(x, y);
    this.initializeByType();
  }

  private initializeByType(): void {
    switch (this.enemyType) {
      case 'scout':
        this.health = this.maxHealth = 60;
        this.maxSpeed = 200;
        this.sightRange = 250;
        this.attackRange = 120;
        this.fireRate = 2.0;
        this.accuracy = 0.7;
        this.aggressionLevel = 0.9;
        this.armor = 0;
        break;
      case 'heavy':
        this.health = this.maxHealth = 150;
        this.maxSpeed = 100;
        this.sightRange = 180;
        this.attackRange = 180;
        this.fireRate = 0.6;
        this.accuracy = 0.9;
        this.aggressionLevel = 0.6;
        this.armor = 10;
        this.size = 30;
        break;
      case 'artillery':
        this.health = this.maxHealth = 80;
        this.maxSpeed = 80;
        this.sightRange = 300;
        this.attackRange = 250;
        this.fireRate = 0.4;
        this.accuracy = 0.95;
        this.aggressionLevel = 0.3;
        this.armor = 5;
        break;
    }
  }

  update(deltaTime: number, player: any, obstacles: any[], pathfinder: any): void {
    super.update(deltaTime);

    this.stateTimer += deltaTime;
    this.updateAI(deltaTime, player.position);
    
    // Auto-fire at player if in range and has line of sight
    if (this.target && this.canFire() && this.hasLineOfSight(player.position, []) && this.aiState === 'engage') {
      this.fireAtTarget(player);
    }
  }

  private updateAI(deltaTime: number, playerPosition: Vector2): void {
    const distanceToPlayer = this.position.distance(playerPosition);

    // Update target based on player visibility
    if (distanceToPlayer <= this.sightRange) {
      this.target = playerPosition.clone();
      this.lastSeenTarget = playerPosition.clone();
    }

    // State machine
    switch (this.aiState) {
      case 'patrol':
        this.patrol(deltaTime);
        if (this.target && distanceToPlayer <= this.sightRange) {
          this.aiState = 'seek';
          this.stateTimer = 0;
        }
        break;

      case 'seek':
        this.seek(deltaTime);
        if (distanceToPlayer <= this.attackRange) {
          this.aiState = 'engage';
          this.stateTimer = 0;
        } else if (distanceToPlayer > this.sightRange * 1.5) {
          this.aiState = 'patrol';
          this.target = null;
          this.stateTimer = 0;
        }
        break;

      case 'engage':
        this.engage(deltaTime);
        if (distanceToPlayer > this.attackRange * 1.5) {
          this.aiState = 'seek';
          this.stateTimer = 0;
        } else if (this.health < this.maxHealth * 0.3 && this.aggressionLevel < 0.5) {
          this.aiState = 'retreat';
          this.stateTimer = 0;
        }
        break;

      case 'retreat':
        this.retreat(deltaTime);
        if (this.health > this.maxHealth * 0.6 || this.stateTimer > 5.0) {
          this.aiState = 'seek';
          this.stateTimer = 0;
        }
        break;
    }

    // Update turret to aim at player if in range
    if (this.target && distanceToPlayer <= this.attackRange) {
      const targetAngle = this.position.angleTo(this.target);
      this.turretRotation = this.lerpAngle(this.turretRotation, targetAngle, this.turretTurnSpeed * deltaTime);
    }
  }

  private patrol(deltaTime: number): void {
    this.patrolAngle += deltaTime * 0.5;
    const targetX = this.patrolCenter.x + Math.cos(this.patrolAngle) * this.patrolRadius;
    const targetY = this.patrolCenter.y + Math.sin(this.patrolAngle) * this.patrolRadius;
    
    this.moveToward(new Vector2(targetX, targetY), deltaTime);
  }

  private seek(deltaTime: number): void {
    if (this.target) {
      this.moveToward(this.target, deltaTime);
    } else if (this.lastSeenTarget) {
      this.moveToward(this.lastSeenTarget, deltaTime);
    }
  }

  private engage(deltaTime: number): void {
    if (!this.target) return;

    // Maintain optimal distance
    const distance = this.position.distance(this.target);
    const optimalDistance = this.attackRange * 0.7;

    if (distance < optimalDistance) {
      // Back away
      const retreatDirection = this.position.subtract(this.target).normalize();
      const retreatTarget = this.position.add(retreatDirection.multiply(50));
      this.moveToward(retreatTarget, deltaTime);
    } else if (distance > this.attackRange) {
      // Move closer
      this.moveToward(this.target, deltaTime);
    } else {
      // Strafe around target
      this.strafeAroundTarget(deltaTime);
    }
  }

  private retreat(deltaTime: number): void {
    if (this.target) {
      const retreatDirection = this.position.subtract(this.target).normalize();
      const retreatTarget = this.position.add(retreatDirection.multiply(150));
      this.moveToward(retreatTarget, deltaTime);
    }
  }

  private moveToward(target: Vector2, deltaTime: number): void {
    const direction = target.subtract(this.position).normalize();
    const targetRotation = Math.atan2(direction.y, direction.x);
    
    // Smooth rotation toward target
    this.rotation = this.lerpAngle(this.rotation, targetRotation, this.turnSpeed * deltaTime);
    
    // Move forward
    const forward = Vector2.fromAngle(this.rotation);
    this.acceleration = this.acceleration.add(forward.multiply(this.enginePower));
  }

  private strafeAroundTarget(deltaTime: number): void {
    if (!this.target) return;

    const toTarget = this.target.subtract(this.position);
    const perpendicular = new Vector2(-toTarget.y, toTarget.x).normalize();
    const strafeDirection = Math.sin(this.stateTimer * 2) > 0 ? 1 : -1;
    
    this.acceleration = this.acceleration.add(perpendicular.multiply(strafeDirection * this.enginePower * 0.5));
  }

  private lerpAngle(current: number, target: number, speed: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return current + diff * speed;
  }

  canFire(): boolean {
    const timeSinceLastFire = (performance.now() - this.lastFireTime) / 1000;
    return timeSinceLastFire >= (1 / this.fireRate);
  }

  getFireDirection(): number {
    if (!this.target) return this.turretRotation;
    
    // Add some inaccuracy based on accuracy stat
    const baseAngle = this.position.angleTo(this.target);
    const inaccuracy = (1 - this.accuracy) * 0.5; // Max 0.5 radians inaccuracy
    const randomOffset = (Math.random() - 0.5) * inaccuracy;
    
    return baseAngle + randomOffset;
  }

  fireAtTarget(target: PlayerTank): boolean {
    const currentTime = performance.now()
    const fireInterval = 60000 / this.fireRate
    
    if (currentTime - this.lastFireTime < fireInterval) {
      return false
    }
    
    // Check if target is in firing arc
    const toTarget = target.position.subtract(this.position)
    const angleToTarget = Math.atan2(toTarget.y, toTarget.x)
    const turretAngleDiff = Math.abs(this.normalizeAngle(angleToTarget - this.turretRotation))
    
    if (turretAngleDiff < 0.2) { // ~11 degrees tolerance
      this.lastFireTime = currentTime
      
      // Create projectile - this will be handled by the game's projectile system
      const event = new CustomEvent('enemyFire', {
        detail: {
          tank: this,
          target: target,
          angle: this.turretRotation,
          damage: this.enemyType === 'heavy' ? 40 : this.enemyType === 'artillery' ? 60 : 25
        }
      })
      window.dispatchEvent(event)
      
      return true
    }
    
    return false
  }
  
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  hasLineOfSight(target: Vector2, obstacles: any[]): boolean {
    // Simple line of sight check - can be enhanced with actual obstacle checking
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Damage flash effect
    if (this.damageFlashTimer > 0) {
      ctx.globalAlpha = 0.7;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
    }

    // Draw tank body with enemy-specific colors
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotation);

    let bodyColor: string;
    switch (this.enemyType) {
      case 'scout':
        bodyColor = '#8B4513'; // Brown
        break;
      case 'heavy':
        bodyColor = '#2F4F4F'; // Dark gray
        break;
      case 'artillery':
        bodyColor = '#800080'; // Purple
        break;
    }

    // Tank body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-this.size, -this.size * 0.6, this.size * 2, this.size * 1.2);

    // Tank tracks
    ctx.fillStyle = this.darkenColor(bodyColor, 0.3);
    ctx.fillRect(-this.size * 1.1, -this.size * 0.8, this.size * 2.2, this.size * 0.3);
    ctx.fillRect(-this.size * 1.1, this.size * 0.5, this.size * 2.2, this.size * 0.3);

    // Enemy identification mark
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-this.size * 0.6, -this.size * 0.3, this.size * 0.3, this.size * 0.3);

    ctx.restore();

    // Draw turret
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.turretRotation);

    // Turret base
    ctx.fillStyle = this.lightenColor(bodyColor, 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Cannon barrel (different sizes for different types)
    const barrelLength = this.enemyType === 'artillery' ? this.size * 1.4 : this.size * 1.2;
    ctx.fillStyle = this.darkenColor(bodyColor, 0.2);
    ctx.fillRect(this.size * 0.5, -this.size * 0.1, barrelLength, this.size * 0.2);

    ctx.restore();
  }

  private darkenColor(color: string, factor: number): string {
    // Simple color darkening
    const colors = {
      '#8B4513': '#654321',
      '#2F4F4F': '#1F2F2F',
      '#800080': '#600060'
    };
    return colors[color as keyof typeof colors] || '#333333';
  }

  private lightenColor(color: string, factor: number): string {
    // Simple color lightening
    const colors = {
      '#8B4513': '#AB6533',
      '#2F4F4F': '#4F6F6F',
      '#800080': '#A020A0'
    };
    return colors[color as keyof typeof colors] || '#666666';
  }

  reset(x: number, y: number, type: EnemyType): void {
    this.position.set(x, y);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.rotation = 0;
    this.turretRotation = 0;
    this.enemyType = type;
    this.aiState = 'patrol';
    this.target = null;
    this.lastSeenTarget = null;
    this.patrolCenter = new Vector2(x, y);
    this.patrolAngle = 0;
    this.stateTimer = 0;
    this.damageFlashTimer = 0;
    this.lastFireTime = 0;
    this.initializeByType();
  }
}