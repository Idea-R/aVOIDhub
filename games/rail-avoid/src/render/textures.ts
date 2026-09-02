/**
 * Procedural texture generation. Everything is drawn with Phaser Graphics and baked with
 * generateTexture at boot. Textures are supersampled by TEX_SS and sprites use TEX_SCALE.
 */
import Phaser from 'phaser';
import { SETTLEMENT_COLORS } from './palette';
import { ENEMY_DEFS } from '../core/enemies';
import { lighten, shade } from './util';

export const TEX_SS = 2;
export const TEX_SCALE = 1 / TEX_SS;

type G = Phaser.GameObjects.Graphics;

/** Tiny drawing DSL that applies the supersample factor. */
class D {
  constructor(public g: G, public s: number) {}
  fill(color: number, alpha = 1): this { this.g.fillStyle(color, alpha); return this; }
  line(w: number, color: number, alpha = 1): this { this.g.lineStyle(w * this.s, color, alpha); return this; }
  circle(x: number, y: number, r: number): this { this.g.fillCircle(x * this.s, y * this.s, r * this.s); return this; }
  scircle(x: number, y: number, r: number): this { this.g.strokeCircle(x * this.s, y * this.s, r * this.s); return this; }
  ellipse(x: number, y: number, w: number, h: number): this { this.g.fillEllipse(x * this.s, y * this.s, w * this.s, h * this.s); return this; }
  sellipse(x: number, y: number, w: number, h: number): this { this.g.strokeEllipse(x * this.s, y * this.s, w * this.s, h * this.s); return this; }
  rect(x: number, y: number, w: number, h: number): this { this.g.fillRect(x * this.s, y * this.s, w * this.s, h * this.s); return this; }
  srect(x: number, y: number, w: number, h: number): this { this.g.strokeRect(x * this.s, y * this.s, w * this.s, h * this.s); return this; }
  rrect(x: number, y: number, w: number, h: number, r: number): this { this.g.fillRoundedRect(x * this.s, y * this.s, w * this.s, h * this.s, r * this.s); return this; }
  poly(pts: number[]): this {
    const p: Phaser.Geom.Point[] = [];
    for (let i = 0; i < pts.length; i += 2) p.push(new Phaser.Geom.Point(pts[i] * this.s, pts[i + 1] * this.s));
    this.g.fillPoints(p, true);
    return this;
  }
  spoly(pts: number[], close = true): this {
    const p: Phaser.Geom.Point[] = [];
    for (let i = 0; i < pts.length; i += 2) p.push(new Phaser.Geom.Point(pts[i] * this.s, pts[i + 1] * this.s));
    this.g.strokePoints(p, close, close);
    return this;
  }
  seg(x1: number, y1: number, x2: number, y2: number): this {
    this.g.lineBetween(x1 * this.s, y1 * this.s, x2 * this.s, y2 * this.s);
    return this;
  }
  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.g.fillTriangle(x1 * this.s, y1 * this.s, x2 * this.s, y2 * this.s, x3 * this.s, y3 * this.s);
    return this;
  }
  /** Soft radial blob approximated with concentric circles. */
  soft(x: number, y: number, r: number, color: number, alpha: number, steps = 10): this {
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      this.g.fillStyle(color, Math.min(1, alpha * (1 - t) * (1 - t) * 3 / steps));
      this.g.fillCircle(x * this.s, y * this.s, r * t * this.s);
    }
    return this;
  }
}

function gen(scene: Phaser.Scene, key: string, w: number, h: number, draw: (d: D) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  try {
    draw(new D(g, TEX_SS));
    g.generateTexture(key, Math.max(1, Math.ceil(w * TEX_SS)), Math.max(1, Math.ceil(h * TEX_SS)));
  } catch (e) {
    console.warn('[render] texture failed', key, e);
  }
  g.destroy();
}

