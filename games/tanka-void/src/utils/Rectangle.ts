import { Vector2 } from './Vector2.js';

export class Rectangle {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}

  get left(): number { return this.x; }
  get right(): number { return this.x + this.width; }
  get top(): number { return this.y; }
  get bottom(): number { return this.y + this.height; }
  get centerX(): number { return this.x + this.width / 2; }
  get centerY(): number { return this.y + this.height / 2; }
  get center(): Vector2 { return new Vector2(this.centerX, this.centerY); }

  contains(point: Vector2): boolean {
    return point.x >= this.left && point.x <= this.right && 
           point.y >= this.top && point.y <= this.bottom;
  }

  intersects(other: Rectangle): boolean {
    return !(other.left > this.right || 
             other.right < this.left || 
             other.top > this.bottom || 
             other.bottom < this.top);
  }

  intersectsCircle(center: Vector2, radius: number): boolean {
    const closestX = Math.max(this.left, Math.min(center.x, this.right));
    const closestY = Math.max(this.top, Math.min(center.y, this.bottom));
    
    const dx = center.x - closestX;
    const dy = center.y - closestY;
    
    return (dx * dx + dy * dy) <= (radius * radius);
  }
}