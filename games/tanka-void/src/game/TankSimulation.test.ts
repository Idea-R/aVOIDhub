import { describe, expect, it } from "vitest";
import { TankSimulation } from "./TankSimulation";
import type { InputSnapshot } from "./types";

const IDLE: InputSnapshot = {
  throttle: 0,
  turn: 0,
  aim: { x: 912, y: 360 },
  fire: false,
};

function deploy(simulation: TankSimulation): void {
  while (simulation.snapshot().stage === "deploying") simulation.step(IDLE);
}

function runNaturalEncounter(seed: number) {
  const simulation = new TankSimulation();
  simulation.start(seed);
  for (let tick = 0; tick < 1_200; tick += 1) {
    const snapshot = simulation.snapshot();
    if (snapshot.phase === "complete") return snapshot;
    simulation.step({
      ...IDLE,
      aim: { x: snapshot.enemy.x, y: snapshot.enemy.y },
      fire: snapshot.stage === "combat" && tick % 24 === 0,
    });
  }
  return simulation.snapshot();
}

function distanceFromCover(
  point: { x: number; y: number },
  cover: { x: number; y: number; width: number; height: number },
): number {
  const x = Math.max(cover.x, Math.min(cover.x + cover.width, point.x));
  const y = Math.max(cover.y, Math.min(cover.y + cover.height, point.y));
  return Math.hypot(point.x - x, point.y - y);
}

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
    deploy(simulation);
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
    const result = runNaturalEncounter(12);
    expect(result.phase).toBe("complete");
    expect(result.completionReason).toBe("enemy-disabled");
    expect(result.enemy.health).toBe(0);
    expect(result.projectiles).toHaveLength(0);
    expect(result.impacts.length).toBeLessThanOrEqual(8);
  });

  it("holds deployment and the final impact before completing", () => {
    const simulation = new TankSimulation();
    simulation.start(31);
    const initial = simulation.snapshot();
    for (let tick = 0; tick < 179; tick += 1)
      simulation.step({ ...IDLE, throttle: 1, fire: true });
    expect(simulation.snapshot()).toMatchObject({
      stage: "deploying",
      triggerPulls: 0,
      tank: { x: initial.tank.x, y: initial.tank.y },
    });
    simulation.step(IDLE);
    expect(simulation.snapshot().stage).toBe("combat");

    const result = runNaturalEncounter(31);
    expect(result.phase).toBe("complete");
    expect(result.stage).toBe("resolved");
    expect(result.stageTicksRemaining).toBe(0);
  });

  it("records bounded cover strikes instead of letting shells cross barricades", () => {
    const simulation = new TankSimulation();
    simulation.start(8);
    deploy(simulation);
    for (let shot = 0; shot < 12; shot += 1) {
      simulation.step({ ...IDLE, aim: { x: 430, y: 170 }, fire: true });
      for (let tick = 0; tick < 24; tick += 1) simulation.step(IDLE);
    }
    const snapshot = simulation.snapshot();
    expect(snapshot.coverStrikes.length).toBeGreaterThan(0);
    expect(snapshot.coverStrikes.length).toBeLessThanOrEqual(8);
    expect(
      snapshot.coverStrikes.every((strike) => strike.coverId === "north-west"),
    ).toBe(true);
  });

  it("keeps moving tanks outside every barricade and separated from each other", () => {
    const simulation = new TankSimulation();
    simulation.start(18);
    deploy(simulation);
    for (let tick = 0; tick < 480; tick += 1) {
      const snapshot = simulation.snapshot();
      if (snapshot.phase === "complete") break;
      simulation.step({
        ...IDLE,
        throttle: 1,
        turn: tick < 150 ? -0.74 : tick < 300 ? 0.82 : -0.45,
        aim: { x: snapshot.enemy.x, y: snapshot.enemy.y },
      });
      const moved = simulation.snapshot();
      for (const tank of [moved.tank, moved.enemy])
        for (const cover of moved.cover)
          expect(distanceFromCover(tank, cover)).toBeGreaterThanOrEqual(35.999);
      expect(
        Math.hypot(moved.enemy.x - moved.tank.x, moved.enemy.y - moved.tank.y),
      ).toBeGreaterThanOrEqual(71.999);
    }
  });

  it("completes ten natural loops inside every explicit runtime ceiling", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runNaturalEncounter(seed);
      expect(result.phase, `seed ${seed}`).toBe("complete");
      expect(result.completionReason, `seed ${seed}`).toBe("enemy-disabled");
      expect(result.projectiles.length).toBeLessThanOrEqual(32);
      expect(result.impacts.length).toBeLessThanOrEqual(8);
      expect(result.coverStrikes.length).toBeLessThanOrEqual(8);
      expect(result.cover).toHaveLength(4);
    }
  });
});
