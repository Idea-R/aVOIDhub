import 'server-only'

import { createHash } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export async function ensureUserProfile(user: User) {
  const admin = createAdminClient()
  const read = () => admin
    .from('user_profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle()

  const { data: existing, error: readError } = await read()
  if (readError) throw readError
  if (existing) return existing

  // Match the foundation trigger's bounded, non-email handle convention. The
  // hash is a presentation identifier, never a credential or authority claim.
  for (let attempt = 0; attempt < 16; attempt++) {
    const username = `player-${createHash('md5').update(`${user.id.toLowerCase()}:${attempt}`).digest('hex').slice(0, 17)}`
    const { data, error } = await admin.from('user_profiles')
      .insert({ id: user.id, username, is_public: false })
      .select('id, username').single()
    if (!error) return data
    if (error.code !== '23505') throw error
    // A trigger or another request may have created this user's profile. Never
    // overwrite it or reset their later privacy choice while resolving a race.
    const current = await read()
    if (current.error) throw current.error
    if (current.data) return current.data
  }
  throw new Error('profile_creation_conflict')
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
