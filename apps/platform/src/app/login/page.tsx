import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginGate } from '@/components/LoginGate'
import { isPlatformRuntimeConfigured } from '@/lib/env'
export const dynamic = 'error'
export const metadata: Metadata = { title: 'Sign in' }
export default function LoginPage() {
  return <Suspense fallback={<main className="platformPage"><p className="emptyState">Opening sign-in…</p></main>}><LoginGate enabled={isPlatformRuntimeConfigured()} /></Suspense>
}
