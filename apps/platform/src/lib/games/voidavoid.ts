import {
  VOIDAVOID_RULESET,
  createVoidAvoidManifest,
  verifyRunEvidence,
  type RunEvidence,
  type VoidAvoidRunManifest,
} from '@avoid/voidavoid-contract'

interface VoidAvoidRunRecord {
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

export function voidAvoidManifestFromRun(run: VoidAvoidRunRecord): VoidAvoidRunManifest | null {
  const metadata = record(run.client_metadata)
  const validation = record(metadata?.voidavoidValidation)
  if (run.mode !== 'endless' || run.ruleset_version !== VOIDAVOID_RULESET) return null
  if (!validation || !Number.isInteger(validation.seed)) return null
  const seed = Number(validation.seed)
  if (seed < 0 || seed > 0xffffffff) return null
  return createVoidAvoidManifest(run.id, seed)
}

export function validateVoidAvoidFinish(
  run: VoidAvoidRunRecord,
  evidence: unknown,
): { manifest: VoidAvoidRunManifest; validation: ReturnType<typeof verifyRunEvidence> } | null {
  const manifest = voidAvoidManifestFromRun(run)
  const candidate = record(evidence)
  if (!manifest || !candidate || candidate.seed !== manifest.seed || candidate.ruleset !== manifest.rulesetVersion) return null
  try {
    return { manifest, validation: verifyRunEvidence(evidence as RunEvidence) }
  } catch {
    return null
  }
}

export function voidAvoidValidationMetadata(seed: number) {
  return { seed, rulesetVersion: VOIDAVOID_RULESET }
}
