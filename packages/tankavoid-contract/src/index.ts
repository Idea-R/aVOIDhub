export const TANKAVOID_RULESET_VERSION = "tankavoid-v1-rules-1";
export const TANKAVOID_MODE = "five-wave";
export const TANKAVOID_WAVE_COUNT = 5;
export const TANKAVOID_ENEMY_COUNT = 9;
export const TANKAVOID_NORMAL_ENEMY_COUNT = 8;
export const TANKAVOID_FIXED_STEP_HZ = 60;
export const TANKAVOID_MAX_COMBAT_TICKS = 20 * 60 * TANKAVOID_FIXED_STEP_HZ;
export const TANKAVOID_MAX_DAMAGE_DEALT = 1_270;
export const TANKAVOID_MAX_DAMAGE_TAKEN = 332;
export const TANKAVOID_MAX_ARMOR_REPAIRED = 112;
export const TANKAVOID_MAX_SHOTS = 4_000;
export const TANKAVOID_MAX_SCORE = 5_770;

export type TankaVOIDMode = typeof TANKAVOID_MODE;
export type TankaVOIDCompletionReason = "run-cleared" | "player-disabled";

export interface TankaVOIDRunManifest {
  runId: string;
  seed: number;
  mode: TankaVOIDMode;
  rulesetVersion: typeof TANKAVOID_RULESET_VERSION;
}

export interface TankaVOIDRunSummary {
  completionReason: TankaVOIDCompletionReason;
  wavesCleared: number;
  enemiesDisabled: number;
  commanderDisabled: boolean;
  combatTicks: number;
  damageDealt: number;
  damageTaken: number;
  armorRepaired: number;
  shotsFired: number;
  hits: number;
  ricochets: number;
  tankHealth: number;
}

export interface TankaVOIDRunEvidence {
  runId: string;
  mode: TankaVOIDMode;
  rulesetVersion: typeof TANKAVOID_RULESET_VERSION;
  summary: TankaVOIDRunSummary;
}

export type TankaVOIDValidationErrorCode =
  | "invalid_manifest"
  | "invalid_evidence"
  | "run_identity_mismatch"
  | "mode_mismatch"
  | "ruleset_mismatch"
  | "summary_out_of_bounds"
  | "summary_inconsistent";

export interface TankaVOIDValidationError {
  code: TankaVOIDValidationErrorCode;
  field?: keyof TankaVOIDRunSummary;
}

export type TankaVOIDValidationResult =
  | { ok: true; score: number; summary: TankaVOIDRunSummary }
  | { ok: false; errors: TankaVOIDValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    Number.isInteger(value) &&
    typeof value === "number" &&
    value >= minimum &&
    value <= maximum
  );
}

export function isTankaVOIDSeed(value: unknown): value is number {
  return isIntegerInRange(value, 0, 0xffff_ffff);
}

export function isTankaVOIDMode(value: unknown): value is TankaVOIDMode {
  return value === TANKAVOID_MODE;
}

export function createTankaVOIDManifest(input: {
  runId: string;
  seed: number;
  mode?: TankaVOIDMode;
}): TankaVOIDRunManifest {
  if (input.runId.length < 1 || input.runId.length > 128)
    throw new Error("invalid_run_id");
  if (!isTankaVOIDSeed(input.seed)) throw new Error("invalid_run_seed");
  if (input.mode !== undefined && !isTankaVOIDMode(input.mode))
    throw new Error("invalid_run_mode");
  return {
    runId: input.runId,
    seed: input.seed,
    mode: TANKAVOID_MODE,
    rulesetVersion: TANKAVOID_RULESET_VERSION,
  };
}

export function calculateTankaVOIDScore(summary: TankaVOIDRunSummary): number {
  const normalEnemies =
    summary.enemiesDisabled - (summary.commanderDisabled ? 1 : 0);
  return (
    Math.floor(summary.damageDealt) +
    normalEnemies * 75 +
    summary.wavesCleared * 200 +
    (summary.completionReason === "run-cleared" ? 500 : 0) +
    Math.floor(summary.combatTicks / TANKAVOID_FIXED_STEP_HZ) * 2
  );
}

function parseManifest(value: unknown): TankaVOIDRunManifest | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.runId !== "string" ||
    value.runId.length < 1 ||
    value.runId.length > 128
  )
    return null;
  if (!isTankaVOIDSeed(value.seed) || !isTankaVOIDMode(value.mode)) return null;
  if (value.rulesetVersion !== TANKAVOID_RULESET_VERSION) return null;
  return value as unknown as TankaVOIDRunManifest;
}

function parseEvidence(value: unknown): TankaVOIDRunEvidence | null {
  if (!isRecord(value) || !isRecord(value.summary)) return null;
  if (typeof value.runId !== "string" || !isTankaVOIDMode(value.mode))
    return null;
  if (value.rulesetVersion !== TANKAVOID_RULESET_VERSION) return null;
  return value as unknown as TankaVOIDRunEvidence;
}

