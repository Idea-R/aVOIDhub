import { PowerUp, PowerUpEffect, Vector2, PlayerUpgrades } from '../../types/PowerUps';

export class PowerUpManager {
  private powerUps: PowerUp[] = [];
  private nextPowerUpId = 0;
  private spawnTimer = 0;
  private spawnRate = 15000; // 15 seconds base spawn rate

  spawnPowerUp(canvasWidth: number, canvasHeight: number, wave: number, playerUpgrades: PlayerUpgrades): void {
    // Determine rarity based on wave and random chance - slightly increased spawn rates
    const rarityRoll = Math.random();
    let rarity: 'common' | 'rare' | 'very_rare';
    
    // Adjusted rarity probabilities - increased spawn rates
    if (rarityRoll < 0.08 + (wave * 0.008)) { // 8% + 0.8% per wave, max ~16%
      rarity = 'very_rare';
    } else if (rarityRoll < 0.25 + (wave * 0.015)) { // 25% + 1.5% per wave, max ~40%
      rarity = 'rare';
    } else {
      rarity = 'common';
    }

    // Determine type (40% permanent, 60% temporary)
    const isPermanent = Math.random() < 0.4;
    
    let powerUpData;
    if (isPermanent) {
      powerUpData = this.generatePermanentPowerUp(rarity, playerUpgrades);
    } else {
      powerUpData = this.generateTemporaryPowerUp(rarity);
    }

    // Spawn at random edge
    const side = Math.floor(Math.random() * 4);
    let pos: Vector2;
    let velocity: Vector2;

    switch (side) {
      case 0: // top
        pos = { x: Math.random() * canvasWidth, y: -50 };
        velocity = { x: (Math.random() - 0.5) * 40, y: 30 };
        break;
      case 1: // right
        pos = { x: canvasWidth + 50, y: Math.random() * canvasHeight };
        velocity = { x: -30, y: (Math.random() - 0.5) * 40 };
        break;
      case 2: // bottom
        pos = { x: Math.random() * canvasWidth, y: canvasHeight + 50 };
        velocity = { x: (Math.random() - 0.5) * 40, y: -30 };
        break;
      default: // left
        pos = { x: -50, y: Math.random() * canvasHeight };
        velocity = { x: 30, y: (Math.random() - 0.5) * 40 };
        break;
    }

    this.powerUps.push({
      id: this.nextPowerUpId++,
      pos,
      velocity,
      size: 20,
      rarity,
      ...powerUpData,
    });
  }

  private generatePermanentPowerUp(rarity: 'common' | 'rare' | 'very_rare', playerUpgrades: PlayerUpgrades) {
    const permanentTypes = {
      common: [
        {
          category: 'health',
          name: 'Healing Heart',
          color: '#4ecdc4',
          effect: { healthIncrease: 15 }
        },
        {
          category: 'health',
          name: 'Health Boost',
          color: '#4ecdc4',
          effect: { healthIncrease: 25 }
        },
        {
          category: 'speed',
          name: 'Speed Boost',
          color: '#45b7d1',
          effect: { speedBoost: 1 }
        }
      ],
      rare: [
        {
          category: 'damage',
          name: 'Ball Spikes',
          color: '#ff8c42',
          effect: { ballDamage: 1 }
        },
        {
          category: 'damage',
          name: 'Chain Spikes',
          color: '#ff6b6b',
          effect: { chainDamage: 1 }
        },
        {
          category: 'health',
          name: 'Major Health Boost',
          color: '#4ecdc4',
          effect: { healthIncrease: 50 }
        },
        {
          category: 'speed',
          name: 'Major Speed Boost',
          color: '#45b7d1',
          effect: { speedBoost: 2 }
        },
        {
          category: 'size',
          name: 'Ball Growth',
          color: '#f9ca24',
          effect: { ballSizeIncrease: 1 }
        },
        {
          category: 'chain',
          name: 'Chain Extension',
          color: '#888888',
          effect: { chainExtension: true }
        }
      ],
      very_rare: [
        {
          category: 'damage',
          name: 'Mega Spikes',
          color: '#e74c3c',
          effect: { chainDamage: 2, ballDamage: 2 }
        },
        {
          category: 'chain',
          name: 'Second Chain',
          color: '#9b59b6',
          effect: { secondChain: true }
        },
        {
          category: 'chain',
          name: 'Chain Mastery',
          color: '#8e44ad',
          effect: { secondChainDamage: 1 }
        },
        {
          category: 'chain',
          name: 'Chain Velocity',
          color: '#6c5ce7',
          effect: { secondChainSpeed: 1 }
        }
      ]
    };

    let options = permanentTypes[rarity];

    // Handle Mega Spikes condition - only available if both ball and chain damage are maxed
    if (rarity === 'very_rare') {
      const megaSpikesAvailable = playerUpgrades.ballDamage >= 3 && playerUpgrades.chainDamage >= 3;
      const secondChainAvailable = playerUpgrades.chainExtensions >= 2; // Need max extensions first
      const chainMasteryAvailable = playerUpgrades.hasSecondChain && playerUpgrades.secondChainDamage < 3;
      const chainVelocityAvailable = playerUpgrades.hasSecondChain && playerUpgrades.secondChainSpeed < 2;
      
      // Filter available options based on conditions
      options = options.filter(option => {
        if (option.name === 'Mega Spikes') return megaSpikesAvailable;
        if (option.name === 'Second Chain') return secondChainAvailable;
        if (option.name === 'Chain Mastery') return chainMasteryAvailable;
        if (option.name === 'Chain Velocity') return chainVelocityAvailable;
        return true;
      });
      
      if (!megaSpikesAvailable) {
        // If Mega Spikes not available, fall back to rare options
        options = [...options, ...permanentTypes.rare];
      }
    }
    
    // Handle chain extension availability
    if (rarity === 'rare') {
      options = options.filter(option => {
        if (option.name === 'Chain Extension') return playerUpgrades.chainExtensions < 2;
        return true;
      });
    }
    
    // Fallback to common if no other options are available
    if (options.length === 0) {
      options = permanentTypes.common;
    }

    const selected = options[Math.floor(Math.random() * options.length)];

    return {
      type: 'permanent' as const,
      ...selected
    };
  }

