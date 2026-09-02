/**
 * Static terrain: the whole 56x26 hex continent baked into a few RenderTextures (one per region
 * column band) at boot. Isometric tiles = projected flat-top hexes with a short extruded side.
 * Decor (rocks, crystals, ruins...) is stamped into the same textures; forest trees are live
 * sprites at high quality (so they can sway) and baked otherwise. Roads between nearby
 * settlements are dotted into the texture. TerrainFx animates water shimmer and crystal glow
 * for tiles inside the camera view.
 */
import Phaser from 'phaser';
import type { SimState, Tile, Terrain } from '../core/types';
import { HEX_R, HEX_H, ISO_Y, REGION_COLORS, REGION_W } from '../core/config';
import { hexToWorld, hexCorners, parseKey, hash2, hexDistance } from '../core/hex';
import { TERRAIN_COLORS } from './palette';
import { mixColor, shade, hashInt, lighten } from './util';
import { TEX_SCALE } from './textures';
import type { RenderSettings } from './settings';

interface DecorItem { key: string; x: number; y: number; scale: number; flip: boolean; alpha: number; }
interface LiveTree { img: Phaser.GameObjects.Image; phase: number; amp: number; }

/** Decor stamped into the terrain itself (never hidden by the zoom LOD). */
const TERRAIN_DECOR = new Set(['peak', 'ripple']);

