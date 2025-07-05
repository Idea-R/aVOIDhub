import { Vector2, ChainSegment, Enemy } from '../types/Game';
import { Vector2, ChainSegment, Enemy, SecondChain } from '../types/Game';
import { PlayerUpgrades, ActiveEffects } from '../types/PowerUps';

export class PhysicsEngine {
  static distance(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static normalize(v: Vector2): Vector2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
  }

  static updatePlayerPosition(
    player: Vector2,
    mouse: Vector2,
    deltaTime: number,
    playerUpgrades: PlayerUpgrades,
    activeEffects: ActiveEffects,
    canvasWidth: number,
    canvasHeight: number,
    playerSize: number
  ): void {
    const dt = deltaTime / 1000;
    const mouseDistance = this.distance(player, mouse);
    const maxDistance = 60;
    const minDistance = 15;
    
    if (mouseDistance > minDistance) {
      const direction = this.normalize({
        x: mouse.x - player.x,
        y: mouse.y - player.y,
      });
      
      const tensionFactor = Math.min(mouseDistance / maxDistance, 2.0);
      let moveSpeed = 120 * tensionFactor;
      
      // Apply speed boosts
      moveSpeed *= (1 + playerUpgrades.speedBoost * 0.3);
      if (activeEffects.tempSpeed) {
        moveSpeed *= activeEffects.tempSpeed.speedMultiplier;
      }
      
      player.x += direction.x * moveSpeed * dt;
      player.y += direction.y * moveSpeed * dt;
    }

    // Constrain player to canvas
    const padding = playerSize + 10;
    player.x = Math.max(padding, Math.min(canvasWidth - padding, player.x));
    player.y = Math.max(padding, Math.min(canvasHeight - padding, player.y));
  }

  static updateChainPhysics(
    chain: ChainSegment[],
    player: Vector2,
    isRetracting: boolean,
    chainSegmentDistance: number
  ): void {
    const damping = 0.998;
    const targetDistance = isRetracting ? chainSegmentDistance * 0.6 : chainSegmentDistance;

    // First segment follows player
    chain[0].oldPos = { ...chain[0].pos };
    chain[0].pos = { ...player };

    // Update other segments with verlet integration
    for (let i = 1; i < chain.length; i++) {
      const segment = chain[i];
      const velocity = {
        x: (segment.pos.x - segment.oldPos.x) * damping,
        y: (segment.pos.y - segment.oldPos.y) * damping,
      };
      
      segment.oldPos = { ...segment.pos };
      segment.pos.x += velocity.x;
      segment.pos.y += velocity.y;
    }

    // Apply constraints
    for (let iteration = 0; iteration < 4; iteration++) {
      for (let i = 0; i < chain.length - 1; i++) {
        const current = chain[i];
        const next = chain[i + 1];
        const dist = this.distance(current.pos, next.pos);
        
        if (Math.abs(dist - targetDistance) > 1) {
          const difference = dist - targetDistance;
          const percent = (difference / dist) * 0.5;
          const offset = {
            x: (next.pos.x - current.pos.x) * percent,
            y: (next.pos.y - current.pos.y) * percent,
          };
          
          current.pos.x += offset.x;
          current.pos.y += offset.y;
          next.pos.x -= offset.x;
          next.pos.y -= offset.y;
          
          if (isRetracting && i === 0) {
            const pullForce = 0.3;
            player.x += offset.x * pullForce;
            player.y += offset.y * pullForce;
          }
        }
      }
    }
  }

