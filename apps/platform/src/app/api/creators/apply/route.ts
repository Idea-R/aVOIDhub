import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/auth/request-user'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  portfolioUrl: z.union([z.literal(''), z.string().url().max(500)]).default(''),
  pitch: z.string().trim().min(40).max(2000),
})

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_application' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('creator_applications')
    .insert({
      user_id: user.id,
      display_name: parsed.data.displayName,
      portfolio_url: parsed.data.portfolioUrl || null,
      pitch: parsed.data.pitch,
      status: 'pending',
    })
    .select('id, status, submitted_at')
    .single()

  if (error) {
    const duplicate = error.code === '23505'
    return NextResponse.json({ error: duplicate ? 'application_already_open' : 'application_failed' }, { status: duplicate ? 409 : 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

