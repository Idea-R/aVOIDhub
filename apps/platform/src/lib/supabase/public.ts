import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requirePublicSupabaseConfig } from '@/lib/env'

// Public reads must never inherit a visitor's cookies, bearer token or RLS role.
export function createPublicClient() {
  const { url, publishableKey } = requirePublicSupabaseConfig()
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
