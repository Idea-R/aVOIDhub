import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

function profileName(user: User): string {
  const metadataName = typeof user.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name.trim()
    : ''
  const emailName = user.email?.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)
  return metadataName.slice(0, 40) || emailName || `player-${user.id.slice(0, 6)}`
}

export async function ensureUserProfile(user: User) {
  const admin = createAdminClient()
  const { data: existing, error: readError } = await admin
    .from('user_profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle()

  if (readError) throw readError
  if (existing) return existing

  const { data, error } = await admin
    .from('user_profiles')
    .insert({
      id: user.id,
      username: profileName(user),
    })
    .select('id, username')
    .single()

  if (error) throw error
  return data
}

export async function hasEntitlement(userId: string, entitlementKey: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('user_entitlements')
    .select('entitlement_key')
    .eq('user_id', userId)
    .eq('entitlement_key', entitlementKey)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}
