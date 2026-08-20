import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/auth/request-user'
import { isRankedGameKey, rankedGameRegistry } from '@/lib/games/registry'
import {
  wordAvoidValidationMetadata,
} from '@/lib/games/wordavoid'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { ensureUserProfile } from '@/lib/profiles/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createWordAvoidManifest,
  isWordAvoidV1Mode,
  WORDAVOID_RULESET_VERSION,
} from '@avoid/wordavoid-contract'

const bodySchema = z.object({
  gameKey: z.string(),
  mode: z.string().trim().min(1).max(40).default('default'),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  }

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isRankedGameKey(parsed.data?.gameKey)) {
    return NextResponse.json({ error: 'invalid_run_request' }, { status: 400 })
  }

  const game = rankedGameRegistry[parsed.data.gameKey]
  if (parsed.data.gameKey === 'wordavoid' && !isWordAvoidV1Mode(parsed.data.mode)) {
    return NextResponse.json({ error: 'unsupported_wordavoid_mode' }, { status: 400 })
  }
  const origin = request.headers.get('origin')
  if (process.env.NODE_ENV === 'production' && origin && !game.allowedOrigins.some((allowed) => allowed === origin)) {
    return NextResponse.json({ error: 'game_origin_not_allowed' }, { status: 403 })
  }

  await ensureUserProfile(user)
  const ticket = randomBytes(32).toString('base64url')
  const ticketHash = createHash('sha256').update(ticket).digest('hex')
  const wordAvoidSeed = parsed.data.gameKey === 'wordavoid'
    ? randomBytes(18).toString('base64url')
    : null
  const runLifetimeMs = parsed.data.gameKey === 'wordavoid'
    ? (parsed.data.mode === 'classic' ? 50 : 10) * 60 * 1000
    : 20 * 60 * 1000
  const expiresAt = new Date(Date.now() + runLifetimeMs).toISOString()
  const { data, error } = await createAdminClient()
    .from('game_run_sessions')
    .insert({
      user_id: user.id,
      game_key: parsed.data.gameKey,
      mode: parsed.data.mode,
      ruleset_version: parsed.data.gameKey === 'wordavoid' ? WORDAVOID_RULESET_VERSION : 'v1',
      ticket_hash: ticketHash,
      origin,
      expires_at: expiresAt,
      client_metadata: {
        ...(parsed.data.metadata ?? {}),
        ...(wordAvoidSeed ? { wordavoidValidation: wordAvoidValidationMetadata(wordAvoidSeed) } : {}),
      },
    })
    .select('id, expires_at')
    .single()

  if (error) return NextResponse.json({ error: 'run_start_failed' }, { status: 500 })
  const manifest = wordAvoidSeed && parsed.data.gameKey === 'wordavoid' && isWordAvoidV1Mode(parsed.data.mode)
    ? createWordAvoidManifest({ runId: data.id, seed: wordAvoidSeed, mode: parsed.data.mode })
    : null

  return NextResponse.json({
    runId: data.id,
    ticket,
    expiresAt: data.expires_at,
    verificationLevel: game.trust,
    validationCapability: manifest ? 'server_recomputed' : 'bounds_only',
    ...(manifest ? { manifest } : {}),
  }, { status: 201 })
}
