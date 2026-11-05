# Public delivery and private team workspaces

Prepared against `main` commit `0e69577536f5de173d57f12725cc08ba98333f95` on November 5, 2026. This is a review candidate. No production deployment, hosted migration, provider-plan change, credential creation or account-permission change is part of this work.

## What the audit established

Five sequential anonymous HEAD requests to production showed public caching for the home page and the static VOIDaVOID entry, but `private,no-cache,no-store` and Netlify cache bypass for `/games/voidavoid`, `/leaderboards`, and `/login`. The baseline production build independently classified game details, leaderboards, login and ads.txt as dynamic.

Game details mixed shared scores and a visitor's personal best in one server render. The proxy matched almost every path and constructed a Supabase session client even for anonymous traffic. It also covered Vite JavaScript, audio and fonts. Game-card links could prefetch detail pages before a player chose one.

The deployment's existing Next.js server handler is established. Request mix, route-level invocation counts, bot traffic and the cause of the historical bill remain unknown. The restricted provider dashboard did not expose current metrics. Workflow configuration alone does not establish CI as the traffic source.

## Public pages and score boundaries

- All catalog detail pages are generated at build time. Unknown slugs return 404; catalog additions automatically join the generated routes. `dynamic = 'error'` guards against accidentally introducing request-specific reads.
- Leaderboards and sign-in have static shells. The leaderboard explorer loads public scores when visited; game details request no scores until **Load scores** is chosen. Sign-in query handling remains in the browser, and the existing server callback still validates return paths.
- Public score responses contain only score ID, player name, score, trust label and recording time. User UUIDs, arbitrary metadata, profiles, sessions and personal bests are excluded. Current rows require accepted receipts and the selected game/mode; WreckaVOID also retains its ruleset filter.
- Shared database results use a 60-second Next data cache, partitioned by validated game, mode, Supabase project URL and the WreckaVOID ruleset. Public JSON has a 60-second CDN lifetime plus 120 seconds of stale-while-revalidate. The UI displays its observation time and warns that scores can lag by a few minutes. Failures are not turned into cached successful empty boards.
- Legacy fallback reads only already-public, receipt-free rows through an isolated anonymous client under existing RLS. It never upgrades their trust or reads pending/rejected receipts. The `submission_id` foundation column is required; an incompatible or unavailable schema fails closed.
- **Show my best** makes a separate verified-user request with `private, no-store` on every outcome. The browser auth SDK is loaded only for that explicit private-data action. Sign-out/account changes clear private values and abort in-flight requests.
- Public profile reads use a cookie-free anonymous client and require `is_public = true`. They remain dynamic, preserving immediate visibility changes rather than adding a stale public-profile cache.
- Proxy matching is limited to private workspaces, callbacks and nonpublic APIs. Empty sessions and bearer-token calls skip cookie refresh. Each handler still authenticates its caller; the proxy is not an authorization gate. Public pages, public score JSON and all game assets avoid it.
- The broad Netlify `/games/*` cache override is narrowed to image extensions. Private page data cannot inherit that public-image policy. Public link prefetching is disabled for game cards and related/detail-board links.

This reduces request-time work, not every possible function invocation. Netlify can invoke a function on a static route's first cache access after deployment. CDN misses, revalidation, private operations and score submissions still use the server. Local Next cache headers and identical anonymous/other-visitor HTML do not prove hosted Netlify cache hit rates or a dollar saving. Verify those after an authorized preview and after provider metrics access is restored.

