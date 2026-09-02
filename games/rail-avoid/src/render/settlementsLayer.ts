/**
 * Settlements: a miniature cluster of 2-5 tiny iso buildings with a type-specific landmark,
 * a ground shadow, warm flickering window lights at night and occasional chimney smoke —
 * with the transit-diagram station marker (white ring, colored core, glyph, small-caps label,
 * deadline countdown arc) drawn on top.
 */
import Phaser from 'phaser';
import type { SimState, Settlement, SettlementType } from '../core/types';
import { ISO_Y } from '../core/config';
import { hexToWorld, neighbors, tileKey } from '../core/hex';
import { hexCenterP, dist, rgb, hashInt } from './util';
import { SETTLEMENT_COLORS, FONT } from './palette';
import { TEX_SCALE } from './textures';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';

interface Building {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  light: Phaser.GameObjects.Image | null;
  chimney: { x: number; y: number } | null;
  flicker: number;
}
interface SView {
  id: string;
  type: SettlementType;
  x: number; y: number;
  ring: Phaser.GameObjects.Image;
  core: Phaser.GameObjects.Image;
  glyph: Phaser.GameObjects.Image;
  check: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  arc: Phaser.GameObjects.Graphics;
  buildings: Building[];
  gateGlow: Phaser.GameObjects.Image | null;
  status: string;
  seed: number;
}

const DEADLINE_WINDOW = 300;

/** Building sets per settlement type: [landmark, ...fillers]. */
const CLUSTERS: Record<SettlementType, string[]> = {
  start: ['b_depot', 'b_warehouse', 'b_house', 'b_railstack', 'b_house2'],
  village: ['b_chapel', 'b_house', 'b_house2', 'b_house', 'b_house2'],
  depot: ['b_warehouse', 'b_railstack', 'b_railstack', 'b_house2', 'b_shed'],
  mine: ['b_headframe', 'b_spoil', 'b_house2', 'b_spoil', 'b_railstack'],
  farm: ['b_silo', 'b_field', 'b_field', 'b_house', 'b_field'],
  fuel: ['b_tank', 'b_pump', 'b_pump', 'b_house2', 'b_tank'],
  clinic: ['b_clinic', 'b_house', 'b_house2', 'b_house'],
  armory: ['b_bunker', 'b_sandbags', 'b_sandbags', 'b_house2', 'b_bunker'],
  yard: ['b_crane', 'b_shed', 'b_railstack', 'b_warehouse', 'b_railstack'],
  terminus: ['b_gate', 'b_house2', 'b_house', 'b_house2'],
};
const HAS_CHIMNEY = new Set(['b_house', 'b_house2', 'b_warehouse', 'b_shed', 'b_depot', 'b_headframe']);
const HAS_WINDOW = new Set(['b_house', 'b_house2', 'b_chapel', 'b_warehouse', 'b_clinic', 'b_shed', 'b_depot', 'b_silo', 'b_headframe']);