export class TerrainLayer {
  private rts: Phaser.GameObjects.RenderTexture[] = [];
  /** Trees / rocks / bushes baked separately so they can be hidden when zoomed far out. */
  private decorRts: Phaser.GameObjects.RenderTexture[] = [];
  private decorShown = true;
  private built = false;
  private trees: LiveTree[] = [];
  private swaying = false;
  public waterTiles: Array<{ x: number; y: number; v: number }> = [];
  public crystalTiles: Array<{ x: number; y: number; v: number }> = [];
  public bounds = { x0: 0, y0: 0, x1: 0, y1: 0 }; // projected world bounds of the map

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer, private decorLayer: Phaser.GameObjects.Layer) {}

  isBuilt(): boolean { return this.built; }

  destroy(): void {
    for (const rt of this.rts) { try { rt.destroy(); } catch { /* ignore */ } }
    this.rts = [];
    for (const rt of this.decorRts) { try { rt.destroy(); } catch { /* ignore */ } }
    this.decorRts = [];
    for (const t of this.trees) t.img.destroy();
    this.trees = [];
    this.waterTiles = []; this.crystalTiles = [];
    this.built = false;
  }

  build(state: SimState, decorDensity: number, liveTrees: boolean): void {
    this.destroy();
    const mapW = state.mapW | 0, mapH = state.mapH | 0;
    if (!state.tiles || mapW <= 0 || mapH <= 0) return;

    // Tiles that carry pre-laid rail or a settlement get no decor (keeps the diagram legible).
    const noDecor = new Set<string>();
    try {
      for (const k of state.route?.railLinks ?? []) {
        const [a, b] = k.split('|');
        noDecor.add(a); noDecor.add(b);
      }
      for (const s of state.settlements ?? []) noDecor.add(s.col + ',' + s.row);
    } catch { /* ignore malformed */ }

    // roads: settlement pairs within 5 hexes
    const roads: Array<[number, number, number, number]> = [];
    try {
      const list = state.settlements ?? [];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (hexDistance(a.col, a.row, b.col, b.row) <= 5) {
          const pa = hexToWorld(a.col, a.row), pb = hexToWorld(b.col, b.row);
          roads.push([pa.x, pa.y * ISO_Y, pb.x, pb.y * ISO_Y]);
        }
      }
    } catch { /* ignore */ }

    const yMinU = -HEX_H;
    const yMaxU = HEX_H * (mapH - 1) + HEX_H;
    const yTop = yMinU * ISO_Y - 36;
    const yBot = yMaxU * ISO_Y + 24;
    this.bounds = { x0: -HEX_R, y0: yMinU * ISO_Y, x1: hexToWorld(mapW - 1, 0).x + HEX_R, y1: yMaxU * ISO_Y };

    // bands of at most ~1300 px so every RenderTexture stays far below GPU texture limits
    const chunkCols = Math.max(1, Math.min(REGION_W, 24));
    for (let c0 = 0; c0 < mapW; c0 += chunkCols) {
      const c1 = Math.min(mapW, c0 + chunkCols);
      const x0 = hexToWorld(c0, 0).x - HEX_R;
      const x1 = hexToWorld(c1 - 1, 0).x + HEX_R;
      const w = Math.max(1, Math.ceil(x1 - x0)), h = Math.max(1, Math.min(4096, Math.ceil(yBot - yTop)));
      if (!Number.isFinite(w) || !Number.isFinite(h)) continue;
      let rt: Phaser.GameObjects.RenderTexture;
      try {
        rt = this.scene.add.renderTexture(x0, yTop, w, h);
      } catch (e) {
        console.warn('[render] terrain RT failed', e);
        continue;
      }
      rt.setOrigin(0, 0);
      this.layer.add(rt);
      this.rts.push(rt);
      let drt: Phaser.GameObjects.RenderTexture | null = null;
      try {
        drt = this.scene.add.renderTexture(x0, yTop, w, h);
        drt.setOrigin(0, 0).setDepth(-1e9).setVisible(this.decorShown);
        this.decorLayer.add(drt);
        this.decorRts.push(drt);
      } catch (e) { console.warn('[render] decor RT failed', e); drt = null; }
      this.drawChunk(rt, drt, state, c0, c1, x0, yTop, noDecor, decorDensity, liveTrees, roads);
    }
    this.built = true;
  }

  /** Zoom LOD: hide baked trees/rocks and live trees when zoomed far out (terrain stays). */
  setDecorVisible(on: boolean): void {
    if (on === this.decorShown) return;
    this.decorShown = on;
    for (const rt of this.decorRts) rt.setVisible(on);
    for (const t of this.trees) t.img.setVisible(on);
  }

  private drawChunk(rt: Phaser.GameObjects.RenderTexture, drt: Phaser.GameObjects.RenderTexture | null, state: SimState, c0: number, c1: number, ox: number, oy: number,
    noDecor: Set<string>, density: number, liveTrees: boolean, roads: Array<[number, number, number, number]>): void {
    const mapW = state.mapW, mapH = state.mapH;
    const tiles: Tile[] = [];
    for (let row = 0; row < mapH; row++) for (let col = c0; col < c1; col++) {
      const t = state.tiles[row * mapW + col];
      if (t) tiles.push(t);
    }
    tiles.sort((a, b) => {
      const ya = hexToWorld(a.col, a.row).y, yb = hexToWorld(b.col, b.row).y;
      return ya - yb || a.col - b.col;
    });

    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const decor: DecorItem[] = [];
    const live: Array<{ key: string; x: number; y: number; scale: number; flip: boolean }> = [];
    const pts: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) pts.push(new Phaser.Geom.Point(0, 0));
    const quad: Phaser.Geom.Point[] = [new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(0, 0)];

    for (const t of tiles) {
      const w = hexToWorld(t.col, t.row);
      const cx = w.x - ox, cy = w.y * ISO_Y - oy;
      const corners = hexCorners(w.x, w.y, HEX_R);
      for (let i = 0; i < 6; i++) pts[i].setTo(corners[i][0] - ox, corners[i][1] * ISO_Y - oy);

      const terrain: Terrain = (TERRAIN_COLORS as Record<string, number>)[t.terrain] !== undefined ? t.terrain : 'plains';
      const base = TERRAIN_COLORS[terrain];
      const v = hashInt((t.decor | 0) * 7919 + t.col * 131 + t.row * 17);
      const elev = Number.isFinite(t.elevation) ? Math.max(0, Math.min(1, t.elevation)) : 0.5;
      let top = shade(base, 1.0 + elev * 0.3 + (v - 0.5) * 0.12);
      top = mixColor(top, regionTint(t.col, t.row, t.region | 0, state.seed | 0), 0.08);
      const thick = terrain === 'mountain' ? 12 : terrain === 'hills' ? 7 : terrain === 'water' ? 1.5 : 2 + elev * 4;

      const faces: Array<[number, number, number]> = [[0, 1, 0.64], [1, 2, 0.5], [2, 3, 0.58]];
      for (const [a, b, f] of faces) {
        quad[0].setTo(pts[a].x, pts[a].y);
        quad[1].setTo(pts[b].x, pts[b].y);
        quad[2].setTo(pts[b].x, pts[b].y + thick);
        quad[3].setTo(pts[a].x, pts[a].y + thick);
        g.fillStyle(shade(top, f), 1);
        g.fillPoints(quad, true);
      }
      g.fillStyle(top, 1);
      g.fillPoints(pts, true);
      // sunlight: a faint warm highlight on the NE half of every top face
      g.fillStyle(0xfff2c0, 0.09);
      g.fillTriangle(pts[5].x, pts[5].y, pts[0].x, pts[0].y, pts[4].x, pts[4].y);

      switch (terrain) {
        case 'water': {
          g.fillStyle(shade(top, 0.72), 0.75);
          g.fillEllipse(cx, cy + 1, 40, 22 * ISO_Y + 2);
          g.fillStyle(shade(top, 0.6), 0.6);
          g.fillEllipse(cx + 2, cy + 2, 22, 12 * ISO_Y + 1);
          g.lineStyle(1, mixColor(top, 0xffffff, 0.35), 0.45);
          g.lineBetween(cx - 12, cy - 4 * ISO_Y, cx - 4, cy - 7 * ISO_Y);
          g.lineBetween(cx + 2, cy + 6 * ISO_Y, cx + 10, cy + 3 * ISO_Y);
          this.waterTiles.push({ x: w.x, y: w.y * ISO_Y, v });
          break;
        }
        case 'hills':
          g.lineStyle(1, mixColor(top, 0xffffff, 0.3), 0.5);
          g.strokeEllipse(cx - 4, cy - 4, 24, 12);
          g.strokeEllipse(cx - 2, cy - 3, 12, 6);
          g.lineStyle(1, shade(top, 0.75), 0.4);
          g.strokeEllipse(cx + 6, cy + 5, 16, 7);
          break;
        case 'mountain': {
          // shaded massif: dark SW face, lit NE face, snow on the crest
          g.fillStyle(shade(top, 0.7), 0.9);
          g.fillTriangle(cx - 22, cy + 10, cx - 4, cy - 14, cx + 2, cy + 12);
          g.fillStyle(lighten(top, 0.18), 0.9);
          g.fillTriangle(cx - 4, cy - 14, cx + 20, cy + 8, cx + 2, cy + 12);
          g.fillStyle(0xf0f4ff, 0.9);
          g.fillTriangle(cx - 4, cy - 14, cx - 9, cy - 6, cx + 3, cy - 7);
          g.fillStyle(0xd8e0f0, 0.7);
          g.fillTriangle(cx + 6, cy - 4, cx + 12, cy + 2, cx + 4, cy + 1);
          break;
        }
        case 'ash':
          g.fillStyle(shade(top, 0.7), 0.7);
          g.fillCircle(cx - 8 + v * 6, cy + 3, 1.5);
          g.fillCircle(cx + 6 - v * 4, cy - 5, 1.2);
          g.fillCircle(cx + 2, cy + 8, 1);
          g.fillStyle(0xff8a40, 0.35);
          g.fillCircle(cx - 10 + v * 20, cy + 4 - v * 8, 1);
          break;
        case 'forest':
          g.fillStyle(shade(top, 0.82), 0.6);
          g.fillEllipse(cx + (v - 0.5) * 10, cy + 2, 30, 16);
          g.fillStyle(shade(top, 0.7), 0.35);
          g.fillEllipse(cx + (v - 0.5) * 6, cy + 5, 18, 8);
          break;
        case 'crystal':
          g.fillStyle(mixColor(top, 0xffffff, 0.3), 0.35);
          g.fillTriangle(cx - 10, cy + 6, cx - 4, cy - 6, cx + 2, cy + 6);
          g.fillStyle(0xb4aeff, 0.18);
          g.fillEllipse(cx, cy, 34, 18);
          this.crystalTiles.push({ x: w.x, y: w.y * ISO_Y, v });
          break;
        case 'ruins':
          g.fillStyle(shade(top, 0.75), 0.7);
          g.fillRect(cx - 12, cy + 2, 6, 3);
          g.fillRect(cx + 6, cy - 6, 5, 3);
          g.fillStyle(shade(top, 0.6), 0.6);
          g.fillCircle(cx - 3, cy + 7, 1.2); g.fillCircle(cx + 9, cy + 4, 1); g.fillCircle(cx - 8, cy - 5, 1);
          break;
      }
      g.lineStyle(1, 0x0b0e1a, 0.28);
      g.strokePoints(pts, true, true);

      // ---- decor ----
      const key = t.col + ',' + t.row;
      const allowDecor = !noDecor.has(key) && density > 0.01;
      const h1 = hash2(t.col, t.row, 11), h2 = hash2(t.col, t.row, 23), h3 = hash2(t.col, t.row, 37), h4 = hash2(t.col, t.row, 41);
      const place = (k: string, dx: number, dy: number, scale = 1, alpha = 1) => {
        decor.push({ key: k, x: cx + dx, y: cy + dy * ISO_Y, scale, flip: h4 > 0.5, alpha });
      };
      const tree = (k: string, dx: number, dy: number, scale = 1) => {
        if (liveTrees) live.push({ key: k, x: w.x + dx, y: w.y * ISO_Y + dy * ISO_Y, scale, flip: h4 > 0.5 });
        else place(k, dx, dy, scale);
      };
      const D = density;
      switch (terrain) {
        case 'forest':
          if (allowDecor) {
            tree(h1 < 0.5 ? 'tree_pine' : 'tree_round', (h2 - 0.5) * 22, (h3 - 0.5) * 16 + 6, 0.95 + h1 * 0.2);
            if (h2 < 0.8 * D) tree(h3 < 0.5 ? 'tree_pine' : 'tree_round', (h1 - 0.5) * 30, (h4 - 0.5) * 20 + 2, 0.8 + h2 * 0.3);
            if (h3 < 0.55 * D) tree('tree_pine', (h4 - 0.5) * 26, (h2 - 0.5) * 18 - 4, 0.7 + h3 * 0.3);
            if (h4 < 0.4 * D) place('bush', (h1 - 0.5) * 34, (h3 - 0.5) * 24 + 8, 0.8);
          }
          break;
        case 'plains':
          if (allowDecor && h1 < 0.22 * D) place('bush', (h2 - 0.5) * 30, (h3 - 0.5) * 22, 0.9 + h1);
          if (allowDecor && h2 < 0.35 * D) place('grass', (h3 - 0.5) * 34, (h4 - 0.5) * 26, 1, 0.85);
          if (allowDecor && h3 < 0.12 * D) tree('tree_round', (h4 - 0.5) * 28, (h1 - 0.5) * 20 + 4, 0.75);
          break;
        case 'hills':
          if (allowDecor && h1 < 0.4 * D) place(h2 < 0.3 ? 'rock_big' : 'rock', (h2 - 0.5) * 26, (h3 - 0.5) * 20 + 4, 0.9 + h1 * 0.3);
          if (allowDecor && h3 < 0.25 * D) place('grass', (h4 - 0.5) * 30, (h1 - 0.5) * 22, 1, 0.8);
          break;
        case 'mountain':
          place('peak', (h1 - 0.5) * 6, 2, 1 + elev * 0.35);
          if (allowDecor && h2 < 0.5 * D) place('rock_big', (h3 - 0.5) * 28, 10 + (h4 - 0.5) * 8, 0.8);
          break;
        case 'ruins':
          if (allowDecor && h1 < 0.6 * D) place('wall', (h2 - 0.5) * 24, (h3 - 0.5) * 18 + 4, 0.9 + h1 * 0.3);
          if (allowDecor && h3 < 0.35 * D) place('pillar', (h4 - 0.5) * 30, (h1 - 0.5) * 20, 0.9);
          if (allowDecor && h2 < 0.5 * D) place('rock', (h1 - 0.5) * 30, (h2 - 0.5) * 22 + 6, 0.6, 0.9);
          break;
        case 'ash':
          if (allowDecor && h1 < 0.3 * D) place('tree_dead', (h2 - 0.5) * 26, (h3 - 0.5) * 18 + 4, 0.9 + h1 * 0.4);
          if (allowDecor && h2 < 0.4 * D) place('ash_pile', (h3 - 0.5) * 30, (h4 - 0.5) * 22, 1, 0.9);
          break;
        case 'crystal':
          if (allowDecor && h1 < 0.65 * D) place('crystal', (h2 - 0.5) * 24, (h3 - 0.5) * 18 + 4, 0.85 + h1 * 0.4);
          if (allowDecor && h2 < 0.4 * D) place('crystal_small', (h3 - 0.5) * 30, (h4 - 0.5) * 22, 1);
          break;
        case 'water':
          if (h1 < 0.6 * D) place('ripple', (h2 - 0.5) * 20, (h3 - 0.5) * 16, 1, 0.8);
          break;
      }
    }

    // roads (dotted) — drawn into every chunk, clipped by the texture bounds
    g.fillStyle(0x2a2418, 0.32);
    for (const [ax, ay, bx, by] of roads) {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < 1) continue;
      for (let s = 14; s < len - 14; s += 6) {
        const x = ax + dx * (s / len) - ox, y = ay + dy * (s / len) - oy;
        g.fillCircle(x, y + Math.sin(s * 0.3) * 1.2, 1);
      }
    }

    try {
      rt.draw(g, 0, 0);
    } catch (e) {
      console.warn('[render] terrain draw failed', e);
    }
    g.destroy();

    decor.sort((a, b) => a.y - b.y);
    if (decor.length) {
      const img = this.scene.make.image({ x: 0, y: 0, key: 'px' }, false);
      img.setOrigin(0.5, 1);
      const stamp = (target: Phaser.GameObjects.RenderTexture, items: DecorItem[]) => {
        if (!items.length) return;
        try {
          target.beginDraw();
          for (const d of items) {
            if (!this.scene.textures.exists(d.key)) continue;
            img.setTexture(d.key);
            img.setScale(TEX_SCALE * d.scale * (d.flip ? -1 : 1), TEX_SCALE * d.scale);
            img.setAlpha(d.alpha);
            target.batchDraw(img, d.x, d.y);
          }
          target.endDraw();
        } catch (e) {
          try { target.endDraw(); } catch { /* ignore */ }
          console.warn('[render] decor stamp failed', e);
        }
      };
      // mountain peaks and water ripples belong to the terrain; everything else is LOD decor
      const fixed = decor.filter(d => TERRAIN_DECOR.has(d.key));
      const lod = drt ? decor.filter(d => !TERRAIN_DECOR.has(d.key)) : [];
      stamp(rt, drt ? fixed : decor);
      if (drt) stamp(drt, lod);
      img.destroy();
    }
    // live trees
    for (const t of live) {
      if (!this.scene.textures.exists(t.key)) continue;
      const img = this.scene.add.image(t.x, t.y, t.key).setOrigin(0.5, 1).setScale(TEX_SCALE * t.scale * (t.flip ? -1 : 1), TEX_SCALE * t.scale);
      img.setDepth(t.y).setVisible(this.decorShown);
      this.decorLayer.add(img);
      this.trees.push({ img, phase: Math.random() * Math.PI * 2, amp: 0.025 + Math.random() * 0.02 });
    }
  }

  /** Per-frame tree sway (only at zoom >= 0.8, high quality, not reduced motion). */
  update(timeSec: number, view: Phaser.Geom.Rectangle, zoom: number, settings: RenderSettings): void {
    const sway = zoom >= 0.8 && settings.quality === 'high' && !settings.reducedMotion;
    if (!sway) {
      if (this.swaying) { for (const t of this.trees) t.img.setRotation(0); this.swaying = false; }
      return;
    }
    this.swaying = true;
    const x0 = view.x - 40, x1 = view.right + 40, y0 = view.y - 40, y1 = view.bottom + 40;
    for (const t of this.trees) {
      const img = t.img;
      if (img.x < x0 || img.x > x1 || img.y < y0 || img.y > y1) continue;
      img.setRotation(Math.sin(timeSec * 1.4 + t.phase) * t.amp + Math.sin(timeSec * 3.1 + t.phase * 2) * t.amp * 0.3);
    }
  }
}

