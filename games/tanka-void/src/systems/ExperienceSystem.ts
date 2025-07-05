import { Vector2 } from '../utils/Vector2.js';

export interface PlayerStats {
  level: number;
  experience: number;
  experienceToNext: number;
  totalExperience: number;
  skillPoints: number;
  
  // Core stats
  maxHealth: number;
  damage: number;
  speed: number;
  armor: number;
  fireRate: number;
  accuracy: number;
  
  // Special abilities
  abilities: Map<string, number>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  cost: number;
  effect: SkillEffect;
  icon: string;
  unlockLevel: number;
}

export interface SkillEffect {
  type: 'stat' | 'ability' | 'passive';
  target: string;
  value: number;
  multiplier?: number;
}

export class ExperienceSystem {
  private playerStats: PlayerStats;
  private skills: Map<string, Skill> = new Map();
  private floatingXP: FloatingXP[] = [];

  constructor() {
    this.playerStats = {
      level: 1,
      experience: 0,
      experienceToNext: 100,
      totalExperience: 0,
      skillPoints: 0,
      
      maxHealth: 100,
      damage: 1.0,
      speed: 1.0,
      armor: 0,
      fireRate: 1.0,
      accuracy: 1.0,
      
      abilities: new Map()
    };

    this.initializeSkills();
  }

  private initializeSkills(): void {
    const skillData: Skill[] = [
      {
        id: 'health_boost',
        name: 'Reinforced Hull',
        description: '+20 Max Health per level',
        maxLevel: 5,
        cost: 1,
        effect: { type: 'stat', target: 'maxHealth', value: 20 },
        icon: '🛡️',
        unlockLevel: 1
      },
      {
        id: 'damage_boost',
        name: 'High Explosive Rounds',
        description: '+15% Damage per level',
        maxLevel: 5,
        cost: 1,
        effect: { type: 'stat', target: 'damage', value: 0.15, multiplier: 1.15 },
        icon: '💥',
        unlockLevel: 2
      },
      {
        id: 'speed_boost',
        name: 'Turbo Engine',
        description: '+10% Speed per level',
        maxLevel: 3,
        cost: 1,
        effect: { type: 'stat', target: 'speed', value: 0.1, multiplier: 1.1 },
        icon: '⚡',
        unlockLevel: 3
      },
      {
        id: 'armor_plating',
        name: 'Reactive Armor',
        description: '+5 Armor per level',
        maxLevel: 4,
        cost: 2,
        effect: { type: 'stat', target: 'armor', value: 5 },
        icon: '🔰',
        unlockLevel: 4
      },
      {
        id: 'rapid_fire',
        name: 'Auto-Loader',
        description: '+20% Fire Rate per level',
        maxLevel: 3,
        cost: 2,
        effect: { type: 'stat', target: 'fireRate', value: 0.2, multiplier: 1.2 },
        icon: '🔥',
        unlockLevel: 5
      },
      {
        id: 'precision_targeting',
        name: 'Targeting Computer',
        description: '+10% Accuracy per level',
        maxLevel: 3,
        cost: 1,
        effect: { type: 'stat', target: 'accuracy', value: 0.1, multiplier: 1.1 },
        icon: '🎯',
        unlockLevel: 6
      },
      {
        id: 'regeneration',
        name: 'Auto-Repair System',
        description: 'Slowly regenerate health',
        maxLevel: 3,
        cost: 3,
        effect: { type: 'passive', target: 'regeneration', value: 1 },
        icon: '🔧',
        unlockLevel: 8
      },
      {
        id: 'multishot',
        name: 'Spread Shot',
        description: 'Fire multiple projectiles',
        maxLevel: 2,
        cost: 4,
        effect: { type: 'ability', target: 'multishot', value: 1 },
        icon: '🌟',
        unlockLevel: 10
      }
    ];

    skillData.forEach(skill => this.skills.set(skill.id, skill));
  }

  awardExperience(amount: number, position?: Vector2): void {
    this.playerStats.experience += amount;
    this.playerStats.totalExperience += amount;

    // Create floating XP text
    if (position) {
      this.floatingXP.push(new FloatingXP(position, amount));
    }

    // Check for level up
    while (this.playerStats.experience >= this.playerStats.experienceToNext) {
      this.levelUp();
    }

    // Dispatch XP gained event
    window.dispatchEvent(new CustomEvent('experienceGained', {
      detail: { amount, newTotal: this.playerStats.totalExperience }
    }));
  }

