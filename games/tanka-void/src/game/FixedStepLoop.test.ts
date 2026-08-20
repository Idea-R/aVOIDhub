import { describe, expect, it, vi } from "vitest";
import { FixedStepLoop, type FrameScheduler } from "./FixedStepLoop";

class TestScheduler implements FrameScheduler {
  private nextId = 1;
  private callbacks = new Map<number, FrameRequestCallback>();

  request(callback: FrameRequestCallback): number {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(frameId: number): void {
    this.callbacks.delete(frameId);
  }

  fire(timestamp: number): void {
    const [entry] = this.callbacks.entries();
    if (!entry) throw new Error("No frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](timestamp);
  }

  pending(): number {
    return this.callbacks.size;
  }
}

describe("FixedStepLoop", () => {
  it("owns one frame and advances through fixed simulation steps", () => {
    const scheduler = new TestScheduler();
    const step = vi.fn();
    const render = vi.fn();
    const loop = new FixedStepLoop(step, render, scheduler);
    loop.start();
    loop.start();
    expect(scheduler.pending()).toBe(1);
    scheduler.fire(100);
    scheduler.fire(117);
    scheduler.fire(134);
    expect(step).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(3);
    expect(scheduler.pending()).toBe(1);
    loop.pause();
    expect(scheduler.pending()).toBe(0);
    expect(loop.diagnostics().framePending).toBe(false);
  });

  it("bounds catch-up work instead of simulating an unbounded frame", () => {
    const scheduler = new TestScheduler();
    const step = vi.fn();
    const loop = new FixedStepLoop(step, vi.fn(), scheduler);
    loop.start();
    scheduler.fire(0);
    scheduler.fire(250);
    expect(step).toHaveBeenCalledTimes(5);
    expect(loop.diagnostics().droppedMilliseconds).toBeGreaterThan(0);
  });
});
