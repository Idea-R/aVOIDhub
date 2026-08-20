import { describe, expect, it } from "vitest";
import { TANKAVOID_WAVES } from "./content";
import { TankSimulation } from "./TankSimulation";
import type { EnemySnapshot, InputSnapshot, RunSnapshot } from "./types";

const IDLE: InputSnapshot = {
  throttle: 0,
  turn: 0,
  aim: { x: 925, y: 360 },
  fire: false,
};

function activeTarget(snapshot: RunSnapshot): EnemySnapshot | undefined {
  return snapshot.enemies
    .filter((enemy) => !enemy.disabled)
    .sort((left, right) => {
      const leftDistance = Math.hypot(
        left.x - snapshot.tank.x,
        left.y - snapshot.tank.y,
      );
      const rightDistance = Math.hypot(
        right.x - snapshot.tank.x,
        right.y - snapshot.tank.y,
      );
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    })[0];
}

function pilot(
  snapshot: RunSnapshot,
  tick: number,
  fireIntervalTicks = 20,
): InputSnapshot {
  const target = activeTarget(snapshot);
  if (!target || snapshot.stage !== "combat") return IDLE;
  const distance = Math.hypot(
    target.x - snapshot.tank.x,
    target.y - snapshot.tank.y,
  );
  const leadSeconds = distance / 620;
  return {
    throttle: 0,
    turn: 0,
    aim: {
      x: target.x + Math.cos(target.hullAngle) * target.speed * leadSeconds,
      y: target.y + Math.sin(target.hullAngle) * target.speed * leadSeconds,
    },
    fire: tick % fireIntervalTicks === 0,
  };
}

function deploy(simulation: TankSimulation): void {
  while (simulation.snapshot().stage === "deploying") simulation.step(IDLE);
}

function runNaturalCampaign(seed: number, maximumTicks = 15_000) {
  const simulation = new TankSimulation();
  const waves = new Map<number, string>();
  simulation.start(seed);
  for (let tick = 0; tick < maximumTicks; tick += 1) {
    const snapshot = simulation.snapshot();
    waves.set(
      snapshot.wave,
      snapshot.enemies.map((enemy) => enemy.archetype).join(","),
    );
    if (snapshot.phase === "complete") return { snapshot, waves };
    simulation.step(pilot(snapshot, tick));
  }
  return { snapshot: simulation.snapshot(), waves };
}

