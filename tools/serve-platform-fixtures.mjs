import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(repo, 'apps/platform/fixtures/optimization')
const owner = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002', teamId = '00000000-0000-4000-8000-000000000010'
let userId = owner, delayNext = false
const counts = { teamReads: 0, teamWrites: 0, publicReads: 0, personalReads: 0, actions: [] }
const team = { id: teamId, name: 'Synthetic test crew', owner_id: owner, notes: 'A shared synthetic brief.', notes_revision: 0, created_at: '2026-11-01T00:00:00Z', members: [{ user_id: owner, role: 'owner', joined_at: '2026-11-01T00:00:00Z' }, { user_id: other, role: 'member', joined_at: '2026-11-02T00:00:00Z' }], invitations: [] }
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)) }
const server = await createServer({
  configFile: false, root: fixture, publicDir: false,
  resolve: { alias: [{ find: '@/lib/supabase/client', replacement: path.join(fixture, 'auth.ts') }, { find: '@', replacement: path.join(repo, 'apps/platform/src') }] },
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [{ name: 'local-synthetic-api', configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__fixture/')) return next()
    let body = {}; if (req.method === 'POST') { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8192) return json(res, { error: 'fixture_body_limit' }, 413) } body = JSON.parse(raw || '{}') }
    if (url.pathname === '/__fixture/status') return json(res, counts)
    if (url.pathname === '/__fixture/control') { if ('userId' in body) userId = body.userId; if (body.delayNext) delayNext = true; if (body.editBrief) { team.notes = 'Saved by another member.'; team.notes_revision++ } return json(res, { ok: true }) }
    if (url.pathname === '/api/leaderboards') { counts.publicReads++; return json(res, { game: 'voidavoid', mode: 'endless', scores: [{ id: 'fixture-score', playerName: 'Synthetic pilot', score: 314, trust: 'provisional', recordedAt: new Date().toISOString() }], observedAt: new Date().toISOString(), legacy: false }) }
    if (url.pathname === '/api/player/best') { counts.personalReads++; return userId ? json(res, { personalBest: 123 }) : json(res, { error: 'authentication_required' }, 401) }
    if (url.pathname !== '/api/teams') return json(res, { error: 'fixture_route_not_found' }, 404)
    if (req.method === 'GET') {
      counts.teamReads++
      const response = userId ? { userId, teams: [{ ...team, invitations: userId === owner ? [...team.invitations] : [] }] } : null
      if (delayNext) { delayNext = false; await new Promise(resolve => setTimeout(resolve, 10_000)) }
      return response ? json(res, response) : json(res, { error: 'authentication_required' }, 401)
    }
    counts.teamWrites++; counts.actions.push(body.action)
    if (!userId) return json(res, { error: 'authentication_required' }, 401)
    if (body.action === 'save-notes') { if (body.expectedRevision !== team.notes_revision) return json(res, { error: 'team_action_conflict' }, 409); team.notes = body.notes; team.notes_revision++; return json(res, { teamId, notesRevision: team.notes_revision }) }
    if (body.action === 'invite') { const id = '00000000-0000-4000-8000-000000000020', expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString(); team.invitations.push({ id, email: body.email, created_at: new Date().toISOString(), expires_at: expiresAt, revoked_at: null, accepted_at: null }); return json(res, { teamId, invitationId: id, token: 'A'.repeat(43), expiresAt }, 201) }
    if (body.action === 'revoke') { const invite = team.invitations.find(item => item.id === body.invitationId); if (invite) invite.revoked_at = new Date().toISOString() }
    return json(res, { teamId })
  }) } }],
  server: { host: '127.0.0.1', port: 4177, strictPort: true, fs: { allow: [repo] } },
})
await server.listen(); server.printUrls()
console.log('Local-only synthetic component fixtures. No Supabase/Netlify calls or real authentication. Ctrl+C stops this owned server.')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0) })
