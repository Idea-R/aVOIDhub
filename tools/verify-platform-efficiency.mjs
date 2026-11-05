import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadGameCatalog } from '../apps/platform/scripts/verify-game-catalog.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prerender = JSON.parse(await readFile(path.join(repo, 'apps/platform/.next/prerender-manifest.json'), 'utf8'))
const catalog = loadGameCatalog()
const publicPaths = ['/', '/leaderboards', '/login', '/ads.txt', ...catalog.allGames.map(game => `/games/${game.id}`)]
for (const route of publicPaths) assert.ok(prerender.routes[route], `${route} must be prerendered without visitor data`)
for (const route of ['/account', '/admin', '/teams', '/creators/dashboard', '/creators/submit', '/api/player/best', '/api/teams']) {
  assert.equal(prerender.routes[route], undefined, `${route} must never be in the public prerender cache`)
}
console.log(`PASS ${publicPaths.length} public static routes, including ${catalog.allGames.length} game pages; private account/team routes remain uncached.`)

if (process.argv[2]) {
  const origin = new URL(process.argv[2])
  assert.ok(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname) && origin.pathname === '/', 'HTTP verification is loopback-only')
  for (const route of ['/games/voidavoid', '/leaderboards', '/login']) {
    const first = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(10_000) })
    const other = await fetch(new URL(route, origin), { headers: { cookie: 'fixture-user=other', authorization: 'Bearer synthetic-invalid-token' }, signal: AbortSignal.timeout(10_000) })
    assert.equal(first.status, 200); assert.equal(other.status, 200)
    const hash = value => createHash('sha256').update(value).digest('hex')
    assert.equal(hash(await first.text()), hash(await other.text()), `${route} must be identical across visitor headers`)
    assert.equal(other.headers.has('set-cookie'), false)
    assert.ok(first.headers.get('cache-control')?.includes('s-maxage='), `${route} should be served from Next's static route cache`)
    console.log(`PASS anonymous/other-visitor identical static HTML: ${route}`)
  }
  for (const route of ['/teams', '/api/teams', '/api/player/best?game=invalid']) {
    const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(10_000) })
    assert.ok(response.headers.get('cache-control')?.includes('private') && response.headers.get('cache-control')?.includes('no-store'), `${route} must stay private,no-store`)
    console.log(`PASS private/no-store response: ${route} (${response.status})`)
  }
}
