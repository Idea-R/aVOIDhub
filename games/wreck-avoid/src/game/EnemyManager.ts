import { Enemy, Vector2, Projectile } from '../types/Game';
import { PhysicsEngine } from './PhysicsEngine';

export class EnemyManager {
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private nextEnemyId = 0;
  private nextProjectileId = 0;
  private spawnTimer = 0;
  private bossSpawnTimer = 0;
  private bossesSpawned = 0;

  spawnEnemy(canvasWidth: number, canvasHeight: number, wave: number, playerPos: Vector2): void {
    const side = Math.floor(Math.random() * 4);
    let pos: Vector2;
    let velocity: Vector2;
    
    const speed = 40 + wave * 8;

    switch (side) {
      case 0: // top
        pos = { x: Math.random() * canvasWidth, y: -60 };
        break;
      case 1: // right
        pos = { x: canvasWidth + 60, y: Math.random() * canvasHeight };
        break;
      case 2: // bottom
        pos = { x: Math.random() * canvasWidth, y: canvasHeight + 60 };
        break;
      default: // left
        pos = { x: -60, y: Math.random() * canvasHeight };
        break;
    }

    const direction = PhysicsEngine.normalize({
      x: playerPos.x - pos.x,
      y: playerPos.y - pos.y,
    });

    velocity = {
      x: direction.x * speed,
      y: direction.y * speed,
    };

    const types: ('basic' | 'heavy' | 'fast' | 'triangle' | 'square')[] = ['basic'];
    
    // Add weak enemies early on for satisfying chain kills
    if (wave <= 5) types.push('weak', 'weak', 'weak'); // More frequent weak enemies early
    if (wave <= 10) types.push('weak', 'weak'); // Still present but less frequent
    if (wave <= 15) types.push('weak'); // Rare after wave 15
    
    if (wave >= 3) types.push('heavy');
    if (wave >= 5) types.push('fast');
    if (wave >= 7) types.push('triangle');
    if (wave >= 10) types.push('square');
    
    // Add special rare enemies
    if (wave >= 8 && Math.random() < 0.05) { // 5% chance for ninja star after wave 8
      types.push('ninja_star');
    }
    if (wave >= 12 && Math.random() < 0.08) { // 8% chance for pusher after wave 12
      types.push('pusher');
    }
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    let health, size, color, shape: 'circle' | 'triangle' | 'square' = 'circle';
    switch (type) {
      case 'weak':
        health = 1; // Dies in one chain hit
        size = 16;
        color = '#888888';
        velocity.x *= 0.7;
        velocity.y *= 0.7;
        break;
      case 'heavy':
        health = 24; // 3x increase from 8
        size = 30;
        color = '#ff4444';
        velocity.x *= 0.5;
        velocity.y *= 0.5;
        break;
      case 'fast':
        health = 3; // Slightly increased from 2
        size = 15;
        color = '#44ff44';
        velocity.x *= 1.8;
        velocity.y *= 1.8;
        break;
      case 'triangle':
        health = 8; // Slightly increased from 6
        size = 25;
        color = '#ff8844';
        shape = 'triangle';
        velocity.x *= 1.2;
        velocity.y *= 1.2;
        break;
      case 'square':
        health = 14; // Slightly increased from 10
        size = 28;
        color = '#8844ff';
        shape = 'square';
        velocity.x *= 0.8;
        velocity.y *= 0.8;
        break;
      case 'ninja_star':
        health = 6;
        size = 18;
        color = '#666666';
        shape = 'circle';
        velocity.x *= 1.5;
        velocity.y *= 1.5;
        break;
      case 'pusher':
        health = 10;
        size = 26;
        color = '#ff6600';
        shape = 'circle';
        velocity.x *= 0.9;
        velocity.y *= 0.9;
        break;
      default:
        health = 5; // Slightly increased from 4
        size = 22;
        color = '#ffaa44';
        break;
    }

    this.enemies.push({
      id: this.nextEnemyId++,
      pos,
      velocity,
      health,
      maxHealth: health,
      type,
      size,
      color,
      shape,
      spinAngle: type === 'ninja_star' ? 0 : undefined,
      chainWrapped: false,
      pushForce: type === 'pusher' ? 300 : undefined,
    });
  }

