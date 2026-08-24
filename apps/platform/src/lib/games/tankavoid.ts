import {
  createTankaVOIDManifest,
  TANKAVOID_RULESET_VERSION,
  validateTankaVOIDRun,
  type TankaVOIDRunManifest,
  type TankaVOIDValidationResult,
} from '@avoid/tankavoid-contract'

interface TankaVOIDRunRecord {
  id: string
  mode: string
  ruleset_version: string
  client_metadata: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function tankaVOIDManifestFromRun(run: TankaVOIDRunRecord): TankaVOIDRunManifest | null {
  const metadata = record(run.client_metadata)
  const validation = record(metadata?.tankavoidValidation)
  if (!validation || typeof validation.seed !== 'number') return null
  if (run.mode !== 'five-wave' || run.ruleset_version !== TANKAVOID_RULESET_VERSION) return null
  try {
    return createTankaVOIDManifest({ runId: run.id, seed: validation.seed })
  } catch {
    return null
  }
}

export function validateTankaVOIDFinish(
  run: TankaVOIDRunRecord,
  evidence: unknown,
): {
  manifest: TankaVOIDRunManifest
  validation: TankaVOIDValidationResult
} | null {
  const manifest = tankaVOIDManifestFromRun(run)
  if (!manifest) return null
  return { manifest, validation: validateTankaVOIDRun(manifest, evidence) }
}

export function tankaVOIDValidationMetadata(seed: number) {
  return { seed }
}
