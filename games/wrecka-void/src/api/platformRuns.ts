import { supabase, supabaseConfigured } from "../lib/supabase";

type RunTicket = { runId: string; ticket: string };
let currentRun: Promise<RunTicket | null> | null = null;

function platformUrl(path: string): string {
  const base = (import.meta.env.VITE_AVOID_PLATFORM_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function authenticatedFetch(path: string, init: RequestInit): Promise<Response | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return fetch(platformUrl(path), {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init.headers },
  });
}

export function beginPlatformRun(): void {
  if (!supabaseConfigured) {
    currentRun = Promise.resolve(null);
    return;
  }
  currentRun = (async () => {
    const response = await authenticatedFetch('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({ gameKey: 'wreckavoid', mode: 'survival' }),
    });
    if (!response?.ok) return null;
    return response.json() as Promise<RunTicket>;
  })().catch(() => null);
}

export async function finishPlatformRun(score: number, wave: number, survivalTime: number): Promise<boolean> {
  const run = await currentRun;
  currentRun = null;
  if (!run) return false;
  const response = await authenticatedFetch(`/api/v1/runs/${run.runId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ ticket: run.ticket, score, metrics: { wave, survival_time: survivalTime } }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

