/**
 * Line overlays for the three pre-laid lines ("Plan 3 — Three Lines"):
 *
 * - Junction signage: when the train is stopped at a junction (stopReason === 'junction') or the plan
 *   ends on a junction node while the train is not moving, every branch option from
 *   sim.junctionOptions() gets a run of coloured chevrons along its first two hexes and a floating
 *   in-world label ("Northern Line → Ironhold · 7 hex", or "dead end") in the line colour. Labels
 *   and chevron corridors are clickable (GameScene calls hitTest → sim.planTile on the option).
 *   Everything fades out while the train moves.
 * - Line hover: hovering any pre-laid rail hex highlights the contiguous line segment through it up
 *   to the next junctions / line ends (BFS over railLinks, capped at 40 edges) in the line colour,
 *   with a small chip naming the line.
 *
 * The sim's junctionOptions() may not exist until the worldgen rewrite lands; a local fallback walks
 * railLinks to produce the same shape so the signage can be verified either way.
 */
import Phaser from 'phaser';
import type { SimApi } from '../sim/api';
import type { SimState } from '../core/types';
import { ISO_Y, LINE_NAMES, LINE_COLORS } from '../core/config';
import { tileKey } from '../core/hex';
import { hexCenterP, cssColor, expFactor, clamp, lighten } from './util';
import { FONT } from './palette';
import { safeParseKey } from './terrain';
import { lineColor } from './trackLayer';

export interface JunctionOption {
  col: number; row: number; line: number; lineName: string;
  next: { id: string; name: string; type: string; distance: number } | null;
}

interface Pt { x: number; y: number; }
interface SignView {
  idx: number;
  color: number;
  pts: Pt[];            // junction → first hex → second hex (projected)
  labelAt: Pt;
  alignRight: boolean;  // label grows leftwards (branch heads west)
  rect: { x0: number; y0: number; x1: number; y1: number };
  w: number; h: number; // measured label size (world px at the current label scale)
}
interface HoverEdge { ax: number; ay: number; bx: number; by: number; color: number; }

const OPTIONS_MS = 250;      // junctionOptions() poll while visible
const HOVER_CAP = 40;        // BFS edge cap for the line hover
const LABEL_LOD_ZOOM = 0.45; // below this the signage labels stay hidden (chevrons still show)

export class LineLayer {
  private hoverGfx: Phaser.GameObjects.Graphics;
  private signGfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private chip: Phaser.GameObjects.Text;
  private signDepth: number;

  // rail graph (rebuilt when railLinks / railLines / seed change)
  private adj = new Map<string, string[]>();
  private lines: Record<string, number> = {};
  private graphKey = '';

  // signage state
  private options: JunctionOption[] = [];
  private views: SignView[] = [];
  private optKey = '';
  private lastOptAt = -1;
  private fade = 0;
  private hoverOpt = -1;
  private viewScale = 1;

  // hover state
  private hoverKey = '';
  private hoverEdges: HoverEdge[] = [];
  private hoverLine = -1;
  private hoverEnds: Array<{ x: number; y: number; color: number }> = [];

  constructor(private scene: Phaser.Scene, hoverDepth: number, signDepth: number) {
    this.signDepth = signDepth;
    this.hoverGfx = scene.add.graphics().setDepth(hoverDepth);
    this.signGfx = scene.add.graphics().setDepth(signDepth);
    this.chip = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#ffffff', resolution: 2,
      backgroundColor: 'rgba(11,14,26,0.86)', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setDepth(signDepth + 0.4).setVisible(false);
    this.chip.setLetterSpacing(0.5);
  }

  destroy(): void {
    this.hoverGfx.destroy(); this.signGfx.destroy(); this.chip.destroy();
    for (const l of this.labels) l.destroy();
    this.labels = [];
  }

  /** Force a graph + options refresh (new run). */
  invalidate(): void {
    this.graphKey = ''; this.optKey = ''; this.hoverKey = ''; this.hoverEdges = []; this.hoverEnds = [];
    this.options = []; this.views = []; this.fade = 0; this.hoverOpt = -1;
  }