export function generateAllTextures(scene: Phaser.Scene): void {
  // ---- primitives ----
  gen(scene, 'px', 2, 2, d => d.fill(0xffffff).rect(0, 0, 2, 2));
  gen(scene, 'dot', 8, 8, d => d.fill(0xffffff).circle(4, 4, 4));
  gen(scene, 'dot_soft', 12, 12, d => d.fill(0xffffff, 0.5).circle(6, 6, 6).fill(0xffffff).circle(6, 6, 4));
  gen(scene, 'soft', 32, 32, d => d.soft(16, 16, 16, 0xffffff, 1));
  gen(scene, 'glow', 64, 64, d => d.soft(32, 32, 32, 0xffffff, 1, 14));
  gen(scene, 'smoke', 24, 24, d => d.soft(12, 12, 12, 0xffffff, 0.9, 8));
  gen(scene, 'spark', 3, 7, d => d.fill(0xffffff).rrect(0, 0, 3, 7, 1));
  gen(scene, 'sq', 4, 4, d => d.fill(0xffffff).rect(0, 0, 4, 4));
  gen(scene, 'streak', 2, 14, d => d.fill(0xffffff, 0.9).rrect(0, 0, 2, 14, 1));
  gen(scene, 'flake', 5, 5, d => d.fill(0xffffff).circle(2.5, 2.5, 2).fill(0xffffff, 0.6).circle(1.5, 3.5, 1.5));
  gen(scene, 'fog', 160, 160, d => d.soft(80, 80, 80, 0xffffff, 1, 16));
  gen(scene, 'ring', 32, 32, d => d.line(3, 0xffffff).scircle(16, 16, 13));
  gen(scene, 'ring_thin', 40, 40, d => d.line(1.5, 0xffffff).scircle(20, 20, 18));
  gen(scene, 'shadow', 40, 20, d => d.fill(0x000000, 0.35).ellipse(20, 10, 40, 20).fill(0x000000, 0.35).ellipse(20, 10, 28, 14));
  gen(scene, 'arrow', 28, 28, d => d.fill(0xffffff).poly([2, 4, 26, 14, 2, 24, 8, 14]));
  gen(scene, 'figure', 8, 14, d => {
    d.fill(0xffffff).circle(4, 3, 2.6).rrect(1.5, 6, 5, 5, 1.5).rect(2, 11, 1.6, 3).rect(4.4, 11, 1.6, 3);
  });
  gen(scene, 'vignette', 256, 256, d => {
    for (let r = 88; r <= 190; r += 3) {
      const t = (r - 88) / (190 - 88);
      d.line(3.4, 0xffffff, t * t * 0.9).scircle(128, 128, r);
    }
  });
  gen(scene, 'headlight', 150, 100, d => {
    // cone made of lengthwise slices whose alpha fades toward the far end (no hard edge)
    for (let s = 0; s < 24; s++) {
      const x0 = (s / 24) * 150, x1 = ((s + 1) / 24) * 150 + 0.5;
      const t0 = s / 24, t1 = (s + 1) / 24;
      const a = 0.16 * (1 - t0) * (1 - t0);
      for (let i = 0; i < 3; i++) {
        const w0 = (6 + t0 * 44) * (1 - i * 0.28), w1 = (6 + t1 * 44) * (1 - i * 0.28);
        d.fill(0xfff2c8, a * 0.5).poly([x0, 50 - w0, x1, 50 - w1, x1, 50 + w1, x0, 50 + w0]);
      }
    }
  });
  gen(scene, 'rotor', 34, 34, d => {
    d.fill(0xffffff, 0.16).circle(17, 17, 17).fill(0xffffff, 0.35).rect(1, 16, 32, 2).rect(16, 1, 2, 32);
  });
  gen(scene, 'charge', 14, 14, d => {
    d.fill(0x2a2f3a).rrect(1, 3, 12, 9, 2).fill(0x8a8f9a).rect(3, 5, 8, 2).fill(0xff3030).circle(10, 4, 2).fill(0x60c0a0).rect(2, 9, 4, 2);
  });
  gen(scene, 'lantern', 10, 10, d => d.soft(5, 5, 5, 0xffe8a0, 1, 6));

  // ---- decor ----
  gen(scene, 'tree_pine', 16, 24, d => {
    d.fill(0x3a2a1c).rect(7, 18, 2.5, 6);
    d.fill(0x2e5a3a).tri(8, 2, 1, 14, 15, 14);
    d.fill(0x3b7248).tri(8, 7, 2, 19, 14, 19);
    d.fill(0x4c8a55, 0.8).tri(8, 2, 5, 9, 11, 9);
  });
  gen(scene, 'tree_round', 16, 20, d => {
    d.fill(0x3a2a1c).rect(7, 13, 2.5, 7);
    d.fill(0x2f6a3f).circle(8, 8, 7);
    d.fill(0x4a9a58, 0.9).circle(6, 6, 4);
  });
  gen(scene, 'tree_dead', 14, 22, d => {
    d.line(2, 0x4a4652).seg(7, 22, 7, 6).seg(7, 12, 2, 6).seg(7, 10, 12, 4).seg(7, 15, 11, 12);
  });
  gen(scene, 'bush', 12, 8, d => d.fill(0x4e8a4a).circle(4, 4, 3.5).circle(8, 4.5, 3.2).fill(0x6aa860, 0.8).circle(5, 3, 2));
  gen(scene, 'grass', 10, 7, d => d.line(1, 0x7fb56a).seg(2, 7, 3, 1).seg(5, 7, 5, 0).seg(8, 7, 7, 2));
  gen(scene, 'rock', 14, 10, d => {
    d.fill(0x5a5a62).poly([1, 9, 4, 3, 9, 1, 13, 5, 12, 9]);
    d.fill(0x8a8a94, 0.8).poly([4, 3, 9, 1, 11, 4, 6, 5]);
  });
  gen(scene, 'rock_big', 22, 16, d => {
    d.fill(0x55555e).poly([1, 15, 4, 6, 10, 1, 17, 3, 21, 9, 19, 15]);
    d.fill(0x8a8a94, 0.85).poly([4, 6, 10, 1, 17, 3, 12, 7]);
    d.fill(0x3d3d45, 0.6).poly([12, 7, 17, 3, 21, 9, 19, 15, 14, 14]);
  });
  gen(scene, 'peak', 30, 26, d => {
    d.fill(0x5c5c66).tri(15, 1, 1, 25, 29, 25);
    d.fill(0x8c8c98).tri(15, 1, 15, 25, 29, 25);
    d.fill(0xe8ecf4, 0.9).poly([15, 1, 10, 9, 13, 8, 16, 11, 20, 9]);
  });
  gen(scene, 'crystal', 14, 18, d => {
    d.fill(0x7a72d8).poly([7, 0, 12, 10, 9, 18, 4, 18, 2, 10]);
    d.fill(0xb4aeff, 0.9).poly([7, 0, 9, 9, 7, 18, 5, 9]);
    d.fill(0x4e48a8, 0.8).poly([9, 9, 12, 10, 9, 18, 7, 18]);
  });
  gen(scene, 'crystal_small', 8, 10, d => d.fill(0x8a82e8).poly([4, 0, 7, 6, 5, 10, 3, 10, 1, 6]).fill(0xc8c2ff, 0.8).poly([4, 0, 5, 5, 4, 10, 3, 5]));
  gen(scene, 'wall', 22, 12, d => {
    d.fill(0x5a524e).rect(1, 5, 8, 7).rect(11, 2, 10, 10).fill(0x7a7068).rect(1, 5, 8, 1.5).rect(11, 2, 10, 1.5);
    d.fill(0x3a3430, 0.7).rect(3, 8, 2, 2).rect(14, 5, 2, 2).rect(18, 8, 2, 2);
  });
  gen(scene, 'pillar', 8, 16, d => d.fill(0x6a625c).rect(2, 2, 4, 14).fill(0x8a8078).rect(1, 0, 6, 3));
  gen(scene, 'ripple', 20, 6, d => d.line(1, 0x9ccbe8, 0.7).seg(1, 3, 6, 1).seg(6, 1, 11, 3).seg(11, 3, 16, 1).seg(16, 1, 19, 2));
  gen(scene, 'ash_pile', 12, 6, d => d.fill(0x54515c).ellipse(6, 4, 12, 5).fill(0x7a7684, 0.6).ellipse(5, 3, 6, 2.5));

  // ---- settlements ----
  gen(scene, 'st_ring', 30, 30, d => {
    d.fill(0x0b0e1a, 0.85).circle(15, 15, 14);
    d.fill(0xf4f6fb).circle(15, 15, 12);
    d.fill(0x0b0e1a).circle(15, 15, 9);
  });
  gen(scene, 'st_core', 16, 16, d => d.fill(0xffffff).circle(8, 8, 8));
  gen(scene, 'st_check', 30, 30, d => d.line(3, 0x6fbf73).seg(9, 15, 13, 20).seg(13, 20, 22, 10));
  const glyph = (key: string, draw: (d: D) => void) => gen(scene, key, 12, 12, d => { d.fill(0xffffff); draw(d); });
  glyph('gl_start', d => d.rect(3, 1, 1.5, 10).tri(4.5, 1, 11, 4, 4.5, 7));
  glyph('gl_village', d => d.tri(6, 1, 1, 6, 11, 6).rect(2.5, 6, 7, 5).fill(0x0b0e1a).rect(5, 8, 2, 3));
  glyph('gl_depot', d => d.rect(1, 3, 10, 1.6).rect(1, 7.5, 10, 1.6).rect(2.5, 1, 1.5, 10).rect(8, 1, 1.5, 10));
  glyph('gl_mine', d => { d.line(2, 0xffffff).seg(3, 10, 9, 3); d.fill(0xffffff).poly([6, 1, 11, 2.5, 9, 5, 8, 3.5]); });
  glyph('gl_farm', d => { d.line(1.6, 0xffffff).seg(6, 11, 6, 2).seg(6, 5, 3, 3).seg(6, 5, 9, 3).seg(6, 8, 3, 6).seg(6, 8, 9, 6); });
  glyph('gl_fuel', d => d.poly([6, 1, 10, 7, 9, 10, 3, 10, 2, 7]));
  glyph('gl_clinic', d => d.rect(4.5, 1, 3, 10).rect(1, 4.5, 10, 3));
  glyph('gl_armory', d => d.poly([6, 1, 11, 3, 10, 8, 6, 11, 2, 8, 1, 3]).fill(0x0b0e1a).rect(5, 4, 2, 4));
  glyph('gl_yard', d => { d.line(2.2, 0xffffff).seg(2, 10, 8, 4); d.fill(0xffffff).circle(8.5, 3.5, 3); d.fill(0x0b0e1a).circle(9.5, 2.5, 1.5); });
  glyph('gl_terminus', d => d.rect(1, 2, 2.5, 9).rect(8.5, 2, 2.5, 9).rect(1, 1, 10, 2).fill(0xffffff, 0.7).rect(4.5, 5, 3, 6));

  // ---- projectiles ----
  gen(scene, 'p_shell', 10, 6, d => d.fill(0x2a2f3a).ellipse(5, 3, 10, 6).fill(0xffd08a).ellipse(6.5, 2.5, 4, 2.5));
  gen(scene, 'p_flak', 6, 6, d => d.fill(0xffe08a).circle(3, 3, 3).fill(0xffffff).circle(3, 3, 1.5));
  gen(scene, 'p_tracer', 16, 3, d => d.fill(0xfff2b0).rrect(0, 0, 16, 3, 1.5));
  gen(scene, 'p_bolt', 12, 5, d => d.fill(0x8fd3ff).rrect(0, 0, 12, 5, 2.5).fill(0xffffff).rrect(2, 1.5, 8, 2, 1));
  gen(scene, 'p_flame', 14, 14, d => d.soft(7, 7, 7, 0xff9a3a, 1, 6));
  gen(scene, 'p_enemy_shell', 10, 6, d => d.fill(0x3a1a1a).ellipse(5, 3, 10, 6).fill(0xff6a5a).ellipse(6.5, 2.5, 4, 2.5));

  // ---- enemies ----
  const raider = ENEMY_DEFS.raider.color, hound = ENEMY_DEFS.hound.color, crawler = ENEMY_DEFS.crawler.color;
  const harpy = ENEMY_DEFS.harpy.color, sapper = ENEMY_DEFS.sapper.color, wisp = ENEMY_DEFS.wisp.color;
  gen(scene, 'e_raider', 14, 18, d => {
    d.fill(0x1a1a22).circle(7, 4, 3.6);
    d.fill(raider).rrect(3.5, 7, 7, 7, 2);
    d.fill(shade(raider, 0.6)).rect(4, 13, 2.2, 5).rect(7.8, 13, 2.2, 5);
    d.fill(0xffd0b0).circle(7, 4, 2.4);
    d.line(1.5, 0x3a3a44).seg(10, 9, 14, 6);
  });
  gen(scene, 'e_hound', 24, 14, d => {
    d.fill(hound).ellipse(12, 7, 16, 8);
    d.fill(hound).circle(19, 5, 4);
    d.fill(shade(hound, 0.55)).rect(6, 10, 2, 4).rect(10, 10, 2, 4).rect(15, 10, 2, 4);
    d.fill(shade(hound, 0.55)).poly([4, 6, 0, 2, 3, 8]);
    d.fill(0xffffff).circle(20.5, 4.5, 1.2);
    d.fill(shade(hound, 0.4)).tri(17, 2, 18, -1, 19.5, 2);
  });
  gen(scene, 'e_crawler', 36, 24, d => {
    d.fill(shade(crawler, 0.55)).rect(4, 16, 4, 6).rect(11, 17, 4, 6).rect(20, 17, 4, 6).rect(28, 16, 4, 6);
    d.fill(crawler).ellipse(18, 12, 34, 18);
    d.fill(lighten(crawler, 0.15)).ellipse(18, 9, 26, 10);
    d.fill(shade(crawler, 0.7)).rect(8, 5, 2, 13).rect(17, 4, 2, 15).rect(26, 5, 2, 13);
    d.fill(0x2a1a10).circle(33, 12, 3);
    d.fill(0xff5040).circle(33.5, 11.5, 1.2);
  });
  gen(scene, 'e_harpy', 30, 18, d => {
    d.fill(shade(harpy, 0.6)).poly([0, 6, 12, 8, 12, 11, 2, 10]).poly([30, 6, 18, 8, 18, 11, 28, 10]);
    d.fill(harpy).ellipse(15, 10, 14, 9);
    d.fill(0x2a2a30).rect(12, 13, 6, 4);
    d.fill(0xffffff).circle(17, 9, 1.6).fill(0x2a2a30).circle(17.5, 9, 0.8);
    d.line(1.2, 0x3a3a44).seg(15, 4, 15, 1);
  });
  gen(scene, 'e_sapper', 16, 18, d => {
    d.fill(0x3a3a2a).rrect(0, 5, 6, 9, 1.5);
    d.fill(sapper).rrect(5, 7, 7, 7, 2);
    d.fill(0x1a1a22).circle(8.5, 4, 3.4);
    d.fill(0xe8d0b0).circle(8.5, 4, 2.2);
    d.fill(shade(sapper, 0.6)).rect(5.5, 13, 2.2, 5).rect(9.3, 13, 2.2, 5);
    d.fill(0xff3030).circle(2.5, 6.5, 1);
  });
  gen(scene, 'e_wisp', 28, 28, d => {
    d.soft(14, 14, 14, wisp, 1, 8);
    d.fill(0xffffff, 0.9).circle(14, 13, 3.5);
  });
  gen(scene, 'e_wagon', 62, 30, d => {
    d.fill(0x22252c).rect(2, 22, 58, 5);
    d.fill(0x111319).circle(10, 26, 4).circle(26, 26, 4).circle(38, 26, 4).circle(52, 26, 4);
    d.fill(0x5a5f6a).rrect(1, 3, 60, 21, 3);
    d.fill(0x7a7f8a).rect(4, 6, 54, 6);
    d.fill(0x3a3f4a).rect(8, 14, 10, 6).rect(26, 14, 10, 6).rect(44, 14, 10, 6);
    d.fill(0x9a9fa8).circle(5, 8, 1.2).circle(57, 8, 1.2).circle(5, 20, 1.2).circle(57, 20, 1.2);
  });
  gen(scene, 'e_wagon_head', 66, 32, d => {
    d.fill(0x22252c).rect(2, 24, 60, 5);
    d.fill(0x111319).circle(12, 28, 4).circle(28, 28, 4).circle(48, 28, 4);
    d.fill(0x6a3f3f).poly([54, 26, 66, 20, 66, 26]);
    d.fill(0x5a5f6a).rrect(1, 4, 60, 22, 3);
    d.fill(0x7a7f8a).rect(4, 7, 50, 6);
    d.fill(0x3a3f4a).rrect(20, 1, 20, 10, 2);
    d.fill(0x2a2f3a).rect(38, 4, 26, 4);
    d.fill(0xff8040).circle(58, 15, 2.5);
    d.fill(0x2a2f3a).circle(12, 6, 4);
  });
  gen(scene, 'e_brood', 96, 64, d => {
    const c = ENEMY_DEFS.boss_brood.color;
    d.fill(shade(c, 0.5)).rect(10, 46, 8, 16).rect(28, 50, 8, 14).rect(56, 50, 8, 14).rect(76, 46, 8, 16);
    d.fill(c).ellipse(48, 34, 92, 48);
    d.fill(lighten(c, 0.2)).ellipse(48, 26, 70, 26);
    d.fill(0x2a1a10).circle(88, 32, 8);
    d.fill(0xff5040).circle(90, 31, 3).circle(85, 29, 2);
    d.fill(shade(c, 0.4)).tri(84, 40, 96, 48, 82, 46).tri(84, 24, 96, 16, 82, 18);
    d.fill(0x8fe0a0, 0.9).circle(48, 34, 7);
  });
  gen(scene, 'e_brood_plate', 32, 24, d => {
    const c = shade(ENEMY_DEFS.boss_brood.color, 0.7);
    d.fill(c).poly([2, 12, 8, 2, 24, 2, 30, 12, 24, 22, 8, 22]);
    d.fill(lighten(c, 0.25)).poly([8, 2, 24, 2, 20, 8, 12, 8]);
    d.fill(0x3a2010, 0.5).circle(16, 13, 3);
  });
  gen(scene, 'e_maw_core', 120, 120, d => {
    d.soft(60, 60, 60, 0x0a0614, 1, 12);
    d.fill(0x0a0614).circle(60, 60, 36);
    d.fill(0x6d5fd6, 0.5).circle(60, 60, 30);
    d.fill(0x0a0614).circle(60, 60, 22);
    d.fill(0xd8c8ff, 0.9).circle(60, 60, 5);
  });
  gen(scene, 'e_maw_ring', 150, 150, d => {
    d.line(3, 0x6d5fd6, 0.8).scircle(75, 75, 70);
    d.line(1.2, 0xa79cff, 0.6).scircle(75, 75, 63);
    d.fill(0xa79cff).circle(75, 5, 3).circle(145, 75, 3).circle(75, 145, 3).circle(5, 75, 3);
  });
  gen(scene, 'e_maw_wisp', 40, 40, d => d.soft(20, 20, 20, 0x9a6fff, 1, 8));

  generateBuildingTextures(scene);
  generateMiscTextures(scene);
  void SETTLEMENT_COLORS;
}

