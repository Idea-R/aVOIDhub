import { describe, expect, it } from 'vitest'
import { getSafeReturnPath, getAuthCallbackOrigin } from './return-path'

describe('safe login return paths', () => {
  it('keeps local platform paths', () => {
    expect(getSafeReturnPath('/creators/dashboard/?view=games')).toBe('/creators/dashboard/?view=games')
  })

  it.each(['https://example.com', '//example.com', '/\\example.com', '', null, '/%2fexample.com', '/%5cexample.com', '/\\example.com', '/login/?next=//evil.test', '/auth/callback/', '/%00evil'])(
    'rejects an unsafe path: %s',
    (value) => expect(getSafeReturnPath(value)).toBe('/account/'),
  )
})

 it('preserves invitation return paths without escaping the platform',()=>{expect(getSafeReturnPath('/boomerangavoid/?room=garden_123')).toBe('/boomerangavoid/?room=garden_123')})

it('keeps a project deploy preview on its own OAuth cookie origin',()=>{const origin='https://deploy-preview-99--coruscating-squirrel-a47ad9.netlify.app';expect(getAuthCallbackOrigin(origin+'/auth/callback','https://avoidgame.io')).toBe(origin);expect(getAuthCallbackOrigin('https://evil.netlify.app/auth/callback','https://avoidgame.io')).toBe('https://avoidgame.io');expect(getAuthCallbackOrigin('http://localhost:3000/auth/callback','https://avoidgame.io')).toBe('https://avoidgame.io');expect(getAuthCallbackOrigin('http://localhost:3000/auth/callback','https://avoidgame.io',true)).toBe('http://localhost:3000')});