export class SettlementsLayer {
  private views = new Map<string, SView>();
  private arcCursor = 0;
  private settings: RenderSettings;
  private railDirs = new Map<string, number[]>();

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer, private fx: FxLayer, settings: RenderSettings) {
    this.settings = settings;
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    for (const v of this.views.values()) this.destroyView(v);
    this.views.clear();
  }
  private destroyView(v: SView): void {
    v.ring.destroy(); v.core.destroy(); v.glyph.destroy(); v.check.destroy(); v.label.destroy(); v.arc.destroy();
    for (const b of v.buildings) { b.img.destroy(); b.shadow.destroy(); b.light?.destroy(); }
    v.gateGlow?.destroy();
  }

  rebuild(state: SimState): void {
    this.destroy();
    // directions of rail links through each settlement tile (buildings avoid the track)
    this.railDirs.clear();
    try {
      const links = new Set(state.route?.railLinks ?? []);
      for (const s of state.settlements ?? []) {
        const dirs: number[] = [];
        const c = hexToWorld(s.col, s.row);
        for (const [nc, nr] of neighbors(s.col, s.row)) {
          const a = tileKey(s.col, s.row), b = tileKey(nc, nr);
          const k = a < b ? a + '|' + b : b + '|' + a;
          if (!links.has(k)) continue;
          const n = hexToWorld(nc, nr);
          dirs.push(Math.atan2(n.y - c.y, n.x - c.x));
        }
        this.railDirs.set(s.id, dirs);
      }
    } catch { /* ignore */ }
    const list = Array.isArray(state.settlements) ? state.settlements : [];
    for (const s of list) {
      if (!s || typeof s.id !== 'string') continue;
      try { this.views.set(s.id, this.createView(s)); } catch (e) { console.warn('[render] settlement view failed', e); }
    }
    this.arcCursor = 0;
  }

  private createView(s: Settlement): SView {
    const c = hexCenterP(s.col, s.row);
    const x = c.x, y = c.y - 2;
    const type: SettlementType = CLUSTERS[s.type] ? s.type : 'village';
    const color = SETTLEMENT_COLORS[type] ?? 0xffffff;
    const [r, g, b] = rgb(color);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const seed = hashInt(s.col * 977 + s.row * 131 + 7);

    // ---- buildings ----
    const buildings: Building[] = [];
    const keys = CLUSTERS[type];
    const count = Math.min(keys.length, 2 + Math.floor(hashInt(seed * 1000 + 1) * 4)); // 2..5
    const rail = this.railDirs.get(s.id) ?? [];
    const slots: number[] = [];
    for (let i = 0; i < 12; i++) slots.push(-Math.PI + (i / 12) * Math.PI * 2);
    const ok = (a: number) => {
      // keep clear of the track and of the label below the marker
      for (const d of rail) { let dd = Math.abs(a - d); while (dd > Math.PI) dd = Math.abs(dd - Math.PI * 2); if (dd < 0.6) return false; }
      let dl = Math.abs(a - Math.PI / 2); while (dl > Math.PI) dl = Math.abs(dl - Math.PI * 2);
      return dl > 0.75;
    };
    const free = slots.filter(ok);
    // landmark prefers the north slot
    free.sort((p, q) => Math.abs(p + Math.PI / 2) - Math.abs(q + Math.PI / 2));
    let placed = 0;
    for (let i = 0; i < keys.length && placed < count; i++) {
      const key = keys[i];
      if (!this.scene.textures.exists(key)) continue;
      const slot = free.length ? free[(i * 5 + Math.floor(hashInt(seed + i) * 3)) % free.length] : -Math.PI / 2;
      // spread used slots
      const idx = free.indexOf(slot); if (idx >= 0) free.splice(idx, 1);
      const rad = (i === 0 ? 20 : 22 + hashInt(seed + i * 3) * 8);
      const bx = x + Math.cos(slot) * rad, by = y + Math.sin(slot) * rad * ISO_Y + 6;
      const scale = TEX_SCALE * (i === 0 ? 1 : 0.8 + hashInt(seed + i * 7) * 0.25);
      const shadow = this.scene.add.image(bx + 2, by, 'b_shadow').setScale(scale * 1.05, scale).setAlpha(0.45);
      const img = this.scene.add.image(bx, by, key).setOrigin(0.5, 1).setScale(scale);
      let light: Phaser.GameObjects.Image | null = null;
      if (HAS_WINDOW.has(key)) {
        light = this.scene.add.image(bx + (hashInt(seed + i * 11) - 0.5) * 6, by - 4 * scale / TEX_SCALE, 'lantern').setBlendMode(Phaser.BlendModes.ADD).setScale(TEX_SCALE * 1.6).setAlpha(0).setTint(0xffc870);
      }
      const chimney = HAS_CHIMNEY.has(key) ? { x: bx + 5 * scale / TEX_SCALE, y: by - 14 * scale / TEX_SCALE } : null;
      const depth = y - 30 + (by - y);
      this.layer.add(shadow); this.layer.add(img); shadow.setDepth(depth - 0.1); img.setDepth(depth);
      if (light) { this.layer.add(light); light.setDepth(depth + 0.05); }
      buildings.push({ img, shadow, light, chimney, flicker: hashInt(seed + i * 13) * 6.28 });
      placed++;
    }
    let gateGlow: Phaser.GameObjects.Image | null = null;
    if (type === 'terminus' && buildings.length) {
      const lm = buildings[0];
      gateGlow = this.scene.add.image(lm.img.x, lm.img.y - 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8f7bff).setScale(1.4, 1).setAlpha(0.4);
      this.layer.add(gateGlow); gateGlow.setDepth(lm.img.depth - 0.02);
    }

    // ---- diagram marker (on top) ----
    const ring = this.scene.add.image(x, y, 'st_ring').setScale(TEX_SCALE);
    const core = this.scene.add.image(x, y, 'st_core').setScale(TEX_SCALE * 1.1).setTint(color);
    const glyphKey = this.scene.textures.exists('gl_' + type) ? 'gl_' + type : 'gl_village';
    const glyph = this.scene.add.image(x, y, glyphKey).setScale(TEX_SCALE * 0.95).setTint(lum > 0.62 ? 0x0b0e1a : 0xffffff);
    const check = this.scene.add.image(x, y, 'st_check').setScale(TEX_SCALE).setVisible(false);
    const label = this.scene.add.text(x, y + 19, String(s.name ?? '').toUpperCase(), {
      fontFamily: FONT, fontSize: '9px', color: '#e6e9f2', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 0);
    label.setLetterSpacing(1);
    const arc = this.scene.add.graphics();
    for (const o of [arc, ring, core, glyph, check, label]) { this.layer.add(o); o.setDepth(y + 0.5); }
    arc.setDepth(y + 0.4);
    return { id: s.id, type, x, y, ring, core, glyph, check, label, arc, buildings, gateGlow, status: '', seed };
  }

  update(state: SimState, nowMs: number, zoom: number, reducedMotion: boolean, night: number, view: Phaser.Geom.Rectangle): void {
    const list = Array.isArray(state.settlements) ? state.settlements : [];
    if (list.length !== this.views.size) this.rebuild(state);
    const showLabels = zoom >= 0.6;
    const slice = Math.max(1, Math.ceil(list.length / 15));
    const arcStart = this.arcCursor;
    const arcEnd = arcStart + slice;
    this.arcCursor = arcEnd >= list.length ? 0 : arcEnd;
    const blink = reducedMotion ? 1 : (Math.floor(nowMs / 300) % 2 === 0 ? 1 : 0.35);
    const tSec = nowMs / 1000;
    const x0 = view.x - 60, x1 = view.right + 60, y0 = view.y - 60, y1 = view.bottom + 60;
    const gateOpen = !!state.boss?.gateOpen;
    const dtGuess = 1 / 60;
    for (let li = 0; li < list.length; li++) {
      const s = list[li];
      const v = this.views.get(s.id);
      if (!v) continue;
      const doArcs = li >= arcStart && li < arcEnd;
      v.label.setVisible(showLabels && !s.consumed);
      const status = s.consumed ? 'consumed' : s.visited ? 'visited' : 'open';
      if (status !== v.status) {
        v.status = status;
        if (status === 'consumed') {
          v.ring.setTint(0x3a3f4a).setAlpha(0.6); v.core.setTint(0x2a2f3a).setAlpha(0.7); v.glyph.setAlpha(0.35); v.check.setVisible(false);
          v.label.setAlpha(0.4); v.arc.clear();
          for (const b of v.buildings) { b.img.setTint(0x2a2438).setAlpha(0.5); b.shadow.setAlpha(0.15); b.light?.setVisible(false); }
          v.gateGlow?.setVisible(false);
        } else if (status === 'visited') {
          v.ring.clearTint().setAlpha(1); v.core.setAlpha(1); v.glyph.setAlpha(0.9); v.check.setVisible(false);
          v.ring.setTint(0xbfe8c4); v.label.setAlpha(0.85); v.arc.clear();
        } else {
          v.ring.clearTint().setAlpha(1); v.core.setAlpha(1); v.glyph.setAlpha(1); v.check.setVisible(false); v.label.setAlpha(1);
        }
      }
      if (status === 'visited') v.check.setVisible(true).setPosition(v.x + 12, v.y - 10).setScale(TEX_SCALE * 0.7);

      const inView = v.x > x0 && v.x < x1 && v.y > y0 && v.y < y1;
      // window lights + chimney smoke (only when in view)
      if (status !== 'consumed' && inView) {
        for (const b of v.buildings) {
          if (b.light) {
            if (night > 0.05) {
              const f = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(tSec * 7 + b.flicker) * Math.sin(tSec * 2.3 + b.flicker * 2);
              b.light.setVisible(true).setAlpha(night * 0.7 * f);
            } else b.light.setVisible(false);
          }
          if (b.chimney && this.settings.quality !== 'low' && Math.random() < dtGuess * 0.35 * this.settings.particleMul) {
            this.fx.smokeP(b.chimney.x, b.chimney.y, 1, 0xb8bcc8);
          }
        }
        if (v.gateGlow) {
          const p = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(tSec * 1.8);
          v.gateGlow.setVisible(true).setTint(gateOpen ? 0xffd070 : 0x8f7bff).setAlpha(gateOpen ? 0.55 + 0.25 * p : 0.3 + 0.3 * p).setScale(1.4 + p * 0.2, 1 + p * 0.15);
          if (this.settings.quality === 'high' && Math.random() < dtGuess * 3) this.fx.glowPuffP(v.gateGlow.x + (Math.random() - 0.5) * 30, v.gateGlow.y + 10, gateOpen ? 0xffd070 : 0x8f7bff, 5, 900);
        }
      } else {
        for (const b of v.buildings) b.light?.setVisible(false);
      }

      if (status !== 'open' || !doArcs) continue;
      const remaining = (Number.isFinite(s.deadline) ? s.deadline : 1e9) - (state.time || 0);
      const g = v.arc;
      g.clear();
      const R = 17;
      if (remaining > DEADLINE_WINDOW) {
        g.lineStyle(1.5, 0xffffff, 0.18);
        g.strokeCircle(v.x, v.y, R);
        continue;
      }
      const frac = Math.max(0, Math.min(1, remaining / DEADLINE_WINDOW));
      const color = frac > 0.5 ? 0x6fbf73 : frac > 0.25 ? 0xe8c170 : 0xe86f6f;
      const alpha = remaining < 45 ? blink : 0.95;
      g.lineStyle(1.5, 0xffffff, 0.12);
      g.strokeCircle(v.x, v.y, R);
      g.lineStyle(3, color, alpha);
      g.beginPath();
      g.arc(v.x, v.y, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
      g.strokePath();
      if (remaining < 60) {
        // pulsing red ring: the void is about to take it
        const p = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(tSec * 5);
        g.lineStyle(2.5, 0xff4040, 0.35 + 0.55 * p);
        g.strokeCircle(v.x, v.y, R + 5 + p * 3);
        g.lineStyle(1, 0xff8080, 0.3 * p);
        g.strokeCircle(v.x, v.y, R + 11 + p * 4);
      }
    }
  }

  hitTest(px: number, py: number, radius: number): string | null {
    let best: string | null = null, bd = radius;
    for (const v of this.views.values()) {
      const d = dist(px, py, v.x, v.y);
      if (d < bd) { bd = d; best = v.id; }
    }
    return best;
  }

  positionOf(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y } : null;
  }
}
