import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { WRECKAVOID_RULESET_VERSION } from '@/lib/games/wreckavoid'
import { publicScores, type BoardSelection, type PublicBoard, type StoredScore } from './contract'

export async function readPublicBoard(selection: BoardSelection): Promise<PublicBoard> {
  const { game, mode } = selection
  try {
    let query = createAdminClient().from('leaderboard_scores')
      .select('id, user_id, player_name, score, verification_level, metadata, created_at, submission:score_submissions!inner(status, mode)')
      .eq('game_key', game).eq('submission.status', 'accepted').eq('submission.mode', mode)
    if (game === 'wreckavoid') query = query.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
    const current = await query.order('score', { ascending: false }).order('created_at', { ascending: true }).limit(200)
    if (!current.error) return { ...selection, scores: publicScores((current.data ?? []) as StoredScore[]), observedAt: new Date().toISOString(), legacy: false }
  } catch {
    // Missing server configuration must not prevent already-public legacy rows
    // from being read anonymously under their existing RLS policy.
  }
  // Existing legacy public rows only; never use visitor cookies or a service role
  // for this fallback, and never include new pending/rejected receipt rows.
  const anonymous = createPublicClient()
  let oldQuery = anonymous.from('leaderboard_scores').select('id, user_id, player_name, score, metadata, created_at')
    .eq('game_key', game).is('submission_id', null).contains('metadata', { mode })
  if (game === 'wreckavoid') oldQuery = oldQuery.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
  const old = await oldQuery.order('score', { ascending: false }).order('created_at', { ascending: true }).limit(200)
  if (old.error) throw new Error('leaderboard_unavailable')
  return { ...selection, scores: publicScores((old.data ?? []) as StoredScore[], true), observedAt: new Date().toISOString(), legacy: true }
}
// No request headers, cookies or personal data. Partition persisted data by project.
export const getPublicBoard = unstable_cache(
  async (game: BoardSelection['game'], mode: string, _projectUrl: string) => readPublicBoard({ game, mode }),
  ['public-leaderboard-v1', WRECKAVOID_RULESET_VERSION], { revalidate: 60 },
)
export async function readPersonalBest(userId: string, { game, mode }: BoardSelection): Promise<number | null> {
  let query = createAdminClient().from('leaderboard_scores')
    .select('score, submission:score_submissions!inner(status, mode)').eq('game_key', game).eq('user_id', userId)
    .eq('submission.status', 'accepted').eq('submission.mode', mode)
  if (game === 'wreckavoid') query = query.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
  const { data, error } = await query.order('score', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('personal_best_unavailable')
  return typeof data?.score === 'number' ? data.score : null
}
