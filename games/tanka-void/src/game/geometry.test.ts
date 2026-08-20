import { describe, expect, it } from "vitest";
import { segmentOrientedBoxIntersection } from "./geometry";

describe("swept projectile collision", () => {
  it("returns the first impact point across a full high-speed segment", () => {
    expect(
      segmentOrientedBoxIntersection(
        { x: -300, y: 0 },
        { x: 300, y: 0 },
        {
          center: { x: 0, y: 0 },
          angle: 0,
          halfWidth: 38,
          halfHeight: 28,
        },
      ),
    ).toEqual({ x: -38, y: 0 });
  });

  it("handles rotated armor and clean misses", () => {
    const rotated = segmentOrientedBoxIntersection(
      { x: 0, y: -100 },
      { x: 0, y: 100 },
      {
        center: { x: 0, y: 0 },
        angle: Math.PI / 2,
        halfWidth: 40,
        halfHeight: 20,
      },
    );
    expect(rotated?.x).toBeCloseTo(0, 10);
    expect(rotated?.y).toBeCloseTo(-40, 10);
    expect(
      segmentOrientedBoxIntersection(
        { x: -100, y: 80 },
        { x: 100, y: 80 },
        {
          center: { x: 0, y: 0 },
          angle: 0,
          halfWidth: 38,
          halfHeight: 28,
        },
      ),
    ).toBeNull();
  });

  it("rejects invalid collision extents", () => {
    expect(
      segmentOrientedBoxIntersection(
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        {
          center: { x: 0, y: 0 },
          angle: 0,
          halfWidth: 0,
          halfHeight: 10,
        },
      ),
    ).toBeNull();
  });
});