/** Tiny isometric buildings for settlement clusters (origin bottom-centre when placed). */
function generateBuildingTextures(scene: Phaser.Scene): void {
  const WALL = 0xd6cbb4, WALL_D = 0xa89c86, ROOF = 0x8a4a3a, ROOF_D = 0x6a3a2c, WIN = 0x3a3d48, METAL = 0x7a808c, METAL_D = 0x5a606c;
  // generic box: front face (x,y,w,h), side face to the right (depth d), roof colour on top slab
  const box = (d: D, x: number, y: number, w: number, h: number, dp: number, wall = WALL, wallD = WALL_D, roof = 0x9a9aa4) => {
    d.fill(wall).rect(x, y, w, h);
    d.fill(wallD).poly([x + w, y, x + w + dp, y - dp * 0.6, x + w + dp, y + h - dp * 0.6, x + w, y + h]);
    d.fill(roof).poly([x, y, x + dp, y - dp * 0.6, x + w + dp, y - dp * 0.6, x + w, y]);
  };
  const pitched = (d: D, x: number, y: number, w: number, h: number, dp: number, wall = WALL, wallD = WALL_D, roof = ROOF, roofD = ROOF_D) => {
    d.fill(wall).rect(x, y, w, h);
    d.fill(wallD).poly([x + w, y, x + w + dp, y - dp * 0.6, x + w + dp, y + h - dp * 0.6, x + w, y + h]);
    // gable on the front, sloping roof to the back-right
    const peakY = y - w * 0.45;
    d.fill(roofD).poly([x - 1, y, x + w / 2, peakY, x + w + 1, y]);
    d.fill(roof).poly([x + w / 2, peakY, x + w / 2 + dp, peakY - dp * 0.6, x + w + dp + 1, y - dp * 0.6, x + w + 1, y]);
  };
  gen(scene, 'b_house', 20, 20, d => { pitched(d, 2, 10, 10, 9, 5); d.fill(WIN).rect(4, 13, 2.5, 2.5).rect(8, 13, 2.5, 2.5); d.fill(0x4a4a52).rect(9, 3, 2, 5); });
  gen(scene, 'b_house2', 18, 18, d => { pitched(d, 2, 10, 8, 7, 5, 0xc8b9a0, 0x9a8c74, 0x5a6a8a, 0x3f4a66); d.fill(WIN).rect(4, 12, 2.2, 2.2); d.fill(0x6a4a3a).rect(8, 13, 2, 4); });
  gen(scene, 'b_chapel', 20, 30, d => { pitched(d, 2, 20, 10, 9, 5, 0xe0d8c8, 0xb0a892, 0x5a5a6a, 0x3f3f4c); d.fill(0xe0d8c8).rect(5, 6, 4, 14); d.fill(0x5a5a6a).tri(4, 6, 7, 0, 10, 6); d.line(1.2, 0xffffff).seg(7, 0, 7, -0).seg(5.5, 2, 8.5, 2); d.fill(WIN).rect(6, 12, 2, 3); });
  gen(scene, 'b_warehouse', 30, 18, d => { box(d, 2, 8, 20, 9, 7, 0x8a8478, 0x5f5a50, 0x6a7080); d.fill(0x5a6070).rect(3, 8, 18, 1.5); d.fill(0x3a3d48).rect(7, 11, 5, 6).rect(15, 12, 3, 3); d.fill(0x4a4a52).rect(24, 1, 2, 6); });
  gen(scene, 'b_railstack', 20, 8, d => { for (let i = 0; i < 3; i++) d.line(1.4, i % 2 ? 0x9a9fa8 : 0x7a808c).seg(1, 7 - i * 2.2, 19, 6 - i * 2.2); d.fill(0x5a4a3a).rect(4, 5, 2, 3).rect(14, 4, 2, 3); });
  gen(scene, 'b_headframe', 20, 30, d => { d.line(2, 0x5a4a3a).seg(4, 30, 10, 6).seg(16, 30, 10, 6).seg(6, 22, 14, 22).seg(7, 15, 13, 15); d.fill(0x3a3d48).circle(10, 5, 4); d.fill(0x9a9fa8).circle(10, 5, 2.2); d.fill(0x1a1c22).circle(10, 5, 0.8); box(d, 12, 24, 7, 5, 3, 0x8a8478, 0x5f5a50, 0x6a6a74); });
  gen(scene, 'b_spoil', 22, 10, d => { d.fill(0x5a5048).ellipse(11, 7, 22, 7); d.fill(0x7a6e62).poly([2, 8, 8, 2, 14, 3, 20, 8]); d.fill(0x9a8e80, 0.7).poly([8, 2, 11, 3, 10, 6]); });
  gen(scene, 'b_field', 26, 14, d => { d.fill(0x6a5a3a).ellipse(13, 7, 26, 13); for (let i = 0; i < 5; i++) d.line(1.4, i % 2 ? 0x8fb35a : 0x5a7a3a).seg(3 + i * 1.5, 3 + i * 2, 23 - i * 0.5, 1 + i * 2); d.fill(0xd9d15a, 0.7).circle(6, 9, 1).circle(12, 5, 1).circle(19, 8, 1); });
  gen(scene, 'b_silo', 12, 24, d => { d.fill(0xb8b4ac).rect(2, 6, 8, 18); d.fill(0x8a8680).rect(7, 6, 3, 18); d.fill(0x8a4a3a).ellipse(6, 6, 9, 5); d.fill(0xa85a48).ellipse(6, 5, 6, 3); d.line(1, 0x6a665e, 0.6).seg(2, 12, 10, 12).seg(2, 18, 10, 18); });
  gen(scene, 'b_tank', 22, 18, d => { d.fill(0x4a4a52).rect(4, 14, 14, 3); d.fill(0x6a6a74).ellipse(11, 9, 20, 14); d.fill(0x8a8a94).ellipse(11, 6, 16, 6); d.fill(0x3a3d48).rect(10, 2, 2, 4); d.line(1, 0x3a3d48, 0.5).seg(2, 10, 20, 10); d.fill(0xe86f6f).rect(6, 8, 3, 1.5); });
  gen(scene, 'b_pump', 12, 18, d => { d.line(2, 0x5a606c).seg(6, 18, 6, 4); d.fill(0x8a8a94).rrect(2, 2, 8, 5, 1.5); d.fill(0x3a3d48).rect(4, 8, 4, 2); d.line(1.5, 0x3a3d48).seg(9, 4, 12, 9); });
  gen(scene, 'b_clinic', 22, 18, d => { box(d, 2, 8, 14, 9, 5, 0xf2f2f2, 0xc4c4c8, 0xd8d8dc); d.fill(0xd94f4f).rect(7, 10, 4, 1.4).rect(8.3, 8.7, 1.4, 4); d.fill(WIN).rect(3, 13, 2, 2).rect(13, 13, 2, 2); });
  gen(scene, 'b_bunker', 24, 14, d => { d.fill(0x4a4f5a).poly([1, 13, 4, 6, 20, 6, 23, 13]); d.fill(0x6a6f7a).poly([4, 6, 7, 2, 17, 2, 20, 6]); d.fill(0x1a1c22).rect(8, 8, 8, 1.6); d.fill(0x7a7060).circle(3, 12, 1.5).circle(21, 12, 1.5); });
  gen(scene, 'b_sandbags', 18, 7, d => { for (let i = 0; i < 5; i++) d.fill(i % 2 ? 0x9a8a68 : 0x8a7a5a).ellipse(3 + i * 3.2, 5, 4, 3); for (let i = 0; i < 4; i++) d.fill(0xa89a78).ellipse(4.6 + i * 3.2, 2.5, 4, 3); });
  gen(scene, 'b_crane', 26, 30, d => { d.line(2.2, 0x8a6a3a).seg(6, 30, 6, 6); d.line(2, 0x8a6a3a).seg(2, 8, 22, 4); d.line(1, 0x5a4a3a).seg(6, 12, 18, 5); d.line(1, 0x3a3d48).seg(20, 4, 20, 14); d.fill(0x3a3d48).rect(18.5, 14, 3, 2.5); d.fill(0x5a606c).rect(3, 26, 6, 4); });
  gen(scene, 'b_shed', 28, 18, d => { box(d, 2, 7, 18, 10, 7, 0x8a6a4a, 0x5f4a34, 0x5a5a6a); d.fill(0x2a2a30).rrect(5, 10, 8, 7, 3); d.fill(0x3a3d48).rect(15, 11, 3, 3); d.fill(0x4a4a52).rect(22, 1, 2, 5); });
  gen(scene, 'b_depot', 34, 26, d => { box(d, 2, 12, 22, 12, 8, 0x9a8f78, 0x6a6050, 0x6a7080); d.fill(0x5a6070).rect(3, 12, 20, 1.5); d.fill(0x2a2a30).rrect(6, 17, 7, 7, 2); d.fill(WIN).rect(16, 16, 3, 3); box(d, 20, 6, 8, 6, 4, 0xa89c86, 0x7a7060, 0x8a4a3a); d.fill(0xe8c170).circle(24, 9, 1.2); });
  gen(scene, 'b_gate', 40, 44, d => {
    d.fill(0x3a3350).rect(3, 20, 8, 24).rect(29, 20, 8, 24);
    d.fill(0x5a5080).rect(3, 20, 8, 3).rect(29, 20, 8, 3);
    d.fill(0x2a2540).poly([0, 20, 20, 2, 40, 20, 34, 20, 20, 8, 6, 20]);
    d.fill(0x8a7ad0, 0.9).poly([20, 4, 18, 8, 22, 8]);
    d.line(1, 0x8a7ad0, 0.6).seg(6, 24, 6, 42).seg(34, 24, 34, 42);
    d.fill(0x9a8fe0).circle(20, 12, 2);
  });
  gen(scene, 'b_shadow', 30, 12, d => d.fill(0x000000, 0.4).ellipse(15, 6, 30, 11).fill(0x000000, 0.3).ellipse(15, 6, 20, 7));
}

