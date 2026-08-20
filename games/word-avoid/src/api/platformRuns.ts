import {
  createWordAvoidManifest,
  isWordAvoidV1Mode,
  type WordAvoidRunEvidence,
  type WordAvoidRunManifest,
  type WordAvoidRunSummary,
} from '@avoid/wordavoid-contract';

type RunTicket = {
  runId: string;
  ticket: string;
  manifest?: WordAvoidRunManifest;
};

export type FinishRunResult =
  | { status: 'saved' }
  | { status: 'local' }
  | { status: 'rejected' }
  | { status: 'error' };

let currentRun: RunTicket | null = null;

function platformUrl(path: string): string {
  const base = (import.meta.env.VITE_AVOID_PLATFORM_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function authenticatedFetch(path: string, init: RequestInit): Promise<Response | null> {
  const { supabase, supabaseConfigured } = await import('../lib/supabase');
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  return fetch(platformUrl(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

export function createLocalWordAvoidManifest(mode: string): WordAvoidRunManifest | null {
  if (!isWordAvoidV1Mode(mode)) return null;
  const token = randomToken();
  return createWordAvoidManifest({ runId: `local-${token}`, seed: token, mode });
}

export async function beginPlatformRun(mode: string): Promise<WordAvoidRunManifest | null> {
  currentRun = null;
  try {
    const response = await authenticatedFetch('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({ gameKey: 'wordavoid', mode }),
    });
    if (!response?.ok) return null;
    const run = await response.json() as RunTicket;
    if (!run.manifest || run.manifest.runId !== run.runId) return null;
    currentRun = run;
    return run.manifest;
  } catch {
    return null;
  }
}

export async function finishPlatformRun(
  summary: WordAvoidRunSummary,
  evidence: WordAvoidRunEvidence,
): Promise<FinishRunResult> {
  const run = currentRun;
  if (!run) return { status: 'local' };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await authenticatedFetch(`/api/v1/runs/${run.runId}/finish`, {
      method: 'POST',
      body: JSON.stringify({
        ticket: run.ticket,
        score: summary.score,
        metrics: summary,
        evidence,
      }),
    }).catch(() => null);
    if (response?.ok) {
      if (currentRun?.runId === run.runId) currentRun = null;
      return { status: 'saved' };
    }
    if (response && response.status < 500) {
      if (currentRun?.runId === run.runId) currentRun = null;
      return { status: 'rejected' };
    }
  }
  return { status: 'error' };
}
