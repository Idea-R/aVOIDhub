import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowUpRight, BadgeCheck, BookMarked, Gamepad2, RadioTower, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { SignOutButton } from '@/components/AccountActions'
import { DashboardShell } from '@/components/DashboardShell'
import { BillingPortalButton } from '@/components/MembershipActions'
import { PlatformPage } from '@/components/PlatformPage'
import { ProfileForm } from '@/components/ProfileForm'
import { getPlatformRole, isPlatformAdmin } from '@/lib/auth/roles'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your player deck' }

function AccountPreview() {
  return (
    <DashboardShell active="overview" role="PLAYER PREVIEW" name="Your account" status="preview only">
      <div className="deckHeader">
        <div><p className="panelLabel">Player deck</p><h2>The design is ready.<br /><em>Your data comes after sign-in.</em></h2></div>
        <span className="deckStamp deckStampWarning"><RadioTower aria-hidden="true" /> Preview mode</span>
      </div>
      <div className="metricGrid metricGridThree">
        <article><Trophy aria-hidden="true" /><span>Ranked runs</span><strong>OFF</strong><small>Sign in to load your runs</small></article>
        <article><BookMarked aria-hidden="true" /><span>Favorites</span><strong>OFF</strong><small>Sign in to load your games</small></article>
        <article><Sparkles aria-hidden="true" /><span>Membership</span><strong>FREE</strong><small>Cosmetics, never power</small></article>
      </div>
      <section className="emptyControlState"><ShieldCheck aria-hidden="true" /><div><p className="panelLabel">Preview account</p><h3>No player data is loaded here.</h3><p>After sign-in, this page shows your profile, favorites, eligible runs, membership, and creator status.</p></div></section>
    </DashboardShell>
  )
}

export default async function AccountPage() {
  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage eyebrow="/ player identity" title={<>Your place<br /><em>in the arcade.</em></>} intro="Your scores, saved games, membership, and creator tools all live here.">
        <AccountPreview />
      </PlatformPage>
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login/?next=/account/')
  const now = new Date().toISOString()

  const [profileResult, entitlementsResult, creatorResult, scoreResult, favoriteResult] = await Promise.all([
    supabase.from('user_profiles').select('username, display_name, bio, is_public, social_links, created_at').eq('id', userData.user.id).maybeSingle(),
    supabase.from('user_entitlements').select('entitlement_key, expires_at').eq('user_id', userData.user.id).or(`expires_at.is.null,expires_at.gt.${now}`),
    supabase.from('creator_applications').select('id, status, display_name').eq('user_id', userData.user.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('score_submissions').select('id', { count: 'exact', head: true }).eq('user_id', userData.user.id).eq('status', 'accepted'),
    supabase.from('game_favorites').select('game_key', { count: 'exact', head: true }).eq('user_id', userData.user.id),
  ])

  const profile = profileResult.data
  const entitlements = entitlementsResult.data ?? []
  const creatorApplication = creatorResult.data
  const hasCreatorMembership = entitlements.some((item) => item.entitlement_key === 'creator.submit_game')
  const creatorApproved = creatorApplication?.status === 'approved'
  const hasAdFree = entitlements.some((item) => item.entitlement_key === 'platform.ad_free')
  const canSubmitGame = creatorApproved && hasCreatorMembership
  const isAdmin = isPlatformAdmin(userData.user)
  const role = getPlatformRole({ user: userData.user, creatorApproved })
  const playerName = profile?.display_name || profile?.username || userData.user.email?.split('@')[0] || 'Player'

  return (
    <PlatformPage eyebrow="/ player identity" title={<>Your place<br /><em>in the arcade.</em></>} intro="Your scores, saved games, membership, and creator tools all live here.">
      <DashboardShell active="overview" role={role.toUpperCase()} name={playerName} status={canSubmitGame ? 'creator tools ready' : hasAdFree ? 'ad-free member' : 'free player'} isAdmin={isAdmin}>
        <div className="deckHeader">
          <div><p className="panelLabel">Welcome back</p><h2>{playerName}<br /><em>is on the board.</em></h2></div>
          <span className="deckStamp"><BadgeCheck aria-hidden="true" /> Account verified</span>
        </div>

        <div className="metricGrid metricGridThree">
          <article><Trophy aria-hidden="true" /><span>Accepted runs</span><strong>{String(scoreResult.count ?? 0).padStart(2, '0')}</strong><small>Verification shown per board</small></article>
          <article><BookMarked aria-hidden="true" /><span>Favorites</span><strong>{String(favoriteResult.count ?? 0).padStart(2, '0')}</strong><small>Games kept close</small></article>
          <article><Sparkles aria-hidden="true" /><span>Membership</span><strong>{entitlements.length ? 'ACTIVE' : 'FREE'}</strong><small>{hasAdFree ? 'Platform ads off' : 'Core play stays free'}</small></article>
        </div>

        <section className="accountCommandGrid">
          <article className="identityTicket">
            <div className="identityTicketTop"><span>AVD / PLAYER</span><i>{role}</i></div>
            <strong>{profile?.username ? `@${profile.username}` : playerName}</strong>
            <p>{userData.user.email}</p>
            <div className="identityTicketActions"><a href={profile?.username ? `/players/${profile.username}/` : '#profile-studio'}>View public profile <ArrowUpRight aria-hidden="true" /></a><SignOutButton /></div>
          </article>

          <article className="commandSlab commandSlabHot">
            <p className="panelLabel">Creator access</p>
            <h3>{canSubmitGame ? 'You can submit a game.' : creatorApproved ? 'You are approved. Creator membership opens the submission tools.' : creatorApplication ? `Application ${creatorApplication.status.replaceAll('_', ' ')}.` : 'Have a browser game worth playing?'}</h3>
            <p>{canSubmitGame ? 'Send us a playable build for a private review.' : creatorApproved ? 'Membership opens the tools, but it never replaces approval.' : 'Applying is free. We check ownership and quality before paid creator tools become available.'}</p>
            <a className="primaryButton" href={canSubmitGame ? '/creators/submit/' : creatorApplication ? '/creators/dashboard/' : '/creators/apply/'}>{canSubmitGame ? 'Submit a game' : 'Open creator bay'} <ArrowUpRight aria-hidden="true" /></a>
          </article>
        </section>

        <section className="membershipLedger">
          <div><p className="panelLabel">Access ledger</p><h3>What this account can use</h3></div>
          <ul>
            {entitlements.map((item) => <li key={item.entitlement_key}><span>{item.entitlement_key.replaceAll('.', ' / ')}</span><strong>active</strong></li>)}
            {!entitlements.length && <li><span>Free player account</span><strong>active</strong></li>}
            <li><span>Creator review</span><strong>{creatorApplication?.status ?? 'not started'}</strong></li>
            <li><span>Admin control room</span><strong>{isAdmin ? 'authorized' : 'not assigned'}</strong></li>
          </ul>
          <div className="buttonRow"><a className="secondaryButton" href="/membership/">Membership options</a><BillingPortalButton /></div>
        </section>

        <section className="profileStudio" id="profile-studio">
          <div className="profileStudioIntro"><p className="panelLabel">Profile studio</p><h3>Make the name on the board feel like yours.</h3><p>Keep it short, recognizable, and public only when you mean it. Social links are optional.</p><Gamepad2 aria-hidden="true" /></div>
          <div className="profileStudioForm"><ProfileForm profile={profile || {}} /></div>
        </section>
      </DashboardShell>
    </PlatformPage>
  )
}
