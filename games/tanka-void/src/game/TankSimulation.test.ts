import { describe, expect, it } from "vitest";
import { TankSimulation } from "./TankSimulation";
import type { InputSnapshot } from "./types";

const INPUT: InputSnapshot = {
  throttle: 1,
  turn: 0.35,
  aim: { x: 910, y: 215 },
  fire: false,
};

describe("TankSimulation", () => {
  it("is deterministic for the same seed and fixed input history", () => {
    const first = new TankSimulation();
    const second = new TankSimulation();
    first.start(42);
    second.start(42);
    for (let tick = 0; tick < 900; tick += 1) {
      const input = { ...INPUT, fire: tick === 50 || tick === 400 };
      first.step(input);
      second.step(input);
    }
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.snapshot().tick).toBe(900);
    expect(first.snapshot().triggerPulls).toBe(2);
  });

  it("keeps the tank inside the canonical world and freezes on pause/finish", () => {
    const simulation = new TankSimulation();
    simulation.start(99);
    for (let tick = 0; tick < 10_000; tick += 1) simulation.step(INPUT);
    const moving = simulation.snapshot();
    expect(moving.tank.x).toBeGreaterThanOrEqual(36);
    expect(moving.tank.x).toBeLessThanOrEqual(1164);
    expect(moving.tank.y).toBeGreaterThanOrEqual(36);
    expect(moving.tank.y).toBeLessThanOrEqual(684);

    simulation.pause();
    simulation.step(INPUT);
    expect(simulation.snapshot().tick).toBe(moving.tick);
    simulation.resume();
    simulation.step(INPUT);
    expect(simulation.snapshot().tick).toBe(moving.tick + 1);
    simulation.finish();
    simulation.step(INPUT);
    expect(simulation.snapshot().tick).toBe(moving.tick + 1);
  });

  it("uses the seed for reproducible arena placement without changing spawn safety", () => {
    const first = new TankSimulation();
    const second = new TankSimulation();
    first.start(1);
    second.start(2);
    expect(first.snapshot().beacon).not.toEqual(second.snapshot().beacon);
    for (const beacon of [first.snapshot().beacon, second.snapshot().beacon]) {
      expect(beacon.x).toBeGreaterThanOrEqual(744);
      expect(beacon.x).toBeLessThanOrEqual(1032);
      expect(beacon.y).toBeGreaterThanOrEqual(158.4);
      expect(beacon.y).toBeLessThanOrEqual(561.6);
    }
  });
});
