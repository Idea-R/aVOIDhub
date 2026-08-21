import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowUpRight, BadgeCheck, CircleDashed, Clock3, Gamepad2, KeyRound, RadioTower } from 'lucide-react'
import { DashboardShell } from '@/components/DashboardShell'
import { PlatformPage } from '@/components/PlatformPage'
import { getPlatformRole, isPlatformAdmin } from '@/lib/auth/roles'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Creator workspace' }

type CreatorApplication = {
  id: string
  display_name: string
  portfolio_url: string | null
  status: string
  submitted_at: string
}

type GameSubmission = {
  id: string
  title: string
  game_url: string
  requested_hosting: string
  status: string
  submitted_at: string | null
  updated_at: string
}

function CreatorPreview() {
  return (
    <DashboardShell active="creator" role="CREATOR PREVIEW" name="Your studio" status="preview only">
      <div className="deckHeader">
        <div><p className="panelLabel">Creator bay</p><h2>From playable build<br /><em>to reviewed release.</em></h2></div>
        <span className="deckStamp deckStampWarning"><RadioTower aria-hidden="true" /> Preview mode</span>
      </div>
      <div className="creatorTrack" aria-label="Creator publishing sequence">
        <article data-state="current"><span>01</span><BadgeCheck aria-hidden="true" /><strong>Apply free</strong><p>Identity, ownership, and a build we can inspect.</p></article>
        <article><span>02</span><Clock3 aria-hidden="true" /><strong>Pass review</strong><p>Quality, safety, privacy, controls, and technical fit.</p></article>
        <article><span>03</span><KeyRound aria-hidden="true" /><strong>Open tools</strong><p>Creator membership starts only after approval.</p></article>
        <article><span>04</span><Gamepad2 aria-hidden="true" /><strong>Submit privately</strong><p>Nothing publishes or monetizes itself.</p></article>
      </div>
      <section className="emptyControlState"><CircleDashed aria-hidden="true" /><div><p className="panelLabel">Your real status</p><h3>Sign in to see where you stand.</h3><p>Your application, membership, and game submissions appear here after sign-in.</p></div></section>
    </DashboardShell>
  )
}

