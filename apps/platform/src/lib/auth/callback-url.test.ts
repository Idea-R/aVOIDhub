import { describe, expect, it } from 'vitest'
import { getAuthCallbackUrl, getAuthOrigin, getAuthReturnPath } from './callback-url'

const site = 'https://avoidgame.io'
const preview = 'https://deploy-preview-65--coruscating-squirrel-a47ad9.netlify.app'

describe('authentication origin isolation', () => {
  it.each([site, preview, 'https://deploy-preview-999--coruscating-squirrel-a47ad9.netlify.app'])('keeps approved deployment %s on its cookie origin', origin => {
    expect(getAuthOrigin(origin + '/auth/callback?code=fixture', origin)).toBe(origin)
    expect(getAuthOrigin(origin + '/auth/callback')).toBe(origin)
    expect(new URL(getAuthCallbackUrl(origin, '/teams/?view=mine#members', origin)).origin).toBe(origin)
  })
  it.each(['https://evil.example', 'https://avoidgame.io.evil.example', 'https://deploy-preview-65--other.netlify.app', 'https://user:pass@avoidgame.io', 'http://avoidgame.io', 'https://avoidgame.io:444', 'http://localhost:3000'])('rejects unexpected hosted request %s', origin => {
    expect(getAuthOrigin(origin, undefined, false)).toBeNull()
    expect(() => getAuthCallbackUrl(origin, '/account/')).toThrow('invalid_auth_origin')
  })
  it.each(['not a URL', 'https://evil.example', 'https://avoidgame.io/path', 'https://avoidgame.io/?redirect=evil', 'https://avoidgame.io/#fragment', 'https://user@avoidgame.io', 'http://avoidgame.io', 'https://avoidgame.io/.', 'https://avoidgame.io?'])('fails closed for mistaken canonical config %s', config => {
    expect(getAuthOrigin(site, config)).toBeNull()
  })
  it('never borrows production configuration for a preview or another preview', () => {
    expect(getAuthOrigin(preview, site)).toBeNull()
    expect(getAuthOrigin(preview, 'https://deploy-preview-66--coruscating-squirrel-a47ad9.netlify.app')).toBeNull()
  })
  it.each(['http://localhost:3000', 'http://127.0.0.1:4000'])('permits explicit local development only: %s', origin => {
    expect(getAuthOrigin(origin, origin, true)).toBe(origin)
    expect(getAuthOrigin(origin, origin, false)).toBeNull()
  })
})

describe('authentication return paths', () => {
  it('preserves local paths, search and fragment with a canonical callback path', () => {
    const callback = new URL(getAuthCallbackUrl(site, '/teams/?view=mine#members', site + '/'))
    expect(callback.pathname).toBe('/auth/callback')
    expect(callback.searchParams.get('next')).toBe('/teams/?view=mine#members')
    expect(callback.searchParams.has('code')).toBe(false)
  })
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/%2fevil.example', '/%252fevil.example', '/%5cevil.example', '/%255cevil.example', '/..//evil.example', '/%2e%2e//evil.example', '/%00', '/%250a', '/%7f', '/%bad', '/login/', '/auth/callback?code=stolen', '/%6cogin/', '/a\nb', '', null, '/'+ 'x'.repeat(2048)])('falls back for unsafe or looping return %s', next => {
    expect(getAuthReturnPath(next)).toBe('/account/')
  })
})
