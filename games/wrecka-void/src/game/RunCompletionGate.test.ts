import { describe, expect, it } from "vitest";
import { RunCompletionGate } from "./RunCompletionGate";

describe("RunCompletionGate", () => {
  it("allows exactly one finish transition per run", () => {
    const gate = new RunCompletionGate();

    expect(gate.shouldFinish(false)).toBe(false);
    expect(gate.shouldFinish(true)).toBe(true);
    expect(gate.shouldFinish(true)).toBe(false);
  });

  it("opens a fresh finish transition after restart", () => {
    const gate = new RunCompletionGate();

    expect(gate.shouldFinish(true)).toBe(true);
    gate.reset();
    expect(gate.shouldFinish(true)).toBe(true);
  });
});
