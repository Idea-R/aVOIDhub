/**
 * Screen-space overlays: day/night tint, red void vignette, ui:flash, edge indicators
 * (wave warning direction, boss direction). All objects live in GameScene.screenRoot (a Container
 * counter-transformed each frame so coordinates are screen px).
 */
import Phaser from 'phaser';
import type { SimState, EnemyType } from '../core/types';
import { ENEMY_DEFS } from '../core/enemies';
import { FONT } from './palette';
import { TEX_SCALE, } from './textures';
import { lerp, mixColor, clamp } from './util';

interface Key { t: number; color: number; alpha: number; }
const DAY_KEYS: Key[] = [
  { t: 0.00, color: 0x2a3a6a, alpha: 0.20 },
  { t: 0.08, color: 0xffd9a0, alpha: 0.07 },
  { t: 0.20, color: 0xffffff, alpha: 0.00 },
  { t: 0.42, color: 0xffffff, alpha: 0.00 },
  { t: 0.50, color: 0xff8a3a, alpha: 0.22 },
  { t: 0.58, color: 0x1a2050, alpha: 0.34 },
  { t: 0.75, color: 0x0a1040, alpha: 0.42 },
  { t: 0.90, color: 0x141a50, alpha: 0.38 },
  { t: 1.00, color: 0x2a3a6a, alpha: 0.20 },
];

export function dayTint(dayTime: number): { color: number; alpha: number; night: number } {
  const t = ((Number.isFinite(dayTime) ? dayTime : 0.25) % 1 + 1) % 1;
  let a = DAY_KEYS[0], b = DAY_KEYS[DAY_KEYS.length - 1];
  for (let i = 0; i + 1 < DAY_KEYS.length; i++) {
    if (t >= DAY_KEYS[i].t && t <= DAY_KEYS[i + 1].t) { a = DAY_KEYS[i]; b = DAY_KEYS[i + 1]; break; }
  }
  const span = Math.max(1e-6, b.t - a.t);
  const k = clamp((t - a.t) / span, 0, 1);
  const color = mixColor(a.color, b.color, k);
  const alpha = lerp(a.alpha, b.alpha, k);
  // night factor for headlights / windows: 0 by day, 1 at midnight
  const night = clamp((alpha - 0.18) / 0.24, 0, 1);
  return { color, alpha, night };
}

interface Indicator { arrow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; }

