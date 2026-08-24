import { useCallback, useEffect, useRef, useState } from 'react';
import GameEngine from '../game/core/GameEngine';
import type { GameStateData } from '../game/state/GameState';
import type { PauseReason } from '../game/core/GameLoop';
import HUD from './HUD';
import GameOverScreen from './GameOverScreen';
import { VOIDAVOID_RULESET, type RunEvidenceSummary } from '../game/run/runEvidence';
import { type SoundManager, type SoundStatus } from '../game/presentation/SoundManager';
import type { MotionPreference } from '../game/presentation/preferences';
import GameDialog from './GameDialog';

interface GameProps {
  autoStart?: boolean;
  onExit: () => void;
  sound: SoundManager;
  soundEnabled: boolean;
  soundStatus: SoundStatus;
  reducedMotion: boolean;
  motionPreference: MotionPreference;
  onToggleSound: () => void;
  onToggleMotion: () => void;
  onSoundStatusChange: (status: SoundStatus) => void;
}

const LOCAL_BEST_KEY = 'voidavoid-local-best-v1';

const initialGameState: GameStateData = {
  score: 0,
  scoreBreakdown: { survival: 0, meteors: 0, combos: 0, total: 0 },
  comboInfo: {
    count: 0,
    isActive: false,
    lastKnockbackTime: 0,
    highestCombo: 0,
    streakMultiplier: 1,
    consecutiveKnockbacks: 0,
  },
  powerUpCharges: 0,
  maxPowerUpCharges: 3,
  time: 0,
  isGameOver: false,
  fps: 0,
  meteors: 0,
  particles: 0,
  poolSizes: { meteors: 0, particles: 0 },
  autoScaling: { enabled: true, shadowsEnabled: true, maxParticles: 300, adaptiveTrailsActive: true },
  performance: { averageFrameTime: 0, memoryUsage: 0, lastScalingEvent: 'none' },
  settings: {
    volume: 0,
    soundEnabled: false,
    showUI: true,
    showFPS: false,
    showPerformanceStats: false,
    showTrails: false,
    performanceMode: false,
    cursorColor: '#06b6d4',
  },
  run: {
    ruleset: VOIDAVOID_RULESET,
    seed: '00000000',
    code: 'PENDING',
    eventCount: 0,
    status: 'active',
  } satisfies RunEvidenceSummary,
};

declare global {
  interface Window {
    __VOIDAVOID_SMOKE__?: {
      finish: () => void;
      diagnostics: () => ReturnType<GameEngine['getDiagnostics']> & {
        audio: ReturnType<SoundManager['getDiagnostics']>;
      };
      evidence: () => ReturnType<GameEngine['getRunEvidence']>;
    };
    __VOIDAVOID_LAST_DIAGNOSTICS__?: ReturnType<GameEngine['getDiagnostics']>;
  }
}