  private levelUp(): void {
    this.playerStats.experience -= this.playerStats.experienceToNext;
    this.playerStats.level++;
    this.playerStats.skillPoints += this.playerStats.level <= 10 ? 1 : 2; // More skill points at higher levels
    
    // Calculate next level XP requirement (exponential growth)
    this.playerStats.experienceToNext = Math.floor(100 * Math.pow(1.2, this.playerStats.level - 1));

    // Level up effects
    this.createLevelUpEffect();

    // Dispatch level up event
    window.dispatchEvent(new CustomEvent('levelUp', {
      detail: { 
        newLevel: this.playerStats.level, 
        skillPoints: this.playerStats.skillPoints 
      }
    }));
  }

  private createLevelUpEffect(): void {
    // Create dramatic level up particle effect
    window.dispatchEvent(new CustomEvent('levelUpEffect', {
      detail: { level: this.playerStats.level }
    }));
  }

  upgradeSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    const currentLevel = this.playerStats.abilities.get(skillId) || 0;
    
    // Check requirements
    if (currentLevel >= skill.maxLevel) return false;
    if (this.playerStats.skillPoints < skill.cost) return false;
    if (this.playerStats.level < skill.unlockLevel) return false;

    // Spend skill points
    this.playerStats.skillPoints -= skill.cost;
    
    // Upgrade skill
    this.playerStats.abilities.set(skillId, currentLevel + 1);
    
    // Apply skill effect
    this.applySkillEffect(skill, currentLevel + 1);

    return true;
  }

  private applySkillEffect(skill: Skill, level: number): void {
    const effect = skill.effect;
    
    switch (effect.type) {
      case 'stat':
        if (effect.multiplier) {
          // Multiplicative bonus
          const currentValue = (this.playerStats as any)[effect.target];
          (this.playerStats as any)[effect.target] = currentValue * Math.pow(effect.multiplier, level);
        } else {
          // Additive bonus
          (this.playerStats as any)[effect.target] += effect.value * level;
        }
        break;
        
      case 'ability':
        // Special abilities handled elsewhere
        break;
        
      case 'passive':
        // Passive effects handled in game loop
        break;
    }
  }

  updateFloatingXP(deltaTime: number): void {
    for (let i = this.floatingXP.length - 1; i >= 0; i--) {
      const xp = this.floatingXP[i];
      xp.update(deltaTime);
      
      if (xp.lifetime <= 0) {
        this.floatingXP.splice(i, 1);
      }
    }
  }

  renderFloatingXP(ctx: CanvasRenderingContext2D): void {
    this.floatingXP.forEach(xp => xp.render(ctx));
  }

  getPlayerStats(): PlayerStats {
    return { ...this.playerStats };
  }

  getAvailableSkills(): Skill[] {
    return Array.from(this.skills.values())
      .filter(skill => this.playerStats.level >= skill.unlockLevel);
  }

  getSkillLevel(skillId: string): number {
    return this.playerStats.abilities.get(skillId) || 0;
  }

  hasAbility(abilityId: string): boolean {
    return this.getSkillLevel(abilityId) > 0;
  }

  // Calculate XP rewards based on enemy type and difficulty
  static calculateXPReward(enemyType: string, playerLevel: number): number {
    const baseXP = {
      'infantry': 5,
      'scout': 15,
      'heavy': 25,
      'artillery': 30,
      'boss': 100
    };

    const base = baseXP[enemyType as keyof typeof baseXP] || 10;
    const levelMultiplier = 1 + (playerLevel - 1) * 0.1; // Slightly more XP at higher levels
    
    return Math.floor(base * levelMultiplier);
  }
}

class FloatingXP {
  public position: Vector2;
  public velocity: Vector2;
  public lifetime: number = 2.0;
  public maxLifetime: number = 2.0;
  public amount: number;
  public color: string;

  constructor(position: Vector2, amount: number) {
    this.position = position.clone();
    this.amount = amount;
    this.velocity = new Vector2((Math.random() - 0.5) * 50, -50 - Math.random() * 30);
    
    // Color based on XP amount
    if (amount >= 50) {
      this.color = '#FFD700'; // Gold for high XP
    } else if (amount >= 20) {
      this.color = '#FF6B35'; // Orange for medium XP
    } else {
      this.color = '#00FF00'; // Green for low XP
    }
  }

  update(deltaTime: number): void {
    this.position = this.position.add(this.velocity.multiply(deltaTime));
    this.velocity.y += 20 * deltaTime; // Gravity
    this.velocity = this.velocity.multiply(0.98); // Air resistance
    this.lifetime -= deltaTime;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.lifetime <= 0) return;

    ctx.save();
    
    const alpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = alpha;
    
    // Glow effect
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = this.color;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`+${this.amount} XP`, this.position.x, this.position.y);
    
    ctx.restore();
  }
}