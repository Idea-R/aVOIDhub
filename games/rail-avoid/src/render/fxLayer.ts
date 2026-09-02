/**
 * Effects: particle emitters (pooled by Phaser), transient vector shapes (tracers, tesla chains,
 * rings, lightning, flame puffs) drawn into two Graphics per frame, and a pool of floating texts.
 * All public methods take UNPROJECTED world px (sim space) and project internally.
 */
import Phaser from 'phaser';
import { ISO_Y } from '../core/config';
import type { RenderSettings } from './settings';
import { FONT } from './palette';
import { cssColor, disc } from './util';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

interface Shape {
  kind: 'line' | 'ring' | 'flash' | 'bolt' | 'chain' | 'cone';
  t0: number; life: number; color: number; alpha: number;
  x: number; y: number; x2: number; y2: number; r: number; r2: number; w: number;
  pts: number[]; glow: boolean; jitter: number;
}
interface Puff { x: number; y: number; vx: number; vy: number; t0: number; life: number; r0: number; r1: number; c0: number; c1: number; add: boolean; a0: number; }
interface Floater { text: Phaser.GameObjects.Text; t0: number; life: number; x: number; y: number; rise: number; }

export class FxLayer {
  public lineGfx: Phaser.GameObjects.Graphics;
  public glowGfx: Phaser.GameObjects.Graphics;
  private shapes: Shape[] = [];
  private puffs: Puff[] = [];
  private floaters: Floater[] = [];
  private textPool: Phaser.GameObjects.Text[] = [];
  private settings: RenderSettings;
  private now = 0;