  spawnBoss(canvasWidth: number, canvasHeight: number, wave: number, playerPos: Vector2): void {
    // Spawn boss at random edge, but farther out
    const side = Math.floor(Math.random() * 4);
    let pos: Vector2;
    
    switch (side) {
      case 0: // top
        pos = { x: Math.random() * canvasWidth, y: -100 };
        break;
      case 1: // right
        pos = { x: canvasWidth + 100, y: Math.random() * canvasHeight };
        break;
      case 2: // bottom
        pos = { x: Math.random() * canvasWidth, y: canvasHeight + 100 };
        break;
      default: // left
        pos = { x: -100, y: Math.random() * canvasHeight };
        break;
    }

    const direction = PhysicsEngine.normalize({
      x: playerPos.x - pos.x,
      y: playerPos.y - pos.y,
    });

    const velocity = {
      x: direction.x * 30, // Slower than regular enemies
      y: direction.y * 30,
    };

    const bossHealth = 20 + (this.bossesSpawned * 10); // Increasing health per boss
    const finalBossHealth = bossHealth * 10; // 10x increase for bosses
    const bossSize = 50 + (this.bossesSpawned * 5); // Increasing size per boss

    // Determine UFO boss type and abilities based on spawn count
    const ufoTypes = ['scout', 'destroyer', 'mothership', 'harvester', 'dreadnought'];
    const ufoType = ufoTypes[Math.min(this.bossesSpawned, ufoTypes.length - 1)];
    
    let projectileType: 'single' | 'spread' | 'homing' | 'rapid' = 'single';
    let projectileCount = 1;
    let projectileSpeedMultiplier = 1.0;
    let minionSpawnCooldown = 15000; // 15 seconds
    let minionTypeToSpawn: 'weak' | 'basic' | 'fast' = 'weak';
    let bossAbilities: string[] = [];
    let ufoColor = '#ff0088';
    let ufoPattern = 'classic';
    
    // Configure UFO boss based on type
    switch (ufoType) {
      case 'scout':
        projectileType = 'spread';
        projectileCount = 3;
        ufoColor = '#00ff88';
        ufoPattern = 'scout';
        bossAbilities.push('spread_shot', 'evasive_maneuvers');
        break;
      case 'destroyer':
        projectileType = 'rapid';
        projectileCount = 5;
        projectileSpeedMultiplier = 1.5;
        ufoColor = '#ff4400';
        ufoPattern = 'destroyer';
        bossAbilities.push('rapid_fire', 'plasma_cannons');
        break;
      case 'mothership':
        projectileType = 'homing';
        minionSpawnCooldown = 8000;
        minionTypeToSpawn = 'basic';
        ufoColor = '#8800ff';
        ufoPattern = 'mothership';
        bossAbilities.push('homing_missiles', 'minion_spawn', 'shield_regeneration');
        break;
      case 'harvester':
        projectileType = 'spread';
        projectileCount = 6;
        minionSpawnCooldown = 10000;
        minionTypeToSpawn = 'fast';
        ufoColor = '#ffff00';
        ufoPattern = 'harvester';
        bossAbilities.push('energy_drain', 'minion_spawn', 'tractor_beam');
        break;
      case 'dreadnought':
        projectileType = 'rapid';
        projectileCount = 8;
        projectileSpeedMultiplier = 2.0;
        minionSpawnCooldown = 6000;
        minionTypeToSpawn = 'fast';
        ufoColor = '#ff0044';
        ufoPattern = 'dreadnought';
        bossAbilities.push('rapid_fire', 'minion_spawn', 'death_ray', 'armor_plating');
        break;
    }

    this.enemies.push({
      id: this.nextEnemyId++,
      pos,
      velocity,
      health: finalBossHealth,
      maxHealth: finalBossHealth,
      type: 'boss',
      size: bossSize,
      color: ufoColor,
      shape: 'circle',
      lastShotTime: 0,
      shootCooldown: 2000 - (this.bossesSpawned * 200), // Faster shooting over time
      projectileType,
      projectileCount,
      projectileSpeedMultiplier,
      minionSpawnCooldown,
      lastMinionSpawnTime: 0,
      minionTypeToSpawn,
      bossAbilities,
      ufoType,
      ufoPattern,
      hoverOffset: 0, // For UFO hovering animation
      rotationAngle: 0, // For UFO rotation
    });

    this.bossesSpawned++;
  }

