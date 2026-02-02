import { Vector2, ChainSegment, SecondChain } from '../../types/Game';
import { ActiveEffects, PlayerUpgrades } from '../../types/PowerUps';

export class ChainRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
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
        this.drawChainSpikes(segment.pos, linkRadius, chainDamageLevel);
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
    this.ctx.lineWidth = isRetracting ? 6 : 4;
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

    // Draw chain links for second chain
    secondChain.segments.forEach((segment, index) => {
      if (index === 0) return;
      
      const chainDamageLevel = playerUpgrades?.chainDamage || 0;
      const baseRadius = isRetracting ? 6 : 4;
      const linkRadius = baseRadius + (chainDamageLevel * 1.5);
      
      this.ctx.fillStyle = isRetracting ? '#dd99ff' : '#bb66dd';
      this.ctx.strokeStyle = isRetracting ? '#996699' : '#663366';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(segment.pos.x, segment.pos.y, linkRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw spikes on second chain links if chain damage is upgraded
      if (chainDamageLevel > 0) {
        this.drawChainSpikes(segment.pos, linkRadius, chainDamageLevel, true);
      }
    });
  }

  private drawChainSpikes(position: Vector2, linkRadius: number, chainDamageLevel: number, isSecondChain = false): void {
    const spikeCount = 4 + (chainDamageLevel * 2);
    const spikeLength = linkRadius * 0.4;
    
    this.ctx.fillStyle = isSecondChain ? '#ddccff' : '#cccccc';
    this.ctx.strokeStyle = isSecondChain ? '#aa88cc' : '#888888';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const baseX = position.x + Math.cos(angle) * (linkRadius * 0.8);
      const baseY = position.y + Math.sin(angle) * (linkRadius * 0.8);
      const tipX = position.x + Math.cos(angle) * (linkRadius + spikeLength);
      const tipY = position.y + Math.sin(angle) * (linkRadius + spikeLength);
      
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
} 