  private sparkE!: Emitter;
  private smokeE!: Emitter;
  private fireE!: Emitter;
  private debrisE!: Emitter;
  private confettiE!: Emitter;
  private emberE!: Emitter;
  private steamE!: Emitter;
  private steamBigE!: Emitter;
  private ambientE: Emitter[] = [];
  private ambientAcc = 0;
  private emitters: Emitter[] = [];

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer, settings: RenderSettings) {
    this.settings = settings;
    this.lineGfx = scene.add.graphics();
    this.glowGfx = scene.add.graphics();
    this.glowGfx.setBlendMode(Phaser.BlendModes.ADD);
    layer.add(this.lineGfx);
    layer.add(this.glowGfx);
    this.createEmitters();
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  private createEmitters(): void {
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Emitter => {
      const e = this.scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      this.layer.add(e);
      this.emitters.push(e);
      return e;
    };
    this.sparkE = mk('spark', {
      speed: { min: 60, max: 240 }, angle: { min: 0, max: 360 }, lifespan: { min: 180, max: 520 },
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 320, blendMode: Phaser.BlendModes.ADD,
      rotate: { min: 0, max: 360 }, maxAliveParticles: 600,
    });
    this.smokeE = mk('smoke', {
      speed: { min: 6, max: 28 }, angle: { min: 245, max: 295 }, lifespan: { min: 900, max: 1700 },
      scale: { start: 0.45, end: 1.5 }, alpha: { start: 0.32, end: 0 }, tint: 0x9aa0b0, gravityY: -18, maxAliveParticles: 400,
    });
    this.fireE = mk('soft', {
      speed: { min: 10, max: 45 }, angle: { min: 245, max: 295 }, lifespan: { min: 220, max: 560 },
      scale: { start: 0.65, end: 0.08 }, alpha: { start: 0.9, end: 0 }, tint: [0xffd070, 0xff8a3a, 0xff5030],
      blendMode: Phaser.BlendModes.ADD, gravityY: -40, maxAliveParticles: 400,
    });
    this.debrisE = mk('sq', {
      speed: { min: 80, max: 280 }, angle: { min: 200, max: 340 }, lifespan: { min: 500, max: 1200 },
      scale: { start: 1, end: 0.4 }, gravityY: 520, rotate: { min: 0, max: 360 }, tint: 0x8a8f9a, maxAliveParticles: 300,
    });
    this.confettiE = mk('sq', {
      speed: { min: 60, max: 170 }, angle: { min: 215, max: 325 }, lifespan: { min: 700, max: 1400 },
      scale: { start: 0.9, end: 0.4 }, gravityY: 240, rotate: { start: 0, end: 360 },
      tint: [0xe8c170, 0x6fbf73, 0x6fb7e8, 0xe86f6f, 0xf4f6fb, 0xb98fe8], maxAliveParticles: 300,
    });
    this.emberE = mk('dot', {
      speed: { min: 20, max: 90 }, angle: { min: 0, max: 360 }, lifespan: { min: 300, max: 900 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: Phaser.BlendModes.ADD, maxAliveParticles: 500,
    });
    this.steamE = mk('smoke', {
      speed: { min: 8, max: 30 }, angle: { min: 240, max: 300 }, lifespan: { min: 1100, max: 2000 },
      scale: { start: 0.35, end: 1.6 }, alpha: { start: 0.4, end: 0 }, tint: 0xd0d4dc, gravityY: -26, maxAliveParticles: 400,
    });
    this.steamBigE = mk('smoke', {
      speed: { min: 14, max: 44 }, angle: { min: 235, max: 305 }, lifespan: { min: 1400, max: 2600 },
      scale: { start: 0.6, end: 2.6 }, alpha: { start: 0.42, end: 0 }, tint: 0xd0d4dc, gravityY: -34, maxAliveParticles: 400,
    });
    // region ambience: pollen / dust / ash embers / void motes (world space, emitted inside the view)
    this.ambientE = [
      mk('dot', { speedX: { min: -6, max: 10 }, speedY: { min: -10, max: 4 }, lifespan: { min: 3000, max: 5000 }, scale: { start: 0.28, end: 0.1 }, alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' }, tint: [0xfff2a0, 0xffe070], blendMode: Phaser.BlendModes.ADD, maxAliveParticles: 260 }),
      mk('dot', { speedX: { min: 18, max: 46 }, speedY: { min: -6, max: 6 }, lifespan: { min: 2500, max: 4200 }, scale: { start: 0.4, end: 0.15 }, alpha: { start: 0, end: 0.35, ease: 'Sine.easeInOut' }, tint: [0xd8b890, 0xb89a70], maxAliveParticles: 260 }),
      mk('dot', { speedX: { min: -14, max: 14 }, speedY: { min: -22, max: -6 }, lifespan: { min: 2200, max: 4000 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xff9a50, 0xff6a30, 0x8a8a94], blendMode: Phaser.BlendModes.ADD, maxAliveParticles: 260 }),
      mk('dot', { speedX: { min: -12, max: 12 }, speedY: { min: -12, max: 12 }, lifespan: { min: 3000, max: 5000 }, scale: { start: 0.45, end: 0 }, alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' }, tint: [0xb49cff, 0x8f7bff, 0xffffff], blendMode: Phaser.BlendModes.ADD, maxAliveParticles: 260 }),
    ];
  }

  destroy(): void {
    for (const e of this.emitters) e.destroy();
    this.emitters = [];
    for (const t of this.textPool) t.destroy();
    this.textPool = [];
    this.floaters = [];
    this.lineGfx.destroy(); this.glowGfx.destroy();
  }

  clear(): void {
    this.shapes.length = 0; this.puffs.length = 0;
    for (const f of this.floaters) f.text.setVisible(false);
    this.floaters.length = 0;
    for (const e of this.emitters) { try { e.killAll(); } catch { /* ignore */ } }
  }

  private n(count: number): number {
    const mul = this.settings.particleMul * (this.settings.reducedMotion ? 0.5 : 1);
    return Math.max(1, Math.round(count * mul));
  }
  private px(x: number): number { return x; }
  private py(y: number): number { return y * ISO_Y; }

  // ---------------- particles ----------------
  burst(x: number, y: number, color: number, count = 10): void {
    this.emberE.setParticleTint(color);
    this.emberE.explode(this.n(count), this.px(x), this.py(y) - 6);
  }
  sparks(x: number, y: number, count = 6, color = 0xffe8a0): void {
    this.sparkE.setParticleTint(color);
    this.sparkE.explode(this.n(count), this.px(x), this.py(y));
  }
  /** Direct projected-space sparks (used for wheels that already know their screen-world pos). */
  sparksP(px: number, py: number, count = 4, color = 0xffe8a0): void {
    this.sparkE.setParticleTint(color);
    this.sparkE.explode(this.n(count), px, py);
  }
  smoke(x: number, y: number, count = 1, tint = 0x9aa0b0): void {
    this.smokeE.setParticleTint(tint);
    this.smokeE.emitParticleAt(this.px(x), this.py(y), this.n(count));
  }
  smokeP(px: number, py: number, count = 1, tint = 0x9aa0b0): void {
    this.smokeE.setParticleTint(tint);
    this.smokeE.emitParticleAt(px, py, this.n(count));
  }
  fire(x: number, y: number, count = 1): void {
    this.fireE.emitParticleAt(this.px(x), this.py(y), this.n(count));
  }
  fireP(px: number, py: number, count = 1): void {
    this.fireE.emitParticleAt(px, py, this.n(count));
  }
  /** Locomotive steam (projected). `big` = fast train → larger plumes. */
  steamP(px: number, py: number, count: number, big: boolean, tint = 0xd0d4dc): void {
    const e = big ? this.steamBigE : this.steamE;
    e.setParticleTint(tint);
    e.emitParticleAt(px, py, this.n(count));
  }
  /** Region ambience inside the camera view. */
  ambient(region: number, view: Phaser.Geom.Rectangle, dt: number): void {
    if (this.settings.quality === 'low') return;
    const e = this.ambientE[Math.max(0, Math.min(3, region | 0))];
    if (!e) return;
    const area = Math.min(1, (view.width * view.height) / (1600 * 900));
    this.ambientAcc += dt * 14 * this.settings.particleMul * (0.4 + 0.6 * area);
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      e.emitParticleAt(view.x + Math.random() * view.width, view.y + Math.random() * view.height, 1);
    }
  }
  /** Short additive light that briefly lights nearby cars (muzzle flash light), projected coords. */
  lightP(px: number, py: number, color: number, r = 36, life = 90): void {
    this.addShape({ kind: 'flash', x: px, y: py, r: r, r2: r * 0.7, color, alpha: 0.22, life, glow: true });
    this.addShape({ kind: 'flash', x: px, y: py, r: r * 0.45, r2: r * 0.2, color: 0xffffff, alpha: 0.35, life: life * 0.6, glow: true });
  }
  /** Small lightning arc between two projected points (rift rims, tesla idle). */
  arcP(x1: number, y1: number, x2: number, y2: number, color = 0xd8ccff): void {
    const pts: number[] = [];
    const segs = 5;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const j = i === 0 || i === segs ? 0 : 6;
      pts.push(x1 + (x2 - x1) * t + (Math.random() - 0.5) * j, y1 + (y2 - y1) * t + (Math.random() - 0.5) * j);
    }
    this.addShape({ kind: 'bolt', pts, color, alpha: 0.9, life: 140, w: 1.5, glow: true, jitter: 2 });
  }
  /** Particles spiralling inward toward a point (Void Maw), projected coords. */
  spiralP(cx: number, cy: number, r: number, color: number): void {
    const a = Math.random() * Math.PI * 2;
    const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r * ISO_Y;
    const ix = (cx - sx), iy = (cy - sy);
    const len = Math.hypot(ix, iy) || 1;
    const tx = -iy / len, ty = ix / len;
    this.puffs.push({ x: sx, y: sy, vx: (ix / len) * 70 + tx * 55, vy: (iy / len) * 70 + ty * 55, t0: this.now, life: 900, r0: 3.5, r1: 0.5, c0: color, c1: 0xffffff, add: true, a0: 0.8 });
  }
  debris(x: number, y: number, count = 8, color = 0x8a8f9a): void {
    this.debrisE.setParticleTint(color);
    this.debrisE.explode(this.n(count), this.px(x), this.py(y) - 4);
  }
  confetti(x: number, y: number, count = 24): void {
    this.confettiE.explode(this.n(count), this.px(x), this.py(y) - 10);
  }

  // ---------------- composite effects ----------------
  explosion(x: number, y: number, radius: number, big = false): void {
    const px = this.px(x), py = this.py(y);
    const r = Math.max(16, radius);
    this.addShape({ kind: 'flash', x: px, y: py, r: r * 0.5, r2: r * 1.1, color: 0xfff0c0, alpha: 0.9, life: 160, glow: true });
    this.addShape({ kind: 'ring', x: px, y: py, r: r * 0.2, r2: r * 1.35, color: 0xffb060, alpha: 0.9, life: big ? 520 : 340, w: big ? 4 : 2.5, glow: false });
    if (big) this.addShape({ kind: 'ring', x: px, y: py, r: r * 0.1, r2: r * 2, color: 0xffffff, alpha: 0.6, life: 700, w: 2, glow: true });
    this.sparks(x, y, big ? 40 : 14, 0xffc870);
    this.fireE.explode(this.n(big ? 26 : 10), px, py);
    this.smokeE.setParticleTint(0x6a6a78);
    this.smokeE.explode(this.n(big ? 14 : 5), px, py - 4);
    this.debris(x, y, big ? 22 : 8, big ? 0x5ee0b0 : 0x8a8f9a);
    // expanding smoke ring
    const ringN = big ? 12 : 7;
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 + Math.random() * 0.3, sp = (big ? 90 : 55) * (0.8 + Math.random() * 0.4);
      this.puffs.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * ISO_Y - 8, t0: this.now, life: big ? 900 : 650, r0: 5, r1: big ? 20 : 12, c0: 0x8a8a94, c1: 0x3a3a44, add: false, a0: 0.55 });
    }
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * (big ? 120 : 60);
      this.puffs.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * ISO_Y - 20, t0: this.now, life: 350 + Math.random() * 250, r0: 4, r1: big ? 22 : 12, c0: 0xffe090, c1: 0xff4020, add: true, a0: 0.8 });
    }
  }
  implosion(x: number, y: number): void {
    const px = this.px(x), py = this.py(y);
    this.addShape({ kind: 'ring', x: px, y: py, r: 30, r2: 2, color: 0x6d5fd6, alpha: 0.8, life: 420, w: 2, glow: true });
    this.emberE.setParticleTint(0x9a6fff);
    this.emberE.explode(this.n(8), px, py);
  }
  shockwave(x: number, y: number, radius = 120): void {
    const px = this.px(x), py = this.py(y);
    this.addShape({ kind: 'ring', x: px, y: py, r: 4, r2: radius, color: 0xa79cff, alpha: 0.9, life: 650, w: 4, glow: true });
    this.addShape({ kind: 'ring', x: px, y: py, r: 2, r2: radius * 0.7, color: 0xffffff, alpha: 0.6, life: 500, w: 2, glow: false });
    this.emberE.setParticleTint(0x6d5fd6);
    this.emberE.explode(this.n(18), px, py);
  }
  ring(x: number, y: number, radius: number, color: number, life = 300, w = 2): void {
    this.addShape({ kind: 'ring', x: this.px(x), y: this.py(y), r: radius * 0.3, r2: radius, color, alpha: 0.8, life, w, glow: false });
  }
  tracer(x: number, y: number, tx: number, ty: number, color = 0xfff2b0): void {
    this.addShape({ kind: 'line', x: this.px(x), y: this.py(y) - 8, x2: this.px(tx), y2: this.py(ty) - 6, color, alpha: 0.9, life: 60, w: 1.5, glow: true });
  }
  muzzle(x: number, y: number, color = 0xffe8a0, r = 5): void {
    this.addShape({ kind: 'flash', x: this.px(x), y: this.py(y) - 8, r, r2: r * 1.6, color, alpha: 0.9, life: 50, glow: true });
  }
  teslaChain(points: Array<[number, number]>): void {
    if (!points || points.length < 2) return;
    const pts: number[] = [];
    for (const p of points) { if (!p) continue; pts.push(this.px(p[0]), this.py(p[1]) - 8); }
    this.addShape({ kind: 'chain', pts, color: 0x8fd3ff, alpha: 1, life: 120, w: 2, glow: true, jitter: 4 });
    for (const p of points) { if (p) { this.emberE.setParticleTint(0x8fd3ff); this.emberE.explode(this.n(3), this.px(p[0]), this.py(p[1]) - 8); } }
  }
  lightning(x: number, y: number): void {
    const px = this.px(x), py = this.py(y);
    const pts: number[] = [];
    const segs = 9;
    const sx = px + (Math.random() - 0.5) * 120, sy = py - 520;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push(sx + (px - sx) * t + (i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 40), sy + (py - sy) * t);
    }
    this.addShape({ kind: 'bolt', pts, color: 0xffffff, alpha: 1, life: 180, w: 2.5, glow: true, jitter: 3 });
    this.addShape({ kind: 'flash', x: px, y: py, r: 12, r2: 40, color: 0xcfe8ff, alpha: 0.9, life: 220, glow: true });
    this.sparks(x, y, 16, 0xcfe8ff);
  }
  flameCone(x: number, y: number, tx: number, ty: number): void {
    const px = this.px(x), py = this.py(y) - 6;
    const dx = this.px(tx) - px, dy = this.py(ty) - py;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const cnt = this.n(4);
    for (let i = 0; i < cnt; i++) {
      const spread = (Math.random() - 0.5) * 0.7;
      const ca = Math.cos(spread), sa = Math.sin(spread);
      const vx = (ux * ca - uy * sa), vy = (ux * sa + uy * ca);
      const sp = 90 + Math.random() * 70;
      this.puffs.push({ x: px, y: py, vx: vx * sp, vy: vy * sp, t0: this.now, life: 380 + Math.random() * 200, r0: 3, r1: 11, c0: 0xffe070, c1: 0xff4a20, add: true, a0: 0.85 });
    }
  }
  /** Small smoke/flak puff at a point. */
  puff(x: number, y: number, color = 0xd8d8e0, r = 10): void {
    this.puffs.push({ x: this.px(x), y: this.py(y) - 6, vx: 0, vy: -12, t0: this.now, life: 420, r0: r * 0.4, r1: r, c0: color, c1: color, add: false, a0: 0.7 });
  }
  glowPuffP(px: number, py: number, color: number, r = 8, life = 300): void {
    this.puffs.push({ x: px, y: py, vx: 0, vy: -6, t0: this.now, life, r0: r * 0.5, r1: r, c0: color, c1: color, add: true, a0: 0.5 });
  }
  /** Tiny drifting additive mote (site doorways, elite auras), projected coords with its own velocity. */
  moteP(px: number, py: number, color: number, r = 1.8, life = 1400, vx = 0, vy = -8): void {
    if (this.puffs.length > 400) return;
    this.puffs.push({ x: px, y: py, vx, vy, t0: this.now, life, r0: r * 0.6, r1: r, c0: color, c1: 0xffffff, add: true, a0: 0.75 });
  }

  /** Elite death: bigger violet/gold burst, a double ring and a glint of Void Marks rising. */
  eliteDeath(x: number, y: number, color: number): void {
    const px = this.px(x), py = this.py(y);
    this.burst(x, y, color, 26);
    this.emberE.setParticleTint(0xb98fe8);
    this.emberE.explode(this.n(22), px, py - 6);
    this.sparkE.setParticleTint(0xffd070);
    this.sparkE.explode(this.n(14), px, py - 4);
    this.addShape({ kind: 'flash', x: px, y: py - 6, r: 10, r2: 44, color: 0xffffff, alpha: 0.6, life: 220, glow: true });
    this.addShape({ kind: 'ring', x: px, y: py, r: 6, r2: 74, color: 0xb98fe8, alpha: 0.9, life: 620, w: 3, glow: true });
    this.addShape({ kind: 'ring', x: px, y: py, r: 4, r2: 44, color: 0xffd070, alpha: 0.8, life: 460, w: 2, glow: true });
    // marks glint: a few violet shards drifting up and a bright pinpoint
    const cnt = this.settings.quality === 'low' ? 3 : 7;
    for (let i = 0; i < cnt; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 26 + Math.random() * 40;
      this.puffs.push({ x: px + (Math.random() - 0.5) * 10, y: py - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: this.now, life: 700 + Math.random() * 400, r0: 2.5, r1: 0.6, c0: 0xe8d0ff, c1: 0xc9a0ff, add: true, a0: 0.95 });
    }
    this.addShape({ kind: 'flash', x: px, y: py - 16, r: 2, r2: 9, color: 0xe8d0ff, alpha: 0.9, life: 380, glow: true });
  }

  /** Relic taken: a short gold ring pulse around the locomotive. */
  relicPulse(x: number, y: number): void {
    const px = this.px(x), py = this.py(y) - 8;
    this.addShape({ kind: 'ring', x: px, y: py, r: 8, r2: 96, color: 0xe8c170, alpha: 0.95, life: 720, w: 3.5, glow: true });
    this.addShape({ kind: 'ring', x: px, y: py, r: 4, r2: 60, color: 0xffffff, alpha: 0.6, life: 520, w: 1.5, glow: false });
    this.addShape({ kind: 'flash', x: px, y: py, r: 14, r2: 54, color: 0xe8c170, alpha: 0.35, life: 360, glow: true });
    this.emberE.setParticleTint(0xffe0a0);
    this.emberE.explode(this.n(18), px, py);
    if (this.settings.quality !== 'low') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.puffs.push({ x: px, y: py, vx: Math.cos(a) * 46, vy: Math.sin(a) * 46 * ISO_Y, t0: this.now, life: 600, r0: 3, r1: 6, c0: 0xffffff, c1: 0xe8c170, add: true, a0: 0.75 });
      }
    }
  }

  /** Bounty completed: confetti-like sparkle burst above the locomotive. */
  bountyBurst(x: number, y: number): void {
    const px = this.px(x), py = this.py(y) - 30;
    this.confettiE.explode(this.n(30), px, py);
    this.sparkE.setParticleTint(0xffe090);
    this.sparkE.explode(this.n(16), px, py);
    this.emberE.setParticleTint(0xfff6d0);
    this.emberE.explode(this.n(14), px, py);
    this.addShape({ kind: 'ring', x: px, y: py, r: 4, r2: 40, color: 0xffe8a0, alpha: 0.8, life: 480, w: 2, glow: true });
    this.addShape({ kind: 'flash', x: px, y: py, r: 6, r2: 26, color: 0xffffff, alpha: 0.6, life: 200, glow: true });
  }

  /** Settlement arrival: confetti, a rising ring of embers and sparkles (richer at high quality). */
  celebrate(x: number, y: number): void {
    const px = this.px(x), py = this.py(y);
    this.confetti(x, y, 26);
    this.addShape({ kind: 'ring', x: px, y: py, r: 6, r2: 46, color: 0xffe8a0, alpha: 0.8, life: 600, w: 2, glow: true });
    if (this.settings.quality !== 'low') {
      this.emberE.setParticleTint(0xfff2c8);
      this.emberE.explode(this.n(24), px, py - 12);
      this.sparkE.setParticleTint(0xe8c170);
      this.sparkE.explode(this.n(18), px, py - 10);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.puffs.push({ x: px, y: py - 8, vx: Math.cos(a) * 40, vy: Math.sin(a) * 25 - 30, t0: this.now, life: 700, r0: 3, r1: 9, c0: 0xffffff, c1: 0xe8c170, add: true, a0: 0.7 });
      }
    }
  }
  /** Boss death: layered shockwaves, embers and debris. */
  bossDeath(x: number, y: number, color: number): void {
    const px = this.px(x), py = this.py(y);
    this.explosion(x, y, 120, true);
    this.shockwave(x, y, 240);
    this.burst(x, y, color, 60);
    if (this.settings.quality !== 'low') {
      this.addShape({ kind: 'ring', x: px, y: py, r: 10, r2: 320, color, alpha: 0.7, life: 1100, w: 5, glow: true });
      this.addShape({ kind: 'flash', x: px, y: py, r: 30, r2: 140, color: 0xffffff, alpha: 0.7, life: 420, glow: true });
      this.emberE.setParticleTint(color);
      this.emberE.explode(this.n(70), px, py);
      this.debris(x, y, 30, color);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
        this.puffs.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * ISO_Y - 30, t0: this.now, life: 600 + Math.random() * 500, r0: 6, r1: 30, c0: 0xffffff, c1: color, add: true, a0: 0.8 });
      }
    }
  }

  floatText(x: number, y: number, text: string, color = 0xffffff, size = 11, rise = 34): void {
    if (this.floaters.length >= 40) {
      const f = this.floaters.shift()!;
      f.text.setVisible(false);
      this.textPool.push(f.text);
    }
    let t = this.textPool.pop();
    if (!t) {
      t = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2 });
      t.setOrigin(0.5, 1);
      this.layer.add(t);
    }
    t.setText(text).setColor(cssColor(color)).setFontSize(size).setVisible(true).setAlpha(1);
    const px = this.px(x) + (Math.random() - 0.5) * 8, py = this.py(y) - 18;
    t.setPosition(px, py);
    this.floaters.push({ text: t, t0: this.now, life: 1100, x: px, y: py, rise });
  }

  private addShape(s: Partial<Shape> & Pick<Shape, 'kind' | 'color' | 'alpha' | 'life' | 'glow'>): void {
    if (this.shapes.length > 160) this.shapes.shift();
    this.shapes.push({
      x: 0, y: 0, x2: 0, y2: 0, r: 0, r2: 0, w: 2, pts: [], jitter: 0, t0: this.now,
      ...s,
    });
  }

  // ---------------- per-frame ----------------
  update(dt: number, nowMs: number): void {
    this.now = nowMs;
    const lg = this.lineGfx, gg = this.glowGfx;
    lg.clear(); gg.clear();
    const rm = this.settings.reducedMotion;

    // shapes
    let w = 0;
    for (let i = 0; i < this.shapes.length; i++) {
      const s = this.shapes[i];
      const t = (nowMs - s.t0) / s.life;
      if (t >= 1) continue;
      this.shapes[w++] = s;
      const fade = 1 - t;
      const g = s.glow ? gg : lg;
      switch (s.kind) {
        case 'line':
          g.lineStyle(s.w * 2.5, s.color, s.alpha * fade * 0.35);
          g.lineBetween(s.x, s.y, s.x2, s.y2);
          g.lineStyle(s.w, 0xffffff, s.alpha * fade);
          g.lineBetween(s.x, s.y, s.x2, s.y2);
          break;
        case 'ring': {
          const r = s.r + (s.r2 - s.r) * (1 - (1 - t) * (1 - t));
          g.lineStyle(Math.max(0.5, s.w * fade), s.color, s.alpha * fade);
          g.strokeEllipse(s.x, s.y, r * 2, r * 2 * ISO_Y);
          break;
        }
        case 'flash': {
          const r = s.r + (s.r2 - s.r) * t;
          g.fillStyle(s.color, s.alpha * fade);
          disc(g, s.x, s.y, r, r, 12);
          break;
        }
        case 'chain':
        case 'bolt': {
          const pts = s.pts;
          const jit = rm ? 0 : s.jitter;
          const poly: Phaser.Geom.Point[] = [];
          for (let k = 0; k < pts.length; k += 2) {
            const first = k === 0, last = k >= pts.length - 2;
            const jx = first || last ? 0 : (Math.random() - 0.5) * jit * 2;
            const jy = first || last ? 0 : (Math.random() - 0.5) * jit * 2;
            poly.push(new Phaser.Geom.Point(pts[k] + jx, pts[k + 1] + jy));
          }
          if (s.kind === 'chain') {
            // add midpoints with jitter for a jagged look
            const jag: Phaser.Geom.Point[] = [];
            for (let k = 0; k < poly.length; k++) {
              jag.push(poly[k]);
              if (k + 1 < poly.length) {
                const a = poly[k], b = poly[k + 1];
                const mx = (a.x + b.x) / 2 + (rm ? 0 : (Math.random() - 0.5) * 12);
                const my = (a.y + b.y) / 2 + (rm ? 0 : (Math.random() - 0.5) * 12);
                jag.push(new Phaser.Geom.Point(mx, my));
              }
            }
            gg.lineStyle(s.w * 4, s.color, s.alpha * fade * 0.35);
            gg.strokePoints(jag, false, false);
            gg.lineStyle(s.w, 0xffffff, s.alpha * fade);
            gg.strokePoints(jag, false, false);
          } else {
            gg.lineStyle(s.w * 4, 0x8fd3ff, s.alpha * fade * 0.4);
            gg.strokePoints(poly, false, false);
            gg.lineStyle(s.w, s.color, s.alpha * fade);
            gg.strokePoints(poly, false, false);
          }
          break;
        }
        case 'cone':
          break;
      }
    }
    this.shapes.length = w;

    // puffs
    w = 0;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const t = (nowMs - p.t0) / p.life;
      if (t >= 1) continue;
      this.puffs[w++] = p;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      const r = p.r0 + (p.r1 - p.r0) * t;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(p.c0), Phaser.Display.Color.IntegerToColor(p.c1), 100, Math.round(t * 100));
      const color = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
      const g = p.add ? gg : lg;
      g.fillStyle(color, p.a0 * (1 - t));
      disc(g, p.x, p.y, r, r, 8);
    }
    this.puffs.length = w;

    // floating texts
    w = 0;
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      const t = (nowMs - f.t0) / f.life;
      if (t >= 1) { f.text.setVisible(false); this.textPool.push(f.text); continue; }
      this.floaters[w++] = f;
      const e = 1 - (1 - t) * (1 - t);
      f.text.setPosition(f.x, f.y - f.rise * e);
      f.text.setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
    this.floaters.length = w;
  }
}
