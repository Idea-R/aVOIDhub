/**
 * Plannable-tile overlay: hover highlight + cost labels for sim.plannableTiles(), the hovered hex
 * ring and the keyboard/gamepad cursor ring. The plannable set is recomputed at most every 100 ms.
 */
import Phaser from 'phaser';
import type { SimApi } from '../sim/api';
import type { SimState } from '../core/types';
import { HEX_R, ISO_Y } from '../core/config';
import { hexCornersP, hexCenterP, pointsFromFlat } from './util';
import { ACCENT, GOOD, FONT, WHITE, DANGER } from './palette';

interface Plannable { col: number; row: number; cost: number; free: boolean; }

export class PlannableLayer {
  public gfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private list: Plannable[] = [];
  private lastCompute = -1;
  public hovered: [number, number] | null = null;
  public cursor: [number, number] | null = null;
  public cursorVisible = false;
  private cursorShownAt = 0;

  constructor(private scene: Phaser.Scene, depth: number) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(depth);
  }

  destroy(): void {
    this.gfx.destroy();
    for (const l of this.labels) l.destroy();
    this.labels = [];
  }

  showCursor(): void { this.cursorVisible = true; this.cursorShownAt = this.scene.time.now; }

  /** Is the tile currently in the plannable set? */
  isPlannable(col: number, row: number): Plannable | null {
    for (const p of this.list) if (p.col === col && p.row === row) return p;
    return null;
  }

  update(state: SimState, sim: SimApi, nowMs: number, active: boolean, zoom: number, reducedMotion: boolean): void {
    const g = this.gfx;
    g.clear();
    if (this.cursorVisible && nowMs - this.cursorShownAt > 6000 && !active) this.cursorVisible = false;
    const show = active || this.cursorVisible;
    if (!show || state.phase === 'title') {
      this.list.length = 0;
      for (const l of this.labels) l.setVisible(false);
      return;
    }
    if (nowMs - this.lastCompute > 100 || this.lastCompute < 0) {
      this.lastCompute = nowMs;
      try {
        const raw = sim.plannableTiles();
        this.list = Array.isArray(raw) ? raw.filter(p => p && Number.isFinite(p.col) && Number.isFinite(p.row)) : [];
      } catch { this.list = []; }
    }
    const pulse = reducedMotion ? 0.7 : 0.6 + 0.4 * Math.sin(nowMs / 220);
    const showLabels = zoom >= 0.6;
    let li = 0;
    for (const p of this.list) {
      const color = p.free ? GOOD : ACCENT;
      const pts = pointsFromFlat(hexCornersP(p.col, p.row, HEX_R - 2.5));
      g.fillStyle(color, 0.13);
      g.fillPoints(pts, true);
      g.lineStyle(1.5, color, 0.55);
      g.strokePoints(pts, true, true);
      if (showLabels) {
        let t = this.labels[li];
        if (!t) {
          t = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: '#ffffff', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2 });
          t.setOrigin(0.5, 0.5).setDepth(this.gfx.depth + 0.5);
          this.labels.push(t);
        }
        const c = hexCenterP(p.col, p.row);
        const txt = p.free ? 'free' : String(Math.round(p.cost));
        const col = p.free ? '#8fe0a0' : '#f1dfae';
        // Text.setColor re-rasterises the canvas texture every call; only touch it on change.
        if (t.text !== txt) t.setText(txt);
        if (t.getData('col') !== col) { t.setColor(col); t.setData('col', col); }
        t.setPosition(c.x, c.y + 1).setVisible(true);
        li++;
      }
    }
    for (let i = li; i < this.labels.length; i++) this.labels[i].setVisible(false);

    // hovered hex ring
    if (this.hovered && active) {
      const [c, r] = this.hovered;
      const tile = sim.tileAt(c, r);
      if (tile) {
        const blocked = tile.void || tile.terrain === 'mountain';
        const pts = pointsFromFlat(hexCornersP(c, r, HEX_R - 1.5));
        g.lineStyle(2, blocked ? DANGER : WHITE, 0.45 + 0.4 * pulse);
        g.strokePoints(pts, true, true);
        const cc = hexCenterP(c, r);
        g.lineStyle(1, WHITE, 0.25 * pulse);
        g.strokeEllipse(cc.x, cc.y, 12 + pulse * 4, (12 + pulse * 4) * ISO_Y);
      }
    }
    // keyboard cursor ring
    if (this.cursorVisible && this.cursor) {
      const [c, r] = this.cursor;
      const pts = pointsFromFlat(hexCornersP(c, r, HEX_R - 4));
      g.lineStyle(3, ACCENT, 0.5 + 0.5 * pulse);
      g.strokePoints(pts, true, true);
      g.lineStyle(1, WHITE, 0.6);
      g.strokePoints(pointsFromFlat(hexCornersP(c, r, HEX_R - 7)), true, true);
    }
  }
}
