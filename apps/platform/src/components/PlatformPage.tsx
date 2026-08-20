import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { SharePageButton } from '@/components/SharePageButton'

export function PlatformPage({ eyebrow, title, intro, children }: {
  eyebrow: string
  title: ReactNode
  intro: string
  children: ReactNode
}) {
  return (
    <main className="platformPage" id="top">
      <SiteHeader />
      <header className="platformPageHero sectionFrame">
        <p className="sectionIndex">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="platformPageIntro">{intro}</p>
        <SharePageButton />
      </header>
      <div className="sectionFrame platformPageBody">{children}</div>
      <SiteFooter />
    </main>
  )
}
