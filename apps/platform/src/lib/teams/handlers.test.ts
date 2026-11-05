import { describe, expect, it, vi } from 'vitest'
import { createTeamsHandlers, hashToken, unsupportedTeamMethod, type TeamsClient } from './handlers'

const teamId = '1f83e60a-0ed5-4aba-922b-7d9b27f3b741'
function setup(user: { id: string } | null = { id: 'trusted-session-user' }) {
  const rpc = vi.fn().mockResolvedValue({ data: { teamId }, error: null })
  const auth = vi.fn().mockResolvedValue({ data: { user }, error: null })
  const factory = vi.fn(async () => ({ auth: { getUser: auth }, rpc }) as TeamsClient)
  return { ...createTeamsHandlers(factory), factory, rpc, auth }
}
function request(body: unknown, origin: string | null = 'https://avoidgame.io', headers: Record<string, string> = {}) {
  return new Request('https://avoidgame.io/api/teams', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...headers }, body: JSON.stringify(body) })
}
function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('vary')).toBe('Cookie, Authorization')
}

describe('team HTTP authority and privacy', () => {
  it.each([null, 'https://flipside.avoidgame.io', 'https://evil.example', 'null'])('rejects origin %s before authentication or database work', async origin => {
    const ctx = setup()
    const response = await ctx.POST(request({ action: 'create', name: 'Team' }, origin))
    expect(response.status).toBe(403)
    expect(ctx.factory).not.toHaveBeenCalled()
    privateResponse(response)
  })
  it('requires authentication for GET and POST', async () => {
    const ctx = setup(null)
    for (const response of [await ctx.GET(), await ctx.POST(request({ action: 'create', name: 'Team' }))]) {
      expect(response.status).toBe(401)
      privateResponse(response)
    }
    expect(ctx.rpc).not.toHaveBeenCalled()
  })
  it('GET only reads a snapshot; query tokens cannot accept an invite', async () => {
    const ctx = setup()
    const response = await ctx.GET()
    expect(ctx.rpc).toHaveBeenCalledExactlyOnceWith('platform_teams_snapshot')
    privateResponse(response)
  })
  it.each([
    { action: 'create', name: 'Team', owner_id: teamId },
    { action: 'create', name: 'Team', userId: teamId },
    { action: 'invite', teamId, email: 'recipient@example.com', role: 'owner' },
    { action: 'publish', teamId },
    { action: 'create', name: 'a'.repeat(81) },
    { action: 'create', name: 'Invalid\0team' },
    { action: 'create', name: 'Invalid\nteam' },
    { action: 'create', name: 'Invalid\u0085team' },
    { action: 'accept', token: 'bad' },
    { action: 'remove', teamId: 'bad', memberId: teamId },
    { action: 'save-notes', teamId, notes: 'a'.repeat(2001), expectedRevision: 0 },
    { action: 'save-notes', teamId, notes: 'brief', expectedRevision: -1 },
    { action: 'save-notes', teamId, notes: 'brief', expectedRevision: 0.5 },
    { action: 'save-notes', teamId, notes: 'brief', expectedRevision: 2147483648 },
    { action: 'save-notes', teamId, notes: 'brief', expectedRevision: 0, owner_id: teamId },
    { action: 'save-notes', teamId, notes: 'invalid\0brief', expectedRevision: 0 },
  ])('rejects unsupported or forged fields: %j', async body => {
    const ctx = setup()
    const response = await ctx.POST(request(body))
    expect(response.status).toBe(400)
    expect(ctx.factory).not.toHaveBeenCalled()
    privateResponse(response)
  })
  it('bounds streamed bytes even without content-length', async () => {
    const ctx = setup()
    const response = await ctx.POST(request({ action: 'create', name: 'a'.repeat(5000) }))
    expect(response.status).toBe(413)
    expect(ctx.factory).not.toHaveBeenCalled()
    privateResponse(response)
  })
  it('bounds declared body size', async () => {
    const ctx = setup()
    const response = await ctx.POST(request({}, undefined, { 'content-length': '4097' }))
    expect(response.status).toBe(413)
    expect(ctx.factory).not.toHaveBeenCalled()
    privateResponse(response)
  })
  it('rejects malformed JSON and other content types', async () => {
    const ctx = setup()
    const malformed = new Request('https://avoidgame.io/api/teams', { method: 'POST', headers: { origin: 'https://avoidgame.io', 'content-type': 'application/json' }, body: '{' })
    for (const response of [await ctx.POST(malformed), await ctx.POST(request({}, undefined, { 'content-type': 'text/plain' }))]) {
      expect(response.status).toBe(400)
      privateResponse(response)
    }
    expect(ctx.rpc).not.toHaveBeenCalled()
  })
  it('generates a 256-bit invite and sends only its digest to the database', async () => {
    const ctx = setup()
    const response = await ctx.POST(request({ action: 'invite', teamId, email: 'Recipient@example.com' }))
    const result = await response.json()
    expect(response.status).toBe(201)
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(result.token, 'base64url')).toHaveLength(32)
    expect(ctx.rpc).toHaveBeenCalledExactlyOnceWith('platform_team_action', { p_action: 'invite', p_team_id: teamId, p_email: 'recipient@example.com', p_token_hash: hashToken(result.token) })
    privateResponse(response)
  })
  it('normalizes surrounding email whitespace before validating an invitation', async () => {
    const ctx = setup()
    const response = await ctx.POST(request({ action: 'invite', teamId, email: '  Recipient@example.com  ' }))
    expect(response.status).toBe(201)
    expect(ctx.rpc.mock.calls[0][1].p_email).toBe('recipient@example.com')
    privateResponse(response)
  })
  it('hashes acceptance tokens without forwarding a submitted actor', async () => {
    const ctx = setup()
    const token = 'a'.repeat(43)
    const response = await ctx.POST(request({ action: 'accept', token }))
    expect(ctx.rpc).toHaveBeenCalledExactlyOnceWith('platform_team_action', { p_action: 'accept', p_token_hash: hashToken(token) })
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).not.toContain(token)
    privateResponse(response)
  })
  it('saves verbatim brief text with its base revision and no submitted authority', async () => {
    const ctx = setup()
    ctx.rpc.mockResolvedValue({ data: { teamId, notesRevision: 4 }, error: null })
    const response = await ctx.POST(request({ action: 'save-notes', teamId, notes: '  Draft\nNext step  ', expectedRevision: 3 }))
    expect(ctx.rpc).toHaveBeenCalledExactlyOnceWith('platform_team_action', { p_action: 'save-notes', p_team_id: teamId, p_notes: '  Draft\nNext step  ', p_expected_revision: 3 })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ teamId, notesRevision: 4 })
    privateResponse(response)
  })
  it('supports clearing the brief without resetting its revision', async () => {
    const ctx = setup()
    await ctx.POST(request({ action: 'save-notes', teamId, notes: '', expectedRevision: 7 }))
    expect(ctx.rpc).toHaveBeenCalledExactlyOnceWith('platform_team_action', { p_action: 'save-notes', p_team_id: teamId, p_notes: '', p_expected_revision: 7 })
  })
  it('returns private conflict without retrying a stale brief write', async () => {
    const ctx = setup()
    ctx.rpc.mockResolvedValue({ data: null, error: { code: 'PT409' } })
    const response = await ctx.POST(request({ action: 'save-notes', teamId, notes: 'stale draft', expectedRevision: 2 }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'team_action_conflict' })
    expect(ctx.rpc).toHaveBeenCalledTimes(1)
    privateResponse(response)
  })
  it('retains byte bounds for a long Unicode brief', async () => {
    const ctx = setup()
    const response = await ctx.POST(request({ action: 'save-notes', teamId, notes: '😀'.repeat(1000), expectedRevision: 0 }))
    expect(response.status).toBe(413)
    expect(ctx.rpc).not.toHaveBeenCalled()
    privateResponse(response)
  })
  it.each([['PT400', 400], ['PT401', 401], ['PT404', 404], ['PT409', 409], ['unexpected', 503]])('sanitizes database errors %s', async (code, status) => {
    const ctx = setup()
    ctx.rpc.mockResolvedValue({ data: null, error: { code, message: 'private database contents' } })
    for (const response of [await ctx.GET(), await ctx.POST(request({ action: 'create', name: 'Team' }))]) {
      expect(response.status).toBe(status)
      expect(JSON.stringify(await response.json())).not.toContain('private database contents')
      privateResponse(response)
    }
  })
  it('sanitizes unexpected failures', async () => {
    const ctx = setup()
    ctx.factory.mockRejectedValue(new Error('secret internal detail'))
    for (const response of [await ctx.GET(), await ctx.POST(request({ action: 'create', name: 'Team' }))]) {
      expect(response.status).toBe(503)
      expect(JSON.stringify(await response.json())).not.toContain('secret')
      privateResponse(response)
    }
  })
  it('makes unsupported HTTP methods private and non-mutating', () => {
    const response = unsupportedTeamMethod()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, POST')
    privateResponse(response)
  })
})
