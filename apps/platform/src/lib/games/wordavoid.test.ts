import { describe, expect, it } from 'vitest'
import {
  createWordAvoidPrompt,
  TIME_ATTACK_DURATION_MS,
  type WordAvoidRunEvent,
  type WordAvoidRunEvidence,
} from '@avoid/wordavoid-contract'
import {
  validateWordAvoidFinish,
  wordAvoidManifestFromRun,
  wordAvoidValidationMetadata,
} from './wordavoid'

const seed = 'platform-seed-000000001'
const run = {
  id: 'platform-run-id',
  mode: 'timeAttack',
  ruleset_version: 'wordavoid-v1.0.0-rc.1',
  client_metadata: { wordavoidValidation: wordAvoidValidationMetadata(seed) },
}

describe('platform WORDaVOID validation adapter', () => {
  it('reconstructs only a complete server-owned manifest', () => {
    expect(wordAvoidManifestFromRun(run)).toMatchObject({
      runId: run.id,
      seed,
      mode: 'timeAttack',
    })
    expect(wordAvoidManifestFromRun({ ...run, mode: 'perfectRun' })).toBeNull()
    expect(wordAvoidManifestFromRun({ ...run, client_metadata: {} })).toBeNull()
  })

  it('recomputes evidence using the stored seed instead of client aggregates', () => {
    const manifest = wordAvoidManifestFromRun(run)
    expect(manifest).not.toBeNull()
    if (!manifest) return
    const prompt = createWordAvoidPrompt(seed, 0)
    const events: WordAvoidRunEvent[] = [
      { type: 'spawn', sequence: 0, promptId: prompt.promptId, atMs: 0 },
      ...[...prompt.text].map((key, index) => ({
        type: 'attempt' as const,
        sequence: 0,
        key,
        atMs: (index + 1) * 25,
      })),
      { type: 'finish', reason: 'timer', atMs: TIME_ATTACK_DURATION_MS },
    ]
    const evidence: WordAvoidRunEvidence = {
      runId: manifest.runId,
      rulesetVersion: manifest.rulesetVersion,
      dictionaryVersion: manifest.dictionaryVersion,
      dictionaryHash: manifest.dictionaryHash,
      normalizationVersion: manifest.normalizationVersion,
      events,
    }

    const result = validateWordAvoidFinish(run, evidence)
    expect(result?.validation.ok).toBe(true)
    if (!result?.validation.ok) return
    expect(result.validation.summary.score).toBeGreaterThan(0)
    expect(result.validation.summary.charactersCorrect).toBe(prompt.text.length)
  })
})
