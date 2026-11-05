import { NextResponse, type NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/auth/request-user'
import { resolveBoard } from '@/lib/leaderboards/contract'
import { readPersonalBest } from '@/lib/leaderboards/server'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' }
export async function GET(request: NextRequest) {
  const selection = resolveBoard(request.nextUrl.searchParams.get('game'), request.nextUrl.searchParams.get('mode') ?? undefined)
  if (!selection) return NextResponse.json({ error: 'invalid_board' }, { status: 400, headers })
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401, headers })
    return NextResponse.json({ ...selection, personalBest: await readPersonalBest(user.id, selection) }, { headers })
  } catch { return NextResponse.json({ error: 'personal_best_unavailable' }, { status: 503, headers }) }
}
