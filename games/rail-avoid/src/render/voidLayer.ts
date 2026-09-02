/**
 * The void: a deep violet-black mass consuming the map from the west with an eroded, animated
 * edge (tendrils + particles being pulled in), an additive rim glow, faint stars and nebula
 * inside, and rifts as growing dark discs with a swirling ring and lightning arcs.
 * Redrawn every frame but only for what is inside the camera view.
 */
import Phaser from 'phaser';
import type { SimState } from '../core/types';
import { HEX_H, HEX_R, ISO_Y } from '../core/config';
import { hexToWorld, valueNoise, hash2 } from '../core/hex';
import { VOID_FILL, VOID_RIM, VOID_RIM_BRIGHT } from './palette';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';
import { TEX_SCALE } from './textures';

interface RiftView { ring: Phaser.GameObjects.Image; ring2: Phaser.GameObjects.Image; arcT: number; }

export class VoidLayer {
  public gfx: Phaser.GameObjects.Graphics;
  public glowGfx: Phaser.GameObjects.Graphics;
  private pts: Phaser.Geom.Point[] = [];
  private edge: Array<{ x: number; y: number }> = [];
  private nebula: Phaser.GameObjects.Image[] = [];
  private erosion: Phaser.GameObjects.Particles.ParticleEmitter;
  private rifts = new Map<string, RiftView>();
  private riftPool: RiftView[] = [];
  private erodeAcc = 0;
  private settings: RenderSettings;

