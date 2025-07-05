import React from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { difficultyConfigs } from '../../data/words';

interface GameTimerProps {
  className?: string;
}

export const GameTimer: React.FC<GameTimerProps> = ({ className = '' }) => {
  const { 
    startTime, 
    isPlaying, 
    timeRemaining, 
    mode,
    level,
    wordSpeed,
    spawnRate,
    difficulty,
    difficultyLevel,
    capsMode,
    shiftMode,
    toggleCapsMode
  } = useGameStore();

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

  const difficultyConfig = difficultyConfigs[difficultyLevel];
  const elapsedTime = getElapsedTime();

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="glass-panel px-8 py-6 border-2 border-avoid-primary/30">
        <div className="flex items-center space-x-6">
          {/* Timer Display */}
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <Clock className="w-6 h-6 text-avoid-primary" />
            </motion.div>
            <div className="text-center">
              <div className="text-xs text-text-secondary font-game-ui">
                {mode === 'timeAttack' ? 'Time Left' : 'Elapsed'}
              </div>
              <motion.div 
                className={`text-2xl font-game-mono font-bold ${
                  mode === 'timeAttack' && timeRemaining && timeRemaining < 30000 
                    ? 'text-extreme' 
                    : 'text-avoid-primary'
                }`}
                animate={
                  mode === 'timeAttack' && timeRemaining && timeRemaining < 30000
                    ? { scale: [1, 1.1, 1] }
                    : {}
                }
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {mode === 'timeAttack' && timeRemaining !== undefined
                  ? formatTime(timeRemaining)
                  : formatTime(elapsedTime)
                }
              </motion.div>
            </div>
          </div>

          {/* Difficulty Level (WPM-based) */}
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6" style={{ color: difficultyConfig.color }} />
            <div className="text-center">
              <div className="text-xs text-text-secondary font-game-ui">
                Difficulty ({difficultyConfig.wpmRange})
              </div>
              <div 
                className="text-xl font-game-display font-bold"
                style={{ color: difficultyConfig.color }}
              >
                {difficultyConfig.name}
              </div>
            </div>
          </div>

          {/* Speed Multiplier */}
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-avoid-accent" />
            <div className="text-center">
              <div className="text-xs text-text-secondary font-game-ui">Speed</div>
              <div className="text-lg font-game-mono font-bold text-avoid-accent">
                {difficultyConfig.speedMultiplier}x
              </div>
            </div>
          </div>

          {/* Spawn Rate Multiplier */}
          <div className="text-center">
            <div className="text-xs text-text-secondary font-game-ui">Spawn Rate</div>
            <div className="text-lg font-game-mono font-bold text-medium">
              {difficultyConfig.spawnRateMultiplier}x
            </div>
          </div>

          {/* Level Indicator */}
          <div className="text-center">
            <div className="text-xs text-text-secondary font-game-ui">Level</div>
            <motion.div 
              className="text-2xl font-game-display font-bold text-avoid-primary"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.3 }}
              key={level}
            >
              {level}
            </motion.div>
          </div>
          
          {/* CAPS Mode Toggle (only for Digit Assault) */}
          {mode === 'digitAssault' && (
            <div className="flex items-center space-x-3">
              <motion.button
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                  capsMode 
                    ? 'bg-boss/20 border-boss text-boss' 
                    : 'bg-white/10 border-white/30 text-text-secondary'
                }`}
                onClick={toggleCapsMode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {capsMode ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
                <span className="text-sm font-game-ui font-bold">
                  CAPS
                </span>
              </motion.button>
            </div>
          )}
          {/* CAPS Mode Toggle (only for Digit Assault) */}
          {mode === 'digitAssault' && (
            <div className="text-center">
              <div className="text-xs text-text-secondary font-game-ui">SHIFT Mode</div>
              <div className={`text-lg font-game-mono font-bold ${
                capsMode ? 'text-boss' : 'text-text-muted'
              }`}>
                {capsMode ? (shiftMode ? 'CAPS+SYM' : 'CAPS') : 'OFF'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};