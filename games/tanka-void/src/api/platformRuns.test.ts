import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTankaVOIDManifest,
  TANKAVOID_MODE,
  TANKAVOID_RULESET_VERSION,
} from "@avoid/tankavoid-contract";
import type { RunSnapshot } from "../game/types";
import {
  beginTankaVOIDRun,
  createTankaVOIDEvidence,
  finishTankaVOIDRun,
  resetTankaVOIDPlatformRunForTests,
} from "./platformRuns";

const snapshot = {
  phase: "complete",
  completionReason: "run-cleared",
  combatTicks: 1_800,
  tank: { health: 196 },
  stats: {
    wavesCleared: 5,
    enemiesDisabled: 9,
    commanderDisabled: true,
    damageDealt: 1_170,
    damageTaken: 80,
    armorRepaired: 56,
    shotsFired: 75,
    hits: 60,
    ricochets: 4,
  },
} as RunSnapshot;

describe("TankaVOID platform run adapter", () => {
  beforeEach(() => {
    resetTankaVOIDPlatformRunForTests();
    vi.restoreAllMocks();
  });

  it("falls back to the supplied local seed when no platform session exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const result = await beginTankaVOIDRun(42);
    expect(result).toMatchObject({
      persistence: "local",
      manifest: { seed: 42 },
    });
    expect(result.manifest.runId).toMatch(/^local-[a-f0-9]{24}$/);
  });

  it("uses the server seed and submits no browser-owned score", async () => {
    const manifest = createTankaVOIDManifest({
      runId: "platform-run",
      seed: 99,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: manifest.runId,
            ticket: "a".repeat(48),
            manifest,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            acceptedScore: 3_330,
            receiptUrl: "/results/00000000-0000-4000-8000-000000000001/",
            verificationLevel: "provisional",
            validationCapability: "bounds_recomputed",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(beginTankaVOIDRun(42)).resolves.toEqual({
      manifest,
      persistence: "platform",
    });
    const evidence = createTankaVOIDEvidence(manifest, snapshot);
    expect(evidence).toMatchObject({
      runId: manifest.runId,
      mode: TANKAVOID_MODE,
      rulesetVersion: TANKAVOID_RULESET_VERSION,
      summary: { commanderDisabled: true, combatTicks: 1_800 },
    });
    if (!evidence) return;
    await expect(finishTankaVOIDRun(evidence)).resolves.toMatchObject({
      status: "saved",
      acceptedScore: 3_330,
      verificationLevel: "provisional",
      validationCapability: "bounds_recomputed",
    });

    const finishBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(finishBody).toEqual({ ticket: "a".repeat(48), evidence });
    expect(finishBody).not.toHaveProperty("score");
  });

  it("never submits development systems-check results", () => {
    const manifest = createTankaVOIDManifest({ runId: "local-run", seed: 7 });
    expect(
      createTankaVOIDEvidence(manifest, {
        ...snapshot,
        completionReason: "systems-check",
      }),
    ).toBeNull();
  });
});
