/** Small render helpers: projection, colors, easing. */
import Phaser from 'phaser';
import { HEX_R, ISO_Y } from '../core/config';
import { hexToWorld, hexCorners } from '../core/hex';

export interface Pt { x: number; y: number; }

/** Projected screen-world angle of an unprojected heading. */
export function projAngle(a: number): number {
  return Math.atan2(Math.sin(a) * ISO_Y, Math.cos(a));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function smoothstep(t: number): number { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Exponential smoothing factor for a per-second rate over dt. */
export function expFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
export function fromRgb(r: number, g: number, b: number): number {
  return (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255);
}
export function mixColor(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
export function shade(c: number, f: number): number {
  const [r, g, b] = rgb(c);
  return fromRgb(r * f, g * f, b * f);
}
export function lighten(c: number, t: number): number { return mixColor(c, 0xffffff, t); }
export function cssColor(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }

/** Projected centre of a hex. */
export function hexCenterP(col: number, row: number): Pt {
  const w = hexToWorld(col, row);
  return { x: w.x, y: w.y * ISO_Y };
}

/** Projected corner list (flat array x0,y0,x1,y1...) of a hex. */
export function hexCornersP(col: number, row: number, r: number = HEX_R): number[] {
  const w = hexToWorld(col, row);
  const c = hexCorners(w.x, w.y, r);
  const out: number[] = [];
  for (const [x, y] of c) out.push(x, y * ISO_Y);
  return out;
}

export function pointsFromFlat(flat: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cheap deterministic pseudo-random from an integer. */
export function hashInt(n: number): number {
  let h = (n * 2654435761) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * Cheap filled disc: an 8-triangle fan. Phaser Graphics fillCircle/fillEllipse run earcut on a
 * 32-point path every frame, which dominates frame time when used in bulk.
 */
export function disc(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number = rx, n = 8): void {
  let px = x + rx, py = y;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const nx = x + Math.cos(a) * rx, ny = y + Math.sin(a) * ry;
    g.fillTriangle(x, y, px, py, nx, ny);
    px = nx; py = ny;
  }
}

export function fmtRes(key: string, delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${Math.round(delta)} ${key}`;
}
