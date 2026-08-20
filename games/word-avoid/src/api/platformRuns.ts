type RunTicket = { runId: string; ticket: string };

let currentRun: Promise<RunTicket | null> | null = null;

function platformUrl(path: string): string {
  const base = (import.meta.env.VITE_AVOID_PLATFORM_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function authenticatedFetch(path: string, init: RequestInit): Promise<Response | null> {
  const { supabase } = await import('../lib/supabase');
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

export function beginPlatformRun(mode: string): void {
  currentRun = (async () => {
    const response = await authenticatedFetch('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({ gameKey: 'wordavoid', mode }),
    });
    if (!response?.ok) return null;
    return response.json() as Promise<RunTicket>;
  })().catch(() => null);
}

export async function finishPlatformRun(score: number, metrics: Record<string, string | number | boolean | null>): Promise<boolean> {
  const run = await currentRun;
  currentRun = null;
  if (!run) return false;

  const response = await authenticatedFetch(`/api/v1/runs/${run.runId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ ticket: run.ticket, score, metrics }),
  }).catch(() => null);
  return Boolean(response?.ok);
}
