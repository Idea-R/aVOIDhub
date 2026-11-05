import { afterEach, describe, expect, it, vi } from 'vitest'
import { isGoogleSignInAvailable } from './google-provider'
afterEach(() => vi.unstubAllGlobals())
describe('Google provider availability', () => {
  it.each([true, false])('requires an explicit provider setting: %s', async google => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google } })))
    vi.stubGlobal('fetch', fetcher)
    expect(await isGoogleSignInAvailable('https://fixture.supabase.co', 'fixture-public-key')).toBe(google)
    expect(fetcher).toHaveBeenCalledWith('https://fixture.supabase.co/auth/v1/settings', {
      headers: { apikey: 'fixture-public-key' }, signal: expect.any(AbortSignal), cache: 'no-store', credentials: 'omit',
    })
  })
  it.each(['{}', '{"external":{"google":"true"}}', 'invalid-json'])('fails closed for malformed settings %s', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    await expect(isGoogleSignInAvailable('https://fixture.supabase.co', 'public-fixture')).rejects.toThrow()
  })
  it('propagates a failed or interrupted check without enabling OAuth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockRejectedValueOnce(new Error('aborted')))
    await expect(isGoogleSignInAvailable('https://fixture.supabase.co', 'public-fixture')).rejects.toThrow('provider_check_failed')
    await expect(isGoogleSignInAvailable('https://fixture.supabase.co', 'public-fixture')).rejects.toThrow('aborted')
  })
})
