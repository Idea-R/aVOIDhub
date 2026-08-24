import type { Metadata } from 'next'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { rankedGameRegistry, type RankedGameKey } from '@/lib/games/registry'
import { WRECKAVOID_RULESET_VERSION } from '@/lib/games/wreckavoid'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leaderboards' }

type ScoreRow = { id: string; player_name: string; score: number; game_key: string; verification_level: string; created_at: string }
type LegacyScoreRow = Omit<ScoreRow, 'verification_level'> & { is_verified: boolean }

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const requested = (await searchParams).game
  const gameKey: RankedGameKey = requested && requested in rankedGameRegistry ? requested as RankedGameKey : 'voidavoid'
  let scores: ScoreRow[] = []
  let unavailable = !isPlatformRuntimeConfigured()

  if (!unavailable) {
    const supabase = await createClient()
    let currentQuery = supabase
      .from('leaderboard_scores')
      .select('id, player_name, score, game_key, verification_level, created_at')
      .eq('game_key', gameKey)

    if (gameKey === 'wreckavoid') {
      currentQuery = currentQuery.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
    }

    const currentResult = await currentQuery
      .order('score', { ascending: false })
      .limit(50)

    if (!currentResult.error) {
      scores = (currentResult.data ?? []) as ScoreRow[]
    } else {
      let legacyQuery = supabase
        .from('leaderboard_scores')
        .select('id, player_name, score, game_key, is_verified, created_at')
        .eq('game_key', gameKey)

      if (gameKey === 'wreckavoid') {
        legacyQuery = legacyQuery.contains('metadata', { rulesetVersion: WRECKAVOID_RULESET_VERSION })
      }

      const legacyResult = await legacyQuery
        .order('score', { ascending: false })
        .limit(50)

      scores = ((legacyResult.data ?? []) as LegacyScoreRow[]).map(({ is_verified: _untrustedLegacyFlag, ...row }) => ({
        ...row,
        verification_level: 'legacy',
      }))
      unavailable = Boolean(legacyResult.error)
    }
  }

  return (
    <PlatformPage eyebrow="/ shared competition" title={<>Runs worth<br /><em>believing.</em></>} intro="One board per game, with the trust level shown instead of hidden. Provisional means the browser reported it; verified means the run was independently checked.">
      <nav className="gameTabs" aria-label="Choose a leaderboard">
        {(Object.keys(rankedGameRegistry) as RankedGameKey[]).map((key) => <a key={key} href={`/leaderboards/?game=${key}`} aria-current={key === gameKey ? 'page' : undefined}>{rankedGameRegistry[key].name}</a>)}
      </nav>
      <section className="leaderboardPanel">
        <div className="leaderboardHead"><span>Rank / player</span><span>Trust</span><span>Score</span></div>
        {unavailable && <p className="emptyState">The leaderboard cannot reach Supabase right now.</p>}
        {!unavailable && !scores.length && <p className="emptyState">No accepted runs yet. The first one takes the top row.</p>}
        {scores.map((row, index) => (
          <div className="leaderboardRow" key={row.id}>
            <span><i>{String(index + 1).padStart(2, '0')}</i><strong>{row.player_name}</strong></span>
            <span className={`trustPill trust-${row.verification_level}`}>{row.verification_level}</span>
            <strong>{row.score.toLocaleString()}</strong>
          </div>
        ))}
      </section>
    </PlatformPage>
  )
}

