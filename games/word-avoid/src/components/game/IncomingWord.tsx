import React from 'react';
import { motion } from 'framer-motion';
import type { Word } from '../../types/game';
import { getDifficultyColor } from '../../data/words';

interface IncomingWordProps {
  word: Word;
  onComplete?: (wordId: string) => void;
  className?: string;
}

export const IncomingWord: React.FC<IncomingWordProps> = ({
  word,
  onComplete,
  className = ''
}) => {
  const difficultyColor = getDifficultyColor(word.difficulty);
  const progress = 1 - (word.distance / word.maxDistance);
  const isNearCenter = word.distance < 100;
  const isCurrentTarget = word.isTyping;
  const typedText = word.text.slice(0, word.typedChars);
  const remainingText = word.text.slice(word.typedChars);

  return (
    <motion.div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        left: word.position.x,
        top: word.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ scale: 0.5, opacity: 0.7 }}
      animate={{ 
        scale: isCurrentTarget ? 1.3 : isNearCenter ? 1.2 : 1,
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
      {/* Word Background */}
      <motion.div
        className={`relative px-3 py-2 rounded-lg backdrop-blur-sm border-2 ${
          isCurrentTarget ? 'border-avoid-primary' : 'border-white/30'
        }`}
        style={{
          backgroundColor: isCurrentTarget ? `${difficultyColor}40` : `${difficultyColor}20`
        }}
        animate={isCurrentTarget ? {
          boxShadow: [
            `0 0 15px ${difficultyColor}80`,
            `0 0 25px ${difficultyColor}`,
            `0 0 15px ${difficultyColor}80`
          ]
        } : isNearCenter ? {
          boxShadow: [
            `0 0 10px ${difficultyColor}60`,
            `0 0 20px ${difficultyColor}80`,
            `0 0 10px ${difficultyColor}60`
          ]
        } : {}}
        transition={{ duration: 0.5, repeat: (isCurrentTarget || isNearCenter) ? Infinity : 0 }}
      >
        {/* Word Text */}
        <div className={`font-game-mono font-bold ${isCurrentTarget ? 'text-xl' : 'text-lg'} flex`}>
          {/* Typed Characters */}
          {typedText && (
            <motion.span
              className="text-health-high"
              style={{ textShadow: '0 0 8px currentColor' }}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.2 }}
            >
              {typedText}
            </motion.span>
          )}
          
          {/* Remaining Characters */}
          <span 
            className="text-white"
            style={{ color: difficultyColor }}
          >
            {remainingText}
          </span>
        </div>

        {/* Progress Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b-lg overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-health-high to-avoid-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${(word.typedChars / word.text.length) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>

        {/* Difficulty Indicator */}
        <div 
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
            isCurrentTarget ? 'animate-pulse' : ''
          }`}
          style={{ backgroundColor: difficultyColor }}
        />
      </motion.div>

      {/* Approach Trail */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `radial-gradient(circle, ${difficultyColor}40 0%, transparent 70%)`,
          filter: 'blur(4px)'
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Distance Warning */}
      {isNearCenter && (
        <motion.div
          className="absolute -inset-3 border-2 border-extreme rounded-lg"
          animate={{
            opacity: [0, 1, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity
          }}
        />
      )}
      
      {/* Current Target Indicator */}
      {isCurrentTarget && (
        <motion.div
          className="absolute -inset-4 border-2 border-avoid-primary rounded-lg"
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 1,
            repeat: Infinity
          }}
        />
      )}
    </motion.div>
  );
};