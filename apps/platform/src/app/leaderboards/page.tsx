import type { Metadata } from 'next'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { rankedGameRegistry, type RankedGameKey } from '@/lib/games/registry'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leaderboards' }

type ScoreRow = {
  id: string
  player_name: string
  score: number
  game_key: string
  verification_level: string
  created_at: string
}

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const requested = (await searchParams).game
  const gameKey: RankedGameKey = requested && requested in rankedGameRegistry ? (requested as RankedGameKey) : 'voidavoid'
  let scores: ScoreRow[] = []
  let unavailable = !isPlatformRuntimeConfigured()

  if (!unavailable) {
    const admin = createAdminClient()
    const query =
      gameKey === 'tankavoid'
        ? admin
            .from('leaderboard_scores')
            .select('id, player_name, score, game_key, verification_level, created_at, submission:score_submissions!inner(status, mode)')
            .eq('game_key', gameKey)
            .eq('submission.status', 'accepted')
            .eq('submission.mode', 'five-wave')
            .order('score', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(50)
        : admin
            .from('leaderboard_scores')
            .select('id, player_name, score, game_key, verification_level, created_at')
            .eq('game_key', gameKey)
            .order('score', { ascending: false })
            .limit(50)
    const { data, error } = await query
    scores = (data ?? []) as ScoreRow[]
    unavailable = Boolean(error)
  }

  return (
    <PlatformPage
      eyebrow="/ shared competition"
      title={
        <>
          Runs worth
          <br />
          <em>believing.</em>
        </>
      }
      intro="One board per game, with the trust level shown instead of hidden. Provisional means the browser reported it; verified means the run was independently checked."
    >
      <nav className="gameTabs" aria-label="Choose a leaderboard">
        {(Object.keys(rankedGameRegistry) as RankedGameKey[]).map((key) => (
          <a key={key} href={`/leaderboards/?game=${key}`} aria-current={key === gameKey ? 'page' : undefined}>
            {rankedGameRegistry[key].name}
          </a>
        ))}
      </nav>
      <section className="leaderboardPanel">
        <div className="leaderboardHead">
          <span>Rank / player</span>
          <span>Trust</span>
          <span>Score</span>
        </div>
        {unavailable && <p className="emptyState">The board is staged but not connected on this preview.</p>}
        {!unavailable && !scores.length && <p className="emptyState">No accepted runs yet. The first honest score gets the loudest row.</p>}
        {scores.map((row, index) => (
          <div className="leaderboardRow" key={row.id}>
            <span>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <strong>{row.player_name}</strong>
            </span>
            <span className={`trustPill trust-${row.verification_level}`}>{row.verification_level}</span>
            <strong>{row.score.toLocaleString()}</strong>
          </div>
        ))}
      </section>
    </PlatformPage>
  )
}
