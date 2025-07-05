import { Vector2, Enemy } from '../../types/Game';

export class EnemyRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawEnemies(enemies: Enemy[]): void {
    enemies.forEach(enemy => {
      if (enemy.type === 'boss') {
        this.drawBoss(enemy);
        return;
      }
      
      if (enemy.type === 'ninja_star') {
        this.drawNinjaStar(enemy);
      } else if (enemy.type === 'pusher') {
        this.drawPusher(enemy);
      } else {
        this.drawRegularEnemy(enemy);
      }
      
      this.drawEnemyHealthBar(enemy);
    });
  }

  private drawRegularEnemy(enemy: Enemy): void {
    // Add visual indicator for weak enemies
    if (enemy.type === 'weak') {
      this.ctx.globalAlpha = 0.7;
    }
    
    this.ctx.fillStyle = enemy.color;
    this.ctx.strokeStyle = enemy.color.replace(/[^,]*$/, '0.8)').replace('rgb', 'rgba');
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(enemy.pos.x, enemy.pos.y, enemy.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    if (enemy.type === 'weak') {
      this.ctx.globalAlpha = 1.0;
    }
    
    this.drawEnemyTypeIndicator(enemy);
  }

  private drawEnemyTypeIndicator(enemy: Enemy): void {
    if (enemy.type === 'weak') {
      this.ctx.fillStyle = '#666666';
      this.ctx.beginPath();
      this.ctx.arc(enemy.pos.x, enemy.pos.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (enemy.type === 'heavy') {
      this.ctx.fillStyle = '#aa2222';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = enemy.pos.x + Math.cos(angle) * enemy.size * 0.7;
        const y = enemy.pos.y + Math.sin(angle) * enemy.size * 0.7;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (enemy.type === 'fast') {
      this.ctx.strokeStyle = '#22aa22';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const startX = enemy.pos.x + Math.cos(angle) * enemy.size * 0.5;
        const startY = enemy.pos.y + Math.sin(angle) * enemy.size * 0.5;
        const endX = enemy.pos.x + Math.cos(angle) * enemy.size * 1.2;
        const endY = enemy.pos.y + Math.sin(angle) * enemy.size * 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }
    }
  }

  private drawEnemyHealthBar(enemy: Enemy): void {
    if (enemy.health < enemy.maxHealth) {
      const barWidth = enemy.size * 2.5;
      const barHeight = 5;
      const healthPercent = enemy.health / enemy.maxHealth;
      
      this.ctx.fillStyle = '#333333';
      this.ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.size - 15, barWidth, barHeight);
      
      this.ctx.fillStyle = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000';
      this.ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.size - 15, barWidth * healthPercent, barHeight);
    }
  }

  private drawBoss(enemy: Enemy): void {
    const { pos, size, health, maxHealth, bossAbilities = [], ufoType, hoverOffset = 0, rotationAngle = 0 } = enemy;
    
    const hoverY = pos.y + Math.sin(hoverOffset) * 8;
    const adjustedPos = { x: pos.x, y: hoverY };
    
    if (ufoType) {
      this.drawUFOBoss(enemy, adjustedPos, size, health, maxHealth, rotationAngle);
    } else {
      this.drawClassicBoss(enemy, adjustedPos, size, health, maxHealth);
    }
  }

  private drawUFOBoss(enemy: Enemy, pos: Vector2, size: number, health: number, maxHealth: number, rotationAngle: number): void {
    const { ufoType, color, bossAbilities = [] } = enemy;
    
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(rotationAngle);
    
    switch (ufoType) {
      case 'scout':
        this.drawScoutUFO(size, color);
        break;
      case 'destroyer':
        this.drawDestroyerUFO(size, color);
        break;
      case 'mothership':
        this.drawMothershipUFO(size, color);
        break;
      case 'harvester':
        this.drawHarvesterUFO(size, color);
        break;
      case 'dreadnought':
        this.drawDreadnoughtUFO(size, color);
        break;
      default:
        this.drawClassicUFO(size, color);
        break;
    }
    
    this.ctx.restore();
    
    this.drawUFOEffects(pos, size, ufoType, bossAbilities);
    this.drawUFOHealthBar(pos, size, health, maxHealth, color);
  }

  private drawScoutUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // Main hull
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size * 0.8);
    this.ctx.lineTo(size * 0.6, 0);
    this.ctx.lineTo(0, size * 0.8);
    this.ctx.lineTo(-size * 0.6, 0);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Wing extensions
    this.ctx.fillStyle = color.replace('88', 'aa');
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size * 1.2, size * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.drawSawbladeArms(size, color);
    this.ctx.shadowBlur = 0;
  }

  private drawSawbladeArms(size: number, color: string): void {
    for (let side = 0; side < 2; side++) {
      const armSide = side === 0 ? -1 : 1;
      const armX = armSide * size * 0.8;
      const armY = 0;
      
      // Arm
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(armSide * size * 0.6, 0);
      this.ctx.lineTo(armX, armY);
      this.ctx.stroke();
      
      // Sawblade
      const sawbladeRadius = size * 0.25;
      const rotationSpeed = Date.now() * 0.02;
      
      this.ctx.save();
      this.ctx.translate(armX, armY);
      this.ctx.rotate(rotationSpeed * armSide);
      
      this.ctx.fillStyle = '#cccccc';
      this.ctx.strokeStyle = '#888888';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, sawbladeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.drawSawbladeTeeth(sawbladeRadius);
      this.ctx.restore();
    }
  }

  private drawSawbladeTeeth(radius: number): void {
    const teethCount = 12;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < teethCount; i++) {
      const angle = (i / teethCount) * Math.PI * 2;
      const toothLength = radius * 0.3;
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      this.ctx.lineTo(Math.cos(angle) * (radius + toothLength), Math.sin(angle) * (radius + toothLength));
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawDestroyerUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 20;
    
    // Main hull - aggressive angular design
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.8, -size * 0.3);
    this.ctx.lineTo(size * 0.6, size * 0.8);
    this.ctx.lineTo(-size * 0.6, size * 0.8);
    this.ctx.lineTo(-size * 0.8, -size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Weapon arrays
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const weaponX = Math.cos(angle) * size * 0.7;
      const weaponY = Math.sin(angle) * size * 0.7;
      
      this.ctx.fillStyle = '#ff4444';
      this.ctx.beginPath();
      this.ctx.arc(weaponX, weaponY, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.shadowBlur = 0;
  }

  private drawMothershipUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 25;
    
    // Massive main hull
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size * 1.2, size * 0.6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Command tower
    this.ctx.fillStyle = color.replace('88', 'bb');
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.3, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Docking bays
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const bayX = Math.cos(angle) * size * 0.8;
      const bayY = Math.sin(angle) * size * 0.4;
      
      this.ctx.fillStyle = '#333333';
      this.ctx.fillRect(bayX - 8, bayY - 4, 16, 8);
    }
    
    this.ctx.shadowBlur = 0;
  }

  private drawHarvesterUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 18;
    
    // Main body
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Harvester beams
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const beamLength = size * 1.5;
      
      this.ctx.strokeStyle = '#88ff88';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(angle) * beamLength, Math.sin(angle) * beamLength);
      this.ctx.stroke();
    }
    
    this.ctx.shadowBlur = 0;
  }

  private drawDreadnoughtUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 30;
    
    // Massive fortress-like hull
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.rect(-size, -size * 0.6, size * 2, size * 1.2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Weapon turrets
    const turretPositions = [
      {x: -size * 0.7, y: -size * 0.4},
      {x: size * 0.7, y: -size * 0.4},
      {x: -size * 0.7, y: size * 0.4},
      {x: size * 0.7, y: size * 0.4}
    ];
    
    turretPositions.forEach(pos => {
      this.ctx.fillStyle = '#666666';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
    
    this.ctx.shadowBlur = 0;
  }

  private drawClassicUFO(size: number, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // Classic saucer shape
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Central dome
    this.ctx.fillStyle = color.replace('88', 'bb');
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.2, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }

  private drawUFOEffects(pos: Vector2, size: number, ufoType: string | undefined, abilities: string[]): void {
    abilities.forEach(ability => {
      switch (ability) {
        case 'shield':
          this.ctx.strokeStyle = '#4488ff';
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([10, 5]);
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, size * 1.5, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
          break;
        case 'laser':
          this.ctx.strokeStyle = '#ff4444';
          this.ctx.lineWidth = 4;
          this.ctx.shadowColor = '#ff0000';
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.moveTo(pos.x, pos.y);
          this.ctx.lineTo(pos.x, pos.y + size * 3);
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
          break;
      }
    });
  }

  private drawUFOHealthBar(pos: Vector2, size: number, health: number, maxHealth: number, color: string): void {
    const barWidth = size * 3;
    const barHeight = 8;
    const healthPercent = health / maxHealth;
    
    // Background
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(pos.x - barWidth/2, pos.y - size - 25, barWidth, barHeight);
    
    // Health bar
    this.ctx.fillStyle = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000';
    this.ctx.fillRect(pos.x - barWidth/2, pos.y - size - 25, barWidth * healthPercent, barHeight);
    
    // Border
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(pos.x - barWidth/2, pos.y - size - 25, barWidth, barHeight);
  }

  private drawClassicBoss(enemy: Enemy, pos: Vector2, size: number, health: number, maxHealth: number): void {
    // Classic boss rendering fallback
    this.ctx.shadowColor = enemy.color;
    this.ctx.shadowBlur = 25;
    
    this.ctx.fillStyle = enemy.color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    this.drawUFOHealthBar(pos, size, health, maxHealth, enemy.color);
  }

  private drawNinjaStar(enemy: Enemy): void {
    const { pos, size, color, rotationAngle = 0 } = enemy;
    
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(rotationAngle);
    
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    
    // Draw ninja star shape
    this.ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = i % 2 === 0 ? size : size * 0.5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawPusher(enemy: Enemy): void {
    const { pos, size, color } = enemy;
    
    // Main body
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.rect(pos.x - size, pos.y - size, size * 2, size * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Pusher spikes
    const spikePositions = [
      {x: pos.x, y: pos.y - size},
      {x: pos.x + size, y: pos.y},
      {x: pos.x, y: pos.y + size},
      {x: pos.x - size, y: pos.y}
    ];
    
    spikePositions.forEach(spike => {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#888888';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(spike.x, spike.y);
      this.ctx.lineTo(spike.x + (spike.x - pos.x) * 0.5, spike.y + (spike.y - pos.y) * 0.5);
      this.ctx.stroke();
    });
  }
} 