import { Vector2, ChainSegment, Enemy, SecondChain } from '../types/Game';
import { ActiveEffects, PlayerUpgrades } from '../types/PowerUps';
import { PowerUpManager } from '../components/Game/PowerUpManager';
import { ParticleSystem } from './ParticleSystem';

export class GameRenderer {
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
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${size * 0.8}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      let icon = '?';
      switch (powerUp.category) {
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
      
      this.ctx.fillText(icon, powerUp.pos.x, powerUp.pos.y);
      
    });
  }

  drawChain(chain: ChainSegment[], ball: Vector2, isRetracting: boolean, activeEffects: ActiveEffects, playerUpgrades?: { chainDamage: number }): void {
    let chainColor = isRetracting ? '#999999' : '#777777';
    if (activeEffects.berserk) {
      chainColor = '#ff6666';
    } else if (activeEffects.electrified) {
      chainColor = '#ffff66';
    }
    
    this.ctx.strokeStyle = chainColor;
    this.ctx.lineWidth = isRetracting ? 8 : 6;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(chain[0].pos.x, chain[0].pos.y);
    for (let i = 1; i < chain.length; i++) {
      this.ctx.lineTo(chain[i].pos.x, chain[i].pos.y);
    }
    this.ctx.lineTo(ball.x, ball.y);
    this.ctx.stroke();

    // Draw chain links
    chain.forEach((segment, index) => {
      if (index === 0) return;
      
      const chainDamageLevel = playerUpgrades?.chainDamage || 0;
      const baseRadius = isRetracting ? 8 : 6;
      const linkRadius = baseRadius + (chainDamageLevel * 2);
      
      this.ctx.fillStyle = isRetracting ? '#bbbbbb' : '#999999';
      this.ctx.strokeStyle = isRetracting ? '#777777' : '#555555';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(segment.pos.x, segment.pos.y, linkRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw spikes on chain links if chain damage is upgraded
      if (chainDamageLevel > 0) {
        const spikeCount = 4 + (chainDamageLevel * 2);
        const spikeLength = linkRadius * 0.4;
        
        this.ctx.fillStyle = '#cccccc';
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < spikeCount; i++) {
          const angle = (i / spikeCount) * Math.PI * 2;
          const baseX = segment.pos.x + Math.cos(angle) * (linkRadius * 0.8);
          const baseY = segment.pos.y + Math.sin(angle) * (linkRadius * 0.8);
          const tipX = segment.pos.x + Math.cos(angle) * (linkRadius + spikeLength);
          const tipY = segment.pos.y + Math.sin(angle) * (linkRadius + spikeLength);
          
          const perpAngle = angle + Math.PI / 2;
          const spikeWidth = 2;
          const base1X = baseX + Math.cos(perpAngle) * spikeWidth;
          const base1Y = baseY + Math.sin(perpAngle) * spikeWidth;
          const base2X = baseX - Math.cos(perpAngle) * spikeWidth;
          const base2Y = baseY - Math.sin(perpAngle) * spikeWidth;
          
          this.ctx.beginPath();
          this.ctx.moveTo(tipX, tipY);
          this.ctx.lineTo(base1X, base1Y);
          this.ctx.lineTo(base2X, base2Y);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
      }
    });
  }

  drawSecondChain(secondChain: SecondChain, isRetracting: boolean, activeEffects: ActiveEffects, playerUpgrades?: PlayerUpgrades): void {
    let chainColor = isRetracting ? '#bb99dd' : '#9966cc';
    if (activeEffects.berserk) {
      chainColor = '#dd66bb';
    } else if (activeEffects.electrified) {
      chainColor = '#dddd66';
    } else if (activeEffects.hyperSpin) {
      chainColor = '#aa88ff';
    }
    
    this.ctx.strokeStyle = chainColor;
    this.ctx.lineWidth = isRetracting ? 6 : 4; // Slightly thinner than main chain
    this.ctx.lineCap = 'round';
    
    // Draw chain line
    this.ctx.beginPath();
    if (secondChain.segments.length > 0) {
      this.ctx.moveTo(secondChain.segments[0].pos.x, secondChain.segments[0].pos.y);
      for (let i = 1; i < secondChain.segments.length; i++) {
        this.ctx.lineTo(secondChain.segments[i].pos.x, secondChain.segments[i].pos.y);
      }
      this.ctx.lineTo(secondChain.ball.x, secondChain.ball.y);
    }
    this.ctx.stroke();

    // Draw chain links
    secondChain.segments.forEach((segment, index) => {
      if (index === 0) return;
      
      const chainDamageLevel = playerUpgrades?.secondChainDamage || 0;
      const baseRadius = isRetracting ? 6 : 4; // Smaller than main chain
      const linkRadius = baseRadius + (chainDamageLevel * 1.5);
      
      this.ctx.fillStyle = isRetracting ? '#cc99ee' : '#aa77dd';
      this.ctx.strokeStyle = isRetracting ? '#9966cc' : '#7744aa';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(segment.pos.x, segment.pos.y, linkRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw spikes if upgraded
      if (chainDamageLevel > 0) {
        const spikeCount = 3 + (chainDamageLevel * 1);
        const spikeLength = linkRadius * 0.4;
        
        this.ctx.fillStyle = '#ddaaff';
        this.ctx.strokeStyle = '#aa77dd';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < spikeCount; i++) {
          const angle = (i / spikeCount) * Math.PI * 2;
          const baseX = segment.pos.x + Math.cos(angle) * (linkRadius * 0.8);
          const baseY = segment.pos.y + Math.sin(angle) * (linkRadius * 0.8);
          const tipX = segment.pos.x + Math.cos(angle) * (linkRadius + spikeLength);
          const tipY = segment.pos.y + Math.sin(angle) * (linkRadius + spikeLength);
          
          const perpAngle = angle + Math.PI / 2;
          const spikeWidth = 1.5;
          const base1X = baseX + Math.cos(perpAngle) * spikeWidth;
          const base1Y = baseY + Math.sin(perpAngle) * spikeWidth;
          const base2X = baseX - Math.cos(perpAngle) * spikeWidth;
          const base2Y = baseY - Math.sin(perpAngle) * spikeWidth;
          
          this.ctx.beginPath();
          this.ctx.moveTo(tipX, tipY);
          this.ctx.lineTo(base1X, base1Y);
          this.ctx.lineTo(base2X, base2Y);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
      }
    });
    
    // Draw second ball
    this.drawSecondBall(secondChain.ball, activeEffects);
  }

  drawSecondBall(ball: Vector2, activeEffects: ActiveEffects): void {
    const ballRadius = 18; // Smaller than main ball
    
    if (activeEffects.electrified) {
      this.ctx.shadowColor = '#ffff00';
      this.ctx.shadowBlur = 10;
      
      this.ctx.fillStyle = '#ffff88';
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.shadowBlur = 0;
      return;
    }
    
    if (activeEffects.hyperSpin) {
      this.ctx.shadowColor = '#aa88ff';
      this.ctx.shadowBlur = 15;
      
      // Smaller spinning effect for second ball
      const time = Date.now() * 0.03;
      this.ctx.strokeStyle = '#aa88ff';
      this.ctx.lineWidth = 2;
      
      for (let arm = 0; arm < 4; arm++) {
        this.ctx.beginPath();
        const armOffset = (arm * Math.PI * 2) / 4;
        for (let i = 0; i < 10; i++) {
          const t = i / 10;
          const angle = time * -2 + armOffset + t * Math.PI * 3; // Opposite direction
          const radius = ballRadius * (1.3 - t * 0.5);
          const x = ball.x + Math.cos(angle) * radius;
          const y = ball.y + Math.sin(angle) * radius;
          
          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.stroke();
      }
      
      this.ctx.fillStyle = '#8866aa';
      this.ctx.strokeStyle = '#aa88ff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.shadowBlur = 0;
      return;
    }

    // Normal second ball with purple theme
    this.ctx.fillStyle = '#7744aa';
    this.ctx.strokeStyle = '#5533aa';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw smaller spikes
    const spikeCount = 8;
    const spikeLength = ballRadius * 0.5;
    
    this.ctx.fillStyle = '#9966cc';
    this.ctx.strokeStyle = '#5533aa';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const baseX = ball.x + Math.cos(angle) * (ballRadius * 0.7);
      const baseY = ball.y + Math.sin(angle) * (ballRadius * 0.7);
      const tipX = ball.x + Math.cos(angle) * (ballRadius + spikeLength);
      const tipY = ball.y + Math.sin(angle) * (ballRadius + spikeLength);
      
      const perpAngle = angle + Math.PI / 2;
      const spikeWidth = 3;
      const base1X = baseX + Math.cos(perpAngle) * spikeWidth;
      const base1Y = baseY + Math.sin(perpAngle) * spikeWidth;
      const base2X = baseX - Math.cos(perpAngle) * spikeWidth;
      const base2Y = baseY - Math.sin(perpAngle) * spikeWidth;
      
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(base1X, base1Y);
      this.ctx.lineTo(base2X, base2Y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    // Add metallic highlight
    this.ctx.fillStyle = '#bb99dd';
    this.ctx.beginPath();
    this.ctx.arc(ball.x - ballRadius * 0.3, ball.y - ballRadius * 0.3, ballRadius * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawPlayer(player: Vector2, playerSize: number, activeEffects: ActiveEffects): void {
    let playerColor = '#4488ff';
    let playerGlow = '#4488ff';
    let glowIntensity = 15;
    
    if (activeEffects.berserk) {
      playerColor = '#ff4488';
      playerGlow = '#ff4488';
      glowIntensity = 25;
    } else if (activeEffects.tempSpeed) {
      playerColor = '#44ffff';
      playerGlow = '#44ffff';
      glowIntensity = 20;
    }
    
    // Outer glow effect
    this.ctx.shadowColor = playerGlow;
    this.ctx.shadowBlur = glowIntensity;
    
    // Player body
    this.ctx.fillStyle = playerColor;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, playerSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    
    // Player core
    this.ctx.fillStyle = playerColor.replace('44', 'aa');
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, playerSize * 0.6, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Inner wisp effect
    this.ctx.shadowColor = playerGlow;
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, playerSize * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    
    // Animated wisp particles
    const time = Date.now() * 0.003;
    for (let i = 0; i < 3; i++) {
      const angle = time + (i * Math.PI * 2 / 3);
      const radius = playerSize * 0.8;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      
      this.ctx.fillStyle = playerGlow + '80';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawBall(ball: Vector2, ballRadius: number, activeEffects: ActiveEffects): void {
    const isElectrified = activeEffects.electrified;
    const isHyperSpin = activeEffects.hyperSpin;
    
    if (isElectrified) {
      this.ctx.shadowColor = '#ffff00';
      this.ctx.shadowBlur = 15;
      
      // Draw electric aura with animated sparks
      this.ctx.fillStyle = '#ffff0040';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius * 1.5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw animated electric arcs around the ball
      const time = Date.now() * 0.01;
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = time + (i * Math.PI / 2);
        const startAngle = angle;
        const endAngle = angle + Math.PI / 3;
        const arcRadius = ballRadius * 1.2;
        
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, arcRadius, startAngle, endAngle);
        this.ctx.stroke();
      }
      
      this.ctx.fillStyle = '#ffff88';
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.shadowBlur = 0;
      return;
    }
    
    if (isHyperSpin) {
      this.ctx.shadowColor = '#aa88ff';
      this.ctx.shadowBlur = 20;
      
      // Enhanced spinning whirlwind effect - much more intense and visible
      const time = Date.now() * 0.05; // Faster visual effect
      this.ctx.strokeStyle = '#aa88ff';
      this.ctx.lineWidth = 3;
      
      // Draw multiple spiral arms that rotate around the ball - more arms for chaos
      for (let arm = 0; arm < 8; arm++) {
        this.ctx.beginPath();
        const armOffset = (arm * Math.PI * 2) / 8;
        for (let i = 0; i < 25; i++) {
          const t = i / 25;
          const angle = time * 3 + armOffset + t * Math.PI * 6; // Much faster rotation
          const radius = ballRadius * (2.5 - t * 1.0); // Even larger effect
          const x = ball.x + Math.cos(angle) * radius;
          const y = ball.y + Math.sin(angle) * radius;
          
          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.stroke();
      }
      
      // Draw multiple motion blur rings to show intense spinning
      for (let ring = 0; ring < 5; ring++) {
        this.ctx.strokeStyle = `#aa88ff${Math.floor((0.6 - ring * 0.2) * 255).toString(16).padStart(2, '0')}`;
        this.ctx.lineWidth = 6 - ring * 2;
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ballRadius * (1.8 + ring * 0.3), 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
      // Add spinning particle trail effect
      const trailTime = Date.now() * 0.08; // Faster trail
      this.ctx.fillStyle = '#aa88ff80';
      for (let i = 0; i < 8; i++) {
        const trailAngle = trailTime + (i * Math.PI / 4);
        const trailRadius = ballRadius * 1.4;
        const trailX = ball.x + Math.cos(trailAngle) * trailRadius;
        const trailY = ball.y + Math.sin(trailAngle) * trailRadius;
        
        this.ctx.beginPath();
        this.ctx.arc(trailX, trailY, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      // Add clock arm visualization lines to show the spinning motion clearly
      this.ctx.strokeStyle = '#aa88ff';
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([10, 5]);
      const armTime = Date.now() * 0.008; // Same speed as physics
      for (let arm = 0; arm < 2; arm++) {
        const armAngle = armTime + (arm * Math.PI);
        this.ctx.beginPath();
        this.ctx.moveTo(ball.x, ball.y);
        this.ctx.lineTo(ball.x + Math.cos(armAngle) * ballRadius * 3, ball.y + Math.sin(armAngle) * ballRadius * 3);
        this.ctx.stroke();
      }
      this.ctx.setLineDash([]);
      
      // Central energy core
      this.ctx.fillStyle = '#aa88ff40';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius * 1.3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Main ball with enhanced glow
      this.ctx.fillStyle = '#8866aa';
      this.ctx.strokeStyle = '#aa88ff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.shadowBlur = 0;
      return;
    }

    // Normal ball with spikes
    this.ctx.fillStyle = '#666666';
    this.ctx.strokeStyle = '#444444';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw spikes
    const spikeCount = 12;
    const spikeLength = ballRadius * 0.6;
    
    this.ctx.fillStyle = '#888888';
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const baseX = ball.x + Math.cos(angle) * (ballRadius * 0.7);
      const baseY = ball.y + Math.sin(angle) * (ballRadius * 0.7);
      const tipX = ball.x + Math.cos(angle) * (ballRadius + spikeLength);
      const tipY = ball.y + Math.sin(angle) * (ballRadius + spikeLength);
      
      const perpAngle = angle + Math.PI / 2;
      const spikeWidth = 4;
      const base1X = baseX + Math.cos(perpAngle) * spikeWidth;
      const base1Y = baseY + Math.sin(perpAngle) * spikeWidth;
      const base2X = baseX - Math.cos(perpAngle) * spikeWidth;
      const base2Y = baseY - Math.sin(perpAngle) * spikeWidth;
      
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(base1X, base1Y);
      this.ctx.lineTo(base2X, base2Y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    // Add metallic highlight
    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.beginPath();
    this.ctx.arc(ball.x - ballRadius * 0.3, ball.y - ballRadius * 0.3, ballRadius * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawEnemies(enemies: Enemy[]): void {
    enemies.forEach(enemy => {
      // Enhanced boss rendering
      if (enemy.type === 'boss') {
        this.drawBoss(enemy);
        return;
      }
      
      // Special rendering for ninja star
      if (enemy.type === 'ninja_star') {
        this.drawNinjaStar(enemy);
      } else if (enemy.type === 'pusher') {
        this.drawPusher(enemy);
      } else {
        // Normal enemy body
        // Add visual indicator for weak enemies
        if (enemy.type === 'weak') {
          this.ctx.globalAlpha = 0.7; // Make weak enemies slightly transparent
        }
        
        this.ctx.fillStyle = enemy.color;
        this.ctx.strokeStyle = enemy.color.replace(/[^,]*$/, '0.8)').replace('rgb', 'rgba');
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(enemy.pos.x, enemy.pos.y, enemy.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        if (enemy.type === 'weak') {
          this.ctx.globalAlpha = 1.0; // Reset alpha
        }
      }
      
      // Enemy type indicators
      if (enemy.type === 'weak') {
        // Small dot indicator for weak enemies
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
      
      // Draw health bar for damaged enemies
      if (enemy.health < enemy.maxHealth) {
        const barWidth = enemy.size * 2.5;
        const barHeight = 5;
        const healthPercent = enemy.health / enemy.maxHealth;
        
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.size - 15, barWidth, barHeight);
        
        this.ctx.fillStyle = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000';
        this.ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y - enemy.size - 15, barWidth * healthPercent, barHeight);
      }
    });
  }

  private drawBoss(enemy: Enemy): void {
    const { pos, size, health, maxHealth, bossAbilities = [], ufoType, ufoPattern, hoverOffset = 0, rotationAngle = 0 } = enemy;
    
    // UFO hovering effect
    const hoverY = pos.y + Math.sin(hoverOffset) * 8;
    const adjustedPos = { x: pos.x, y: hoverY };
    
    if (ufoType) {
      this.drawUFOBoss(enemy, adjustedPos, size, health, maxHealth, rotationAngle);
    } else {
      // Fallback to original boss rendering
      this.drawClassicBoss(enemy, adjustedPos, size, health, maxHealth);
    }
  }

  private drawUFOBoss(enemy: Enemy, pos: Vector2, size: number, health: number, maxHealth: number, rotationAngle: number): void {
    const { ufoType, color, bossAbilities = [] } = enemy;
    
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(rotationAngle);
    
    // UFO-specific rendering based on type
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
    
    // Draw UFO abilities and effects
    this.drawUFOEffects(pos, size, ufoType, bossAbilities);
    
    // Enhanced health bar for UFO boss
    this.drawUFOHealthBar(pos, size, health, maxHealth, color);
  }

  private drawScoutUFO(size: number, color: string): void {
    // Small, sleek scout UFO with angular design
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // Main hull - angular diamond shape
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
    
    // Sawblade arms extending from the sides
    for (let side = 0; side < 2; side++) {
      const armSide = side === 0 ? -1 : 1; // Left and right sides
      const armLength = size * 0.4;
      const armX = armSide * size * 0.8;
      const armY = 0;
      
      // Arm connecting to sawblade
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(armSide * size * 0.6, 0);
      this.ctx.lineTo(armX, armY);
      this.ctx.stroke();
      
      // Sawblade at end of arm
      const sawbladeRadius = size * 0.25;
      const rotationSpeed = Date.now() * 0.02; // Fast spinning
      
      this.ctx.save();
      this.ctx.translate(armX, armY);
      this.ctx.rotate(rotationSpeed * armSide); // Opposite rotation for each side
      
      // Sawblade body
      this.ctx.fillStyle = '#cccccc';
      this.ctx.strokeStyle = '#888888';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, sawbladeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Sawblade teeth
      const teethCount = 12;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#666666';
      this.ctx.lineWidth = 1;
      
      for (let i = 0; i < teethCount; i++) {
        const angle = (i / teethCount) * Math.PI * 2;
        const toothLength = sawbladeRadius * 0.3;
        const innerX = Math.cos(angle) * sawbladeRadius * 0.8;
        const innerY = Math.sin(angle) * sawbladeRadius * 0.8;
        const outerX = Math.cos(angle) * (sawbladeRadius + toothLength);
        const outerY = Math.sin(angle) * (sawbladeRadius + toothLength);
        
        // Create triangular tooth
        const nextAngle = ((i + 1) / teethCount) * Math.PI * 2;
        const nextInnerX = Math.cos(nextAngle) * sawbladeRadius * 0.8;
        const nextInnerY = Math.sin(nextAngle) * sawbladeRadius * 0.8;
        
        this.ctx.beginPath();
        this.ctx.moveTo(innerX, innerY);
        this.ctx.lineTo(outerX, outerY);
        this.ctx.lineTo(nextInnerX, nextInnerY);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
      
      // Central hub
      this.ctx.fillStyle = '#444444';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, sawbladeRadius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
    
    // Central core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Engine trails
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const trailX = Math.cos(angle) * size * 0.9;
      const trailY = Math.sin(angle) * size * 0.9;
      
      this.ctx.fillStyle = color + '80';
      this.ctx.beginPath();
      this.ctx.arc(trailX, trailY, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.shadowBlur = 0;
  }

  private drawDestroyerUFO(size: number, color: string): void {
    // Aggressive military-style UFO with weapon pods
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 20;
    
    // Main hull - hexagonal
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * size * 0.8;
      const y = Math.sin(angle) * size * 0.8;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Weapon pods
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const podX = Math.cos(angle) * size * 1.1;
      const podY = Math.sin(angle) * size * 1.1;
      
      this.ctx.fillStyle = '#ff6600';
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(podX, podY, size * 0.15, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
    
    // Central command module
    this.ctx.fillStyle = '#ff8800';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Armor plating lines
    this.ctx.strokeStyle = '#ffaa44';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const radius = size * (0.4 + i * 0.15);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.shadowBlur = 0;
  }

  private drawMothershipUFO(size: number, color: string): void {
    // Large, imposing mothership with multiple levels
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 25;
    
    // Bottom hull - large ellipse
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(0, size * 0.2, size * 1.2, size * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Middle section
    this.ctx.fillStyle = color.replace('88', 'aa');
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size * 0.9, size * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Top command dome
    this.ctx.fillStyle = color.replace('88', 'cc');
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.3, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Docking bays
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bayX = Math.cos(angle) * size * 0.8;
      const bayY = Math.sin(angle) * size * 0.3 + size * 0.2;
      
      this.ctx.fillStyle = '#000000';
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.rect(bayX - 8, bayY - 4, 16, 8);
      this.ctx.fill();
      this.ctx.stroke();
    }
    
    // Central energy core
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = '#ffffff';
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(0, -size * 0.3, size * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.shadowBlur = 0;
  }

  private drawHarvesterUFO(size: number, color: string): void {
    // Industrial harvester with collection arrays
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 18;
    
    // Main body - octagonal
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * size * 0.7;
      const y = Math.sin(angle) * size * 0.7;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Collection arrays - extending arms
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const armLength = size * 1.3;
      const armX = Math.cos(angle) * armLength;
      const armY = Math.sin(angle) * armLength;
      
      // Arm structure
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7);
      this.ctx.lineTo(armX, armY);
      this.ctx.stroke();
      
      // Collection pod
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(armX, armY, size * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Energy beam effect
      this.ctx.strokeStyle = color + '60';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(armX, armY);
      this.ctx.lineTo(armX + Math.cos(angle) * size * 0.5, armY + Math.sin(angle) * size * 0.5);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    // Central processing unit
    this.ctx.fillStyle = '#ffcc00';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }

  private drawDreadnoughtUFO(size: number, color: string): void {
    // Massive fortress-like UFO with heavy armor
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 30;
    
    // Main fortress body - angular and imposing
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.8, -size * 0.3);
    this.ctx.lineTo(size, size * 0.3);
    this.ctx.lineTo(size * 0.3, size);
    this.ctx.lineTo(-size * 0.3, size);
    this.ctx.lineTo(-size, size * 0.3);
    this.ctx.lineTo(-size * 0.8, -size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Armor plating
    this.ctx.fillStyle = color.replace('44', '66');
    for (let i = 0; i < 3; i++) {
      const plateSize = size * (0.8 - i * 0.2);
      this.ctx.beginPath();
      this.ctx.moveTo(0, -plateSize);
      this.ctx.lineTo(plateSize * 0.8, -plateSize * 0.3);
      this.ctx.lineTo(plateSize, plateSize * 0.3);
      this.ctx.lineTo(plateSize * 0.3, plateSize);
      this.ctx.lineTo(-plateSize * 0.3, plateSize);
      this.ctx.lineTo(-plateSize, plateSize * 0.3);
      this.ctx.lineTo(-plateSize * 0.8, -plateSize * 0.3);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
    
    // Heavy weapon turrets
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const turretX = Math.cos(angle) * size * 0.9;
      const turretY = Math.sin(angle) * size * 0.9;
      
      this.ctx.fillStyle = '#ff0000';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(turretX, turretY, size * 0.12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Weapon barrels
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(turretX, turretY);
      this.ctx.lineTo(turretX + Math.cos(angle) * size * 0.3, turretY + Math.sin(angle) * size * 0.3);
      this.ctx.stroke();
    }
    
    // Central command fortress
    this.ctx.fillStyle = '#ff4444';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.rect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Command tower
    this.ctx.fillStyle = '#ff6666';
    this.ctx.beginPath();
    this.ctx.rect(-size * 0.1, -size * 0.4, size * 0.2, size * 0.2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }

  private drawClassicUFO(size: number, color: string): void {
    // Classic flying saucer design
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    // Main saucer body
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size, size * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Top dome
    this.ctx.fillStyle = color.replace('88', 'aa');
    this.ctx.beginPath();
    this.ctx.ellipse(0, -size * 0.2, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }

  private drawUFOEffects(pos: Vector2, size: number, ufoType: string | undefined, abilities: string[]): void {
    // Draw UFO-specific effects and abilities
    if (abilities.includes('tractor_beam')) {
      // Tractor beam effect for harvester
      this.ctx.strokeStyle = '#ffff0060';
      this.ctx.lineWidth = 8;
      this.ctx.setLineDash([10, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y + size);
      this.ctx.lineTo(pos.x, pos.y + size * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    if (abilities.includes('shield_regeneration')) {
      // Shield effect for mothership
      this.ctx.strokeStyle = '#8800ff40';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size * 1.5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    if (abilities.includes('death_ray')) {
      // Death ray charging effect for dreadnought
      const time = Date.now() * 0.01;
      this.ctx.strokeStyle = '#ff004480';
      this.ctx.lineWidth = 6;
      this.ctx.setLineDash([Math.sin(time) * 10 + 15, 5]);
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size * 1.2, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawUFOHealthBar(pos: Vector2, size: number, health: number, maxHealth: number, color: string): void {
    const barWidth = size * 3;
    const barHeight = 8;
    const healthPercent = health / maxHealth;
    
    // Health bar background with UFO styling
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(pos.x - barWidth/2 - 2, pos.y - size - 25 - 2, barWidth + 4, barHeight + 4);
    
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(pos.x - barWidth/2, pos.y - size - 25, barWidth, barHeight);
    
    // Health bar fill with UFO-themed gradient
    const healthGradient = this.ctx.createLinearGradient(
      pos.x - barWidth/2, 0,
      pos.x + barWidth/2, 0
    );
    
    if (healthPercent > 0.6) {
      healthGradient.addColorStop(0, color);
      healthGradient.addColorStop(1, '#ffffff');
    } else if (healthPercent > 0.3) {
      healthGradient.addColorStop(0, '#ff8800');
      healthGradient.addColorStop(1, '#ffaa00');
    } else {
      healthGradient.addColorStop(0, '#ff0000');
      healthGradient.addColorStop(1, '#ff4400');
    }
    
    this.ctx.fillStyle = healthGradient;
    this.ctx.fillRect(pos.x - barWidth/2, pos.y - size - 25, barWidth * healthPercent, barHeight);
    
    // Sci-fi health bar border
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(pos.x - barWidth/2, pos.y - size - 25, barWidth, barHeight);
    
    // Add corner details
    this.ctx.fillStyle = color;
    const cornerSize = 3;
    // Top left
    this.ctx.fillRect(pos.x - barWidth/2 - 2, pos.y - size - 25 - 2, cornerSize, cornerSize);
    // Top right  
    this.ctx.fillRect(pos.x + barWidth/2 - 1, pos.y - size - 25 - 2, cornerSize, cornerSize);
    // Bottom left
    this.ctx.fillRect(pos.x - barWidth/2 - 2, pos.y - size - 17 - 1, cornerSize, cornerSize);
    // Bottom right
    this.ctx.fillRect(pos.x + barWidth/2 - 1, pos.y - size - 17 - 1, cornerSize, cornerSize);
  }

  private drawClassicBoss(enemy: Enemy, pos: Vector2, size: number, health: number, maxHealth: number): void {
    // Fallback to original boss design
    const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    const currentSize = size * pulseScale;
    
    this.ctx.shadowColor = '#ff0088';
    this.ctx.shadowBlur = 20;
    
    this.ctx.strokeStyle = '#ff0088';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize * 1.4, 0, Math.PI * 2);
    this.ctx.stroke();
    
    const gradient = this.ctx.createRadialGradient(
      pos.x, pos.y, 0,
      pos.x, pos.y, currentSize
    );
    gradient.addColorStop(0, '#ff4488');
    gradient.addColorStop(0.7, '#ff0088');
    gradient.addColorStop(1, '#aa0044');
    
    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = '#ff0088';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.drawUFOHealthBar(pos, currentSize, health, maxHealth, '#ff0088');
  }
  private drawNinjaStar(enemy: Enemy): void {
    const { pos, size, spinAngle = 0, chainWrapped } = enemy;
    
    // Draw spinning ninja star
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(spinAngle);
    
    // Star body
    this.ctx.fillStyle = chainWrapped ? '#444444' : '#666666';
    this.ctx.strokeStyle = chainWrapped ? '#222222' : '#444444';
    this.ctx.lineWidth = 2;
    
    // Draw 6-pointed star
    const points = 6;
    const outerRadius = size;
    const innerRadius = size * 0.5;
    
    this.ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
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
    
    // Add metallic shine
    this.ctx.fillStyle = '#888888';
    this.ctx.beginPath();
    this.ctx.arc(-size * 0.3, -size * 0.3, size * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // If chain wrapped, draw chain effect
    if (chainWrapped) {
      this.ctx.strokeStyle = '#999999';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  private drawPusher(enemy: Enemy): void {
    const { pos, size } = enemy;
    
    // Draw pusher with pulsing effect
    const pulseScale = 1 + Math.sin(Date.now() * 0.008) * 0.1;
    const currentSize = size * pulseScale;
    
    // Outer ring (push field)
    this.ctx.strokeStyle = '#ff6600';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize * 1.3, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Main body
    this.ctx.fillStyle = '#ff6600';
    this.ctx.strokeStyle = '#cc4400';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Push indicators (arrows pointing outward)
    this.ctx.fillStyle = '#ffaa44';
    this.ctx.strokeStyle = '#cc4400';
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const arrowX = pos.x + Math.cos(angle) * currentSize * 0.7;
      const arrowY = pos.y + Math.sin(angle) * currentSize * 0.7;
      const tipX = pos.x + Math.cos(angle) * currentSize * 1.1;
      const tipY = pos.y + Math.sin(angle) * currentSize * 1.1;
      
      // Draw arrow
      this.ctx.beginPath();
      this.ctx.moveTo(arrowX, arrowY);
      this.ctx.lineTo(tipX, tipY);
      this.ctx.stroke();
      
      // Arrow head
      const headAngle1 = angle + Math.PI * 0.8;
      const headAngle2 = angle - Math.PI * 0.8;
      const headLength = currentSize * 0.2;
      
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(tipX + Math.cos(headAngle1) * headLength, tipY + Math.sin(headAngle1) * headLength);
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(tipX + Math.cos(headAngle2) * headLength, tipY + Math.sin(headAngle2) * headLength);
      this.ctx.stroke();
    }
    
    // Core
    this.ctx.fillStyle = '#ffcc88';
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, currentSize * 0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawProjectiles(projectiles: any[]): void {
    projectiles.forEach(projectile => {
      // Different visual styles for different projectile types
      if (projectile.color === '#ff8800') {
        // Homing projectiles - glowing effect
        this.ctx.shadowColor = '#ff8800';
        this.ctx.shadowBlur = 10;
      }
      
      this.ctx.fillStyle = projectile.color;
      this.ctx.strokeStyle = projectile.color.replace('88', '44');
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(projectile.pos.x, projectile.pos.y, projectile.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Add trail effect for homing projectiles
      if (projectile.color === '#ff8800') {
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ff880040';
        this.ctx.beginPath();
        this.ctx.arc(projectile.pos.x, projectile.pos.y, projectile.size * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  drawMouseCursor(mouse: Vector2): void {
    this.ctx.strokeStyle = '#ffffff44';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
}