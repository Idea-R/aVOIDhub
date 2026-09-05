import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AlertTriangle, BadgeCheck, CircleDollarSign, Gamepad2, RadioTower, ShieldCheck, UsersRound } from 'lucide-react'
import { AdminReviewActions } from '@/components/AdminReviewActions'
import { DashboardShell } from '@/components/DashboardShell'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformAdmin } from '@/lib/auth/roles'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Platform control room', alternates: { canonical: '/admin' }, robots: { index: false, follow: false } }

type CreatorReview = {
  id: string
  display_name: string
  portfolio_url: string | null
  pitch: string
  status: string
  submitted_at: string
}

type GameReview = {
  id: string
  title: string
  game_url: string
  source_url: string | null
  summary: string
  requested_hosting: string
  status: string
  submitted_at: string | null
}

type ScoreReview = {
  id: string
  game_key: string
  mode: string
  score: number
  verification_level: string
  status: string
  created_at: string
}

const creatorActions: Record<string, Array<{ status: string; label: string }>> = {
  pending: [{ status: 'reviewing', label: 'Open review' }, { status: 'declined', label: 'Decline' }],
  reviewing: [{ status: 'approved', label: 'Approve creator' }, { status: 'declined', label: 'Decline' }],
}

const gameActions: Record<string, Array<{ status: string; label: string }>> = {
  submitted: [{ status: 'reviewing', label: 'Start inspection' }, { status: 'declined', label: 'Decline' }],
  reviewing: [
    { status: 'changes_requested', label: 'Request changes' },
    { status: 'approved', label: 'Approve review' },
    { status: 'declined', label: 'Decline' },
  ],
  changes_requested: [{ status: 'reviewing', label: 'Reopen review' }, { status: 'declined', label: 'Decline' }],
}

function PreviewControlRoom() {
  return (
    <DashboardShell active="admin" role="ADMIN PREVIEW" name="Control room" status="preview only" isAdmin>
      <div className="deckHeader">
        <div><p className="panelLabel">Operational preview</p><h2>The controls are designed.<br /><em>The keys stay server-side.</em></h2></div>
        <span className="deckStamp deckStampWarning"><AlertTriangle aria-hidden="true" /> Offline preview</span>
      </div>
      <div className="metricGrid">
        <article><UsersRound aria-hidden="true" /><span>Creator queue</span><strong>OFF</strong><small>Connect Supabase to load</small></article>
        <article><Gamepad2 aria-hidden="true" /><span>Game reviews</span><strong>OFF</strong><small>No sample records shown</small></article>
        <article><ShieldCheck aria-hidden="true" /><span>Score review</span><strong>OFF</strong><small>Connect the review queue</small></article>
        <article><CircleDollarSign aria-hidden="true" /><span>Memberships</span><strong>OFF</strong><small>Billing stays read-only here</small></article>
      </div>
      <section className="emptyControlState">
        <RadioTower aria-hidden="true" />
        <div><p className="panelLabel">Preview data</p><h3>No production records are loaded.</h3><p>When Supabase is connected, only signed-in accounts with a server-assigned admin role can open this page.</p></div>
      </section>
    </DashboardShell>
  )
}

