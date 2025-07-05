export interface Vector2 {
  x: number;
  y: number;
}

export interface GameState {
  score: number;
  wave: number;
  health: number;
  maxHealth: number;
  gameTime: number;
  isGameOver: boolean;
  isPaused: boolean;
  isWindowFocused: boolean;
}

export interface ChainSegment {
  pos: Vector2;
  oldPos: Vector2;
}

export interface SecondChain {
  segments: ChainSegment[];
  ball: Vector2;
  ballVelocity: Vector2;
  angle: number; // Current angle around player
  targetAngle: number; // Target angle for smooth rotation
}
export interface Enemy {
  id: number;
  pos: Vector2;
  velocity: Vector2;
  health: number;
  maxHealth: number;
  type: 'weak' | 'basic' | 'heavy' | 'fast' | 'triangle' | 'square' | 'boss' | 'ninja_star' | 'pusher';
  size: number;
  color: string;
  shape?: 'circle' | 'triangle' | 'square';
  lastShotTime?: number;
  shootCooldown?: number;
  projectileType?: 'single' | 'spread' | 'homing' | 'rapid';
  projectileCount?: number;
  projectileSpeedMultiplier?: number;
  minionSpawnCooldown?: number;
  lastMinionSpawnTime?: number;
  minionTypeToSpawn?: 'weak' | 'basic' | 'fast';
  bossAbilities?: string[];
  ufoType?: 'scout' | 'destroyer' | 'mothership' | 'harvester' | 'dreadnought';
  ufoPattern?: string;
  hoverOffset?: number; // For UFO hovering animation
  rotationAngle?: number; // For UFO rotation
  spinAngle?: number; // For ninja star rotation
  chainWrapped?: boolean; // For ninja star chain wrapping
  pushForce?: number; // For pusher enemy
  lastChainHitTime?: number; // For chain damage immunity
  hasEnteredPlayArea?: boolean; // For boundary bouncing
  isKnockedBack?: boolean; // For knockback physics
}

export interface Projectile {
  id: number;
  pos: Vector2;
  velocity: Vector2;
  size: number;
  color: string;
  damage: number;
  life: number;
}

export interface Particle {
  id: number;
  pos: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameConfig {
  chainLength: number;
  chainSegmentDistance: number;
  ballRadius: number;
  playerSize: number;
  pauseDelay: number;
  secondChainLength: number;
  secondChainDistance: number;
  secondBallRadius: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  chainLength: 10,
  chainSegmentDistance: 35,
  ballRadius: 25,
  playerSize: 18,
  pauseDelay: 3000,
  secondChainLength: 4,
  secondChainDistance: 25,
  secondBallRadius: 18,
};