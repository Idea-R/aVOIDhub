import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }))
import { GET } from './route'

const site = 'https://avoidgame.io'
const preview = 'https://deploy-preview-65--coruscating-squirrel-a47ad9.netlify.app'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
  mocks.create.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange } })
  mocks.exchange.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())

function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  expect(response.headers.get('location') ?? '').not.toContain('fixture-code')
  expect(response.headers.get('location') ?? '').not.toContain('provider-detail')
}

describe('shared PKCE/email authentication callback', () => {
  it.each([site, preview])('exchanges a code and returns on the same origin %s', async origin => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
    const response = await GET(new NextRequest(origin + '/auth/callback?code=fixture-code&next=%2Fteams%2F%3Fview%3Dmine'))
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('fixture-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(origin + '/teams/?view=mine')
    privateResponse(response)
  })
  it.each(['', '?code=', '?code=%20', '?error=access_denied&error_description=provider-detail', '?code=fixture-code&error=access_denied', '?code=fixture-code&error='])('handles missing, cancelled and provider error callbacks %s', async query => {
    const join = query ? '&' : '?'
    const response = await GET(new NextRequest(site + '/auth/callback' + query + join + 'next=%2Fteams%2F'))
    expect(mocks.create).not.toHaveBeenCalled()
    const destination = new URL(response.headers.get('location')!)
    expect(destination.pathname).toBe('/login/')
    expect(destination.searchParams.get('error')).toBe('link')
    expect(destination.searchParams.get('next')).toBe('/teams/')
    privateResponse(response)
  })
  it.each(['returned', 'thrown', 'client'])('handles %s exchange errors without leaking details', async mode => {
    if (mode === 'returned') mocks.exchange.mockResolvedValue({ error: { message: 'provider-detail' } })
    if (mode === 'thrown') mocks.exchange.mockRejectedValue(new Error('provider-detail'))
    if (mode === 'client') mocks.create.mockRejectedValue(new Error('provider-detail'))
    const response = await GET(new NextRequest(site + '/auth/callback?code=fixture-code&next=%2Faccount%2F'))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login/')
    privateResponse(response)
  })
  it.each(['//evil.example', '/..//evil.example', '/%2fevil.example', '/auth/callback?code=stolen'])('rejects malicious next after successful exchange %s', async next => {
    const request = new URL('/auth/callback', site)
    request.searchParams.set('code', 'fixture-code')
    request.searchParams.set('next', next)
    const response = await GET(new NextRequest(request))
    expect(response.headers.get('location')).toBe(site + '/account/')
  })
  it.each([
    ['https://evil.example', ''],
    [preview, site],
    [site, 'https://avoidgame.io/path'],
    [site, 'https://avoidgame.io?redirect=evil'],
    ['http://localhost:3000', ''],
  ])('does not exchange or redirect across invalid origin/config %s %s', async (origin, config) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', config)
    const response = await GET(new NextRequest(origin + '/auth/callback?code=fixture-code'))
    expect(response.status).toBe(400)
    expect(response.headers.has('location')).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
    privateResponse(response)
    expect(await response.text()).not.toContain('fixture-code')
  })
})
