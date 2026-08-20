import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { canTransitionReviewStatus, getReviewTable, reviewEntities } from '@/lib/admin/review'
import { getRequestUser } from '@/lib/auth/request-user'
import { isPlatformAdmin } from '@/lib/auth/roles'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  entity: z.enum(reviewEntities),
  id: z.string().uuid(),
  nextStatus: z.string().trim().min(2).max(32),
})

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  }

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
  if (!isPlatformAdmin(user)) return NextResponse.json({ error: 'admin_required' }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_review_action' }, { status: 400 })

  const { entity, id, nextStatus } = parsed.data
  const table = getReviewTable(entity)
  const admin = createAdminClient()
  const { data: current, error: readError } = await admin
    .from(table)
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: 'review_read_failed' }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'review_item_not_found' }, { status: 404 })
  if (!canTransitionReviewStatus(entity, current.status, nextStatus)) {
    return NextResponse.json({ error: 'transition_not_allowed' }, { status: 409 })
  }

  const update: Record<string, string> = { status: nextStatus }
  if (entity !== 'score_submission') update.updated_at = new Date().toISOString()
  if (entity !== 'score_submission' && ['approved', 'declined'].includes(nextStatus)) {
    update.reviewed_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from(table)
    .update(update)
    .eq('id', id)
    .eq('status', current.status)
    .select('id, status')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'review_write_failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'review_item_changed' }, { status: 409 })
  return NextResponse.json(data)
}
