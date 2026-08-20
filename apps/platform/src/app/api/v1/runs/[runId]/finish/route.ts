import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/auth/request-user'
import { validateWordAvoidFinish } from '@/lib/games/wordavoid'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  ticket: z.string().min(32).max(100),
  score: z.number().int().min(0).max(2_000_000_000).optional(),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  evidence: z.unknown().optional(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!hasAllowedWriteOrigin(request)) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  }

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  const { runId } = await context.params
  if (!parsed.success || !z.string().uuid().safeParse(runId).success) {
    return NextResponse.json({ error: 'invalid_finish_request' }, { status: 400 })
  }

  const ticketHash = createHash('sha256').update(parsed.data.ticket).digest('hex')
  const admin = createAdminClient()
  const { data: run, error: runError } = await admin
    .from('game_run_sessions')
    .select('id, user_id, game_key, mode, ruleset_version, client_metadata, status, expires_at')
    .eq('id', runId)
    .eq('user_id', user.id)
    .single()

  if (runError || !run) return NextResponse.json({ error: 'run_not_found' }, { status: 404 })

  let acceptedScore = parsed.data.score
  let acceptedMetrics = parsed.data.metrics
  let validationCapability = 'bounds_only'

  if (run.game_key === 'wordavoid') {
    const result = validateWordAvoidFinish(run, parsed.data.evidence)
    if (!result) return NextResponse.json({ error: 'run_manifest_invalid' }, { status: 400 })
    if (!result.validation.ok) {
      return NextResponse.json({
        error: 'run_evidence_rejected',
        reasons: result.validation.errors.map(({ code, eventIndex, field }) => ({ code, eventIndex, field })),
      }, { status: 400 })
    }
    acceptedScore = result.validation.summary.score
    acceptedMetrics = {
      ...result.validation.summary,
      rulesetVersion: result.manifest.rulesetVersion,
      dictionaryVersion: result.manifest.dictionaryVersion,
      dictionaryHash: result.manifest.dictionaryHash,
      validationCapability: 'server_recomputed',
    }
    validationCapability = 'server_recomputed'
  }

  if (acceptedScore === undefined) {
    return NextResponse.json({ error: 'score_required' }, { status: 400 })
  }

  const { data, error } = await admin.rpc('finish_provisional_run', {
    p_run_id: runId,
    p_user_id: user.id,
    p_ticket_hash: ticketHash,
    p_score: acceptedScore,
    p_metrics: acceptedMetrics,
  })

  if (error) {
    const conflict = error.message.includes('consumed') || error.code === '23505'
    return NextResponse.json({ error: conflict ? 'run_already_consumed' : 'run_finish_failed' }, { status: conflict ? 409 : 400 })
  }

  const result = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    submissionId: result?.submission_id,
    leaderboardScoreId: result?.leaderboard_score_id,
    verificationLevel: result?.verification_level ?? 'provisional',
    validationCapability,
    acceptedScore,
    acceptedMetrics,
  })
}

