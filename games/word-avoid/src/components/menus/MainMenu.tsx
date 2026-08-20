import React from 'react';
import { motion } from 'framer-motion';
import { Play, Trophy, Settings, Info, Zap, Clock, Hash } from 'lucide-react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { NeonButton } from '../ui/NeonButton';
import { DifficultySelector } from '../game/DifficultySelector';
import { useGameStore } from '../../stores/gameStore';
import { useAudioStore } from '../../stores/audioStore';
import type { GameMode } from '../../types/game';
import { DEFERRED_MODE_CONTRACTS, V1_MODE_CONTRACTS } from '../../contracts/v1';

interface MainMenuProps {
  onStartGame: (mode: GameMode) => void;
  onShowSettings: () => void;
  onShowStats: () => void;
  onShowHelp: () => void;
  isStarting: boolean;
  startMessage: string;
  className?: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onShowSettings,
  onShowStats,
  onShowHelp,
  isStarting,
  startMessage,
  className = ''
}) => {
  const { stats, localDataStatus, capsMode, shiftMode, toggleCapsMode } = useGameStore();
  const audioStatus = useAudioStore((state) => state.status);
  const audioStatusMessage = useAudioStore((state) => state.statusMessage);
  const initializeAudio = useAudioStore((state) => state.initializeAudio);

  const gameModes = V1_MODE_CONTRACTS.map((mode) => ({
    ...mode,
    description: mode.summary,
    icon: mode.id === 'classic' ? Zap : Clock,
    color: mode.id === 'classic' ? 'text-avoid-primary' : 'text-medium',
    bgColor: mode.id === 'classic'
      ? 'from-avoid-primary/20 to-avoid-accent/20'
      : 'from-medium/20 to-avoid-warning/20',
  }));

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-8 sm:p-8 ${className}`}>
      <div className="w-full max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-8 sm:mb-12"
        >
          <h1 className="text-4xl sm:text-6xl font-game-display font-black text-transparent bg-clip-text bg-gradient-to-r from-avoid-primary via-avoid-accent to-avoid-secondary mb-4">
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
              className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
            >
              <DifficultySelector className="flex-1" />
              
              {/* SHIFT Mode Toggle */}
              <motion.button
                className={`glass-panel px-4 py-4 sm:px-6 border-2 transition-all flex items-center justify-center gap-3 ${
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
                  <GlassPanel className="p-4 sm:p-6 h-full hover:border-avoid-primary/50 transition-all duration-300 cursor-pointer group">
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
                          disabled={isStarting}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {isStarting ? 'Preparing…' : 'Start Game'}
                        </NeonButton>
                      </div>
                    </div>
                  </GlassPanel>
                </motion.div>
              ))}
            </motion.div>

            <GlassPanel className="mt-6 p-5 border-dashed border-white/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-game-display font-bold uppercase tracking-[0.2em] text-text-muted">
                    Mode lab
                  </p>
                  <p className="mt-2 max-w-xl text-sm font-game-ui text-text-secondary">
                    Six experiments are staying out of V1 until each has its own rules, balance, and honest score contract.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-game-display font-bold uppercase tracking-wider text-medium">
                  Not ranked yet
                </span>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Deferred WORDaVOID modes">
                {DEFERRED_MODE_CONTRACTS.map((mode) => (
                  <li
                    key={mode.id}
                    className="border border-white/15 bg-black/20 px-3 py-2 text-xs font-game-ui text-text-muted"
                    title={mode.deferredReason}
                  >
                    {mode.name}
                  </li>
                ))}
              </ul>
            </GlassPanel>
            {startMessage && (
              <p className="mt-3 text-sm font-game-ui text-medium" role="status" aria-live="polite">
                {startMessage}
              </p>
            )}
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
                {localDataStatus === 'migrated' && (
                  <p className="mb-4 text-xs text-health-high" role="status">Your older local stats were upgraded safely.</p>
                )}
                {localDataStatus === 'recovered' && (
                  <p className="mb-4 text-xs text-medium" role="status">Unreadable local data was ignored so the game could start cleanly.</p>
                )}
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
                onClick={onShowHelp}
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
                    audioStatus === 'ready' ? 'text-health-high' : audioStatus === 'unavailable' ? 'text-extreme' : 'text-medium'
                  }`}>
                    Audio: {audioStatus === 'ready' ? 'Ready' : audioStatus === 'unavailable' ? 'Silent mode' : 'Ready on input'}
                  </div>
                  <div className="text-xs text-text-muted mt-1" role="status">{audioStatusMessage}</div>
                  {audioStatus === 'unavailable' && (
                    <button type="button" className="mt-3 text-xs font-bold text-avoid-accent underline underline-offset-4" onClick={() => void initializeAudio()}>
                      Try audio again
                    </button>
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
