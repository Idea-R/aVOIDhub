import { NextResponse, type NextRequest } from 'next/server'
import { getSafeReturnPath } from '@/lib/auth/return-path'
import { getSiteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = getSafeReturnPath(request.nextUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${getSiteUrl(request.url)}${next}`)
  }

  return NextResponse.redirect(`${getSiteUrl(request.url)}/login/?error=link`)
}

