import React from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { GameTimer } from './GameTimer';
import { DifficultyTracker } from './DifficultyTracker';
import { HealthBar } from '../ui/HealthBar';
import { ScoreDisplay } from '../ui/ScoreDisplay';
import { NeonButton } from '../ui/NeonButton';
import { useGameStore } from '../../stores/gameStore';
import { useAudioStore } from '../../stores/audioStore';
import { FocusDialog } from '../ui/FocusDialog';
import { useMotionPreference } from '../../hooks/useMotionPreference';

interface GameHUDProps {
  className?: string;
  onMainMenu: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ className = '', onMainMenu }) => {
  const {
    player,
    mode,
    isPlaying,
    isPaused,
    pauseReasons,
    timeRemaining,
    currentWord,
    capsMode,
    shiftMode,
    pauseGame,
    resumeGame,
    endGame
  } = useGameStore();

  const { masterVolume, setMasterVolume } = useAudioStore();
  const shouldReduceMotion = useMotionPreference();
  const manuallyPaused = pauseReasons.includes('manual');

  const handlePauseToggle = () => {
    if (manuallyPaused) {
      resumeGame('manual');
    } else {
      pauseGame('manual');
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`absolute inset-0 z-10 pointer-events-none ${className}`}>
      {/* Top Center - Comprehensive Difficulty Tracking */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 hidden lg:block pointer-events-auto">
        <DifficultyTracker />
      </div>

      {/* Top HUD */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-2 sm:top-4 sm:left-4 sm:right-4 lg:top-24 pointer-events-none">
        {/* Left Side - Score and Stats */}
        <div className="flex flex-col gap-2 min-w-0 pointer-events-auto">
          <ScoreDisplay
            score={player.score}
            streak={player.streak}
            wpm={player.wpm}
            accuracy={player.accuracy}
          />
          
          {/* Game Mode and Level */}
          <div className="glass-panel px-3 py-2 border-2 border-avoid-accent/30 hidden sm:block">
            <div className="flex items-center space-x-4 text-sm font-game-ui">
              <div>
                <span className="text-text-secondary">Mode:</span>
                <span className="ml-2 text-avoid-primary font-bold text-base">
                  {mode.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
              {timeRemaining !== undefined && (
                <div>
                  <span className="text-text-secondary">Time:</span>
                  <span className={`ml-2 font-bold ${
                    timeRemaining < 30000 ? 'text-extreme' : 'text-text-primary'
                  }`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Toggle */}
          <motion.button
            type="button"
            aria-label={masterVolume > 0 ? 'Mute audio' : 'Enable audio'}
            className="glass-panel p-3 rounded-lg hover:bg-white/10 transition-colors border-2 border-white/20"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            onClick={() => setMasterVolume(masterVolume > 0 ? 0 : 0.7)}
          >
            {masterVolume > 0 ? 
              <Volume2 className="w-6 h-6 text-avoid-primary" /> : 
              <VolumeX className="w-6 h-6 text-extreme" />
            }
          </motion.button>

          {/* Pause/Resume */}
          <NeonButton
            size="sm"
            variant="primary"
            ariaLabel={manuallyPaused ? 'Resume game' : 'Pause game'}
            onClick={handlePauseToggle}
          >
            {manuallyPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </NeonButton>

          {/* End Game */}
          <NeonButton
            size="sm"
            variant="danger"
            ariaLabel="End game"
            onClick={() => endGame('quit')}
          >
            <Square className="w-4 h-4" />
          </NeonButton>
        </div>
      </div>

      {/* Secondary Timer Display (for Time Attack mode) */}
      {mode === 'timeAttack' && (
        <div className="absolute top-20 sm:top-24 lg:top-32 left-1/2 -translate-x-1/2 pointer-events-auto">
          <motion.div
            className="glass-panel px-6 py-3 border-2 border-medium/50"
            animate={!shouldReduceMotion && timeRemaining && timeRemaining < 30000 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: shouldReduceMotion ? 0 : Infinity }}
          >
            <GameTimer />
          </motion.div>
        </div>
      )}

      {/* Bottom HUD */}
      <div className="absolute bottom-16 left-2 right-2 sm:bottom-20 sm:left-4 sm:right-4 pointer-events-none">
        <div className="flex justify-between items-end">
          {/* Health Bar */}
          <div className="flex-1 max-w-md pointer-events-auto">
            <HealthBar
              health={player.health}
              maxHealth={player.maxHealth}
              shield={player.shield}
            />
          </div>

          {/* Current Word Display */}
          {currentWord && mode !== 'digitAssault' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-panel hidden sm:block px-5 py-3 mx-4 border-3 border-avoid-primary/70 shadow-lg shadow-avoid-primary/30"
            >
              <div className="text-center">
                <div className="text-xs text-text-secondary font-game-ui mb-1">
                  Target Word
                </div>
                <motion.div 
                  className="text-4xl font-game-mono font-bold text-avoid-primary neon-text"
                  animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: shouldReduceMotion ? 0 : Infinity }}
                >
                  {currentWord}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Next Words Preview */}
          {mode !== 'digitAssault' && (
            <div className="glass-panel px-6 py-4 max-w-xs border-2 border-white/20 hidden xl:block">
              <div className="text-xs text-text-secondary font-game-ui mb-2">
                Incoming
              </div>
              <div className="space-y-1">
                {/* This would show upcoming words in a real implementation */}
                <div className="text-base font-game-mono text-text-muted">
                  Ready to type...
                </div>
              </div>
            </div>
          )}
          
          {/* Game Mode Instructions */}
          {mode === 'digitAssault' && (
            <div className="glass-panel px-6 py-4 max-w-xs border-2 border-boss/30">
              <div className="text-xs text-text-secondary font-game-ui mb-2">
                Digit Assault
              </div>
              <div className="space-y-1 text-sm font-game-mono">
                <div className="text-easy">Letters: 10pts</div>
                <div className="text-medium">Numbers: 10pts</div>
                {capsMode && (
                  <>
                    <div className="text-boss">Capitals: 15pts</div>
                    <div className="text-extreme">Symbols: 20pts</div>
                  </>
                )}
                {capsMode && (
                  <div className="text-boss font-bold">
                    SHIFT MODE: {shiftMode ? 'CAPS + SYMBOLS' : 'CAPS ONLY'}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Geometric Typing Instructions */}
          {mode === 'geometricTyping' && (
            <div className="glass-panel px-6 py-4 max-w-xs border-2 border-boss/30">
              <div className="text-xs text-text-secondary font-game-ui mb-2">
                Geometric Typing
              </div>
              <div className="space-y-1 text-sm font-game-mono">
                <div className="text-easy">Easy: 50pts</div>
                <div className="text-medium">Medium: 75pts</div>
                <div className="text-hard">Hard: 100pts</div>
                <div className="text-extreme">Extreme: 150pts</div>
                <div className="text-boss">Boss: 200pts</div>
                <div className="text-xs text-text-muted mt-2">
                  Follow the keyboard patterns in sequence!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Typing Indicator */}
      {isPlaying && !isPaused && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
          animate={shouldReduceMotion ? undefined : {
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: shouldReduceMotion ? 0 : Infinity,
            ease: 'easeInOut'
          }}
        >
          <div className="w-4 h-4 bg-avoid-primary rounded-full shadow-lg shadow-avoid-primary/70" />
        </motion.div>
      )}

      {manuallyPaused && (
        <FocusDialog
          labelledBy="wordavoid-pause-title"
          onEscape={() => resumeGame('manual')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm pointer-events-auto"
        >
          <div className="glass-panel w-full max-w-md p-6 text-center sm:p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Run held safely</p>
            <h2 id="wordavoid-pause-title" className="mt-2 text-3xl font-game-display font-black text-avoid-primary">Paused</h2>
            <p className="mt-3 text-sm text-text-secondary">The clock and incoming words are frozen. Resume when your hands are ready.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <NeonButton onClick={() => resumeGame('manual')}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </NeonButton>
              <NeonButton variant="secondary" onClick={onMainMenu}>
                Main menu
              </NeonButton>
            </div>
          </div>
        </FocusDialog>
      )}
    </div>
  );
};
