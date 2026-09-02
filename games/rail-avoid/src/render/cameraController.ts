/**
 * Camera follow / pan / zoom and canvas pointer input. Only pointer input lives here; the UI
 * engineer owns global keys.
 */
import Phaser from 'phaser';
import { clamp } from './util';

export interface CameraCallbacks {
  onClick(sx: number, sy: number): void;
  onHover(sx: number, sy: number): void;
  onLeave(): void;
}

export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2.2;

export class CameraController {
  public following = true;
  public pointerOver = false;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private down = false;
  private dragging = false;
  private button = 0;
  private pinchDist = -1;
  private bounds = { x0: 0, y0: 0, x1: 100, y1: 100 };
  private margin = 320;

  constructor(private scene: Phaser.Scene, private cb: CameraCallbacks) {
    const input = scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    input.on('wheel', this.onWheel, this);
    input.on('gameout', () => { this.pointerOver = false; this.down = false; this.dragging = false; this.cb.onLeave(); });
    input.on('gameover', () => { this.pointerOver = true; });
    if (input.addPointer) { try { input.addPointer(1); } catch { /* ignore */ } }
  }

  get cam(): Phaser.Cameras.Scene2D.Camera { return this.scene.cameras.main; }
  /** True while the pointer drags the camera (left-drag past the threshold, right/middle drag, pinch). */
  get isDragging(): boolean { return this.dragging; }
  /** Last known pointer position in screen px. */
  get pointer(): { x: number; y: number } { return { x: this.lastX, y: this.lastY }; }

  destroy(): void {
    const input = this.scene.input;
    if (!input) return;
    input.off('pointerdown', this.onDown, this);
    input.off('pointermove', this.onMove, this);
    input.off('pointerup', this.onUp, this);
    input.off('pointerupoutside', this.onUp, this);
    input.off('wheel', this.onWheel, this);
  }

  setBounds(x0: number, y0: number, x1: number, y1: number): void {
    this.bounds = { x0, y0, x1, y1 };
    this.applyBounds();
  }
  applyBounds(): void {
    const b = this.bounds, m = this.margin;
    this.cam.setBounds(b.x0 - m, b.y0 - m, (b.x1 - b.x0) + m * 2, (b.y1 - b.y0) + m * 2);
  }

  /**
   * Where the camera centre ends up when asked to centre on (x, y) at `zoom` with the world bounds
   * applied (Phaser clamps the scroll in preRender; when the view is wider than the bounds it centres).
   * Cinematics aim their final move here so the hand-over to follow mode does not jump.
   */
  restCenter(x: number, y: number, zoom: number): { x: number; y: number } {
    const b = this.bounds, m = this.margin;
    const bx = b.x0 - m, by = b.y0 - m, bw = (b.x1 - b.x0) + m * 2, bh = (b.y1 - b.y0) + m * 2;
    const z = Math.max(0.05, zoom || 1);
    const hw = this.cam.width / 2 / z, hh = this.cam.height / 2 / z;
    const cx = hw * 2 >= bw ? bx + bw / 2 : clamp(x, bx + hw, bx + bw - hw);
    const cy = hh * 2 >= bh ? by + bh / 2 : clamp(y, by + hh, by + bh - hh);
    return { x: cx, y: cy };
  }

  getZoom(): number { return this.cam.zoom; }

