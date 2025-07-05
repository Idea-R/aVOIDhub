import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Target, Zap } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { difficultyConfigs } from '../../data/words';

interface DifficultyTrackerProps {
  className?: string;
}

export const DifficultyTracker: React.FC<DifficultyTrackerProps> = ({ className = '' }) => {
  const { 
    difficultyLevel, 
    level, 
    wordsSpawned, 
    startTime, 
    isPlaying,
    player,
    mode
  } = useGameStore();

  const difficultyConfig = difficultyConfigs[difficultyLevel];
  
  // Calculate time elapsed
  const getElapsedTime = () => {
    if (!isPlaying || !startTime) return 0;
    return Date.now() - startTime;
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress to next difficulty increase
  const getNextDifficultyInfo = () => {
    const wordsUntilNextLevel = 5 - (wordsSpawned % 5);
    const nextLevel = level + 1;
    
    // Determine when difficulty actually changes based on level thresholds
    let nextDifficultyChange = null;
    let wordsUntilDifficultyChange = null;
    
    if (difficultyLevel === 'easy' && level >= 10) {
      nextDifficultyChange = 'normal';
    } else if (difficultyLevel === 'normal' && level >= 20) {
      nextDifficultyChange = 'expert';
    } else if (difficultyLevel === 'expert' && level >= 30) {
      nextDifficultyChange = 'insane';
    } else {
      // Calculate words until next major difficulty threshold
      if (level < 10) {
        wordsUntilDifficultyChange = (10 - level) * 5;
        nextDifficultyChange = 'normal';
      } else if (level < 20) {
        wordsUntilDifficultyChange = (20 - level) * 5;
        nextDifficultyChange = 'expert';
      } else if (level < 30) {
        wordsUntilDifficultyChange = (30 - level) * 5;
        nextDifficultyChange = 'insane';
      }
    }

    return {
      wordsUntilNextLevel,
      nextLevel,
      nextDifficultyChange,
      wordsUntilDifficultyChange
    };
  };

  const nextDifficultyInfo = getNextDifficultyInfo();
  const elapsedTime = getElapsedTime();

  return (
    <div className={`glass-panel p-4 border-2 border-avoid-primary/30 ${className}`}>
      <div className="flex items-center justify-between space-x-6">
        
        {/* Active Time Tracking */}
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          >
            <Clock className="w-5 h-5 text-avoid-accent" />
          </motion.div>
          <div>
            <div className="text-xs text-text-secondary font-game-ui">Session Time</div>
            <motion.div 
              className="text-lg font-game-mono font-bold text-avoid-accent"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {formatTime(elapsedTime)}
            </motion.div>
          </div>
        </div>

        {/* Current Difficulty Level */}
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-5 h-5" style={{ color: difficultyConfig.color }} />
          <div className="text-center">
            <div className="text-xs text-text-secondary font-game-ui">Current Difficulty</div>
            <motion.div 
              className="text-lg font-game-display font-bold"
              style={{ color: difficultyConfig.color }}
              animate={{ 
                textShadow: [
                  `0 0 5px ${difficultyConfig.color}40`,
                  `0 0 15px ${difficultyConfig.color}80`,
                  `0 0 5px ${difficultyConfig.color}40`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {difficultyConfig.name}
            </motion.div>
            <div className="text-xs text-text-muted font-game-mono">
              {difficultyConfig.wpmRange}
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="flex items-center space-x-3">
          <Target className="w-5 h-5 text-avoid-primary" />
          <div className="text-center">
            <div className="text-xs text-text-secondary font-game-ui">Performance</div>
            <div className="flex space-x-2 text-sm font-game-mono">
              <span className="text-avoid-primary font-bold">{player.wpm} WPM</span>
              <span className="text-text-muted">•</span>
              <span className={`font-bold ${
                player.accuracy >= 95 ? 'text-health-high' :
                player.accuracy >= 85 ? 'text-medium' :
                'text-extreme'
              }`}>
                {player.accuracy}%
              </span>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="flex items-center space-x-3">
          <Zap className="w-5 h-5 text-medium" />
          <div className="text-center">
            <div className="text-xs text-text-secondary font-game-ui">Level Progress</div>
            <motion.div 
              className="text-lg font-game-display font-bold text-medium"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.3 }}
              key={level}
            >
              Level {level}
            </motion.div>
            <div className="text-xs text-text-muted font-game-mono">
              {nextDifficultyInfo.wordsUntilNextLevel} words to {nextDifficultyInfo.nextLevel}
            </div>
          </div>
        </div>

        {/* Next Difficulty Warning */}
        {nextDifficultyInfo.nextDifficultyChange && nextDifficultyInfo.wordsUntilDifficultyChange && (
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ 
                scale: nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? [1, 1.2, 1] : 1,
                color: nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? ['#facc15', '#ef4444', '#facc15'] : '#facc15'
              }}
              transition={{ duration: 0.5, repeat: nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? Infinity : 0 }}
            >
              <TrendingUp className="w-5 h-5" />
            </motion.div>
            <div className="text-center">
              <div className="text-xs text-text-secondary font-game-ui">Next Challenge</div>
              <div className="text-sm font-game-display font-bold text-medium">
                {difficultyConfigs[nextDifficultyInfo.nextDifficultyChange as keyof typeof difficultyConfigs].name}
              </div>
              <motion.div 
                className={`text-xs font-game-mono font-bold ${
                  nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? 'text-extreme' : 'text-text-muted'
                }`}
                animate={nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? { 
                  scale: [1, 1.1, 1] 
                } : {}}
                transition={{ duration: 0.3, repeat: nextDifficultyInfo.wordsUntilDifficultyChange <= 10 ? Infinity : 0 }}
              >
                {nextDifficultyInfo.wordsUntilDifficultyChange} words away
              </motion.div>
            </div>
          </div>
        )}

        {/* Difficulty Multipliers Display */}
        <div className="text-center">
          <div className="text-xs text-text-secondary font-game-ui">Multipliers</div>
          <div className="space-y-1">
            <div className="text-xs font-game-mono">
              <span className="text-text-muted">Speed:</span>
              <span className="text-avoid-accent font-bold ml-1">
                {difficultyConfig.speedMultiplier}x
              </span>
            </div>
            <div className="text-xs font-game-mono">
              <span className="text-text-muted">Score:</span>
              <span className="text-score font-bold ml-1">
                {difficultyConfig.scoreMultiplier}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar for Next Level */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-text-secondary font-game-ui">
            Progress to Level {nextDifficultyInfo.nextLevel}
          </span>
          <span className="text-xs text-text-muted font-game-mono">
            {5 - nextDifficultyInfo.wordsUntilNextLevel}/5 words
          </span>
        </div>
        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-medium to-avoid-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${((5 - nextDifficultyInfo.wordsUntilNextLevel) / 5) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Difficulty Change Warning */}
      {nextDifficultyInfo.wordsUntilDifficultyChange && nextDifficultyInfo.wordsUntilDifficultyChange <= 15 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 bg-medium/20 border border-medium/50 rounded-lg"
        >
          <div className="flex items-center space-x-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <TrendingUp className="w-4 h-4 text-medium" />
            </motion.div>
            <span className="text-sm font-game-ui text-medium font-bold">
              Difficulty increase incoming! 
              <span className="text-extreme ml-1">
                {nextDifficultyInfo.wordsUntilDifficultyChange} words remaining
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};