import type { WorldPoint } from "./types";

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
