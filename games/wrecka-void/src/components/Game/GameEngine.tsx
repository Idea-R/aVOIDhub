import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { PowerUpManager } from './PowerUpManager';
import { PowerUp, PlayerUpgrades, ActiveEffects } from '../../types/PowerUps';
import { Vector2, ChainSegment, SecondChain, DEFAULT_GAME_CONFIG } from '../../types/Game';
import { GameStateManager } from '../../game/GameState';
import { InputManager } from '../../game/InputManager';
import { PhysicsEngine } from '../../game/PhysicsEngine';
import { ParticleSystem } from '../../game/ParticleSystem';
import { CollisionDetection } from '../../game/CollisionDetection';
import { EnemyManager } from '../../game/EnemyManager';
import { GameRenderer } from '../../game/GameRenderer';
import { GameHUD } from './GameHUD';
import { GameOverlays } from './GameOverlays';

interface GameEngineProps {
  onNavigate: (page: string) => void;
}

export function GameEngine({ onNavigate }: GameEngineProps) {
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
  const lastTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas dimensions
  const [canvasSize, setCanvasSize] = useState({ 
    width: window.innerWidth,
    height: window.innerHeight - 40  // Further reduced to 40 for more game space
  });

  // Initialize game state subscription
  useEffect(() => {
    const unsubscribe = gameStateRef.current.subscribe(setGameState);
    return unsubscribe;
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight - 40 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize canvas-dependent systems
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize systems
    inputManagerRef.current = new InputManager(canvas);
    gameRendererRef.current = new GameRenderer(canvas);

    // Setup input listeners
    inputManagerRef.current.setListeners({
      onKeyDown: (key: string) => {
        if (key === 'Space') {
          gameStateRef.current.togglePause();
        }
        if (key === 'KeyH') {
          setShowHelp(!showHelp);
        }
      },
    });

    // Initialize chain
    initializeChain();

    return () => {
      inputManagerRef.current?.destroy();
    };
  }, [canvasSize, showHelp]);

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

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const initializeChain = () => {
    const baseChainLength = DEFAULT_GAME_CONFIG.chainLength + (playerUpgrades.chainExtensions * 3);
    const chain: ChainSegment[] = [];
    for (let i = 0; i < baseChainLength; i++) {
      chain.push({
        pos: { 
          x: canvasSize.width / 2, 
          y: canvasSize.height / 2 + i * DEFAULT_GAME_CONFIG.chainSegmentDistance 
        },
        oldPos: { 
          x: canvasSize.width / 2, 
          y: canvasSize.height / 2 + i * DEFAULT_GAME_CONFIG.chainSegmentDistance 
        },
      });
    }
    chainRef.current = chain;
    ballRef.current = { 
      x: canvasSize.width / 2, 
      y: canvasSize.height / 2 + baseChainLength * DEFAULT_GAME_CONFIG.chainSegmentDistance 
    };
    playerRef.current = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    
    // Initialize second chain if available
    if (playerUpgrades.hasSecondChain) {
      initializeSecondChain();
    }
  };

  const initializeSecondChain = () => {
    if (!playerUpgrades.hasSecondChain) return;
    
    const secondChainSegments: ChainSegment[] = [];
    for (let i = 0; i < DEFAULT_GAME_CONFIG.secondChainLength; i++) {
      secondChainSegments.push({
        pos: { 
          x: canvasSize.width / 2 + 50, 
          y: canvasSize.height / 2 + i * DEFAULT_GAME_CONFIG.secondChainDistance 
        },
        oldPos: { 
          x: canvasSize.width / 2 + 50, 
          y: canvasSize.height / 2 + i * DEFAULT_GAME_CONFIG.secondChainDistance 
        },
      });
    }
    
    secondChainRef.current = {
      segments: secondChainSegments,
      ball: { 
        x: canvasSize.width / 2 + 50, 
        y: canvasSize.height / 2 + DEFAULT_GAME_CONFIG.secondChainLength * DEFAULT_GAME_CONFIG.secondChainDistance 
      },
      ballVelocity: { x: 0, y: 0 },
      angle: 0,
      targetAngle: 0,
    };
  };

  const applyPowerUp = (powerUp: PowerUp) => {
    if (powerUp.type === 'permanent') {
      setPlayerUpgrades(prev => ({
        chainDamage: Math.min(prev.chainDamage + (powerUp.effect.chainDamage || 0), 3),
        ballDamage: Math.min(prev.ballDamage + (powerUp.effect.ballDamage || 0), 3),
        healthIncrease: prev.healthIncrease + (powerUp.effect.healthIncrease || 0),
        speedBoost: Math.min(prev.speedBoost + (powerUp.effect.speedBoost || 0), 3),
        ballSize: Math.min(prev.ballSize + (powerUp.effect.ballSizeIncrease || 0), 2),
        chainExtensions: Math.min(prev.chainExtensions + (powerUp.effect.chainExtension ? 1 : 0), 2),
        hasSecondChain: prev.hasSecondChain || (powerUp.effect.secondChain || false),
        secondChainDamage: Math.min(prev.secondChainDamage + (powerUp.effect.secondChainDamage || 0), 3),
        secondChainSpeed: Math.min(prev.secondChainSpeed + (powerUp.effect.secondChainSpeed || 0), 2),
      }));

      if (powerUp.effect.healthIncrease) {
        const currentState = gameStateRef.current.getState();
        gameStateRef.current.setState({
          health: Math.min(
            currentState.health + powerUp.effect.healthIncrease,
            currentState.maxHealth + powerUp.effect.healthIncrease
          ),
          maxHealth: currentState.maxHealth + powerUp.effect.healthIncrease,
        });
      }
      
      // Handle chain extension - need to reinitialize chain
      if (powerUp.effect.chainExtension) {
        setTimeout(() => initializeChain(), 100); // Small delay to ensure state update
      }
      
      // Handle second chain unlock
      if (powerUp.effect.secondChain) {
        setTimeout(() => initializeSecondChain(), 100);
      }
    } else {
      // Temporary power-up
      const currentTime = Date.now();
      const endTime = currentTime + (powerUp.duration || 5000);

      setActiveEffects(prev => {
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
    setActiveEffects(prev => {
      const newEffects = { ...prev };
      let changed = false;

      Object.keys(newEffects).forEach(key => {
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
    if (gameState.isPaused) return;

    const dt = Math.min(deltaTime, 16);
    updateActiveEffects();

    const inputManager = inputManagerRef.current;
    if (!inputManager) return;

    // Update player physics
    PhysicsEngine.updatePlayerPosition(
      playerRef.current,
      inputManager.getMousePosition(),
      dt,
      playerUpgrades,
      activeEffects,
      canvasSize.width,
      canvasSize.height,
      DEFAULT_GAME_CONFIG.playerSize
    );

    // Update chain and ball physics based on hyper spin state
    if (activeEffects.hyperSpin) {
      // Special hyper spin physics
      const baseChainLength = DEFAULT_GAME_CONFIG.chainLength + (playerUpgrades.chainExtensions * 3);
      PhysicsEngine.updateChainPhysicsWithHyperSpin(
        chainRef.current,
        playerRef.current,
        ballRef.current,
        inputManager.isMouseDown(),
        DEFAULT_GAME_CONFIG.chainSegmentDistance,
        activeEffects,
        baseChainLength
      );
      
      // Update second chain with opposite rotation if available
      if (secondChainRef.current) {
        PhysicsEngine.updateSecondChainPhysicsWithHyperSpin(
          secondChainRef.current,
          playerRef.current,
          inputManager.isMouseDown(),
          DEFAULT_GAME_CONFIG.secondChainDistance,
          activeEffects,
          playerUpgrades,
          true // Opposite direction
        );
      }
    } else {
      // Normal chain physics
      PhysicsEngine.updateChainPhysics(
        chainRef.current,
        playerRef.current,
        inputManager.isMouseDown(),
        DEFAULT_GAME_CONFIG.chainSegmentDistance
      );
      
      // Update second chain physics if available
      if (secondChainRef.current) {
        PhysicsEngine.updateSecondChainPhysics(
          secondChainRef.current,
          playerRef.current,
          inputManager.isMouseDown(),
          DEFAULT_GAME_CONFIG.secondChainDistance,
          playerUpgrades,
          dt
        );
      }
      
      // Normal ball physics
      const currentBallRadius = DEFAULT_GAME_CONFIG.ballRadius + (playerUpgrades.ballSize * 8);
      PhysicsEngine.updateBallPhysics(
        ballRef.current,
        ballVelocityRef.current,
        chainRef.current[chainRef.current.length - 1],
        inputManager.isMouseDown(),
        DEFAULT_GAME_CONFIG.chainSegmentDistance,
        activeEffects,
        dt,
        canvasSize.width,
        canvasSize.height,
        currentBallRadius
      );
    }

    // Update game systems
    enemyManagerRef.current.update(dt, canvasSize.width, canvasSize.height, gameState.wave, playerRef.current);
    particleSystemRef.current.update(dt);
    powerUpManagerRef.current.update(dt, canvasSize.width, canvasSize.height, gameState.wave, playerUpgrades);
    
    // Update enemy physics separately
    PhysicsEngine.updateEnemies(enemyManagerRef.current.getEnemies(), dt, canvasSize.width, canvasSize.height);
    
    // Create electric sparks if electrified
    if (activeEffects.electrified && Math.random() < 0.3) {
      particleSystemRef.current.createElectricSparks(ballRef.current);
    }
  };

  const checkCollisions = () => {
    if (gameState.isPaused) return;

    const currentBallRadius = DEFAULT_GAME_CONFIG.ballRadius + (playerUpgrades.ballSize * 8);
    const enemies = enemyManagerRef.current.getEnemies();
    const projectiles = enemyManagerRef.current.getProjectiles();
    
    // Store current enemies before collision detection for boss drop checking
    const currentEnemies = [...enemies];

    // Check power-up collisions
    const collectedPowerUp = powerUpManagerRef.current.checkCollisions(
      playerRef.current, 
      DEFAULT_GAME_CONFIG.playerSize
    );
    if (collectedPowerUp) {
      applyPowerUp(collectedPowerUp);
    }

    // Check ball vs enemies
    const ballCollisions = CollisionDetection.checkBallEnemyCollisions(
      ballRef.current,
      currentBallRadius,
      enemies,
      playerUpgrades,
      activeEffects,
      particleSystemRef.current,
      ballVelocityRef.current
    );

    // Check chain vs enemies
    const chainCollisions = CollisionDetection.checkChainEnemyCollisions(
      chainRef.current,
      enemies,
      playerUpgrades,
      activeEffects,
      particleSystemRef.current,
      ballVelocityRef.current
    );

    // Check second chain vs enemies if available
    let secondChainCollisions = { destroyedEnemies: [], totalPoints: 0, chainWrappedEnemies: [] };
    if (secondChainRef.current) {
      secondChainCollisions = CollisionDetection.checkSecondChainEnemyCollisions(
        secondChainRef.current.segments,
        enemies,
        playerUpgrades,
        activeEffects,
        particleSystemRef.current,
        secondChainRef.current.ballVelocity
      );
    }

    // Check player vs enemies
    const playerCollisions = CollisionDetection.checkPlayerEnemyCollisions(
      playerRef.current,
      DEFAULT_GAME_CONFIG.playerSize,
      enemies,
      activeEffects,
      particleSystemRef.current
    );

    // Check player vs projectiles
    const projectileCollisions = CollisionDetection.checkProjectilePlayerCollisions(
      playerRef.current,
      DEFAULT_GAME_CONFIG.playerSize,
      projectiles,
      particleSystemRef.current
    );

    // Apply collision results
    const totalPoints = ballCollisions.totalPoints + chainCollisions.totalPoints + secondChainCollisions.totalPoints;
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
      ...playerCollisions.hitEnemies
    ];
    
    // Check for boss defeats and spawn power-ups before removing enemies
    allDestroyedEnemies.forEach(enemyIndex => {
      if (enemyIndex >= 0 && enemyIndex < currentEnemies.length) {
        const destroyedEnemy = currentEnemies[enemyIndex];
        if (destroyedEnemy.type === 'boss') {
          // Boss defeated! Spawn a guaranteed permanent power-up
          powerUpManagerRef.current.spawnBossPowerUp(
            destroyedEnemy.pos,
            canvasSize.width,
            canvasSize.height,
            playerUpgrades
          );
        }
      }
    });
    
    if (allDestroyedEnemies.length > 0) {
      enemyManagerRef.current.removeEnemies(allDestroyedEnemies);
    }
    
    // Remove hit projectiles
    if (projectileCollisions.hitProjectiles.length > 0) {
      enemyManagerRef.current.removeProjectiles(projectileCollisions.hitProjectiles);
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
      activeEffects,
      playerUpgrades
    );
    
    // Draw second chain if available
    if (secondChainRef.current) {
      renderer.drawSecondChain(
        secondChainRef.current,
        inputManager.isMouseDown(),
        activeEffects,
        playerUpgrades
      );
    }
    
    renderer.drawPlayer(playerRef.current, DEFAULT_GAME_CONFIG.playerSize, activeEffects);
    
    const currentBallRadius = DEFAULT_GAME_CONFIG.ballRadius + (playerUpgrades.ballSize * 8);
    renderer.drawBall(ballRef.current, currentBallRadius, activeEffects);
    renderer.drawEnemies(enemyManagerRef.current.getEnemies());
    renderer.drawMouseCursor(inputManager.getMousePosition());
  };

  const gameLoop = useCallback((currentTime: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = currentTime;
    let deltaTime = currentTime - lastTimeRef.current;
    
    if (gameState.isPaused) {
      pausedTimeRef.current += deltaTime;
      render();
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    
    if (pausedTimeRef.current > 0) {
      pausedTimeRef.current = 0;
      deltaTime = 16;
    }
    
    lastTimeRef.current = currentTime;

    if (!gameState.isGameOver) {
      gameStateRef.current.updateGameTime(deltaTime);
      gameStateRef.current.updateWave();
      updatePhysics(deltaTime);
      checkCollisions();

      if (gameState.health <= 0) {
        gameStateRef.current.setState({ isGameOver: true });
        if (user?.id) {
          submitScore(gameState.score, gameState.wave, gameState.gameTime, user.id);
        }
      }
    }

    render();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, user, submitScore, playerUpgrades, activeEffects]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const restartGame = () => {
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
    initializeChain();
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      <GameHUD 
        gameState={gameState} 
        activeEffects={activeEffects} 
        playerUpgrades={playerUpgrades} 
        user={user}
        onNavigate={onNavigate}
      />
      
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block bg-gray-800 mt-10"  // Further reduced to mt-10
      />

      <GameOverlays
        gameState={gameState}
        showHelp={showHelp}
        user={user}
        onToggleHelp={() => setShowHelp(!showHelp)}
        onTogglePause={() => gameStateRef.current.togglePause()}
        onRestartGame={restartGame}
      />
    </div>
  );
}