import { Vector2, Enemy, ChainSegment, Projectile } from '../types/Game';
import { PlayerUpgrades, ActiveEffects } from '../types/PowerUps';
import { PhysicsEngine } from './PhysicsEngine';
import { ParticleSystem } from './ParticleSystem';

export class CollisionDetection {
  static checkBallEnemyCollisions(
    ball: Vector2,
    ballRadius: number,
    enemies: Enemy[],
    playerUpgrades: PlayerUpgrades,
    activeEffects: ActiveEffects,
    particleSystem: ParticleSystem,
    ballVelocity: Vector2
  ): { destroyedEnemies: number[], totalPoints: number, pushedEnemies: number[] } {
    const destroyedEnemies: number[] = [];
    const pushedEnemies: number[] = [];
    let totalPoints = 0;

    let ballDamageMultiplier = 2 + (playerUpgrades.ballDamage * 0.5); // Increased base damage from 1 to 2
    if (activeEffects.berserk) {
      ballDamageMultiplier *= activeEffects.berserk.damageMultiplier;
    }

    enemies.forEach((enemy, enemyIndex) => {
      const dist = PhysicsEngine.distance(ball, enemy.pos);
      if (dist < ballRadius + enemy.size) {
        // Special handling for pusher enemy
        if (enemy.type === 'pusher' && enemy.pushForce) {
          // Pusher deflects the ball instead of taking damage
          const pushDirection = PhysicsEngine.normalize({
            x: ball.x - enemy.pos.x,
            y: ball.y - enemy.pos.y,
          });
          
          // Apply strong push force to ball
          ballVelocity.x += pushDirection.x * enemy.pushForce;
          ballVelocity.y += pushDirection.y * enemy.pushForce;
          
          // Create push effect
          particleSystem.createExplosion(enemy.pos, '#ff6600');
          pushedEnemies.push(enemyIndex);
          
          // Pusher takes minimal damage
          enemy.health -= Math.ceil(damage * 0.2);
          
          if (enemy.health <= 0) {
            totalPoints += 30;
            particleSystem.createExplosion(enemy.pos, '#4488ff');
            destroyedEnemies.push(enemyIndex);
          }
          return; // Skip normal ball collision for this enemy
        }
        
        const damage = Math.ceil(ballDamageMultiplier);
        enemy.health -= damage;
        
        // Electric effect
        if (activeEffects.electrified) {
          // Create lightning bolts to nearby enemies
          const lightningTargets = enemies.filter((nearbyEnemy, nearbyIndex) => 
            nearbyIndex !== enemyIndex && PhysicsEngine.distance(enemy.pos, nearbyEnemy.pos) < 120
          );
          
          lightningTargets.forEach(target => {
            target.health -= Math.ceil(damage * 0.5);
            particleSystem.createLightningBolt(enemy.pos, target.pos);
            particleSystem.createExplosion(target.pos, '#ffff00');
          });
        }
        
        particleSystem.createExplosion(enemy.pos, enemy.color);
        
        // Add impact force to ball
        const impactDirection = PhysicsEngine.normalize({
          x: ball.x - enemy.pos.x,
          y: ball.y - enemy.pos.y,
        });
        
        // Reduce ball velocity loss on impact - more fluid motion
        const impactForce = enemy.health > 0 ? 80 : 100; // Less impact if enemy survives
        ballVelocity.x += impactDirection.x * impactForce;
        ballVelocity.y += impactDirection.y * impactForce;
        
        // Apply knockback force to enemy if it survives
        if (enemy.health > 0) {
          // Prevent boss knockback - bosses are immovable
          if (enemy.type !== 'boss') {
            const knockbackForce = 150 + (ballDamageMultiplier * 30);
            enemy.velocity.x += impactDirection.x * knockbackForce;
            enemy.velocity.y += impactDirection.y * knockbackForce;
            enemy.isKnockedBack = true;
          }
        }
        
        if (enemy.health <= 0) {
          let points = 20; // basic
          switch (enemy.type) {
            case 'weak': points = 5; break;
            case 'heavy': points = 50; break;
            case 'fast': points = 30; break;
            case 'triangle': points = 40; break;
            case 'square': points = 60; break;
            case 'boss': points = 200; break;
            case 'ninja_star': points = 25; break;
            case 'pusher': points = 30; break;
          }
          totalPoints += points;
          particleSystem.createExplosion(enemy.pos, '#4488ff');
          destroyedEnemies.push(enemyIndex);
        }
      }
    });

    return { destroyedEnemies, totalPoints, pushedEnemies };
  }

