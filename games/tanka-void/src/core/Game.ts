import { Tank } from '../entities/Tank';
import { EnemyTank } from '../entities/EnemyTank';
import { BossTank } from '../entities/BossTank';
import { Infantry } from '../entities/Infantry';
import { Projectile } from '../entities/Projectile';
import { PowerUp } from '../entities/PowerUp';
import { Landmine } from '../entities/Landmine';
import { ParticleSystem } from '../systems/ParticleSystem';
import { TerrainSystem } from '../systems/TerrainSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { InputManager } from './InputManager';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState = 'menu';
  private lastTime = 0;
  
  // Game entities
  private player: Tank | null = null;
  private enemies: EnemyTank[] = [];
  private bosses: BossTank[] = [];
  private infantry: Infantry[] = [];
  private projectiles: Projectile[] = [];
  private powerUps: PowerUp[] = [];
  private landmines: Landmine[] = [];
  
  // Systems
  private particleSystem: ParticleSystem;
  private terrainSystem: TerrainSystem;
  private audioSystem: AudioSystem;
  private experienceSystem: ExperienceSystem | null = null;
  private inputManager: InputManager;
  
  // Camera
  private camera = { x: 0, y: 0 };
  private cameraOffset = { x: 0, y: 0 };
  private shakeIntensity = 0;
  private shakeDuration = 0;
  
  // Game state
  private score = 0;
  private wave = 1;
  private enemiesRemaining = 0;
  private comboMultiplier = 1.0;
  private comboTimer = 0;
  
  // Targeting
  private mousePos = { x: 0, y: 0 };
  private worldMousePos = { x: 0, y: 0 };
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    
    // Initialize systems
    this.particleSystem = new ParticleSystem();
    this.terrainSystem = new TerrainSystem();
    this.audioSystem = new AudioSystem();
    this.inputManager = new InputManager(this.canvas);
    
    this.setupEventListeners();
    this.resize();
  }
  
  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
      
      // Convert to world coordinates
      this.worldMousePos.x = this.mousePos.x + this.camera.x;
      this.worldMousePos.y = this.mousePos.y + this.camera.y;
    });
    
    this.canvas.addEventListener('click', (e) => {
      if (this.gameState === 'playing' && this.player) {
        this.player.setTarget(this.worldMousePos.x, this.worldMousePos.y);
      }
    });
    
    // Keyboard events
    window.addEventListener('keydown', (e) => {
      this.inputManager.handleKeyDown(e.code);
      
      if (e.code === 'Space' && this.gameState === 'menu') {
        this.startGame();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.inputManager.handleKeyUp(e.code);
    });
    
    // Window resize
    window.addEventListener('resize', () => this.resize());
  }
  
  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  public startGame(): void {
    this.gameState = 'playing';
    this.score = 0;
    this.wave = 1;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    
    // Clear all entities
    this.enemies = [];
    this.bosses = [];
    this.infantry = [];
    this.projectiles = [];
    this.powerUps = [];
    this.landmines = [];
    
    // Create player
    this.player = new Tank(this.canvas.width / 2, this.canvas.height / 2, 'player');
    this.experienceSystem = new ExperienceSystem(this.player);
    
    // Start first wave
    this.startWave();
  }
  
  private startWave(): void {
    this.enemiesRemaining = Math.floor(3 + this.wave * 1.5);
    
    // Spawn enemies
    for (let i = 0; i < this.enemiesRemaining; i++) {
      this.spawnEnemy();
    }
    
    // Spawn boss every 5 waves
    if (this.wave % 5 === 0) {
      this.spawnBoss();
    }
    
    // Spawn infantry
    const infantryCount = Math.floor(this.wave / 2);
    for (let i = 0; i < infantryCount; i++) {
      this.spawnInfantry();
    }
  }
  
  private spawnEnemy(): void {
    const margin = 100;
    let x, y;
    
    // Spawn outside visible area
    if (Math.random() < 0.5) {
      x = Math.random() < 0.5 ? -margin : this.canvas.width + margin;
      y = Math.random() * this.canvas.height;
    } else {
      x = Math.random() * this.canvas.width;
      y = Math.random() < 0.5 ? -margin : this.canvas.height + margin;
    }
    
    const enemy = new EnemyTank(x + this.camera.x, y + this.camera.y);
    this.enemies.push(enemy);
  }
  
  private spawnBoss(): void {
    const margin = 200;
    const x = this.canvas.width / 2 + this.camera.x;
    const y = -margin + this.camera.y;
    
    const boss = new BossTank(x, y);
    this.bosses.push(boss);
  }
  
  private spawnInfantry(): void {
    const margin = 50;
    const x = Math.random() * (this.canvas.width - 2 * margin) + margin + this.camera.x;
    const y = Math.random() * (this.canvas.height - 2 * margin) + margin + this.camera.y;
    
    const infantry = new Infantry(x, y);
    this.infantry.push(infantry);
  }
  
  public update(deltaTime: number): void {
    if (this.gameState !== 'playing') return;
    
    // Update camera shake
    this.updateCameraShake(deltaTime);
    
    // Update combo timer
    this.comboTimer -= deltaTime;
    if (this.comboTimer <= 0) {
      this.comboMultiplier = Math.max(1.0, this.comboMultiplier - 0.1);
    }
    
    // Update player
    if (this.player) {
      this.player.update(deltaTime, this.inputManager);
      this.updateCamera();
      
      // Update experience system
      if (this.experienceSystem) {
        this.experienceSystem.update(deltaTime);
      }
    }
    
    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (this.player) {
        enemy.update(deltaTime, this.player.getPosition());
      }
      
      if (enemy.isDead()) {
        this.enemies.splice(i, 1);
        this.enemiesRemaining--;
        this.addScore(100);
        this.addCombo();
        
        // Spawn power-up chance
        if (Math.random() < 0.3) {
          this.spawnPowerUp(enemy.getPosition());
        }
      }
    }
    
    // Update bosses
    for (let i = this.bosses.length - 1; i >= 0; i--) {
      const boss = this.bosses[i];
      if (this.player) {
        boss.update(deltaTime, this.player.getPosition());
      }
      
      if (boss.isDead()) {
        this.bosses.splice(i, 1);
        this.addScore(1000);
        this.addCombo();
        this.addScreenShake(20, 1000);
        
        // Always spawn power-up from boss
        this.spawnPowerUp(boss.getPosition());
      }
    }
    
    // Update infantry
    for (let i = this.infantry.length - 1; i >= 0; i--) {
      const infantry = this.infantry[i];
      if (this.player) {
        infantry.update(deltaTime, this.player.getPosition());
      }
      
      if (infantry.isDead()) {
        this.infantry.splice(i, 1);
        this.addScore(50);
        this.addCombo();
      }
    }
    
    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.update(deltaTime);
      
      if (projectile.shouldRemove()) {
        this.projectiles.splice(i, 1);
        continue;
      }
      
      // Check collisions
      this.checkProjectileCollisions(projectile, i);
    }
    
    // Update power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      powerUp.update(deltaTime);
      
      if (powerUp.shouldRemove()) {
        this.powerUps.splice(i, 1);
        continue;
      }
      
      // Check player collision
      if (this.player && this.checkCollision(this.player.getBounds(), powerUp.getBounds())) {
        this.applyPowerUp(powerUp);
        this.powerUps.splice(i, 1);
      }
    }
    
    // Update landmines
    for (let i = this.landmines.length - 1; i >= 0; i--) {
      const landmine = this.landmines[i];
      landmine.update(deltaTime);
      
      if (landmine.shouldRemove()) {
        this.landmines.splice(i, 1);
        continue;
      }
      
      // Check collisions with enemies
      for (const enemy of this.enemies) {
        if (this.checkCollision(enemy.getBounds(), landmine.getBounds())) {
          landmine.explode();
          this.addScreenShake(15, 500);
          break;
        }
      }
    }
    
    // Update systems
    this.particleSystem.update(deltaTime);
    
    // Check wave completion
    if (this.enemiesRemaining <= 0 && this.enemies.length === 0 && this.bosses.length === 0) {
      this.wave++;
      this.startWave();
    }
    
    // Check game over
    if (this.player && this.player.isDead()) {
      this.gameState = 'gameOver';
    }
  }
  
  private updateCamera(): void {
    if (!this.player) return;
    
    const playerPos = this.player.getPosition();
    const targetX = playerPos.x - this.canvas.width / 2;
    const targetY = playerPos.y - this.canvas.height / 2;
    
    // Smooth camera follow
    this.camera.x += (targetX - this.camera.x) * 0.1;
    this.camera.y += (targetY - this.camera.y) * 0.1;
  }
  
  private updateCameraShake(deltaTime: number): void {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      
      const intensity = this.shakeIntensity * (this.shakeDuration / 1000);
      this.cameraOffset.x = (Math.random() - 0.5) * intensity;
      this.cameraOffset.y = (Math.random() - 0.5) * intensity;
    } else {
      this.cameraOffset.x = 0;
      this.cameraOffset.y = 0;
    }
  }
  
  private checkProjectileCollisions(projectile: Projectile, projectileIndex: number): void {
    const projectileBounds = projectile.getBounds();
    
    if (projectile.getOwner() === 'player') {
      // Check enemy collisions
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (this.checkCollision(projectileBounds, enemy.getBounds())) {
          enemy.takeDamage(projectile.getDamage());
          this.projectiles.splice(projectileIndex, 1);
          this.addScreenShake(5, 200);
          
          // Add particles
          this.particleSystem.addExplosion(projectile.getPosition().x, projectile.getPosition().y);
          return;
        }
      }
      
      // Check boss collisions
      for (const boss of this.bosses) {
        if (this.checkCollision(projectileBounds, boss.getBounds())) {
          boss.takeDamage(projectile.getDamage());
          this.projectiles.splice(projectileIndex, 1);
          this.addScreenShake(8, 300);
          
          // Add particles
          this.particleSystem.addExplosion(projectile.getPosition().x, projectile.getPosition().y);
          return;
        }
      }
      
      // Check infantry collisions
      for (let i = this.infantry.length - 1; i >= 0; i--) {
        const infantry = this.infantry[i];
        if (this.checkCollision(projectileBounds, infantry.getBounds())) {
          infantry.takeDamage(projectile.getDamage());
          this.projectiles.splice(projectileIndex, 1);
          this.addScreenShake(3, 150);
          
          // Add particles
          this.particleSystem.addExplosion(projectile.getPosition().x, projectile.getPosition().y);
          return;
        }
      }
    } else {
      // Enemy projectile - check player collision
      if (this.player && this.checkCollision(projectileBounds, this.player.getBounds())) {
        this.player.takeDamage(projectile.getDamage());
        this.projectiles.splice(projectileIndex, 1);
        this.addScreenShake(10, 400);
        
        // Add particles
        this.particleSystem.addExplosion(projectile.getPosition().x, projectile.getPosition().y);
      }
    }
  }
  
  private checkCollision(rect1: Rectangle, rect2: Rectangle): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }
  
  private spawnPowerUp(position: Vector2): void {
    const powerUp = new PowerUp(position.x, position.y);
    this.powerUps.push(powerUp);
  }
  
  private applyPowerUp(powerUp: PowerUp): void {
    if (!this.player) return;
    
    switch (powerUp.getType()) {
      case 'health':
        this.player.heal(50);
        break;
      case 'damage':
        // Implement damage boost
        break;
      case 'speed':
        // Implement speed boost
        break;
      case 'experience':
        if (this.experienceSystem) {
          this.experienceSystem.addExperience(100);
        }
        break;
    }
  }
  
  private addScore(points: number): void {
    this.score += Math.floor(points * this.comboMultiplier);
  }
  
  private addCombo(): void {
    this.comboMultiplier = Math.min(5.0, this.comboMultiplier + 0.1);
    this.comboTimer = 3000; // 3 seconds
  }
  
  private addScreenShake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }
  
  public addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }
  
  public addLandmine(landmine: Landmine): void {
    this.landmines.push(landmine);
  }
  
  private renderTargetingReticle(): void {
    if (!this.player) return;
    
    this.ctx.save();
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.arc(this.worldMousePos.x, this.worldMousePos.y, 20, 0, Math.PI * 2);
    this.ctx.stroke();
    
    this.ctx.restore();
  }
  
  private renderPlayerEffects(): void {
    if (!this.player) return;
    
    // Render any special effects around the player
  }
  
  private renderComboMultiplier(): void {
    this.ctx.save();
    this.ctx.fillStyle = '#ffff00';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    
    const text = `${this.comboMultiplier.toFixed(1)}x`;
    this.ctx.fillText(text, this.canvas.width / 2, 50);
    
    this.ctx.restore();
  }
  
  private renderCameraBounds(): void {
    // Optional: render camera bounds for debugging
  }
  
  private render(): void {
    // Clear canvas
    this.ctx.save();
    
    // Apply camera transform
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // Apply screen shake
    this.ctx.translate(this.cameraOffset.x, this.cameraOffset.y);
    
    // Only render game elements when game is playing and objects are initialized
    if (this.gameState === 'playing' && this.player) {
      // Render terrain
      this.terrainSystem.render(this.ctx);
      
      // Render targeting reticle
      this.renderTargetingReticle();
      
      // Render entities
      this.player.render(this.ctx);
      this.player.renderHealthBar(this.ctx);
      
      // Render player effects
      this.renderPlayerEffects();
      
      // Render enemies
      for (const enemy of this.enemies) {
        enemy.render(this.ctx);
        enemy.renderHealthBar(this.ctx);
      }
      
      // Render bosses
      for (const boss of this.bosses) {
        boss.render(this.ctx);
      }
      
      // Render infantry
      for (const infantry of this.infantry) {
        infantry.render(this.ctx);
      }
      
      // Render power-ups
      for (const powerUp of this.powerUps) {
        powerUp.render(this.ctx);
      }
      
      // Render landmines
      for (const landmine of this.landmines) {
        landmine.render(this.ctx);
      }
      
      // Render projectiles
      for (const projectile of this.projectiles) {
        projectile.render(this.ctx);
      }
    }
    
    // Only render game elements when playing
    if (this.gameState === 'playing') {
      // Render targeting reticle
      this.renderTargetingReticle();
    }
    
    // Render camera bounds indicator
    this.renderCameraBounds();
    
    // Render entities
    if (this.player) {
      // Always render particles and experience system (they have their own safety checks)
      this.particleSystem.render(this.ctx);
      
      this.ctx.restore();
      
      if (this.experienceSystem) {
        this.experienceSystem.renderFloatingXP(this.ctx);
      }
      
      // Render combo multiplier
      if (this.gameState === 'playing' && this.comboMultiplier > 1.0) {
        this.renderComboMultiplier();
      }
    }
  }
}