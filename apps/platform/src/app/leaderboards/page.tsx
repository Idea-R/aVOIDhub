import type { Metadata } from 'next'
import { PlatformPage } from '@/components/PlatformPage'
import { getGameById } from '@/data/games'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { rankedGameRegistry, type RankedGameKey } from '@/lib/games/registry'
import { WRECKAVOID_RULESET_VERSION } from '@/lib/games/wreckavoid'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leaderboards', alternates: { canonical: '/leaderboards' } }

const availableGameKeys = (Object.keys(rankedGameRegistry) as RankedGameKey[])
  .filter(key => getGameById(key)?.status === 'playable')

type ScoreRow = { id: string; user_id: string | null; player_name: string; score: number; game_key: string; verification_level: string; metadata: Record<string, unknown>; created_at: string }
type LegacyScoreRow = Omit<ScoreRow, 'verification_level'> & { is_verified: boolean }

function bestPerPlayer(rows: ScoreRow[]): ScoreRow[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const identity = row.user_id ?? `legacy:${row.player_name.toLowerCase()}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  }).slice(0, 50)
}

function trustLabel(row: ScoreRow): string {
  return row.metadata?.validationCapability === 'server_recomputed'
    ? 'server replay'
    : row.metadata?.validationCapability === 'bounds_recomputed'
      ? 'bounded'
      : row.verification_level
}

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ game?: string; mode?: string }> }) {
  const params = await searchParams
  const requested = params.game
  const gameKey: RankedGameKey = requested && availableGameKeys.includes(requested as RankedGameKey) ? requested as RankedGameKey : 'voidavoid'
  const game = rankedGameRegistry[gameKey]
  const requestedMode = params.mode
  const mode = game.modes.some(({ key }) => key === requestedMode) ? requestedMode as string : game.modes[0].key
  let scores: ScoreRow[] = []
  let unavailable = !isPlatformRuntimeConfigured()

  if (!unavailable) {
    const supabase = await createClient()
    let currentQuery = supabase
      .from('leaderboard_scores')
      .select('id, user_id, player_name, score, game_key, verification_level, metadata, created_at, submission:score_submissions!inner(status, mode)')
      .eq('game_key', gameKey)
      .eq('submission.status', 'accepted')
      .eq('submission.mode', mode)

    if (gameKey === 'wreckavoid') {
      currentQuery = currentQuery.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
    }

    const currentResult = await currentQuery
      .order('score', { ascending: false })
      .limit(200)

    if (!currentResult.error) {
      scores = bestPerPlayer((currentResult.data ?? []) as ScoreRow[])
    } else {
      let legacyQuery = supabase
        .from('leaderboard_scores')
        .select('id, user_id, player_name, score, game_key, is_verified, metadata, created_at')
        .eq('game_key', gameKey)
        .contains('metadata', { mode })

      if (gameKey === 'wreckavoid') {
        legacyQuery = legacyQuery.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
      }

      const legacyResult = await legacyQuery
        .order('score', { ascending: false })
        .limit(200)

      scores = bestPerPlayer(((legacyResult.data ?? []) as LegacyScoreRow[]).map(({ is_verified: _untrustedLegacyFlag, ...row }) => ({
        ...row,
        verification_level: 'legacy',
      })))
      unavailable = Boolean(legacyResult.error)
    }
  }

  return (
    <PlatformPage eyebrow="/ shared competition" title={<>Runs worth<br /><em>believing.</em></>} intro="Compare runs from games with platform scoring. Each board keeps its own rules. Scores remain provisional while anti-cheat checks are being improved.">
      <nav className="gameTabs" aria-label="Choose a leaderboard">
        {availableGameKeys.map((key) => <a key={key} href={`/leaderboards/?game=${key}`} aria-current={key === gameKey ? 'page' : undefined}>{rankedGameRegistry[key].name}</a>)}
      </nav>
      {game.modes.length > 1 && (
        <nav className="gameTabs" aria-label="Choose a game mode">
          {game.modes.map((option) => <a key={option.key} href={`/leaderboards/?game=${gameKey}&mode=${option.key}`} aria-current={option.key === mode ? 'page' : undefined}>{option.label}</a>)}
        </nav>
      )}
      <section className="leaderboardPanel">
        <div className="leaderboardHead"><span>Rank / player</span><span>Trust</span><span>Score</span></div>
        {unavailable && <p className="emptyState">The live board is currently unavailable. Please try again later.</p>}
        {!unavailable && !scores.length && <p className="emptyState">No accepted runs yet. Play and submit a run to get on the board.</p>}
        {scores.map((row, index) => (
          <div className="leaderboardRow" key={row.id}>
            <span><i>{String(index + 1).padStart(2, '0')}</i><strong>{row.player_name}</strong></span>
            <span className={`trustPill trust-${row.verification_level}`}>{trustLabel(row)}</span>
            <strong>{row.score.toLocaleString()}</strong>
          </div>
        ))}
      </section>
    </PlatformPage>
  )
}