export default async function AdminPage() {
  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage compact eyebrow="/ restricted operations" title={<>Platform<br /><em>control room.</em></>} intro="Review people, builds, payments, and score integrity without turning the back office into a gray spreadsheet.">
        <PreviewControlRoom />
      </PlatformPage>
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login/?next=/admin/')
  if (!isPlatformAdmin(userData.user)) notFound()

  const admin = createAdminClient()
  const [creatorQueue, gameQueue, scoreQueue, membershipCount] = await Promise.all([
    admin.from('creator_applications').select('id, display_name, portfolio_url, pitch, status, submitted_at').in('status', ['pending', 'reviewing']).order('submitted_at').limit(20),
    admin.from('game_submissions').select('id, title, game_url, source_url, summary, requested_hosting, status, submitted_at').in('status', ['submitted', 'reviewing', 'changes_requested']).order('submitted_at').limit(20),
    admin.from('score_submissions').select('id, game_key, mode, score, verification_level, status, created_at').eq('status', 'review').order('created_at').limit(30),
    admin.from('billing_subscriptions').select('stripe_subscription_id', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
  ])

  const creators = (creatorQueue.data ?? []) as CreatorReview[]
  const games = (gameQueue.data ?? []) as GameReview[]
  const scores = (scoreQueue.data ?? []) as ScoreReview[]
  const queueErrors = [creatorQueue.error, gameQueue.error, scoreQueue.error, membershipCount.error].filter(Boolean)

  return (
    <PlatformPage compact eyebrow="/ restricted operations" title={<>Platform<br /><em>control room.</em></>} intro="Review people, builds, payments, and score integrity without turning the back office into a gray spreadsheet.">
      <DashboardShell active="admin" role="PLATFORM ADMIN" name={userData.user.email ?? 'Administrator'} status={queueErrors.length ? 'partial signal' : 'systems responding'} isAdmin>
        <div className="deckHeader">
          <div><p className="panelLabel">Live operations</p><h2>One queue.<br /><em>Clear consequences.</em></h2></div>
          <span className="deckStamp"><BadgeCheck aria-hidden="true" /> Server authorized</span>
        </div>

        <div className="metricGrid">
          <article><UsersRound aria-hidden="true" /><span>Creator queue</span><strong>{creators.length.toString().padStart(2, '0')}</strong><small>Pending or in review</small></article>
          <article><Gamepad2 aria-hidden="true" /><span>Game reviews</span><strong>{games.length.toString().padStart(2, '0')}</strong><small>Private inspection only</small></article>
          <article><ShieldCheck aria-hidden="true" /><span>Score review</span><strong>{String(scores.length).padStart(2, '0')}</strong><small>Needs human attention</small></article>
          <article><CircleDollarSign aria-hidden="true" /><span>Memberships</span><strong>{String(membershipCount.count ?? 0).padStart(2, '0')}</strong><small>Active or trialing</small></article>
        </div>

        {queueErrors.length > 0 && <p className="deckWarning"><AlertTriangle aria-hidden="true" /> Some operational data could not be loaded. No action was taken.</p>}

        <section className="reviewQueue" aria-labelledby="creator-queue-title">
          <div className="queueHeading"><div><p className="panelLabel">Queue 01</p><h3 id="creator-queue-title">Creator applications</h3></div><span>{creators.length} open</span></div>
          {!creators.length && <p className="queueEmpty">No creators are waiting. That is a queue at rest, not fake sample data.</p>}
          {creators.map((item) => (
            <article className="reviewCard" key={item.id}>
              <div className="reviewCardIndex"><span>CREATOR</span><strong>{item.status}</strong></div>
              <div className="reviewCardBody">
                <h4>{item.display_name}</h4>
                <p>{item.pitch}</p>
                <div className="reviewLinks">{item.portfolio_url && <a href={item.portfolio_url} target="_blank" rel="noreferrer">Inspect portfolio ↗</a>}<time dateTime={item.submitted_at}>{new Date(item.submitted_at).toLocaleDateString()}</time></div>
              </div>
              <AdminReviewActions entity="creator_application" id={item.id} status={item.status} actions={creatorActions[item.status] ?? []} />
            </article>
          ))}
        </section>

        <section className="reviewQueue" aria-labelledby="game-queue-title">
          <div className="queueHeading"><div><p className="panelLabel">Queue 02</p><h3 id="game-queue-title">Game submissions</h3></div><span>{games.length} open</span></div>
          {!games.length && <p className="queueEmpty">No private builds are waiting for inspection.</p>}
          {games.map((item) => (
            <article className="reviewCard" key={item.id}>
              <div className="reviewCardIndex"><span>{item.requested_hosting}</span><strong>{item.status.replaceAll('_', ' ')}</strong></div>
              <div className="reviewCardBody">
                <h4>{item.title}</h4><p>{item.summary}</p>
                <div className="reviewLinks"><a href={item.game_url} target="_blank" rel="noreferrer">Open private build ↗</a>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Source notes ↗</a>}</div>
              </div>
              <AdminReviewActions entity="game_submission" id={item.id} status={item.status} actions={gameActions[item.status] ?? []} />
            </article>
          ))}
        </section>

        <section className="reviewQueue" aria-labelledby="score-queue-title">
          <div className="queueHeading"><div><p className="panelLabel">Queue 03</p><h3 id="score-queue-title">Score integrity</h3></div><span>{scores.length} flagged</span></div>
          {!scores.length && <p className="queueEmpty">No accepted run is waiting for manual review.</p>}
          {scores.map((item) => (
            <article className="reviewCard scoreReviewCard" key={item.id}>
              <div className="reviewCardIndex"><span>{item.game_key}</span><strong>{item.verification_level}</strong></div>
              <div className="reviewCardBody">
                <h4>{item.score.toLocaleString()} points</h4>
                <p>{item.mode} mode · received {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <AdminReviewActions entity="score_submission" id={item.id} status={item.status} actions={[{ status: 'accepted', label: 'Accept provisionally' }, { status: 'rejected', label: 'Reject run' }]} />
            </article>
          ))}
        </section>

        <p className="controlBoundary">Approval records a completed review. It does not publish a game, deploy code, grant a membership, or create a charge.</p>
      </DashboardShell>
    </PlatformPage>
  )
}
