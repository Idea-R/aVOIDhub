export interface PowerUp {
  id: number;
  type: 'permanent' | 'temporary';
  category: string;
  name: string;
  pos: Vector2;
  velocity: Vector2;
  size: number;
  color: string;
  rarity: 'common' | 'rare' | 'very_rare';
  duration?: number; // For temporary power-ups
  effect: PowerUpEffect;
}

export interface PowerUpEffect {
  chainDamage?: number;
  ballDamage?: number;
  healthIncrease?: number;
  speedBoost?: number;
  ballSizeIncrease?: number;
  berserkDamage?: number;
  berserkVulnerability?: number;
  tempSpeedBoost?: number;
  electrified?: boolean;
  hyperSpin?: boolean;
  chainExtension?: boolean;
  secondChain?: boolean;
  secondChainDamage?: number;
  secondChainSpeed?: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerUpgrades {
  chainDamage: number; // 0-3
  ballDamage: number; // 0-3
  healthIncrease: number; // Number of health increases
  speedBoost: number; // 0-3
  ballSize: number; // 0-2
  chainExtensions: number; // 0-2 (adds 3 links each)
  hasSecondChain: boolean;
  secondChainDamage: number; // 0-3
  secondChainSpeed: number; // 0-2
}

export interface ActiveEffects {
  berserk?: {
    damageMultiplier: number;
    vulnerabilityMultiplier: number;
    endTime: number;
  };
  tempSpeed?: {
    speedMultiplier: number;
    endTime: number;
  };
  electrified?: {
    endTime: number;
  };
  hyperSpin?: {
    endTime: number;
  };
}