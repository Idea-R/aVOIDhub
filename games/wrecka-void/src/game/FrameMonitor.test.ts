import { describe, expect, it } from "vitest";
import { FrameMonitor } from "./FrameMonitor";

describe("FrameMonitor", () => {
  it("reports a bounded rolling frame sample", () => {
    const monitor = new FrameMonitor(4);
    [0, 16, 32, 48, 112, 128].forEach((time) => monitor.observe(time));

    expect(monitor.sample()).toEqual({
      averageMs: 28,
      maxMs: 64,
      p95Ms: 64,
      samples: 4,
      longFrames: 1,
    });
  });

  it("clears historical frame state between measurements", () => {
    const monitor = new FrameMonitor();
    monitor.observe(0);
    monitor.observe(16);
    monitor.reset();

    expect(monitor.sample().samples).toBe(0);
  });
});
