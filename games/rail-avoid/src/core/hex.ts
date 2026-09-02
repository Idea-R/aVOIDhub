/** Flat-top hex math. Storage: even-q offset (col,row). Math: axial (q,r). */
import { HEX_R, ISO_Y } from './config';

export interface Axial { q: number; r: number; }

export function offsetToAxial(col: number, row: number): Axial {
  return { q: col, r: row - (col + (col & 1)) / 2 };
}
export function axialToOffset(q: number, r: number): [number, number] {
  return [q, r + (q + (q & 1)) / 2];
}

/** World px (unprojected) of a hex centre. */
export function hexToWorld(col: number, row: number): { x: number; y: number } {
  const { q, r } = offsetToAxial(col, row);
  return { x: HEX_R * 1.5 * q, y: HEX_R * Math.sqrt(3) * (r + q / 2) };
}

/** Isometric projection of unprojected world px. */
export function project(x: number, y: number): { x: number; y: number } {
  return { x, y: y * ISO_Y };
}
export function unproject(sx: number, sy: number): { x: number; y: number } {
  return { x: sx, y: sy / ISO_Y };
}

export function worldToHex(x: number, y: number): [number, number] {
  const q = (2 / 3) * x / HEX_R;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / HEX_R;
  const [rq, rr] = axialRound(q, r);
  return axialToOffset(rq, rr);
}

export function axialRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

const AXIAL_DIRS: Array<[number, number]> = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function neighbors(col: number, row: number): Array<[number, number]> {
  const { q, r } = offsetToAxial(col, row);
  return AXIAL_DIRS.map(([dq, dr]) => axialToOffset(q + dq, r + dr));
}

export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const a = offsetToAxial(c1, r1), b = offsetToAxial(c2, r2);
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function tileKey(col: number, row: number): string { return col + ',' + row; }
export function edgeKey(c1: number, r1: number, c2: number, r2: number): string {
  const a = tileKey(c1, r1), b = tileKey(c2, r2);
  return a < b ? a + '|' + b : b + '|' + a;
}
export function parseKey(k: string): [number, number] {
  const i = k.indexOf(',');
  return [parseInt(k.slice(0, i), 10), parseInt(k.slice(i + 1), 10)];
}

/** Corner points (unprojected) of a hex at world centre. */
export function hexCorners(cx: number, cy: number, r = HEX_R): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function inBounds(col: number, row: number, w: number, h: number): boolean {
  return col >= 0 && row >= 0 && col < w && row < h;
}

/** Deterministic hash-based 2D value noise in [0,1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let v = 0, amp = 0.5, f = 1, sum = 0;
  for (let i = 0; i < oct; i++) {
    v += valueNoise(x * f, y * f, seed + i * 101) * amp;
    sum += amp; amp *= 0.5; f *= 2;
  }
  return v / sum;
}
