import { NextResponse, type NextRequest } from 'next/server'
import { getSiteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const requestedNext = request.nextUrl.searchParams.get('next')
  const next = requestedNext?.startsWith('/') ? requestedNext : '/account/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${getSiteUrl(request.url)}${next}`)
  }

  return NextResponse.redirect(`${getSiteUrl(request.url)}/login/?error=link`)
}