  setHoverOption(idx: number): void { this.hoverOpt = idx; }
  /** Option index under the pointer, or -1. */
  hoverOption(): number { return this.hoverOpt; }
  /** Currently displayed branch options (empty while hidden). */
  currentOptions(): JunctionOption[] { return this.fade > 0.5 ? this.options : []; }

  // ------------------------------------------------------------------ graph
  private ensureGraph(state: SimState): void {
    const route = state.route;
    const rail = Array.isArray(route?.railLinks) ? route.railLinks : [];
    const lines = route?.railLines && typeof route.railLines === 'object' ? route.railLines : {};
    const key = `${rail.length}|${Object.keys(lines).length}|${state.seed}`;
    if (key === this.graphKey) return;
    this.graphKey = key;
    this.adj.clear();
    this.lines = lines;
    for (const k of rail) {
      const i = k.indexOf('|');
      if (i < 0) continue;
      const a = k.slice(0, i), b = k.slice(i + 1);
      (this.adj.get(a) ?? this.adj.set(a, []).get(a)!).push(b);
      (this.adj.get(b) ?? this.adj.set(b, []).get(b)!).push(a);
    }
    this.hoverKey = ''; this.optKey = '';
  }

  private edgeLine(a: string, b: string): number {
    const k = a < b ? a + '|' + b : b + '|' + a;
    const v = this.lines[k];
    return typeof v === 'number' && v >= 0 && v < LINE_COLORS.length ? v | 0 : 0;
  }
  isJunction(col: number, row: number): boolean { return (this.adj.get(tileKey(col, row))?.length ?? 0) >= 3; }

  // ------------------------------------------------------------------ frame
  update(state: SimState, sim: SimApi, nowMs: number, reducedMotion: boolean, zoom: number,
    hoveredHex: [number, number] | null, dt: number): void {
    this.ensureGraph(state);
    this.updateSignage(state, sim, nowMs, reducedMotion, zoom, dt);
    this.updateHover(state, hoveredHex, nowMs, reducedMotion, zoom);
  }

  // ------------------------------------------------------------------ signage
  private wantSignage(state: SimState): [number, number] | null {
    if (!state || state.phase === 'title') return null;
    const t = state.train, path = state.route?.path;
    if (!t || !Array.isArray(path) || !path.length) return null;
    if (t.moving || t.reversing) return null;
    const end = path[path.length - 1];
    if (t.stopped && t.stopReason === 'junction') return [end[0], end[1]];
    if (this.isJunction(end[0], end[1])) return [end[0], end[1]];
    return null;
  }

  private fetchOptions(state: SimState, sim: SimApi, junction: [number, number]): JunctionOption[] {
    let raw: unknown = null;
    try {
      const fn = (sim as Partial<SimApi>).junctionOptions;
      if (typeof fn === 'function') raw = fn.call(sim);
    } catch (e) { console.warn('[render] junctionOptions', e); raw = null; }
    let list: JunctionOption[] = [];
    if (Array.isArray(raw)) {
      for (const o of raw as JunctionOption[]) {
        if (!o || !Number.isFinite(o.col) || !Number.isFinite(o.row)) continue;
        const line = typeof o.line === 'number' && o.line >= 0 && o.line < LINE_COLORS.length ? o.line | 0 : 0;
        list.push({ col: o.col | 0, row: o.row | 0, line, lineName: typeof o.lineName === 'string' && o.lineName ? o.lineName : LINE_NAMES[line], next: o.next && typeof o.next === 'object' ? o.next : null });
      }
    } else list = this.fallbackOptions(state, junction);
    return list;
  }