  updateBossShooting(playerPos: Vector2): void {
    const currentTime = Date.now();
    
    this.enemies.forEach(enemy => {
      if (enemy.type === 'boss' && enemy.lastShotTime !== undefined && enemy.shootCooldown !== undefined) {
        if (currentTime - enemy.lastShotTime > enemy.shootCooldown) {
          this.executeBossAttack(enemy, playerPos);
          
          enemy.lastShotTime = currentTime;
        }
      }
    });
  }

  private executeBossAttack(boss: Enemy, playerPos: Vector2): void {
    const baseProjectileSpeed = 200 * (boss.projectileSpeedMultiplier || 1);
    const projectileCount = boss.projectileCount || 1;
    
    switch (boss.projectileType) {
      case 'single':
        this.createSingleProjectile(boss, playerPos, baseProjectileSpeed);
        break;
      case 'spread':
        this.createSpreadProjectiles(boss, playerPos, baseProjectileSpeed, projectileCount);
        break;
      case 'homing':
        this.createHomingProjectile(boss, playerPos, baseProjectileSpeed);
        break;
      case 'rapid':
        this.createRapidProjectiles(boss, playerPos, baseProjectileSpeed, projectileCount);
        break;
    }
  }

  private createSingleProjectile(boss: Enemy, playerPos: Vector2, speed: number): void {
    const direction = PhysicsEngine.normalize({
      x: playerPos.x - boss.pos.x,
      y: playerPos.y - boss.pos.y,
    });
    
    this.projectiles.push({
      id: this.nextProjectileId++,
      pos: { ...boss.pos },
      velocity: {
        x: direction.x * speed,
        y: direction.y * speed,
      },
      size: 8,
      color: '#ff0088',
      damage: 15,
      life: 5000,
    });
  }

  private createSpreadProjectiles(boss: Enemy, playerPos: Vector2, speed: number, count: number): void {
    const baseDirection = PhysicsEngine.normalize({
      x: playerPos.x - boss.pos.x,
      y: playerPos.y - boss.pos.y,
    });
    
    const baseAngle = Math.atan2(baseDirection.y, baseDirection.x);
    const spreadAngle = Math.PI / 6; // 30 degrees spread
    
    for (let i = 0; i < count; i++) {
      const angleOffset = (i - (count - 1) / 2) * (spreadAngle / (count - 1));
      const angle = baseAngle + angleOffset;
      
      this.projectiles.push({
        id: this.nextProjectileId++,
        pos: { ...boss.pos },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        size: 6,
        color: '#ff4488',
        damage: 12,
        life: 5000,
      });
    }
  }

  private createHomingProjectile(boss: Enemy, playerPos: Vector2, speed: number): void {
    // Create a homing projectile that adjusts its direction over time
    const direction = PhysicsEngine.normalize({
      x: playerPos.x - boss.pos.x,
      y: playerPos.y - boss.pos.y,
    });
    
    this.projectiles.push({
      id: this.nextProjectileId++,
      pos: { ...boss.pos },
      velocity: {
        x: direction.x * speed * 0.7, // Start slower
        y: direction.y * speed * 0.7,
      },
      size: 10,
      color: '#ff8800',
      damage: 20,
      life: 7000, // Longer life for homing
    });
  }

