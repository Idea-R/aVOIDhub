import {
  createWordAvoidManifest,
  validateWordAvoidRun,
  WORDAVOID_DICTIONARY_HASH,
  WORDAVOID_DICTIONARY_VERSION,
  WORDAVOID_NORMALIZATION_VERSION,
  WORDAVOID_RULESET_VERSION,
  type WordAvoidRunManifest,
  type WordAvoidValidationResult,
} from '@avoid/wordavoid-contract'

interface WordAvoidRunRecord {
  id: string
  mode: string
  ruleset_version: string
  client_metadata: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function wordAvoidManifestFromRun(run: WordAvoidRunRecord): WordAvoidRunManifest | null {
  const metadata = record(run.client_metadata)
  const validation = record(metadata?.wordavoidValidation)
  if (!validation || typeof validation.seed !== 'string') return null
  if (run.mode !== 'classic' && run.mode !== 'timeAttack') return null
  if (run.ruleset_version !== WORDAVOID_RULESET_VERSION) return null
  if (validation.dictionaryVersion !== WORDAVOID_DICTIONARY_VERSION) return null
  if (validation.dictionaryHash !== WORDAVOID_DICTIONARY_HASH) return null
  if (validation.normalizationVersion !== WORDAVOID_NORMALIZATION_VERSION) return null

  try {
    return createWordAvoidManifest({ runId: run.id, seed: validation.seed, mode: run.mode })
  } catch {
    return null
  }
}

export function validateWordAvoidFinish(
  run: WordAvoidRunRecord,
  evidence: unknown,
): { manifest: WordAvoidRunManifest; validation: WordAvoidValidationResult } | null {
  const manifest = wordAvoidManifestFromRun(run)
  if (!manifest) return null
  return { manifest, validation: validateWordAvoidRun(manifest, evidence) }
}

export function wordAvoidValidationMetadata(seed: string) {
  return {
    seed,
    dictionaryVersion: WORDAVOID_DICTIONARY_VERSION,
    dictionaryHash: WORDAVOID_DICTIONARY_HASH,
    normalizationVersion: WORDAVOID_NORMALIZATION_VERSION,
  }
}
