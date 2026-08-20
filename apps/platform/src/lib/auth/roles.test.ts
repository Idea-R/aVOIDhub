import { describe, expect, it } from 'vitest'
import { getPlatformRole, isPlatformAdmin } from './roles'

describe('platform roles', () => {
  it('accepts only the server-controlled app metadata claim for admin access', () => {
    expect(isPlatformAdmin({ app_metadata: { platform_role: 'admin' } })).toBe(true)
    expect(isPlatformAdmin({ app_metadata: { platform_role: 'creator' } })).toBe(false)
    expect(isPlatformAdmin({ app_metadata: {} })).toBe(false)
  })

  it('does not treat user-editable profile metadata as authorization', () => {
    expect(isPlatformAdmin({ app_metadata: { user_metadata: { platform_role: 'admin' } } })).toBe(false)
  })

  it('keeps approval and admin authority separate', () => {
    expect(getPlatformRole({ user: { app_metadata: {} }, creatorApproved: true })).toBe('creator')
    expect(getPlatformRole({ user: { app_metadata: { platform_role: 'admin' } }, creatorApproved: false })).toBe('admin')
  })
})
