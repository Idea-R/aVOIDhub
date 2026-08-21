import { describe, expect, it } from 'vitest'
import { getSafeReturnPath } from './return-path'

describe('safe login return paths', () => {
  it('keeps local platform paths', () => {
    expect(getSafeReturnPath('/creators/dashboard/?view=games')).toBe('/creators/dashboard/?view=games')
  })

  it.each(['https://example.com', '//example.com', '/\\example.com', '', null])(
    'rejects an unsafe path: %s',
    (value) => expect(getSafeReturnPath(value)).toBe('/account/'),
  )
})
