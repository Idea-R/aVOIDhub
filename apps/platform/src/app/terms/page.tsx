import type { Metadata } from 'next'
import { PolicyShell } from '@/components/PolicyShell'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Plain-language terms for using aVOIDgame.io and its hosted browser games.',
  alternates: { canonical: '/terms/' },
}

export default function TermsPage() {
  return (
    <PolicyShell
      eyebrow="Terms · fair play"
      title="Play the games. Do not break the arcade."
      intro="These terms set the practical rules for using the aVOID directory and the games hosted here. Features described as planned or coming soon are not promises of availability."
      updated="August 19, 2026"
    >
      <section>
        <h2>Using the site</h2>
        <div>
          <p>You may use aVOIDgame.io for personal, lawful play. Do not interfere with the service, evade security controls, automate abusive traffic, manipulate scores, impersonate another player, or attempt to access data that is not yours.</p>
        </div>
      </section>

      <section>
        <h2>Games and availability</h2>
        <div>
          <p>Games and site features are provided as available. We may tune, repair, replace, pause, or retire them. Scores, progress, and browser-saved settings can be lost during updates or when local data is cleared.</p>
          <p>TankaVOID, shared profiles, creator hosting, memberships, cosmetics, and platform-wide leaderboards are not live unless the site clearly says otherwise.</p>
        </div>
      </section>

      <section>
        <h2>External games</h2>
        <div>
          <p>Links to Bloomfall, Acrolis Crawlers, Tic Tac Toe in 3D, and other separately hosted projects take you to their own domains. Their availability, accounts, purchases, and policies are separate from the aVOID platform.</p>
        </div>
      </section>

      <section>
        <h2>Ownership</h2>
        <div>
          <p>The aVOIDgame.io name, site design, original game code, artwork, and written material belong to Ideas Realized or their credited owners. Playing a game does not transfer ownership or grant permission to republish, resell, scrape, or present the work as your own.</p>
        </div>
      </section>

      <section>
        <h2>No paid promise yet</h2>
        <div>
          <p>The current release has no platform checkout. If paid membership, cosmetics, or creator hosting launches, the price, benefits, renewal terms, cancellation path, and any additional purchase terms will be shown before payment.</p>
        </div>
      </section>

      <section>
        <h2>Service limits</h2>
        <div>
          <p>We work to keep the site dependable, but we cannot promise uninterrupted availability or that every browser, device, or network will behave identically. To the extent allowed by law, use of the site is at your own risk.</p>
        </div>
      </section>

      <section>
        <h2>Contact</h2>
        <div>
          <p>Questions about these terms can be sent through <a href="https://ideas-realized.com/" target="_blank" rel="noreferrer">Ideas Realized</a>.</p>
        </div>
      </section>
    </PolicyShell>
  )
}
