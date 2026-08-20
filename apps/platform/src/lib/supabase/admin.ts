import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { requirePublicSupabaseConfig, requireSupabaseSecretKey } from '@/lib/env'

export function createAdminClient() {
  const { url } = requirePublicSupabaseConfig()

  return createClient(url, requireSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
