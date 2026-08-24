import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { rankedGameRegistry, type RankedGameKey } from '@/lib/games/registry'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Saved game result',
  robots: { index: false, follow: false },
}

type Submission = {
  id: string
  game_key: string
  mode: string
  ruleset_version: string
  score: number
  metrics: Record<string, unknown>
  verification_level: string
  status: string
  created_at: string
}

function metric(metrics: Record<string, unknown>, key: string): string {
  const value = metrics[key]
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString()
  return '—'
}

export default async function ResultReceiptPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params
  if (!z.string().uuid().safeParse(submissionId).success) notFound()

  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage
        eyebrow="/ saved result"
        title={
          <>
            Receipts wait for
            <br />
            <em>the platform runtime.</em>
          </>
        }
        intro="This build has the receipt surface, but its isolated score database has not been activated here."
      >
        <section className="platformPanel">
          <p className="emptyState">No result data was requested from an unconfigured database.</p>
        </section>
      </PlatformPage>
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('score_submissions')
    .select('id, game_key, mode, ruleset_version, score, metrics, verification_level, status, created_at')
    .eq('id', submissionId)
    .eq('status', 'accepted')
    .single()
  if (error || !data) notFound()
  const submission = data as Submission
  const { data: boardRow } = await admin.from('leaderboard_scores').select('player_name').eq('submission_id', submission.id).maybeSingle()
  const gameKey = submission.game_key as RankedGameKey
  const game = gameKey in rankedGameRegistry ? rankedGameRegistry[gameKey] : null
  const playerName = typeof boardRow?.player_name === 'string' ? boardRow.player_name : 'player'
  const isTankaVOID = submission.game_key === 'tankavoid'

  return (
    <PlatformPage
      eyebrow="/ immutable run receipt"
      title={
        <>
          {playerName}&apos;s
          <br />
          <em>{game?.name ?? 'aVOID'} result.</em>
        </>
      }
      intro="A saved result with its ruleset and trust level left visible. Provisional means the platform checked the ticket, bounds, and score math—not a full replay."
    >
      <article className="resultReceipt">
        <header>
          <div>
            <span>{game?.name ?? submission.game_key}</span>
            <strong>{submission.score.toLocaleString()}</strong>
          </div>
          <em className={`trustPill trust-${submission.verification_level}`}>{submission.verification_level}</em>
        </header>
        <dl className="resultReceiptFacts">
          <div>
            <dt>Player</dt>
            <dd>{playerName}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{submission.mode}</dd>
          </div>
          <div>
            <dt>Ruleset</dt>
            <dd>{submission.ruleset_version}</dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>
              {new Date(submission.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </dd>
          </div>
        </dl>
        {isTankaVOID && (
          <section className="resultReceiptMetrics" aria-label="TankaVOID run facts">
            <div>
              <span>Waves cleared</span>
              <strong>{metric(submission.metrics, 'wavesCleared')} / 5</strong>
            </div>
            <div>
              <span>Hostiles disabled</span>
              <strong>{metric(submission.metrics, 'enemiesDisabled')} / 9</strong>
            </div>
            <div>
              <span>Damage dealt</span>
              <strong>{metric(submission.metrics, 'damageDealt')}</strong>
            </div>
            <div>
              <span>Shots / hits</span>
              <strong>
                {metric(submission.metrics, 'shotsFired')} / {metric(submission.metrics, 'hits')}
              </strong>
            </div>
            <div>
              <span>Commander disabled</span>
              <strong>{metric(submission.metrics, 'commanderDisabled')}</strong>
            </div>
            <div>
              <span>Hull remaining</span>
              <strong>{metric(submission.metrics, 'tankHealth')}</strong>
            </div>
          </section>
        )}
        <footer>
          <span>Receipt {submission.id}</span>
          {game && <Link href={`/games/${gameKey}/`}>Back to {game.name}</Link>}
        </footer>
      </article>
    </PlatformPage>
  )
}