export default async function CreatorDashboardPage() {
  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage eyebrow="/ creator workspace" title={<>Build it.<br /><em>Bring it in clean.</em></>} intro="Apply, pass review, and bring us a playable build. Payment never buys approval.">
        <CreatorPreview />
      </PlatformPage>
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login/?next=/creators/dashboard/')
  const now = new Date().toISOString()

  const [applicationResult, submissionsResult, entitlementsResult, profileResult] = await Promise.all([
    supabase.from('creator_applications').select('id, display_name, portfolio_url, status, submitted_at').eq('user_id', userData.user.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('game_submissions').select('id, title, game_url, requested_hosting, status, submitted_at, updated_at').eq('user_id', userData.user.id).order('updated_at', { ascending: false }).limit(20),
    supabase.from('user_entitlements').select('entitlement_key, expires_at').eq('user_id', userData.user.id).or(`expires_at.is.null,expires_at.gt.${now}`),
    supabase.from('user_profiles').select('username, display_name').eq('id', userData.user.id).maybeSingle(),
  ])

  const application = applicationResult.data as CreatorApplication | null
  const submissions = (submissionsResult.data ?? []) as GameSubmission[]
  const hasCreatorMembership = entitlementsResult.data?.some((item) => item.entitlement_key === 'creator.submit_game') ?? false
  const approved = application?.status === 'approved'
  const canSubmit = approved && hasCreatorMembership
  const name = profileResult.data?.display_name || profileResult.data?.username || application?.display_name || userData.user.email?.split('@')[0] || 'Creator'
  const role = getPlatformRole({ user: userData.user, creatorApproved: approved })

  return (
    <PlatformPage eyebrow="/ creator workspace" title={<>Build it.<br /><em>Bring it in clean.</em></>} intro="Apply, pass review, and bring us a playable build. Payment never buys approval.">
      <DashboardShell active="creator" role={role.toUpperCase()} name={name} status={canSubmit ? 'submissions open' : 'setup in progress'} isAdmin={isPlatformAdmin(userData.user)}>
        <div className="deckHeader">
          <div><p className="panelLabel">Creator bay</p><h2>Your route to<br /><em>the directory.</em></h2></div>
          <span className={`deckStamp ${canSubmit ? '' : 'deckStampWarning'}`}>{canSubmit ? <BadgeCheck aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{canSubmit ? 'Creator tools ready' : 'Setup incomplete'}</span>
        </div>

        <div className="creatorTrack" aria-label="Creator publishing sequence">
          <article data-state={application ? 'complete' : 'current'}><span>01</span><BadgeCheck aria-hidden="true" /><strong>Apply free</strong><p>{application ? `Application ${application.status.replaceAll('_', ' ')}.` : 'Share identity, ownership, and a reviewable build.'}</p></article>
          <article data-state={approved ? 'complete' : application ? 'current' : undefined}><span>02</span><Clock3 aria-hidden="true" /><strong>Pass review</strong><p>{approved ? 'Creator review approved.' : 'Approval follows a real ownership and quality review.'}</p></article>
          <article data-state={hasCreatorMembership ? 'complete' : approved ? 'current' : undefined}><span>03</span><KeyRound aria-hidden="true" /><strong>Open tools</strong><p>{hasCreatorMembership ? 'Creator membership is active.' : 'Subscribe only after approval.'}</p></article>
          <article data-state={canSubmit ? 'current' : undefined}><span>04</span><Gamepad2 aria-hidden="true" /><strong>Submit privately</strong><p>{canSubmit ? 'You can send us a private build.' : 'Review and membership must both be active.'}</p></article>
        </div>

        <section className="creatorCommandGrid">
          <article className="commandSlab commandSlabHot">
            <p className="panelLabel">What to do next</p>
            <h3>{!application ? 'Start the free application.' : !approved ? 'Watch the review state.' : !hasCreatorMembership ? 'Choose Creator membership.' : 'Send the next playable build.'}</h3>
            <p>{!application ? 'Payment is not part of applying.' : !approved ? 'A reviewer may ask for ownership or build details.' : !hasCreatorMembership ? 'Paid tools do not replace approval.' : 'The build stays private until the game review is complete.'}</p>
            <a className="primaryButton" href={!application ? '/creators/apply/' : !approved ? '#application-state' : !hasCreatorMembership ? '/membership/' : '/creators/submit/'}>{canSubmit ? 'Submit a game' : 'Continue the process'} <ArrowUpRight aria-hidden="true" /></a>
          </article>
          <article className="commandSlab" id="application-state">
            <p className="panelLabel">Application state</p>
            <strong className="commandValue">{application?.status.replaceAll('_', ' ') ?? 'not started'}</strong>
            <dl className="signalLedger"><div><dt>Creator tools</dt><dd>{hasCreatorMembership ? 'active' : 'locked'}</dd></div><div><dt>Private submissions</dt><dd>{canSubmit ? 'open' : 'held'}</dd></div><div><dt>Published games</dt><dd>review required</dd></div></dl>
          </article>
        </section>

        <section className="submissionShelf" aria-labelledby="submission-title">
          <div className="queueHeading"><div><p className="panelLabel">Private inventory</p><h3 id="submission-title">Your submitted games</h3></div><span>{submissions.length} records</span></div>
          {!submissions.length && <p className="queueEmpty">No game submissions yet. This shelf stays empty until you have approval, active creator tools, and a real build.</p>}
          {submissions.map((item, index) => (
            <article className="submissionRow" key={item.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{item.title}</strong><small>{item.requested_hosting.replaceAll('_', ' ')} lane</small></div>
              <i data-status={item.status}>{item.status.replaceAll('_', ' ')}</i>
              <a href={item.game_url} target="_blank" rel="noreferrer" aria-label={`Open review build for ${item.title}`}><ArrowUpRight aria-hidden="true" /></a>
            </article>
          ))}
        </section>
      </DashboardShell>
    </PlatformPage>
  )
}
