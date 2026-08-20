import type { Metadata } from 'next'
import { PolicyShell } from '@/components/PolicyShell'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How aVOIDgame.io handles game data, hosting logs, cookies, and future advertising.',
  alternates: { canonical: '/privacy/' },
}

export default function PrivacyPage() {
  return (
    <PolicyShell
      eyebrow="Privacy · plain language"
      title="Your play should not become a surveillance project."
      intro="This policy explains what the aVOID directory and its hosted games may process, what is not active yet, and what will change before advertising or shared accounts go live."
      updated="August 19, 2026"
    >
      <section>
        <h2>The directory today</h2>
        <div>
          <p>The aVOIDgame.io directory does not currently ask you to create a platform account, buy a membership, submit a creator profile, or provide contact information.</p>
          <p>Some individual games may save preferences or progress in your browser. A game that offers a leaderboard may send the score and account information you choose to submit to that game&apos;s leaderboard service.</p>
        </div>
      </section>

      <section>
        <h2>Hosting and security data</h2>
        <div>
          <p>Like most websites, our hosting infrastructure processes standard request information such as IP address, browser type, requested URL, timestamps, and error or security events. This information is used to deliver the site, prevent abuse, diagnose failures, and keep the service reliable.</p>
          <p>We do not sell personal information.</p>
        </div>
      </section>

      <section>
        <h2>Cookies and local storage</h2>
        <div>
          <p>Hosted games may use browser storage for settings, progress, or a remembered session. You can clear that data through your browser controls, although doing so may reset local progress.</p>
          <p>If advertising is activated, third-party vendors including Google may use cookies to serve and measure ads based on visits to this site or other sites. Google&apos;s advertising cookies can enable Google and its partners to personalize advertising. You can manage personalized advertising in <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google Ads Settings</a>.</p>
        </div>
      </section>

      <section>
        <h2>Advertising status</h2>
        <div>
          <p>Google AdSense advertising is being prepared but is not active in the current release. Before ads are enabled, we will configure region-appropriate privacy controls and a Google-certified consent management platform where required.</p>
          <p>Our product rule is simple: ads belong in calm directory surfaces, never over active gameplay, game controls, or results that require an accidental click to dismiss.</p>
        </div>
      </section>

      <section>
        <h2>Other Ideas Realized games</h2>
        <div>
          <p>Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D have their own domains and may have separate data practices. Following a link to one of those games means its own site controls the experience.</p>
        </div>
      </section>

      <section>
        <h2>Your choices</h2>
        <div>
          <ul>
            <li>Use browser controls to clear cookies and local game data.</li>
            <li>Do not submit a score or sign into a game if you do not want that information processed.</li>
            <li>Use any privacy controls shown before advertising technology is loaded.</li>
            <li>Contact Ideas Realized if you have a privacy question or request.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Contact</h2>
        <div>
          <p>aVOIDgame.io is an Ideas Realized project. Use the contact path at <a href="https://ideas-realized.com/" target="_blank" rel="noreferrer">ideas-realized.com</a> for privacy questions.</p>
        </div>
      </section>
    </PolicyShell>
  )
}
