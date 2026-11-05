import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ admin: vi.fn(), publicClient: vi.fn(), cache: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: mocks.publicClient }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown, keys: unknown, options: unknown) => { mocks.cache(keys, options); return fn } }))
import { readPersonalBest, readPublicBoard } from './server'
function query(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const key of ['select', 'eq', 'contains', 'is', 'order', 'limit']) q[key] = vi.fn(() => q)
  q.maybeSingle = vi.fn(() => Promise.resolve(result))
  q.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve))
  return q
}
beforeEach(() => { mocks.admin.mockReset(); mocks.publicClient.mockReset() })
describe('score data query boundaries', () => {
  it('only reads accepted matching game/mode and returns public fields', async () => {
    const q = query({ data: [{ id: 'score', user_id: 'private-owner', player_name: 'Player', score: 8, metadata: { secret: 'private', validationCapability: 'server_recomputed' }, verification_level: 'provisional', created_at: '2026-11-05T00:00:00Z' }], error: null })
    mocks.admin.mockReturnValue({ from: () => q })
    const result = await readPublicBoard({ game: 'voidavoid', mode: 'endless' })
    expect(q.eq.mock.calls).toEqual([['game_key', 'voidavoid'], ['submission.status', 'accepted'], ['submission.mode', 'endless']])
    expect(q.limit).toHaveBeenCalledWith(200)
    expect(JSON.stringify(result)).not.toContain('private')
    expect(mocks.publicClient).not.toHaveBeenCalled()
  })
  it('uses anonymous legacy rows with no receipt and never promotes their trust', async () => {
    const current = query({ data: null, error: { code: 'fixture-schema-unavailable' } })
    const old = query({ data: [{ id: 'old', user_id: null, player_name: 'Old', score: 3, metadata: { validationCapability: 'server_recomputed' }, created_at: '2026-01-01T00:00:00Z' }], error: null })
    mocks.admin.mockReturnValue({ from: () => current }); mocks.publicClient.mockReturnValue({ from: () => old })
    const result = await readPublicBoard({ game: 'wreckavoid', mode: 'wreck-run' })
    expect(old.is).toHaveBeenCalledWith('submission_id', null)
    expect(old.contains).toHaveBeenCalledWith('metadata', { mode: 'wreck-run' })
    expect(current.contains).toHaveBeenCalled(); expect(old.contains).toHaveBeenCalled()
    expect(result.legacy).toBe(true); expect(result.scores[0].trust).toBe('legacy')
  })
  it('does not fabricate an empty successful board after database failure', async () => {
    mocks.admin.mockReturnValue({ from: () => query({ data: null, error: {} }) })
    mocks.publicClient.mockReturnValue({ from: () => query({ data: null, error: {} }) })
    await expect(readPublicBoard({ game: 'voidavoid', mode: 'endless' })).rejects.toThrow('leaderboard_unavailable')
  })
  it('can read only public legacy rows when a server key is unavailable', async () => {
    const old = query({ data: [], error: null })
    mocks.admin.mockImplementation(() => { throw new Error('missing server configuration') })
    mocks.publicClient.mockReturnValue({ from: () => old })
    const result = await readPublicBoard({ game: 'voidavoid', mode: 'endless' })
    expect(result.legacy).toBe(true)
    expect(old.is).toHaveBeenCalledWith('submission_id', null)
  })
  it('filters personal best by the verified owner and ruleset without public caching', async () => {
    const q = query({ data: { score: 42 }, error: null }); mocks.admin.mockReturnValue({ from: () => q })
    expect(await readPersonalBest('trusted-owner', { game: 'wreckavoid', mode: 'wreck-run' })).toBe(42)
    expect(q.eq).toHaveBeenCalledWith('user_id', 'trusted-owner')
    expect(q.eq).toHaveBeenCalledWith('submission.status', 'accepted')
    expect(q.contains).toHaveBeenCalled(); expect(mocks.publicClient).not.toHaveBeenCalled()
  })
})
