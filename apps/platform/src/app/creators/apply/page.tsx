import type { Metadata } from 'next'
import { CreatorApplicationForm } from '@/components/CreatorApplicationForm'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Become a creator' }

export default function CreatorApplyPage() {
  return (
    <PlatformPage eyebrow="/ creator intake" title={<>Bring a game.<br /><em>Keep its voice.</em></>} intro="Apply for a creator profile, directory listing, or hosted release. Every submission is reviewed before it can reach players or ads.">
      <section className="platformDashboard creatorIntake">
        <article className="platformPanel">
          <p className="panelLabel">How it works</p>
          <ol className="numberedList">
            <li><strong>Apply.</strong><span>Show us the game, studio, or playable work.</span></li>
            <li><strong>Review.</strong><span>We check ownership, quality, safety, and technical fit.</span></li>
            <li><strong>Choose a lane.</strong><span>External listing, aVOID subdomain, or a managed platform build.</span></li>
            <li><strong>Launch deliberately.</strong><span>Leaderboards and monetization stay off until their own checks pass.</span></li>
          </ol>
        </article>
        <article className="platformPanel"><CreatorApplicationForm enabled={isPlatformRuntimeConfigured()} /></article>
      </section>
    </PlatformPage>
  )
}

