import { describe, expect, it } from "vitest";
import {
  FIXED_STEP_MS,
  FixedStepClock,
  MAX_STEPS_PER_FRAME,
} from "./FixedStepClock";

function simulatedTimeAtRate(framesPerSecond: number): number {
  const clock = new FixedStepClock();
  let simulatedTime = 0;
  const frameTime = 1000 / framesPerSecond;

  for (let frame = 0; frame <= framesPerSecond; frame += 1) {
    clock.advance(frame * frameTime, false, (deltaTime) => {
      simulatedTime += deltaTime;
    });
  }

  return simulatedTime;
}

describe("FixedStepClock", () => {
  it.each([30, 60, 120])(
    "advances one second consistently at %i Hz",
    (framesPerSecond) => {
      expect(simulatedTimeAtRate(framesPerSecond)).toBeCloseTo(1000, 5);
    },
  );

  it("drops suspended time instead of producing a resume burst", () => {
    const clock = new FixedStepClock();
    let steps = 0;

    clock.advance(0, false, () => {
      steps += 1;
    });
    clock.advance(5000, true, () => {
      steps += 1;
    });
    clock.advance(5000 + FIXED_STEP_MS, false, () => {
      steps += 1;
    });

    expect(steps).toBe(1);
  });

  it("caps catch-up work after a long frame", () => {
    const clock = new FixedStepClock();
    let steps = 0;

    clock.advance(0, false, () => undefined);
    const consumed = clock.advance(5000, false, () => {
      steps += 1;
    });

    expect(consumed).toBe(MAX_STEPS_PER_FRAME);
    expect(steps).toBe(MAX_STEPS_PER_FRAME);
  });
});
