import { describe, expect, it } from "vitest";
import { TankSimulation } from "./TankSimulation";
import type { InputSnapshot } from "./types";

const IDLE: InputSnapshot = {
  throttle: 0,
  turn: 0,
  aim: { x: 912, y: 360 },
  fire: false,
};

describe("TankSimulation", () => {
  it("is deterministic for the same seed and fixed combat history", () => {
    const first = new TankSimulation();
    const second = new TankSimulation();
    first.start(42);
    second.start(42);
    for (let tick = 0; tick < 240; tick += 1) {
      const input = {
        throttle: tick < 90 ? 0.35 : 0,
        turn: tick < 90 ? 0.12 : 0,
        aim: { x: 900, y: 360 },
        fire: tick % 30 === 0,
      };
      first.step(input);
      second.step(input);
    }
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.snapshot().projectiles.length).toBeLessThanOrEqual(
      first.projectileCapacity(),
    );
  });

  it("keeps both tanks inside the world and freezes every combat clock on pause", () => {
    const simulation = new TankSimulation();
    simulation.start(99);
    const driving: InputSnapshot = {
      ...IDLE,
      throttle: 1,
      turn: 0.7,
    };
    for (let tick = 0; tick < 70; tick += 1) simulation.step(driving);
    const moving = simulation.snapshot();
    for (const tank of [moving.tank, moving.enemy]) {
      expect(tank.x).toBeGreaterThanOrEqual(36);
      expect(tank.x).toBeLessThanOrEqual(1164);
      expect(tank.y).toBeGreaterThanOrEqual(36);
      expect(tank.y).toBeLessThanOrEqual(684);
    }

    simulation.pause();
    simulation.step(driving);
    expect(simulation.snapshot()).toEqual({ ...moving, phase: "paused" });
    simulation.resume();
    simulation.step(driving);
    expect(simulation.snapshot().tick).toBe(moving.tick + 1);
  });

  it("fires one pooled shell per accepted trigger edge and records a real hit", () => {
    const simulation = new TankSimulation();
    simulation.start(7);
    simulation.step({ ...IDLE, fire: true });
    simulation.step(IDLE);
    expect(simulation.snapshot().triggerPulls).toBe(1);
    expect(simulation.snapshot().stats.shotsFired).toBe(1);
    simulation.step(IDLE);
    for (let tick = 0; tick < 75; tick += 1) simulation.step(IDLE);
    expect(simulation.snapshot().stats.hits).toBeGreaterThanOrEqual(1);
    expect(simulation.snapshot().enemy.health).toBeLessThan(120);
    expect(simulation.snapshot().impacts.length).toBeGreaterThanOrEqual(1);
  });

  it("reaches one deterministic enemy-disabled terminal result", () => {
    const simulation = new TankSimulation();
    simulation.start(12);
    for (let tick = 0; tick < 900; tick += 1) {
      const snapshot = simulation.snapshot();
      if (snapshot.phase === "complete") break;
      simulation.step({
        ...IDLE,
        aim: { x: snapshot.enemy.x, y: snapshot.enemy.y },
        fire: tick % 24 === 0,
      });
    }
    const result = simulation.snapshot();
    expect(result.phase).toBe("complete");
    expect(result.completionReason).toBe("enemy-disabled");
    expect(result.enemy.health).toBe(0);
    expect(result.projectiles).toHaveLength(0);
    expect(result.impacts.length).toBeLessThanOrEqual(8);
  });
});
