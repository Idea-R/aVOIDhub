import { create } from 'zustand';
import type { GameState, GameMode, Difficulty, Word, Player, GameStats, GameSettings, DifficultyLevel, DigitAssaultChar } from '../types/game';
import { getRandomWord, getRandomSkillWord, getRandomDigitChar, getDifficultyLevelByWPM, difficultyConfigs, getRandomGeometricPattern } from '../data/words';
import { createLocalWordAvoidManifest, finishPlatformRun } from '../api/platformRuns';
import { calculateAccuracy, calculateWordScore, calculateWpm, TIME_ATTACK_DURATION_MS } from '../contracts/v1';
import {
  createWordAvoidPrompt,
  isWordAvoidV1Mode,
  normalizeWordAvoidInput,
  validateWordAvoidRun,
  type WordAvoidRunEvent,
  type WordAvoidRunEvidence,
  type WordAvoidRunManifest,
  type WordAvoidTerminalReason,
} from '@avoid/wordavoid-contract';

interface GameStore extends GameState {
  // Actions
  startGame: (mode: GameMode, manifest?: WordAvoidRunManifest | null) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (reason?: WordAvoidTerminalReason | 'quit') => void;
  resetGame: () => void;
  
  // Word management
  spawnWord: () => void;
  spawnDigitChar: () => void;
  spawnGeometricChallenge: () => void;
  updateWords: (deltaTime: number) => void;
  updateDigitChars: (deltaTime: number) => void;
  updateGeometricChallenges: (deltaTime: number) => void;
  typeCharacter: (char: string) => void;
  typeDigitCharacter: (char: string) => void;
  typeGeometricCharacter: (char: string) => void;
  completeWord: (wordId: string) => void;
  missWord: (wordId: string) => void;
  setCurrentTarget: (wordId: string | null) => void;
  updateTimeRemaining: () => void;
  
  // Player actions
  takeDamage: (amount: number) => void;
  addScore: (points: number) => void;
  updateStats: () => void;
  
  // Settings
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  
  // Statistics
  stats: GameStats;
  updateGameStats: () => void;
  loadPlayerStats: () => Promise<void>;
  savePlayerStats: () => Promise<void>;
  
  // Difficulty management
  updateDifficultyLevel: () => void;
  setDifficultyLevel: (level: DifficultyLevel) => void;
  shiftMode: boolean;
  toggleCapsMode: () => void;
}

const initialPlayer: Player = {
  health: 100,
  maxHealth: 100,
  shield: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  charactersAttempted: 0,
  charactersCorrect: 0,
  accuracy: 100,
  wpm: 0,
  position: { x: 0, y: 0 } // Will be set dynamically to screen center
};

const initialSettings: GameSettings = {
  audio: {
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    spatialAudio: true,
    dynamicMusic: true
  },
  graphics: {
    particles: true,
    screenShake: true,
    backgroundAnimation: true,
    reducedMotion: false
  },
  gameplay: {
    showWPM: true,
    showAccuracy: true,
    showNextWords: true,
    autoCapitalize: false
  }
};

const initialStats: GameStats = {
  totalGames: 0,
  totalWordsTyped: 0,
  totalCharactersTyped: 0,
  bestWPM: 0,
  bestAccuracy: 0,
  longestStreak: 0,
  totalPlaytime: 0,
  averageAccuracy: 0,
  improvementRate: 0
};

function wallElapsedMs(state: Pick<GameState, 'startTime'>, now = Date.now()): number {
  return Math.max(0, now - state.startTime);
}

function activeElapsedMs(
  state: Pick<GameState, 'startTime' | 'totalPausedMs' | 'pauseStartedAt'>,
  now = Date.now(),
): number {
  const currentPauseMs = state.pauseStartedAt === null ? 0 : Math.max(0, now - state.pauseStartedAt);
  return Math.max(0, wallElapsedMs(state, now) - state.totalPausedMs - currentPauseMs);
}

function activeElapsedAtWall(
  state: Pick<GameState, 'totalPausedMs'>,
  elapsedWallMs: number,
): number {
  return Math.max(0, elapsedWallMs - state.totalPausedMs);
}

