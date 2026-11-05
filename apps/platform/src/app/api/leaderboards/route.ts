import { NextResponse, type NextRequest } from 'next/server'
import { getPublicSupabaseConfig } from '@/lib/env'
import { resolveBoard } from '@/lib/leaderboards/contract'
import { getPublicBoard } from '@/lib/leaderboards/server'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const selection = resolveBoard(params.get('game'), params.get('mode') ?? undefined)
  if (!selection || [...params.keys()].some(key => !['game', 'mode'].includes(key)) || params.getAll('game').length !== 1 || params.getAll('mode').length > 1) {
    return NextResponse.json({ error: 'invalid_board' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  const config = getPublicSupabaseConfig()
  if (!config) return NextResponse.json({ error: 'leaderboard_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  try {
    return NextResponse.json(await getPublicBoard(selection.game, selection.mode, config.url), { headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      'Netlify-CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    return NextResponse.json({ error: 'leaderboard_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
  }
}
