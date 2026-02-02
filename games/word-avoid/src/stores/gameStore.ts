import { create } from 'zustand';
import type { GameState, GameMode, Difficulty, Word, Player, GameStats, GameSettings, SkillWordType, DifficultyLevel, DigitAssaultChar } from '../types/game';
import { getRandomWord, getRandomSkillWord, getRandomDigitChar, getDifficultyLevelByWPM, difficultyConfigs, getRandomGeometricPattern } from '../data/words';
import { supabase } from '../main';
import { LeaderboardAPI } from '../api/leaderboard';

interface GameStore extends GameState {
  // Actions
  startGame: (mode: GameMode) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
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
  settings: initialSettings,
  stats: initialStats,

  // Game control actions
  startGame: (mode: GameMode) => {
    const now = Date.now();
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
      timeRemaining: mode === 'timeAttack' ? 120000 : undefined // 2 minutes for time attack
    });
  },

  pauseGame: () => set({ isPaused: true }),
  
  resumeGame: () => set({ isPaused: false }),
  
  endGame: () => {
    set({ isPlaying: false, isGameOver: true });
    get().updateGameStats();
    get().savePlayerStats();
  },
  
  resetGame: () => set({
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    wordsTyped: 0,
    wordsSpawned: 0,
    words: [],
    player: { ...initialPlayer },
    level: 1,
    waveNumber: 1,
    currentWord: '',
    screenShakeTrigger: 0,
    difficultyLevel: 'easy',
    digitChars: [],
    capsMode: false,
    shiftMode: false,
    geometricChallenges: [],
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
    
    if (state.mode === 'skillTraining' && state.skillType) {
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

    const angle = Math.random() * 2 * Math.PI;
    const spawnDistance = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const newWord: Word = {
      id: `word-${Date.now()}-${Math.random()}`,
      text: wordData.text,
      difficulty: wordData.difficulty,
      category: wordData.category,
      position: {
        x: centerX + Math.cos(angle) * spawnDistance,
        y: centerY + Math.sin(angle) * spawnDistance
      },
      angle,
      speed: state.wordSpeed + (state.level * 1.5),
      distance: spawnDistance,
      maxDistance: spawnDistance,
      isActive: true,
      isTyping: false,
      typedChars: 0,
      spawnTime: Date.now()
    };

    set(state => ({
      words: [...state.words, newWord],
      wordsSpawned: state.wordsSpawned + 1,
      // Increase level every 5 words spawned (faster progression)
      level: Math.floor(state.wordsSpawned / 5) + 1,
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
    
    const difficultyConfig = difficultyConfigs[state.difficultyLevel];
    const baseSpeed = 20; // Slower for geometric challenges
    const speed = baseSpeed * difficultyConfig.speedMultiplier + (state.level * 1);
    
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
        get().endGame();
        return;
      }
      set({ timeRemaining: newTimeRemaining });
    }
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const updatedWords = state.words.map(word => {
      if (!word.isActive) return word;

      const newDistance = word.distance - (word.speed * deltaTime / 1000);
      const progress = 1 - (newDistance / word.maxDistance);
      
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

    // Find the currently targeted word or find a new one
    let targetWord = state.words.find(word => word.isTyping && word.isActive);
    
    if (!targetWord) {
      // Find the closest word that starts with this character
      const matchingWords = state.words.filter(word => 
        word.isActive && 
        word.typedChars === 0 && 
        word.text.toLowerCase().startsWith(char.toLowerCase())
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

    // Check if the character matches the next expected character
    if (targetWord && 
        targetWord.text[targetWord.typedChars]?.toLowerCase() === char.toLowerCase()) {
      
      const updatedWords = state.words.map(word => {
        if (word.id === targetWord!.id) {
          const newTypedChars = word.typedChars + 1;
          const isComplete = newTypedChars >= word.text.length;
          
          if (isComplete) {
            // Complete the word
            setTimeout(() => get().completeWord(word.id), 50);
            return { ...word, typedChars: newTypedChars, isTyping: false };
          }
          
          return { ...word, typedChars: newTypedChars, isTyping: true };
        }
        return word;
      });

      set({ 
        words: updatedWords,
        currentWord: targetWord.text
      });
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
  },

  typeDigitCharacter: (char: string) => {
    const state = get();
    if (!state.isPlaying || state.isPaused || state.mode !== 'digitAssault') return;

    // Find the closest matching character
    const matchingChars = state.digitChars.filter(digitChar => 
      digitChar.isActive && digitChar.char === char
    );
    
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
      if (typeof window !== 'undefined' && (window as any).createExplosion) {
        const color = targetChar.type === 'symbol' ? '#ff0066' :
                     targetChar.type === 'capital' ? '#8b5cf6' :
                     targetChar.type === 'number' ? '#facc15' : '#00ff88';
        (window as any).createExplosion(
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
          streak: state.player.streak + 1
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
        if (typeof window !== 'undefined' && (window as any).createExplosion) {
          const color = {
            easy: '#4ade80',
            medium: '#facc15',
            hard: '#f97316',
            extreme: '#ef4444',
            boss: '#8b5cf6'
          }[targetChallenge.pattern.difficulty];
          
          (window as any).createExplosion(
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
            streak: state.player.streak + 1
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
    if (typeof window !== 'undefined' && (window as any).createExplosion) {
      (window as any).createExplosion(
        word.position.x, 
        word.position.y, 
        word.text.length,
        '#00ff88'
      );
    }

    // Calculate score based on word difficulty and speed
    const baseScore = word.text.length * 10;
    const difficultyMultiplier = {
      easy: 1,
      medium: 1.5,
      hard: 2,
      extreme: 3,
      boss: 5
    }[word.difficulty];
    
    const timeBonus = Math.max(0, 100 - (Date.now() - word.spawnTime) / 100);
    const streakBonus = state.player.streak * 5;
    
    const levelBonus = state.level * 10;
    const totalScore = Math.round((baseScore + timeBonus + streakBonus + levelBonus) * difficultyMultiplier);

    // Remove the completed word and update state
    set(state => ({
      player: {
        ...state.player,
        score: state.player.score + totalScore,
        streak: state.player.streak + 1
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
        get().endGame();
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

    get().takeDamage(damage);
    
    set(state => ({
      player: {
        ...state.player,
        streak: 0
      },
      words: state.words.filter(w => w.id !== wordId)
    }));
    
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
    
    set(state => {
      const newHealth = Math.max(0, state.player.health - amount);
      const isGameOver = newHealth <= 0;
      
      if (isGameOver) {
        get().endGame();
      }
      
      return {
        player: {
          ...state.player,
          health: newHealth
        },
        isGameOver
      };
    });
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
    const currentTime = Date.now();
    const gameTime = (currentTime - state.startTime) / 1000; // seconds
    const totalChars = state.wordsTyped * 5; // Approximate characters
    
    // Calculate WPM (words per minute)
    const wpm = gameTime > 0 ? Math.round((state.wordsTyped / gameTime) * 60) : 0;
    
    // Calculate accuracy (improved formula)
    const totalAttempts = state.wordsTyped + Math.max(0, state.wordsSpawned - state.wordsTyped);
    const accuracy = totalAttempts > 0 ? Math.round((state.wordsTyped / totalAttempts) * 100) : 100;

    set(state => ({
      player: {
        ...state.player,
        wpm,
        accuracy: Math.max(accuracy, 60) // Minimum 60% to avoid discouragement
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
    const gameTime = (Date.now() - state.startTime) / 1000;
    
    set(prevState => ({
      stats: {
        ...prevState.stats,
        totalGames: prevState.stats.totalGames + 1,
        totalWordsTyped: prevState.stats.totalWordsTyped + state.wordsTyped,
        bestWPM: Math.max(prevState.stats.bestWPM, state.player.wpm),
        bestAccuracy: Math.max(prevState.stats.bestAccuracy, state.player.accuracy),
        longestStreak: Math.max(prevState.stats.longestStreak, state.player.streak),
        totalPlaytime: prevState.stats.totalPlaytime + gameTime
      }
    }));
  },

  loadPlayerStats: async () => {
    try {
      // For now, use localStorage as fallback
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
      const { stats, player, mode, level, wordsTyped } = state;

      // Save to localStorage as fallback
      localStorage.setItem('wordavoid-stats', JSON.stringify(stats));

      // Submit score to leaderboard if score > 0
      if (player.score > 0) {
        const metadata = {
          wpm: player.wpm,
          accuracy: player.accuracy,
          words_typed: wordsTyped,
          mode: mode,
          level: level
        };

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Get user profile for player name
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', user.id)
            .single();

          const playerName = profile?.display_name || profile?.username || 'Player';
          await LeaderboardAPI.submitVerifiedScore(playerName, player.score, user.id, metadata);
        } else {
          // Submit as guest score (unverified)
          const guestName = localStorage.getItem('wordavoid-guest-name') || 'Guest';
          await LeaderboardAPI.submitGuestScore(guestName, player.score, metadata);
        }
      }
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