  private generateTemporaryPowerUp(rarity: 'common' | 'rare' | 'very_rare') {
    const temporaryTypes = {
      common: [
        {
          category: 'speed',
          name: 'Speed Burst',
          color: '#74b9ff',
          duration: 5000,
          effect: { tempSpeedBoost: 2.0 }
        }
      ],
      rare: [
        {
          category: 'berserk',
          name: 'Berserk Mode',
          color: '#fd79a8',
          duration: 8000,
          effect: { berserkDamage: 3.0, berserkVulnerability: 1.5 }
        },
        {
          category: 'electric',
          name: 'Electric Ball',
          color: '#fdcb6e',
          duration: 12000,
          effect: { electrified: true }
        }
      ],
      very_rare: [
        {
          category: 'spin',
          name: 'Hyper Spin',
          color: '#a29bfe',
          duration: 10000,
          effect: { hyperSpin: true }
        }
      ]
    };

    const options = temporaryTypes[rarity];
    const selected = options[Math.floor(Math.random() * options.length)];

    return {
      type: 'temporary' as const,
      ...selected
    };
  }

  update(deltaTime: number, canvasWidth: number, canvasHeight: number, wave: number, playerUpgrades: PlayerUpgrades): void {
    // Update spawn timer
    this.spawnTimer += deltaTime;
    const adjustedSpawnRate = Math.max(this.spawnRate - (wave * 1000), 8000); // Faster spawning with higher waves
    
    if (this.spawnTimer >= adjustedSpawnRate) {
      this.spawnPowerUp(canvasWidth, canvasHeight, wave, playerUpgrades);
      this.spawnTimer = 0;
    }

    // Update power-up positions
    const dt = deltaTime / 1000;
    this.powerUps.forEach(powerUp => {
      powerUp.pos.x += powerUp.velocity.x * dt;
      powerUp.pos.y += powerUp.velocity.y * dt;
      
      // Apply slight gravity/drift toward center
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const driftForce = 10;
      
      if (powerUp.pos.x < centerX) powerUp.velocity.x += driftForce * dt;
      else powerUp.velocity.x -= driftForce * dt;
      
      if (powerUp.pos.y < centerY) powerUp.velocity.y += driftForce * dt;
      else powerUp.velocity.y -= driftForce * dt;
      
      // Apply damping
      powerUp.velocity.x *= 0.99;
      powerUp.velocity.y *= 0.99;
    });

    // Remove off-screen power-ups
    this.powerUps = this.powerUps.filter(powerUp => {
      return powerUp.pos.x > -100 && powerUp.pos.x < canvasWidth + 100 &&
             powerUp.pos.y > -100 && powerUp.pos.y < canvasHeight + 100;
    });
  }

  checkCollisions(playerPos: Vector2, playerSize: number): PowerUp | null {
    for (let i = 0; i < this.powerUps.length; i++) {
      const powerUp = this.powerUps[i];
      const dx = playerPos.x - powerUp.pos.x;
      const dy = playerPos.y - powerUp.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < playerSize + powerUp.size) {
        // Remove the collected power-up
        this.powerUps.splice(i, 1);
        return powerUp;
      }
    }
    return null;
  }

  getPowerUps(): PowerUp[] {
    return this.powerUps;
  }

  clear(): void {
    this.powerUps = [];
    this.spawnTimer = 0;
  }

  spawnSpecificPowerUp(
    pos: Vector2, 
    canvasWidth: number, 
    canvasHeight: number, 
    playerUpgrades: PlayerUpgrades, 
    type: 'permanent' | 'temporary', 
    rarity: 'common' | 'rare' | 'very_rare'
  ): void {
    let powerUpData;
    if (type === 'permanent') {
      powerUpData = this.generatePermanentPowerUp(rarity, playerUpgrades);
    } else {
      powerUpData = this.generateTemporaryPowerUp(rarity);
    }

    // Spawn at the specified position with minimal velocity
    const velocity: Vector2 = {
      x: (Math.random() - 0.5) * 20,
      y: (Math.random() - 0.5) * 20,
    };

    this.powerUps.push({
      id: this.nextPowerUpId++,
      pos: { ...pos },
      velocity,
      size: 25, // Slightly larger for boss drops
      rarity,
      ...powerUpData,
    });
  }

  spawnBossPowerUp(pos: Vector2, canvasWidth: number, canvasHeight: number, playerUpgrades: PlayerUpgrades): void {
    // Boss drops are always permanent and have higher rarity chances
    const rarityRoll = Math.random();
    let rarity: 'common' | 'rare' | 'very_rare';
    
    // Boss drops have much better rarity distribution
    if (rarityRoll < 0.3) { // 30% chance for very rare
      rarity = 'very_rare';
    } else if (rarityRoll < 0.7) { // 40% chance for rare
      rarity = 'rare';
    } else { // 30% chance for common
      rarity = 'common';
    }

    this.spawnSpecificPowerUp(pos, canvasWidth, canvasHeight, playerUpgrades, 'permanent', rarity);
  }
}