  static updateBallPhysics(
    ball: Vector2,
    ballVelocity: Vector2,
    lastChainSegment: ChainSegment,
    isRetracting: boolean,
    chainSegmentDistance: number,
    activeEffects: ActiveEffects,
    deltaTime: number,
    canvasWidth: number,
    canvasHeight: number,
    ballRadius: number
  ): void {
    const dt = deltaTime / 1000;
    
    // Handle hyper spin effect differently
    if (activeEffects.hyperSpin) {
      // In hyper spin mode, the ball spins around the player at maximum tension
      const player = lastChainSegment.pos; // This should be the player position
      const currentDistance = this.distance(player, ball);
      const targetDistance = isRetracting ? chainSegmentDistance * 0.6 : chainSegmentDistance;
      
      // Maintain distance from player
      if (Math.abs(currentDistance - targetDistance) > 5) {
        const direction = this.normalize({
          x: ball.x - player.x,
          y: ball.y - player.y,
        });
        ball.x = player.x + direction.x * targetDistance;
        ball.y = player.y + direction.y * targetDistance;
      }
      
      // Apply strong tangential force to create spinning motion
      const directionToPlayer = this.normalize({
        x: player.x - ball.x,
        y: player.y - ball.y,
      });
      
      // Perpendicular direction for spinning (tangent to the circle)
      const tangentDirection = {
        x: -directionToPlayer.y,
        y: directionToPlayer.x,
      };
      
      // Apply strong spinning force
      const spinForce = 800;
      ballVelocity.x += tangentDirection.x * spinForce * dt;
      ballVelocity.y += tangentDirection.y * spinForce * dt;
      
      // Apply centripetal force to keep it in circular motion
      const centripetalForce = 400;
      ballVelocity.x += directionToPlayer.x * centripetalForce * dt;
      ballVelocity.y += directionToPlayer.y * centripetalForce * dt;
      
      // Update ball position
      ball.x += ballVelocity.x * dt;
      ball.y += ballVelocity.y * dt;
      
      // Apply strong damping to prevent the ball from flying away
      ballVelocity.x *= 0.85;
      ballVelocity.y *= 0.85;
      
      return; // Skip normal ball physics when in hyper spin mode
    }
    
    const ballTargetDistance = isRetracting ? chainSegmentDistance * 0.6 : chainSegmentDistance;
    
    // Constrain ball to last chain segment
    const ballDist = this.distance(lastChainSegment.pos, ball);
    if (Math.abs(ballDist - ballTargetDistance) > 1) {
      const difference = ballDist - ballTargetDistance;
      const percent = difference / ballDist;
      const offset = {
        x: (ball.x - lastChainSegment.pos.x) * percent * 0.5,
        y: (ball.y - lastChainSegment.pos.y) * percent * 0.5,
      };
      
      ball.x -= offset.x;
      ball.y -= offset.y;
      lastChainSegment.pos.x += offset.x;
      lastChainSegment.pos.y += offset.y;
      
      ballVelocity.x += -offset.x * 8;
      ballVelocity.y += -offset.y * 8;
    }

    // Add momentum from chain movement
    const chainVelocity = {
      x: lastChainSegment.pos.x - lastChainSegment.oldPos.x,
      y: lastChainSegment.pos.y - lastChainSegment.oldPos.y,
    };
    
    ballVelocity.x += chainVelocity.x * 0.3;
    ballVelocity.y += chainVelocity.y * 0.3;
    
    // Update ball position
    ball.x += ballVelocity.x * dt;
    ball.y += ballVelocity.y * dt;
    
    // Apply damping
    ballVelocity.x *= 0.995;
    ballVelocity.y *= 0.995;
    
    // Allow ball to go off-screen - no boundary constraints
    // The ball can now swing freely beyond the canvas edges
  }

  static updateEnemies(enemies: Enemy[], deltaTime: number, canvasWidth: number, canvasHeight: number): void {
    const dt = deltaTime / 1000;
    enemies.forEach(enemy => {
      enemy.pos.x += enemy.velocity.x * dt;
      enemy.pos.y += enemy.velocity.y * dt;
      
      // Apply boundary bouncing for enemies that have entered the play area
      if (enemy.hasEnteredPlayArea || (
        enemy.pos.x > 0 && enemy.pos.x < canvasWidth && 
        enemy.pos.y > 0 && enemy.pos.y < canvasHeight
      )) {
        enemy.hasEnteredPlayArea = true;
        
        // Bounce off walls
        const padding = enemy.size;
        if (enemy.pos.x <= padding || enemy.pos.x >= canvasWidth - padding) {
          enemy.velocity.x *= -0.8; // Bounce with some energy loss
          enemy.pos.x = Math.max(padding, Math.min(canvasWidth - padding, enemy.pos.x));
        }
        if (enemy.pos.y <= padding || enemy.pos.y >= canvasHeight - padding) {
          enemy.velocity.y *= -0.8; // Bounce with some energy loss
          enemy.pos.y = Math.max(padding, Math.min(canvasHeight - padding, enemy.pos.y));
        }
      }
      
      // Apply friction to knocked back enemies
      if (enemy.isKnockedBack) {
        enemy.velocity.x *= 0.98;
        enemy.velocity.y *= 0.98;
        
        // Stop knockback when velocity is low enough
        const speed = Math.sqrt(enemy.velocity.x * enemy.velocity.x + enemy.velocity.y * enemy.velocity.y);
        if (speed < 20) {
          enemy.isKnockedBack = false;
        }
      }
    });
  }

