import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Shield } from 'lucide-react';

interface HealthBarProps {
  health: number;
  maxHealth: number;
  shield?: number;
  className?: string;
}

export const HealthBar: React.FC<HealthBarProps> = ({
  health,
  maxHealth,
  shield = 0,
  className = ''
}) => {
  const healthPercentage = (health / maxHealth) * 100;
  const isLowHealth = healthPercentage < 30;
  const isCriticalHealth = healthPercentage < 15;

  const getHealthColor = () => {
    if (isCriticalHealth) return 'bg-extreme';
    if (isLowHealth) return 'bg-health-medium';
    return 'bg-health-high';
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Health Icon */}
      <motion.div
        animate={isCriticalHealth ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.5, repeat: isCriticalHealth ? Infinity : 0 }}
      >
        <Heart 
          className={`w-6 h-6 ${isCriticalHealth ? 'text-extreme' : 'text-health-high'}`}
          fill={isCriticalHealth ? 'currentColor' : 'none'}
        />
      </motion.div>

      {/* Health Bar Container */}
      <div className="flex-1 relative">
        <div className="w-full h-6 bg-bg-tertiary rounded-full border-2 border-white/30 overflow-hidden shadow-inner">
          {/* Health Fill */}
          <motion.div
            className={`health-bar-fill h-full ${getHealthColor()}`}
            initial={{ width: '100%' }}
            animate={{ width: `${healthPercentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          
          {/* Pulse effect for low health */}
          {isLowHealth && (
            <motion.div
              className="absolute inset-0 bg-extreme/40 rounded-full"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </div>

        {/* Health Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-game-mono font-bold text-white drop-shadow-lg">
            {health}/{maxHealth}
          </span>
        </div>
      </div>

      {/* Shield Indicator */}
      {shield > 0 && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 180 }}
          className="flex items-center space-x-1"
        >
          <Shield className="w-6 h-6 text-avoid-accent" fill="currentColor" />
          <span className="text-base font-game-mono font-bold text-avoid-accent">
            {shield}
          </span>
        </motion.div>
      )}
    </div>
  );
};