function appendRunEvent(events: readonly WordAvoidRunEvent[], event: WordAvoidRunEvent): WordAvoidRunEvent[] {
  return [...events, event];
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  mode: 'classic',
  difficulty: 'easy',
  timeRemaining: undefined,
  wordsTyped: 0,
  wordsSpawned: 0,
  startTime: 0,
  currentWord: '',
  words: [],
  player: initialPlayer,
  level: 1,
  spawnRate: 2000, // milliseconds
  wordSpeed: 25, // pixels per second (slower for better gameplay)
  waveNumber: 1,
  skillType: undefined,
  screenShakeTrigger: 0,
  difficultyLevel: 'easy',
  digitChars: [],
  capsMode: false,
  shiftMode: false,
  geometricChallenges: [],
  runManifest: null,
  runEvents: [],
  pauseStartedAt: null,
  totalPausedMs: 0,
  settings: initialSettings,
  stats: initialStats,

  // Game control actions
  startGame: (mode: GameMode, suppliedManifest = null) => {
    const now = Date.now();
    const manifest = suppliedManifest ?? createLocalWordAvoidManifest(mode);
    set({
      isPlaying: true,
      isPaused: false,
      isGameOver: false,
      mode,
      startTime: now,
      wordsTyped: 0,
      wordsSpawned: 0,
      words: [],
      player: { ...initialPlayer },
      level: 1,
      waveNumber: 1,
      skillType: mode === 'skillTraining' ? 'doubleLetter' : undefined,
      difficultyLevel: 'easy',
      digitChars: [],
      capsMode: false,
      shiftMode: false,
      geometricChallenges: [],
      runManifest: manifest,
      runEvents: [],
      pauseStartedAt: null,
      totalPausedMs: 0,
      timeRemaining: mode === 'timeAttack' ? TIME_ATTACK_DURATION_MS : undefined
    });
  },

  pauseGame: () => {
    const state = get();
    if (!state.isPlaying || state.isPaused) return;
    const now = Date.now();
    const event: WordAvoidRunEvent = { type: 'pause', atMs: wallElapsedMs(state, now) };
    set({
      isPaused: true,
      pauseStartedAt: now,
      runEvents: state.runManifest ? appendRunEvent(state.runEvents, event) : state.runEvents,
    });
  },
  
  resumeGame: () => {
    const state = get();
    if (!state.isPlaying || !state.isPaused || state.pauseStartedAt === null) return;
    const now = Date.now();
    const event: WordAvoidRunEvent = { type: 'resume', atMs: wallElapsedMs(state, now) };
    set({
      isPaused: false,
      pauseStartedAt: null,
      totalPausedMs: state.totalPausedMs + Math.max(0, now - state.pauseStartedAt),
      runEvents: state.runManifest ? appendRunEvent(state.runEvents, event) : state.runEvents,
    });
  },
  
  endGame: (reason = 'quit') => {
    const state = get();
    if (!state.isPlaying || state.isGameOver) return;
    const competitiveFinish = reason === 'health' || reason === 'timer';
    const endedAt = Date.now();
    const currentPauseMs = state.pauseStartedAt === null ? 0 : Math.max(0, endedAt - state.pauseStartedAt);
    const finishEvent: WordAvoidRunEvent | null = competitiveFinish
      ? { type: 'finish', reason, atMs: wallElapsedMs(state, endedAt) }
      : null;
    set({
      isPlaying: false,
      isPaused: false,
      isGameOver: true,
      pauseStartedAt: null,
      totalPausedMs: state.totalPausedMs + currentPauseMs,
      runEvents: finishEvent && state.runManifest
        ? appendRunEvent(state.runEvents, finishEvent)
        : state.runEvents,
    });
    get().updateStats();
    get().updateGameStats();
    void get().savePlayerStats();
  },
  
  resetGame: () => set({
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    wordsTyped: 0,
    wordsSpawned: 0,
    words: [],
    level: 1,
    waveNumber: 1,
    currentWord: '',
    screenShakeTrigger: 0,
    difficultyLevel: 'easy',
    digitChars: [],
    capsMode: false,
    shiftMode: false,
    geometricChallenges: [],
    runManifest: null,
    runEvents: [],
    pauseStartedAt: null,
    totalPausedMs: 0,
    // Update player position to screen center
    player: { 
      ...initialPlayer, 
      position: { 
        x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400, 
        y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300 
      } 
    }
  }),

  // Word management
  spawnWord: () => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode === 'digitAssault') return;

    let wordData;
    const sequence = state.wordsSpawned;
    let promptId = `experimental-${Date.now()}-${Math.random()}`;
    let level = state.level;
    let angle = Math.random() * 2 * Math.PI;

    if (state.runManifest && isWordAvoidV1Mode(state.mode)) {
      const prompt = createWordAvoidPrompt(state.runManifest.seed, sequence);
      wordData = {
        text: prompt.text,
        difficulty: prompt.difficulty,
        category: 'competitive',
      };
      promptId = prompt.promptId;
      level = prompt.level;
      angle = (prompt.angleTurn / 65_536) * 2 * Math.PI;
    }
    
    else if (state.mode === 'skillTraining' && state.skillType) {
      // Use skill-specific words
      wordData = getRandomSkillWord(state.skillType);
    } else if (state.mode === 'waveDefense') {
      // Wave defense mode - difficulty based on wave number
      let difficulty: Difficulty = 'easy';
      if (state.waveNumber > 3) difficulty = 'medium';
      if (state.waveNumber > 6) difficulty = 'hard';
      if (state.waveNumber > 9) difficulty = 'extreme';
      if (state.waveNumber > 12) difficulty = 'boss';
      wordData = getRandomWord(difficulty);
    } else {
      // Standard difficulty progression
      let difficulty: Difficulty = 'easy';
      if (state.level > 10) difficulty = 'medium';
      if (state.level > 20) difficulty = 'hard';
      if (state.level > 30) difficulty = 'extreme';
      if (state.level > 40) difficulty = 'boss';
      wordData = getRandomWord(difficulty);
    }

    const spawnDistance = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const spawnedAt = Date.now();
    const spawnWallMs = wallElapsedMs(state, spawnedAt);
    
    const newWord: Word = {
      id: `word-${Date.now()}-${Math.random()}`,
      sequence,
      promptId,
      level,
      text: wordData.text,
      difficulty: wordData.difficulty,
      category: wordData.category,
      position: {
        x: centerX + Math.cos(angle) * spawnDistance,
        y: centerY + Math.sin(angle) * spawnDistance
      },
      angle,
      speed: state.wordSpeed + (level * 1.5),
      distance: spawnDistance,
      maxDistance: spawnDistance,
      isActive: true,
      isTyping: false,
      typedChars: 0,
      spawnTime: spawnedAt,
      spawnActiveMs: activeElapsedAtWall(state, spawnWallMs),
    };

    const spawnEvent: WordAvoidRunEvent = {
      type: 'spawn',
      sequence,
      promptId,
      atMs: spawnWallMs,
    };

    set(state => ({
      words: [...state.words, newWord],
      wordsSpawned: state.wordsSpawned + 1,
      runEvents: state.runManifest && isWordAvoidV1Mode(state.mode)
        ? appendRunEvent(state.runEvents, spawnEvent)
        : state.runEvents,
      // Increase level every 5 words spawned (faster progression)
      level,
      // For wave defense, increase wave every 5 words
      waveNumber: state.mode === 'waveDefense' ? Math.floor(state.wordsSpawned / 5) + 1 : state.waveNumber
    }));
    
    // Update difficulty level based on performance
    get().updateDifficultyLevel();
  },

  spawnDigitChar: () => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'digitAssault') return;

    const char = getRandomDigitChar(state.capsMode, state.shiftMode);
    const angle = Math.random() * 2 * Math.PI;
    const spawnDistance = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const difficultyConfig = difficultyConfigs[state.difficultyLevel];
    const baseSpeed = 30;
    const speed = baseSpeed * difficultyConfig.speedMultiplier + (state.level * 2);
    
    const newDigitChar: DigitAssaultChar = {
      id: `digit-${Date.now()}-${Math.random()}`,
      char,
      type: /[a-z]/.test(char) ? 'letter' : 
            /[A-Z]/.test(char) ? 'capital' :
            /[0-9]/.test(char) ? 'number' : 'symbol',
      position: {
        x: centerX + Math.cos(angle) * spawnDistance,
        y: centerY + Math.sin(angle) * spawnDistance
      },
      speed,
      spawnTime: Date.now(),
      isActive: true
    };

    set(state => ({
      digitChars: [...state.digitChars, newDigitChar],
      wordsSpawned: state.wordsSpawned + 1,
      level: Math.floor(state.wordsSpawned / 10) + 1
    }));
    
    get().updateDifficultyLevel();
  },

  spawnGeometricChallenge: () => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'geometricTyping') return;
    
    // Select pattern based on current difficulty level
    let patternDifficulty: Difficulty = 'easy';
    if (state.level > 15) patternDifficulty = 'extreme';
    else if (state.level > 10) patternDifficulty = 'hard';
    else if (state.level > 5) patternDifficulty = 'medium';
    
    const pattern = getRandomGeometricPattern(patternDifficulty);
    const angle = Math.random() * 2 * Math.PI;
    const spawnDistance = Math.min(window.innerWidth, window.innerHeight) * 0.4;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const newChallenge: GeometricChallenge = {
      id: `geometric-${Date.now()}-${Math.random()}`,
      pattern,
      currentStep: 0,
      completed: false,
      startTime: Date.now(),
      position: {
        x: centerX + Math.cos(angle) * spawnDistance,
        y: centerY + Math.sin(angle) * spawnDistance
      }
    };

    set(state => ({
      geometricChallenges: [...state.geometricChallenges, newChallenge],
      wordsSpawned: state.wordsSpawned + 1,
      level: Math.floor(state.wordsSpawned / 3) + 1 // Faster level progression for geometric mode
    }));
    
    get().updateDifficultyLevel();
  },

  updateWords: (deltaTime: number) => {
    const state = get();
    if (!state.isPlaying || state.isPaused) return;
    
    // Update time remaining for time attack mode
    if (state.mode === 'timeAttack' && state.timeRemaining !== undefined) {
      const newTimeRemaining = Math.max(0, state.timeRemaining - deltaTime);
      if (newTimeRemaining <= 0) {
        set({ timeRemaining: 0 });
        get().endGame('timer');
        return;
      }
      set({ timeRemaining: newTimeRemaining });
    }
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const updatedWords = state.words.map(word => {
      if (!word.isActive) return word;

      const newDistance = word.distance - (word.speed * deltaTime / 1000);
      return {
        ...word,
        distance: newDistance,
        position: {
          x: centerX + Math.cos(word.angle) * newDistance,
          y: centerY + Math.sin(word.angle) * newDistance
        }
      };
    });

    // Check for words that reached the center
    const wordsToRemove: string[] = [];
    updatedWords.forEach(word => {
      if (word.distance <= 60 && word.isActive) {
        wordsToRemove.push(word.id);
        get().missWord(word.id);
      }
    });

    set({ words: updatedWords.filter(word => !wordsToRemove.includes(word.id)) });
  },

  updateDigitChars: (deltaTime: number) => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'digitAssault') return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const updatedChars = state.digitChars.map(char => {
      if (!char.isActive) return char;

      // Calculate movement toward center
      const dx = centerX - char.position.x;
      const dy = centerY - char.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const moveDistance = char.speed * deltaTime / 1000;
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;
        
        return {
          ...char,
          position: {
            x: char.position.x + moveX,
            y: char.position.y + moveY
          }
        };
      }
      
      return char;
    });

    // Check for chars that reached the center
    const charsToRemove: string[] = [];
    updatedChars.forEach(char => {
      const dx = centerX - char.position.x;
      const dy = centerY - char.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 60 && char.isActive) {
        charsToRemove.push(char.id);
        // Take damage for missed character
        const difficultyConfig = difficultyConfigs[state.difficultyLevel];
        const damage = Math.round(5 * difficultyConfig.healthDamageMultiplier);
        get().takeDamage(damage);
      }
    });

    set({ digitChars: updatedChars.filter(char => !charsToRemove.includes(char.id)) });
  },

  updateGeometricChallenges: (deltaTime: number) => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'geometricTyping') return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const updatedChallenges = state.geometricChallenges.map(challenge => {
      if (challenge.completed) return challenge;

      // Calculate movement toward center
      const dx = centerX - challenge.position.x;
      const dy = centerY - challenge.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const moveDistance = 15 * deltaTime / 1000; // Slower movement for geometric challenges
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;
        
        return {
          ...challenge,
          position: {
            x: challenge.position.x + moveX,
            y: challenge.position.y + moveY
          }
        };
      }
      
      return challenge;
    });

    // Check for challenges that reached the center or timed out
    const challengesToRemove: string[] = [];
    updatedChallenges.forEach(challenge => {
      const dx = centerX - challenge.position.x;
      const dy = centerY - challenge.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeElapsed = Date.now() - challenge.startTime;
      
      if ((distance <= 80 && !challenge.completed) || timeElapsed > 20000) { // 20 second timeout
        challengesToRemove.push(challenge.id);
        // Take damage for missed challenge
        const difficultyConfig = difficultyConfigs[state.difficultyLevel];
        const damage = Math.round(15 * difficultyConfig.healthDamageMultiplier);
        get().takeDamage(damage);
      }
    });

    set({ geometricChallenges: updatedChallenges.filter(challenge => !challengesToRemove.includes(challenge.id)) });
  },

  typeCharacter: (char: string) => {
    const state = get();
    if (!state.isPlaying || state.isPaused) return;
    
    // Route to appropriate typing handler
    if (state.mode === 'digitAssault') {
      get().typeDigitCharacter(char);
      return;
    } else if (state.mode === 'geometricTyping') {
      get().typeGeometricCharacter(char);
      return;
    }

    const normalizedInput = isWordAvoidV1Mode(state.mode) ? normalizeWordAvoidInput(char) : char;
    if (!normalizedInput) return;

    // Find the currently targeted word or find a new one
    let targetWord = state.words.find(word => word.isTyping && word.isActive);
    
    if (!targetWord) {
      // Find the closest word that starts with this character
      const matchingWords = state.words.filter(word => 
        word.isActive && 
        word.typedChars === 0 && 
        word.text.toLowerCase().startsWith(normalizedInput.toLowerCase())
      );
      
      if (matchingWords.length > 0) {
        // Choose the closest word
        targetWord = matchingWords.reduce((closest, word) => 
          word.distance < closest.distance ? word : closest
        );
        
        // Set this as the current target
        get().setCurrentTarget(targetWord.id);
      }
    }

    const isCorrect = Boolean(
      targetWord && targetWord.text[targetWord.typedChars]?.toLowerCase() === normalizedInput.toLowerCase(),
    );
    const attemptWallMs = wallElapsedMs(state);
    const attemptEvent: WordAvoidRunEvent = {
      type: 'attempt',
      sequence: targetWord?.sequence ?? null,
      key: normalizedInput,
      atMs: attemptWallMs,
    };

    set(currentState => {
      const charactersAttempted = currentState.player.charactersAttempted + 1;
      const charactersCorrect = currentState.player.charactersCorrect + (isCorrect ? 1 : 0);
      return {
        player: {
          ...currentState.player,
          charactersAttempted,
          charactersCorrect,
          accuracy: calculateAccuracy(charactersCorrect, charactersAttempted),
        },
        runEvents: currentState.runManifest && isWordAvoidV1Mode(currentState.mode)
          ? appendRunEvent(currentState.runEvents, attemptEvent)
          : currentState.runEvents,
      };
    });

    // Check if the character matches the next expected character
    if (isCorrect && targetWord) {
      
      const updatedWords = state.words.map(word => {
        if (word.id === targetWord!.id) {
          const newTypedChars = word.typedChars + 1;
          const isComplete = newTypedChars >= word.text.length;
          
          if (isComplete) {
            // Complete the word
            return {
              ...word,
              typedChars: newTypedChars,
              isTyping: false,
              completedActiveMs: activeElapsedAtWall(state, attemptWallMs),
            };
          }
          
          return { ...word, typedChars: newTypedChars, isTyping: true };
        }
        return word;
      });

      set({ 
        words: updatedWords,
        currentWord: targetWord.text
      });
      const completedWord = updatedWords.find(word => word.id === targetWord!.id);
      if (completedWord?.completedActiveMs !== undefined) get().completeWord(completedWord.id);
    } else if (targetWord) {
      // Wrong character typed - reset the word
      const updatedWords = state.words.map(word => {
        if (word.id === targetWord!.id) {
          return { ...word, typedChars: 0, isTyping: false };
        }
        return word;
      });
      
      set({ 
        words: updatedWords,
        currentWord: ''
      });
    }

    get().updateStats();
  },

  typeDigitCharacter: (char: string) => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'digitAssault') return;

    // Find the closest matching character
    const matchingChars = state.digitChars.filter(digitChar => 
      digitChar.isActive && digitChar.char === char
    );

    set(currentState => {
      const charactersAttempted = currentState.player.charactersAttempted + 1;
      const charactersCorrect = currentState.player.charactersCorrect + (matchingChars.length > 0 ? 1 : 0);
      return {
        player: {
          ...currentState.player,
          charactersAttempted,
          charactersCorrect,
          accuracy: calculateAccuracy(charactersCorrect, charactersAttempted),
        },
      };
    });
    
    if (matchingChars.length > 0) {
      // Choose the closest character
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      const targetChar = matchingChars.reduce((closest, char) => {
        const closestDist = Math.sqrt(
          Math.pow(centerX - closest.position.x, 2) + 
          Math.pow(centerY - closest.position.y, 2)
        );
        const charDist = Math.sqrt(
          Math.pow(centerX - char.position.x, 2) + 
          Math.pow(centerY - char.position.y, 2)
        );
        return charDist < closestDist ? char : closest;
      });
      
      // Remove the character and award points
      const difficultyConfig = difficultyConfigs[state.difficultyLevel];
      const baseScore = targetChar.type === 'symbol' ? 25 : 
                       targetChar.type === 'capital' ? 15 : 10;
      const score = Math.round(baseScore * difficultyConfig.scoreMultiplier);
      
      // Create explosion effect
      if (typeof window !== 'undefined' && window.createExplosion) {
        const color = targetChar.type === 'symbol' ? '#ff0066' :
                     targetChar.type === 'capital' ? '#8b5cf6' :
                     targetChar.type === 'number' ? '#facc15' : '#00ff88';
        window.createExplosion(
          targetChar.position.x, 
          targetChar.position.y, 
          1,
          color
        );
      }
      
      set(state => ({
        digitChars: state.digitChars.filter(c => c.id !== targetChar.id),
        player: {
          ...state.player,
          score: state.player.score + score,
          streak: state.player.streak + 1,
          maxStreak: Math.max(state.player.maxStreak, state.player.streak + 1),
        },
        wordsTyped: state.wordsTyped + 1
      }));
      
      get().updateStats();
    }
  },

  typeGeometricCharacter: (char: string) => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'geometricTyping') return;

    // Find the closest active challenge
    const activeChallenges = state.geometricChallenges.filter(challenge => 
      !challenge.completed && challenge.currentStep < challenge.pattern.keys.length
    );
    
    if (activeChallenges.length === 0) return;
    
    // Find challenge that expects this character
    const targetChallenge = activeChallenges.find(challenge => 
      challenge.pattern.keys[challenge.currentStep]?.toLowerCase() === char.toLowerCase()
    );

    set(currentState => {
      const charactersAttempted = currentState.player.charactersAttempted + 1;
      const charactersCorrect = currentState.player.charactersCorrect + (targetChallenge ? 1 : 0);
      return {
        player: {
          ...currentState.player,
          charactersAttempted,
          charactersCorrect,
          accuracy: calculateAccuracy(charactersCorrect, charactersAttempted),
        },
      };
    });
    
    if (targetChallenge) {
      const newStep = targetChallenge.currentStep + 1;
      const isComplete = newStep >= targetChallenge.pattern.keys.length;
      
      if (isComplete) {
        // Complete the challenge
        const difficultyConfig = difficultyConfigs[state.difficultyLevel];
        const baseScore = {
          easy: 50,
          medium: 75,
          hard: 100,
          extreme: 150,
          boss: 200
        }[targetChallenge.pattern.difficulty];
        
        const timeBonus = Math.max(0, 100 - (Date.now() - targetChallenge.startTime) / 100);
        const totalScore = Math.round((baseScore + timeBonus) * difficultyConfig.scoreMultiplier);
        
        // Create explosion effect
        if (typeof window !== 'undefined' && window.createExplosion) {
          const color = {
            easy: '#4ade80',
            medium: '#facc15',
            hard: '#f97316',
            extreme: '#ef4444',
            boss: '#8b5cf6'
          }[targetChallenge.pattern.difficulty];
          
          window.createExplosion(
            targetChallenge.position.x, 
            targetChallenge.position.y, 
            targetChallenge.pattern.keys.length,
            color
          );
        }
        
        set(state => ({
          geometricChallenges: state.geometricChallenges.map(challenge =>
            challenge.id === targetChallenge.id 
              ? { ...challenge, completed: true, currentStep: newStep }
              : challenge
          ).filter(challenge => challenge.id !== targetChallenge.id), // Remove completed challenge
          player: {
            ...state.player,
            score: state.player.score + totalScore,
            streak: state.player.streak + 1,
            maxStreak: Math.max(state.player.maxStreak, state.player.streak + 1),
          },
          wordsTyped: state.wordsTyped + 1
        }));
        
        get().updateStats();
      } else {
        // Continue the pattern
        set(state => ({
          geometricChallenges: state.geometricChallenges.map(challenge =>
            challenge.id === targetChallenge.id 
              ? { ...challenge, currentStep: newStep }
              : challenge
          )
        }));
      }
    }
  },

  completeWord: (wordId: string) => {
    const state = get();
    const word = state.words.find(w => w.id === wordId);
    if (!word) return;
    
    // Create explosion effect
    if (typeof window !== 'undefined' && window.createExplosion) {
      window.createExplosion(
        word.position.x, 
        word.position.y, 
        word.text.length,
        '#00ff88'
      );
    }

    const totalScore = calculateWordScore({
      length: word.text.length,
      difficulty: word.difficulty,
      responseMs: (word.completedActiveMs ?? activeElapsedMs(state)) - word.spawnActiveMs,
      currentStreak: state.player.streak,
      level: word.level,
    });

    // Remove the completed word and update state
    set(state => ({
      player: {
        ...state.player,
        score: state.player.score + totalScore,
        streak: state.player.streak + 1,
        maxStreak: Math.max(state.player.maxStreak, state.player.streak + 1),
      },
      wordsTyped: state.wordsTyped + 1,
      words: state.words.filter(w => w.id !== wordId),
      currentWord: ''
    }));

    get().updateStats();
    
    // Auto-target next closest word after a brief delay
    setTimeout(() => {
      const currentState = get();
      const remainingWords = currentState.words.filter(w => w.isActive);
      
      if (remainingWords.length > 0) {
        const closestWord = remainingWords.reduce((closest, word) => 
          word.distance < closest.distance ? word : closest
        );
        get().setCurrentTarget(closestWord.id);
      }
    }, 100);
  },
  
  updateTimeRemaining: () => {
    const state = get();
    if (state.mode === 'timeAttack' && state.timeRemaining !== undefined && state.isPlaying && !state.isPaused) {
      const newTimeRemaining = Math.max(0, state.timeRemaining - 16); // Approximate 60fps
      if (newTimeRemaining <= 0) {
        set({ timeRemaining: 0 });
        get().endGame('timer');
      } else {
        set({ timeRemaining: newTimeRemaining });
      }
    }
  },

  setCurrentTarget: (wordId: string | null) => {
    set(state => ({
      words: state.words.map(word => ({
        ...word,
        isTyping: word.id === wordId
      })),
      currentWord: wordId ? state.words.find(w => w.id === wordId)?.text || '' : ''
    }));
  },

  missWord: (wordId: string) => {
    const state = get();
    const word = state.words.find(w => w.id === wordId);
    if (!word) return;

    const damage = {
      easy: 10,
      medium: 15,
      hard: 20,
      extreme: 25,
      boss: 30
    }[word.difficulty];

    const missEvent: WordAvoidRunEvent = {
      type: 'miss',
      sequence: word.sequence,
      atMs: wallElapsedMs(state),
    };
    
    set(state => ({
      player: {
        ...state.player,
        streak: 0
      },
      words: state.words.filter(w => w.id !== wordId),
      runEvents: state.runManifest && isWordAvoidV1Mode(state.mode)
        ? appendRunEvent(state.runEvents, missEvent)
        : state.runEvents,
    }));

    get().takeDamage(damage);
    
    // If this was the current target, find a new one
    if (word.isTyping) {
      setTimeout(() => {
        const currentState = get();
        const remainingWords = currentState.words.filter(w => w.isActive);
        
        if (remainingWords.length > 0) {
          const closestWord = remainingWords.reduce((closest, word) => 
            word.distance < closest.distance ? word : closest
          );
          get().setCurrentTarget(closestWord.id);
        }
      }, 100);
    }
  },

  takeDamage: (amount: number) => {
    const state = get();
    
    // Trigger screen shake if enabled
    if (state.settings.graphics.screenShake) {
      set(state => ({ screenShakeTrigger: state.screenShakeTrigger + 1 }));
    }
    
    let ended = false;
    set(state => {
      const newHealth = Math.max(0, state.player.health - amount);
      ended = newHealth <= 0;
      
      return {
        player: {
          ...state.player,
          health: newHealth
        }
      };
    });
    if (ended) get().endGame('health');
  },

  addScore: (points: number) => {
    set(state => ({
      player: {
        ...state.player,
        score: state.player.score + points
      }
    }));
  },

  updateStats: () => {
    const state = get();
    const activeDuration = activeElapsedMs(state);
    const wpm = calculateWpm(state.player.charactersCorrect, activeDuration);
    const accuracy = calculateAccuracy(state.player.charactersCorrect, state.player.charactersAttempted);

    set(state => ({
      player: {
        ...state.player,
        wpm,
        accuracy,
      }
    }));
  },

  updateSettings: (newSettings: Partial<GameSettings>) => {
    set(state => ({
      settings: {
        ...state.settings,
        ...newSettings
      }
    }));
  },

  updateGameStats: () => {
    const state = get();
    const gameTime = activeElapsedMs(state) / 1000;
    
    set(prevState => ({
      stats: {
        ...prevState.stats,
        totalGames: prevState.stats.totalGames + 1,
        totalWordsTyped: prevState.stats.totalWordsTyped + state.wordsTyped,
        bestWPM: Math.max(prevState.stats.bestWPM, state.player.wpm),
        bestAccuracy: Math.max(prevState.stats.bestAccuracy, state.player.accuracy),
        totalCharactersTyped: prevState.stats.totalCharactersTyped + state.player.charactersCorrect,
        longestStreak: Math.max(prevState.stats.longestStreak, state.player.maxStreak),
        totalPlaytime: prevState.stats.totalPlaytime + gameTime
      }
    }));
  },

  loadPlayerStats: async () => {
    try {
      // For now, use localStorage as fallback
      if (typeof localStorage === 'undefined') return;
      const savedStats = localStorage.getItem('wordavoid-stats');
      if (savedStats) {
        const stats = JSON.parse(savedStats);
        set({ stats });
      }
      
      // TODO: Implement Supabase loading when authentication is set up
      // const { data, error } = await supabase
      //   .from('player_stats')
      //   .select('*')
      //   .eq('user_id', 'placeholder-user-id')
      //   .single();
      
      // if (data && !error) {
      //   set({ stats: data });
      // }
    } catch (error) {
      console.error('Failed to load player stats:', error);
    }
  },

  savePlayerStats: async () => {
    try {
      const state = get();
      const { stats, mode } = state;

      // Save to localStorage as fallback
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wordavoid-stats', JSON.stringify(stats));
      }

      if (!state.runManifest || !isWordAvoidV1Mode(mode)) return;
      const evidence: WordAvoidRunEvidence = {
        runId: state.runManifest.runId,
        rulesetVersion: state.runManifest.rulesetVersion,
        dictionaryVersion: state.runManifest.dictionaryVersion,
        dictionaryHash: state.runManifest.dictionaryHash,
        normalizationVersion: state.runManifest.normalizationVersion,
        events: state.runEvents,
      };
      const validation = validateWordAvoidRun(state.runManifest, evidence);
      if (!validation.ok) return;
      await finishPlatformRun(validation.summary, {
        ...evidence,
        summary: validation.summary,
      });
    } catch (error) {
      console.error('Failed to save player stats:', error);
    }
  },
  
  updateDifficultyLevel: () => {
    const state = get();
    
    // Determine difficulty based on level progression (more predictable than WPM)
    let newDifficultyLevel: DifficultyLevel = 'easy';
    if (state.level >= 30) {
      newDifficultyLevel = 'insane';
    } else if (state.level >= 20) {
      newDifficultyLevel = 'expert';
    } else if (state.level >= 10) {
      newDifficultyLevel = 'normal';
    }
    
    // Also consider WPM as a secondary factor
    const wpmBasedDifficulty = getDifficultyLevelByWPM(state.player.wpm);
    
    // Use the higher of the two difficulty levels
    const difficultyOrder = ['easy', 'normal', 'expert', 'insane'];
    const levelBasedIndex = difficultyOrder.indexOf(newDifficultyLevel);
    const wpmBasedIndex = difficultyOrder.indexOf(wpmBasedDifficulty);
    const finalDifficultyIndex = Math.max(levelBasedIndex, wpmBasedIndex);
    newDifficultyLevel = difficultyOrder[finalDifficultyIndex] as DifficultyLevel;
    
    if (newDifficultyLevel !== state.difficultyLevel) {
      set({ difficultyLevel: newDifficultyLevel });
      
      // Update spawn rate and word speed based on new difficulty
      const difficultyConfig = difficultyConfigs[newDifficultyLevel];
      const baseSpawnRate = 2000;
      const baseWordSpeed = 25;
      
      set({
        spawnRate: Math.round(baseSpawnRate / difficultyConfig.spawnRateMultiplier),
        wordSpeed: baseWordSpeed * difficultyConfig.speedMultiplier
      });
    }
  },
  
  setDifficultyLevel: (level: DifficultyLevel) => {
    set({ difficultyLevel: level });
    
    // Update spawn rate and word speed based on new difficulty
    const difficultyConfig = difficultyConfigs[level];
    const baseSpawnRate = 2000;
    const baseWordSpeed = 25;
    
    set({
      spawnRate: Math.round(baseSpawnRate / difficultyConfig.spawnRateMultiplier),
      wordSpeed: baseWordSpeed * difficultyConfig.speedMultiplier
    });
  },
  
  toggleCapsMode: () => {
    set(state => ({ 
      capsMode: !state.capsMode,
      shiftMode: !state.capsMode // When caps mode is enabled, also enable shift mode for symbols
    }));
  }
}));