  static updateChainPhysicsWithHyperSpin(
    chain: ChainSegment[],
    player: Vector2,
    ball: Vector2,
    isRetracting: boolean,
    chainSegmentDistance: number,
    activeEffects: ActiveEffects,
    chainLength: number
  ): void {
    if (!activeEffects.hyperSpin) {
      return; // Use normal chain physics
    }

    // In hyper spin mode, use normal low tension distance for safety
    const targetDistance = chainSegmentDistance; // Always use normal distance, not retracted
    
    // First segment follows player
    chain[0].oldPos = { ...chain[0].pos };
    chain[0].pos = { ...player };

    // High-speed rotation like a clock arm - much faster and more visible
    const time = Date.now() * 0.008; // Increased speed significantly
    const rotationAngle = time; // Continuous fast rotation
    
    // Position each chain segment in a straight line from player outward at the rotation angle
    for (let i = 1; i < chain.length; i++) {
      const segmentDistance = i * targetDistance;
      const newX = player.x + Math.cos(rotationAngle) * segmentDistance;
      const newY = player.y + Math.sin(rotationAngle) * segmentDistance;
      
      // Direct positioning for smooth clock-like rotation
      chain[i].oldPos = { ...chain[i].pos };
      chain[i].pos.x = newX;
      chain[i].pos.y = newY;
    }
    
    // Update ball position to end of the rotating arm
    const totalChainDistance = chainLength * targetDistance;
    ball.x = player.x + Math.cos(rotationAngle) * totalChainDistance;
    ball.y = player.y + Math.sin(rotationAngle) * totalChainDistance;
  }

  static updateSecondChainPhysics(
    secondChain: SecondChain,
    player: Vector2,
    isRetracting: boolean,
    chainSegmentDistance: number,
    playerUpgrades: PlayerUpgrades,
    deltaTime: number
  ): void {
    const dt = deltaTime / 1000;
    const targetDistance = isRetracting ? chainSegmentDistance * 0.6 : chainSegmentDistance;
    
    // Update rotation speed based on upgrades
    const baseRotationSpeed = 1.5; // radians per second
    const rotationSpeed = baseRotationSpeed * (1 + playerUpgrades.secondChainSpeed * 0.5);
    
    // Update angle for continuous rotation
    secondChain.angle += rotationSpeed * dt;
    if (secondChain.angle > Math.PI * 2) {
      secondChain.angle -= Math.PI * 2;
    }
    
    // Position chain segments in a line from player outward at current angle
    for (let i = 0; i < secondChain.segments.length; i++) {
      const segment = secondChain.segments[i];
      const segmentDistance = (i + 1) * targetDistance;
      
      segment.oldPos = { ...segment.pos };
      segment.pos.x = player.x + Math.cos(secondChain.angle) * segmentDistance;
      segment.pos.y = player.y + Math.sin(secondChain.angle) * segmentDistance;
    }
    
    // Position ball at end of chain
    const ballDistance = secondChain.segments.length * targetDistance;
    const newBallX = player.x + Math.cos(secondChain.angle) * ballDistance;
    const newBallY = player.y + Math.sin(secondChain.angle) * ballDistance;
    
    // Calculate ball velocity from movement
    secondChain.ballVelocity.x = (newBallX - secondChain.ball.x) / dt;
    secondChain.ballVelocity.y = (newBallY - secondChain.ball.y) / dt;
    
    secondChain.ball.x = newBallX;
    secondChain.ball.y = newBallY;
  }

  static updateSecondChainPhysicsWithHyperSpin(
    secondChain: SecondChain,
    player: Vector2,
    isRetracting: boolean,
    chainSegmentDistance: number,
    activeEffects: ActiveEffects,
    playerUpgrades: PlayerUpgrades,
    oppositeDirection: boolean = false
  ): void {
    if (!activeEffects.hyperSpin) {
      return;
    }

    // Use normal distance for safety during hyper spin
    const targetDistance = chainSegmentDistance; // Always use normal distance
    
    // Spin in opposite direction during hyper spin for chaotic whirlwind effect
    const time = Date.now() * 0.008; // Same high speed as main chain
    const spinDirection = oppositeDirection ? -1 : 1;
    const rotationAngle = time * spinDirection; // Opposite direction creates chaos
    
    // Position chain segments in straight line like clock arm
    for (let i = 0; i < secondChain.segments.length; i++) {
      const segment = secondChain.segments[i];
      const segmentDistance = (i + 1) * targetDistance;
      
      segment.oldPos = { ...segment.pos };
      segment.pos.x = player.x + Math.cos(rotationAngle) * segmentDistance;
      segment.pos.y = player.y + Math.sin(rotationAngle) * segmentDistance;
    }
    
    // Position ball at end of rotating arm
    const ballDistance = secondChain.segments.length * targetDistance;
    secondChain.ball.x = player.x + Math.cos(rotationAngle) * ballDistance;
    secondChain.ball.y = player.y + Math.sin(rotationAngle) * ballDistance;
    
    // Calculate high tangential velocity for the spinning motion
    const tangentDirection = {
      x: -Math.sin(rotationAngle),
      y: Math.cos(rotationAngle),
    };
    
    // Very high velocity to show the intense spinning
    const spinVelocity = 600 * spinDirection;
    secondChain.ballVelocity.x = tangentDirection.x * spinVelocity;
    secondChain.ballVelocity.y = tangentDirection.y * spinVelocity;
    
    // Update the angle for consistency
    secondChain.angle = rotationAngle;
  }
}