  /** Same shape as sim.junctionOptions(), derived from railLinks alone (used until the sim provides it). */
  private fallbackOptions(state: SimState, junction: [number, number]): JunctionOption[] {
    const path = state.route.path;
    const endKey = tileKey(junction[0], junction[1]);
    const prev = path.length >= 2 ? tileKey(path[path.length - 2][0], path[path.length - 2][1]) : '';
    const onPath = new Set<string>();
    for (let i = Math.max(0, state.train.routeIndex - 1); i < path.length; i++) onPath.add(tileKey(path[i][0], path[i][1]));
    const byTile = new Map<string, SimState['settlements'][number]>();
    for (const s of state.settlements ?? []) byTile.set(tileKey(s.col, s.row), s);
    const out: JunctionOption[] = [];
    for (const n of this.adj.get(endKey) ?? []) {
      if (n === prev || onPath.has(n)) continue;
      const p = safeParseKey(n);
      if (!p) continue;
      const tile = state.tiles[p[1] * state.mapW + p[0]];
      if (!tile || tile.void) continue;
      const line = this.edgeLine(endKey, n);
      // walk the branch to the next settlement (≤ 40 hexes, stops at junctions only if a settlement sits there)
      let next: JunctionOption['next'] = null;
      let from = endKey, cur = n;
      for (let steps = 1; steps <= 40; steps++) {
        const st = byTile.get(cur);
        if (st && !st.consumed) { next = { id: st.id, name: st.name, type: st.type, distance: steps }; break; }
        const a = this.adj.get(cur) ?? [];
        if (a.length !== 2) break;
        const nx = a[0] === from ? a[1] : a[0];
        from = cur; cur = nx;
      }
      out.push({ col: p[0], row: p[1], line, lineName: LINE_NAMES[line], next });
    }
    return out;
  }

  private buildViews(junction: [number, number], zoom: number): void {
    const J = hexCenterP(junction[0], junction[1]);
    const jKey = tileKey(junction[0], junction[1]);
    this.views = [];
    const labelScale = clamp(0.9 / Math.max(0.2, zoom), 1, 2.2);
    this.viewScale = labelScale;
    for (let i = 0; i < this.options.length; i++) {
      const o = this.options[i];
      const aKey = tileKey(o.col, o.row);
      const A = hexCenterP(o.col, o.row);
      // second hex: continue along the branch away from the junction (prefer the same line id)
      let B: Pt | null = null;
      const nbrs = (this.adj.get(aKey) ?? []).filter(k => k !== jKey);
      let pick = nbrs.find(k => this.edgeLine(aKey, k) === o.line) ?? nbrs[0];
      if (pick) { const p = safeParseKey(pick); if (p) B = hexCenterP(p[0], p[1]); }
      if (!B) B = { x: A.x + (A.x - J.x), y: A.y + (A.y - J.y) };
      const pts = [J, A, B];
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const alignRight = ux < -0.2;
      // perpendicular offset, always to the upper side of the branch so the label floats beside the track
      let nx = -uy, ny = ux;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const labelAt = { x: B.x + ux * 10 + nx * 12, y: B.y + uy * 10 * ISO_Y + ny * 12 - 6 };
      const w = 120 * labelScale, h = 15 * labelScale;
      const rect = alignRight
        ? { x0: labelAt.x - w, y0: labelAt.y - h / 2, x1: labelAt.x, y1: labelAt.y + h / 2 }
        : { x0: labelAt.x, y0: labelAt.y - h / 2, x1: labelAt.x + w, y1: labelAt.y + h / 2 };
      this.views.push({ idx: i, color: lineColor(o.line), pts, labelAt, alignRight, rect, w, h });
      void pick;
    }
    this.layoutLabels(labelScale);
  }

