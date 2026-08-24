import { describe, expect, it } from "vitest";
import {
  clampCanvasPoint,
  isInteractiveKeyboardTarget,
  mapClientPointToCanvas,
} from "./InputManager";

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

  it("keeps a stale pointer inside the resized playfield", () => {
    expect(clampCanvasPoint({ x: 900, y: -20 }, 390, 804)).toEqual({
      x: 390,
      y: 0,
    });
  });

  it("leaves keyboard activation on interactive controls alone", () => {
    expect(isInteractiveKeyboardTarget({ tagName: "BUTTON" } as never)).toBe(
      true,
    );
    expect(isInteractiveKeyboardTarget({ tagName: "INPUT" } as never)).toBe(
      true,
    );
    expect(
      isInteractiveKeyboardTarget({ isContentEditable: true } as never),
    ).toBe(true);
    expect(isInteractiveKeyboardTarget({ tagName: "CANVAS" } as never)).toBe(
      false,
    );
  });
});