  private createRapidProjectiles(boss: Enemy, playerPos: Vector2, speed: number, count: number): void {
    const direction = PhysicsEngine.normalize({
      x: playerPos.x - boss.pos.x,
      y: playerPos.y - boss.pos.y,
    });
    
    // Create multiple projectiles with slight random spread
    for (let i = 0; i < count; i++) {
      const randomSpread = (Math.random() - 0.5) * 0.3; // Small random spread
      const angle = Math.atan2(direction.y, direction.x) + randomSpread;
      
      this.projectiles.push({
        id: this.nextProjectileId++,
        pos: { 
          x: boss.pos.x + (Math.random() - 0.5) * boss.size,
          y: boss.pos.y + (Math.random() - 0.5) * boss.size,
        },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        size: 5,
        color: '#ff0044',
        damage: 8,
        life: 4000,
      });
    }
  }

  updateBossMinions(canvasWidth: number, canvasHeight: number, playerPos: Vector2): void {
    const currentTime = Date.now();
    
    this.enemies.forEach(enemy => {
      if (enemy.type === 'boss' && 
          enemy.minionSpawnCooldown && 
          enemy.lastMinionSpawnTime !== undefined &&
          enemy.minionTypeToSpawn) {
        
        if (currentTime - enemy.lastMinionSpawnTime > enemy.minionSpawnCooldown) {
          // Spawn minions around the boss
          const minionCount = enemy.bossAbilities?.includes('elite_minions') ? 3 : 2;
          
          for (let i = 0; i < minionCount; i++) {
            const angle = (i / minionCount) * Math.PI * 2;
            const spawnDistance = enemy.size + 50;
            const spawnPos = {
              x: enemy.pos.x + Math.cos(angle) * spawnDistance,
              y: enemy.pos.y + Math.sin(angle) * spawnDistance,
            };
            
            this.spawnMinionAt(spawnPos, enemy.minionTypeToSpawn, playerPos);
          }
          
          enemy.lastMinionSpawnTime = currentTime;
        }
      }
    });
  }

  private spawnMinionAt(pos: Vector2, minionType: 'weak' | 'basic' | 'fast', playerPos: Vector2): void {
    const direction = PhysicsEngine.normalize({
      x: playerPos.x - pos.x,
      y: playerPos.y - pos.y,
    });

    let health, size, color, speed;
    switch (minionType) {
      case 'weak':
        health = 1;
        size = 16;
        color = '#666666';
        speed = 60;
        break;
      case 'basic':
        health = 3;
        size = 20;
        color = '#ffaa44';
        speed = 80;
        break;
      case 'fast':
        health = 2;
        size = 15;
        color = '#44ff44';
        speed = 120;
        break;
    }

    this.enemies.push({
      id: this.nextEnemyId++,
      pos: { ...pos },
      velocity: {
        x: direction.x * speed,
        y: direction.y * speed,
      },
      health,
      maxHealth: health,
      type: minionType,
      size,
      color,
      shape: 'circle',
    });
  }

