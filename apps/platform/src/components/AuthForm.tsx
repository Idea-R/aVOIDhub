'use client'

import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { isGoogleSignInAvailable } from '@/lib/auth/google-provider'
import { getPublicSupabaseConfig } from '@/lib/env'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ enabled, nextPath = '/account/' }: { enabled: boolean; nextPath?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState<'email' | 'google' | null>(null)
  const busy = useRef(false)
  const callback = () => getAuthCallbackUrl(window.location.origin, nextPath, process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (!event.persisted || !busy.current) return
      busy.current = false
      setPending(null)
      setStatus('Sign-in was interrupted. Try again or use an email link.')
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || busy.current) return
    busy.current = true
    setPending('email')
    setStatus('Sending a secure sign-in link.')
    try {
      const emailRedirectTo = callback()
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo } })
      setStatus(error ? 'That link could not be sent. Try again in a moment.' : 'Check your inbox. The link signs you in and returns here.')
    } catch {
      setStatus('That link could not be sent. Try again in a moment.')
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  async function google() {
    if (!enabled || busy.current) return
    busy.current = true
    setPending('google')
    setStatus('Opening Google sign-in.')
    let opening = false
    try {
      const redirectTo = callback()
      const config = getPublicSupabaseConfig()
      if (!config || !await isGoogleSignInAvailable(config.url, config.publishableKey)) {
        setStatus('Google sign-in is not enabled yet. You can use an email link.')
        return
      }
      const { data, error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error || !data.url) throw new Error('provider_unavailable')
      // The SSR client supplies PKCE and navigates to Google. Lock actions while leaving.
      opening = true
    } catch {
      setStatus('Google sign-in could not open. Try again or use an email link.')
    } finally {
      if (!opening) {
        busy.current = false
        setPending(null)
      }
    }
  }

  return (
    <form className="platformForm authForm accessForm" onSubmit={submit} aria-busy={!!pending}>
      <div className="accessFormHeading"><Mail aria-hidden="true" /><div><p className="panelLabel">Private link</p><h2>Send the signal.</h2></div></div>
      <button className="secondaryButton" type="button" disabled={!enabled || !!pending} onClick={google}>{pending === 'google' ? 'Opening Google.' : 'Continue with Google'}</button>
      <p className="panelLabel">Or use a private email link</p>
      <label htmlFor="email">Where should the access link go?</label>
      <div className="accessInput"><span aria-hidden="true">@</span><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={!!pending} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <button className="primaryButton" type="submit" disabled={!enabled || !!pending}>{pending === 'email' ? 'Sending.' : 'Email my sign-in link'} <ArrowRight aria-hidden="true" /></button>
      <p className="formStatus" aria-live="polite">{status || (enabled ? 'Choose Google or a private email link. Both return you to the page you asked for.' : 'This review build shows the complete flow without sending account email.')}</p>
      <div className="accessTrust"><ShieldCheck aria-hidden="true" /><span>Admin authority is never chosen here. It lives in server-controlled account metadata.</span></div>
    </form>
  )
}
