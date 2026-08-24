import { describe, expect, it } from 'vitest'
import {
  FIXED_STEP_HZ,
  RUN_EVIDENCE_VERSION,
  RUN_RANDOM_ALGORITHM,
  VOIDAVOID_RULESET,
  computeEvidenceIntegrity,
  type RunEvidence,
} from '@avoid/voidavoid-contract'
import { validateVoidAvoidFinish, voidAvoidManifestFromRun, voidAvoidValidationMetadata } from './voidavoid'

const seed = 0x12345678
const run = {
  id: '00000000-0000-4000-8000-000000000001',
  mode: 'endless',
  ruleset_version: VOIDAVOID_RULESET,
  client_metadata: { voidavoidValidation: voidAvoidValidationMetadata(seed) },
}

function evidenceFor(runSeed = seed): RunEvidence {
  const unsigned: Omit<RunEvidence, 'integrity'> = {
    version: RUN_EVIDENCE_VERSION,
    ruleset: VOIDAVOID_RULESET,
    randomAlgorithm: RUN_RANDOM_ALGORITHM,
    seed: runSeed,
    viewport: { width: 1280, height: 720, pixelRatio: 1 },
    fixedStepHz: FIXED_STEP_HZ,
    durationTicks: 600,
    events: [],
    truncated: false,
    final: { survival: 50, meteors: 0, combos: 0, total: 50 },
    randomDraws: { world: 0, 'power-up': 0, chain: 0, score: 0, defense: 0 },
  }
  return { ...unsigned, integrity: computeEvidenceIntegrity(unsigned) }
}

describe('platform VOIDaVOID validation adapter', () => {
  it('reconstructs a server-owned manifest', () => {
    expect(voidAvoidManifestFromRun(run)).toEqual({ runId: run.id, seed, rulesetVersion: VOIDAVOID_RULESET })
    expect(voidAvoidManifestFromRun({ ...run, mode: 'custom' })).toBeNull()
    expect(voidAvoidManifestFromRun({ ...run, client_metadata: {} })).toBeNull()
  })

  it('accepts replayable evidence tied to the server seed', () => {
    expect(validateVoidAvoidFinish(run, evidenceFor())?.validation).toMatchObject({ valid: true })
  })

  it('rejects evidence created for another seed', () => {
    expect(validateVoidAvoidFinish(run, evidenceFor(seed + 1))).toBeNull()
  })
})
