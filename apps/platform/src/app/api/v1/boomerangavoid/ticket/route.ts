import { getRoomTicketAudience } from '@/lib/auth/room-audience'
import { NextResponse, type NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/auth/request-user'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { mintTicket } from '@avoid/boomerangavoid-protocol/tickets'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  // Same-origin only: the cross-domain room server never receives platform session cookies.
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  const secret = process.env.BOOMERANGAVOID_TICKET_SECRET
  if (!isPlatformRuntimeConfigured() || !secret || secret.length < 32 || !process.env.BOOMERANGAVOID_SERVER_URL) return NextResponse.json({ error: 'online_unavailable' }, { status: 503 })
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return NextResponse.json({ error: 'invalid_request' }, { status: 413 })
  const body = await request.text()
  if (body.length > 1024) return NextResponse.json({ error: 'invalid_request' }, { status: 413 })
  let data: unknown
  try { data = JSON.parse(body) } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }) }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const { room, seats } = data as { room?: unknown; seats?: unknown }
  if (typeof room !== 'string' || !/^(create|[a-zA-Z0-9_-]{6,32})$/.test(room) || typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1 || seats > 6) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
    const raw = user.user_metadata?.display_name ?? user.user_metadata?.full_name
    const name = typeof raw === 'string' ? raw.replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 24) || 'Garden player' : 'Garden player'
    const audience=await getRoomTicketAudience(process.env.BOOMERANGAVOID_SERVER_URL!,process.env.BOOMERANGAVOID_TICKET_AUDIENCE ?? 'boomerangavoid',process.env.NODE_ENV!=='production')
    const ticket = mintTicket({ userId: user.id, name, room, seats, audience }, secret)
    return NextResponse.json({ ticket, expiresIn: 60 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'identity_unavailable' }, { status: 503 }) }
}
