import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWordAvoidManifest, type WordAvoidRunEvidence, type WordAvoidRunSummary } from '@avoid/wordavoid-contract';

import { beginPlatformRun, finishPlatformRun } from './platformRuns';

const manifest = createWordAvoidManifest({
  runId: '00000000-0000-4000-8000-000000000001',
  seed: 'wordavoid-retry-seed-0001',
  mode: 'classic',
});

const summary: WordAvoidRunSummary = {
  score: 0,
  wordsCompleted: 0,
  wordsMissed: 10,
  charactersAttempted: 0,
  charactersCorrect: 0,
  maxStreak: 0,
  accuracy: 100,
  wpm: 0,
  activeDurationMs: 1_000,
  level: 2,
  health: 0,
  terminalReason: 'health',
};

const evidence: WordAvoidRunEvidence = {
  runId: manifest.runId,
  rulesetVersion: manifest.rulesetVersion,
  dictionaryVersion: manifest.dictionaryVersion,
  dictionaryHash: manifest.dictionaryHash,
  normalizationVersion: manifest.normalizationVersion,
  events: [],
  summary,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform run retry boundary', () => {
  it('retries the same finish after a lost response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId: manifest.runId,
        ticket: 'a'.repeat(43),
        manifest,
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockRejectedValueOnce(new TypeError('network_lost'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ submissionId: 'receipt' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await beginPlatformRun('classic')).toEqual(manifest);
    expect(await finishPlatformRun(summary, evidence)).toEqual({ status: 'saved' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('authorization');
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[2][0]);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[2][1]?.body);
  });

  it('does not retry a terminal client rejection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId: manifest.runId,
        ticket: 'b'.repeat(43),
        manifest,
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'run_evidence_rejected' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await beginPlatformRun('classic')).toEqual(manifest);
    expect(await finishPlatformRun(summary, evidence)).toEqual({ status: 'rejected' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not let an older finish clear a newer run ticket', async () => {
    let releaseFirstFinish: ((response: Response) => void) | undefined;
    const firstFinish = new Promise<Response>((resolve) => {
      releaseFirstFinish = resolve;
    });
    const secondManifest = createWordAvoidManifest({
      runId: '00000000-0000-4000-8000-000000000002',
      seed: 'wordavoid-retry-seed-0002',
      mode: 'classic',
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId: manifest.runId,
        ticket: 'c'.repeat(43),
        manifest,
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockReturnValueOnce(firstFinish)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId: secondManifest.runId,
        ticket: 'd'.repeat(43),
        manifest: secondManifest,
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ submissionId: 'second' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await beginPlatformRun('classic');
    const olderFinish = finishPlatformRun(summary, evidence);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await beginPlatformRun('classic');
    releaseFirstFinish?.(new Response(JSON.stringify({ submissionId: 'first' }), { status: 200 }));
    await expect(olderFinish).resolves.toEqual({ status: 'saved' });

    const secondEvidence = { ...evidence, runId: secondManifest.runId };
    await expect(finishPlatformRun(summary, secondEvidence)).resolves.toEqual({ status: 'saved' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
