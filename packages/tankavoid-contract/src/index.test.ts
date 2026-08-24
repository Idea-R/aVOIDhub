import { describe, expect, it } from "vitest";
import {
  calculateTankaVOIDScore,
  createTankaVOIDManifest,
  TANKAVOID_MODE,
  TANKAVOID_MAX_SCORE,
  TANKAVOID_RULESET_VERSION,
  validateTankaVOIDRun,
  type TankaVOIDRunEvidence,
} from "./index";

const manifest = createTankaVOIDManifest({ runId: "run-1", seed: 0xffff_ffff });
const clearEvidence: TankaVOIDRunEvidence = {
  runId: "run-1",
  mode: TANKAVOID_MODE,
  rulesetVersion: TANKAVOID_RULESET_VERSION,
  summary: {
    completionReason: "run-cleared",
    wavesCleared: 5,
    enemiesDisabled: 9,
    commanderDisabled: true,
    combatTicks: 1_800,
    damageDealt: 1_170,
    damageTaken: 80,
    armorRepaired: 56,
    shotsFired: 75,
    hits: 60,
    ricochets: 4,
    tankHealth: 196,
  },
};

describe("TankaVOID platform contract", () => {
  it("creates the exact server manifest", () => {
    expect(manifest).toEqual({
      runId: "run-1",
      seed: 0xffff_ffff,
      mode: "five-wave",
      rulesetVersion: "tankavoid-v1-rules-1",
    });
  });

  it("recomputes the frozen additive score", () => {
    expect(calculateTankaVOIDScore(clearEvidence.summary)).toBe(3_330);
    expect(validateTankaVOIDRun(manifest, clearEvidence)).toEqual({
      ok: true,
      score: 3_330,
      summary: clearEvidence.summary,
    });
  });

  it("keeps the published maximum aligned with every bounded component", () => {
    expect(
      calculateTankaVOIDScore({
        ...clearEvidence.summary,
        damageDealt: 1_270,
        combatTicks: 72_000,
      }),
    ).toBe(TANKAVOID_MAX_SCORE);
    expect(TANKAVOID_MAX_SCORE).toBe(5_770);
  });

  it("accepts an honest partial defeat", () => {
    const evidence: TankaVOIDRunEvidence = {
      ...clearEvidence,
      summary: {
        ...clearEvidence.summary,
        completionReason: "player-disabled",
        wavesCleared: 2,
        enemiesDisabled: 3,
        commanderDisabled: false,
        combatTicks: 3_600,
        damageDealt: 310,
        tankHealth: 0,
      },
    };
    expect(validateTankaVOIDRun(manifest, evidence)).toMatchObject({
      ok: true,
      score: 1055,
    });
  });

  it.each([
    [
      "wrong run",
      { ...clearEvidence, runId: "run-2" },
      "run_identity_mismatch",
    ],
    [
      "impossible clear",
      {
        ...clearEvidence,
        summary: { ...clearEvidence.summary, enemiesDisabled: 8 },
      },
      "summary_inconsistent",
    ],
    [
      "living defeat",
      {
        ...clearEvidence,
        summary: {
          ...clearEvidence.summary,
          completionReason: "player-disabled",
          wavesCleared: 4,
          tankHealth: 1,
        },
      },
      "summary_inconsistent",
    ],
    [
      "commander too early",
      {
        ...clearEvidence,
        summary: {
          ...clearEvidence.summary,
          completionReason: "player-disabled",
          wavesCleared: 2,
          enemiesDisabled: 4,
          tankHealth: 0,
        },
      },
      "summary_inconsistent",
    ],
    [
      "unbounded duration",
      {
        ...clearEvidence,
        summary: { ...clearEvidence.summary, combatTicks: 72_001 },
      },
      "summary_out_of_bounds",
    ],
  ])("rejects %s", (_label, evidence, code) => {
    const result = validateTankaVOIDRun(manifest, evidence);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((error) => error.code === code)).toBe(true);
  });
});
