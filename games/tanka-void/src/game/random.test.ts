import { describe, expect, it } from "vitest";
import { SeededRandom, normalizeSeed } from "./random";

describe("SeededRandom", () => {
  it("repeats an exact sequence for the same normalized seed", () => {
    const first = new SeededRandom(0x12345678);
    const second = new SeededRandom(0x12345678);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it("replaces the invalid all-zero xorshift state", () => {
    expect(normalizeSeed(0)).not.toBe(0);
    expect(new SeededRandom(0).next()).toBeGreaterThan(0);
  });
});
