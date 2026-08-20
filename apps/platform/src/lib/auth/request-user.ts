import 'server-only'

import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function getRequestUser(request?: NextRequest): Promise<User | null> {
  const authorization = request?.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()
    if (!token) return null
    const { data, error } = await createAdminClient().auth.getUser(token)
    return error ? null : data.user
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null
  const { data: userData, error: userError } = await supabase.auth.getUser()
  return userError ? null : userData.user
}
