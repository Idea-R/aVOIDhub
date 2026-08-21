'use client'

import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ enabled, nextPath = '/account/' }: { enabled: boolean; nextPath?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled) return
    setStatus('Sending a secure sign-in link…')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
    })
    setStatus(error ? 'That link could not be sent. Try again in a moment.' : 'Check your inbox. The link signs you in and returns here.')
  }

  return (
    <form className="platformForm authForm accessForm" onSubmit={submit}>
      <div className="accessFormHeading"><Mail aria-hidden="true" /><div><p className="panelLabel">Private link</p><h2>Send the signal.</h2></div></div>
      <label htmlFor="email">Where should the access link go?</label>
      <div className="accessInput"><span aria-hidden="true">@</span><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <button className="primaryButton" type="submit" disabled={!enabled}>Email my sign-in link <ArrowRight aria-hidden="true" /></button>
      <p className="formStatus" aria-live="polite">{status || (enabled ? 'No password. The link expires and returns you to the page you asked for.' : 'This review build shows the complete flow without sending account email.')}</p>
      <div className="accessTrust"><ShieldCheck aria-hidden="true" /><span>Admin authority is never chosen here. It lives in server-controlled account metadata.</span></div>
    </form>
  )
}

