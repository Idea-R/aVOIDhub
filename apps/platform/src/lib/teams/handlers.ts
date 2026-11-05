import { createHash, randomBytes } from 'node:crypto'
import { teamActionSchema, type TeamAction } from './contract'

type RpcResult = { data: unknown; error: { code?: string } | null }
export type TeamsClient = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> }
  rpc(name: string, args?: Record<string, string | number>): PromiseLike<RpcResult>
}
type ClientFactory = () => Promise<TeamsClient>
const noStoreHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'Referrer-Policy': 'no-referrer' }

export function teamResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStoreHeaders })
}

export function unsupportedTeamMethod() {
  const response = teamResponse({ error: 'method_not_allowed' }, 405)
  response.headers.set('Allow', 'GET, POST')
  return response
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new Error('invalid_body')
  const declaredSize = request.headers.get('content-length')
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > 4096)) throw new Error('body_too_large')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) {
        await reader.cancel()
        throw new Error('body_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
}

function rpcArgs(action: TeamAction): Record<string, string | number> {
  switch (action.action) {
    case 'create': return { p_action: action.action, p_name: action.name }
    case 'invite': return { p_action: action.action, p_team_id: action.teamId, p_email: action.email }
    case 'revoke': return { p_action: action.action, p_team_id: action.teamId, p_invitation_id: action.invitationId }
    case 'accept': return { p_action: action.action, p_token_hash: hashToken(action.token) }
    case 'remove': return { p_action: action.action, p_team_id: action.teamId, p_member_id: action.memberId }
    case 'leave': return { p_action: action.action, p_team_id: action.teamId }
    case 'save-notes': return { p_action: action.action, p_team_id: action.teamId, p_notes: action.notes, p_expected_revision: action.expectedRevision }
  }
}

export function hashToken(token: string) { return createHash('sha256').update(token, 'utf8').digest('hex') }

function rpcError(code?: string) {
  const status = code === 'PT400' ? 400 : code === 'PT401' ? 401 : code === 'PT404' ? 404 : code === 'PT409' ? 409 : 503
  const error = status === 401 ? 'authentication_required' : status === 404 ? 'team_or_invitation_unavailable' : status === 409 ? 'team_action_conflict' : status === 400 ? 'invalid_team_action' : 'teams_unavailable'
  return teamResponse({ error }, status)
}

export function createTeamsHandlers(createClient: ClientFactory) {
  return {
    async GET() {
      try {
        const client = await createClient()
        const { data, error } = await client.auth.getUser()
        if (error || !data.user) return teamResponse({ error: 'authentication_required' }, 401)
        const result = await client.rpc('platform_teams_snapshot')
        return result.error ? rpcError(result.error.code) : teamResponse(result.data)
      } catch { return teamResponse({ error: 'teams_unavailable' }, 503) }
    },
    async POST(request: Request) {
      // Team invites are account-sensitive: only the exact requesting site may mutate.
      if (request.headers.get('origin') !== new URL(request.url).origin) return teamResponse({ error: 'origin_not_allowed' }, 403)
      let body: unknown
      try { body = await readBoundedJson(request) }
      catch (error) { return teamResponse({ error: error instanceof Error && error.message === 'body_too_large' ? 'body_too_large' : 'invalid_team_action' }, error instanceof Error && error.message === 'body_too_large' ? 413 : 400) }
      const parsed = teamActionSchema.safeParse(body)
      if (!parsed.success) return teamResponse({ error: 'invalid_team_action' }, 400)
      try {
        const client = await createClient()
        const { data, error } = await client.auth.getUser()
        if (error || !data.user) return teamResponse({ error: 'authentication_required' }, 401)
        const args = rpcArgs(parsed.data)
        const token = parsed.data.action === 'invite' ? randomBytes(32).toString('base64url') : null
        if (token) args.p_token_hash = hashToken(token)
        const result = await client.rpc('platform_team_action', args)
        if (result.error) return rpcError(result.error.code)
        return teamResponse(token ? { ...(result.data as Record<string, unknown>), token } : result.data, parsed.data.action === 'create' || token ? 201 : 200)
      } catch { return teamResponse({ error: 'teams_unavailable' }, 503) }
    },
  }
}