function runDeliberateCampaign(seed: number, maximumTicks = 20_000) {
  const simulation = new TankSimulation();
  simulation.start(seed);
  for (let tick = 0; tick < maximumTicks; tick += 1) {
    const snapshot = simulation.snapshot();
    if (snapshot.phase === "complete") return snapshot;
    simulation.step(pilot(snapshot, tick, 120));
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
  it("publishes the exact T5 entity and draw ceilings", () => {
    expect(new TankSimulation().limits()).toEqual({
      enemies: 3,
      cover: 4,
      projectiles: 32,
      impacts: 12,
      coverStrikes: 8,
      particles: 0,
      drawItems: 64,
    });
  });

  it("is deterministic for the same seed and fixed pilot history", () => {
    const first = new TankSimulation();
    const second = new TankSimulation();
    first.start(42);
    second.start(42);
    for (let tick = 0; tick < 2_000; tick += 1) {
      const firstSnapshot = first.snapshot();
      const secondSnapshot = second.snapshot();
      expect(firstSnapshot).toEqual(secondSnapshot);
      if (firstSnapshot.phase === "complete") break;
      first.step(pilot(firstSnapshot, tick));
      second.step(pilot(secondSnapshot, tick));
    }
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.snapshot().projectiles.length).toBeLessThanOrEqual(
      first.projectileCapacity(),
    );
  });

  it("keeps every tank in bounds and freezes every combat clock on pause", () => {
    const simulation = new TankSimulation();
    simulation.start(99);
    const driving: InputSnapshot = { ...IDLE, throttle: 1, turn: 0.7 };
    for (let tick = 0; tick < 240; tick += 1) simulation.step(driving);
    const moving = simulation.snapshot();
    for (const tank of [moving.tank, ...moving.enemies]) {
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

  it("fires one pooled shell per accepted action and records the target id", () => {
    const simulation = new TankSimulation();
    simulation.start(7);
    deploy(simulation);
    const target = simulation.snapshot().enemies[0];
    simulation.step({ ...IDLE, aim: target, fire: true });
    simulation.step(IDLE);
    expect(simulation.snapshot().triggerPulls).toBe(1);
    expect(simulation.snapshot().stats.shotsFired).toBe(1);
    for (let tick = 0; tick < 100; tick += 1) simulation.step(IDLE);
    const snapshot = simulation.snapshot();
    expect(snapshot.stats.hits).toBeGreaterThanOrEqual(1);
    expect(snapshot.impacts[snapshot.impacts.length - 1]).toMatchObject({
      target: "enemy",
      targetId: target.id,
    });
  });

  it("holds deployment, wave clear, repair, and the final result on ticks", () => {
    const campaign = runNaturalCampaign(31);
    expect(campaign.snapshot).toMatchObject({
      phase: "complete",
      stage: "resolved",
      stageTicksRemaining: 0,
      completionReason: "run-cleared",
      wave: 5,
      waveCount: 5,
      stats: { wavesCleared: 5, enemiesDisabled: 9 },
    });
    expect(campaign.snapshot.stats.armorRepaired).toBeGreaterThan(0);
    expect(campaign.snapshot.stats.armorRepaired).toBeLessThanOrEqual(112);
  });

  it("reaches the exact static roster in order without development tools", () => {
    const campaign = runNaturalCampaign(77);
    expect([...campaign.waves.entries()]).toEqual(
      TANKAVOID_WAVES.map((wave) => [
        wave.number,
        wave.enemies.map((enemy) => enemy.archetype).join(","),
      ]),
    );
    expect(campaign.snapshot.completionReason).toBe("run-cleared");
  });

  it("still reaches an honest player-disabled result when the player does nothing", () => {
    const simulation = new TankSimulation();
    simulation.start(91);
    for (let tick = 0; tick < 30_000; tick += 1) {
      if (simulation.snapshot().phase === "complete") break;
      simulation.step(IDLE);
    }
    expect(simulation.snapshot()).toMatchObject({
      phase: "complete",
      completionReason: "player-disabled",
      stats: { wavesCleared: 0, enemiesDisabled: 0 },
    });
  });

  it("records bounded cover strikes instead of crossing barricades", () => {
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

  it("keeps moving tanks outside cover and separated from one another", () => {
    const simulation = new TankSimulation();
    simulation.start(18);
    deploy(simulation);
    for (let tick = 0; tick < 720; tick += 1) {
      const snapshot = simulation.snapshot();
      if (snapshot.phase === "complete") break;
      const target = activeTarget(snapshot);
      simulation.step({
        ...IDLE,
        throttle: 1,
        turn: tick < 220 ? -0.74 : tick < 440 ? 0.82 : -0.45,
        aim: target ?? IDLE.aim,
      });
      const moved = simulation.snapshot();
      const tanks = [moved.tank, ...moved.enemies];
      for (const tank of tanks)
        for (const cover of moved.cover)
          expect(distanceFromCover(tank, cover)).toBeGreaterThanOrEqual(35.999);
      for (let first = 0; first < tanks.length; first += 1)
        for (let second = first + 1; second < tanks.length; second += 1)
          expect(
            Math.hypot(
              tanks[first].x - tanks[second].x,
              tanks[first].y - tanks[second].y,
            ),
          ).toBeGreaterThanOrEqual(71.9);
    }
  });

  it("completes ten natural campaigns inside every explicit ceiling", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runNaturalCampaign(seed).snapshot;
      expect(result.phase, `seed ${seed}`).toBe("complete");
      expect(result.completionReason, `seed ${seed}`).toBe("run-cleared");
      expect(result.stats.wavesCleared, `seed ${seed}`).toBe(5);
      expect(result.stats.enemiesDisabled, `seed ${seed}`).toBe(9);
      expect(result.combatSeconds, `seed ${seed}`).toBeGreaterThanOrEqual(20);
      expect(result.combatSeconds, `seed ${seed}`).toBeLessThan(45);
      expect(result.tank.health, `seed ${seed}`).toBeGreaterThan(0);
      expect(result.stats.shotsFired, `seed ${seed}`).toBeGreaterThanOrEqual(
        60,
      );
      expect(
        result.stats.hits / result.stats.shotsFired,
        `seed ${seed}`,
      ).toBeGreaterThan(0.6);
      expect(result.projectiles.length).toBeLessThanOrEqual(32);
      expect(result.impacts.length).toBeLessThanOrEqual(12);
      expect(result.coverStrikes.length).toBeLessThanOrEqual(8);
      expect(result.enemies.length).toBeLessThanOrEqual(3);
      expect(result.cover).toHaveLength(4);
    }
  });

  it("leaves room for a deliberate touch cadence to clear every wave", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runDeliberateCampaign(seed);
      expect(result.completionReason, `seed ${seed}`).toBe("run-cleared");
      expect(result.stats.wavesCleared, `seed ${seed}`).toBe(5);
      expect(result.stats.enemiesDisabled, `seed ${seed}`).toBe(9);
      expect(result.tank.health, `seed ${seed}`).toBeGreaterThan(0);
    }
  });
});
