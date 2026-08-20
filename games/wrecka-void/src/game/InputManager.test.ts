import { describe, expect, it } from "vitest";
import { mapClientPointToCanvas } from "./InputManager";

describe("mapClientPointToCanvas", () => {
  it("preserves coordinates when the CSS and bitmap sizes match", () => {
    expect(
      mapClientPointToCanvas(
        210,
        140,
        { left: 10, top: 40, width: 390, height: 804 },
        390,
        804,
      ),
    ).toEqual({ x: 200, y: 100 });
  });

  it("scales pointer coordinates into a high-density canvas", () => {
    expect(
      mapClientPointToCanvas(
        110,
        70,
        { left: 10, top: 20, width: 200, height: 100 },
        400,
        200,
      ),
    ).toEqual({ x: 200, y: 100 });
  });
});
