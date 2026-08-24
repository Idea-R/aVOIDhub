import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIXED_STEP_HZ,
  RUN_EVIDENCE_VERSION,
  RUN_RANDOM_ALGORITHM,
  VOIDAVOID_RULESET,
  computeEvidenceIntegrity,
  type RunEvidence,
} from '@avoid/voidavoid-contract';
import { beginPlatformRun, finishPlatformRun } from './platformRuns';

const manifest = {
  runId: '00000000-0000-4000-8000-000000000001',
  seed: 42,
  rulesetVersion: VOIDAVOID_RULESET,
};

const unsigned: Omit<RunEvidence, 'integrity'> = {
  version: RUN_EVIDENCE_VERSION,
  ruleset: VOIDAVOID_RULESET,
  randomAlgorithm: RUN_RANDOM_ALGORITHM,
  seed: manifest.seed,
  viewport: { width: 800, height: 600, pixelRatio: 1 },
  fixedStepHz: FIXED_STEP_HZ,
  durationTicks: 60,
  events: [],
  truncated: false,
  final: { survival: 5, meteors: 0, combos: 0, total: 5 },
  randomDraws: { world: 0, 'power-up': 0, chain: 0, score: 0, defense: 0 },
};
const evidence = { ...unsigned, integrity: computeEvidenceIntegrity(unsigned) };

afterEach(() => vi.unstubAllGlobals());

describe('VOIDaVOID platform run adapter', () => {
  it('uses the same-origin session and preserves the ticket through a retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: manifest.runId, ticket: 'a'.repeat(43), manifest }), { status: 201 }))
      .mockRejectedValueOnce(new TypeError('network_lost'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ receiptUrl: '/results/receipt/' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(beginPlatformRun()).resolves.toEqual(manifest);
    await expect(finishPlatformRun(evidence)).resolves.toEqual({ status: 'saved', receiptUrl: '/results/receipt/' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[2][1]?.body);
  });

  it('keeps guest play local when no platform ticket is issued', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(beginPlatformRun()).resolves.toBeNull();
    await expect(finishPlatformRun(evidence)).resolves.toEqual({ status: 'local', receiptUrl: null });
  });
});
