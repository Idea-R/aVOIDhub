import { describe, expect, it } from 'vitest'
import { createTeamInviteLink, isTeamInviteToken, readTeamInviteFragment, teamInvitationStatus } from './invite-link'

const token = 'aB0_-'.repeat(8) + 'abc'

describe('team invitation links', () => {
  it('extracts only a valid fragment token and clears the whole fragment while preserving the rest of the URL', () => {
    expect(readTeamInviteFragment(`https://avoidgame.io/teams/?view=mine&sort=new#invite=${token}&panel=join`)).toEqual({
      token, invalid: false, cleanHref: 'https://avoidgame.io/teams/?view=mine&sort=new',
    })
  })

  it.each(['', 'a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '/', 'a'.repeat(42) + '+', 'a'.repeat(42) + '=', 'a'.repeat(42) + ' ', null, 123])('rejects malformed tokens: %s', value => {
    expect(isTeamInviteToken(value)).toBe(false)
  })

  it.each(['invite=', `invite=${token}&invite=${token}`, 'invite=bad', `invite=${'a'.repeat(42)}%2F`])('scrubs invalid or ambiguous fragments: %s', fragment => {
    expect(readTeamInviteFragment(`https://avoidgame.io/teams/#${fragment}`)).toEqual({ token: null, invalid: true, cleanHref: 'https://avoidgame.io/teams/' })
  })

  it('does not consume or accept query-string tokens', () => {
    const href = `https://avoidgame.io/teams/?invite=${token}#members`
    expect(readTeamInviteFragment(href)).toEqual({ token: null, invalid: false, cleanHref: `https://avoidgame.io/teams/?invite=${token}` })
  })

  it('handles URLs without an invite without inventing a token', () => {
    expect(readTeamInviteFragment('https://avoidgame.io/teams/#members')).toEqual({ token: null, invalid: false, cleanHref: 'https://avoidgame.io/teams/' })
    expect(readTeamInviteFragment('https://avoidgame.io/teams/').token).toBeNull()
  })

  it('generates a same-origin teams link with the token exclusively in its fragment', () => {
    const href = createTeamInviteLink('https://avoidgame.io', token)
    const url = new URL(href)
    expect(url.pathname).toBe('/teams/')
    expect(url.search).toBe('')
    expect(url.hash).toBe(`#invite=${token}`)
    expect(readTeamInviteFragment(href).token).toBe(token)
    expect(createTeamInviteLink('http://localhost:3000', token)).toBe(`http://localhost:3000/teams/#invite=${token}`)
  })

  it('refuses invalid tokens and unsafe origins rather than generating shareable links', () => {
    expect(() => createTeamInviteLink('https://avoidgame.io', 'bad')).toThrow()
    for (const origin of ['javascript:alert(1)', 'file:///tmp', 'https://user:secret@avoidgame.io', 'not a URL']) {
      expect(() => createTeamInviteLink(origin, token)).toThrow()
    }
  })
})

describe('team invitation status', () => {
  const now = Date.parse('2026-11-05T12:00:00Z')
  const invite = { expires_at: '2026-11-06T12:00:00Z', revoked_at: null, accepted_at: null }
  it('requires a valid expiry strictly after now for a pending invitation', () => {
    expect(teamInvitationStatus(invite, now)).toBe('pending')
    expect(teamInvitationStatus({ ...invite, expires_at: '2026-11-05T12:00:00Z' }, now)).toBe('expired')
    expect(teamInvitationStatus({ ...invite, expires_at: '2026-11-04T12:00:00Z' }, now)).toBe('expired')
    expect(teamInvitationStatus({ ...invite, expires_at: 'invalid' }, now)).toBe('expired')
  })
  it('does not present revoked or accepted invitations as usable even when their expiry is in the future', () => {
    expect(teamInvitationStatus({ ...invite, revoked_at: '2026-11-05T11:00:00Z' }, now)).toBe('revoked')
    expect(teamInvitationStatus({ ...invite, accepted_at: '2026-11-05T11:00:00Z' }, now)).toBe('accepted')
  })
})
