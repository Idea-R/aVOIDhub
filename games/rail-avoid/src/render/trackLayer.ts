/**
 * Track as a metro map: thick rounded polylines through hex centres.
 * - pre-laid rail: one colour per line id (route.railLines: 0 Central cream, 1 Northern amber,
 *   2 Southern teal, 3 crossover grey-blue) with a darker outline so all lines read over any
 *   terrain and at night; missing entries count as line 0
 * - player-built: warm cream/gold
 * - traversed: dimmed overlay
 * - planned-but-not-reached: dashed pulsing accent (separate small Graphics redrawn per frame)
 * - junction nodes: small rings
 * The static Graphics is only rebuilt when a cheap hash of the route changes.
 */
import Phaser from 'phaser';
import type { SimState } from '../core/types';
import { ISO_Y, HEX_R, LINE_COLORS } from '../core/config';
import { hexToWorld, tileKey } from '../core/hex';
import {
  TRACK_RAIL, TRACK_RAIL_DARK, TRACK_BUILT, TRACK_BUILT_EDGE, TRACK_PLANNED,
  TRACK_PLANNED_FREE, TRACK_TRAVERSED, JUNCTION_RING, DANGER,
} from './palette';
import { safeParseKey } from './terrain';
import { TEX_SCALE } from './textures';
import { shade, lighten } from './util';

/** Colour of a pre-laid line id (unknown / missing ids fall back to the Central Line). */
export function lineColor(line: number | undefined | null): number {
  const id = typeof line === 'number' && Number.isFinite(line) ? line | 0 : 0;
  return LINE_COLORS[id >= 0 && id < LINE_COLORS.length ? id : 0];
}

export class TrackLayer {
  public gfx: Phaser.GameObjects.Graphics;
  public ties: Phaser.GameObjects.Graphics;
  public pulse: Phaser.GameObjects.Graphics;
  private hash = '';
  private chargeImgs: Phaser.GameObjects.Image[] = [];
  private signalImgs: Phaser.GameObjects.Image[] = [];
  private junctions: Array<{ key: string; x: number; y: number }> = [];
  // static passes are baked into RenderTextures (Graphics re-tessellate every frame)
  // baked in column bands so no texture exceeds the GPU limit (map can be 160 columns wide)
  private rts: Phaser.GameObjects.RenderTexture[] = [];
  private tiesRts: Phaser.GameObjects.RenderTexture[] = [];
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private hasBounds = false;
  private depth: number;

  constructor(private scene: Phaser.Scene, depth: number, pulseDepth: number) {
    this.depth = depth;
    this.ties = scene.add.graphics();
    this.ties.setDepth(depth - 0.5).setVisible(false);
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(depth);
    this.pulse = scene.add.graphics();
    this.pulse.setDepth(pulseDepth);
  }

  /** Projected map bounds (from the terrain) so the baked textures can be sized. */
  setBounds(x0: number, y0: number, x1: number, y1: number): void {
    this.bounds = { x0, y0, x1, y1 };
    this.hasBounds = true;
    this.hash = '';
  }

  private ensureRts(): boolean {
    if (!this.hasBounds) return false;
    const b = this.bounds;
    const totalW = Math.ceil(b.x1 - b.x0 + 160), h = Math.max(1, Math.min(4096, Math.ceil(b.y1 - b.y0 + 160)));
    const x0 = b.x0 - 80, y = b.y0 - 80;
    if (!Number.isFinite(totalW) || !Number.isFinite(h) || totalW <= 0) return false;
    const BAND = 2048;
    const bands = Math.max(1, Math.ceil(totalW / BAND));
    try {
      if (this.rts.length !== bands) {
        for (const r of this.rts) r.destroy();
        for (const r of this.tiesRts) r.destroy();
        this.rts = []; this.tiesRts = [];
        for (let i = 0; i < bands; i++) {
          const bx = x0 + i * BAND;
          const bw = Math.max(1, Math.min(BAND, totalW - i * BAND));
          this.rts.push(this.scene.add.renderTexture(bx, y, bw, h).setOrigin(0, 0).setDepth(this.depth));
          this.tiesRts.push(this.scene.add.renderTexture(bx, y, bw, h).setOrigin(0, 0).setDepth(this.depth - 0.5).setVisible(false));
        }
      }
      return true;
    } catch (e) {
      console.warn('[render] track RT failed', e);
      for (const r of this.rts) { try { r.destroy(); } catch { /* ignore */ } }
      for (const r of this.tiesRts) { try { r.destroy(); } catch { /* ignore */ } }
      this.rts = []; this.tiesRts = [];
      return false;
    }
  }