function validateSummary(
  value: TankaVOIDRunSummary,
): TankaVOIDValidationError[] {
  const errors: TankaVOIDValidationError[] = [];
  const integerBounds: Array<[keyof TankaVOIDRunSummary, number, number]> = [
    ["wavesCleared", 0, TANKAVOID_WAVE_COUNT],
    ["enemiesDisabled", 0, TANKAVOID_ENEMY_COUNT],
    ["combatTicks", 0, TANKAVOID_MAX_COMBAT_TICKS],
    ["damageDealt", 0, TANKAVOID_MAX_DAMAGE_DEALT],
    ["damageTaken", 0, TANKAVOID_MAX_DAMAGE_TAKEN],
    ["armorRepaired", 0, TANKAVOID_MAX_ARMOR_REPAIRED],
    ["shotsFired", 0, TANKAVOID_MAX_SHOTS],
    ["hits", 0, TANKAVOID_MAX_SHOTS],
    ["ricochets", 0, TANKAVOID_MAX_SHOTS],
    ["tankHealth", 0, 220],
  ];
  for (const [field, minimum, maximum] of integerBounds) {
    if (!isIntegerInRange(value[field], minimum, maximum)) {
      errors.push({ code: "summary_out_of_bounds", field });
    }
  }
  if (
    value.completionReason !== "run-cleared" &&
    value.completionReason !== "player-disabled"
  ) {
    errors.push({ code: "summary_out_of_bounds", field: "completionReason" });
  }
  if (typeof value.commanderDisabled !== "boolean") {
    errors.push({ code: "summary_out_of_bounds", field: "commanderDisabled" });
  }
  if (errors.length > 0) return errors;

  const minimumKills = [0, 1, 2, 4, 6, 9][value.wavesCleared];
  const maximumKills = [1, 2, 4, 6, 9, 9][value.wavesCleared];
  if (
    value.enemiesDisabled < minimumKills ||
    value.enemiesDisabled > maximumKills
  ) {
    errors.push({ code: "summary_inconsistent", field: "enemiesDisabled" });
  }
  if (value.hits > value.shotsFired)
    errors.push({ code: "summary_inconsistent", field: "hits" });
  if (value.ricochets > value.hits)
    errors.push({ code: "summary_inconsistent", field: "ricochets" });
  if (value.damageDealt > 0 && value.hits === 0)
    errors.push({ code: "summary_inconsistent", field: "damageDealt" });
  if (
    value.commanderDisabled &&
    (value.wavesCleared < 4 || value.enemiesDisabled < 7)
  ) {
    errors.push({ code: "summary_inconsistent", field: "commanderDisabled" });
  }
  if (!value.commanderDisabled && value.wavesCleared === 5) {
    errors.push({ code: "summary_inconsistent", field: "commanderDisabled" });
  }
  if (value.completionReason === "run-cleared") {
    if (value.wavesCleared !== 5)
      errors.push({ code: "summary_inconsistent", field: "wavesCleared" });
    if (value.enemiesDisabled !== 9)
      errors.push({ code: "summary_inconsistent", field: "enemiesDisabled" });
    if (!value.commanderDisabled)
      errors.push({ code: "summary_inconsistent", field: "commanderDisabled" });
    if (value.tankHealth <= 0)
      errors.push({ code: "summary_inconsistent", field: "tankHealth" });
  } else {
    if (value.wavesCleared >= 5)
      errors.push({ code: "summary_inconsistent", field: "wavesCleared" });
    if (value.tankHealth !== 0)
      errors.push({ code: "summary_inconsistent", field: "tankHealth" });
  }
  return errors;
}

export function validateTankaVOIDRun(
  manifestValue: unknown,
  evidenceValue: unknown,
): TankaVOIDValidationResult {
  const manifest = parseManifest(manifestValue);
  if (!manifest) return { ok: false, errors: [{ code: "invalid_manifest" }] };
  const evidence = parseEvidence(evidenceValue);
  if (!evidence) return { ok: false, errors: [{ code: "invalid_evidence" }] };
  const headerErrors: TankaVOIDValidationError[] = [];
  if (evidence.runId !== manifest.runId)
    headerErrors.push({ code: "run_identity_mismatch" });
  if (evidence.mode !== manifest.mode)
    headerErrors.push({ code: "mode_mismatch" });
  if (evidence.rulesetVersion !== manifest.rulesetVersion)
    headerErrors.push({ code: "ruleset_mismatch" });
  if (headerErrors.length > 0) return { ok: false, errors: headerErrors };
  const errors = validateSummary(evidence.summary);
  if (errors.length > 0) return { ok: false, errors };
  const score = calculateTankaVOIDScore(evidence.summary);
  if (score < 0 || score > TANKAVOID_MAX_SCORE) {
    return { ok: false, errors: [{ code: "summary_out_of_bounds" }] };
  }
  return { ok: true, score, summary: evidence.summary };
}
