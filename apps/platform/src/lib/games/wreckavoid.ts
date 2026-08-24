export const WRECKAVOID_MODE = "wreck-run";
export const WRECKAVOID_RULESET_VERSION = "wreck-run-v1.0.0-rc.1";
export const WRECKAVOID_WAVE_CLEAR_BONUS = 10_000;
export const WRECKAVOID_BOSS_BREAK_BONUS = 100_000;

type WreckRun = {
  mode: string;
  ruleset_version: string;
};

type Scalar = string | number | boolean | null;

export type WreckAvoidAcceptedFinish = {
  score: number;
  metrics: Record<string, Scalar>;
};

function finiteNumber(value: Scalar | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function validateWreckAvoidFinish(
  run: WreckRun,
  score: number | undefined,
  metrics: Record<string, Scalar>,
): WreckAvoidAcceptedFinish | null {
  if (
    run.mode !== WRECKAVOID_MODE ||
    run.ruleset_version !== WRECKAVOID_RULESET_VERSION
  )
    return null;
  if (
    score === undefined ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 2_000_000
  )
    return null;

  const wave = finiteNumber(metrics.wave);
  const survivalTime = finiteNumber(metrics.survival_time);
  const bossesDefeated = finiteNumber(metrics.bosses_defeated);
  const outcome = metrics.outcome;

  if (
    wave === null ||
    survivalTime === null ||
    bossesDefeated === null ||
    !Number.isInteger(wave) ||
    !Number.isInteger(bossesDefeated) ||
    survivalTime < 0 ||
    survivalTime > 1_200 ||
    bossesDefeated < 0 ||
    bossesDefeated > 3 ||
    (outcome !== "defeat" && outcome !== "victory")
  ) {
    return null;
  }

  const expectedWave = Math.min(20, Math.floor(survivalTime / 30) + 1);
  if (wave !== expectedWave) return null;
  const minimumProgressScore =
    (wave - 1) * WRECKAVOID_WAVE_CLEAR_BONUS +
    bossesDefeated * WRECKAVOID_BOSS_BREAK_BONUS;
  if (score < minimumProgressScore) return null;
  if (outcome === "victory" && (bossesDefeated !== 3 || survivalTime < 600))
    return null;
  if (outcome === "defeat" && bossesDefeated === 3) return null;

  return {
    score,
    metrics: {
      wave,
      survival_time: survivalTime,
      bosses_defeated: bossesDefeated,
      outcome,
      rulesetVersion: WRECKAVOID_RULESET_VERSION,
      validationCapability: "bounds_recomputed",
    },
  };
}