  destroy(): void {
    this.gfx.destroy(); this.pulse.destroy(); this.ties.destroy();
    for (const r of this.rts) r.destroy();
    for (const r of this.tiesRts) r.destroy();
    this.rts = []; this.tiesRts = [];
    for (const i of this.signalImgs) i.destroy();
    this.signalImgs = [];
    for (const i of this.chargeImgs) i.destroy();
    this.chargeImgs = [];
  }

  invalidate(): void { this.hash = ''; }

  private computeHash(state: SimState): string {
    const r = state.route, t = state.train;
    if (!r) return 'none';
    const p = r.path ?? [];
    const last = p.length ? p[p.length - 1] : null;
    void t;
    // railLines lands with the worldgen rewrite; its size is part of the hash so the bake follows it
    const lines = r.railLines;
    const nLines = lines && typeof lines === 'object' ? Object.keys(lines).length : 0;
    return `${p.length}|${(r.builtLinks ?? []).length}|${(r.railLinks ?? []).length}|${nLines}|${last ? last[0] + ',' + last[1] : ''}|${state.seed}`;
  }

  update(state: SimState, timeSec: number, reducedMotion: boolean, zoom = 1): void {
    const h = this.computeHash(state);
    if (h !== this.hash) {
      this.hash = h;
      try { this.rebuild(state); } catch (e) { console.warn('[render] track rebuild failed', e); this.gfx.clear(); }
    }
    const showTies = zoom >= 0.9;
    if (this.tiesRts.length) { for (const r of this.tiesRts) r.setVisible(showTies); this.ties.setVisible(false); }
    else this.ties.setVisible(showTies);
    try { this.drawPulse(state, timeSec, reducedMotion); } catch (e) { this.pulse.clear(); }
  }

  private center(col: number, row: number): { x: number; y: number } {
    const w = hexToWorld(col, row);
    return { x: w.x, y: w.y * ISO_Y };
  }

