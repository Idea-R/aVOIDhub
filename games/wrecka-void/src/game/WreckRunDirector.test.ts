import { describe, expect, it } from "vitest";
import {
  getWreckRunSnapshot,
  WRECK_RUN_FINAL_BOSS_TIME_SECONDS,
  WRECK_RUN_RULESET_VERSION,
} from "./WreckRunDirector";

describe("Wreck Run director", () => {
  it("advances twenty time-based waves without rewarding score farming with more pressure", () => {
    expect(getWreckRunSnapshot(0, 0, false).wave).toBe(1);
    expect(getWreckRunSnapshot(149.9, 0, false).wave).toBe(5);
    expect(getWreckRunSnapshot(599.9, 2, false).wave).toBe(20);
    expect(getWreckRunSnapshot(900, 2, true).wave).toBe(20);
  });

  it("opens each boss checkpoint only when the previous boss is down", () => {
    expect(getWreckRunSnapshot(149.9, 0, false).shouldSpawnBoss).toBe(false);
    expect(getWreckRunSnapshot(150, 0, false)).toMatchObject({
      bossOrdinalDue: 1,
      shouldSpawnBoss: true,
      bossPhase: true,
    });
    expect(getWreckRunSnapshot(330, 0, false).bossOrdinalDue).toBe(1);
    expect(getWreckRunSnapshot(330, 1, false).bossOrdinalDue).toBe(2);
    expect(getWreckRunSnapshot(600, 2, true)).toMatchObject({
      bossOrdinalDue: 3,
      shouldSpawnBoss: false,
      isOvertime: true,
    });
  });

  it("backs off ordinary spawns during a boss while keeping hard caps", () => {
    const standard = getWreckRunSnapshot(400, 2, false);
    const boss = getWreckRunSnapshot(600, 2, true);

    expect(boss.spawnIntervalMs).toBeGreaterThan(standard.spawnIntervalMs);
    expect(boss.maxOrdinaryEnemies).toBe(24);
    expect(boss.maxProjectiles).toBe(60);
  });

  it("marks overtime until the final boss is defeated", () => {
    expect(
      getWreckRunSnapshot(WRECK_RUN_FINAL_BOSS_TIME_SECONDS, 2, false)
        .isOvertime,
    ).toBe(true);
    expect(getWreckRunSnapshot(700, 3, false).isOvertime).toBe(false);
    expect(WRECK_RUN_RULESET_VERSION).toBe("wreck-run-v1.0.0-rc.1");
  });
});
