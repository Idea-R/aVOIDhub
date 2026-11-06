import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { PlatformPage } from '@/components/PlatformPage'

export const dynamic = 'error'
export const metadata: Metadata = {
  title: 'BoomerangaVOID local preview',
  description: 'Practice your throws or gather a couch party in the BoomerangaVOID local-play preview.',
  alternates: { canonical: '/games/boomerangavoid/' },
  robots: { index: false, follow: true },
}

export default function BoomerangaVOIDPreviewPage() {
  return (
    <PlatformPage
      eyebrow="Local-play preview"
      title={<>Boomerang<em>aVOID.</em></>}
      intro="Practice your throws or gather a couch party. This preview plays on one device without signing in."
    >
      <section className="platformPanel" aria-labelledby="local-play-title">
        <p className="panelLabel">Practice and Couch Party</p>
        <h2 id="local-play-title">Throw. Dodge. Call it back.</h2>
        <p>Dash through eight arenas, slash at close range, and curve a boomerang back through the garden. Set up two to six couch seats with a mix of people and bots.</p>
        <div className="heroActions">
          <a className="primaryButton" href="/boomerangavoid/">Play local preview <ArrowRight size={17} aria-hidden="true" /></a>
        </div>
        <p>Use keyboard, touch or browser-supported controllers. Extra human seats need compatible controllers.</p>
        <p>Online multiplayer, account sync and shared results are unavailable in this preview. Settings stay in this browser.</p>
      </section>
    </PlatformPage>
  )
}
