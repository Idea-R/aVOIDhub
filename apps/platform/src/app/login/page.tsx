import type { Metadata } from 'next'
import { BadgeCheck, Gamepad2, ShieldCheck, Sparkles } from 'lucide-react'
import { AuthForm } from '@/components/AuthForm'
import { PlatformPage } from '@/components/PlatformPage'
import { getSafeReturnPath } from '@/lib/auth/return-path'
import { isPlatformRuntimeConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams
  const nextPath = getSafeReturnPath(params.next)
  return (
    <PlatformPage eyebrow="/ signal gate" title={<>One identity.<br /><em>Different ways to play.</em></>} intro="Use one private link for your player profile, creator workspace, and—only when assigned—the platform control room.">
      <section className="accessGate">
        <div className="accessGateStory">
          <p className="panelLabel">What opens</p>
          <h2>Your account should feel like part of the arcade.</h2>
          <div className="accessRoleStack">
            <article><span>01</span><Gamepad2 aria-hidden="true" /><div><strong>Player deck</strong><p>Profile, favorites, eligible scores, and membership.</p></div></article>
            <article><span>02</span><Sparkles aria-hidden="true" /><div><strong>Creator bay</strong><p>Application state, private game submissions, and hosting review.</p></div></article>
            <article><span>03</span><ShieldCheck aria-hidden="true" /><div><strong>Control room</strong><p>Hidden unless the account carries a server-assigned admin role.</p></div></article>
          </div>
          <div className="accessReturn"><BadgeCheck aria-hidden="true" /><span>After sign-in</span><strong>{nextPath}</strong></div>
        </div>
        <div className="accessGateForm">
          {params.error === 'link' && <p className="deckWarning">That access link could not be verified. Request a fresh one below.</p>}
          <AuthForm enabled={isPlatformRuntimeConfigured()} nextPath={nextPath} />
        </div>
      </section>
    </PlatformPage>
  )
}

