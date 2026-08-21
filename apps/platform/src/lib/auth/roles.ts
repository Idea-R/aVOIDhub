import type { User } from '@supabase/supabase-js'

export type PlatformRole = 'player' | 'creator' | 'admin'

export function isPlatformAdmin(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.platform_role === 'admin'
}

export function getPlatformRole({
  user,
  creatorApproved,
}: {
  user: Pick<User, 'app_metadata'> | null | undefined
  creatorApproved: boolean
}): PlatformRole {
  if (isPlatformAdmin(user)) return 'admin'
  return creatorApproved ? 'creator' : 'player'
}