  private rebuild(state: SimState): void {
    const g = this.gfx;
    g.clear();
    const route = state.route;
    if (!route) return;
    const rail = Array.isArray(route.railLinks) ? route.railLinks : [];
    const built = Array.isArray(route.builtLinks) ? route.builtLinks : [];
    const path = Array.isArray(route.path) ? route.path : [];
    const routeIndex = state.train?.routeIndex ?? 0;

    const railLines: Record<string, number> = route.railLines && typeof route.railLines === 'object' ? route.railLines : {};
    const railEdges: Array<[number, number, number, number]> = [];
    // edges and nodes grouped by line id (crossovers drawn first so the main lines sit on top)
    const byLine = new Map<number, { edges: Array<[number, number, number, number]>; nodes: Map<string, { x: number; y: number }> }>();
    const degree = new Map<string, number>();
    const nodes = new Map<string, { x: number; y: number }>();
    for (const k of rail) {
      const [a, b] = k.split('|');
      const pa = safeParseKey(a), pb = safeParseKey(b);
      if (!pa || !pb) continue;
      const e: [number, number, number, number] = [pa[0], pa[1], pb[0], pb[1]];
      railEdges.push(e);
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
      if (!nodes.has(a)) nodes.set(a, this.center(pa[0], pa[1]));
      if (!nodes.has(b)) nodes.set(b, this.center(pb[0], pb[1]));
      const raw = railLines[k];
      const line = typeof raw === 'number' && raw >= 0 && raw < LINE_COLORS.length ? raw | 0 : 0;
      let grp = byLine.get(line);
      if (!grp) { grp = { edges: [], nodes: new Map() }; byLine.set(line, grp); }
      grp.edges.push(e);
      if (!grp.nodes.has(a)) grp.nodes.set(a, nodes.get(a)!);
      if (!grp.nodes.has(b)) grp.nodes.set(b, nodes.get(b)!);
    }
    const railSet = new Set(rail);
    const builtEdges: Array<[number, number, number, number]> = [];
    const builtNodes = new Map<string, { x: number; y: number }>();
    for (const k of built) {
      if (railSet.has(k)) continue;
      const [a, b] = k.split('|');
      const pa = safeParseKey(a), pb = safeParseKey(b);
      if (!pa || !pb) continue;
      builtEdges.push([pa[0], pa[1], pb[0], pb[1]]);
      if (!builtNodes.has(a)) builtNodes.set(a, this.center(pa[0], pa[1]));
      if (!builtNodes.has(b)) builtNodes.set(b, this.center(pb[0], pb[1]));
    }

    const line = (edges: Array<[number, number, number, number]>, width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      for (const [c1, r1, c2, r2] of edges) {
        const a = this.center(c1, r1), b = this.center(c2, r2);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    };
    const dots = (list: Iterable<{ x: number; y: number }>, r: number, color: number, alpha: number) => {
      g.fillStyle(color, alpha);
      for (const p of list) g.fillCircle(p.x, p.y, r);
    };

    // --- sleepers / ties under the metro line (shown at zoom >= 0.9) ---
    const tg = this.ties;
    tg.clear();
    const drawTies = (edges: Array<[number, number, number, number]>, color: number) => {
      tg.lineStyle(2, color, 0.9);
      for (const [c1, r1, c2, r2] of edges) {
        const a = this.center(c1, r1), b = this.center(c2, r2);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dx / len, uy = dy / len;
        const px = -uy * 5, py = ux * 5;
        for (let s = 5; s < len - 4; s += 7.5) {
          const x = a.x + ux * s, y = a.y + uy * s;
          tg.lineBetween(x - px, y - py, x + px, y + py);
        }
      }
    };
    drawTies(railEdges, 0x3a2e22);
    drawTies(builtEdges, 0x5a4830);
    tg.fillStyle(0x2a2418, 0.35);
    for (const [c1, r1, c2, r2] of railEdges.concat(builtEdges)) {
      const a = this.center(c1, r1), b = this.center(c2, r2);
      tg.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), 0, 0);
    }
    this.junctions = [];

    // --- pre-laid rail: metro lines, one colour per line id ---
    // one dark outline pass for every edge first, so a coloured core is never cut by a neighbouring line's outline
    line(railEdges, 8.5, TRACK_RAIL_DARK, 0.92);
    dots(nodes.values(), 4.25, TRACK_RAIL_DARK, 0.92);
    const lineOrder = [...byLine.keys()].sort((p, q) => q - p); // 3 (crossovers) first ... 0 (Central) last
    for (const id of lineOrder) {
      const grp = byLine.get(id)!;
      const col = lineColor(id);
      const edge = shade(col, 0.42);
      line(grp.edges, 7, edge, 1);
      dots(grp.nodes.values(), 3.5, edge, 1);
      line(grp.edges, 5, col, 1);
      dots(grp.nodes.values(), 2.5, col, 1);
      // thin stripe down the middle keeps the "track" read at close zoom
      line(grp.edges, 1.3, id === 3 ? lighten(col, 0.35) : shade(col, 0.62), 0.9);
    }
    // --- player-built: cream/gold ---
    line(builtEdges, 7.5, TRACK_BUILT_EDGE, 0.95);
    dots(builtNodes.values(), 3.75, TRACK_BUILT_EDGE, 0.95);
    line(builtEdges, 5, TRACK_BUILT, 1);
    dots(builtNodes.values(), 2.5, TRACK_BUILT, 1);

    void path; void routeIndex;

