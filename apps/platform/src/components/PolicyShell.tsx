import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

type PolicyShellProps = {
  eyebrow: string
  title: string
  intro: string
  updated: string
  children: ReactNode
}

export function PolicyShell({ eyebrow, title, intro, updated, children }: PolicyShellProps) {
  return (
    <main id="top" className="policyPage">
      <SiteHeader />
      <header className="policyHero sectionFrame">
        <p className="kicker"><span /> {eyebrow}</p>
        <div className="policyHeroGrid">
          <h1>{title}</h1>
          <div>
            <p className="policyIntro">{intro}</p>
            <p className="policyUpdated">Last updated {updated}</p>
          </div>
        </div>
      </header>
      <article className="policyBody sectionFrame">{children}</article>
      <SiteFooter />
    </main>
  )
}
