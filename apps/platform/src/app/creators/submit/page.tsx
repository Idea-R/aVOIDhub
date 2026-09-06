import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BadgeCheck, LockKeyhole, ScanSearch } from 'lucide-react'
import { DashboardShell } from '@/components/DashboardShell'
import { GameSubmissionForm } from '@/components/GameSubmissionForm'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformAdmin } from '@/lib/auth/roles'
import { getCreatorSubmissionEligibility } from '@/lib/creators/server'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Submit a game for review', alternates: { canonical: '/creators/submit' }, robots: { index: false, follow: false } }

export default async function GameSubmitPage() {
  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage compact eyebrow="/ private review queue" title={<>Submit the build.<br /><em>Not the hype.</em></>} intro="Give us a playable URL and the real hosting need. Nothing becomes public, monetized, or ranked until it passes review.">
        <DashboardShell active="creator" role="CREATOR PREVIEW" name="Private submission" status="preview only">
          <div className="deckHeader"><div><p className="panelLabel">Build intake</p><h2>A clean handoff<br /><em>starts here.</em></h2></div><span className="deckStamp deckStampWarning"><LockKeyhole aria-hidden="true" /> Preview only</span></div>
          <section className="submissionWorkbench"><div className="submissionWorkbenchNote"><ScanSearch aria-hidden="true" /><p className="panelLabel">What review means</p><h3>Playable first. Claims second.</h3><p>We inspect ownership, safety, controls, privacy, responsive behavior, score integrity, and the hosting setup you chose. Approval still does not publish the game.</p></div><GameSubmissionForm enabled={false} /></section>
        </DashboardShell>
      </PlatformPage>
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login/?next=/creators/submit/')
  const eligibility = await getCreatorSubmissionEligibility(userData.user.id)
  if (!eligibility.allowed) redirect('/creators/dashboard/')

  return (
    <PlatformPage compact eyebrow="/ private review queue" title={<>Submit the build.<br /><em>Not the hype.</em></>} intro="Give us a playable URL and the real hosting need. Nothing becomes public, monetized, or ranked until it passes review.">
      <DashboardShell active="creator" role="APPROVED CREATOR" name={userData.user.email?.split('@')[0] ?? 'Creator'} status="submissions open" isAdmin={isPlatformAdmin(userData.user)}>
        <div className="deckHeader"><div><p className="panelLabel">Build intake</p><h2>A clean handoff<br /><em>starts here.</em></h2></div><span className="deckStamp"><BadgeCheck aria-hidden="true" /> Eligible creator</span></div>
        <section className="submissionWorkbench"><div className="submissionWorkbenchNote"><ScanSearch aria-hidden="true" /><p className="panelLabel">What review means</p><h3>Playable first. Claims second.</h3><p>We inspect ownership, safety, controls, privacy, responsive behavior, score integrity, and the hosting setup you chose. Approval still does not publish the game.</p></div><GameSubmissionForm /></section>
      </DashboardShell>
    </PlatformPage>
  )
}
