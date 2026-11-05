# Foundation and authentication rehearsal

This review candidate now executes the checked-in historical SQL, platform foundation and teams together against an **explicit synthetic legacy contract**. It is not a recovered production schema, a copy of real users, or a hosted Supabase acceptance test.

## What runs

`supabase/tests/database/platform_foundation_legacy_fixture.sql` declares the missing legacy table/type/default assumptions and a minimal Supabase identity/role shim. The native harness then applies, in order:

1. `20250607070000_fix_current_time_issue.sql`
2. `20250705173200_enhanced_leaderboard_system.sql`
3. `20260820064235_avoid_platform_foundation.sql`
4. `20261105090000_platform_teams.sql`

Fresh and populated variants exercise actual PostgreSQL grants, RLS, signup triggers, service-only run completion, retries, concurrent finishes, team invitations and member brief editing. Fingerprints verify legacy and unrelated records survive. Additional cases cover transaction rollback, migration replay and ambiguous/partial legacy state.

Run `npm run test:foundation:database`. The default Windows installation is PostgreSQL 17 under Program Files; another existing installation can be selected with `FOUNDATION_TEST_PG_BIN`. The harness starts only its own temporary loopback cluster, disables Unix sockets, reads no project env or credentials, and verifies shutdown before deleting its owned directory. The existing GitHub release workflow runs this rehearsal and the separate team suite on Linux.

The independent Windows run passed **87 native assertions on PostgreSQL 17.5**. The existing static verifier also passes and inspects 54 pgTAP assertions; it does not execute pgTAP. These are different forms of evidence.

## Bugs demonstrated and repaired

- The old reserved `current_time` rename did not parse. It is quoted and scoped to public; if both old/new columns exist, the migration stops without discarding either value.
- Foundation replay revoked later team RPC access and re-privatized profiles their owners had subsequently published. A completion marker separates one-time legacy lockdown/privacy conversion from scoped replay repairs.
- Signup/backfill usernames could collide for UUIDs sharing a prefix and exceeded the profile editor's 24-character limit. Both now derive bounded candidates from the complete UUID and retry occupied handles. The application fallback follows the same convention, inserts private profiles, resolves concurrent same-user creation without overwriting it, and never derives a username from email.
- A surviving historical aggregate trigger failed inside the hardened score RPC's empty search path. It is retired alongside the other browser-era aggregate side effects, while historical aggregate records remain intact.
- Existing legacy RLS flags are explicitly restored before narrow browser grants are exposed.
- Run completion now rejects null ticket/identity/score values before mutation and checks expiry against wall-clock time. Statistics updates reject null bounds and disambiguate the real legacy column from the same-named parameter.
- Team creation rejects control characters at both HTTP and RPC boundaries; surrounding invitation-email whitespace is normalized before validation.

## Replay and migration authority

Run the foundation in the migration runner's **single transaction**. Its file does not commit a surrounding provider transaction. `platform_foundation_migration_state` has RLS and no browser access; its version row is inserted only at the successful end. A failed atomic transaction leaves no completion marker or partial DDL.

An existing full or partial foundation without a valid marker **fails closed** with `unmarked_platform_foundation_requires_review`. Do not stamp it as complete, delete it, reset user visibility, rewrite live migration records, or replay old SQL to silence that guard. An operator must inventory the actual applied history/schema and prepare a reviewed forward reconciliation. A green synthetic rehearsal cannot supply that missing evidence.

The initial foundation still deliberately closes inherited browser grants and makes legacy profiles private. That production privacy decision and coordinated client/API release remain separately approved operations. Later successful replays retain genuine profile opt-in and explicitly authorized extension grants while repairing the foundation's own policies and service-only functions.

## Google and email application flow

The candidate integrates the focused Google application code from BoomerangaVOID without changing that branch or importing its admission/room policy. Provider settings are checked only after a Google click. A disabled/malformed/unavailable provider produces a recoverable message; email OTP remains available. Both actions guard duplicate submission, and a restored browser page can recover from interrupted navigation. No extra provider scopes or offline access are requested.

Authentication callbacks stay on the same approved deployment origin: `https://avoidgame.io` or this Netlify site's numbered HTTPS previews. Arbitrary hosts, malformed canonical configuration and production/preview mismatches fail before session exchange. HTTP loopback is allowed only in development/test context. Return paths reject control characters, encoded separator tricks and login/callback loops; error redirects preserve only a safe local destination. Callback responses are private/no-store and no-referrer.

A read-only preview cancellation check exposed the global Next header rule overriding the handler's referrer policy at the hosting adapter. Scoped auth/team header rules now follow the public default, and the built routing-manifest verifier checks their final precedence. Hosted verification must inspect the actual response, not just a directly invoked handler's unit test.

Local mocked tests and browser fixtures cover handler behavior, provider-disabled/error states, email preservation, interrupted-return recovery and no eager requests. At 320px, the tested sign-in controls did not overflow. All fixture auth is synthetic and loopback-only; no Google consent or email was sent.

## Remaining hosted prerequisites

No verified isolated aVOID staging database or approved test identities exist in the inspected account. Before real end-to-end testing, obtain an approved nonproduction target; reconcile its actual baseline/history; review migration target/hashes and recovery; configure only this feature branch's matching stage public/runtime values and callback origin; provide distinct owner/member/unrelated test identities; and approve the stage Google Web client/provider/redirect settings as needed. Do not use production users, data, credentials or inherited production game URLs for the rehearsal.

Actual Supabase Auth/PostgREST behavior, Google consent/PKCE/session refresh/logout, hosted migration compatibility, production usage savings and production release remain unverified. No hosted SQL, provider setting, credential, paid resource, merge or production deployment is part of this local work.
