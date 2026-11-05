import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
const mocks = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }))
import { ensureUserProfile } from './server'
const id = '00000000-0000-4000-8000-000000000001'
const user = { id, email: 'private.identity@example.invalid', user_metadata: { display_name: 'Name with spaces', role: 'admin', is_public: true } } as unknown as User
function setup() {
  const read = vi.fn().mockResolvedValue({ data: null, error: null })
  const insertResult = vi.fn().mockResolvedValue({ data: { id, username: 'saved' }, error: null })
  const insert = vi.fn((_row: Record<string, unknown>) => ({ select: () => ({ single: insertResult }) }))
  const table = { select: () => ({ eq: () => ({ maybeSingle: read }) }), insert }
  mocks.client.mockReturnValue({ from: () => table })
  return { read, insert, insertResult }
}
beforeEach(() => vi.resetAllMocks())
describe('private profile creation fallback', () => {
  it('preserves an existing profile and never overwrites its name or privacy choice', async () => {
    const ctx = setup(), existing = { id, username: 'chosen-name' }
    ctx.read.mockResolvedValue({ data: existing, error: null })
    expect(await ensureUserProfile(user)).toBe(existing)
    expect(ctx.insert).not.toHaveBeenCalled()
  })
  it('creates a private, valid 24-character handle without email or user-supplied authority', async () => {
    const ctx = setup()
    await ensureUserProfile(user)
    const inserted = ctx.insert.mock.calls[0][0]
    expect(inserted).toEqual({ id, username: `player-${createHash('md5').update(`${id}:0`).digest('hex').slice(0, 17)}`, is_public: false })
    expect(inserted.username).toMatch(/^[a-z0-9_-]{3,24}$/)
    expect(JSON.stringify(inserted)).not.toContain('private.identity')
    expect(JSON.stringify(inserted)).not.toContain('admin')
  })
  it('distinguishes UUIDs sharing the old generated-name prefix', async () => {
    const ctx = setup()
    await ensureUserProfile(user)
    await ensureUserProfile({ ...user, id: '00000000-0000-4000-8000-000000000002' })
    expect(ctx.insert.mock.calls[0][0].username).not.toBe(ctx.insert.mock.calls[1][0].username)
  })
  it('returns a concurrently created same-user profile without changing it', async () => {
    const ctx = setup(), concurrent = { id, username: 'trigger-created' }
    ctx.insertResult.mockResolvedValue({ data: null, error: { code: '23505' } })
    ctx.read.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: concurrent, error: null })
    expect(await ensureUserProfile(user)).toBe(concurrent)
    expect(ctx.insert).toHaveBeenCalledTimes(1)
  })
  it('tries the next bounded candidate when another user owns the generated handle', async () => {
    const ctx = setup()
    ctx.insertResult.mockResolvedValueOnce({ data: null, error: { code: '23505' } })
    await ensureUserProfile(user)
    expect(ctx.insert).toHaveBeenCalledTimes(2)
    expect(ctx.insert.mock.calls[1][0].username).toBe(`player-${createHash('md5').update(`${id}:1`).digest('hex').slice(0, 17)}`)
    expect(ctx.read).toHaveBeenCalledTimes(2)
  })
  it('stops after sixteen conflicts and never falls back to email or random authority', async () => {
    const ctx = setup()
    ctx.insertResult.mockResolvedValue({ data: null, error: { code: '23505' } })
    await expect(ensureUserProfile(user)).rejects.toThrow('profile_creation_conflict')
    expect(ctx.insert).toHaveBeenCalledTimes(16)
    expect(new Set(ctx.insert.mock.calls.map(([row]) => row.username)).size).toBe(16)
  })
  it('propagates backend failure without retrying a non-conflict', async () => {
    const ctx = setup(), error = { code: 'backend_unavailable' }
    ctx.insertResult.mockResolvedValue({ data: null, error })
    await expect(ensureUserProfile(user)).rejects.toBe(error)
    expect(ctx.insert).toHaveBeenCalledTimes(1)
  })
  it('does not insert after an uncertain initial read', async () => {
    const ctx = setup(), error = { code: 'backend_unavailable' }
    ctx.read.mockResolvedValue({ data: null, error })
    await expect(ensureUserProfile(user)).rejects.toBe(error)
    expect(ctx.insert).not.toHaveBeenCalled()
  })
})
