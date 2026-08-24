import {
  WRECK_RUN_MODE,
  WRECK_RUN_RULESET_VERSION,
} from "../game/WreckRunDirector";
import type { GameState } from "../types/Game";

type RunTicket = { runId: string; ticket: string };
let currentRun: Promise<RunTicket | null> | null = null;

function platformUrl(path: string): string {
  const base = (import.meta.env.VITE_AVOID_PLATFORM_URL || "").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

async function authenticatedFetch(
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  return fetch(platformUrl(path), {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export function beginPlatformRun(): void {
  currentRun = (async () => {
    const response = await authenticatedFetch("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({
        gameKey: "wreckavoid",
        mode: WRECK_RUN_MODE,
        metadata: { rulesetVersion: WRECK_RUN_RULESET_VERSION },
      }),
    });
    if (!response?.ok) return null;
    return response.json() as Promise<RunTicket>;
  })().catch(() => null);
}

export async function finishPlatformRun(
  score: number,
  wave: number,
  survivalTime: number,
  bossesDefeated: number,
  outcome: GameState["runOutcome"],
): Promise<boolean> {
  const run = await currentRun;
  currentRun = null;
  if (!run) return false;
  const response = await authenticatedFetch(
    `/api/v1/runs/${run.runId}/finish`,
    {
      method: "POST",
      body: JSON.stringify({
        ticket: run.ticket,
        score,
        metrics: {
          wave,
          survival_time: survivalTime,
          bosses_defeated: bossesDefeated,
          outcome,
          rulesetVersion: WRECK_RUN_RULESET_VERSION,
        },
      }),
    },
  ).catch(() => null);
  return Boolean(response?.ok);
}
