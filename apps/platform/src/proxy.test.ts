import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from 'next/experimental/testing/server'
const mocks = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))
vi.mock('@/lib/env', () => ({ getPublicSupabaseConfig: () => ({ url: 'https://fixture.supabase.co', publishableKey: 'public-fixture' }) }))
import { config, proxy } from './proxy'
beforeEach(() => { vi.resetAllMocks(); mocks.claims.mockResolvedValue({ data: {}, error: null }); mocks.create.mockReturnValue({ auth: { getClaims: mocks.claims } }) })
describe('session refresh routing', () => {
  it.each(['/', '/games/voidavoid', '/leaderboards', '/login', '/api/leaderboards?game=voidavoid', '/voidavoid/', '/voidavoid/assets/game-abc.js', '/VOIDaVOID/assets/game.js', '/WreckaVOID/assets/music.mp3', '/WORDaVOID/assets/font.woff2', '/railavoid/', '/TankaVOID/index.html', '/_next/static/chunk.js', '/manifest.webmanifest', '/robots.txt'])('skips public request %s', url => expect(unstable_doesProxyMatch({ config, url })).toBe(false))
  it.each(['/account/', '/admin/', '/teams/', '/auth/callback', '/creators/dashboard/', '/creators/submit/', '/api/profile', '/api/player/best?game=voidavoid', '/api/teams', '/api/v1/runs', '/api/stripe/checkout', '/api/leaderboards-extra'])('retains private/API request %s', url => expect(unstable_doesProxyMatch({ config, url })).toBe(true))
  it.each([{}, { cookie: 'unrelated=one' }, { authorization: 'Bearer token', cookie: 'sb-fixture-auth-token=session' }])('does no cookie refresh work without a relevant browser session', async headers => {
    const response = await proxy(new NextRequest('https://avoidgame.io/account', { headers: headers as Record<string, string> }))
    expect(mocks.create).not.toHaveBeenCalled(); expect(response.headers.get('cache-control')).toContain('private, no-store')
  })
  it('still refreshes matching chunked session cookies', async () => {
    await proxy(new NextRequest('https://avoidgame.io/account', { headers: { cookie: 'sb-fixture-auth-token.0=session' } }))
    expect(mocks.claims).toHaveBeenCalledOnce()
  })
})
