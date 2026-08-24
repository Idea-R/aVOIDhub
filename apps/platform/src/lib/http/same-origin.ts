import type { NextRequest } from 'next/server'

export function hasAllowedWriteOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const allowed = new Set([new URL(request.url).origin, 'https://avoidgame.io', 'https://flipside.avoidgame.io'])

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000')
    allowed.add('http://127.0.0.1:3000')
    allowed.add('http://localhost:5175')
    allowed.add('http://127.0.0.1:5175')
  }

  return allowed.has(origin)
}
