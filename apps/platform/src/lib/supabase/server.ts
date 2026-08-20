import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requirePublicSupabaseConfig } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = requirePublicSupabaseConfig()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes them.
        }
      },
    },
  })
}