Primary provider references: [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Netlify caching](https://docs.netlify.com/build/caching/caching-overview/). The implementation follows the installed Next.js version's bundled caching/proxy guides without enabling experimental Cache Components.

## Adding games

Build and staging share `apps/platform/game-build-manifest.json`; presentation stays in `src/data/games.ts`. The extensible verifier retains all existing release boundaries while permitting valid additional titles. See [game onboarding](game-onboarding.md).

Staging validates every source and target before replacement, rejects traversal and linked ancestors/trees, and only replaces declared targets. Existing games and friendly URLs remain unchanged. TankaVOID keeps its review-only/coming-soon gate. FLIPSIDE and independent-domain games retain their existing accounts, scores and commerce boundaries. This branch does not import, publish or modify the separate BoomerangaVOID branch.

## Private collaboration

`/teams` offers team creation, email-bound invitation links, membership management and a shared plain-text team brief. Owner/member roles apply only inside this workspace; they grant no creator approval, billing, publishing, provider or administrator rights.

Invitations use a cryptographically random 32-byte token. Only its SHA-256 digest is stored. The raw link is shown once, expires after seven days, and is shared manually; no email service or messages are involved. URL fragments keep the incoming token out of HTTP request URLs. The client immediately scrubs the fragment, retains it only in memory and accepts only after an explicit POST by a verified account with the confirmed invited email. Revoked, expired, consumed and mismatched invitations fail closed.

Team data, invitation emails and briefs stay private and uncached. Account changes/401s clear snapshots, drafts and generated links. Aborts plus identity-generation checks prevent delayed responses from restoring another account's data. A signed-out invitation can remain open while sign-in happens in another tab; **Check sign-in** verifies the next account before acceptance.

Briefs use server revisions. Refresh preserves the original revision of an unsaved draft; two writers cannot silently overwrite one another. A conflict keeps the draft, disables retries and requires an explicit **Use saved brief** read/discard before another edit. Both database and UI bound text, and the API independently bounds total streamed request bytes.

The additive migration is **unapplied to hosted storage**. Native PostgreSQL fixtures prove authorization, replay, concurrency, prior-schema upgrade and unrelated-sentinel preservation. A further rehearsal now applies both checked-in historical fragments, the actual foundation and teams against an explicit synthetic legacy contract, with 87 native assertions. It repairs demonstrated replay/signup/run failures but cannot replace the missing production history or real Auth/PostgREST checks. See the [foundation/auth rehearsal](foundation-local-rehearsal.md) and [team service contract](../apps/platform/src/lib/teams/README.md).

## Verification commands

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test apps/platform/scripts/game-onboarding.node-test.mjs
npm run test:catalog --workspace=@avoid/platform
npm run test --workspace=@avoid/platform
npm run typecheck --workspace=@avoid/platform
npm run build:platform:netlify
node tools/verify-platform-efficiency.mjs
node supabase/tests/verify-platform-teams.mjs
npm run test:foundation:database
```

The PostgreSQL test defaults to the existing Windows PostgreSQL 17 binaries. Set `TEAMS_TEST_PG_BIN` to an existing installation on another host. It creates, stops and removes only its own temporary loopback cluster, never using project credentials or existing databases. The existing release workflow also runs the local PostgreSQL suite using an installed runner binary directory.

Observed Windows verification: the complete existing release-candidate command passed, including all five game builds, the platform build/typecheck, 156 platform tests, 9 TankaVOID contract cases, 44 TankaVOID game cases, onboarding cases, catalog verification and foundation static checks. A final reserved-route collision regression brought the focused onboarding suite to 18 passing cases. Independent native PostgreSQL 17.5 verification passed all 93 assertions and removed its owned cluster. WORDaVOID's separate release check passed typechecking, lint, 33 tests and its production build after unused-dependency removal. These counts describe separate suites, not a deduplicated grand total.

The subsequent auth/foundation follow-up passed the complete candidate again with **254 platform tests across 22 files**, all five game builds, typechecking and the 18 onboarding cases. Independent native runs passed **87 foundation/history/team-coexistence assertions** and **95 focused team assertions** on PostgreSQL 17.5. The production artifact check also excludes synthetic fixture markers from the actual JavaScript chunks. Local browser auth fixtures confirmed zero eager provider/auth calls, disabled/error recovery, explicit mocked Google/email attempts and interrupted-return recovery; these are not real Google consent or email delivery.

Browser fixtures confirmed zero automatic public/personal score requests on the detail-style panel and one respective request after each button; invitation creation and explicit acceptance; fragment scrubbing while signed out; account/401 cleanup and delayed-response isolation; owner/member brief editing; pinned drafts through refresh and conflicts; and explicit saved-version recovery. The tested 320px layout had no overflowing inner controls. A guest VOIDaVOID run entered and paused without console errors, and static login return handling rejected an external destination while retaining `/teams/`. Synthetic auth events do not establish real Google sign-in or multi-device behavior.

Optional HTTP verification: start the built platform on loopback, then run `node tools/verify-platform-efficiency.mjs http://127.0.0.1:4176`. This checks identical public HTML across synthetic visitor headers and private/no-store responses. `tools/audit-platform-routes.mjs` makes only five sequential anonymous HEAD checks and collects no cookies or bodies.

For component journeys without any Supabase/Netlify access, run `node tools/serve-platform-fixtures.mjs` and open `http://127.0.0.1:4177/`. The explicit loopback-only fixture uses synthetic identities/data and a fake auth-event adapter; it is not real online authentication or multiplayer. Its counters expose automatic versus explicit score requests, and controls cover account changes, delayed reads and concurrent brief edits. Stop the owned server afterward. No fixture code or inventory belongs in production assets.

## Runtime maintenance and rollout

Next.js is pinned to patched 16.4.5, including patched sharp 0.35.5; platform Zod is 4.6.7 and source-map-js is refreshed within its compatible range. WORDaVOID's unused Zod dependency is removed, with its release checks retained. A malformed existing reduced-motion CSS block is closed so subsequent styles are no longer accidentally scoped inside it; stylesheet parsing is regression-tested.

The final production-dependency audit reports zero critical/high/moderate findings and four low findings in the existing Resend email dependency chain. This is not a claim that every dependency is vulnerability-free, nor a change to any email provider.

The Google application action and safer shared email/OAuth callback are now integrated locally. Neither loads provider settings automatically. Profile fallback creation uses private, bounded non-email handles with collision/race recovery. The separate BoomerangaVOID branch and its release policy remain untouched. Real Google provider setup and consent are still unverified; see the rehearsal document for origin/configuration and hosted gates.

Keep Netlify Pro. No new hosting, analytics product, paid resource, secret or OAuth grant is required by this candidate. Existing Supabase configuration and the foundation schema remain prerequisites. The new team migration, hosted compatibility tests, application release and real Google sign-in checks require the established authorized rollout. Do not merge or publish this candidate until those gates and the required approval are satisfied.

Before rollout, preserve the deployed artifact/ref and read back the migration target. Rehearse on an isolated staging database with existing foundation history. After approval, apply the additive schema before enabling the matching UI, verify owner/member/unrelated-user journeys, and inspect public versus private response headers and Netlify cache/usage metrics. An application rollback does not require deleting team records; retain the additive tables and data.
