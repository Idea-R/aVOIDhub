import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/auth/request-user'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { ensureUserProfile } from '@/lib/profiles/server'
import { createAdminClient } from '@/lib/supabase/admin'

const optionalUrl = z.union([z.literal(''), z.string().url().max(500)])
const bodySchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])?$/),
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500),
  isPublic: z.boolean(),
  socials: z.object({ website: optionalUrl, instagram: optionalUrl, x: optionalUrl }),
})

export async function PATCH(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_profile' }, { status: 400 })

  await ensureUserProfile(user)
  const { data, error } = await createAdminClient()
    .from('user_profiles')
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      is_public: parsed.data.isPublic,
      social_links: Object.fromEntries(Object.entries(parsed.data.socials).filter(([, value]) => value)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('username, display_name, bio, is_public, social_links')
    .single()

  if (error) return NextResponse.json({ error: error.code === '23505' ? 'username_taken' : 'profile_update_failed' }, { status: error.code === '23505' ? 409 : 500 })
  return NextResponse.json(data)
}

