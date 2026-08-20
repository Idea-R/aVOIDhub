import type { Metadata } from 'next'
import { AuthForm } from '@/components/AuthForm'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <PlatformPage eyebrow="/ account access" title={<>One profile.<br /><em>Every aVOID run.</em></>} intro="Sign in to save favorites, submit ranked runs, and carry membership across the platform.">
      <section className="platformPanel narrowPanel">
        <AuthForm enabled={isPlatformRuntimeConfigured()} />
      </section>
    </PlatformPage>
  )
}