  setZoom(z: number, aroundX?: number, aroundY?: number): void {
    const cam = this.cam;
    const nz = clamp(Number.isFinite(z) ? z : 1, ZOOM_MIN, ZOOM_MAX);
    if (aroundX === undefined || aroundY === undefined) {
      cam.setZoom(nz);
      return;
    }
    const before = cam.getWorldPoint(aroundX, aroundY);
    cam.setZoom(nz);
    // Phaser recomputes the matrix lazily; force it so the second getWorldPoint is correct
    cam.preRender();
    const after = cam.getWorldPoint(aroundX, aroundY);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  zoomBy(factor: number, aroundX?: number, aroundY?: number): void {
    this.setZoom(this.cam.zoom * factor, aroundX, aroundY);
  }

  panBy(dx: number, dy: number): void {
    this.following = false;
    this.cam.scrollX += dx / this.cam.zoom;
    this.cam.scrollY += dy / this.cam.zoom;
    this.clampScroll();
  }

  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, y);
    this.clampScroll();
  }

  /**
   * Keep the scroll inside the camera bounds immediately. Phaser only clamps in preRender, so
   * without this any camera-derived math done during update() (hit tests, screenToHex, hexToScreen)
   * would see an out-of-bounds scroll whenever the camera is pinned at a map edge.
   */
  private clampScroll(): void {
    const cam = this.cam;
    if (!cam.useBounds) return;
    cam.scrollX = cam.clampX(cam.scrollX);
    cam.scrollY = cam.clampY(cam.scrollY);
  }

  /** Smoothly follow a projected world point. */
  follow(x: number, y: number, dt: number, snap = false): void {
    const cam = this.cam;
    const tx = x - cam.width * 0.5, ty = y - cam.height * 0.5;
    if (snap) { cam.scrollX = tx; cam.scrollY = ty; this.clampScroll(); return; }
    const f = 1 - Math.pow(1 - 0.08, Math.max(0.001, dt) * 60);
    cam.scrollX += (tx - cam.scrollX) * f;
    cam.scrollY += (ty - cam.scrollY) * f;
    this.clampScroll();
  }

  getPointer(): { x: number; y: number } | null {
    const p = this.scene.input.activePointer;
    if (!p) return null;
    return { x: p.x, y: p.y };
  }

  // ---------------- input ----------------
  private onDown(p: Phaser.Input.Pointer): void {
    this.pointerOver = true;
    this.down = true;
    this.dragging = false;
    this.button = p.button ?? 0;
    this.downX = p.x; this.downY = p.y; this.lastX = p.x; this.lastY = p.y;
    if (this.button === 1 || this.button === 2 || p.rightButtonDown() || p.middleButtonDown()) {
      this.dragging = true;
      this.following = false;
    }
    // touch pinch start
    const p2 = this.scene.input.pointer2;
    if (p2 && p2.isDown && p.id !== p2.id) {
      this.pinchDist = Phaser.Math.Distance.Between(p.x, p.y, p2.x, p2.y);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    this.pointerOver = true;
    const p1 = this.scene.input.pointer1, p2 = this.scene.input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchDist > 0 && d > 0) {
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        this.zoomBy(d / this.pinchDist, mx, my);
      }
      this.pinchDist = d;
      this.dragging = true;
      this.following = false;
      return;
    }
    if (this.down && p.isDown) {
      const dx = p.x - this.lastX, dy = p.y - this.lastY;
      if (!this.dragging) {
        if (Phaser.Math.Distance.Between(p.x, p.y, this.downX, this.downY) > 6) {
          this.dragging = true;
          this.following = false;
        }
      }
      if (this.dragging) {
        this.cam.scrollX -= dx / this.cam.zoom;
        this.cam.scrollY -= dy / this.cam.zoom;
        this.clampScroll();
      }
      this.lastX = p.x; this.lastY = p.y;
      return;
    }
    this.lastX = p.x; this.lastY = p.y;
    this.cb.onHover(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const wasDown = this.down, wasDrag = this.dragging, btn = this.button;
    this.down = false; this.dragging = false; this.pinchDist = -1;
    if (wasDown && !wasDrag && btn === 0) {
      try { this.cb.onClick(p.x, p.y); } catch (e) { console.warn('[render] click handler', e); }
    }
  }

  private onWheel(p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number): void {
    if (!Number.isFinite(dy) || dy === 0) return;
    const factor = Math.exp(-dy * 0.0012);
    this.zoomBy(factor, p.x, p.y);
  }
}
