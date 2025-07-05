import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MainMenu } from './components/menus/MainMenu';
import { GameArena } from './components/game/GameArena';
import { GameHUD } from './components/game/GameHUD';
import { GameOverScreen } from './components/menus/GameOverScreen';
import { SettingsMenu } from './components/menus/SettingsMenu';
import { useGameStore } from './stores/gameStore';
import { useAudioStore } from './stores/audioStore';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import type { GameMode } from './types/game';

type AppState = 'menu' | 'playing' | 'gameOver' | 'settings' | 'stats';

function App() {
  const [appState, setAppState] = useState<AppState>('menu');
  
  const { 
    isPlaying, 
    isGameOver, 
    screenShakeTrigger,
    settings,
    startGame, 
    resetGame 
  } = useGameStore();
  
  const { startMusic, stopMusic } = useAudioStore();
  
  // Initialize keyboard input handling
  useKeyboardInput();

  // Handle game state changes
  useEffect(() => {
    if (isGameOver && appState === 'playing') {
      setAppState('gameOver');
      stopMusic();
    }
  }, [isGameOver, appState, stopMusic]);

  const handleStartGame = (mode: GameMode) => {
    startGame(mode);
    setAppState('playing');
    startMusic();
  };

  const handleRestartGame = () => {
    resetGame();
    setAppState('menu');
  };

  const handleMainMenu = () => {
    resetGame();
    setAppState('menu');
    stopMusic();
  };

  const handleShowSettings = () => {
    setAppState('settings');
  };

  const handleShowStats = () => {
    setAppState('stats');
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-hidden">
      <AnimatePresence mode="wait">
        {appState === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <MainMenu
              onStartGame={handleStartGame}
              onShowSettings={handleShowSettings}
              onShowStats={handleShowStats}
            />
          </motion.div>
        )}

        {appState === 'playing' && isPlaying && (
          <motion.div
            key="game"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: settings.graphics.screenShake && screenShakeTrigger > 0 ? [0, -5, 5, -5, 5, 0] : 0,
              y: settings.graphics.screenShake && screenShakeTrigger > 0 ? [0, -5, 5, -5, 5, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ 
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 },
              x: { duration: 0.3, ease: "easeInOut" },
              y: { duration: 0.3, ease: "easeInOut" },
            }}
            className="relative w-screen h-screen"
          >
            <GameArena className="absolute inset-0" />
            <GameHUD />
          </motion.div>
        )}

        {appState === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
          >
            <SettingsMenu onBack={() => setAppState('menu')} />
          </motion.div>
        )}

        {appState === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex items-center justify-center p-8"
          >
            <div className="glass-panel p-8 max-w-4xl w-full">
              <h2 className="text-3xl font-game-display font-bold text-avoid-accent mb-6">
                Statistics
              </h2>
              <p className="text-text-secondary font-game-ui mb-8">
                Detailed statistics panel coming soon! Basic stats are shown in the main menu.
              </p>
              <button
                onClick={() => setAppState('menu')}
                className="neon-button px-6 py-3 bg-gradient-to-r from-avoid-accent to-avoid-primary text-white"
              >
                Back to Menu
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {appState === 'gameOver' && (
          <GameOverScreen
            onRestart={handleStartGame.bind(null, 'classic')}
            onMainMenu={handleMainMenu}
          />
        )}
      </AnimatePresence>

      {/* Global Audio Click Handler */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        onClick={() => {
          // This helps initialize audio context on first user interaction
          const { initializeAudio, isInitialized } = useAudioStore.getState();
          if (!isInitialized) {
            initializeAudio();
          }
        }}
      />
    </div>
  );
}

export default App;