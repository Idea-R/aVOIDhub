import { describe, expect, it } from "vitest";
import {
  resolveCircleFromBox,
  segmentAxisAlignedBoxIntersection,
  segmentBlockedByBox,
  segmentOrientedBoxIntersection,
  separateCircles,
} from "./geometry";

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

describe("arena collision geometry", () => {
  const cover = { x: 100, y: 100, width: 80, height: 60 };

  it("finds swept cover strikes and clean sight lines", () => {
    expect(
      segmentAxisAlignedBoxIntersection(
        { x: 0, y: 130 },
        { x: 240, y: 130 },
        cover,
      ),
    ).toEqual({ x: 100, y: 130 });
    expect(
      segmentBlockedByBox({ x: 0, y: 130 }, { x: 240, y: 130 }, cover),
    ).toBe(true);
    expect(segmentBlockedByBox({ x: 0, y: 20 }, { x: 240, y: 20 }, cover)).toBe(
      false,
    );
  });

  it("pushes a tank circle out of cover along the shortest edge", () => {
    expect(resolveCircleFromBox({ x: 90, y: 130 }, 36, cover)).toEqual({
      x: 64,
      y: 130,
    });
    expect(resolveCircleFromBox({ x: 140, y: 130 }, 36, cover)).toEqual({
      x: 140,
      y: 64,
    });
  });

  it("separates overlapping tanks without changing their midpoint", () => {
    const [first, second] = separateCircles(
      { x: 100, y: 100 },
      { x: 140, y: 100 },
      36,
    );
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeCloseTo(72);
    expect((first.x + second.x) / 2).toBe(120);
  });
});
