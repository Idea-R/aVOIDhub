export const WRECK_RUN_MODE = "wreck-run";
export const WRECK_RUN_RULESET_VERSION = "wreck-run-v1.0.0-rc.1";
export const WRECK_RUN_FINAL_BOSS_TIME_SECONDS = 600;
export const WRECK_RUN_WAVE_CLEAR_BONUS = 10_000;
export const WRECK_RUN_BOSS_BREAK_BONUS = 100_000;

const BOSS_CHECKPOINTS_SECONDS = [
  150,
  330,
  WRECK_RUN_FINAL_BOSS_TIME_SECONDS,
] as const;
const ACT_SPAWN_INTERVALS_MS = [760, 580, 440] as const;
const ACT_ENEMY_CAPS = [18, 22, 24] as const;
const ACT_PROJECTILE_CAPS = [36, 48, 60] as const;

export interface WreckRunSnapshot {
  act: 1 | 2 | 3;
  wave: number;
  spawnIntervalMs: number;
  maxOrdinaryEnemies: number;
  maxProjectiles: number;
  bossPhase: boolean;
  bossOrdinalDue: 1 | 2 | 3 | null;
  shouldSpawnBoss: boolean;
  isOvertime: boolean;
}

export function getWreckRunSnapshot(
  gameTimeSeconds: number,
  bossesDefeated: number,
  bossActive: boolean,
): WreckRunSnapshot {
  const safeTime = Math.max(0, gameTimeSeconds);
  const safeBosses = Math.max(0, Math.min(3, Math.floor(bossesDefeated)));
  const act = Math.min(3, safeBosses + 1) as 1 | 2 | 3;
  const nextCheckpoint = BOSS_CHECKPOINTS_SECONDS[safeBosses];
  const bossOrdinalDue =
    safeBosses < 3 && nextCheckpoint !== undefined && safeTime >= nextCheckpoint
      ? ((safeBosses + 1) as 1 | 2 | 3)
      : null;
  const bossPhase = bossActive || bossOrdinalDue !== null;
  const baseSpawnInterval = ACT_SPAWN_INTERVALS_MS[act - 1];

  return {
    act,
    wave: Math.min(20, Math.floor(safeTime / 30) + 1),
    spawnIntervalMs: bossPhase
      ? Math.round(baseSpawnInterval * 1.65)
      : baseSpawnInterval,
    maxOrdinaryEnemies: ACT_ENEMY_CAPS[act - 1],
    maxProjectiles: ACT_PROJECTILE_CAPS[act - 1],
    bossPhase,
    bossOrdinalDue,
    shouldSpawnBoss: bossOrdinalDue !== null && !bossActive,
    isOvertime: safeTime >= WRECK_RUN_FINAL_BOSS_TIME_SECONDS && safeBosses < 3,
  };
}
