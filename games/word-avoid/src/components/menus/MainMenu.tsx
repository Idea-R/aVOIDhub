import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Trophy, Settings, Info, Zap, Clock, Target, Calendar, Waves, Dumbbell, Hash, Shapes } from 'lucide-react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { NeonButton } from '../ui/NeonButton';
import { DifficultySelector } from '../game/DifficultySelector';
import { useGameStore } from '../../stores/gameStore';
import { useAudioStore } from '../../stores/audioStore';
import type { GameMode } from '../../types/game';

interface MainMenuProps {
  onStartGame: (mode: GameMode) => void;
  onShowSettings: () => void;
  onShowStats: () => void;
  className?: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onShowSettings,
  onShowStats,
  className = ''
}) => {
  const { stats, loadPlayerStats, capsMode, shiftMode, toggleCapsMode } = useGameStore();
  const { initializeAudio, isInitialized } = useAudioStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeAudio();
    }
    loadPlayerStats();
  }, [initializeAudio, isInitialized, loadPlayerStats]);

  const gameModes = [
    {
      id: 'classic' as GameMode,
      name: 'Classic Survival',
      description: 'Endless typing defense with increasing difficulty',
      icon: Zap,
      color: 'text-avoid-primary',
      bgColor: 'from-avoid-primary/20 to-avoid-accent/20'
    },
    {
      id: 'timeAttack' as GameMode,
      name: 'Time Attack',
      description: 'Score as many points as possible in 2 minutes',
      icon: Clock,
      color: 'text-medium',
      bgColor: 'from-medium/20 to-avoid-warning/20'
    },
    {
      id: 'perfectRun' as GameMode,
      name: 'Perfect Run',
      description: 'One mistake ends the game - how far can you go?',
      icon: Target,
      color: 'text-extreme',
      bgColor: 'from-extreme/20 to-avoid-secondary/20'
    },
    {
      id: 'dailyChallenge' as GameMode,
      name: 'Daily Challenge',
      description: 'Special themed challenge that changes every day',
      icon: Calendar,
      color: 'text-boss',
      bgColor: 'from-boss/20 to-avoid-accent/20'
    },
    {
      id: 'waveDefense' as GameMode,
      name: 'Wave Defense',
      description: 'Survive waves of increasingly difficult words',
      icon: Waves,
      color: 'text-avoid-accent',
      bgColor: 'from-avoid-accent/20 to-avoid-primary/20'
    },
    {
      id: 'skillTraining' as GameMode,
      name: 'Skill Training',
      description: 'Focus on specific typing challenges and patterns',
      icon: Dumbbell,
      color: 'text-avoid-secondary',
      bgColor: 'from-avoid-secondary/20 to-medium/20'
    },
    {
      id: 'digitAssault' as GameMode,
      name: 'Digit Assault',
      description: 'Fast-paced individual letters, numbers, and symbols',
      icon: Hash,
      color: 'text-boss',
      bgColor: 'from-boss/20 to-extreme/20'
    },
    {
      id: 'geometricTyping' as GameMode,
      name: 'Geometric Typing',
      description: 'Type keyboard patterns and shapes for finger agility',
      icon: Shapes,
      color: 'text-avoid-accent',
      bgColor: 'from-avoid-accent/20 to-avoid-primary/20'
    }
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center p-8 ${className}`}>
      <div className="w-full max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-game-display font-black text-transparent bg-clip-text bg-gradient-to-r from-avoid-primary via-avoid-accent to-avoid-secondary mb-4">
            WORDaVOID
          </h1>
          <motion.div
            animate={{
              textShadow: [
                '0 0 20px rgba(0, 255, 136, 0.5)',
                '0 0 30px rgba(0, 255, 136, 0.8)',
                '0 0 20px rgba(0, 255, 136, 0.5)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xl font-game-ui text-text-secondary"
          >
            Defend your position by typing incoming words
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Game Modes */}
          <div className="lg:col-span-2">
            <motion.h2
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-game-display font-bold text-avoid-primary mb-6"
            >
              Choose Your Challenge
            </motion.h2>
            
            {/* Difficulty and SHIFT Mode Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-6 flex items-center space-x-4"
            >
              <DifficultySelector className="flex-1" />
              
              {/* SHIFT Mode Toggle */}
              <motion.button
                className={`glass-panel px-6 py-4 border-2 transition-all flex items-center space-x-3 ${
                  capsMode 
                    ? 'bg-boss/20 border-boss text-boss' 
                    : 'bg-white/10 border-white/30 text-text-secondary hover:border-boss/50'
                }`}
                onClick={toggleCapsMode}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Hash className="w-5 h-5" />
                <div className="text-center">
                  <div className="text-xs font-game-ui mb-1">SHIFT Mode</div>
                  <div className="flex items-center space-x-2">
                    {capsMode ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                    <span className="text-sm font-game-display font-bold">
                      {capsMode ? (shiftMode ? 'CAPS + SYMBOLS' : 'CAPS ONLY') : 'LETTERS + NUMBERS'}
                    </span>
                  </div>
                </div>
              </motion.button>
            </motion.div>
            
            {/* Game Mode Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {gameModes.map((mode, index) => (
                <motion.div
                  key={mode.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  <GlassPanel className="p-6 h-full hover:border-avoid-primary/50 transition-all duration-300 cursor-pointer group">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${mode.bgColor}`}>
                        <mode.icon className={`w-6 h-6 ${mode.color}`} />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-game-display font-bold text-text-primary mb-2 group-hover:text-avoid-primary transition-colors">
                          {mode.name}
                        </h3>
                        <p className="text-sm text-text-secondary mb-4 font-game-ui">
                          {mode.description}
                        </p>
                        
                        <NeonButton
                          size="sm"
                          onClick={() => onStartGame(mode.id)}
                          className="w-full"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Game
                        </NeonButton>
                      </div>
                    </div>
                  </GlassPanel>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-xl font-game-display font-bold text-avoid-accent mb-4">
                Your Stats
              </h3>
              <GlassPanel className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary font-game-ui">Games Played</span>
                    <span className="text-text-primary font-game-mono font-bold">
                      {stats.totalGames}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary font-game-ui">Best WPM</span>
                    <span className="text-avoid-primary font-game-mono font-bold">
                      {stats.bestWPM}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary font-game-ui">Best Accuracy</span>
                    <span className="text-health-high font-game-mono font-bold">
                      {stats.bestAccuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary font-game-ui">Longest Streak</span>
                    <span className="text-medium font-game-mono font-bold">
                      {stats.longestStreak}
                    </span>
                  </div>
                </div>
                
                <NeonButton
                  variant="accent"
                  size="sm"
                  onClick={onShowStats}
                  className="w-full mt-4"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  View All Stats
                </NeonButton>
              </GlassPanel>
            </motion.div>

            {/* Menu Actions */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3"
            >
              <NeonButton
                variant="secondary"
                onClick={onShowSettings}
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </NeonButton>
              
              <NeonButton
                variant="accent"
                onClick={() => {/* Show help/tutorial */}}
                className="w-full"
              >
                <Info className="w-4 h-4 mr-2" />
                How to Play
              </NeonButton>
            </motion.div>

            {/* Audio Status */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <GlassPanel className="p-4">
                <div className="text-center">
                  <div className={`text-sm font-game-ui ${
                    isInitialized ? 'text-health-high' : 'text-medium'
                  }`}>
                    Audio System: {isInitialized ? 'Ready' : 'Initializing...'}
                  </div>
                  {!isInitialized && (
                    <div className="text-xs text-text-muted mt-1">
                      Click anywhere to enable audio
                    </div>
                  )}
                </div>
              </GlassPanel>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-center mt-12 text-text-muted font-game-ui text-sm"
        >
          <p>Part of the aVOID Games Studio • Built with cutting-edge web technologies</p>
        </motion.div>
      </div>
    </div>
  );
};