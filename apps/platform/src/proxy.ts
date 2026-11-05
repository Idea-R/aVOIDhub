import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicSupabaseConfig } from '@/lib/env'

export async function proxy(request: NextRequest) {
  // Public pages, boards and Vite assets are excluded by the matcher. This is
  // session refresh only; every private handler still verifies its own caller.
  const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' }
  const finish = (response: NextResponse) => {
    Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
    return response
  }
  const config = getPublicSupabaseConfig()
  if (!config || request.headers.has('authorization')) return finish(NextResponse.next({ request }))
  const project = new URL(config.url).hostname.split('.')[0]
  const cookieName = `sb-${project}-auth-token`
  if (!request.cookies.getAll().some(({ name }) => name === cookieName || name.startsWith(`${cookieName}.`))) {
    return finish(NextResponse.next({ request }))
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getClaims()
  return finish(response)
}

export const config = {
  matcher: [
    '/account/:path*', '/admin/:path*', '/teams/:path*', '/auth/:path*',
    '/creators/dashboard/:path*', '/creators/submit/:path*',
    '/api/((?!leaderboards(?:/|$)).*)',
  ],
}