  update(deltaTime: number, canvasWidth: number, canvasHeight: number, wave: number, playerPos: Vector2): void {
    const dt = deltaTime / 1000;
    
    // Update boss AI - make them chase the player aggressively
    this.updateBossAI(playerPos, dt);
    
    // Remove dead enemies FIRST before any other processing
    this.enemies = this.enemies.filter(enemy => enemy.health > 0);
    
    // Update spawn timer
    this.spawnTimer += deltaTime;
    const spawnRate = Math.max(800 - wave * 80, 300);
    
    if (this.spawnTimer >= spawnRate) {
      this.spawnEnemy(canvasWidth, canvasHeight, wave, playerPos);
      this.spawnTimer = 0;
    }

    // Update boss spawn timer (every minute)
    this.bossSpawnTimer += deltaTime;
    const bossSpawnRate = 60000; // 60 seconds
    
    if (this.bossSpawnTimer >= bossSpawnRate) {
      this.spawnBoss(canvasWidth, canvasHeight, wave, playerPos);
      this.bossSpawnTimer = 0;
    }

    // Update boss shooting
    this.updateBossShooting(playerPos);
    
    // Update boss minion spawning
    this.updateBossMinions(canvasWidth, canvasHeight, playerPos);

    // Update enemy positions and special behaviors
    this.enemies.forEach(enemy => {
      // Update ninja star rotation
      if (enemy.type === 'ninja_star' && enemy.spinAngle !== undefined) {
        enemy.spinAngle += deltaTime * 0.01; // Spinning animation
      }
    });
    
    PhysicsEngine.updateEnemies(this.enemies, deltaTime, canvasWidth, canvasHeight);
    
    // Update projectiles with homing behavior
    // Update projectiles with homing behavior
    this.projectiles.forEach(projectile => {
      projectile.pos.x += projectile.velocity.x * dt;
      projectile.pos.y += projectile.velocity.y * dt;
      projectile.life -= deltaTime;
      
      // Homing behavior for orange projectiles
      if (projectile.color === '#ff8800') {
        const homingForce = 100;
        const direction = PhysicsEngine.normalize({
          x: playerPos.x - projectile.pos.x,
          y: playerPos.y - projectile.pos.y,
        });
        
        projectile.velocity.x += direction.x * homingForce * dt;
        projectile.velocity.y += direction.y * homingForce * dt;
        
        // Limit max speed
        const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
        if (speed > 300) {
          projectile.velocity.x = (projectile.velocity.x / speed) * 300;
          projectile.velocity.y = (projectile.velocity.y / speed) * 300;
        }
      }
    });

    // Remove off-screen enemies
    this.enemies = this.enemies.filter(enemy => {
      return enemy.health > 0 && // Ensure dead enemies are removed
             enemy.pos.x > -150 && enemy.pos.x < canvasWidth + 150 &&
             enemy.pos.y > -150 && enemy.pos.y < canvasHeight + 150;
    });
    
    // Remove expired projectiles
    this.projectiles = this.projectiles.filter(projectile => {
      return projectile.life > 0 &&
             projectile.pos.x > -50 && projectile.pos.x < canvasWidth + 50 &&
             projectile.pos.y > -50 && projectile.pos.y < canvasHeight + 50;
    });
  }

  private updateBossAI(playerPos: Vector2, deltaTime: number): void {
    this.enemies.forEach(enemy => {
      if (enemy.type === 'boss') {
        // Update UFO-specific animations
        if (enemy.hoverOffset !== undefined) {
          enemy.hoverOffset += deltaTime * 0.003; // Slow hovering motion
        }
        if (enemy.rotationAngle !== undefined) {
          enemy.rotationAngle += deltaTime * 0.001; // Slow rotation
        }
        
        // Calculate distance to player
        const distanceToPlayer = PhysicsEngine.distance(enemy.pos, playerPos);
        
        // UFO-specific movement patterns
        const direction = PhysicsEngine.normalize({
          x: playerPos.x - enemy.pos.x,
          y: playerPos.y - enemy.pos.y,
        });
        
        // Different movement patterns for different UFO types
        let baseSpeed = 40 + (this.bossesSpawned * 10);
        let movementPattern = 'chase';
        
        switch (enemy.ufoType) {
          case 'scout':
            // Fast, evasive movement
            baseSpeed *= 0.8; // Reduced from 1.5 to make it slower
            movementPattern = 'evasive';
            break;
          case 'destroyer':
            // Aggressive direct assault
            baseSpeed *= 1.2;
            movementPattern = 'aggressive';
            break;
          case 'mothership':
            // Slow, deliberate movement
            baseSpeed *= 0.7;
            movementPattern = 'deliberate';
            break;
          case 'harvester':
            // Circling movement to "harvest"
            baseSpeed *= 0.9;
            movementPattern = 'circling';
            break;
          case 'dreadnought':
            // Slow but unstoppable
            baseSpeed *= 0.8;
            movementPattern = 'unstoppable';
            break;
        }
        
        // Apply movement pattern
        this.applyUFOMovementPattern(enemy, direction, baseSpeed, movementPattern, distanceToPlayer);
        
        // Bosses become more aggressive when damaged
        const healthPercent = enemy.health / enemy.maxHealth;
        if (healthPercent < 0.5) {
          // Damaged UFO state - more erratic behavior
          enemy.velocity.x *= 1.3;
          enemy.velocity.y *= 1.3;
        }
      }
    });
  }