  static checkChainEnemyCollisions(
    chain: ChainSegment[],
    enemies: Enemy[],
    playerUpgrades: PlayerUpgrades,
    activeEffects: ActiveEffects,
    particleSystem: ParticleSystem,
    ballVelocity?: Vector2
  ): { destroyedEnemies: number[], totalPoints: number, chainWrappedEnemies: number[] } {
    const destroyedEnemies: number[] = [];
    const chainWrappedEnemies: number[] = [];
    let totalPoints = 0;
    const currentTime = Date.now();
    // Disable chain immunity during hyper spin for rapid hits
    const chainImmunityDuration = activeEffects.hyperSpin ? 0 : 75; // No immunity during hyper spin

    let chainDamageMultiplier = 1 + (playerUpgrades.chainDamage * 0.3);
    if (activeEffects.berserk) {
      chainDamageMultiplier *= activeEffects.berserk.damageMultiplier;
    }

    chain.forEach(segment => {
      enemies.forEach((enemy, enemyIndex) => {
        // Check chain damage immunity
        if (enemy.lastChainHitTime && (currentTime - enemy.lastChainHitTime) < chainImmunityDuration) {
          return; // Skip this enemy if still immune
        }
        
        // Special handling for ninja star - chain wrapping
        if (enemy.type === 'ninja_star' && !enemy.chainWrapped) {
          const dist = PhysicsEngine.distance(segment.pos, enemy.pos);
          if (dist < 15 + enemy.size) {
            // Chain wraps around ninja star, affecting momentum
            enemy.chainWrapped = true;
            chainWrappedEnemies.push(enemyIndex);
            
            // Create wrapping effect particles
            particleSystem.createExplosion(enemy.pos, '#888888');
            
            // Reduce ball velocity significantly if ballVelocity is provided
            if (ballVelocity) {
              ballVelocity.x *= 0.3;
              ballVelocity.y *= 0.3;
            }
            
            // Damage the ninja star
            enemy.health -= Math.ceil(chainDamageMultiplier);
            enemy.lastChainHitTime = currentTime;
            
            if (enemy.health <= 0) {
              totalPoints += 25; // Special points for ninja star
              particleSystem.createExplosion(enemy.pos, '#4488ff');
              destroyedEnemies.push(enemyIndex);
            }
            return; // Skip normal chain collision for this enemy
          }
        }
        
        const dist = PhysicsEngine.distance(segment.pos, enemy.pos);
        if (dist < 12 + enemy.size) {
          // Chain does reduced damage to heavy enemies but still damages them
          let damage = Math.ceil(chainDamageMultiplier);
          if (enemy.type === 'heavy') {
            damage = Math.ceil(damage * 0.15); // 15% damage to heavy enemies
          } else if (enemy.type === 'fast') {
            damage = Math.ceil(damage * 0.8); // 80% damage to fast enemies
          }
          
          enemy.health -= damage;
          enemy.lastChainHitTime = currentTime;
          particleSystem.createExplosion(enemy.pos, enemy.color);
          
          if (enemy.health <= 0) {
            let points = 8; // basic
            switch (enemy.type) {
              case 'weak': points = 3; break;
              case 'heavy': points = 15; break;
              case 'fast': points = 12; break;
              case 'triangle': points = 16; break;
              case 'square': points = 20; break;
              case 'boss': points = 50; break;
              case 'ninja_star': points = 25; break;
              case 'pusher': points = 30; break;
            }
            totalPoints += points;
            particleSystem.createExplosion(enemy.pos, '#4488ff');
            destroyedEnemies.push(enemyIndex);
          }
        }
      });
    });

    return { destroyedEnemies, totalPoints, chainWrappedEnemies };
  }

