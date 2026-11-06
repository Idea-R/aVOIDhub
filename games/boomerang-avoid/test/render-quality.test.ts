import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialRenderQuality,
  sampleRenderQuality,
  effectiveRenderQuality,
  type RenderQualityState,
  type RenderQualityMode,
} from "../src/render-quality.js";
function frames(
  state: RenderQualityState,
  interval: number,
  count: number,
  mode: RenderQualityMode = "auto",
  visible = true,
) {
  let now = state.lastAt ?? 0;
  for (let i = 0; i < count; i++) {
    now += interval;
    state = sampleRenderQuality(state, now, visible, mode);
  }
  return state;
}
test("auto preserves baseline during warmup and downshifts only after sustained slow delivery", () => {
  let state = sampleRenderQuality(initialRenderQuality(), 0, true, "auto");
  state = frames(state, 250, 19);
  assert.equal(state.tier, 0);
  state = frames(state, 250, 1);
  assert.equal(state.tier, 1);
  state = frames(state, 250, 8);
  assert.equal(state.tier, 2);
  assert.equal(effectiveRenderQuality("auto", 1, 3).dpr, 1);
  assert.equal(effectiveRenderQuality("auto", 1, 3).shadows, false);
  assert.equal(effectiveRenderQuality("auto", 2, 3).dpr, 0.75);
});
test("moderately slow delivery stops at low and recovering delivery never oscillates upward", () => {
  let state = sampleRenderQuality(initialRenderQuality(), 0, true, "auto");
  state = frames(state, 40, 200);
  assert.equal(state.tier, 1);
  state = frames(state, 16, 500);
  assert.equal(state.tier, 1);
  state = frames(state, 100, 80);
  assert.equal(state.tier, 2);
  state = frames(state, 16, 500);
  assert.equal(state.tier, 2);
});
test("manual High and Low override adaptive tiers without changing their explicit quality", () => {
  for (const mode of ["high", "low"] as const) {
    let state = sampleRenderQuality(initialRenderQuality(), 0, true, mode);
    state = frames(state, 250, 100, mode);
    assert.equal(state.tier, 0);
  }
  assert.deepEqual(effectiveRenderQuality("high", 2, 3), {
    quality: "high",
    dpr: 2,
    shadows: true,
    particles: 48,
  });
  assert.deepEqual(effectiveRenderQuality("low", 2, 3), {
    quality: "low",
    dpr: 1,
    shadows: false,
    particles: 24,
  });
  assert.deepEqual(effectiveRenderQuality("auto", 0, 3), {
    quality: "balanced",
    dpr: 1.65,
    shadows: true,
    particles: 48,
  });
});
test("hidden windows, long pauses and clock resets do not count toward degradation", () => {
  let state = sampleRenderQuality(initialRenderQuality(), 0, true, "auto");
  state = frames(state, 16, 300);
  state = sampleRenderQuality(state, 20000, false, "auto");
  assert.equal(state.warmupMs, 0);
  state = sampleRenderQuality(state, 30000, true, "auto");
  state = frames(state, 250, 12);
  assert.equal(state.tier, 0);
  state = sampleRenderQuality(state, 50000, true, "auto");
  assert.equal(state.warmupMs, 0);
  assert.equal(state.samples, 0);
  state = sampleRenderQuality(state, 10, true, "auto");
  assert.equal(state.warmupMs, 0);
  state = sampleRenderQuality(state, NaN, true, "auto");
  assert.equal(state.lastAt, null);
});
test("isolated slow frames do not degrade otherwise steady delivery", () => {
  let state = sampleRenderQuality(initialRenderQuality(), 0, true, "auto");
  for (let i = 0; i < 1000; i++)
    state = frames(state, i % 10 === 0 ? 100 : 16, 1);
  assert.equal(state.tier, 0);
});
test("the policy is pure and never mutates its input", () => {
  const state = Object.freeze(initialRenderQuality());
  const next = sampleRenderQuality(state, 0, true, "auto");
  assert.notEqual(next, state);
  assert.deepEqual(state, initialRenderQuality());
});
