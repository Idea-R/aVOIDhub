import React from 'react';
import { motion } from 'framer-motion';
import { Shapes } from 'lucide-react';
import type { GeometricChallenge as GeometricChallengeType } from '../../types/game';
import { getDifficultyColor } from '../../data/words';

interface GeometricChallengeProps {
  challenge: GeometricChallengeType;
  className?: string;
}

export const GeometricChallenge: React.FC<GeometricChallengeProps> = ({
  challenge,
  className = ''
}) => {
  const difficultyColor = getDifficultyColor(challenge.pattern.difficulty);
  const progress = challenge.currentStep / challenge.pattern.keys.length;
  const currentKey = challenge.pattern.keys[challenge.currentStep];
  const completedKeys = challenge.pattern.keys.slice(0, challenge.currentStep);
  const remainingKeys = challenge.pattern.keys.slice(challenge.currentStep + 1);
  
  // Calculate time remaining (20 seconds total)
  const timeElapsed = Date.now() - challenge.startTime;
  const timeRemaining = Math.max(0, 20000 - timeElapsed);
  const timeProgress = timeRemaining / 20000;

  const getShapeIcon = () => {
    switch (challenge.pattern.shape) {
      case 'line': return '━';
      case 'circle': return '○';
      case 'square': return '□';
      case 'triangle': return '△';
      case 'diamond': return '◇';
      case 'cross': return '✚';
      default: return '◯';
    }
  };

  return (
    <motion.div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        left: challenge.position.x,
        top: challenge.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ scale: 0.5, opacity: 0.7 }}
      animate={{ 
        scale: 1,
        opacity: 1
      }}
      exit={{ 
        scale: 0,
        opacity: 0,
        rotate: 360
      }}
      transition={{ 
        type: 'spring',
        stiffness: 300,
        damping: 20
      }}
    >
      {/* Challenge Background */}
      <motion.div
        className="relative px-6 py-4 rounded-xl backdrop-blur-sm border-2"
        style={{
          backgroundColor: `${difficultyColor}20`,
          borderColor: `${difficultyColor}60`
        }}
        animate={{
          boxShadow: [
            `0 0 15px ${difficultyColor}60`,
            `0 0 25px ${difficultyColor}80`,
            `0 0 15px ${difficultyColor}60`
          ]
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Shapes className="w-5 h-5" style={{ color: difficultyColor }} />
            <span className="text-sm font-game-ui font-bold" style={{ color: difficultyColor }}>
              {challenge.pattern.name}
            </span>
          </div>
          <div className="text-2xl" style={{ color: difficultyColor }}>
            {getShapeIcon()}
          </div>
        </div>

        {/* Pattern Description */}
        <div className="text-xs text-text-secondary font-game-ui mb-3">
          {challenge.pattern.description}
        </div>

        {/* Key Sequence Display - Scrollable for long patterns */}
        <div className="mb-3">
          <div className="flex items-center justify-center space-x-1 overflow-x-auto max-w-full">
          {/* Completed Keys */}
          {completedKeys.map((key, index) => (
            <motion.div
              key={`completed-${index}`}
              className="w-6 h-6 rounded border border-health-high bg-health-high/20 flex items-center justify-center flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <span className="text-xs font-game-mono font-bold text-health-high">
                {key.toUpperCase()}
              </span>
            </motion.div>
          ))}
          
          {/* Current Key */}
          {currentKey && (
            <motion.div
              className="w-8 h-8 rounded border-2 flex items-center justify-center flex-shrink-0"
              style={{ 
                borderColor: difficultyColor,
                backgroundColor: `${difficultyColor}30`
              }}
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  `0 0 10px ${difficultyColor}60`,
                  `0 0 20px ${difficultyColor}80`,
                  `0 0 10px ${difficultyColor}60`
                ]
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <span className="text-sm font-game-mono font-bold text-white">
                {currentKey.toUpperCase()}
              </span>
            </motion.div>
          )}
          
          {/* Remaining Keys */}
          {remainingKeys.map((key, index) => (
            <div
              key={`remaining-${index}`}
              className="w-6 h-6 rounded border border-white/30 bg-white/10 flex items-center justify-center flex-shrink-0"
            >
              <span className="text-xs font-game-mono font-bold text-text-muted">
                {key.toUpperCase()}
              </span>
            </div>
          ))}
          </div>
          
          {/* Pattern Progress Text */}
          <div className="text-center mt-2">
            <span className="text-xs text-text-muted font-game-mono">
              {challenge.currentStep} / {challenge.pattern.keys.length} keys
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full bg-gradient-to-r from-health-high to-avoid-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Timer Bar */}
        <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              timeProgress > 0.5 ? 'bg-health-high' :
              timeProgress > 0.25 ? 'bg-medium' :
              'bg-extreme'
            }`}
            animate={{ width: `${timeProgress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Difficulty Indicator */}
        <div 
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
          style={{ backgroundColor: difficultyColor }}
        >
          <span className="text-xs font-game-display font-bold text-white">
            {challenge.pattern.difficulty[0].toUpperCase()}
          </span>
        </div>
        
        {/* Pattern Type Badge */}
        <div 
          className="absolute -top-2 -left-2 px-2 py-1 rounded-full border border-white/30 text-xs font-game-ui font-bold"
          style={{ backgroundColor: `${difficultyColor}20`, color: difficultyColor }}
        >
          {challenge.pattern.shape.toUpperCase()}
        </div>
      </motion.div>

      {/* Approach Trail */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          background: `radial-gradient(circle, ${difficultyColor}30 0%, transparent 70%)`,
          filter: 'blur(6px)'
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.4, 0.7, 0.4]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Urgency Warning */}
      {timeProgress < 0.25 && (
        <motion.div
          className="absolute -inset-4 border-2 border-extreme rounded-xl"
          animate={{
            opacity: [0, 1, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity
          }}
        />
      )}
      
      {/* Pattern Visualization Hint */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-text-muted font-game-mono text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {challenge.pattern.shape === 'line' && '━━━━━'}
        {challenge.pattern.shape === 'circle' && '○ ○ ○'}
        {challenge.pattern.shape === 'square' && '□ □ □'}
        {challenge.pattern.shape === 'triangle' && '△ △ △'}
        {challenge.pattern.shape === 'diamond' && '◇ ◇ ◇'}
        {challenge.pattern.shape === 'cross' && '✚ ✚ ✚'}
      </motion.div>
    </motion.div>
  );
};