    // --- junction nodes ---
    for (const [k, d] of degree) {
      if (d < 3) continue;
      const p = nodes.get(k)!;
      this.junctions.push({ key: k, x: p.x, y: p.y });
      g.lineStyle(2, JUNCTION_RING, 0.95);
      g.strokeEllipse(p.x, p.y, 13, 13 * ISO_Y + 2);
      g.fillStyle(TRACK_RAIL_DARK, 1);
      g.fillEllipse(p.x, p.y, 7, 7 * ISO_Y + 1);
    }
    // rail line ends (terminals)
    for (const [k, d] of degree) {
      if (d !== 1) continue;
      const p = nodes.get(k)!;
      g.lineStyle(2, TRACK_RAIL, 0.9);
      g.lineBetween(p.x - 5, p.y - 3, p.x + 5, p.y + 3);
    }
    // bake
    if (this.ensureRts() && this.rts.length) {
      try {
        for (const r of this.rts) { r.clear(); r.draw(g, -r.x, -r.y); }
        for (const r of this.tiesRts) { r.clear(); r.draw(tg, -r.x, -r.y); }
        g.setVisible(false); tg.setVisible(false);
      } catch (e) {
        console.warn('[render] track bake failed', e);
        g.setVisible(true);
      }
    } else {
      g.setVisible(true);
    }
  }

  private drawPulse(state: SimState, timeSec: number, reducedMotion: boolean): void {
    const g = this.pulse;
    g.clear();
    const route = state.route;
    const train = state.train;
    if (!route || !train) return;
    const path = Array.isArray(route.path) ? route.path : [];
    const routeIndex = Math.max(0, train.routeIndex | 0);
    const progress = Math.max(0, Math.min(1, train.progress || 0));
    const railSet = new Set(route.railLinks ?? []);
    const pulse = reducedMotion ? 0.8 : 0.65 + 0.35 * Math.sin(timeSec * 4);
    const dashOffset = reducedMotion ? 0 : (timeSec * 26) % 14;

    // traversed path: dim overlay
    g.lineStyle(6, TRACK_TRAVERSED, 0.42);
    for (let i = 0; i + 1 < path.length && i < routeIndex; i++) {
      const a = this.center(path[i][0], path[i][1]), b = this.center(path[i + 1][0], path[i + 1][1]);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.fillStyle(TRACK_TRAVERSED, 0.42);
    for (let i = 0; i < Math.min(routeIndex, path.length); i++) {
      const p = this.center(path[i][0], path[i][1]);
      g.fillRect(p.x - 3, p.y - 2, 6, 4);
    }

    for (let i = Math.max(0, routeIndex); i + 1 < path.length; i++) {
      const a = this.center(path[i][0], path[i][1]);
      const b = this.center(path[i + 1][0], path[i + 1][1]);
      const key = edgeKeyOf(path[i], path[i + 1]);
      const free = railSet.has(key);
      const color = free ? TRACK_PLANNED_FREE : TRACK_PLANNED;
      let t0 = 0;
      if (i === routeIndex) t0 = progress;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len, uy = dy / len;
      // soft underlay
      g.lineStyle(7, color, 0.14 * pulse);
      g.lineBetween(a.x + ux * len * t0, a.y + uy * len * t0, b.x, b.y);
      // dashes
      g.lineStyle(3.2, color, 0.55 + 0.45 * pulse);
      const dash = 8, gap = 6;
      let s = t0 * len - dashOffset;
      while (s < len) {
        const e = Math.min(len, s + dash);
        const ss = Math.max(t0 * len, s);
        if (e > ss) g.lineBetween(a.x + ux * ss, a.y + uy * ss, a.x + ux * e, a.y + uy * e);
        s += dash + gap;
      }
      g.fillStyle(color, 0.7 + 0.3 * pulse);
      g.fillRect(b.x - 2.4, b.y - 1.8, 4.8, 3.6);
    }
    // shimmer: a bright bead travelling along the planned segment
    if (!reducedMotion && path.length - 1 > routeIndex) {
      let total = 0;
      const segs: Array<{ ax: number; ay: number; bx: number; by: number; len: number }> = [];
      for (let i = Math.max(0, routeIndex); i + 1 < path.length; i++) {
        const a = this.center(path[i][0], path[i][1]), b = this.center(path[i + 1][0], path[i + 1][1]);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len });
        total += len;
      }
      if (total > 1) {
        let d = (timeSec * 90) % total;
        for (const sg of segs) {
          if (d > sg.len) { d -= sg.len; continue; }
          const t = d / sg.len;
          const x = sg.ax + (sg.bx - sg.ax) * t, y = sg.ay + (sg.by - sg.ay) * t;
          g.fillStyle(TRACK_PLANNED, 0.35); g.fillRect(x - 6, y - 4.5, 12, 9);
          g.fillStyle(0xffffff, 0.95); g.fillRect(x - 2, y - 1.6, 4, 3.2);
          break;
        }
      }
    }
    // junction signal posts: green when the planned route uses the junction, red otherwise
    const aheadKeys = new Set<string>();
    for (let i = Math.max(0, routeIndex); i < path.length; i++) aheadKeys.add(tileKey(path[i][0], path[i][1]));
    let si = 0;
    for (const j of this.junctions) {
      let img = this.signalImgs[si];
      if (!img) {
        img = this.scene.add.image(0, 0, 'signal_post').setScale(TEX_SCALE).setOrigin(0.5, 1).setDepth(this.pulse.depth + 0.4);
        this.signalImgs.push(img);
      }
      img.setPosition(j.x + 9, j.y - 3).setVisible(true);
      const green = aheadKeys.has(j.key);
      const col = green ? 0x6fe07a : 0xff5050;
      const lamp = reducedMotion ? 0.9 : 0.75 + 0.25 * Math.sin(timeSec * 3 + si);
      g.fillStyle(col, 0.25 * lamp); g.fillRect(j.x + 4.5, j.y - 19.5, 9, 9);
      g.fillStyle(col, lamp); g.fillRect(j.x + 7.4, j.y - 16.6, 3.2, 3.2);
      si++;
    }
    for (let i = si; i < this.signalImgs.length; i++) this.signalImgs[i].setVisible(false);

    // plan end marker
    if (path.length > 0 && path.length - 1 > routeIndex) {
      const e = path[path.length - 1];
      const p = this.center(e[0], e[1]);
      g.lineStyle(2, TRACK_PLANNED, 0.6 + 0.4 * pulse);
      g.strokeEllipse(p.x, p.y, HEX_R * 0.9 + pulse * 3, (HEX_R * 0.9 + pulse * 3) * ISO_Y);
    }
    // blocked marker
    if (route.blocked && path.length) {
      const idx = Math.min(path.length - 1, routeIndex + 1);
      const p = this.center(path[idx][0], path[idx][1]);
      g.lineStyle(3, DANGER, 0.5 + 0.5 * pulse);
      g.lineBetween(p.x - 8, p.y - 8, p.x + 8, p.y + 8);
      g.lineBetween(p.x + 8, p.y - 8, p.x - 8, p.y + 8);
    }

    // sapper charges (blinking marker) — hidden if not revealed
    const charges = Array.isArray(route.sapperCharges) ? route.sapperCharges : [];
    let n = 0;
    for (const c of charges) {
      if (!c || !c.revealed) continue;
      let img = this.chargeImgs[n];
      if (!img) {
        img = this.scene.add.image(0, 0, 'charge').setScale(TEX_SCALE).setOrigin(0.5, 0.9);
        img.setDepth(this.pulse.depth + 0.5);
        this.chargeImgs.push(img);
      }
      const p = this.center(c.col, c.row);
      img.setPosition(p.x, p.y).setVisible(true);
      const blink = reducedMotion ? 1 : (Math.sin(timeSec * 10 + n) > 0 ? 1 : 0.55);
      img.setAlpha(blink);
      g.lineStyle(1.5, DANGER, 0.35 + 0.4 * pulse);
      g.strokeEllipse(p.x, p.y, 22, 22 * ISO_Y);
      n++;
    }
    for (let i = n; i < this.chargeImgs.length; i++) this.chargeImgs[i].setVisible(false);
  }
}

function edgeKeyOf(a: [number, number], b: [number, number]): string {
  const ka = tileKey(a[0], a[1]), kb = tileKey(b[0], b[1]);
  return ka < kb ? ka + '|' + kb : kb + '|' + ka;
}
