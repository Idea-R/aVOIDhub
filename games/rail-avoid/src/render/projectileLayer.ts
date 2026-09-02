/** Projectiles from state.projectiles: pooled images per kind, smoothed toward sim positions. */
import Phaser from 'phaser';
import type { SimState, Projectile } from '../core/types';
import { ISO_Y } from '../core/config';
import { TEX_SCALE } from './textures';
import { expFactor } from './util';

interface PView { img: Phaser.GameObjects.Image; x: number; y: number; kind: string; startDist: number; }

const TEX: Record<string, string> = {
  shell: 'p_shell', flak: 'p_flak', tracer: 'p_tracer', bolt: 'p_bolt', flame: 'p_flame', enemy_shell: 'p_enemy_shell',
};

export class ProjectileLayer {
  private views = new Map<string, PView>();
  private pool: Phaser.GameObjects.Image[] = [];
  /** Called when a new enemy shell appears (boss turret recoil / muzzle light). */
  public onEnemyShot: ((x: number, y: number) => void) | null = null;

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer) {}

  destroy(): void {
    for (const v of this.views.values()) v.img.destroy();
    for (const p of this.pool) p.destroy();
    this.views.clear(); this.pool = [];
  }

  clear(): void {
    for (const v of this.views.values()) this.release(v);
    this.views.clear();
  }

  private acquire(kind: string): Phaser.GameObjects.Image {
    let img = this.pool.pop();
    const key = TEX[kind] ?? 'p_flak';
    if (!img) {
      img = this.scene.add.image(0, 0, key);
      this.layer.add(img);
    } else {
      img.setTexture(key);
    }
    img.setVisible(true).setAlpha(1).setScale(TEX_SCALE).setRotation(0);
    img.setBlendMode(kind === 'flame' || kind === 'bolt' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    return img;
  }
  private release(v: PView): void {
    v.img.setVisible(false);
    this.pool.push(v.img);
  }

  update(state: SimState, dt: number): void {
    const list = Array.isArray(state.projectiles) ? state.projectiles : [];
    const seen = new Set<string>();
    const k = expFactor(22, dt);
    for (const p of list) {
      if (!p || typeof p.id !== 'string') continue;
      seen.add(p.id);
      let v = this.views.get(p.id);
      if (!v) {
        v = { img: this.acquire(p.kind), x: p.x, y: p.y, kind: p.kind, startDist: Math.hypot(p.tx - p.x, p.ty - p.y) };
        this.views.set(p.id, v);
        if (p.kind === 'enemy_shell' && this.onEnemyShot) { try { this.onEnemyShot(p.x, p.y); } catch { /* ignore */ } }
      } else if (v.kind !== p.kind) {
        this.release(v);
        v = { img: this.acquire(p.kind), x: p.x, y: p.y, kind: p.kind, startDist: Math.hypot(p.tx - p.x, p.ty - p.y) };
        this.views.set(p.id, v);
      }
      v.x += (p.x - v.x) * k; v.y += (p.y - v.y) * k;
      this.place(v, p);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) { this.release(v); this.views.delete(id); }
    }
  }

  private place(v: PView, p: Projectile): void {
    const px = v.x, py = v.y * ISO_Y;
    const dx = p.tx - v.x, dy = (p.ty - v.y) * ISO_Y;
    const ang = Math.atan2(dy, dx);
    let alt = 8;
    if (p.kind === 'shell' || p.kind === 'enemy_shell') {
      const d = Math.hypot(p.tx - v.x, p.ty - v.y);
      const prog = v.startDist > 1 ? 1 - Math.min(1, d / v.startDist) : 1;
      alt = 8 + Math.sin(prog * Math.PI) * Math.min(40, v.startDist * 0.15);
    } else if (p.kind === 'flak') {
      alt = 26;
    }
    v.img.setPosition(px, py - alt).setRotation(ang);
    if (p.kind === 'flame') {
      v.img.setScale(TEX_SCALE * (0.7 + Math.random() * 0.5)).setAlpha(0.8);
    }
  }
}
