import type { ReactNode } from 'react'
import { ArrowUpRight, CircleUserRound, Gamepad2, LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react'

export type DashboardSection = 'overview' | 'profile' | 'creator' | 'admin'

const navItems = [
  { id: 'overview', href: '/account/', label: 'Player deck', icon: LayoutDashboard },
  { id: 'profile', href: '/account/#profile-studio', label: 'Profile studio', icon: CircleUserRound },
  { id: 'creator', href: '/creators/dashboard/', label: 'Creator bay', icon: Gamepad2 },
] as const

export function DashboardShell({
  active,
  role,
  name,
  status,
  isAdmin = false,
  children,
}: {
  active: DashboardSection
  role: string
  name: string
  status: string
  isAdmin?: boolean
  children: ReactNode
}) {
  return (
    <section className="controlDeck">
      <aside className="controlRail" aria-label="Account workspace">
        <div className="controlIdentity">
          <span className="controlPulse" aria-hidden="true" />
          <p>Active signal</p>
          <strong>{name}</strong>
          <span>{role}</span>
        </div>
        <nav className="controlNav">
          {navItems.map((item, index) => {
            const Icon = item.icon
            return (
              <a key={item.id} href={item.href} aria-current={active === item.id ? 'page' : undefined}>
                <i>0{index + 1}</i><Icon aria-hidden="true" /><span>{item.label}</span><ArrowUpRight aria-hidden="true" />
              </a>
            )
          })}
          {isAdmin && (
            <a href="/admin/" aria-current={active === 'admin' ? 'page' : undefined}>
              <i>04</i><ShieldCheck aria-hidden="true" /><span>Control room</span><ArrowUpRight aria-hidden="true" />
            </a>
          )}
        </nav>
        <div className="controlRailNote">
          <Sparkles aria-hidden="true" />
          <span>STATUS</span>
          <strong>{status}</strong>
        </div>
      </aside>
      <div className="controlSurface">{children}</div>
    </section>
  )
}
