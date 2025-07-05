import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';
import type { Player } from '../../types/game';

interface PlayerAvatarProps {
  player: Player;
  isGameActive: boolean;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  isGameActive,
  className = ''
}) => {
  const isLowHealth = player.health < 30;
  const hasShield = player.shield > 0;
  const hasStreak = player.streak > 5;

  return (
    <div className={`relative ${className}`}>
      {/* Main Avatar Circle */}
      <motion.div
        className="relative w-20 h-20 rounded-full border-4 border-avoid-primary bg-gradient-to-br from-avoid-primary/30 to-avoid-accent/30 backdrop-blur-sm"
        animate={isGameActive ? {
          scale: isLowHealth ? [1, 1.1, 1] : 1,
          borderColor: isLowHealth ? ['#00ff88', '#ef4444', '#00ff88'] : '#00ff88',
          boxShadow: [
            '0 0 30px rgba(0, 255, 136, 0.6)',
            '0 0 50px rgba(0, 255, 136, 1)',
            '0 0 30px rgba(0, 255, 136, 0.6)'
          ]
        } : {}}
        transition={{
          duration: isLowHealth ? 0.5 : 2,
          repeat: isGameActive ? Infinity : 0,
          ease: 'easeInOut'
        }}
      >
        {/* Inner Core */}
        <motion.div
          className="absolute inset-3 rounded-full bg-gradient-to-br from-avoid-primary to-avoid-accent"
          animate={{
            rotate: isGameActive ? 360 : 0
          }}
          transition={{
            duration: 4,
            repeat: isGameActive ? Infinity : 0,
            ease: 'linear'
          }}
        />

        {/* Center Dot */}
        <motion.div 
          className="absolute inset-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>

      {/* Shield Effect */}
      {hasShield && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ 
            scale: 1, 
            rotate: 0,
            opacity: [0.7, 1, 0.7]
          }}
          exit={{ scale: 0, rotate: 180 }}
          transition={{
            scale: { duration: 0.3 },
            rotate: { duration: 0.3 },
            opacity: { duration: 1, repeat: Infinity }
          }}
          className="absolute -inset-2 rounded-full border-2 border-avoid-accent bg-avoid-accent/10"
        >
          <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-avoid-accent" />
        </motion.div>
      )}

      {/* Streak Effect */}
      {hasStreak && (
        <motion.div
          className="absolute -inset-6"
          animate={{
            rotate: 360
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-avoid-primary rounded-full"
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 0',
                transform: `rotate(${i * 45}deg) translateX(32px) translateY(-50%)`
              }}
              animate={{
                scale: [0.5, 2, 0.5],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.125
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Health Indicator */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
        <div className="w-16 h-2 bg-bg-tertiary rounded-full overflow-hidden border border-white/20">
          <motion.div
            className={`h-full ${
              player.health > 60 ? 'bg-health-high' :
              player.health > 30 ? 'bg-health-medium' :
              'bg-health-low'
            }`}
            initial={{ width: '100%' }}
            animate={{ width: `${(player.health / player.maxHealth) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Streak Counter */}
      {player.streak > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-3 -right-3 bg-avoid-primary text-bg-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-game-display font-bold border-2 border-white"
        >
          {player.streak}
        </motion.div>
      )}
    </div>
  );
};