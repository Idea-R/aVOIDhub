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
import { PauseController } from "../../game/PauseController";
import { SoundManager } from "../../game/SoundManager";
import { FrameMonitor } from "../../game/FrameMonitor";
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
  const [exitDialogOpen, setExitDialogOpenState] = useState(false);
  const showHelpRef = useRef(showHelp);
  const [audioEnabled, setAudioEnabled] = useState(
    () => window.localStorage.getItem("wreckavoid:audio") !== "muted",
  );
  const soundManagerRef = useRef(new SoundManager(audioEnabled));
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reducedMotionRef = useRef(reducedMotion);

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
  const frameMonitorRef = useRef(new FrameMonitor());
  const runCompletionRef = useRef(new RunCompletionGate());
  const pauseControllerRef = useRef(new PauseController());
  const toggleManualPauseRef = useRef<() => void>(() => undefined);
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
    width: 1,
    height: 1,
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
  showHelpRef.current = showHelp;
  reducedMotionRef.current = reducedMotion;

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

  useEffect(
    () => () => {
      soundManagerRef.current.destroy();
    },
    [],
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      particleSystemRef.current.setReducedMotion(event.matches);
      setReducedMotion(event.matches);
    };
    particleSystemRef.current.setReducedMotion(preference.matches);
    preference.addEventListener("change", handleChange);
    return () => preference.removeEventListener("change", handleChange);
  }, []);

  // Own the bitmap from the rendered canvas so dynamic viewport chrome,
  // orientation, safe areas, and CSS layout all share one source of truth.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextSize = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
      const currentSize = canvasSizeRef.current;
      if (
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
      ) {
        return;
      }
      canvasSizeRef.current = nextSize;
      inputManagerRef.current?.resize(nextSize.width, nextSize.height);
      setCanvasSize(nextSize);
    };

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(canvas);
    window.visualViewport?.addEventListener("resize", syncCanvasSize);
    window.visualViewport?.addEventListener("scroll", syncCanvasSize);
    window.addEventListener("orientationchange", syncCanvasSize);
    syncCanvasSize();

    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", syncCanvasSize);
      window.visualViewport?.removeEventListener("scroll", syncCanvasSize);
      window.removeEventListener("orientationchange", syncCanvasSize);
    };
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
          toggleManualPauseRef.current();
        }
        if (key === "KeyH") {
          toggleHelpRef.current();
        }
      },
      onMouseDown: () => {
        void soundManagerRef.current.resume();
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
      gameStateRef.current.setState({
        isPaused: pauseControllerRef.current.set("focus", false),
      });
    };

    const handleBlur = () => {
      gameStateRef.current.setWindowFocus(false);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        gameStateRef.current.setState({
          isPaused: pauseControllerRef.current.set("focus", true),
        });
        pauseTimeoutRef.current = null;
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
    if (
      !reducedMotionRef.current &&
      effects.electrified &&
      Math.random() < 0.3
    ) {
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
      soundManagerRef.current.powerUp();
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
      soundManagerRef.current.impact(totalPoints);
    }

    const totalDamage = playerCollisions.damage + projectileCollisions.damage;
    if (totalDamage > 0) {
      gameStateRef.current.updateHealth(totalDamage);
      soundManagerRef.current.damage();
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
    if (!reducedMotionRef.current) {
      renderer.drawParticles(particleSystemRef.current);
    }
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
    soundManagerRef.current.gameOver();
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
      frameMonitorRef.current.observe(currentTime);

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
    pauseControllerRef.current.reset();
    clockRef.current.reset();
    frameMonitorRef.current.reset();
    gameStateRef.current.reset();
    showHelpRef.current = false;
    setShowHelp(false);
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
    const nextVisible = !showHelpRef.current;
    showHelpRef.current = nextVisible;
    setShowHelp(nextVisible);
    gameStateRef.current.setState({
      isPaused: pauseControllerRef.current.set("help", nextVisible),
    });
  };

  const toggleManualPause = () => {
    soundManagerRef.current.pause();
    gameStateRef.current.setState({
      isPaused: pauseControllerRef.current.toggleManual(),
    });
  };

  toggleManualPauseRef.current = toggleManualPause;
  toggleHelpRef.current = toggleHelp;

  const toggleAudio = () => {
    const nextEnabled = !soundManagerRef.current.isEnabled();
    setAudioEnabled(nextEnabled);
    window.localStorage.setItem(
      "wreckavoid:audio",
      nextEnabled ? "enabled" : "muted",
    );
    void soundManagerRef.current.setEnabled(nextEnabled);
  };

  const setExitDialogOpen = (open: boolean) => {
    setExitDialogOpenState(open);
    gameStateRef.current.setState({
      isPaused: pauseControllerRef.current.set("exit", open),
    });
  };

  const forceGameOverForSmoke = () => {
    const state = gameStateRef.current.getState();
    gameStateRef.current.updateHealth(state.health);
    finishCurrentRunRef.current();
  };

  const setFocusPauseForSmoke = (active: boolean) => {
    gameStateRef.current.setWindowFocus(!active);
    gameStateRef.current.setState({
      isPaused: pauseControllerRef.current.set("focus", active),
    });
  };

  const setReducedMotionForSmoke = (active: boolean) => {
    reducedMotionRef.current = active;
    particleSystemRef.current.setReducedMotion(active);
    setReducedMotion(active);
  };

  const lifecycle = lifecycleCountersRef.current;
  const frameSample = frameMonitorRef.current.sample();
  const heapUsage = (
    window.performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }
  ).memory?.usedJSHeapSize;
  const viewportReady = canvasSize.width > 1 && canvasSize.height > 1;
  const viewportSupported = canvasSize.width >= 320 && canvasSize.height >= 320;

  useEffect(() => {
    if (!viewportReady) return;
    gameStateRef.current.setState({
      isPaused: pauseControllerRef.current.set(
        "viewport",
        !viewportSupported,
      ),
    });
  }, [viewportReady, viewportSupported]);

  return (
    <div className="relative flex h-screen h-[100dvh] w-full flex-col overflow-hidden bg-gray-900 pb-[env(safe-area-inset-bottom)]">
      <GameHUD
        gameState={gameState}
        activeEffects={activeEffects}
        playerUpgrades={playerUpgrades}
        user={user}
        onNavigate={onNavigate}
        onToggleHelp={toggleHelp}
        onTogglePause={toggleManualPause}
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
        onExitDialogChange={setExitDialogOpen}
      />

      <p id="wreckavoid-playfield-instructions" className="sr-only">
        Move with the pointer or touch. Hold to retract the chain. Press Space
        to pause and H for help.
      </p>

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        tabIndex={0}
        aria-label="WreckaVOID playfield"
        aria-describedby="wreckavoid-playfield-instructions"
        className="block min-h-0 w-full flex-1 touch-none bg-gray-800"
      >
        WreckaVOID is a physics survival game. Use a modern browser with canvas
        support to play.
      </canvas>

      <GameOverlays
        gameState={gameState}
        showHelp={showHelp}
        user={user}
        exitDialogOpen={exitDialogOpen}
        viewportSupported={viewportSupported}
        onToggleHelp={toggleHelp}
        onTogglePause={toggleManualPause}
        onRestartGame={restartGame}
      />

      {!gameState.isPaused &&
        !gameState.isGameOver &&
        !showHelp &&
        gameState.gameTime < 6 &&
        gameState.score === 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 w-[min(90vw,34rem)] -translate-x-1/2 text-center"
          >
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-gray-950/75 px-4 py-2 text-xs font-medium text-gray-200 shadow-xl backdrop-blur-sm motion-reduce:transition-none sm:text-sm">
              <span>
                <strong className="text-cyan-300">Drag</strong> to steer
              </span>
              <span aria-hidden="true" className="text-gray-500">
                •
              </span>
              <span>
                <strong className="text-orange-300">Hold</strong> to pull in
              </span>
              <span aria-hidden="true" className="text-gray-500">
                •
              </span>
              <span>
                <strong className="text-yellow-300">Swing</strong> to strike
              </span>
            </p>
          </div>
        )}

      {viewportReady && !viewportSupported && (
        <section
          role="status"
          aria-label="Viewport not supported"
          className="absolute inset-0 z-[70] flex items-center justify-center bg-gray-950/95 p-6 text-center text-white"
        >
          <div className="max-w-sm">
            <h2 className="text-2xl font-bold">Give the wrecking ball room.</h2>
            <p className="mt-3 text-sm text-gray-300">
              Rotate your device or make this window a little taller. WreckaVOID
              needs at least a 320 × 320 playfield to keep the action readable.
            </p>
          </div>
        </section>
      )}

      {smokeMode && (
        <aside
          aria-label="Development smoke controls"
          className="pointer-events-none absolute bottom-2 left-2 z-[60] rounded border border-cyan-400/50 bg-gray-950/90 p-2 text-[10px] text-cyan-100"
        >
          <button
            type="button"
            onClick={forceGameOverForSmoke}
            className="pointer-events-auto rounded bg-cyan-700 px-2 py-1 font-semibold text-white"
          >
            Force game over
          </button>
          <button
            type="button"
            onClick={() => setFocusPauseForSmoke(true)}
            className="pointer-events-auto ml-1 rounded bg-gray-700 px-2 py-1 font-semibold text-white"
          >
            Simulate focus loss
          </button>
          <button
            type="button"
            onClick={() => setFocusPauseForSmoke(false)}
            className="pointer-events-auto ml-1 rounded bg-gray-700 px-2 py-1 font-semibold text-white"
          >
            Simulate focus return
          </button>
          <button
            type="button"
            onClick={() => setReducedMotionForSmoke(!reducedMotionRef.current)}
            className="pointer-events-auto ml-1 rounded bg-gray-700 px-2 py-1 font-semibold text-white"
          >
            Toggle reduced motion
          </button>
          <output className="ml-2" aria-label="Lifecycle owners">
            RAF {lifecycle.rafOwners} · input {lifecycle.inputOwners} · timers{" "}
            {deferredSetupRef.current.size} · finishes{" "}
            {lifecycle.finishTransitions} · restarts {lifecycle.restarts}
            {" · pauses "}
            {pauseControllerRef.current.activeReasons().join("+") || "none"}
            {" · motion "}
            {reducedMotion ? "reduced" : "standard"}
            {" · frame avg/p95/max "}
            {frameSample.averageMs.toFixed(1)}/
            {frameSample.p95Ms.toFixed(1)}/{frameSample.maxMs.toFixed(1)}ms
            {" · long "}
            {frameSample.longFrames}
            {heapUsage !== undefined && (
              <>
                {" · heap "}
                {(heapUsage / 1024 / 1024).toFixed(2)}MB
              </>
            )}
          </output>
        </aside>
      )}
    </div>
  );
}