/** Animated terrain details for tiles inside the camera view: water shimmer, crystal glow pulse. */
export class TerrainFx {
  public gfx: Phaser.GameObjects.Graphics;
  private glowPool: Phaser.GameObjects.Image[] = [];
  private depth: number;
  constructor(private scene: Phaser.Scene, depth: number) {
    this.depth = depth;
    this.gfx = scene.add.graphics().setDepth(depth);
  }
  destroy(): void { this.gfx.destroy(); for (const g of this.glowPool) g.destroy(); this.glowPool = []; }

  update(terrain: TerrainLayer, timeSec: number, view: Phaser.Geom.Rectangle, zoom: number, settings: RenderSettings): void {
    const g = this.gfx;
    g.clear();
    let gi = 0;
    const hideRest = () => { for (let i = gi; i < this.glowPool.length; i++) this.glowPool[i].setVisible(false); };
    if (settings.quality === 'low' || zoom < 0.55) { hideRest(); return; }
    const t = settings.reducedMotion ? 0 : timeSec;
    const x0 = view.x - 40, x1 = view.right + 40, y0 = view.y - 40, y1 = view.bottom + 40;
    let n = 0;
    for (const w of terrain.waterTiles) {
      if (w.x < x0 || w.x > x1 || w.y < y0 || w.y > y1) continue;
      if (++n > 260) break;
      const ph = t * 1.6 + w.v * 6.28;
      const a = 0.25 + 0.25 * Math.sin(ph);
      g.lineStyle(1, 0xd8f0ff, a);
      const sx = Math.sin(ph) * 6, sy = Math.cos(ph * 0.7) * 2;
      g.lineBetween(w.x - 10 + sx, w.y - 3 + sy, w.x - 3 + sx, w.y - 5 + sy);
      g.lineBetween(w.x + 2 - sx, w.y + 4 - sy, w.x + 9 - sx, w.y + 2 - sy);
      g.fillStyle(0xffffff, 0.35 + 0.35 * Math.sin(ph * 1.3 + 1));
      g.fillRect(w.x + Math.cos(ph) * 8 - 0.9, w.y + Math.sin(ph * 0.5) * 4 - 0.9, 1.8, 1.8);
    }
    if (!settings.glow) { hideRest(); return; }
    for (const c of terrain.crystalTiles) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      if (gi >= 160) break;
      let img = this.glowPool[gi];
      if (!img) {
        img = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8f84ff).setDepth(this.depth + 0.1);
        this.glowPool.push(img);
      }
      const p = 0.5 + 0.5 * Math.sin(t * 0.9 + c.v * 6.28);
      img.setVisible(true).setPosition(c.x, c.y).setAlpha(0.10 + 0.14 * p).setScale(0.45 + p * 0.08, (0.45 + p * 0.08) * ISO_Y);
      gi++;
    }
    hideRest();
  }
}

