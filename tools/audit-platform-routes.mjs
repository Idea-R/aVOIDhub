import { writeFile } from 'node:fs/promises'

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3000')
if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password ||
    !(origin.origin === 'https://avoidgame.io' || (origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)))) {
  throw new Error('Use the public aVOID origin or a loopback test server, without credentials.')
}

const paths = ['/', '/games/voidavoid', '/leaderboards', '/voidavoid/', '/login']
const headers = ['cache-control', 'cdn-cache-control', 'netlify-cdn-cache-control', 'cache-status', 'x-nextjs-cache', 'content-type', 'location']
const results = []
for (const pathname of paths) {
  const started = performance.now()
  try {
    const response = await fetch(new URL(pathname, origin), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    results.push({ pathname, status: response.status, elapsedMs: Math.round(performance.now() - started), headers: Object.fromEntries(headers.flatMap(key => response.headers.has(key) ? [[key, response.headers.get(key)]] : [])) })
  } catch (error) {
    results.push({ pathname, error: error.name })
  }
}
const report = { observedAt: new Date().toISOString(), origin: origin.origin, method: 'HEAD', notes: 'Five sequential anonymous header checks, not a load test or billing measurement. No cookies, tokens or response bodies collected.', results }
if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
