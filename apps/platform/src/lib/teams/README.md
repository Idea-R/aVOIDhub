# Team service contract

`GET /api/teams` returns `TeamsSnapshot` from `contract.ts`. It requires a cookie
session. Each team includes UUID-only members. Only its owner receives recent
invitations (up to 50, prioritizing all active invites, expiring no earlier than seven days ago). Neither tokens
nor token digests appear in snapshots.

`POST /api/teams` requires JSON (maximum 4096 bytes), an authenticated cookie
session and an Origin exactly matching the request URL's origin. Its strict body
is one of:

- `{ action: 'create', name }`
- `{ action: 'invite', teamId, email }`
- `{ action: 'revoke', teamId, invitationId }`
- `{ action: 'accept', token }`
- `{ action: 'remove', teamId, memberId }`
- `{ action: 'leave', teamId }`
- `{ action: 'save-notes', teamId, notes, expectedRevision }`

Creation returns HTTP 201 and `{ teamId }`. Invitation creation returns HTTP 201
and `{ teamId, invitationId, expiresAt, token }`; the 32-byte random base64url
token appears only in that response. Other successes return HTTP 200 and
`{ teamId }`, except brief saves return `{ teamId, notesRevision }`. Each team
snapshot includes `notes` and `notes_revision`. Current members and the owner can
save a private shared brief of up to 2000 UTF16 units (supplementary characters
count twice); whitespace is preserved and NUL is rejected. The 4096-byte total
JSON limit still applies, so long Unicode payloads can return 413. Supply the
draft's base `expectedRevision` (integer 0–2147483647); a stale save returns 409
without changing text or revision. Preserve the draft for user review and never
retry it automatically. Clearing the brief also increments the revision.

Share links manually as `/teams#invite=TOKEN`. Clear the fragment
immediately into component memory; require an explicit accept click/POST. Never
put tokens in URL queries, storage, analytics or logs. No email provider is used.

Every route response carries `Cache-Control: private, no-store`,
`Vary: Cookie, Authorization`, and `Referrer-Policy: no-referrer`. Errors have
`{ error }`: 400 invalid_team_action; 401 authentication_required; 403
origin_not_allowed; 404 team_or_invitation_unavailable; 409 team_action_conflict;
413 body_too_large; 503 teams_unavailable. Unsupported methods return 405.

Names have 2-80 trimmed characters and exclude control characters; addresses are trimmed and normalized before validation, at most 254 characters. Limits:
five owned teams, twenty memberships per user, twenty members per team, twenty
pending invitations per team, one hundred invitation creations per team per
24 hours. Invites expire after seven days. Owners alone invite, revoke and
remove; owners cannot leave or remove themselves. An invitation requires the
recipient's actual confirmed `auth.users.email` to match case-insensitively.
Metadata, submitted actors, payment or platform role claims convey no authority.
Membership provides collaboration access only, with no publishing/creator/admin
or billing rights.

## Database boundary and rollout gate

The additive migration `20261105090000_platform_teams.sql` creates three RLS
tables with no anon/authenticated table grants. The only client entry points are
authenticated-only `platform_teams_snapshot()` and `platform_team_action(...)`.
Both derive identity from `auth.uid()` and use a fixed empty search path. The
mutation locks the actor and team, then the invite; acceptance rechecks expiry
against wall-clock time under the lock. Owner identity has no update endpoint.

Run `npm run test --workspace=@avoid/platform -- src/lib/teams/handlers.test.ts`
and `node supabase/tests/verify-platform-teams.mjs` locally. The latter needs
PostgreSQL 17 binaries (`TEAMS_TEST_PG_BIN` overrides the Windows default). It
creates its own loopback-only temporary cluster, uses minimal auth/foundation
sentinels, tests fresh and populated replay and negative/race cases, then stops
and removes the verified cluster. It never reads hosted configuration. These
fixtures do not emulate the entire existing foundation migration history.

This migration remains unapplied to hosted databases. Rollout requires parent
review, an inventory confirming these new names/signatures do not collide and
the existing foundation grants remain compatible, then an explicitly authorized
migration followed by API/UI deployment and real cookie-session smoke checks.
The checked-in historical SQL, foundation and teams also pass a native rehearsal
against an explicit synthetic legacy contract; see `docs/foundation-local-rehearsal.md`.
This does not recover the missing hosted history or certify real Auth/PostgREST.
Do not enable the UI against a database missing these functions. If recovery is
needed, disable the team UI/API while retaining the additive tables and data;
do not drop tables or undo unrelated grants. No provider, email or billing setup
is required.
