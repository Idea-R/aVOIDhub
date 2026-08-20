import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim()
  if (!client || !/^ca-pub-\d{16}$/.test(client)) {
    return new NextResponse('Not configured.\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse(`google.com, ${client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

