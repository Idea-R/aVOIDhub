import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { MainMenu } from './components/menus/MainMenu';
import { GameArena } from './components/game/GameArena';
import { GameHUD } from './components/game/GameHUD';
import { GameOverScreen } from './components/menus/GameOverScreen';
import { SettingsMenu } from './components/menus/SettingsMenu';
import { useGameStore } from './stores/gameStore';
import { useAudioStore } from './stores/audioStore';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useGameFocus } from './hooks/useGameFocus';
import { useMotionPreference } from './hooks/useMotionPreference';
import { TypingSurface } from './components/game/TypingSurface';
import { beginPlatformRun, createLocalWordAvoidManifest } from './api/platformRuns';
import type { GameMode } from './types/game';

type AppState = 'menu' | 'playing' | 'gameOver' | 'settings' | 'stats' | 'help';

function App() {
  const [appState, setAppState] = useState<AppState>('menu');
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState('');
  const startRequestInFlight = useRef(false);
  const startAttempt = useRef(0);
  
  const { 
    isPlaying, 
    isGameOver, 
    mode,
    screenShakeTrigger,
    settings,
    stats,
    startGame, 
    resetGame,
    loadPlayerStats,
    loadSettings,
  } = useGameStore();
  
  const { startMusic, stopMusic, setMasterVolume, setMusicVolume, setSfxVolume } = useAudioStore();
  const keyboard = useKeyboardInput();
  const shouldReduceMotion = useMotionPreference();
  
  useGameFocus(keyboard.inputRef);

  useEffect(() => {
    void Promise.all([loadPlayerStats(), loadSettings()]);
  }, [loadPlayerStats, loadSettings]);

  useEffect(() => {
    setMasterVolume(settings.audio.masterVolume);
    setMusicVolume(settings.audio.musicVolume);
    setSfxVolume(settings.audio.sfxVolume);
  }, [setMasterVolume, setMusicVolume, setSfxVolume, settings.audio]);

  // Browser audio must begin from a real user gesture. Tone.js stays out of
  // the initial download and is loaded once on the first pointer or key input.
  useEffect(() => {
    const removeAudioListeners = () => {
      window.removeEventListener('pointerdown', initializeAudio);
      window.removeEventListener('keydown', initializeAudio);
    };

    const initializeAudio = () => {
      removeAudioListeners();
      const audio = useAudioStore.getState();
      if (!audio.isInitialized) {
        void audio.initializeAudio();
      }
    };

    window.addEventListener('pointerdown', initializeAudio, { once: true });
    window.addEventListener('keydown', initializeAudio, { once: true });

    return removeAudioListeners;
  }, []);

  // Handle game state changes
  useEffect(() => {
    if (isGameOver && appState === 'playing') {
      setAppState('gameOver');
      stopMusic();
    }
  }, [isGameOver, appState, stopMusic]);

  const handleStartGame = async (mode: GameMode) => {
    if (startRequestInFlight.current) return;
    startRequestInFlight.current = true;
    const attempt = ++startAttempt.current;
    setIsStarting(true);
    setStartMessage('Preparing a fresh run…');
    try {
      const manifest = await beginPlatformRun(mode) ?? createLocalWordAvoidManifest(mode);
      if (attempt !== startAttempt.current) return;
      if (!manifest) throw new Error('manifest_unavailable');
      startGame(mode, manifest);
      setAppState('playing');
      setStartMessage('');
      startMusic();
    } catch {
      if (attempt !== startAttempt.current) return;
      setStartMessage('A fresh run could not be prepared. Try again.');
    } finally {
      if (attempt === startAttempt.current) {
        startRequestInFlight.current = false;
        setIsStarting(false);
      }
    }
  };

  const handleMainMenu = () => {
    startAttempt.current += 1;
    startRequestInFlight.current = false;
    setIsStarting(false);
    setStartMessage('');
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

  const handleShowHelp = () => {
    setAppState('help');
  };

  return (
    <MotionConfig reducedMotion={shouldReduceMotion ? 'always' : 'never'}>
    <div
      className="min-h-[100dvh] bg-bg-primary text-text-primary overflow-hidden"
      data-reduced-motion={shouldReduceMotion ? 'true' : 'false'}
    >
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
              onShowHelp={handleShowHelp}
              isStarting={isStarting}
              startMessage={startMessage}
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
            className="relative w-screen h-[100dvh]"
          >
            <GameArena className="absolute inset-0" onRequestTypingFocus={keyboard.focusInput} />
            <GameHUD onMainMenu={handleMainMenu} />
            <TypingSurface
              inputRef={keyboard.inputRef}
              isListening={keyboard.isListening}
              onKeyDown={keyboard.handleKeyDown}
              onInput={keyboard.handleInput}
              onCompositionStart={keyboard.handleCompositionStart}
              onCompositionEnd={keyboard.handleCompositionEnd}
              onPaste={keyboard.handlePaste}
            />
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
              <p className="text-text-secondary font-game-ui mb-6">
                This is your guest history on this device. Platform records arrive with account activation.
              </p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
                {[
                  ['Games', stats.totalGames.toLocaleString()],
                  ['Words', stats.totalWordsTyped.toLocaleString()],
                  ['Characters', stats.totalCharactersTyped.toLocaleString()],
                  ['Best WPM', stats.bestWPM.toString()],
                  ['Best accuracy', `${stats.bestAccuracy}%`],
                  ['Average accuracy', `${stats.averageAccuracy}%`],
                  ['Longest streak', stats.longestStreak.toString()],
                  ['Active minutes', Math.floor(stats.totalPlaytime / 60).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="glass-panel p-4">
                    <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
                    <dd className="mt-1 text-xl font-game-mono font-bold text-avoid-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => setAppState('menu')}
                className="neon-button px-6 py-3 bg-gradient-to-r from-avoid-accent to-avoid-primary text-white"
              >
                Back to Menu
              </button>
            </div>
          </motion.div>
        )}

        {appState === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-8"
          >
            <div className="glass-panel p-6 sm:p-8 max-w-3xl w-full">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Field manual</p>
              <h2 className="mt-2 text-3xl font-game-display font-bold text-avoid-primary">Type the threat, not the interface.</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 text-text-secondary">
                <p><strong className="text-white">Desktop:</strong> the game focuses its dedicated typing field when a run starts. Tab reaches controls; click “Type here” to return.</p>
                <p><strong className="text-white">Phone:</strong> tap “Type here” to open the software keyboard. One English letter at a time is accepted.</p>
                <p><strong className="text-white">Pause:</strong> press Escape or use the pause control. Leaving the tab pauses without clearing a manual pause.</p>
                <p><strong className="text-white">Competitive input:</strong> paste, IME composition, browser shortcuts, and modified keys are intentionally ignored.</p>
              </div>
              <button onClick={() => setAppState('menu')} className="neon-button mt-8 px-6 py-3">Back to Menu</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {appState === 'gameOver' && (
          <GameOverScreen
            onRestart={handleStartGame.bind(null, mode)}
            onMainMenu={handleMainMenu}
            isStarting={isStarting}
          />
        )}
      </AnimatePresence>

    </div>
    </MotionConfig>
  );
}

export default App;
