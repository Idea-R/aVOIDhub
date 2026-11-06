import type { Vec } from './types';
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const length = (p: Vec) => Math.hypot(p.x, p.y);
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function unit(x: number, y: number): Vec {
  const n = Math.hypot(x, y);
  return n > 0 ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function circleTOI(
  a: Vec,
  b: Vec,
  c: Vec,
  d: Vec,
  r: number,
): number | null {
  const x = a.x - c.x,
    y = a.y - c.y,
    dx = b.x - a.x - (d.x - c.x),
    dy = b.y - a.y - (d.y - c.y);
  const cc = x * x + y * y - r * r;
  // A contact left by the previous sweep may round a few ULPs to either side
  // of the radius in different engines. Classify that boundary consistently;
  // the tolerance scales with squared geometry, not a world-space hit radius.
  const overlapTolerance =
    1e-12 * Math.max(r * r, x * x + y * y, Number.MIN_VALUE);
  if (cc <= overlapTolerance) return 0;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-15) return null;
  const bb = 2 * (x * dx + y * dy),
    disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
/** Earliest entry into a moving facing sector, considering both arc and ray boundaries. */
export function sectorTOI(
  origin: Vec,
  endOrigin: Vec,
  target: Vec,
  endTarget: Vec,
  heading: number,
  radius: number,
  halfArc: number,
): number | null {
  const start = { x: target.x - origin.x, y: target.y - origin.y },
    end = { x: endTarget.x - endOrigin.x, y: endTarget.y - endOrigin.y };
  const candidates = [0, 1];
  const radial = circleTOI(start, end, { x: 0, y: 0 }, { x: 0, y: 0 }, radius);
  if (radial !== null) candidates.push(radial);
  for (const angle of [heading - halfArc, heading + halfArc]) {
    const rx = Math.cos(angle),
      ry = Math.sin(angle),
      from = start.x * ry - start.y * rx,
      change = (end.x - start.x) * ry - (end.y - start.y) * rx;
    if (Math.abs(change) > 1e-15) {
      const t = -from / change;
      if (t >= 0 && t <= 1) candidates.push(t);
    }
  }
  for (const t of candidates.sort((a, b) => a - b)) {
    const x = start.x + (end.x - start.x) * t,
      y = start.y + (end.y - start.y) * t;
    if (
      Math.hypot(x, y) <= radius + 1e-7 &&
      (Math.hypot(x, y) < 1e-7 ||
        Math.abs(angleDelta(Math.atan2(y, x), heading)) <= halfArc + 1e-7)
    )
      return t;
  }
  return null;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export function inside(p: Vec, r: Rect, pad = 0): boolean {
  return (
    Math.abs(p.x - r.x) <= r.w / 2 + pad && Math.abs(p.y - r.y) <= r.h / 2 + pad
  );
}
// Slab sweep against the Minkowski-expanded rectangle, including contact normal.
export function rectTOI(
  a: Vec,
  b: Vec,
  r: Rect,
  pad: number,
): {
  t: number;
  nx: number;
  ny: number;
} | null {
  let enter = 0,
    leave = 1,
    nx = 0,
    ny = 0;
  for (const axis of ['x', 'y'] as const) {
    const half = (axis === 'x' ? r.w : r.h) / 2 + pad,
      delta = b[axis] - a[axis],
      lo = r[axis] - half,
      hi = r[axis] + half;
    if (Math.abs(delta) < 1e-15) {
      if (a[axis] < lo || a[axis] > hi) return null;
      continue;
    }
    let t1 = (lo - a[axis]) / delta,
      t2 = (hi - a[axis]) / delta;
    let sign = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      sign = 1;
    }
    if (t1 > enter) {
      enter = t1;
      nx = axis === 'x' ? sign : 0;
      ny = axis === 'y' ? sign : 0;
    }
    leave = Math.min(leave, t2);
    if (enter > leave) return null;
  }
  return enter >= 0 && enter <= 1 ? { t: enter, nx, ny } : null;
}
