import { describe, expect, it } from "vitest";
import {
  validateWreckAvoidFinish,
  WRECKAVOID_MODE,
  WRECKAVOID_RULESET_VERSION,
} from "./wreckavoid";

const run = {
  mode: WRECKAVOID_MODE,
  ruleset_version: WRECKAVOID_RULESET_VERSION,
};

describe("WreckaVOID finish validation", () => {
  it("accepts a coherent final-boss victory", () => {
    expect(
      validateWreckAvoidFinish(run, 542_500, {
        wave: 20,
        survival_time: 615.25,
        bosses_defeated: 3,
        outcome: "victory",
      }),
    ).toMatchObject({
      score: 542_500,
      metrics: {
        rulesetVersion: WRECKAVOID_RULESET_VERSION,
        validationCapability: "bounds_recomputed",
      },
    });
  });

  it("accepts a coherent defeat before the first checkpoint", () => {
    expect(
      validateWreckAvoidFinish(run, 30_900, {
        wave: 4,
        survival_time: 95,
        bosses_defeated: 0,
        outcome: "defeat",
      }),
    ).not.toBeNull();
  });

  it("rejects impossible waves, premature victories, and mismatched rulesets", () => {
    expect(
      validateWreckAvoidFinish(run, 190_900, {
        wave: 20,
        survival_time: 95,
        bosses_defeated: 0,
        outcome: "defeat",
      }),
    ).toBeNull();
    expect(
      validateWreckAvoidFinish(run, 490_900, {
        wave: 20,
        survival_time: 599,
        bosses_defeated: 3,
        outcome: "victory",
      }),
    ).toBeNull();
    expect(
      validateWreckAvoidFinish({ ...run, ruleset_version: "old" }, 30_900, {
        wave: 4,
        survival_time: 95,
        bosses_defeated: 0,
        outcome: "defeat",
      }),
    ).toBeNull();
  });

  it("rejects a score that omits mandatory progress bonuses", () => {
    expect(
      validateWreckAvoidFinish(run, 750, {
        wave: 4,
        survival_time: 95,
        bosses_defeated: 0,
        outcome: "defeat",
      }),
    ).toBeNull();
  });
});
