import { NextResponse, type NextRequest } from 'next/server'
import { getSafeReturnPath, getAuthCallbackOrigin } from '@/lib/auth/return-path'
import { getSiteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = getSafeReturnPath(request.nextUrl.searchParams.get('next'))
  const site = getAuthCallbackOrigin(request.url, getSiteUrl(), process.env.NODE_ENV !== 'production')
  if (code && !request.nextUrl.searchParams.has('error')) {
    try {
      const { error } = await (await createClient()).auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${site}${next}`)
    } catch { /* Do not log authorization codes or provider details. */ }
  }
  const destination = new URL('/login/', site)
  destination.searchParams.set('error', 'link')
  destination.searchParams.set('next', next)
  return NextResponse.redirect(destination)
}

