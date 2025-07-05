import { Vector2 } from '../../types/Game';
import { PowerUpManager } from '../../components/Game/PowerUpManager';
import { ParticleSystem } from '../ParticleSystem';

export class EffectsRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  clear(): void {
    this.ctx.fillStyle = '#0f0f0f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid(): void {
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 1;
    const gridSize = 60;
    
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawParticles(particleSystem: ParticleSystem): void {
    particleSystem.render(this.ctx);
  }

  drawPowerUps(powerUpManager: PowerUpManager): void {
    powerUpManager.getPowerUps().forEach(powerUp => {
      const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
      const size = powerUp.size * pulseScale;
      
      let glowColor = powerUp.color;
      let glowSize = 5;
      if (powerUp.rarity === 'rare') {
        glowColor = '#4444ff';
        glowSize = 8;
      } else if (powerUp.rarity === 'very_rare') {
        glowColor = '#ff44ff';
        glowSize = 12;
      }
      
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = glowSize;
      
      // Draw power-up background
      this.ctx.fillStyle = powerUp.color;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(powerUp.pos.x, powerUp.pos.y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw power-up icon
      this.ctx.shadowBlur = 0;
      this.drawPowerUpIcon(powerUp.pos, size, powerUp.category);
    });
  }

  drawProjectiles(projectiles: any[]): void {
    projectiles.forEach(projectile => {
      this.ctx.fillStyle = projectile.color || '#ff6666';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      
      if (projectile.type === 'laser') {
        // Draw laser beam
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(projectile.startPos.x, projectile.startPos.y);
        this.ctx.lineTo(projectile.pos.x, projectile.pos.y);
        this.ctx.stroke();
      } else {
        // Draw regular projectile
        this.ctx.beginPath();
        this.ctx.arc(projectile.pos.x, projectile.pos.y, projectile.size || 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
    });
  }

  private drawPowerUpIcon(pos: Vector2, size: number, category: string): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${size * 0.8}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    let icon = '?';
    switch (category) {
      case 'damage':
        icon = '⚔️';
        break;
      case 'health':
        icon = '❤️';
        break;
      case 'speed':
        icon = '💨';
        break;
      case 'size':
        icon = '🔵';
        break;
      case 'berserk':
        icon = '😡';
        break;
      case 'electric':
        icon = '⚡';
        break;
      case 'spin':
        icon = '🌀';
        break;
    }
    
    this.ctx.fillText(icon, pos.x, pos.y);
  }

  drawExplosion(pos: Vector2, size: number, progress: number): void {
    const explosionRadius = size * (1 + progress * 2);
    const alpha = 1 - progress;
    
    // Draw explosion rings
    for (let i = 0; i < 3; i++) {
      const ringRadius = explosionRadius * (0.5 + i * 0.25);
      const ringAlpha = alpha * (1 - i * 0.3);
      
      this.ctx.globalAlpha = ringAlpha;
      this.ctx.strokeStyle = i === 0 ? '#ffff00' : i === 1 ? '#ff8800' : '#ff0000';
      this.ctx.lineWidth = 4 - i;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.globalAlpha = 1;
  }

  drawShockwave(pos: Vector2, radius: number, alpha: number): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = '#66ccff';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1;
  }

  drawLightning(startPos: Vector2, endPos: Vector2): void {
    const segments = 8;
    const points: Vector2[] = [startPos];
    
    // Generate jagged lightning path
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = startPos.x + (endPos.x - startPos.x) * t + (Math.random() - 0.5) * 30;
      const y = startPos.y + (endPos.y - startPos.y) * t + (Math.random() - 0.5) * 30;
      points.push({ x, y });
    }
    points.push(endPos);
    
    // Draw lightning bolt
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowColor = '#ffff00';
    this.ctx.shadowBlur = 10;
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }
} 