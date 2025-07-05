import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { difficultyConfigs } from '../../data/words';
import type { DifficultyLevel } from '../../types/game';

interface DifficultySelectorProps {
  className?: string;
}

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({ className = '' }) => {
  const { difficultyLevel, setDifficultyLevel, isPlaying } = useGameStore();

  const difficulties: DifficultyLevel[] = ['easy', 'normal', 'expert', 'insane'];

  const handleDifficultyChange = (level: DifficultyLevel) => {
    if (!isPlaying) {
      setDifficultyLevel(level);
    }
  };

  return (
    <div className={`glass-panel px-6 py-4 border-2 border-avoid-secondary/30 ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-avoid-secondary" />
          <span className="text-sm font-game-ui text-text-secondary">Difficulty:</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {difficulties.map((level) => {
            const config = difficultyConfigs[level];
            const isSelected = level === difficultyLevel;
            const isDisabled = isPlaying;
            
            return (
              <motion.button
                key={level}
                className={`px-4 py-2 rounded-lg border-2 font-game-display font-bold text-sm transition-all ${
                  isSelected
                    ? 'border-current text-white shadow-lg'
                    : isDisabled
                    ? 'border-white/20 text-text-muted cursor-not-allowed'
                    : 'border-white/30 text-text-secondary hover:border-current hover:text-white'
                }`}
                style={{
                  backgroundColor: isSelected ? `${config.color}20` : 'transparent',
                  borderColor: isSelected ? config.color : undefined,
                  color: isSelected ? config.color : undefined,
                  boxShadow: isSelected ? `0 0 15px ${config.color}40` : undefined
                }}
                onClick={() => handleDifficultyChange(level)}
                disabled={isDisabled}
                whileHover={!isDisabled ? { scale: 1.05 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
              >
                {config.name}
              </motion.button>
            );
          })}
        </div>
        
        {/* WPM Range Display */}
        <div className="text-xs text-text-muted font-game-mono">
          Target: {difficultyConfigs[difficultyLevel].wpmRange}
        </div>
      </div>
      
      {isPlaying && (
        <div className="mt-2 text-xs text-text-muted font-game-ui">
          Difficulty locked during gameplay
        </div>
      )}
    </div>
  );
};