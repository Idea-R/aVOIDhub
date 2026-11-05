import { isRankedGameKey, rankedGameRegistry, type RankedGameKey } from '../games/registry'
export type BoardSelection = { game: RankedGameKey; mode: string }
export type PublicScore = { id: string; playerName: string; score: number; trust: string; recordedAt: string }
export type PublicBoard = BoardSelection & { scores: PublicScore[]; observedAt: string; legacy: boolean }
export function resolveBoard(game: unknown, mode: unknown): BoardSelection | null {
  if (!isRankedGameKey(game)) return null
  const modes = rankedGameRegistry[game].modes
  const selected = mode ?? modes[0].key
  return typeof selected === 'string' && modes.some(item => item.key === selected) ? { game, mode: selected } : null
}
export type StoredScore = { id: string; user_id: string | null; player_name: string; score: number; verification_level?: string; metadata?: Record<string, unknown> | null; created_at: string }
export function publicScores(rows: StoredScore[], legacy = false): PublicScore[] {
  const seen = new Set<string>(), result: PublicScore[] = []
  for (const row of rows) {
    if (!Number.isFinite(row.score) || typeof row.player_name !== 'string') continue
    const identity = row.user_id ?? `legacy:${row.player_name.toLowerCase()}`
    if (seen.has(identity)) continue
    seen.add(identity)
    const trust = legacy ? 'legacy' : row.metadata?.validationCapability === 'server_recomputed' ? 'server replay'
      : row.metadata?.validationCapability === 'bounds_recomputed' ? 'bounded'
      : ['unverified', 'provisional', 'verified', 'legacy'].includes(row.verification_level ?? '') ? row.verification_level! : 'provisional'
    result.push({ id: row.id, playerName: row.player_name, score: row.score, trust, recordedAt: row.created_at })
    if (result.length === 50) break
  }
  return result
}
