export const FIXED_STEP_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 5;
const STEP_EPSILON_MS = 1e-7;

export class FixedStepClock {
  private lastTimestamp: number | null = null;
  private accumulator = 0;

  reset(): void {
    this.lastTimestamp = null;
    this.accumulator = 0;
  }

  advance(
    timestamp: number,
    suspended: boolean,
    step: (deltaTime: number) => void,
  ): number {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return 0;
    }

    const frameDelta = Math.max(
      0,
      Math.min(timestamp - this.lastTimestamp, MAX_FRAME_DELTA_MS),
    );
    this.lastTimestamp = timestamp;

    if (suspended) {
      this.accumulator = 0;
      return 0;
    }

    this.accumulator += frameDelta;
    let steps = 0;

    while (
      this.accumulator + STEP_EPSILON_MS >= FIXED_STEP_MS &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      step(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      steps += 1;
    }

    if (steps === MAX_STEPS_PER_FRAME && this.accumulator >= FIXED_STEP_MS) {
      this.accumulator %= FIXED_STEP_MS;
    }

    return steps;
  }
}