export class OverlayLayer {
  private tint: Phaser.GameObjects.Graphics;
  private grain: Phaser.GameObjects.TileSprite;
  private grainOn = false;
  private vignette: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Rectangle;
  private flashAlpha = 0;
  /** Full-screen darkening (expedition scenes); 0 = off. */
  private dim: Phaser.GameObjects.Rectangle;
  private dimAlpha = 0;
  private warning: Indicator;
  private boss: Indicator;
  private w = 1280;
  private h = 720;
  public night = 0;

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Container) {
    this.w = scene.scale.width; this.h = scene.scale.height;
    this.tint = scene.add.graphics();
    layer.add(this.tint);
    this.dim = scene.add.rectangle(0, 0, this.w, this.h, 0x05060e, 1).setOrigin(0, 0).setAlpha(0).setVisible(false);
    layer.add(this.dim);
    this.grain = scene.add.tileSprite(0, 0, this.w, this.h, 'noise').setOrigin(0, 0).setAlpha(0.05).setVisible(false);
    layer.add(this.grain);
    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0, 0).setTint(0xff3030).setAlpha(0);
    this.flash = scene.add.rectangle(0, 0, this.w, this.h, 0xffffff, 1).setOrigin(0, 0).setAlpha(0);
    layer.add(this.vignette); layer.add(this.flash);
    this.warning = this.mkIndicator();
    this.boss = this.mkIndicator();
    this.resize(this.w, this.h);
  }

  private mkIndicator(): Indicator {
    const arrow = this.scene.add.image(0, 0, 'arrow').setScale(TEX_SCALE * 1.3).setVisible(false);
    const label = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 0.5).setVisible(false);
    this.layer.add(arrow); this.layer.add(label);
    return { arrow, label };
  }

  setGrain(on: boolean): void { this.grainOn = on; this.grain.setVisible(on); }

  /** Darken the whole world view by `alpha` (0..1); used while an expedition scene sits on top. */
  setDim(alpha: number): void {
    const a = clamp(Number.isFinite(alpha) ? alpha : 0, 0, 1);
    if (a === this.dimAlpha || (a > 0 && Math.abs(a - this.dimAlpha) < 0.002)) return;
    this.dimAlpha = a;
    this.dim.setAlpha(a).setVisible(a > 0.003);
  }

  destroy(): void {
    this.tint.destroy(); this.vignette.destroy(); this.flash.destroy(); this.grain.destroy(); this.dim.destroy();
    this.warning.arrow.destroy(); this.warning.label.destroy(); this.boss.arrow.destroy(); this.boss.label.destroy();
  }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    this.flash.setSize(w, h).setDisplaySize(w, h);
    this.dim.setSize(w, h).setDisplaySize(w, h);
    this.grain.setSize(w, h);
    this.vignette.setDisplaySize(w, h);
  }

  screenFlash(color: number, alpha: number): void {
    this.flash.setFillStyle(color, 1);
    this.flashAlpha = Math.max(this.flashAlpha, clamp(alpha, 0, 1));
  }

  update(state: SimState, dt: number, nowMs: number, voidDistPx: number, bossScreen: { x: number; y: number } | null, reducedMotion: boolean): void {
    // day/night
    const dt2 = dayTint(state.dayTime);
    this.night = dt2.night;
    // horizontal gradient: dusk = west warm / east cool, dawn = west cool / east warm
    const td = ((Number.isFinite(state.dayTime) ? state.dayTime : 0.25) % 1 + 1) % 1;
    const dusk = clamp(1 - Math.abs(td - 0.52) / 0.12, 0, 1);
    const dawn = clamp(1 - Math.abs((td < 0.5 ? td : td - 1) - 0.02) / 0.1, 0, 1);
    const warm = 0xff9a4a, cool = 0x2a3a8a;
    let west = dt2.color, east = dt2.color;
    if (dusk > 0) { west = mixColor(west, warm, 0.4 * dusk); east = mixColor(east, cool, 0.4 * dusk); }
    if (dawn > 0) { west = mixColor(west, cool, 0.45 * dawn); east = mixColor(east, warm, 0.55 * dawn); }
    const a = state.phase === 'title' ? 0.25 : dt2.alpha + 0.06 * Math.max(dusk, dawn);
    this.tint.clear();
    if (a > 0.003) {
      this.tint.fillGradientStyle(west, east, west, east, a, a, a, a);
      this.tint.fillRect(0, 0, this.w, this.h);
    }
    if (this.grainOn) this.grain.setTilePosition(reducedMotion ? 0 : Math.floor(Math.random() * 128), reducedMotion ? 0 : Math.floor(Math.random() * 128));
    // vignette by void distance
    const v = Number.isFinite(voidDistPx) ? clamp((200 - voidDistPx) / 200, 0, 1) : 0;
    const pulse = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(nowMs / 250);
    this.vignette.setAlpha(v * 0.6 * pulse).setVisible(v > 0.01 && state.phase !== 'title');
    // flash
    if (this.flashAlpha > 0.002) {
      this.flash.setAlpha(this.flashAlpha).setVisible(true);
      this.flashAlpha *= Math.exp(-dt * 8);
    } else this.flash.setVisible(false);

    // wave warning arrow
    const warn = state.director?.warning;
    if (warn && state.phase === 'running') {
      const def = ENEMY_DEFS[warn.type as EnemyType];
      const color = def?.color ?? 0xffffff;
      const inset = 30;
      let x = this.w / 2, y = this.h / 2, rot = 0;
      switch (warn.from) {
        case 'west': x = inset; y = this.h / 2; rot = Math.PI; break;
        case 'east': x = this.w - inset; y = this.h / 2; rot = 0; break;
        case 'north': x = this.w / 2; y = inset + 40; rot = -Math.PI / 2; break;
        case 'south': x = this.w / 2; y = this.h - inset; rot = Math.PI / 2; break;
      }
      const p = reducedMotion ? 0.9 : 0.6 + 0.4 * Math.sin(nowMs / 160);
      this.warning.arrow.setPosition(x, y).setRotation(rot).setTint(color).setAlpha(p).setVisible(true);
      const name = def?.name ?? String(warn.type);
      this.warning.label.setText(`${name.toUpperCase()}  ${Math.max(0, Math.ceil(warn.in))}s`).setVisible(true).setAlpha(0.9);
      const lx = warn.from === 'west' ? x + 24 : warn.from === 'east' ? x - 24 : x;
      const ly = warn.from === 'north' ? y + 22 : warn.from === 'south' ? y - 22 : y + 20;
      this.warning.label.setOrigin(warn.from === 'west' ? 0 : warn.from === 'east' ? 1 : 0.5, 0.5).setPosition(lx, ly);
    } else {
      this.warning.arrow.setVisible(false); this.warning.label.setVisible(false);
    }

    // boss arrow (only when boss is off-screen)
    if (bossScreen && state.boss?.active) {
      const m = 34;
      const off = bossScreen.x < m || bossScreen.y < m || bossScreen.x > this.w - m || bossScreen.y > this.h - m;
      if (off) {
        const cx = this.w / 2, cy = this.h / 2;
        const dx = bossScreen.x - cx, dy = bossScreen.y - cy;
        const ang = Math.atan2(dy, dx);
        // intersect ray with inset rect
        const hw = this.w / 2 - m, hh = this.h / 2 - m;
        const k = Math.min(Math.abs(hw / (Math.cos(ang) || 1e-6)), Math.abs(hh / (Math.sin(ang) || 1e-6)));
        const x = cx + Math.cos(ang) * k, y = cy + Math.sin(ang) * k;
        const def = state.boss.type ? ENEMY_DEFS[state.boss.type] : null;
        this.boss.arrow.setPosition(x, y).setRotation(ang).setTint(def?.color ?? 0x6d5fd6).setAlpha(0.95).setVisible(true).setScale(TEX_SCALE * 1.7);
        this.boss.label.setText((def?.name ?? 'BOSS').toUpperCase()).setOrigin(0.5, 0.5)
          .setPosition(x - Math.cos(ang) * 30, y - Math.sin(ang) * 30).setVisible(true);
      } else {
        this.boss.arrow.setVisible(false); this.boss.label.setVisible(false);
      }
    } else {
      this.boss.arrow.setVisible(false); this.boss.label.setVisible(false);
    }
  }
}