  private applyUFOMovementPattern(
    enemy: Enemy, 
    direction: Vector2, 
    baseSpeed: number, 
    pattern: string, 
    distanceToPlayer: number
  ): void {
    const time = Date.now() * 0.001;
    const perpDirection = { x: -direction.y, y: direction.x };
    
    switch (pattern) {
      case 'evasive':
        // Scout UFO - quick darting movements
        const dartDirection = Math.sin(time * 2 + enemy.id) > 0 ? 1 : -1;
        enemy.velocity.x = direction.x * baseSpeed + perpDirection.x * baseSpeed * 0.8 * dartDirection;
        enemy.velocity.y = direction.y * baseSpeed + perpDirection.y * baseSpeed * 0.8 * dartDirection;
        break;
        
      case 'aggressive':
        // Destroyer UFO - direct assault with slight weaving
        const weave = Math.sin(time * 1.5 + enemy.id) * 30;
        enemy.velocity.x = direction.x * baseSpeed + perpDirection.x * weave;
        enemy.velocity.y = direction.y * baseSpeed + perpDirection.y * weave;
        break;
        
      case 'deliberate':
        // Mothership - slow, steady approach
        enemy.velocity.x = direction.x * baseSpeed;
        enemy.velocity.y = direction.y * baseSpeed;
        break;
        
      case 'circling':
        // Harvester - tries to circle around the player
        const circleRadius = 150;
        if (distanceToPlayer > circleRadius) {
          // Move toward player if too far
          enemy.velocity.x = direction.x * baseSpeed;
          enemy.velocity.y = direction.y * baseSpeed;
        } else {
          // Circle around player
          const circleSpeed = baseSpeed * 0.8;
          enemy.velocity.x = perpDirection.x * circleSpeed;
          enemy.velocity.y = perpDirection.y * circleSpeed;
        }
        break;
        
      case 'unstoppable':
        // Dreadnought - slow but relentless advance
        const advance = distanceToPlayer > 100 ? baseSpeed : baseSpeed * 0.5;
        enemy.velocity.x = direction.x * advance;
        enemy.velocity.y = direction.y * advance;
        break;
        
      default:
        // Default chase behavior
        enemy.velocity.x = direction.x * baseSpeed;
        enemy.velocity.y = direction.y * baseSpeed;
        break;
    }
  }

  removeEnemies(indices: number[]): void {
    // Sort indices in descending order to remove from end first
    indices.sort((a, b) => b - a);
    indices.forEach(index => {
      if (index >= 0 && index < this.enemies.length) {
        this.enemies.splice(index, 1);
      }
    });
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }

  removeProjectiles(indices: number[]): void {
    indices.sort((a, b) => b - a);
    indices.forEach(index => {
      if (index >= 0 && index < this.projectiles.length) {
        this.projectiles.splice(index, 1);
      }
    });
  }
  clear(): void {
    this.enemies = [];
    this.projectiles = [];
    this.spawnTimer = 0;
    this.bossSpawnTimer = 0;
    this.bossesSpawned = 0;
  }
}