  constructor(private scene: Phaser.Scene, depth: number, private fx: FxLayer, settings: RenderSettings) {
    this.settings = settings;
    this.gfx = scene.add.graphics().setDepth(depth);
    this.glowGfx = scene.add.graphics().setDepth(depth + 0.2).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 4; i++) {
      const img = scene.add.image(0, 0, 'fog').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0x5a3fa8 : 0x3a2a7a).setAlpha(0.09).setScale(2.2 + (i % 3) * 0.6, 1.4 + (i % 2) * 0.5).setDepth(depth + 0.1);
      this.nebula.push(img);
    }
    this.erosion = scene.add.particles(0, 0, 'dot', {
      speedX: { min: -70, max: -30 }, speedY: { min: -12, max: 12 }, lifespan: { min: 700, max: 1400 },
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xa79cff, 0x6d5fd6, 0xffffff],
      blendMode: Phaser.BlendModes.ADD, emitting: false, maxAliveParticles: 300,
    }).setDepth(depth + 0.3);
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    this.gfx.destroy(); this.glowGfx.destroy(); this.erosion.destroy();
    for (const n of this.nebula) n.destroy();
    for (const r of this.rifts.values()) { r.ring.destroy(); r.ring2.destroy(); }
    for (const r of this.riftPool) { r.ring.destroy(); r.ring2.destroy(); }
  }

  update(state: SimState, timeSec: number, dt: number, view: Phaser.Geom.Rectangle): void {
    const g = this.gfx, gl = this.glowGfx;
    g.clear(); gl.clear();
    const v = state.void;
    if (!v || !Array.isArray(v.front) || v.front.length === 0) return;
    const mapH = state.mapH | 0;
    const rows = Math.min(mapH, v.front.length);
    if (rows <= 0) return;
    const reducedMotion = this.settings.reducedMotion;
    const anim = reducedMotion ? 0 : timeSec;
    const xLeft = -HEX_R * 6 - 800;
    const yTop = (-HEX_H * 1.5) * ISO_Y - 200;
    const yBot = (HEX_H * (mapH + 0.5)) * ISO_Y + 200;
    const SUB = 3;

    this.edge.length = 0;
    let minFront = Infinity;
    for (let r = -1; r <= rows; r++) {
      const r0 = Math.max(0, Math.min(rows - 1, r));
      const r1 = Math.max(0, Math.min(rows - 1, r + 1));
      const fx0 = this.frontAt(v.front, r0), fx1 = this.frontAt(v.front, r1);
      if (fx0 < minFront) minFront = fx0;
      for (let s = 0; s < SUB; s++) {
        const t = s / SUB;
        const yU = HEX_H * (r + t);
        const fxv = fx0 + (fx1 - fx0) * t;
        const n1 = valueNoise(yU * 0.02 + anim * 0.35, anim * 0.2, 7) - 0.5;
        const n2 = valueNoise(yU * 0.09 - anim * 0.6, 3.3, 19) - 0.5;
        const x = fxv + n1 * 26 + n2 * 10;
        this.edge.push({ x, y: yU * ISO_Y });
        if (r === rows && s === 0) break;
      }
    }
    const pts = this.pts;
    let n = 0;
    const put = (x: number, y: number) => {
      if (n >= pts.length) pts.push(new Phaser.Geom.Point(x, y)); else pts[n].setTo(x, y);
      n++;
    };
    put(xLeft, yTop);
    put(this.edge[0].x, yTop);
    for (const p of this.edge) put(p.x, p.y);
    put(this.edge[this.edge.length - 1].x, yBot);
    put(xLeft, yBot);
    const poly = pts.slice(0, n);

    // haze beyond the edge, main mass
    g.fillStyle(VOID_RIM, 0.10);
    const haze: Phaser.Geom.Point[] = poly.map(p => new Phaser.Geom.Point(p.x + 14, p.y));
    g.fillPoints(haze, true);
    g.fillStyle(VOID_FILL, 0.97);
    g.fillPoints(poly, true);

    // stars inside the void (view-limited, deterministic per cell)
    const inViewEdge = this.edge.filter(p => p.y > view.y - 40 && p.y < view.bottom + 40);
    if (this.settings.quality !== 'low') {
      const cell = 48;
      const cx0 = Math.floor(Math.max(view.x, minFront - 2600) / cell), cx1 = Math.ceil(Math.min(view.right, this.maxEdgeX() + 40) / cell);
      const cy0 = Math.floor(view.y / cell), cy1 = Math.ceil(view.bottom / cell);
      let count = 0;
      outer: for (let cy = cy0; cy <= cy1; cy++) {
        const ey = cy * cell;
        const edgeX = this.edgeXAt(ey);
        for (let cx = cx0; cx <= cx1; cx++) {
          const h = hash2(cx, cy, 91);
          if (h > 0.42) continue;
          const sx = cx * cell + hash2(cx, cy, 92) * cell, sy = ey + hash2(cx, cy, 93) * cell;
          if (sx > edgeX - 12) continue;
          if (++count > 450) break outer;
          const tw = 0.35 + 0.45 * hash2(cx, cy, 94) + (reducedMotion ? 0 : Math.sin(timeSec * 2 + h * 40) * 0.25);
          const big = h < 0.08;
          gl.fillStyle(big ? 0xc8b8ff : 0xffffff, Math.max(0.05, tw * 0.6));
          gl.fillRect(sx - (big ? 1.4 : 0.9), sy - (big ? 1.4 : 0.9), big ? 2.8 : 1.8, big ? 2.8 : 1.8);
        }
      }
    }
    // nebula blobs drift deep inside the void
    for (let i = 0; i < this.nebula.length; i++) {
      const nb = this.nebula[i];
      const baseY = (i + 0.5) / this.nebula.length * (HEX_H * mapH * ISO_Y);
      const x = minFront - 220 - (i % 3) * 260 + (reducedMotion ? 0 : Math.sin(timeSec * 0.11 + i) * 60);
      const y = baseY + (reducedMotion ? 0 : Math.cos(timeSec * 0.08 + i * 1.7) * 50);
      const vis = this.settings.quality !== 'low' && x + 300 > view.x && x - 300 < view.right && y + 200 > view.y && y - 200 < view.bottom;
      nb.setVisible(vis);
      if (vis) nb.setPosition(x, y).setAlpha(0.07 + 0.03 * Math.sin(timeSec * 0.5 + i));
    }

    // rim: additive glow + crisp line
    gl.lineStyle(14, VOID_RIM, 0.10);
    gl.strokePoints(this.edge, false, false);
    gl.lineStyle(6, VOID_RIM, 0.22);
    gl.strokePoints(this.edge, false, false);
    g.lineStyle(2, VOID_RIM, 0.8);
    g.strokePoints(this.edge, false, false);
    gl.lineStyle(1, VOID_RIM_BRIGHT, 0.55);
    gl.strokePoints(this.edge, false, false);

    // tendrils + erosion particles (only along the visible part of the edge)
    if (!reducedMotion && inViewEdge.length) {
      for (let i = 2; i < this.edge.length - 2; i += 3) {
        const p = this.edge[i];
        if (p.y < view.y - 40 || p.y > view.bottom + 40) continue;
        const ph = timeSec * 1.3 + i * 0.7;
        const len = 14 + Math.sin(ph) * 10 + Math.sin(ph * 2.3) * 5;
        if (len < 10) continue;
        const w = 3 + Math.sin(ph * 0.7) * 1.5;
        const ty = p.y + Math.sin(ph * 1.7) * 3;
        g.fillStyle(VOID_FILL, 0.85);
        g.fillTriangle(p.x - 2, p.y - w, p.x - 2, p.y + w, p.x + len, ty);
        gl.fillStyle(VOID_RIM_BRIGHT, 0.5);
        gl.fillRect(p.x + len - 1.5, ty - 1.5, 3, 3);
      }
      if (this.settings.quality !== 'low') {
        this.erodeAcc += dt * 14 * this.settings.particleMul * Math.min(1, inViewEdge.length / 20);
        while (this.erodeAcc >= 1) {
          this.erodeAcc -= 1;
          const p = inViewEdge[Math.floor(Math.random() * inViewEdge.length)];
          this.erosion.emitParticleAt(p.x + 6 + Math.random() * 30, p.y + (Math.random() - 0.5) * 24, 1);
        }
      }
    }

    // rifts
    const seen = new Set<string>();
    if (Array.isArray(v.rifts)) {
      for (const rift of v.rifts) {
        if (!rift) continue;
        const w = hexToWorld(rift.col, rift.row);
        const cx = w.x, cy = w.y * ISO_Y;
        const radius = Math.max(0, rift.radius || 0);
        if (!rift.opened || radius <= 0) {
          const remaining = (rift.openAt ?? 0) - state.time;
          if (remaining > 0 && remaining < 25) {
            const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(timeSec * 6);
            gl.lineStyle(2, VOID_RIM_BRIGHT, 0.25 + 0.45 * pulse * (1 - remaining / 25));
            gl.strokeEllipse(cx, cy, HEX_R * 1.6, HEX_R * 1.6 * ISO_Y);
            g.fillStyle(VOID_FILL, 0.25 * (1 - remaining / 25));
            g.fillEllipse(cx, cy, HEX_R * 1.2, HEX_R * 1.2 * ISO_Y);
          }
          continue;
        }
        seen.add(rift.id);
        const rx = radius, ry = radius * ISO_Y;
        gl.fillStyle(VOID_RIM, 0.14);
        gl.fillEllipse(cx, cy, rx * 2 + 24, ry * 2 + 24 * ISO_Y);
        g.fillStyle(VOID_FILL, 0.96);
        g.fillEllipse(cx, cy, rx * 2, ry * 2);
        const wob = reducedMotion ? 0 : Math.sin(timeSec * 3 + rift.col) * 1.5;
        g.lineStyle(2, VOID_RIM, 0.85);
        g.strokeEllipse(cx, cy, rx * 2 + wob, ry * 2 + wob * ISO_Y);
        gl.lineStyle(1, VOID_RIM_BRIGHT, 0.6);
        gl.strokeEllipse(cx, cy, rx * 2 - 4, ry * 2 - 4 * ISO_Y);
        gl.fillStyle(0xd8ccff, 0.5);
        gl.fillEllipse(cx, cy, 6, 4);
        // swirling ring sprites + lightning arcs
        const inView = cx + rx > view.x && cx - rx < view.right && cy + ry > view.y && cy - ry < view.bottom;
        let rv = this.rifts.get(rift.id);
        if (!rv) { rv = this.acquireRift(); this.rifts.set(rift.id, rv); }
        rv.ring.setVisible(inView).setPosition(cx, cy).setScale(TEX_SCALE * (rx * 2) / 112, TEX_SCALE * (ry * 2) / 112).setRotation(reducedMotion ? 0 : timeSec * 0.9);
        rv.ring2.setVisible(inView).setPosition(cx, cy).setScale(TEX_SCALE * (rx * 1.4) / 112, TEX_SCALE * (ry * 1.4) / 112).setRotation(reducedMotion ? 0 : -timeSec * 1.5);
        if (inView && !reducedMotion && this.settings.quality !== 'low') {
          rv.arcT -= dt;
          if (rv.arcT <= 0) {
            rv.arcT = 0.35 + Math.random() * 0.9;
            const a0 = Math.random() * Math.PI * 2, a1 = a0 + 0.6 + Math.random() * 1.2;
            this.fx.arcP(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx * 0.9, cy + Math.sin(a1) * ry * 0.9, 0xd8ccff);
          }
        }
      }
    }
    for (const [id, rv] of this.rifts) {
      if (!seen.has(id)) { rv.ring.setVisible(false); rv.ring2.setVisible(false); this.riftPool.push(rv); this.rifts.delete(id); }
    }
  }

  private acquireRift(): RiftView {
    const r = this.riftPool.pop();
    if (r) return r;
    const depth = this.gfx.depth + 0.25;
    const ring = this.scene.add.image(0, 0, 'rift_ring').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(depth);
    const ring2 = this.scene.add.image(0, 0, 'rift_ring').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(depth).setTint(0xffffff);
    return { ring, ring2, arcT: Math.random() };
  }

  private maxEdgeX(): number { let m = -Infinity; for (const p of this.edge) if (p.x > m) m = p.x; return m; }
  private edgeXAt(y: number): number {
    const e = this.edge;
    if (!e.length) return -Infinity;
    if (y <= e[0].y) return e[0].x;
    for (let i = 1; i < e.length; i++) {
      if (y <= e[i].y) { const t = (y - e[i - 1].y) / Math.max(1e-6, e[i].y - e[i - 1].y); return e[i - 1].x + (e[i].x - e[i - 1].x) * t; }
    }
    return e[e.length - 1].x;
  }

  private frontAt(front: number[], r: number): number {
    const x = front[r];
    return Number.isFinite(x) ? x : -HEX_R * 4;
  }
}
