import React from 'react';
import { motion } from 'framer-motion';
import type { DigitAssaultChar } from '../../types/game';

interface DigitCharacterProps {
  char: DigitAssaultChar;
  className?: string;
}

export const DigitCharacter: React.FC<DigitCharacterProps> = ({
  char,
  className = ''
}) => {
  const getCharColor = () => {
    switch (char.type) {
      case 'letter': return '#00ff88';
      case 'number': return '#facc15';
      case 'symbol': return '#ff0066';
      case 'capital': return '#8b5cf6';
      default: return '#ffffff';
    }
  };

  const getCharSize = () => {
    switch (char.type) {
      case 'symbol': return 'text-2xl';
      case 'capital': return 'text-xl';
      default: return 'text-lg';
    }
  };

  const charColor = getCharColor();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const distance = Math.sqrt(
    Math.pow(centerX - char.position.x, 2) + 
    Math.pow(centerY - char.position.y, 2)
  );
  const isNearCenter = distance < 100;

  return (
    <motion.div
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        left: char.position.x,
        top: char.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ scale: 0.5, opacity: 0.7 }}
      animate={{ 
        scale: isNearCenter ? 1.3 : 1,
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
      {/* Character Background */}
      <motion.div
        className="relative px-4 py-3 rounded-lg backdrop-blur-sm border-2"
        style={{
          backgroundColor: `${charColor}20`,
          borderColor: `${charColor}60`
        }}
        animate={isNearCenter ? {
          boxShadow: [
            `0 0 15px ${charColor}80`,
            `0 0 25px ${charColor}`,
            `0 0 15px ${charColor}80`
          ]
        } : {}}
        transition={{ duration: 0.5, repeat: isNearCenter ? Infinity : 0 }}
      >
        {/* Character Text */}
        <div 
          className={`font-game-mono font-bold ${getCharSize()} flex items-center justify-center`}
          style={{ color: charColor }}
        >
          {char.char}
        </div>

        {/* Type Indicator */}
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: charColor }}
        />
      </motion.div>

      {/* Approach Trail */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `radial-gradient(circle, ${charColor}40 0%, transparent 70%)`,
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
    </motion.div>
  );
};