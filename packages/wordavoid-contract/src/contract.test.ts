import { describe, expect, it } from 'vitest'
import {
  createWordAvoidManifest,
  createWordAvoidPrompt,
  normalizeWordAvoidInput,
  TIME_ATTACK_DURATION_MS,
  validateWordAvoidRun,
  WORDAVOID_DICTIONARY,
  WORDAVOID_DICTIONARY_COUNTS,
  WORDAVOID_DICTIONARY_HASH,
  type WordAvoidRunEvent,
  type WordAvoidRunEvidence,
  type WordAvoidRunManifest,
} from './index'

const SEED = 'wd1-seed-000000000001'

function manifest(mode: 'classic' | 'timeAttack' = 'timeAttack'): WordAvoidRunManifest {
  return createWordAvoidManifest({ runId: `run-${mode}`, seed: SEED, mode })
}

function evidenceHeader(run: WordAvoidRunManifest, events: WordAvoidRunEvent[]): WordAvoidRunEvidence {
  return {
    runId: run.runId,
    rulesetVersion: run.rulesetVersion,
    dictionaryVersion: run.dictionaryVersion,
    dictionaryHash: run.dictionaryHash,
    normalizationVersion: run.normalizationVersion,
    events,
  }
}

function appendCompletedPrompt(
  events: WordAvoidRunEvent[],
  run: WordAvoidRunManifest,
  sequence: number,
  spawnAtMs: number,
): number {
  const prompt = createWordAvoidPrompt(run.seed, sequence)
  events.push({ type: 'spawn', sequence, promptId: prompt.promptId, atMs: spawnAtMs })
  let atMs = spawnAtMs
  for (const key of prompt.text) {
    atMs += 25
    events.push({ type: 'attempt', sequence, key, atMs })
  }
  return atMs
}

function appendMissedPrompt(
  events: WordAvoidRunEvent[],
  run: WordAvoidRunManifest,
  sequence: number,
  atMs: number,
): number {
  const prompt = createWordAvoidPrompt(run.seed, sequence)
  events.push({ type: 'spawn', sequence, promptId: prompt.promptId, atMs })
  events.push({ type: 'miss', sequence, atMs: atMs + 50 })
  return atMs + 50
}

describe('deterministic WORDaVOID prompts', () => {
  it('freezes a substantial five-tier dictionary and content hash', () => {
    expect(WORDAVOID_DICTIONARY).toHaveLength(1770)
    expect(WORDAVOID_DICTIONARY_COUNTS).toEqual({ easy: 418, medium: 555, hard: 501, extreme: 269, boss: 27 })
    expect(WORDAVOID_DICTIONARY_HASH).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same random-access prompt for the same seed and sequence', () => {
    for (let sequence = 0; sequence < 500; sequence += 1) {
      expect(createWordAvoidPrompt(SEED, sequence)).toEqual(createWordAvoidPrompt(SEED, sequence))
    }
  })

  it('changes the sequence when the seed changes', () => {
    const first = Array.from({ length: 20 }, (_, sequence) => createWordAvoidPrompt(SEED, sequence))
    const second = Array.from({ length: 20 }, (_, sequence) => createWordAvoidPrompt('wd1-seed-000000000002', sequence))
    expect(second).not.toEqual(first)
  })

  it('normalizes only one ASCII letter', () => {
    expect(normalizeWordAvoidInput('A')).toBe('a')
    expect(normalizeWordAvoidInput('ａ')).toBe('a')
    expect(normalizeWordAvoidInput('ab')).toBeNull()
    expect(normalizeWordAvoidInput('7')).toBeNull()
  })
})

