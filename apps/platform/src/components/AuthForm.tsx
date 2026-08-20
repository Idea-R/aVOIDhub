'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled) return
    setStatus('Sending a secure sign-in link…')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account/` },
    })
    setStatus(error ? 'That link could not be sent. Try again in a moment.' : 'Check your inbox. The link signs you in and returns here.')
  }

  return (
    <form className="platformForm authForm" onSubmit={submit}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <button className="primaryButton" type="submit" disabled={!enabled}>Email me a sign-in link</button>
      <p className="formStatus" aria-live="polite">{status || (enabled ? 'No password to remember.' : 'Account access opens with the platform runtime.')}</p>
    </form>
  )
}

