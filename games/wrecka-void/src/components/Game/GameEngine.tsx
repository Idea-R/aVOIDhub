import { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLeaderboard } from "../../hooks/useLeaderboard";
import { PowerUpManager } from "./PowerUpManager";
import { PowerUp, PlayerUpgrades, ActiveEffects } from "../../types/PowerUps";
import {
  Vector2,
  ChainSegment,
  SecondChain,
  DEFAULT_GAME_CONFIG,
} from "../../types/Game";
import { GameStateManager } from "../../game/GameState";
import { InputManager } from "../../game/InputManager";
import { PhysicsEngine } from "../../game/PhysicsEngine";
import { ParticleSystem } from "../../game/ParticleSystem";
import { CollisionDetection } from "../../game/CollisionDetection";
import { EnemyManager } from "../../game/EnemyManager";
import { GameRenderer } from "../../game/GameRenderer";
import { FixedStepClock } from "../../game/FixedStepClock";
import { RunCompletionGate } from "../../game/RunCompletionGate";
import { GameHUD } from "./GameHUD";
import { GameOverlays } from "./GameOverlays";
import { beginPlatformRun } from "../../api/platformRuns";

interface GameEngineProps {
  onNavigate: (page: string) => void;
}

export function GameEngine({ onNavigate }: GameEngineProps) {
  const smokeMode =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("smoke");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { user } = useAuth();
  const { submitScore } = useLeaderboard();

  // Game managers
  const gameStateRef = useRef<GameStateManager>(new GameStateManager());
  const inputManagerRef = useRef<InputManager | null>(null);
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem());
  const enemyManagerRef = useRef<EnemyManager>(new EnemyManager());
  const powerUpManagerRef = useRef<PowerUpManager>(new PowerUpManager());
  const gameRendererRef = useRef<GameRenderer | null>(null);

  // Game state
  const [gameState, setGameState] = useState(gameStateRef.current.getState());
  const [showHelp, setShowHelp] = useState(false);

  // Player upgrades and effects
  const [playerUpgrades, setPlayerUpgrades] = useState<PlayerUpgrades>({
    chainDamage: 0,
    ballDamage: 0,
    healthIncrease: 0,
    speedBoost: 0,
    ballSize: 0,
    chainExtensions: 0,
    hasSecondChain: false,
    secondChainDamage: 0,
    secondChainSpeed: 0,
  });
  const [activeEffects, setActiveEffects] = useState<ActiveEffects>({});

  // Game objects
  const playerRef = useRef<Vector2>({ x: 400, y: 300 });
  const chainRef = useRef<ChainSegment[]>([]);
  const ballRef = useRef<Vector2>({ x: 400, y: 400 });
  const ballVelocityRef = useRef<Vector2>({ x: 0, y: 0 });
  const secondChainRef = useRef<SecondChain | null>(null);

  // Timing
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clockRef = useRef(new FixedStepClock());
  const runCompletionRef = useRef(new RunCompletionGate());
  const helpPausedRunRef = useRef(false);
  const toggleHelpRef = useRef<() => void>(() => undefined);
  const deferredSetupRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const updatePhysicsRef = useRef<(deltaTime: number) => void>(() => undefined);
  const checkCollisionsRef = useRef<() => void>(() => undefined);
  const renderRef = useRef<() => void>(() => undefined);
  const initializeChainRef = useRef<() => void>(() => undefined);
  const finishCurrentRunRef = useRef<() => void>(() => undefined);
  const lifecycleCountersRef = useRef({
    rafOwners: 0,
    inputOwners: 0,
    finishTransitions: 0,
    restarts: 0,
  });

  // Canvas dimensions
  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 40, // Further reduced to 40 for more game space
  });
  const canvasSizeRef = useRef(canvasSize);
  const playerUpgradesRef = useRef(playerUpgrades);
  const activeEffectsRef = useRef(activeEffects);
  const userRef = useRef(user);
  const submitScoreRef = useRef(submitScore);

  canvasSizeRef.current = canvasSize;
  playerUpgradesRef.current = playerUpgrades;
  activeEffectsRef.current = activeEffects;
  userRef.current = user;
  submitScoreRef.current = submitScore;

  // Initialize game state subscription
  useEffect(() => {
    const deferredSetups = deferredSetupRef.current;
    const unsubscribe = gameStateRef.current.subscribe(setGameState);
    runCompletionRef.current.reset();
    beginPlatformRun();
    return () => {
      unsubscribe();
      deferredSetups.forEach(clearTimeout);
      deferredSetups.clear();
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const nextSize = {
        width: window.innerWidth,
        height: window.innerHeight - 40,
      };
      canvasSizeRef.current = nextSize;
      setCanvasSize(nextSize);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize canvas-dependent systems
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lifecycleCounters = lifecycleCountersRef.current;

    // Initialize systems
    inputManagerRef.current = new InputManager(canvas);
    gameRendererRef.current = new GameRenderer(canvas);
    lifecycleCounters.inputOwners += 1;

    // Setup input listeners
    inputManagerRef.current.setListeners({
      onKeyDown: (key: string) => {
        if (key === "Space") {
          gameStateRef.current.togglePause();
        }
        if (key === "KeyH") {
          toggleHelpRef.current();
        }
      },
    });

    // Initialize chain
    initializeChainRef.current();

    return () => {
      inputManagerRef.current?.destroy();
      lifecycleCounters.inputOwners -= 1;
    };
  }, []);

  // Handle window focus/blur with delay
  useEffect(() => {
    const handleFocus = () => {
      gameStateRef.current.setWindowFocus(true);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    };

    const handleBlur = () => {
      gameStateRef.current.setWindowFocus(false);
      pauseTimeoutRef.current = setTimeout(() => {
        gameStateRef.current.setState({ isPaused: true });
      }, DEFAULT_GAME_CONFIG.pauseDelay);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      } else {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const initializeSecondChain = useCallback(() => {
    const upgrades = playerUpgradesRef.current;
    const size = canvasSizeRef.current;
    if (!upgrades.hasSecondChain) return;

    const secondChainSegments: ChainSegment[] = [];
    for (let i = 0; i < DEFAULT_GAME_CONFIG.secondChainLength; i++) {
      secondChainSegments.push({
        pos: {
          x: size.width / 2 + 50,
          y: size.height / 2 + i * DEFAULT_GAME_CONFIG.secondChainDistance,
        },
        oldPos: {
          x: size.width / 2 + 50,
          y: size.height / 2 + i * DEFAULT_GAME_CONFIG.secondChainDistance,
        },
      });
    }

    secondChainRef.current = {
      segments: secondChainSegments,
      ball: {
        x: size.width / 2 + 50,
        y:
          size.height / 2 +
          DEFAULT_GAME_CONFIG.secondChainLength *
            DEFAULT_GAME_CONFIG.secondChainDistance,
      },
      ballVelocity: { x: 0, y: 0 },
      angle: 0,
      targetAngle: 0,
    };
  }, []);

  const initializeChain = useCallback(() => {
    const upgrades = playerUpgradesRef.current;
    const size = canvasSizeRef.current;
    const baseChainLength =
      DEFAULT_GAME_CONFIG.chainLength + upgrades.chainExtensions * 3;
    const chain: ChainSegment[] = [];
    for (let i = 0; i < baseChainLength; i++) {
      chain.push({
        pos: {
          x: size.width / 2,
          y: size.height / 2 + i * DEFAULT_GAME_CONFIG.chainSegmentDistance,
        },
        oldPos: {
          x: size.width / 2,
          y: size.height / 2 + i * DEFAULT_GAME_CONFIG.chainSegmentDistance,
        },
      });
    }
    chainRef.current = chain;
    ballRef.current = {
      x: size.width / 2,
      y:
        size.height / 2 +
        baseChainLength * DEFAULT_GAME_CONFIG.chainSegmentDistance,
    };
    playerRef.current = { x: size.width / 2, y: size.height / 2 };

    // Initialize second chain if available
    if (upgrades.hasSecondChain) {
      initializeSecondChain();
    }
  }, [initializeSecondChain]);

  const deferSetup = useCallback((callback: () => void) => {
    const timeout = setTimeout(() => {
      deferredSetupRef.current.delete(timeout);
      callback();
    }, 100);
    deferredSetupRef.current.add(timeout);
  }, []);

  initializeChainRef.current = initializeChain;

  const applyPowerUp = (powerUp: PowerUp) => {
    if (powerUp.type === "permanent") {
      setPlayerUpgrades((prev) => ({
        chainDamage: Math.min(
          prev.chainDamage + (powerUp.effect.chainDamage || 0),
          3,
        ),
        ballDamage: Math.min(
          prev.ballDamage + (powerUp.effect.ballDamage || 0),
          3,
        ),
        healthIncrease:
          prev.healthIncrease + (powerUp.effect.healthIncrease || 0),
        speedBoost: Math.min(
          prev.speedBoost + (powerUp.effect.speedBoost || 0),
          3,
        ),
        ballSize: Math.min(
          prev.ballSize + (powerUp.effect.ballSizeIncrease || 0),
          2,
        ),
        chainExtensions: Math.min(
          prev.chainExtensions + (powerUp.effect.chainExtension ? 1 : 0),
          2,
        ),
        hasSecondChain:
          prev.hasSecondChain || powerUp.effect.secondChain || false,
        secondChainDamage: Math.min(
          prev.secondChainDamage + (powerUp.effect.secondChainDamage || 0),
          3,
        ),
        secondChainSpeed: Math.min(
          prev.secondChainSpeed + (powerUp.effect.secondChainSpeed || 0),
          2,
        ),
      }));

      if (powerUp.effect.healthIncrease) {
        const currentState = gameStateRef.current.getState();
        gameStateRef.current.setState({
          health: Math.min(
            currentState.health + powerUp.effect.healthIncrease,
            currentState.maxHealth + powerUp.effect.healthIncrease,
          ),
          maxHealth: currentState.maxHealth + powerUp.effect.healthIncrease,
        });
      }

      // Handle chain extension - need to reinitialize chain
      if (powerUp.effect.chainExtension) {
        deferSetup(initializeChain);
      }

      // Handle second chain unlock
      if (powerUp.effect.secondChain) {
        deferSetup(initializeSecondChain);
      }
    } else {
      // Temporary power-up
      const currentTime = Date.now();
      const endTime = currentTime + (powerUp.duration || 5000);

      setActiveEffects((prev) => {
        const newEffects = { ...prev };

        if (powerUp.effect.berserkDamage) {
          newEffects.berserk = {
            damageMultiplier: powerUp.effect.berserkDamage,
            vulnerabilityMultiplier: powerUp.effect.berserkVulnerability || 1,
            endTime,
          };
        }

        if (powerUp.effect.tempSpeedBoost) {
          newEffects.tempSpeed = {
            speedMultiplier: powerUp.effect.tempSpeedBoost,
            endTime,
          };
        }

        if (powerUp.effect.electrified) {
          newEffects.electrified = { endTime };
        }

        if (powerUp.effect.hyperSpin) {
          newEffects.hyperSpin = { endTime };
        }

        return newEffects;
      });
    }

    particleSystemRef.current.createExplosion(powerUp.pos, powerUp.color);
  };

  const updateActiveEffects = () => {
    const currentTime = Date.now();
    setActiveEffects((prev) => {
      const newEffects = { ...prev };
      let changed = false;

      Object.keys(newEffects).forEach((key) => {
        const effect = newEffects[key as keyof ActiveEffects];
        if (effect && effect.endTime <= currentTime) {
          delete newEffects[key as keyof ActiveEffects];
          changed = true;
        }
      });

      return changed ? newEffects : prev;
    });
  };

  const updatePhysics = (deltaTime: number) => {
    if (gameStateRef.current.getState().isPaused) return;

    const dt = deltaTime;
    const upgrades = playerUpgradesRef.current;
    const effects = activeEffectsRef.current;
    const size = canvasSizeRef.current;
    const state = gameStateRef.current.getState();
    updateActiveEffects();

    const inputManager = inputManagerRef.current;
    if (!inputManager) return;

    // Update player physics
    PhysicsEngine.updatePlayerPosition(
      playerRef.current,
      inputManager.getMousePosition(),
      dt,
      upgrades,
      effects,
      size.width,
      size.height,
      DEFAULT_GAME_CONFIG.playerSize,
    );

    // Update chain and ball physics based on hyper spin state
    if (effects.hyperSpin) {
      // Special hyper spin physics
      const baseChainLength =
        DEFAULT_GAME_CONFIG.chainLength + upgrades.chainExtensions * 3;
      PhysicsEngine.updateChainPhysicsWithHyperSpin(
        chainRef.current,
        playerRef.current,
        ballRef.current,
        DEFAULT_GAME_CONFIG.chainSegmentDistance,
        effects,
        baseChainLength,
      );

      // Update second chain with opposite rotation if available
      if (secondChainRef.current) {
        PhysicsEngine.updateSecondChainPhysicsWithHyperSpin(
          secondChainRef.current,
          playerRef.current,
          DEFAULT_GAME_CONFIG.secondChainDistance,
          effects,
          true, // Opposite direction
        );
      }
    } else {
      // Normal chain physics
      PhysicsEngine.updateChainPhysics(
        chainRef.current,
        playerRef.current,
        inputManager.isMouseDown(),
        DEFAULT_GAME_CONFIG.chainSegmentDistance,
      );

      // Update second chain physics if available
      if (secondChainRef.current) {
        PhysicsEngine.updateSecondChainPhysics(
          secondChainRef.current,
          playerRef.current,
          inputManager.isMouseDown(),
          DEFAULT_GAME_CONFIG.secondChainDistance,
          upgrades,
          dt,
        );
      }

      // Normal ball physics
      PhysicsEngine.updateBallPhysics(
        ballRef.current,
        ballVelocityRef.current,
        chainRef.current[chainRef.current.length - 1],
        inputManager.isMouseDown(),
        DEFAULT_GAME_CONFIG.chainSegmentDistance,
        effects,
        dt,
      );
    }

    // Update game systems
    enemyManagerRef.current.update(
      dt,
      size.width,
      size.height,
      state.wave,
      playerRef.current,
    );
    particleSystemRef.current.update(dt);
    powerUpManagerRef.current.update(
      dt,
      size.width,
      size.height,
      state.wave,
      upgrades,
    );

    // Create electric sparks if electrified
    if (effects.electrified && Math.random() < 0.3) {
      particleSystemRef.current.createElectricSparks(ballRef.current);
    }
  };

  const checkCollisions = () => {
    if (gameStateRef.current.getState().isPaused) return;

    const upgrades = playerUpgradesRef.current;
    const effects = activeEffectsRef.current;
    const currentBallRadius =
      DEFAULT_GAME_CONFIG.ballRadius + upgrades.ballSize * 8;
    const enemies = enemyManagerRef.current.getEnemies();
    const projectiles = enemyManagerRef.current.getProjectiles();

    // Store current enemies before collision detection for boss drop checking
    const currentEnemies = [...enemies];

    // Check power-up collisions
    const collectedPowerUp = powerUpManagerRef.current.checkCollisions(
      playerRef.current,
      DEFAULT_GAME_CONFIG.playerSize,
    );
    if (collectedPowerUp) {
      applyPowerUp(collectedPowerUp);
    }

    // Check ball vs enemies
    const ballCollisions = CollisionDetection.checkBallEnemyCollisions(
      ballRef.current,
      currentBallRadius,
      enemies,
      upgrades,
      effects,
      particleSystemRef.current,
      ballVelocityRef.current,
    );

    // Check chain vs enemies
    const chainCollisions = CollisionDetection.checkChainEnemyCollisions(
      chainRef.current,
      enemies,
      upgrades,
      effects,
      particleSystemRef.current,
      ballVelocityRef.current,
    );

    // Check second chain vs enemies if available
    let secondChainCollisions: {
      destroyedEnemies: number[];
      totalPoints: number;
      chainWrappedEnemies: number[];
    } = { destroyedEnemies: [], totalPoints: 0, chainWrappedEnemies: [] };
    if (secondChainRef.current) {
      secondChainCollisions =
        CollisionDetection.checkSecondChainEnemyCollisions(
          secondChainRef.current.segments,
          enemies,
          upgrades,
          effects,
          particleSystemRef.current,
        );
    }

    // Check player vs enemies
    const playerCollisions = CollisionDetection.checkPlayerEnemyCollisions(
      playerRef.current,
      DEFAULT_GAME_CONFIG.playerSize,
      enemies,
      effects,
      particleSystemRef.current,
    );

    // Check player vs projectiles
    const projectileCollisions =
      CollisionDetection.checkProjectilePlayerCollisions(
        playerRef.current,
        DEFAULT_GAME_CONFIG.playerSize,
        projectiles,
        particleSystemRef.current,
      );

    // Apply collision results
    const totalPoints =
      ballCollisions.totalPoints +
      chainCollisions.totalPoints +
      secondChainCollisions.totalPoints;
    if (totalPoints > 0) {
      gameStateRef.current.updateScore(totalPoints);
    }

    const totalDamage = playerCollisions.damage + projectileCollisions.damage;
    if (totalDamage > 0) {
      gameStateRef.current.updateHealth(totalDamage);
    }

    // Remove destroyed enemies
    const allDestroyedEnemies = [
      ...ballCollisions.destroyedEnemies,
      ...chainCollisions.destroyedEnemies,
      ...secondChainCollisions.destroyedEnemies,
      ...playerCollisions.hitEnemies,
    ];

    // Check for boss defeats and spawn power-ups before removing enemies
    allDestroyedEnemies.forEach((enemyIndex) => {
      if (enemyIndex >= 0 && enemyIndex < currentEnemies.length) {
        const destroyedEnemy = currentEnemies[enemyIndex];
        if (destroyedEnemy.type === "boss") {
          // Boss defeated! Spawn a guaranteed permanent power-up
          powerUpManagerRef.current.spawnBossPowerUp(
            destroyedEnemy.pos,
            upgrades,
          );
        }
      }
    });

    if (allDestroyedEnemies.length > 0) {
      enemyManagerRef.current.removeEnemies(allDestroyedEnemies);
    }

    // Remove hit projectiles
    if (projectileCollisions.hitProjectiles.length > 0) {
      enemyManagerRef.current.removeProjectiles(
        projectileCollisions.hitProjectiles,
      );
    }
  };

  const render = () => {
    const renderer = gameRendererRef.current;
    const inputManager = inputManagerRef.current;
    if (!renderer || !inputManager) return;

    renderer.clear();
    renderer.drawGrid();
    renderer.drawParticles(particleSystemRef.current);
    renderer.drawPowerUps(powerUpManagerRef.current);
    renderer.drawChain(
      chainRef.current,
      ballRef.current,
      inputManager.isMouseDown(),
      activeEffectsRef.current,
      playerUpgradesRef.current,
    );

    // Draw second chain if available
    if (secondChainRef.current) {
      renderer.drawSecondChain(
        secondChainRef.current,
        inputManager.isMouseDown(),
        activeEffectsRef.current,
        playerUpgradesRef.current,
      );
    }

    renderer.drawPlayer(
      playerRef.current,
      DEFAULT_GAME_CONFIG.playerSize,
      activeEffects,
    );

    const currentBallRadius =
      DEFAULT_GAME_CONFIG.ballRadius + playerUpgradesRef.current.ballSize * 8;
    renderer.drawBall(
      ballRef.current,
      currentBallRadius,
      activeEffectsRef.current,
    );
    renderer.drawEnemies(enemyManagerRef.current.getEnemies());
    renderer.drawMouseCursor(inputManager.getMousePosition());
  };

  updatePhysicsRef.current = updatePhysics;
  checkCollisionsRef.current = checkCollisions;
  renderRef.current = render;

  const finishCurrentRun = () => {
    const finalState = gameStateRef.current.getState();
    if (!runCompletionRef.current.shouldFinish(finalState.isGameOver)) return;

    lifecycleCountersRef.current.finishTransitions += 1;
    if (userRef.current?.id) {
      void submitScoreRef.current(
        finalState.score,
        finalState.wave,
        finalState.gameTime,
      );
    }
  };

  finishCurrentRunRef.current = finishCurrentRun;

  useEffect(() => {
    let running = true;
    const lifecycleCounters = lifecycleCountersRef.current;
    lifecycleCounters.rafOwners += 1;
    const gameLoop = (currentTime: number) => {
      if (!running) return;

      const state = gameStateRef.current.getState();
      clockRef.current.advance(
        currentTime,
        state.isPaused || state.isGameOver,
        (deltaTime) => {
          const frameState = gameStateRef.current.getState();
          if (frameState.isPaused || frameState.isGameOver) return;

          gameStateRef.current.updateGameTime(deltaTime);
          gameStateRef.current.updateWave();
          updatePhysicsRef.current(deltaTime);
          checkCollisionsRef.current();

          finishCurrentRunRef.current();
        },
      );

      renderRef.current();
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      running = false;
      lifecycleCounters.rafOwners -= 1;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const restartGame = () => {
    beginPlatformRun();
    lifecycleCountersRef.current.restarts += 1;
    runCompletionRef.current.reset();
    clockRef.current.reset();
    gameStateRef.current.reset();
    setPlayerUpgrades({
      chainDamage: 0,
      ballDamage: 0,
      healthIncrease: 0,
      speedBoost: 0,
      ballSize: 0,
      chainExtensions: 0,
      hasSecondChain: false,
      secondChainDamage: 0,
      secondChainSpeed: 0,
    });
    setActiveEffects({});

    enemyManagerRef.current.clear();
    particleSystemRef.current.clear();
    powerUpManagerRef.current.clear();

    ballVelocityRef.current = { x: 0, y: 0 };
    secondChainRef.current = null;
    initializeChainRef.current();
  };

  const toggleHelp = () => {
    setShowHelp((visible) => {
      const nextVisible = !visible;
      if (nextVisible) {
        const state = gameStateRef.current.getState();
        helpPausedRunRef.current = !state.isPaused;
        if (helpPausedRunRef.current) {
          gameStateRef.current.setState({ isPaused: true });
        }
      } else if (helpPausedRunRef.current) {
        helpPausedRunRef.current = false;
        gameStateRef.current.setState({ isPaused: false });
      }
      return nextVisible;
    });
  };

  toggleHelpRef.current = toggleHelp;

  const forceGameOverForSmoke = () => {
    const state = gameStateRef.current.getState();
    gameStateRef.current.updateHealth(state.health);
    finishCurrentRunRef.current();
  };

  const lifecycle = lifecycleCountersRef.current;

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      <GameHUD
        gameState={gameState}
        activeEffects={activeEffects}
        playerUpgrades={playerUpgrades}
        user={user}
        onNavigate={onNavigate}
        onToggleHelp={toggleHelp}
        onTogglePause={() => gameStateRef.current.togglePause()}
      />

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block bg-gray-800 mt-10 touch-none"
      />

      <GameOverlays
        gameState={gameState}
        showHelp={showHelp}
        user={user}
        onToggleHelp={toggleHelp}
        onTogglePause={() => gameStateRef.current.togglePause()}
        onRestartGame={restartGame}
      />

      {smokeMode && (
        <aside
          aria-label="Development smoke controls"
          className="absolute bottom-2 left-2 z-[60] rounded border border-cyan-400/50 bg-gray-950/90 p-2 text-[10px] text-cyan-100"
        >
          <button
            type="button"
            onClick={forceGameOverForSmoke}
            className="rounded bg-cyan-700 px-2 py-1 font-semibold text-white"
          >
            Force game over
          </button>
          <output className="ml-2" aria-label="Lifecycle owners">
            RAF {lifecycle.rafOwners} · input {lifecycle.inputOwners} · timers{" "}
            {deferredSetupRef.current.size} · finishes{" "}
            {lifecycle.finishTransitions} · restarts {lifecycle.restarts}
          </output>
        </aside>
      )}
    </div>
  );
}