function readLocalBest(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(LOCAL_BEST_KEY) ?? '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export default function Game({
  autoStart = false,
  onExit,
  sound,
  soundEnabled,
  soundStatus,
  reducedMotion,
  motionPreference,
  onToggleSound,
  onToggleMotion,
  onSoundStatusChange,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState(initialGameState);
  const [pauseReasons, setPauseReasons] = useState<PauseReason[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [localBest, setLocalBest] = useState(readLocalBest);
  const [qaRefresh, setQaRefresh] = useState(0);
  const reducedMotionRef = useRef(reducedMotion);
  const previousSoundStateRef = useRef({ score: 0, charges: 0, isGameOver: false });

  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    engine.setReducedMotion(reducedMotionRef.current);
    engine.setStateUpdateCallback(setGameState);
    engine.setPauseChangeCallback((_isPaused, reasons) => setPauseReasons(reasons));

    if (import.meta.env.DEV && window.location.search.includes('smoke=1')) {
      window.__VOIDAVOID_SMOKE__ = {
        finish: () => engine.forceGameOverForTest(),
        diagnostics: () => ({ ...engine.getDiagnostics(), audio: sound.getDiagnostics() }),
        evidence: () => engine.getRunEvidence(),
      };
    }

    if (autoStart) engine.start();

    return () => {
      delete window.__VOIDAVOID_SMOKE__;
      engine.stop();
      window.__VOIDAVOID_LAST_DIAGNOSTICS__ = engine.getDiagnostics();
      engineRef.current = null;
    };
  }, [autoStart, sound]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const previous = previousSoundStateRef.current;
    if (gameState.isGameOver && !previous.isGameOver) {
      sound.play('game-over');
    } else if (gameState.powerUpCharges > previous.charges) {
      sound.play('charge');
    } else if (gameState.score > previous.score) {
      const delta = gameState.score - previous.score;
      sound.play('impact', Math.min(1, delta / 100));
    }
    previousSoundStateRef.current = {
      score: gameState.score,
      charges: gameState.powerUpCharges,
      isGameOver: gameState.isGameOver,
    };
  }, [gameState.isGameOver, gameState.powerUpCharges, gameState.score, sound]);

  useEffect(() => {
    if (!gameState.isGameOver) return;
    const nextBest = Math.max(localBest, gameState.score);
    setLocalBest(nextBest);
    try {
      localStorage.setItem(LOCAL_BEST_KEY, nextBest.toString());
    } catch {
      // A blocked storage layer does not block replay.
    }
  }, [gameState.isGameOver, gameState.score, localBest]);

  const toggleManualPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || gameState.isGameOver) return;
    sound.play('pause');
    if (pauseReasons.includes('manual')) {
      engine.resume('manual');
      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
    } else engine.pause('manual');
  }, [gameState.isGameOver, pauseReasons, sound]);

  const showControls = useCallback(() => {
    if (gameState.isGameOver) return;
    engineRef.current?.pause('help');
    setShowHelp(true);
  }, [gameState.isGameOver]);

  const closeControls = useCallback(() => {
    setShowHelp(false);
    engineRef.current?.resume('help');
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || gameState.isGameOver) return;
      event.preventDefault();
      if (showHelp) closeControls();
      else toggleManualPause();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeControls, gameState.isGameOver, showHelp, toggleManualPause]);

  const playAgain = useCallback(() => {
    setShowHelp(false);
    sound.play('start');
    engineRef.current?.resetGame();
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, [sound]);

  const exitGame = useCallback(() => {
    onExit();
  }, [onExit]);

  const isPaused = pauseReasons.length > 0;

  const retrySound = useCallback(async () => {
    onSoundStatusChange(await sound.activate());
  }, [onSoundStatusChange, sound]);

  return (
    <div className="void-game" data-paused={isPaused ? 'true' : 'false'}>
      <canvas
        ref={canvasRef}
        className="void-game__canvas"
        aria-label="VOIDaVOID meteor field"
        aria-describedby="void-field-instructions"
        tabIndex={0}
      />
      <p id="void-field-instructions" className="void-visually-hidden">
        Move a pointer or drag one finger to steer. Double-click or double-tap to use a pulse. Press Escape to pause.
      </p>

      {!gameState.isGameOver && !isPaused && (
        <HUD
          score={gameState.score}
          time={gameState.time}
          powerUpCharges={gameState.powerUpCharges}
          maxPowerUpCharges={gameState.maxPowerUpCharges}
          isPaused={pauseReasons.includes('manual')}
          onTogglePause={toggleManualPause}
          onShowHelp={showControls}
          onExit={exitGame}
          soundEnabled={soundEnabled}
          soundStatus={soundStatus}
          onToggleSound={onToggleSound}
        />
      )}

      {isPaused && !showHelp && !gameState.isGameOver && (
        <GameDialog labelledBy="void-pause-title" describedBy="void-pause-copy">
            <p className="void-kicker">Field suspended</p>
            <h2 id="void-pause-title">Take a breath.</h2>
            <p id="void-pause-copy">The storm is frozen. Your time and score are not moving.</p>
            <button type="button" className="void-launch" onClick={toggleManualPause}>
              Resume
            </button>
        </GameDialog>
      )}

      {showHelp && !gameState.isGameOver && (
        <GameDialog labelledBy="void-help-title" describedBy="void-help-copy">
            <p className="void-kicker">Field controls</p>
            <h2 id="void-help-title">Move deliberately.</h2>
            <ul id="void-help-copy">
              <li>Move the pointer—or drag one finger—to steer the signal.</li>
              <li>Double-click or double-tap to spend a pulse charge and knock meteors away.</li>
              <li>Colorful fragments build a full-field chain detonation.</li>
              <li>Escape pauses. Leaving the tab pauses without clearing your manual pause.</li>
            </ul>
            <div className="void-dialog-settings" role="group" aria-label="Play preferences">
              <button type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>
                Sound {soundEnabled ? 'on' : 'off'}
              </button>
              <button type="button" aria-pressed={motionPreference === 'reduced'} onClick={onToggleMotion}>
                Motion {reducedMotion ? 'reduced' : 'system'}
              </button>
            </div>
            {soundStatus === 'unavailable' && (
              <p className="void-audio-notice" role="status">
                Audio did not start. Play stays available.
                <button type="button" onClick={retrySound}>Retry sound</button>
              </p>
            )}
            <button type="button" className="void-launch" onClick={closeControls}>
              Back to the field
            </button>
        </GameDialog>
      )}

      {gameState.isGameOver && (
        <GameOverScreen
          score={gameState.score}
          localBest={localBest}
          scoreBreakdown={gameState.scoreBreakdown}
          comboInfo={gameState.comboInfo}
          run={gameState.run}
          onPlayAgain={playAgain}
          onExit={exitGame}
        />
      )}

      {import.meta.env.DEV && window.location.search.includes('smoke=1') && (
        <div className="void-smoke-controls" aria-hidden="true">
          <button
            type="button"
            data-testid="void-smoke-finish"
            aria-label="End run for QA"
            tabIndex={-1}
            onClick={() => engineRef.current?.forceGameOverForTest()}
          >QA</button>
          <button
            type="button"
            data-testid="void-smoke-refresh"
            aria-label="Refresh QA diagnostics"
            tabIndex={-1}
            onClick={() => setQaRefresh((count) => count + 1)}
          >R</button>
          <output
            data-testid="void-smoke-diagnostics"
            data-refresh={qaRefresh}
            data-diagnostics={JSON.stringify(engineRef.current
              ? { ...engineRef.current.getDiagnostics(), audio: sound.getDiagnostics() }
              : null)}
          />
        </div>
      )}
    </div>
  );
}
