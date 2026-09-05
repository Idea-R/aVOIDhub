'use client'

import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BrandLockup } from './BrandLockup'
import { SplitCta } from './SplitCta'

const navigation = [
  { href: '/#games', label: 'Games' },
  { href: '/leaderboards/', label: 'Scores' },
  { href: '/creators/apply/', label: 'Creators' },
  { href: '/membership/', label: 'Membership' },
  { href: '/account/', label: 'Account' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isCurrent = (href: string) => href.includes('#')
    ? pathname === '/' || pathname.startsWith('/games/')
    : pathname.replace(/\/$/, '') === href.replace(/\/$/, '')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="siteHeader">
      <a className="brandLink" href="/#top" aria-label="aVOIDgame.io home">
        <BrandLockup className="brandLockup" />
      </a>

      <nav className="desktopNav" aria-label="Primary navigation">
        {navigation.map((item) => (
          <a key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>{item.label}</a>
        ))}
      </nav>

      <div className="headerAction"><SplitCta /></div>

      <button
        className="menuButton"
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {open && (
        <nav id="mobile-navigation" className="mobileNav" aria-label="Mobile navigation">
          {navigation.map((item, index) => (
            <a key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined} onClick={() => setOpen(false)}>
              <span>0{index + 1}</span>{item.label}
            </a>
          ))}
          <div className="mobileNavAction"><SplitCta /></div>
        </nav>
      )}
    </header>
  )
}
