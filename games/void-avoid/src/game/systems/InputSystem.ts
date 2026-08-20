// Extracted from Engine.ts on January 7, 2025
// Original Engine.ts: 887 lines -> Refactored into modular architecture

import { Meteor } from '../entities/Meteor';
import { CollisionSystem } from './CollisionSystem';
import { ParticleSystem } from './ParticleSystem';
import { PowerUpManager } from '../entities/PowerUp';
import { GameLogic } from '../GameLogic';
import { InputHandler } from '../InputHandler';

/**
 * InputSystem handles all input processing including meteor spawning and knockback activation.
 * Extracted from Engine.ts to maintain separation of concerns and stay under 500-line limit.
 */
export class InputSystem {
  private inputHandler: InputHandler;
  
  // System references
  private collisionSystem: CollisionSystem;
  private particleSystem: ParticleSystem;
  private powerUpManager: PowerUpManager;
  private gameLogic: GameLogic;

  constructor(
    inputHandler: InputHandler,
    collisionSystem: CollisionSystem,
    particleSystem: ParticleSystem,
    powerUpManager: PowerUpManager,
    gameLogic: GameLogic,
  ) {
    this.inputHandler = inputHandler;
    this.collisionSystem = collisionSystem;
    this.particleSystem = particleSystem;
    this.powerUpManager = powerUpManager;
    this.gameLogic = gameLogic;
    
    console.log('[INPUT] InputSystem initialized');
  }
  
  /**
   * Handle knockback activation from input
   */
  handleKnockbackActivation(): void {
    if (this.gameLogic.isGameOverState() || !this.powerUpManager.hasCharges()) {
      return;
    }

    if (!this.powerUpManager.useCharge()) {
      return;
    }

    const mousePos = this.inputHandler.getMousePosition();
    console.log('💥 Knockback activated! Remaining charges:', 
      this.powerUpManager.getCharges(), '/', this.powerUpManager.getMaxCharges());

    // Apply screen shake
    this.gameLogic.setScreenShake({ x: 0, y: 0, intensity: 15, duration: 500 });
    
    // Create cursor-colored shockwave effect
    const cursorColor = this.gameLogic.getSettings().cursorColor || '#06b6d4';
    this.particleSystem.createShockwave(mousePos.x, mousePos.y, cursorColor);

    const activeMeteors = this.gameLogic.getActiveMeteors();
    
    // Apply mild knockback effect for nearby meteors
    this.applyMildKnockback(activeMeteors, mousePos);
    
    // Use collision system for optimized knockback detection
    const knockbackResult = this.collisionSystem.processKnockbackCollisions(
      mousePos.x, 
      mousePos.y, 
      activeMeteors
    );

    console.log(`💥 Knockback result: ${knockbackResult.destroyedMeteors.length} destroyed, ${knockbackResult.pushedMeteors.length} pushed`);

    // Process destroyed meteors
    for (const meteor of knockbackResult.destroyedMeteors) {
      this.particleSystem.createExplosion(meteor.x, meteor.y, meteor.color, meteor.isSuper);
    }
    
    // Handle meteor destruction through GameLogic for proper cleanup
    if (knockbackResult.destroyedMeteors.length > 0) {
      this.gameLogic.processKnockbackDestroyedMeteors(knockbackResult.destroyedMeteors);
    }

    // Process pushed meteors
    for (const { meteor, pushForce, angle } of knockbackResult.pushedMeteors) {
      meteor.vx += Math.cos(angle) * pushForce;
      meteor.vy += Math.sin(angle) * pushForce;
    }
  }
  
  /**
   * Apply mild knockback to nearby meteors
   */
  private applyMildKnockback(activeMeteors: Meteor[], mousePos: { x: number; y: number }): void {
    const nearbyMeteors = activeMeteors.filter(meteor => {
      const dx = meteor.x - mousePos.x;
      const dy = meteor.y - mousePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= 30; // Very close proximity
    });
    
    // Apply mild force to nearby meteors
    for (const meteor of nearbyMeteors) {
      const dx = meteor.x - mousePos.x;
      const dy = meteor.y - mousePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        const force = 2; // Mild force
        const angle = Math.atan2(dy, dx);
        meteor.vx += Math.cos(angle) * force;
        meteor.vy += Math.sin(angle) * force;
      }
    }
  }
  
  /**
   * Update input system (process events, check for spawning, etc.)
   */
  update(): void {
    // Input processing is handled by InputHandler automatically
    // This method can be used for any time-based input logic if needed
  }
  
  /**
   * Clean up input system
   */
  cleanup(): void {
    console.log('[INPUT] InputSystem cleanup');
    // The InputHandler cleanup is handled by the SystemManager
  }
  
  // Getters for system access
  getInputHandler(): InputHandler {
    return this.inputHandler;
  }
  
  getMousePosition(): { x: number; y: number } {
    return this.inputHandler.getMousePosition();
  }
}