function generateMiscTextures(scene: Phaser.Scene): void {
  // film grain: sparse light/dark speckles on transparent
  gen(scene, 'noise', 128, 128, d => {
    let seed = 1337;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 128, y = rnd() * 128, l = rnd();
      d.fill(l > 0.5 ? 0xffffff : 0x000000, 0.35 + rnd() * 0.5).rect(x, y, 1, 1);
    }
  });
  gen(scene, 'signal_post', 8, 16, d => { d.fill(0x3a3d48).rect(3, 4, 2, 12); d.fill(0x22252c).rrect(1, 0, 6, 6, 1.5); });
  gen(scene, 'rift_ring', 120, 120, d => {
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = a0 + 0.55;
      d.g.lineStyle(3 * d.s, 0xa79cff, 0.85);
      d.g.beginPath(); d.g.arc(60 * d.s, 60 * d.s, 56 * d.s, a0, a1, false); d.g.strokePath();
      d.g.lineStyle(1.5 * d.s, 0xffffff, 0.5);
      d.g.beginPath(); d.g.arc(60 * d.s, 60 * d.s, 46 * d.s, a1, a1 + 0.35, false); d.g.strokePath();
    }
  });
  gen(scene, 'eye', 18, 11, d => { d.fill(0xf4f0ff).ellipse(9, 5.5, 18, 11); d.fill(0xd8ccff, 0.6).ellipse(9, 5.5, 12, 7); });
  gen(scene, 'pupil', 7, 7, d => { d.fill(0x0a0614).circle(3.5, 3.5, 3.5); d.fill(0xff4060).circle(3.5, 3.5, 1.6); });
  gen(scene, 'wisp_trail', 10, 10, d => d.soft(5, 5, 5, 0xb49cff, 1, 5));
}
