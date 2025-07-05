export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme' | 'boss';

export type GameMode = 'classic' | 'timeAttack' | 'perfectRun' | 'dailyChallenge' | 'waveDefense' | 'skillTraining' | 'digitAssault' | 'geometricTyping';

export type DifficultyLevel = 'easy' | 'normal' | 'expert' | 'insane';

export type SkillWordType = 'doubleLetter' | 'pinky' | 'ringFinger' | 'handCoordination' | 'awkwardCombo';

export interface DigitAssaultChar {
  id: string;
  char: string;
  type: 'letter' | 'number' | 'symbol' | 'capital';
  position: { x: number; y: number };
  speed: number;
  spawnTime: number;
  isActive: boolean;
}

export interface GeometricPattern {
  id: string;
  name: string;
  keys: string[];
  shape: 'line' | 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';
  difficulty: Difficulty;
  description: string;
}

export interface GeometricChallenge {
  id: string;
  pattern: GeometricPattern;
  currentStep: number;
  completed: boolean;
  startTime: number;
  position: { x: number; y: number };
}

export interface Word {
  id: string;
  text: string;
  difficulty: Difficulty;
  category: string;
  position: {
    x: number;
    y: number;
  };
  angle: number;
  speed: number;
  distance: number;
  maxDistance: number;
  isActive: boolean;
  isTyping: boolean;
  typedChars: number;
  spawnTime: number;
}

export interface Player {
  health: number;
  maxHealth: number;
  shield: number;
  score: number;
  streak: number;
  accuracy: number;
  wpm: number;
  position: {
    x: number;
    y: number;
  };
}

export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  mode: GameMode;
  difficulty: Difficulty;
  timeRemaining?: number;
  wordsTyped: number;
  wordsSpawned: number;
  startTime: number;
  currentWord: string;
  words: Word[];
  player: Player;
  level: number;
  spawnRate: number;
  wordSpeed: number;
  waveNumber: number;
  skillType?: SkillWordType;
  screenShakeTrigger: number;
  difficultyLevel: DifficultyLevel;
  digitChars: DigitAssaultChar[];
  capsMode: boolean;
  shiftMode: boolean;
  geometricChallenges: GeometricChallenge[];
}

export interface GameStats {
  totalGames: number;
  totalWordsTyped: number;
  totalCharactersTyped: number;
  bestWPM: number;
  bestAccuracy: number;
  longestStreak: number;
  totalPlaytime: number;
  averageAccuracy: number;
  improvementRate: number;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  spatialAudio: boolean;
  dynamicMusic: boolean;
}

export interface GameSettings {
  audio: AudioSettings;
  graphics: {
    particles: boolean;
    screenShake: boolean;
    backgroundAnimation: boolean;
    reducedMotion: boolean;
  };
  gameplay: {
    showWPM: boolean;
    showAccuracy: boolean;
    showNextWords: boolean;
    autoCapitalize: boolean;
  };
}

export interface ParticleEffect {
  id: string;
  type: 'explosion' | 'trail' | 'spark' | 'glow';
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: Record<string, any>;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

export interface DifficultyConfig {
  spawnRate: number;
  wordSpeed: number;
  healthDamage: number;
  scoreMultiplier: number;
  wordPool: string[];
}