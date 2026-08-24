import {
  calculateTankaVOIDScore,
  createTankaVOIDManifest,
  TANKAVOID_MODE,
  TANKAVOID_RULESET_VERSION,
  type TankaVOIDRunEvidence,
  type TankaVOIDRunManifest,
  type TankaVOIDRunSummary,
} from "@avoid/tankavoid-contract";
import type { RunSnapshot } from "../game/types";

interface PlatformRunTicket {
  runId: string;
  ticket: string;
  manifest?: TankaVOIDRunManifest;
}

interface PlatformFinishResponse {
  acceptedScore?: number;
  receiptUrl?: string;
  verificationLevel?: string;
  validationCapability?: string;
}

export type TankaVOIDRunStart = {
  manifest: TankaVOIDRunManifest;
  persistence: "platform" | "local";
};

export type TankaVOIDFinishResult =
  | {
      status: "saved";
      acceptedScore: number;
      receiptUrl: string;
      verificationLevel: "provisional";
      validationCapability: "bounds_recomputed";
    }
  | { status: "local"; score: number }
  | { status: "rejected"; score: number }
  | { status: "error"; score: number };

let currentRun: PlatformRunTicket | null = null;
let beginGeneration = 0;

function localRunId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `local-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function localStart(seed: number): TankaVOIDRunStart {
  return {
    manifest: createTankaVOIDManifest({ runId: localRunId(), seed }),
    persistence: "local",
  };
}

async function platformFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export async function beginTankaVOIDRun(
  localSeed: number,
): Promise<TankaVOIDRunStart> {
  const generation = ++beginGeneration;
  currentRun = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_800);
  try {
    const response = await platformFetch("/api/v1/runs", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({ gameKey: "tankavoid", mode: TANKAVOID_MODE }),
    });
    if (!response.ok) return localStart(localSeed);
    const run = (await response.json()) as PlatformRunTicket;
    if (
      !run.manifest ||
      run.manifest.runId !== run.runId ||
      run.manifest.mode !== TANKAVOID_MODE ||
      run.manifest.rulesetVersion !== TANKAVOID_RULESET_VERSION
    )
      return localStart(localSeed);
    if (generation !== beginGeneration) return localStart(localSeed);
    createTankaVOIDManifest(run.manifest);
    currentRun = run;
    return { manifest: run.manifest, persistence: "platform" };
  } catch {
    return localStart(localSeed);
  } finally {
    clearTimeout(timeout);
  }
}

export function createTankaVOIDEvidence(
  manifest: TankaVOIDRunManifest,
  snapshot: RunSnapshot,
): TankaVOIDRunEvidence | null {
  if (
    snapshot.phase !== "complete" ||
    (snapshot.completionReason !== "run-cleared" &&
      snapshot.completionReason !== "player-disabled")
  )
    return null;
  const summary: TankaVOIDRunSummary = {
    completionReason: snapshot.completionReason,
    wavesCleared: snapshot.stats.wavesCleared,
    enemiesDisabled: snapshot.stats.enemiesDisabled,
    commanderDisabled: snapshot.stats.commanderDisabled,
    combatTicks: snapshot.combatTicks,
    damageDealt: Math.floor(snapshot.stats.damageDealt),
    damageTaken: Math.round(snapshot.stats.damageTaken),
    armorRepaired: Math.round(snapshot.stats.armorRepaired),
    shotsFired: snapshot.stats.shotsFired,
    hits: snapshot.stats.hits,
    ricochets: snapshot.stats.ricochets,
    tankHealth: Math.round(snapshot.tank.health),
  };
  return {
    runId: manifest.runId,
    mode: manifest.mode,
    rulesetVersion: manifest.rulesetVersion,
    summary,
  };
}

export async function finishTankaVOIDRun(
  evidence: TankaVOIDRunEvidence,
): Promise<TankaVOIDFinishResult> {
  const score = calculateTankaVOIDScore(evidence.summary);
  const run = currentRun;
  if (!run || run.runId !== evidence.runId) return { status: "local", score };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await platformFetch(`/api/v1/runs/${run.runId}/finish`, {
      method: "POST",
      body: JSON.stringify({ ticket: run.ticket, evidence }),
    }).catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as PlatformFinishResponse;
      if (currentRun?.runId === run.runId) currentRun = null;
      if (
        typeof body.acceptedScore !== "number" ||
        typeof body.receiptUrl !== "string" ||
        body.verificationLevel !== "provisional" ||
        body.validationCapability !== "bounds_recomputed"
      )
        return { status: "error", score };
      return {
        status: "saved",
        acceptedScore: body.acceptedScore,
        receiptUrl: body.receiptUrl,
        verificationLevel: body.verificationLevel,
        validationCapability: body.validationCapability,
      };
    }
    if (response && response.status < 500) {
      if (currentRun?.runId === run.runId) currentRun = null;
      return { status: "rejected", score };
    }
  }
  return { status: "error", score };
}

export function resetTankaVOIDPlatformRunForTests(): void {
  currentRun = null;
  beginGeneration += 1;
}
