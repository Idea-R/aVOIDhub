import { describe, expect, it } from "vitest";
import {
  TANKAVOID_ENEMY_PROFILES,
  TANKAVOID_FIELD_REPAIR,
  TANKAVOID_WAVES,
  TANKAVOID_WAVE_COUNT,
} from "./content";

describe("TankaVOID T5 content", () => {
  it("freezes five ordered waves and nine total hostiles", () => {
    expect(TANKAVOID_WAVE_COUNT).toBe(5);
    expect(TANKAVOID_WAVES.map((wave) => wave.number)).toEqual([1, 2, 3, 4, 5]);
    expect(TANKAVOID_WAVES.flatMap((wave) => wave.enemies)).toHaveLength(9);
    expect(TANKAVOID_WAVES[4].enemies.map((enemy) => enemy.archetype)).toEqual([
      "commander",
      "scout",
      "hunter",
    ]);
    expect(TANKAVOID_FIELD_REPAIR).toBe(28);
  });

  it("gives each behavior a materially different pressure profile", () => {
    const { scout, bruiser, hunter, commander } = TANKAVOID_ENEMY_PROFILES;
    expect(scout.forwardSpeed).toBeGreaterThan(bruiser.forwardSpeed);
    expect(scout.turnRate).toBeGreaterThan(bruiser.turnRate);
    expect(scout.maxHealth).toBeLessThan(bruiser.maxHealth);
    expect(hunter.preferredRange).toBeGreaterThan(bruiser.preferredRange);
    expect(hunter.fireIntervalTicks).toBeLessThan(bruiser.fireIntervalTicks);
    expect(commander.maxHealth).toBeGreaterThan(bruiser.maxHealth);
    expect(commander.shellDamage).toBeGreaterThan(hunter.shellDamage);
  });

  it("keeps every spawn inside the arena and the three-enemy ceiling", () => {
    for (const wave of TANKAVOID_WAVES) {
      expect(wave.enemies.length).toBeGreaterThan(0);
      expect(wave.enemies.length).toBeLessThanOrEqual(3);
      for (const enemy of wave.enemies) {
        expect(enemy.x).toBeGreaterThanOrEqual(36);
        expect(enemy.x).toBeLessThanOrEqual(1164);
        expect(enemy.y).toBeGreaterThanOrEqual(36);
        expect(enemy.y).toBeLessThanOrEqual(684);
      }
    }
  });
});