/**
 * Region tint for a tile. The worldgen dithers terrain rules across ±6 columns of every region
 * border, so the tint is blended over the same band (weight (6 - d) / 12, i.e. 0.5 at the border
 * column on both sides) with the same per-tile hash as the terrain dither, so the tint speckles with
 * the terrain instead of snapping at a column.
 */
export function regionTint(col: number, row: number, region: number, seed: number): number {
  const own = REGION_COLORS[region] ?? REGION_COLORS[0];
  const inRegion = col - region * REGION_W;
  const toNext = REGION_W - 1 - inRegion;
  let other = -1, w = 0;
  if (region < REGION_COLORS.length - 1 && toNext < 6) { other = region + 1; w = (6 - toNext) / 12; }
  else if (region > 0 && inRegion < 6) { other = region - 1; w = (6 - inRegion) / 12; }
  if (other < 0 || w <= 0) return own;
  const bh = hash2(col * 7 + 3, row * 5 + 1, seed + 91);
  const t = w * 0.6 + (bh < w ? 0.4 : 0);   // tiles that took the neighbour's terrain rules lean further into its tint
  return mixColor(own, REGION_COLORS[other] ?? own, t);
}

/** Parse "c,r" keys defensively. */
export function safeParseKey(k: string): [number, number] | null {
  try {
    const p = parseKey(k);
    if (Number.isFinite(p[0]) && Number.isFinite(p[1])) return p;
  } catch { /* ignore */ }
  return null;
}
