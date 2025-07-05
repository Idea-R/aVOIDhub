import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Home, Trophy, Share2 } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { NeonButton } from '../ui/NeonButton';
import { useGameStore } from '../../stores/gameStore';

interface GameOverScreenProps {
  onRestart: () => void;
  onMainMenu: () => void;
  className?: string;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  onRestart,
  onMainMenu,
  className = ''
}) => {
  const { player, wordsTyped, mode, stats } = useGameStore();

  const getPerformanceRating = () => {
    if (player.accuracy >= 95 && player.wpm >= 60) return { text: 'LEGENDARY', color: 'text-boss' };
    if (player.accuracy >= 90 && player.wpm >= 50) return { text: 'EXCELLENT', color: 'text-avoid-primary' };
    if (player.accuracy >= 80 && player.wpm >= 40) return { text: 'GREAT', color: 'text-health-high' };
    if (player.accuracy >= 70 && player.wpm >= 30) return { text: 'GOOD', color: 'text-medium' };
    return { text: 'KEEP PRACTICING', color: 'text-extreme' };
  };

  const rating = getPerformanceRating();

  const gameStats = [
    { label: 'Final Score', value: player.score.toLocaleString(), color: 'text-score' },
    { label: 'Words Typed', value: wordsTyped.toString(), color: 'text-text-primary' },
    { label: 'Accuracy', value: `${player.accuracy}%`, color: 'text-health-high' },
    { label: 'WPM', value: player.wpm.toString(), color: 'text-avoid-primary' },
    { label: 'Best Streak', value: player.streak.toString(), color: 'text-medium' }
  ];

  const achievements = [
    player.wpm > stats.bestWPM && 'New WPM Record!',
    player.accuracy > stats.bestAccuracy && 'New Accuracy Record!',
    player.streak > stats.longestStreak && 'New Streak Record!',
    player.score > 10000 && 'Score Master!',
    player.accuracy === 100 && 'Perfect Accuracy!'
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 ${className}`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
        className="w-full max-w-2xl"
      >
        <GlassPanel className="p-8 text-center">
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-4xl font-game-display font-black text-extreme mb-2">
              GAME OVER
            </h1>
            <div className={`text-xl font-game-display font-bold ${rating.color} mb-6`}>
              {rating.text}
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
          >
            {gameStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="glass-panel p-4"
              >
                <div className="text-xs text-text-secondary font-game-ui mb-1">
                  {stat.label}
                </div>
                <div className={`text-2xl font-game-mono font-bold ${stat.color}`}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Achievements */}
          {achievements.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mb-8"
            >
              <h3 className="text-lg font-game-display font-bold text-avoid-primary mb-4">
                🏆 New Achievements!
              </h3>
              <div className="space-y-2">
                {achievements.map((achievement, index) => (
                  <motion.div
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="glass-panel p-3 bg-avoid-primary/10 border-avoid-primary/30"
                  >
                    <div className="text-avoid-primary font-game-ui font-bold">
                      {achievement}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <NeonButton
              variant="primary"
              onClick={onRestart}
              className="flex-1 min-w-[150px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </NeonButton>
            
            <NeonButton
              variant="secondary"
              onClick={onMainMenu}
              className="flex-1 min-w-[150px]"
            >
              <Home className="w-4 h-4 mr-2" />
              Main Menu
            </NeonButton>
            
            <NeonButton
              variant="accent"
              onClick={() => {
                // Share functionality
                if (navigator.share) {
                  navigator.share({
                    title: 'WORDaVOID Score',
                    text: `I just scored ${player.score.toLocaleString()} points in WORDaVOID with ${player.accuracy}% accuracy!`,
                    url: window.location.href
                  });
                }
              }}
              size="md"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </NeonButton>
          </motion.div>

          {/* Mode Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-6 text-sm text-text-muted font-game-ui"
          >
            Mode: {mode.charAt(0).toUpperCase() + mode.slice(1).replace(/([A-Z])/g, ' $1')}
          </motion.div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
};