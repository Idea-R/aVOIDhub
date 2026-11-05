# Hosting, identity and release proposal

No resource, credential, provider security setting, DNS record, database migration or production deploy has been changed by this implementation. This file makes the remaining actions concrete for review.

## Verified existing production

- GitHub: `Idea-R/aVOIDhub`, production branch `main`.
- Netlify: `coruscating-squirrel-a47ad9`, site ID `780c1b04-64c7-47b6-9423-18953739590e`, canonical `https://avoidgame.io`.
- Last verified production deploy/rollback: `6a9cdccc91ff570008363f2f`, commit `0e69577536f5de173d57f12725cc08ba98333f95`.
- Live deployed backend matches existing Supabase project `jyuafqzjrzifqbgcqbnt`; public auth settings: Google off, email on, signup on. Values for public keys and all secrets are omitted.

## Persistent room service

Proposed first host: **Render paid Web Service**, name `boomerangavoid-rooms`, Oregon, Node 22 container from this branch. Use its provider-assigned HTTPS/WSS hostname; no DNS change is needed. The service does not yet exist, so an exact generated hostname cannot honestly be supplied.

Start with compute ID `0.5c-512mb` (legacy Starter alias), **$7/month**, 0.5 CPU/512 MB, and `BAV_MAX_ROOMS=2` until host measurements justify a larger cap. These are vendor prices/specifications, not measured game capacity. A 20-room/120-seat claim requires the planned 30-minute host benchmark and two-hour one-room soak. [Pricing](https://render.com/pricing), [compute IDs](https://render.com/docs/compute-plans), [WebSocket support](https://render.com/docs/websocket).

Build target: repository-root Dockerfile at `apps/boomerangavoid-server/Dockerfile`. A review-only `render.yaml.example` is provided. Health check `/health`; readiness returns 503 during drain or when production signing is absent. Graceful drain stops new joins, waits up to 25 seconds, then closes without awarding unfinished games. Render's shutdown grace must accommodate that window. Room state is ephemeral and a crash loses active matches; the UI offers a fresh lobby rather than inventing a recovery result.

| Location | Variable / setting | Exact intended value or constraint |
| --- | --- | --- |
| Room service | `NODE_ENV`, `BAV_BIND`, `PORT` | `production`, `0.0.0.0`, provider port |
| Room service | `BAV_REGION`, `BAV_MAX_ROOMS` | `Oregon`, `2` initially |
| Room service | `BAV_ALLOWED_ORIGINS` | Exact `https://avoidgame.io` plus the exact accepted PR preview origin; no wildcard |
| Both server environments | `BOOMERANGAVOID_TICKET_AUDIENCE` | `boomerangavoid` |
| Platform and room service | `BOOMERANGAVOID_TICKET_SECRET` | The same newly generated random >=32-character secret, server-only; never committed or browser-prefixed |
| Platform runtime | `BOOMERANGAVOID_SERVER_URL` | Provisioned service HTTPS origin; used to read health/protocol/content/boot epoch before minting tickets |
| Netlify game build | `VITE_BOOMERANGAVOID_SERVER` | Same provisioned HTTPS origin; public endpoint only |
| Production | `BAV_ALLOW_GUESTS` | Unset; production ignores this flag regardless |

No service-role database key is needed for the current ephemeral room game. Do not expose the ticket secret as a `NEXT_PUBLIC_` or `VITE_` variable. Boot epoch in the public health response is an audience identifier, not a secret. A restart invalidates previously minted tickets, including nonce replay after restart.

**Required action-time approval:** create the $7/month service and new shared persistent signing secret, set the listed server-only/build environment values, and deploy only the accepted revision. If cost/region changes, review the new values before provisioning. A static Netlify draft preview alone does not require the new WSS host.

## Google sign-in

The application now has a Google action, recoverable provider-disabled/error state and existing email fallback. It requests only Google's normal identity scopes through Supabase. Before enabling the provider, inspect the existing authorized Google client and consent audience; reuse suitable existing credentials rather than guessing or replacing them.

Expected Google authorized redirect URI: `https://jyuafqzjrzifqbgcqbnt.supabase.co/auth/v1/callback`. Supabase must allow the exact accepted platform callback URLs: `https://avoidgame.io/auth/callback` and `https://deploy-preview-<PR>--coruscating-squirrel-a47ad9.netlify.app/auth/callback`, including the platform's safe `next` query behavior. Do not add a wildcard merely to make previews work. Existing allowlist/client settings have not been read through an authorized admin connection, so any exact adjustment must first be compared to the current values. [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

**Required action-time approval:** the exact Google/Supabase provider enablement, credential creation/expansion if actually necessary, and redirect/consent security changes identified by that comparison. Then complete consent cancellation/error, existing/new-user login, cookie refresh, logout/relogin, intended-room return and room-ticket canaries on the real Next preview. No message or screenshot currently proves Google login works.

## Release and rollback

Keep the catalog status held until hosted WSS/auth, device and operational gates are accepted. Review-only draft PR/Netlify preview can be created under the existing repository workflow. Main merge and production deployment remain separate explicit approvals.

Before production: pin the accepted commit and lockfile; record preview deploy identity; run two external-network clients and the host capacity/soak; complete Google canaries; reconcile the remaining DATA-01/A05 scope; record health/error monitoring and exact baseline alert thresholds from measured load.

Rollback frontend to Netlify deploy `6a9cdccc91ff570008363f2f` (reverify it is still last-good before use); rollback room container to its last accepted image, or disable online endpoint and leave practice/couch available. A code rollback does not undo provider credentials/security settings, so record every approved remote setting's prior value privately. No database rollback is currently needed because no migration or persisted game results were introduced. Drain active rooms before a planned server replacement.
