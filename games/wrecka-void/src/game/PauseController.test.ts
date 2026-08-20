import { describe, expect, it } from "vitest";
import { PauseController } from "./PauseController";

describe("PauseController", () => {
  it("does not let help resume a manually paused run", () => {
    const pause = new PauseController();

    pause.set("manual", true);
    pause.set("help", true);
    expect(pause.set("help", false)).toBe(true);
    expect(pause.activeReasons()).toEqual(["manual"]);
  });

  it("does not let focus return clear an explicit pause", () => {
    const pause = new PauseController();

    pause.set("manual", true);
    pause.set("focus", true);
    expect(pause.set("focus", false)).toBe(true);
  });

  it("resumes when the last pause reason clears", () => {
    const pause = new PauseController();

    pause.set("focus", true);
    expect(pause.set("focus", false)).toBe(false);
  });

  it("resets every pause reason for a fresh run", () => {
    const pause = new PauseController();
    pause.set("manual", true);
    pause.set("help", true);

    pause.reset();

    expect(pause.isPaused()).toBe(false);
    expect(pause.activeReasons()).toEqual([]);
  });
});
