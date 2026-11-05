import type { TeamInvitation } from './contract'

export function isTeamInviteToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

// The caller must replace the address before retaining or displaying the token.
export function readTeamInviteFragment(href: string) {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const values = fragment.getAll('invite')
  const hasInvite = values.length > 0
  const token = values.length === 1 && isTeamInviteToken(values[0]) ? values[0] : null
  url.hash = ''
  return { token, invalid: hasInvite && token === null, cleanHref: url.href }
}

export function createTeamInviteLink(origin: string, token: string) {
  if (!isTeamInviteToken(token)) throw new Error('Invalid team invitation token')
  const site = new URL(origin)
  if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password) throw new Error('Invalid invitation origin')
  const url = new URL('/teams/', site.origin)
  url.hash = `invite=${token}`
  return url.href
}

export function teamInvitationStatus(invitation: Pick<TeamInvitation, 'expires_at' | 'revoked_at' | 'accepted_at'>, now = Date.now()): 'revoked' | 'accepted' | 'expired' | 'pending' {
  if (invitation.revoked_at) return 'revoked'
  if (invitation.accepted_at) return 'accepted'
  const expiry = Date.parse(invitation.expires_at)
  return Number.isFinite(expiry) && expiry > now ? 'pending' : 'expired'
}
