import { useCallback, useEffect, useRef, useState } from 'react';
import GameEngine from '../game/core/GameEngine';
import type { GameStateData } from '../game/state/GameState';
import type { PauseReason } from '../game/core/GameLoop';
import HUD from './HUD';
import GameOverScreen from './GameOverScreen';

interface GameProps {
  autoStart?: boolean;
  onExit: () => void;
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
};

declare global {
  interface Window {
    __VOIDAVOID_SMOKE__?: {
      finish: () => void;
      diagnostics: () => ReturnType<GameEngine['getDiagnostics']>;
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

export default function Game({ autoStart = false, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState(initialGameState);
  const [pauseReasons, setPauseReasons] = useState<PauseReason[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [localBest, setLocalBest] = useState(readLocalBest);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    engine.setStateUpdateCallback(setGameState);
    engine.setPauseChangeCallback((_isPaused, reasons) => setPauseReasons(reasons));

    if (import.meta.env.DEV && window.location.search.includes('smoke=1')) {
      window.__VOIDAVOID_SMOKE__ = {
        finish: () => engine.forceGameOverForTest(),
        diagnostics: () => engine.getDiagnostics(),
      };
    }

    if (autoStart) engine.start();

    return () => {
      delete window.__VOIDAVOID_SMOKE__;
      engine.stop();
      window.__VOIDAVOID_LAST_DIAGNOSTICS__ = engine.getDiagnostics();
      engineRef.current = null;
    };
  }, [autoStart]);

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
    if (pauseReasons.includes('manual')) engine.resume('manual');
    else engine.pause('manual');
  }, [gameState.isGameOver, pauseReasons]);

  const showControls = useCallback(() => {
    if (gameState.isGameOver) return;
    engineRef.current?.pause('help');
    setShowHelp(true);
  }, [gameState.isGameOver]);

  const closeControls = useCallback(() => {
    setShowHelp(false);
    engineRef.current?.resume('help');
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
    engineRef.current?.resetGame();
    setGameState(initialGameState);
  }, []);

  const exitGame = useCallback(() => {
    onExit();
  }, [onExit]);

  const isPaused = pauseReasons.length > 0;

  return (
    <div className="void-game" data-paused={isPaused ? 'true' : 'false'}>
      <canvas ref={canvasRef} className="void-game__canvas" aria-label="VOIDaVOID meteor field" />

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
        />
      )}

      {isPaused && !showHelp && !gameState.isGameOver && (
        <div className="void-dialog-backdrop">
          <section className="void-pause" role="dialog" aria-modal="true" aria-labelledby="void-pause-title">
            <p className="void-kicker">Field suspended</p>
            <h2 id="void-pause-title">Take a breath.</h2>
            <p>The storm is frozen. Your time and score are not moving.</p>
            <button type="button" className="void-launch" onClick={toggleManualPause} autoFocus>
              Resume
            </button>
          </section>
        </div>
      )}

      {showHelp && !gameState.isGameOver && (
        <div className="void-dialog-backdrop">
          <section className="void-pause" role="dialog" aria-modal="true" aria-labelledby="void-help-title">
            <p className="void-kicker">Field controls</p>
            <h2 id="void-help-title">Move deliberately.</h2>
            <ul>
              <li>Move the pointer—or drag one finger—to steer the signal.</li>
              <li>Double-click or double-tap to spend a pulse charge and knock meteors away.</li>
              <li>Colorful fragments build a full-field chain detonation.</li>
              <li>Escape pauses. Leaving the tab pauses without clearing your manual pause.</li>
            </ul>
            <button type="button" className="void-launch" onClick={closeControls} autoFocus>
              Back to the field
            </button>
          </section>
        </div>
      )}

      {gameState.isGameOver && (
        <GameOverScreen
          score={gameState.score}
          localBest={localBest}
          scoreBreakdown={gameState.scoreBreakdown}
          comboInfo={gameState.comboInfo}
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
          <output
            data-testid="void-smoke-diagnostics"
            data-diagnostics={JSON.stringify(engineRef.current?.getDiagnostics() ?? null)}
          />
        </div>
      )}
    </div>
  );
}
