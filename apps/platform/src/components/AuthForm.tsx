'use client'

import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPublicSupabaseConfig } from '@/lib/env'
import { isGoogleSignInAvailable } from '@/lib/auth/google-provider'
import { getSafeReturnPath } from '@/lib/auth/return-path'

export function AuthForm({ enabled, nextPath = '/account/' }: { enabled: boolean; nextPath?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState<'email' | 'google' | null>(null)
  const busy = useRef(false)
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeReturnPath(nextPath))}`

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || busy.current) return
    busy.current = true
    setPending('email')
    setStatus('Sending a secure sign-in link.')
    try {
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } })
      setStatus(error ? 'That link could not be sent. Try again in a moment.' : 'Check your inbox. The link signs you in and returns here.')
    } catch { setStatus('Connection interrupted. Try sending the link again.') }
    finally { busy.current = false; setPending(null) }
  }

  async function google() {
    if (!enabled || busy.current) return
    busy.current = true
    setPending('google')
    setStatus('Opening Google sign-in.')
    try {
      const config=getPublicSupabaseConfig()
      if(!config||!await isGoogleSignInAvailable(config.url,config.publishableKey)){setStatus('Google sign-in is not enabled yet. You can use an email link.');busy.current=false;setPending(null);return}
      const { data, error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
      if (error || !data.url) throw new Error('provider_unavailable')
      // Supabase navigates to the provider; keep both actions disabled during navigation.
    } catch {
      setStatus('Google sign-in could not open. Try again or use an email link.')
      busy.current = false
      setPending(null)
    }
  }

  return (
    <form className="platformForm authForm accessForm" onSubmit={submit} aria-busy={!!pending}>
      <div className="accessFormHeading"><Mail aria-hidden="true" /><div><p className="panelLabel">Your account</p><h2>Come on in.</h2></div></div>
      <button className="secondaryButton" type="button" disabled={!enabled || !!pending} onClick={google}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4ZM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3v2.6A10 10 0 0 0 12 22Zm-5.6-8.1A6 6 0 0 1 6 12c0-.7.1-1.3.4-1.9V7.5H3A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.5l3.4-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6A6 6 0 0 1 12 6Z"/></svg>
        {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <p className="panelLabel">Or use a private email link</p>
      <label htmlFor="email">Email address</label>
      <div className="accessInput"><span aria-hidden="true">@</span><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={!!pending} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <button className="primaryButton" type="submit" disabled={!enabled || !!pending}>{pending === 'email' ? 'Sending…' : 'Email my sign-in link'} <ArrowRight aria-hidden="true" /></button>
      <p className="formStatus" aria-live="polite">{status || (enabled ? 'Choose Google or a one-use email link. Both return you to the page you asked for.' : 'Account sign-in is unavailable in this review build.')}</p>
      <div className="accessTrust"><ShieldCheck aria-hidden="true" /><span>Your sign-in returns you to your game.</span></div>
    </form>
  )
}

