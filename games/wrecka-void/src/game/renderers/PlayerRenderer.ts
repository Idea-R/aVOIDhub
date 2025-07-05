import { Vector2 } from '../../types/Game';
import { ActiveEffects } from '../../types/PowerUps';

export class PlayerRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawPlayer(player: Vector2, playerSize: number, activeEffects: ActiveEffects): void {
    let playerColor = '#ffffff';
    let glowColor = '#4444ff';
    let glowSize = 15;
    
    if (activeEffects.berserk) {
      playerColor = '#ff6666';
      glowColor = '#ff0000';
      glowSize = 25;
    } else if (activeEffects.electrified) {
      playerColor = '#ffff66';
      glowColor = '#ffff00';
      glowSize = 20;
    } else if (activeEffects.hyperSpin) {
      playerColor = '#aa88ff';
      glowColor = '#8800ff';
      glowSize = 30;
    }
    
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = glowSize;
    
    this.ctx.fillStyle = playerColor;
    this.ctx.strokeStyle = '#cccccc';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, playerSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    
    // Draw player center dot
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, playerSize * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBall(ball: Vector2, ballRadius: number, activeEffects: ActiveEffects): void {
    let ballColor = '#cccccc';
    let glowColor = '#ffffff';
    let glowSize = 10;
    
    if (activeEffects.berserk) {
      ballColor = '#ff9999';
      glowColor = '#ff6666';
      glowSize = 20;
    } else if (activeEffects.electrified) {
      ballColor = '#ffff99';
      glowColor = '#ffff66';
      glowSize = 15;
    } else if (activeEffects.hyperSpin) {
      ballColor = '#cc99ff';
      glowColor = '#aa88ff';
      glowSize = 25;
    }
    
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = glowSize;
    
    // Main ball body
    this.ctx.fillStyle = ballColor;
    this.ctx.strokeStyle = '#888888';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    
    // Ball highlights and details
    this.drawBallDetails(ball, ballRadius, activeEffects);
  }

  drawSecondBall(ball: Vector2, activeEffects: ActiveEffects): void {
    const ballRadius = 12;
    let ballColor = '#bb99dd';
    let glowColor = '#9966cc';
    let glowSize = 8;
    
    if (activeEffects.berserk) {
      ballColor = '#dd99bb';
      glowColor = '#cc6699';
      glowSize = 15;
    } else if (activeEffects.electrified) {
      ballColor = '#dddd99';
      glowColor = '#cccc66';
      glowSize = 12;
    } else if (activeEffects.hyperSpin) {
      ballColor = '#aa88ff';
      glowColor = '#8800ff';
      glowSize = 20;
    }
    
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = glowSize;
    
    // Main ball body
    this.ctx.fillStyle = ballColor;
    this.ctx.strokeStyle = '#996699';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
    
    // Second ball specific details
    this.drawSecondBallDetails(ball, ballRadius, activeEffects);
  }

  private drawBallDetails(ball: Vector2, ballRadius: number, activeEffects: ActiveEffects): void {
    // Draw ball spikes or details based on upgrades
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 1;
    
    // Draw small spikes around the ball
    const spikeCount = 8;
    const spikeLength = ballRadius * 0.3;
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const baseX = ball.x + Math.cos(angle) * (ballRadius * 0.8);
      const baseY = ball.y + Math.sin(angle) * (ballRadius * 0.8);
      const tipX = ball.x + Math.cos(angle) * (ballRadius + spikeLength);
      const tipY = ball.y + Math.sin(angle) * (ballRadius + spikeLength);
      
      this.ctx.beginPath();
      this.ctx.moveTo(baseX, baseY);
      this.ctx.lineTo(tipX, tipY);
      this.ctx.stroke();
    }
    
    // Center highlight
    this.ctx.fillStyle = activeEffects.berserk ? '#ffcccc' : 
                        activeEffects.electrified ? '#ffffcc' :
                        activeEffects.hyperSpin ? '#eeccff' : '#eeeeee';
    this.ctx.beginPath();
    this.ctx.arc(ball.x - ballRadius * 0.3, ball.y - ballRadius * 0.3, ballRadius * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawSecondBallDetails(ball: Vector2, ballRadius: number, activeEffects: ActiveEffects): void {
    // Draw second ball specific details
    this.ctx.fillStyle = '#ffccff';
    this.ctx.strokeStyle = '#996699';
    this.ctx.lineWidth = 1;
    
    // Draw smaller spikes
    const spikeCount = 6;
    const spikeLength = ballRadius * 0.25;
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const baseX = ball.x + Math.cos(angle) * (ballRadius * 0.7);
      const baseY = ball.y + Math.sin(angle) * (ballRadius * 0.7);
      const tipX = ball.x + Math.cos(angle) * (ballRadius + spikeLength);
      const tipY = ball.y + Math.sin(angle) * (ballRadius + spikeLength);
      
      this.ctx.beginPath();
      this.ctx.moveTo(baseX, baseY);
      this.ctx.lineTo(tipX, tipY);
      this.ctx.stroke();
    }
    
    // Center highlight for second ball
    this.ctx.fillStyle = activeEffects.berserk ? '#ffddff' : 
                        activeEffects.electrified ? '#ffffdd' :
                        activeEffects.hyperSpin ? '#ddddff' : '#eeddee';
    this.ctx.beginPath();
    this.ctx.arc(ball.x - ballRadius * 0.2, ball.y - ballRadius * 0.2, ballRadius * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawMouseCursor(mouse: Vector2): void {
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.arc(mouse.x, mouse.y, 15, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw crosshair
    this.ctx.beginPath();
    this.ctx.moveTo(mouse.x - 10, mouse.y);
    this.ctx.lineTo(mouse.x + 10, mouse.y);
    this.ctx.moveTo(mouse.x, mouse.y - 10);
    this.ctx.lineTo(mouse.x, mouse.y + 10);
    this.ctx.stroke();
  }
} 