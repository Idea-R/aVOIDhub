import type { WorldPoint } from "./types";

export interface AxisAlignedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrientedBox {
  center: WorldPoint;
  angle: number;
  halfWidth: number;
  halfHeight: number;
}

function toLocal(point: WorldPoint, box: OrientedBox): WorldPoint {
  const x = point.x - box.center.x;
  const y = point.y - box.center.y;
  const cosine = Math.cos(box.angle);
  const sine = Math.sin(box.angle);
  return {
    x: x * cosine + y * sine,
    y: -x * sine + y * cosine,
  };
}

export function segmentOrientedBoxIntersection(
  start: WorldPoint,
  end: WorldPoint,
  box: OrientedBox,
): WorldPoint | null {
  if (
    box.halfWidth <= 0 ||
    box.halfHeight <= 0 ||
    !Number.isFinite(box.halfWidth) ||
    !Number.isFinite(box.halfHeight)
  )
    return null;

  const localStart = toLocal(start, box);
  const localEnd = toLocal(end, box);
  const delta = {
    x: localEnd.x - localStart.x,
    y: localEnd.y - localStart.y,
  };
  let entry = 0;
  let exit = 1;

  const clip = (origin: number, direction: number, extent: number): boolean => {
    if (Math.abs(direction) <= Number.EPSILON)
      return origin >= -extent && origin <= extent;
    const first = (-extent - origin) / direction;
    const second = (extent - origin) / direction;
    const near = Math.min(first, second);
    const far = Math.max(first, second);
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    return entry <= exit;
  };

  if (
    !clip(localStart.x, delta.x, box.halfWidth) ||
    !clip(localStart.y, delta.y, box.halfHeight) ||
    entry < 0 ||
    entry > 1
  )
    return null;

  return {
    x: start.x + (end.x - start.x) * entry,
    y: start.y + (end.y - start.y) * entry,
  };
}

export function segmentAxisAlignedBoxIntersection(
  start: WorldPoint,
  end: WorldPoint,
  box: AxisAlignedBox,
): WorldPoint | null {
  return segmentOrientedBoxIntersection(start, end, {
    center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    angle: 0,
    halfWidth: box.width / 2,
    halfHeight: box.height / 2,
  });
}

export function segmentBlockedByBox(
  start: WorldPoint,
  end: WorldPoint,
  box: AxisAlignedBox,
): boolean {
  return segmentAxisAlignedBoxIntersection(start, end, box) !== null;
}

export function resolveCircleFromBox(
  center: WorldPoint,
  radius: number,
  box: AxisAlignedBox,
): WorldPoint {
  if (radius <= 0 || box.width <= 0 || box.height <= 0) return { ...center };

  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const closest = {
    x: Math.max(box.x, Math.min(right, center.x)),
    y: Math.max(box.y, Math.min(bottom, center.y)),
  };
  const delta = { x: center.x - closest.x, y: center.y - closest.y };
  const distance = Math.hypot(delta.x, delta.y);
  if (distance >= radius) return { ...center };

  if (distance > Number.EPSILON) {
    const correction = radius - distance;
    return {
      x: center.x + (delta.x / distance) * correction,
      y: center.y + (delta.y / distance) * correction,
    };
  }

  const distances = [
    { axis: "x" as const, value: box.x - center.x - radius },
    { axis: "x" as const, value: right - center.x + radius },
    { axis: "y" as const, value: box.y - center.y - radius },
    { axis: "y" as const, value: bottom - center.y + radius },
  ];
  const nearest = distances.reduce((best, candidate) =>
    Math.abs(candidate.value) < Math.abs(best.value) ? candidate : best,
  );
  return nearest.axis === "x"
    ? { x: center.x + nearest.value, y: center.y }
    : { x: center.x, y: center.y + nearest.value };
}

export function separateCircles(
  first: WorldPoint,
  second: WorldPoint,
  radius: number,
): [WorldPoint, WorldPoint] {
  if (radius <= 0) return [{ ...first }, { ...second }];
  const delta = { x: second.x - first.x, y: second.y - first.y };
  const distance = Math.hypot(delta.x, delta.y);
  const minimumDistance = radius * 2;
  if (distance >= minimumDistance) return [{ ...first }, { ...second }];

  const direction =
    distance > Number.EPSILON
      ? { x: delta.x / distance, y: delta.y / distance }
      : { x: 1, y: 0 };
  const correction = (minimumDistance - distance) / 2;
  return [
    {
      x: first.x - direction.x * correction,
      y: first.y - direction.y * correction,
    },
    {
      x: second.x + direction.x * correction,
      y: second.y + direction.y * correction,
    },
  ];
}
