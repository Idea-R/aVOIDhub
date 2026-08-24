import { describe, expect, it } from 'vitest'
import { TANKAVOID_MODE, TANKAVOID_RULESET_VERSION, type TankaVOIDRunEvidence } from '@avoid/tankavoid-contract'
import { tankaVOIDManifestFromRun, tankaVOIDValidationMetadata, validateTankaVOIDFinish } from './tankavoid'

const run = {
  id: 'platform-run-id',
  mode: TANKAVOID_MODE,
  ruleset_version: TANKAVOID_RULESET_VERSION,
  client_metadata: {
    tankavoidValidation: tankaVOIDValidationMetadata(4_294_967_295),
  },
}

const evidence: TankaVOIDRunEvidence = {
  runId: run.id,
  mode: TANKAVOID_MODE,
  rulesetVersion: TANKAVOID_RULESET_VERSION,
  summary: {
    completionReason: 'run-cleared',
    wavesCleared: 5,
    enemiesDisabled: 9,
    commanderDisabled: true,
    combatTicks: 1_800,
    damageDealt: 1_170,
    damageTaken: 80,
    armorRepaired: 56,
    shotsFired: 75,
    hits: 60,
    ricochets: 4,
    tankHealth: 196,
  },
}

describe('platform TankaVOID validation adapter', () => {
  it('reconstructs only the exact server-owned manifest', () => {
    expect(tankaVOIDManifestFromRun(run)).toEqual({
      runId: run.id,
      seed: 4_294_967_295,
      mode: TANKAVOID_MODE,
      rulesetVersion: TANKAVOID_RULESET_VERSION,
    })
    expect(tankaVOIDManifestFromRun({ ...run, mode: 'endless' })).toBeNull()
    expect(tankaVOIDManifestFromRun({ ...run, client_metadata: {} })).toBeNull()
  })

  it('recomputes the score from a bounded terminal summary', () => {
    expect(validateTankaVOIDFinish(run, evidence)).toMatchObject({
      validation: { ok: true, score: 3_330 },
    })
  })

  it('rejects impossible browser-authored totals', () => {
    const result = validateTankaVOIDFinish(run, {
      ...evidence,
      summary: { ...evidence.summary, wavesCleared: 5, enemiesDisabled: 8 },
    })
    expect(result?.validation.ok).toBe(false)
  })
})
