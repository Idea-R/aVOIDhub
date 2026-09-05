import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { SharePageButton } from '@/components/SharePageButton'

export function PlatformPage({ eyebrow, title, intro, children, compact = false }: {
  eyebrow: string
  title: ReactNode
  intro: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <main className={`platformPage${compact ? ' platformPageCompact' : ''}`} id="top">
      <SiteHeader />
      <div className="platformDepth" aria-hidden="true" />
      <header className="platformPageHero sectionFrame">
        <div className="platformPageSignal" aria-hidden="true"><span>AVD / PLATFORM</span><i /><span>IDENTITY · PLAY · PUBLISH</span></div>
        <div className="platformPageHeroGrid">
          <div>
            <p className="sectionIndex">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="platformHeroAside">
            <p className="platformPageIntro">{intro}</p>
            {!compact && <SharePageButton />}
          </div>
        </div>
      </header>
      <div className="sectionFrame platformPageBody">{children}</div>
      <SiteFooter />
    </main>
  )
}
