import { describe, expect, it } from 'vitest'
import { getLoginReturnPath, getSafeReturnPath } from './return-path'

describe('safe login return paths', () => {
  it('keeps local platform paths', () => {
    expect(getSafeReturnPath('/creators/dashboard/?view=games')).toBe('/creators/dashboard/?view=games')
  })

  it.each(['https://example.com', '//example.com', '/\\example.com', '/%2Fexample.com', '/%5Cexample.com', '', null])(
    'rejects an unsafe path: %s',
    (value) => expect(getSafeReturnPath(value)).toBe('/account/'),
  )

  it('accepts the first value from repeated local parameters', () => {
    expect(getSafeReturnPath(['/wreckavoid/', '/account/'])).toBe('/wreckavoid/')
  })

  it('supports legacy returnTo only when next is absent', () => {
    expect(getLoginReturnPath(undefined, '/wreckavoid/')).toBe('/wreckavoid/')
    expect(getLoginReturnPath('/creators/apply/', '/wreckavoid/')).toBe('/creators/apply/')
  })

  it('does not let an unsafe next value fall through to legacy returnTo', () => {
    expect(getLoginReturnPath('https://example.com', '/wreckavoid/')).toBe('/account/')
    expect(getLoginReturnPath(undefined, '//example.com')).toBe('/account/')
  })
})