describe('WORDaVOID server recomputation', () => {
  it('recomputes a Time Attack result and excludes a pause from active duration', () => {
    const run = manifest('timeAttack')
    const events: WordAvoidRunEvent[] = []
    appendCompletedPrompt(events, run, 0, 0)
    events.push({ type: 'pause', atMs: 1_000 })
    events.push({ type: 'resume', atMs: 2_000 })
    events.push({ type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS + 1_000 })

    const first = validateWordAvoidRun(run, evidenceHeader(run, events))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.summary).toMatchObject({
      wordsCompleted: 1,
      wordsMissed: 0,
      accuracy: 100,
      maxStreak: 1,
      activeDurationMs: TIME_ATTACK_DURATION_MS,
      terminalReason: 'timer',
    })

    expect(validateWordAvoidRun(run, {
      ...evidenceHeader(run, events),
      summary: first.summary,
    })).toEqual(first)
  })

  it('recomputes maximum streak, misses, health, and a Classic health terminal', () => {
    const run = manifest('classic')
    const events: WordAvoidRunEvent[] = []
    let atMs = appendCompletedPrompt(events, run, 0, 0)
    atMs = appendCompletedPrompt(events, run, 1, atMs + 100)
    atMs = appendMissedPrompt(events, run, 2, atMs + 100)
    atMs = appendCompletedPrompt(events, run, 3, atMs + 100)
    for (let sequence = 4; sequence <= 12; sequence += 1) {
      atMs = appendMissedPrompt(events, run, sequence, atMs + 100)
    }
    events.push({ type: 'finish', reason: 'health', atMs: atMs + 1 })

    const result = validateWordAvoidRun(run, evidenceHeader(run, events))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.summary).toMatchObject({
      wordsCompleted: 3,
      wordsMissed: 10,
      maxStreak: 2,
      health: 0,
      terminalReason: 'health',
    })
    expect(result.summary.charactersAttempted).toBe(result.summary.charactersCorrect)
    expect(result.summary.score).toBeGreaterThan(0)
  })

  it.each([
    ['run identity', (run: WordAvoidRunManifest, value: WordAvoidRunEvidence) => ({ ...value, runId: `${run.runId}-altered` }), 'run_identity_mismatch'],
    ['ruleset', (_run: WordAvoidRunManifest, value: WordAvoidRunEvidence) => ({ ...value, rulesetVersion: 'wordavoid-v0' }), 'ruleset_mismatch'],
    ['dictionary', (_run: WordAvoidRunManifest, value: WordAvoidRunEvidence) => ({ ...value, dictionaryHash: '0'.repeat(64) }), 'dictionary_mismatch'],
  ])('rejects an altered %s', (_label, mutate, expectedCode) => {
    const run = manifest('timeAttack')
    const events: WordAvoidRunEvent[] = [{ type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS }]
    const result = validateWordAvoidRun(run, mutate(run, evidenceHeader(run, events)))
    expect(result).toMatchObject({ ok: false, errors: expect.arrayContaining([{ code: expectedCode }]) })
  })

  it('rejects an altered prompt ID', () => {
    const run = manifest('timeAttack')
    const events: WordAvoidRunEvent[] = [
      { type: 'spawn', sequence: 0, promptId: 'wa-altered', atMs: 0 },
      { type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS },
    ]
    expect(validateWordAvoidRun(run, evidenceHeader(run, events))).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([{ code: 'prompt_mismatch', eventIndex: 0 }]),
    })
  })

  it('rejects sequence gaps, out-of-order time, duplicate finish, and invalid input', () => {
    const run = manifest('timeAttack')
    const prompt = createWordAvoidPrompt(run.seed, 0)
    const events: WordAvoidRunEvent[] = [
      { type: 'spawn', sequence: 1, promptId: prompt.promptId, atMs: 10 },
      { type: 'attempt', sequence: null, key: '7', atMs: 9 },
      { type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS },
      { type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS },
    ]
    const result = validateWordAvoidRun(run, evidenceHeader(run, events))
    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'spawn_sequence_invalid' }),
        expect.objectContaining({ code: 'timestamp_out_of_order' }),
        expect.objectContaining({ code: 'input_invalid' }),
        expect.objectContaining({ code: 'finish_duplicate' }),
      ]),
    })
  })

  it('rejects a client summary that changes any recomputed aggregate', () => {
    const run = manifest('timeAttack')
    const events: WordAvoidRunEvent[] = [{ type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS }]
    const valid = validateWordAvoidRun(run, evidenceHeader(run, events))
    expect(valid.ok).toBe(true)
    if (!valid.ok) return
    const result = validateWordAvoidRun(run, {
      ...evidenceHeader(run, events),
      summary: { ...valid.summary, score: valid.summary.score + 1 },
    })
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'summary_mismatch', field: 'score' }] })
  })
})
