import { Vector2 } from '../utils/Vector2.js';
import { Rectangle } from '../utils/Rectangle.js';

export type TerrainType = 'desert' | 'urban' | 'forest' | 'industrial';

interface TerrainFeature {
  position: Vector2;
  size: Vector2;
  type: 'building' | 'rock' | 'tree' | 'wall' | 'crater';
  color: string;
  destructible: boolean;
  health: number;
  maxHealth: number;
}

export class TerrainSystem {
  private features: TerrainFeature[] = [];
  private terrainType: TerrainType;
  private worldWidth: number;
  private worldHeight: number;
  private backgroundColor: string;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.terrainType = this.getRandomTerrainType();
    this.generateTerrain();
  }

  private getRandomTerrainType(): TerrainType {
    const types: TerrainType[] = ['desert', 'urban', 'forest', 'industrial'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateTerrain(): void {
    this.features = [];
    
    switch (this.terrainType) {
      case 'desert':
        this.backgroundColor = '#D2B48C';
        this.generateDesertTerrain();
        break;
      case 'urban':
        this.backgroundColor = '#696969';
        this.generateUrbanTerrain();
        break;
      case 'forest':
        this.backgroundColor = '#228B22';
        this.generateForestTerrain();
        break;
      case 'industrial':
        this.backgroundColor = '#2F4F4F';
        this.generateIndustrialTerrain();
        break;
    }
  }

  private generateDesertTerrain(): void {
    // Generate rocks and dunes
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const size = 30 + Math.random() * 40;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(size, size),
        type: 'rock',
        color: '#8B7355',
        destructible: true,
        health: 100,
        maxHealth: 100
      });
    }
    
    // Generate some craters
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const size = 40 + Math.random() * 30;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(size, size),
        type: 'crater',
        color: '#8B4513',
        destructible: false,
        health: 0,
        maxHealth: 0
      });
    }
  }

  private generateUrbanTerrain(): void {
    // Generate buildings in a grid-like pattern
    const buildingSpacing = 120;
    const gridWidth = Math.floor(this.worldWidth / buildingSpacing);
    const gridHeight = Math.floor(this.worldHeight / buildingSpacing);
    
    for (let x = 1; x < gridWidth - 1; x++) {
      for (let y = 1; y < gridHeight - 1; y++) {
        if (Math.random() < 0.6) { // 60% chance for building
          const posX = x * buildingSpacing + (Math.random() - 0.5) * 40;
          const posY = y * buildingSpacing + (Math.random() - 0.5) * 40;
          const width = 40 + Math.random() * 30;
          const height = 40 + Math.random() * 30;
          
          this.features.push({
            position: new Vector2(posX, posY),
            size: new Vector2(width, height),
            type: 'building',
            color: '#708090',
            destructible: true,
            health: 200,
            maxHealth: 200
          });
        }
      }
    }
    
    // Add some walls
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const isVertical = Math.random() < 0.5;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(isVertical ? 10 : 80, isVertical ? 80 : 10),
        type: 'wall',
        color: '#A9A9A9',
        destructible: true,
        health: 150,
        maxHealth: 150
      });
    }
  }

  private generateForestTerrain(): void {
    // Generate trees randomly
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const size = 20 + Math.random() * 25;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(size, size),
        type: 'tree',
        color: '#006400',
        destructible: true,
        health: 75,
        maxHealth: 75
      });
    }
    
    // Add some rocks
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const size = 25 + Math.random() * 20;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(size, size),
        type: 'rock',
        color: '#696969',
        destructible: true,
        health: 120,
        maxHealth: 120
      });
    }
  }

  private generateIndustrialTerrain(): void {
    // Generate large industrial structures
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const width = 60 + Math.random() * 40;
      const height = 60 + Math.random() * 40;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(width, height),
        type: 'building',
        color: '#4682B4',
        destructible: true,
        health: 300,
        maxHealth: 300
      });
    }
    
    // Add metal walls
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const isVertical = Math.random() < 0.5;
      
      this.features.push({
        position: new Vector2(x, y),
        size: new Vector2(isVertical ? 8 : 60, isVertical ? 60 : 8),
        type: 'wall',
        color: '#778899',
        destructible: true,
        health: 180,
        maxHealth: 180
      });
    }
  }

  checkCollision(position: Vector2, radius: number): TerrainFeature | null {
    for (const feature of this.features) {
      if (feature.health <= 0) continue; // Skip destroyed features
      
      const bounds = new Rectangle(
        feature.position.x - feature.size.x / 2,
        feature.position.y - feature.size.y / 2,
        feature.size.x,
        feature.size.y
      );
      
      if (bounds.intersectsCircle(position, radius)) {
        return feature;
      }
    }
    return null;
  }

  damageFeature(feature: TerrainFeature, damage: number): boolean {
    if (!feature.destructible) return false;
    
    feature.health -= damage;
    if (feature.health <= 0) {
      feature.health = 0;
      return true; // Feature destroyed
    }
    return false;
  }

  getCollisionBounds(): Rectangle[] {
    return this.features
      .filter(feature => feature.health > 0)
      .map(feature => new Rectangle(
        feature.position.x - feature.size.x / 2,
        feature.position.y - feature.size.y / 2,
        feature.size.x,
        feature.size.y
      ));
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
    
    // Render terrain pattern
    this.renderTerrainPattern(ctx);
    
    // Render features
    for (const feature of this.features) {
      if (feature.health <= 0) continue;
      
      this.renderFeature(ctx, feature);
    }
  }

  private renderTerrainPattern(ctx: CanvasRenderingContext2D): void {
    const patternSize = 50;
    
    switch (this.terrainType) {
      case 'desert':
        // Sand dune pattern
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (let x = 0; x < this.worldWidth; x += patternSize) {
          for (let y = 0; y < this.worldHeight; y += patternSize) {
            ctx.beginPath();
            ctx.arc(x + Math.random() * patternSize, y + Math.random() * patternSize, 10, 0, Math.PI);
            ctx.stroke();
          }
        }
        break;
        
      case 'urban':
        // Street grid
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        for (let x = 0; x < this.worldWidth; x += 120) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.worldHeight);
          ctx.stroke();
        }
        for (let y = 0; y < this.worldHeight; y += 120) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.worldWidth, y);
          ctx.stroke();
        }
        break;
        
      case 'forest':
        // Grass texture
        ctx.fillStyle = '#32CD32';
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 200; i++) {
          const x = Math.random() * this.worldWidth;
          const y = Math.random() * this.worldHeight;
          ctx.fillRect(x, y, 2, 8);
        }
        break;
        
      case 'industrial':
        // Metal grating pattern
        ctx.strokeStyle = '#B0C4DE';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (let x = 0; x < this.worldWidth; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.worldHeight);
          ctx.stroke();
        }
        for (let y = 0; y < this.worldHeight; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.worldWidth, y);
          ctx.stroke();
        }
        break;
    }
    
    ctx.globalAlpha = 1;
  }

  private renderFeature(ctx: CanvasRenderingContext2D, feature: TerrainFeature): void {
    ctx.save();
    
    const x = feature.position.x - feature.size.x / 2;
    const y = feature.position.y - feature.size.y / 2;
    
    // Damage effect
    const damagePercent = feature.health / feature.maxHealth;
    if (damagePercent < 1 && feature.destructible) {
      ctx.globalAlpha = 0.5 + damagePercent * 0.5;
    }
    
    ctx.fillStyle = feature.color;
    
    switch (feature.type) {
      case 'building':
        ctx.fillRect(x, y, feature.size.x, feature.size.y);
        // Add windows
        ctx.fillStyle = '#FFFF00';
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (Math.random() < 0.7) {
              ctx.fillRect(
                x + 5 + i * (feature.size.x / 3),
                y + 5 + j * (feature.size.y / 3),
                8, 8
              );
            }
          }
        }
        break;
        
      case 'rock':
        ctx.beginPath();
        ctx.arc(feature.position.x, feature.position.y, feature.size.x / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'tree':
        // Tree trunk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(feature.position.x - 3, feature.position.y - 3, 6, feature.size.y * 0.6);
        // Tree canopy
        ctx.fillStyle = feature.color;
        ctx.beginPath();
        ctx.arc(feature.position.x, feature.position.y - feature.size.y * 0.3, feature.size.x / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'wall':
        ctx.fillRect(x, y, feature.size.x, feature.size.y);
        break;
        
      case 'crater':
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(feature.position.x, feature.position.y, feature.size.x / 2, 0, Math.PI * 2);
        ctx.fill();
        // Inner crater
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.arc(feature.position.x, feature.position.y, feature.size.x / 3, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    
    ctx.restore();
  }

  regenerate(): void {
    this.terrainType = this.getRandomTerrainType();
    this.generateTerrain();
  }

  getTerrainType(): TerrainType {
    return this.terrainType;
  }

  getFeatures(): TerrainFeature[] {
    return this.features;
  }
}