import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ config: vi.fn(), board: vi.fn(), user: vi.fn(), best: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ getPublicSupabaseConfig: mocks.config }))
vi.mock('@/lib/leaderboards/server', () => ({ getPublicBoard: mocks.board, readPersonalBest: mocks.best }))
vi.mock('@/lib/auth/request-user', () => ({ getRequestUser: mocks.user }))
import { GET as publicGet } from '../../app/api/leaderboards/route'
import { GET as personalGet } from '../../app/api/player/best/route'
const request = (query = '?game=voidavoid', headers: Record<string, string> = {}) => new NextRequest(`https://avoidgame.io/api/leaderboards${query}`, { headers })
beforeEach(() => { vi.resetAllMocks(); mocks.config.mockReturnValue({ url: 'https://fixture.supabase.co', publishableKey: 'public-fixture' }); mocks.board.mockResolvedValue({ game: 'voidavoid', mode: 'endless', scores: [], observedAt: '2026-11-05T00:00:00Z', legacy: false }); mocks.user.mockResolvedValue({ id: 'authenticated-owner' }); mocks.best.mockResolvedValue(73) })
describe('public versus private score requests', () => {
  it('serves the same public snapshot regardless of visitor cookies or bearer token', async () => {
    const first = await publicGet(request()), second = await publicGet(request('?game=voidavoid', { cookie: 'private-user=one', authorization: 'Bearer private-token' }))
    expect(await first.json()).toEqual(await second.json())
    expect(mocks.board.mock.calls).toEqual([['voidavoid', 'endless', 'https://fixture.supabase.co'], ['voidavoid', 'endless', 'https://fixture.supabase.co']])
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.best).not.toHaveBeenCalled()
    expect(second.headers.get('netlify-cdn-cache-control')).toContain('max-age=60')
    expect(second.headers.has('set-cookie')).toBe(false)
    expect(second.headers.has('vary')).toBe(false)
  })
  it.each(['?game=toString', '?game=wordavoid&mode=invalid', '?game=voidavoid&userId=someone', '?game=voidavoid&game=wordavoid', '?game=voidavoid&mode=endless&mode=endless'])('rejects unsafe or unbounded query %s before database work', async query => {
    expect((await publicGet(request(query))).status).toBe(400); expect(mocks.board).not.toHaveBeenCalled()
  })
  it('never caches an unconfigured or failed backend response', async () => {
    mocks.config.mockReturnValue(null)
    const missing = await publicGet(request()); expect(missing.status).toBe(503); expect(missing.headers.get('cache-control')).toBe('no-store')
    mocks.config.mockReturnValue({ url: 'https://fixture.supabase.co' }); mocks.board.mockRejectedValue(new Error('private database diagnostic'))
    const failed = await publicGet(request()); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private database'); expect(failed.headers.get('cache-control')).toBe('no-store')
  })
  it('requires verified identity and keeps personal bests private on every outcome', async () => {
    mocks.user.mockResolvedValue(null)
    const denied = await personalGet(request()); expect(denied.status).toBe(401); expect(mocks.best).not.toHaveBeenCalled()
    mocks.user.mockResolvedValue({ id: 'authenticated-owner' })
    const success = await personalGet(request()); expect(await success.json()).toEqual({ game: 'voidavoid', mode: 'endless', personalBest: 73 }); expect(mocks.best).toHaveBeenCalledWith('authenticated-owner', { game: 'voidavoid', mode: 'endless' })
    mocks.best.mockRejectedValue(new Error('private')); const failure = await personalGet(request()); expect(failure.status).toBe(503)
    const invalid = await personalGet(request('?game=bad'))
    for (const response of [denied, success, failure, invalid]) {
      expect(response.headers.get('cache-control')).toContain('private, no-store')
      expect(response.headers.get('netlify-cdn-cache-control')).toBe('no-store')
    }
  })
})
