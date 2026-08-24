import { describe, expect, it } from "vitest";
import { computeViewport, mapClientPointToWorld } from "./Viewport";

describe("viewport mapping", () => {
  it("letterboxes the canonical world without stretching it", () => {
    const portrait = computeViewport(390, 844, 3);
    expect(portrait.dpr).toBe(2);
    expect(portrait.scale).toBeCloseTo(0.325);
    expect(portrait.offsetY).toBeCloseTo(305);
    expect(portrait.bitmapWidth).toBe(780);
    expect(portrait.bitmapHeight).toBe(1688);
  });

  it("maps pointer coordinates through the same scale and clamps outside the arena", () => {
    const layout = computeViewport(1440, 900, 1);
    expect(
      mapClientPointToWorld(720, 450, { left: 0, top: 0 }, layout),
    ).toEqual({ x: 600, y: 360 });
    expect(
      mapClientPointToWorld(-100, 2000, { left: 0, top: 0 }, layout),
    ).toEqual({ x: 0, y: 720 });
  });
});
