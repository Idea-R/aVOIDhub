import { Gamepad2 } from 'lucide-react'
import { BrandLockup } from './BrandLockup'
import { SocialPresenceInline } from './SocialPresence'

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="sectionFrame footerGrid">
        <div>
          <BrandLockup className="footerBrand" />
          <p>Independent browser games from Ideas Realized.</p>
          <SocialPresenceInline />
        </div>
        <div className="footerLinks">
          <span>Explore</span>
          <a href="/#games">Games</a>
          <a href="/leaderboards/">Leaderboards</a>
          <a href="/creators/apply/">Creators</a>
          <a href="https://ideas-realized.com/" target="_blank" rel="noreferrer">Ideas Realized ↗</a>
        </div>
        <div className="footerLinks">
          <span>Information</span>
          <a href="/account/">Profile</a>
          <a href="/membership/">Membership</a>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
        </div>
        <div className="footerNote">
          <Gamepad2 size={18} />
          <span>Built for keyboards, mice, touchscreens, and the occasional terrible decision.</span>
        </div>
      </div>
    </footer>
  )
}