  static checkSecondChainEnemyCollisions(
    chain: ChainSegment[],
    enemies: Enemy[],
    playerUpgrades: PlayerUpgrades,
    activeEffects: ActiveEffects,
    particleSystem: ParticleSystem,
    ballVelocity?: Vector2
  ): { destroyedEnemies: number[], totalPoints: number, chainWrappedEnemies: number[] } {
    const destroyedEnemies: number[] = [];
    const chainWrappedEnemies: number[] = [];
    let totalPoints = 0;
    const currentTime = Date.now();
    // Disable chain immunity during hyper spin for rapid hits
    const chainImmunityDuration = activeEffects.hyperSpin ? 0 : 75; // No immunity during hyper spin

    // Second chain has different damage calculation
    let chainDamageMultiplier = 0.8 + (playerUpgrades.secondChainDamage * 0.4); // Slightly weaker base
    if (activeEffects.berserk) {
      chainDamageMultiplier *= activeEffects.berserk.damageMultiplier;
    }

    chain.forEach(segment => {
      enemies.forEach((enemy, enemyIndex) => {
        // Check chain damage immunity
        if (enemy.lastChainHitTime && (currentTime - enemy.lastChainHitTime) < chainImmunityDuration) {
          return;
        }
        
        const dist = PhysicsEngine.distance(segment.pos, enemy.pos);
        if (dist < 12 + enemy.size) {
          let damage = Math.ceil(chainDamageMultiplier);
          if (enemy.type === 'heavy') {
            damage = Math.ceil(damage * 0.15);
          } else if (enemy.type === 'fast') {
            damage = Math.ceil(damage * 0.8);
          }
          
          enemy.health -= damage;
          enemy.lastChainHitTime = currentTime;
          particleSystem.createExplosion(enemy.pos, '#9b59b6'); // Purple particles for second chain
          
          if (enemy.health <= 0) {
            let points = 6; // Slightly less than main chain
            switch (enemy.type) {
              case 'weak': points = 2; break;
              case 'heavy': points = 12; break;
              case 'fast': points = 10; break;
              case 'triangle': points = 14; break;
              case 'square': points = 18; break;
              case 'boss': points = 40; break;
              case 'ninja_star': points = 20; break;
              case 'pusher': points = 25; break;
            }
            totalPoints += points;
            particleSystem.createExplosion(enemy.pos, '#8e44ad');
            destroyedEnemies.push(enemyIndex);
          }
        }
      });
    });

    return { destroyedEnemies, totalPoints, chainWrappedEnemies };
  }

  static checkPlayerEnemyCollisions(
    player: Vector2,
    playerSize: number,
    enemies: Enemy[],
    activeEffects: ActiveEffects,
    particleSystem: ParticleSystem
  ): { damage: number, hitEnemies: number[] } {
    const hitEnemies: number[] = [];
    let totalDamage = 0;

    enemies.forEach((enemy, enemyIndex) => {
      const dist = PhysicsEngine.distance(player, enemy.pos);
      if (dist < playerSize + enemy.size) {
        let damage = 10; // basic
        switch (enemy.type) {
          case 'weak': damage = 5; break;
          case 'heavy': damage = 20; break;
          case 'fast': damage = 15; break;
          case 'triangle': damage = 18; break;
          case 'square': damage = 25; break;
          case 'boss': damage = 30; break;
          case 'ninja_star': damage = 12; break;
          case 'pusher': damage = 15; break;
        }
        
        if (activeEffects.berserk) {
          damage = Math.ceil(damage * activeEffects.berserk.vulnerabilityMultiplier);
        }
        
        totalDamage += damage;
        particleSystem.createExplosion(player, '#ff4444');
        
        // Only mark non-boss enemies for removal when they hit the player
        // Bosses should NOT be destroyed when they touch the player
        if (enemy.type !== 'boss') {
          hitEnemies.push(enemyIndex);
        }
      }
    });

    return { damage: totalDamage, hitEnemies };
  }

  static checkProjectilePlayerCollisions(
    player: Vector2,
    playerSize: number,
    projectiles: Projectile[],
    particleSystem: ParticleSystem
  ): { damage: number, hitProjectiles: number[] } {
    const hitProjectiles: number[] = [];
    let totalDamage = 0;

    projectiles.forEach((projectile, projectileIndex) => {
      const dist = PhysicsEngine.distance(player, projectile.pos);
      if (dist < playerSize + projectile.size) {
        totalDamage += projectile.damage;
        particleSystem.createExplosion(projectile.pos, projectile.color);
        hitProjectiles.push(projectileIndex);
      }
    });

    return { damage: totalDamage, hitProjectiles };
  }
}