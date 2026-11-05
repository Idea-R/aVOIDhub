import { NextResponse, type NextRequest } from 'next/server'
import { getAuthOrigin, getAuthReturnPath } from '@/lib/auth/callback-url'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  const origin = getAuthOrigin(request.url, process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
  if (!origin) return new NextResponse('Sign-in is unavailable on this origin.', { status: 400, headers })
  const code = request.nextUrl.searchParams.get('code')
  const next = getAuthReturnPath(request.nextUrl.searchParams.get('next'))

  if (code?.trim() && !request.nextUrl.searchParams.has('error')) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(new URL(next, origin), { headers })
    } catch {
      // Never expose authorization codes, session data, or provider error details.
    }
  }

  const login = new URL('/login/', origin)
  login.searchParams.set('error', 'link')
  login.searchParams.set('next', next)
  return NextResponse.redirect(login, { headers })
}
