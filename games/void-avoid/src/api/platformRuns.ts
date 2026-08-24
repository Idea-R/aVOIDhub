import {
  createRunSeed,
} from '../game/run/seededRandom';
import type { RunEvidence, VoidAvoidRunManifest } from '@avoid/voidavoid-contract';

type RunTicket = {
  runId: string;
  ticket: string;
  manifest?: VoidAvoidRunManifest;
};

export type FinishRunResult =
  | { status: 'saved'; receiptUrl: string | null }
  | { status: 'local'; receiptUrl: null }
  | { status: 'rejected'; receiptUrl: null }
  | { status: 'error'; receiptUrl: null };

let currentRun: RunTicket | null = null;

function platformUrl(path: string): string {
  const base = (import.meta.env.VITE_AVOID_PLATFORM_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function platformFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(platformUrl(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

export async function beginPlatformRun(): Promise<VoidAvoidRunManifest | null> {
  currentRun = null;
  try {
    const response = await platformFetch('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({ gameKey: 'voidavoid', mode: 'endless' }),
    });
    if (!response.ok) return null;
    const run = await response.json() as RunTicket;
    if (!run.manifest || run.manifest.runId !== run.runId) return null;
    currentRun = run;
    return run.manifest;
  } catch {
    return null;
  }
}

export function localRunSeed(): number {
  return createRunSeed();
}

export async function finishPlatformRun(evidence: RunEvidence): Promise<FinishRunResult> {
  const run = currentRun;
  if (!run) return { status: 'local', receiptUrl: null };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await platformFetch(`/api/v1/runs/${run.runId}/finish`, {
      method: 'POST',
      body: JSON.stringify({
        ticket: run.ticket,
        score: evidence.final.total,
        metrics: {},
        evidence,
      }),
    }).catch(() => null);
    if (response?.ok) {
      const result = await response.json().catch(() => ({})) as { receiptUrl?: string | null };
      if (currentRun?.runId === run.runId) currentRun = null;
      return { status: 'saved', receiptUrl: result.receiptUrl ?? null };
    }
    if (response && response.status < 500) {
      if (currentRun?.runId === run.runId) currentRun = null;
      return { status: 'rejected', receiptUrl: null };
    }
  }
  return { status: 'error', receiptUrl: null };
}