  /** Label text object for option i (labels are indexed by option, created lazily). */
  private ensureLabel(i: number): Phaser.GameObjects.Text {
    let t = this.labels[i];
    if (!t) {
      t = this.scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#ffffff', resolution: 2,
        stroke: '#0b0e1a', strokeThickness: 3, backgroundColor: 'rgba(11,14,26,0.82)', padding: { x: 6, y: 3 },
      }).setDepth(this.signDepth + 0.5).setVisible(false);
      t.setLetterSpacing(0.4);
      this.labels[i] = t;
    }
    return t;
  }

  private static labelText(o: JunctionOption): string {
    return o.next
      ? `${o.lineName} → ${o.next.name} · ${Math.max(0, o.next.distance | 0)} hex`
      : `${o.lineName} → dead end`;
  }

  private static rectFor(at: Pt, alignRight: boolean, w: number, h: number): SignView['rect'] {
    return alignRight
      ? { x0: at.x - w, y0: at.y - h / 2, x1: at.x, y1: at.y + h / 2 }
      : { x0: at.x, y0: at.y - h / 2, x1: at.x + w, y1: at.y + h / 2 };
  }

  /**
   * Crossroads hubs offer up to six branches whose second hexes sit close together, so label anchors
   * collide. Labels that would overlap are spread vertically around their mean anchor (in y order),
   * so every branch keeps a readable label on its outgoing side; the leader from the second hex
   * still points at each label. Uses the real text metrics.
   */
  private layoutLabels(labelScale: number): void {
    const gap = 4 * labelScale;
    for (const v of this.views) {
      const o = this.options[v.idx];
      if (!o) continue;
      const t = this.ensureLabel(v.idx);
      const txt = LineLayer.labelText(o);
      if (t.text !== txt) t.setText(txt);
      v.w = t.width * labelScale; v.h = t.height * labelScale;
      v.rect = LineLayer.rectFor(v.labelAt, v.alignRight, v.w, v.h);
    }
    const tol = gap * 0.9;
    const hit = (a: SignView, b: SignView) =>
      a.rect.x0 < b.rect.x1 + tol && a.rect.x1 > b.rect.x0 - tol && a.rect.y0 < b.rect.y1 + tol && a.rect.y1 > b.rect.y0 - tol;
    for (let pass = 0; pass < 4; pass++) {
      const sorted = this.views.slice().sort((a, b) => a.labelAt.y - b.labelAt.y);
      const groups: SignView[][] = [];
      for (const v of sorted) {
        const g = groups.find(gr => gr.some(p => hit(p, v)));
        if (g) g.push(v); else groups.push([v]);
      }
      let moved = false;
      for (const g of groups) {
        if (g.length < 2) continue;
        moved = true;
        let total = -gap, mean = 0;
        for (const v of g) { total += v.h + gap; mean += v.labelAt.y; }
        let y = mean / g.length - total / 2;
        for (const v of g) {
          v.labelAt.y = y + v.h / 2;
          v.rect = LineLayer.rectFor(v.labelAt, v.alignRight, v.w, v.h);
          y += v.h + gap;
        }
      }
      if (!moved) break;
    }
  }

  private updateSignage(state: SimState, sim: SimApi, nowMs: number, reducedMotion: boolean, zoom: number, dt: number): void {
    const g = this.signGfx;
    const junction = this.wantSignage(state);
    if (junction) {
      const path = state.route.path;
      const key = `${junction[0]},${junction[1]}|${path.length}|${state.train.routeIndex}|${state.train.stopReason}`;
      if (key !== this.optKey || nowMs - this.lastOptAt > OPTIONS_MS) {
        const changed = key !== this.optKey;
        this.optKey = key; this.lastOptAt = nowMs;
        const list = this.fetchOptions(state, sim, junction);
        const sig = list.map(o => `${o.col},${o.row},${o.line},${o.next?.id ?? ''},${o.next?.distance ?? ''}`).join(';');
        const prevSig = this.options.map(o => `${o.col},${o.row},${o.line},${o.next?.id ?? ''},${o.next?.distance ?? ''}`).join(';');
        if (changed || sig !== prevSig) { this.options = list; this.buildViews(junction, zoom); }
      }
    }
    const target = junction && this.options.length ? 1 : 0;
    const k = reducedMotion ? 1 : expFactor(target ? 10 : 14, dt);
    this.fade += (target - this.fade) * k;
    if (Math.abs(this.fade - target) < 0.004) this.fade = target;
    if (this.fade <= 0.004) {
      g.clear();
      for (const l of this.labels) l.setVisible(false);
      if (!junction) { this.options = []; this.views = []; this.optKey = ''; }
      this.hoverOpt = -1;
      return;
    }
    // label scale follows the zoom (rebuild the label anchors when it drifts)
    const labelScale = clamp(0.9 / Math.max(0.2, zoom), 1, 2.2);
    if (junction && this.views.length && Math.abs(this.viewScale - labelScale) > 0.05) this.buildViews(junction, zoom);

    g.clear();
    const f = this.fade;
    const tSec = nowMs / 1000;
    const showLabels = zoom >= LABEL_LOD_ZOOM;
    let li = 0;
    for (const v of this.views) {
      const o = this.options[v.idx];
      if (!o) continue;
      const hovered = v.idx === this.hoverOpt;
      const pulse = reducedMotion ? 0.8 : 0.6 + 0.4 * Math.sin(tSec * 3.2 + v.idx * 1.7);
      const col = hovered ? lighten(v.color, 0.35) : v.color;
      const bright = lighten(v.color, hovered ? 0.8 : 0.62);
      // soft underlay along the two hexes
      g.lineStyle(7, col, (0.14 + 0.1 * pulse) * f);
      for (let i = 0; i + 1 < v.pts.length; i++) g.lineBetween(v.pts[i].x, v.pts[i].y, v.pts[i + 1].x, v.pts[i + 1].y);
      // travelling chevrons
      let dist = 0;
      const phase = reducedMotion ? 0 : (tSec * 22) % 14;
      for (let i = 0; i + 1 < v.pts.length; i++) {
        const a = v.pts[i], b = v.pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        for (let s = 12 + phase; s < len - 6; s += 14) {
          const x = a.x + ux * s, y = a.y + uy * s;
          const along = dist + s;
          const wave = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(tSec * 5 - along * 0.09);
          const size = hovered ? 5.4 : 4.8;
          const x0 = x - ux * size, y0 = y - uy * size;
          g.lineStyle(3.4, 0x0b0e1a, 0.75 * f);
          g.lineBetween(x0 - px * size, y0 - py * size * ISO_Y, x, y);
          g.lineBetween(x0 + px * size, y0 + py * size * ISO_Y, x, y);
          g.lineStyle(1.8, bright, (0.6 + 0.4 * wave) * f);
          g.lineBetween(x0 - px * size, y0 - py * size * ISO_Y, x, y);
          g.lineBetween(x0 + px * size, y0 + py * size * ISO_Y, x, y);
        }
        dist += len;
      }
      // branch tile ring on the first hex
      const A = v.pts[1];
      g.lineStyle(hovered ? 2.4 : 1.6, col, (0.5 + 0.4 * pulse) * f);
      g.strokeEllipse(A.x, A.y, 20 + pulse * 3, (20 + pulse * 3) * ISO_Y);
      // label (indexed by option; anchors were staggered in layoutLabels so hub labels never overlap)
      if (!showLabels) continue;
      const t = this.ensureLabel(v.idx);
      const txt = LineLayer.labelText(o);
      if (t.text !== txt) t.setText(txt);
      const css = cssColor(hovered ? lighten(v.color, 0.45) : v.color);
      if (t.getData('col') !== css) { t.setColor(css); t.setData('col', css); }
      t.setOrigin(v.alignRight ? 1 : 0, 0.5);
      const sc = labelScale * (hovered ? 1.08 : 1);
      t.setScale(sc).setPosition(v.labelAt.x, v.labelAt.y).setAlpha((0.85 + 0.15 * pulse) * f).setVisible(true);
      // keep the hit rect in sync with the real text width
      const w = t.width * sc, h = t.height * sc;
      v.rect = LineLayer.rectFor(v.labelAt, v.alignRight, w, h);
      // leader from the second hex to the label and a hover outline
      g.lineStyle(1, col, 0.5 * f);
      g.lineBetween(v.pts[2].x, v.pts[2].y, v.alignRight ? v.rect.x1 : v.rect.x0, v.labelAt.y);
      if (hovered) {
        g.lineStyle(1.2, 0xffffff, 0.8 * f);
        g.strokeRect(v.rect.x0 - 1, v.rect.y0 - 1, w + 2, h + 2);
      }
      li++;
    }
    for (let i = 0; i < this.labels.length; i++) if (!showLabels || i >= this.views.length) this.labels[i].setVisible(false);
    void li;
  }

  /** Branch option under a projected world point (label rectangle or the chevron corridor), or null. */
  hitTest(px: number, py: number, zoom: number): { index: number; option: JunctionOption } | null {
    if (this.fade < 0.5) return null;
    const corridor = Math.max(9, 12 / Math.max(0.2, zoom));
    let best = -1, bd = Infinity;
    for (const v of this.views) {
      const r = v.rect;
      if (this.labels.length && px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) return { index: v.idx, option: this.options[v.idx] };
      for (let i = 0; i + 1 < v.pts.length; i++) {
        const d = segDist(px, py, v.pts[i].x, v.pts[i].y, v.pts[i + 1].x, v.pts[i + 1].y);
        if (d < corridor && d < bd) { bd = d; best = v.idx; }
      }
    }
    return best >= 0 && this.options[best] ? { index: best, option: this.options[best] } : null;
  }

  // ------------------------------------------------------------------ hover
  private computeHover(key: string): void {
    this.hoverEdges = []; this.hoverEnds = []; this.hoverLine = -1;
    const first = this.adj.get(key);
    if (!first || !first.length) return;
    const p0 = safeParseKey(key);
    if (!p0) return;
    let count = 0;
    const seenEdges = new Set<string>();
    for (const n0 of first) {
      let prev = key, cur = n0;
      while (count < HOVER_CAP) {
        const ek = prev < cur ? prev + '|' + cur : cur + '|' + prev;
        if (seenEdges.has(ek)) break;
        seenEdges.add(ek);
        const pa = safeParseKey(prev), pb = safeParseKey(cur);
        if (!pa || !pb) break;
        const a = hexCenterP(pa[0], pa[1]), b = hexCenterP(pb[0], pb[1]);
        const line = this.edgeLine(prev, cur);
        if (this.hoverLine < 0) this.hoverLine = line;
        this.hoverEdges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, color: lineColor(line) });
        count++;
        const a2 = this.adj.get(cur) ?? [];
        if (a2.length !== 2) { this.hoverEnds.push({ x: b.x, y: b.y, color: lineColor(line) }); break; }
        const next = a2[0] === prev ? a2[1] : a2[0];
        prev = cur; cur = next;
      }
    }
  }

  private updateHover(state: SimState, hex: [number, number] | null, nowMs: number, reducedMotion: boolean, zoom: number): void {
    const g = this.hoverGfx;
    const key = hex && state.phase !== 'title' ? tileKey(hex[0], hex[1]) : '';
    if (key !== this.hoverKey) {
      this.hoverKey = key;
      if (key) this.computeHover(key); else { this.hoverEdges = []; this.hoverEnds = []; this.hoverLine = -1; }
    }
    if (!this.hoverEdges.length) { g.clear(); this.chip.setVisible(false); return; }
    g.clear();
    const pulse = reducedMotion ? 0.8 : 0.7 + 0.3 * Math.sin(nowMs / 240);
    for (const e of this.hoverEdges) { g.lineStyle(14, e.color, 0.3 * pulse); g.lineBetween(e.ax, e.ay, e.bx, e.by); }
    for (const e of this.hoverEdges) { g.lineStyle(5, 0x0b0e1a, 0.55); g.lineBetween(e.ax, e.ay, e.bx, e.by); }
    for (const e of this.hoverEdges) { g.lineStyle(2.8, lighten(e.color, 0.6), 0.95); g.lineBetween(e.ax, e.ay, e.bx, e.by); }
    for (const e of this.hoverEnds) {
      g.lineStyle(2.2, lighten(e.color, 0.4), 0.95);
      g.strokeEllipse(e.x, e.y, 15 + pulse * 2, (15 + pulse * 2) * ISO_Y);
    }
    // line name chip above the hovered hex
    if (hex && zoom >= 0.4) {
      const c = hexCenterP(hex[0], hex[1]);
      const line = this.hoverLine >= 0 ? this.hoverLine : 0;
      const txt = LINE_NAMES[line] ?? LINE_NAMES[0];
      if (this.chip.text !== txt) this.chip.setText(txt);
      const css = cssColor(lineColor(line));
      if (this.chip.getData('col') !== css) { this.chip.setColor(css); this.chip.setData('col', css); }
      this.chip.setScale(clamp(0.9 / Math.max(0.2, zoom), 1, 2)).setPosition(c.x, c.y - 14).setVisible(true);
    } else this.chip.setVisible(false);
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t, y = ay + dy * t;
  return Math.hypot(px - x, py - y);
}
