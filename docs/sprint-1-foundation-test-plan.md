# Sprint 1 foundation branch test plan

Updated: 2026-08-20

## Purpose

Prove that the platform foundation migration can close the live browser-write paths,
preserve historical data honestly, and support the server-owned run workflow before any
production database change. This plan uses synthetic data only. It does not copy player
rows, authentication records, Stripe data, or secrets into Git or into review logs.

The migration under test is
`supabase/migrations/20260820064235_avoid_platform_foundation.sql`. The executable
database assertions are in `supabase/tests/database/platform_foundation.sql`; the local
structural gate is `npm run test:foundation`.

## Approval boundary

Creating the Supabase development branch is a paid external mutation. The last verified
price was `$0.01344/hour`, approximately `$0.97` for a 72-hour test window. Creation
requires explicit cost approval immediately before the branch is created. Applying or
merging the migration to production, changing profile visibility, adding secrets, and
deploying coordinated runtime changes are separate approvals.

## Branch lifecycle

1. Reconfirm the current branch price with Supabase.
2. Record the approval and create one branch named `sprint-1-platform-foundation`.
3. Record the returned branch ID, project reference, creation time, and planned deletion
   time without recording credentials.
4. Confirm the branch is healthy and isolated from production.
5. Run the pre-migration schema checks and add the synthetic fixtures below.
6. Apply the migration once through Supabase migration tooling.
7. Run the database, API, authorization, and advisor checks.
8. Capture sanitized evidence in the worklog and pull request.
9. Delete the branch after the approved test window unless an extension is explicitly
   approved. Branch deletion is never a production rollback mechanism.

## Pre-migration checks

The branch must initially match the relevant production schema contract:

- `games`, `leaderboard_scores`, `user_profiles`, and `game_scores` exist.
- `leaderboard_scores` has `game_key` and `is_verified`.
- the foundation migration version is absent;
- no production rows are assumed to be present;
- the branch project reference differs from production;
- the production project remains `ACTIVE_HEALTHY`.

If the branch schema differs from those assumptions, stop and update the migration or
test fixture. Do not make ad hoc branch-only DDL changes that are absent from source.

## Synthetic legacy fixture

Before applying the migration, insert one clearly synthetic active game and one clearly
synthetic leaderboard row through an administrator connection:

- game key: `foundation-test`
- player name: `Synthetic legacy row`
- session ID: `sprint-1-legacy-fixture`
- score: `1234`
- `user_id`: null
- old `is_verified`: true

This fixture exists solely to prove the data correction. After migration it must still
exist, have the same ID and score, have `verification_level = 'legacy'`, and have
`is_verified = false`. No real player data is required.

## Database acceptance matrix

### Schema and constraints

- All 13 foundation tables exist with RLS enabled.
- Run sessions and score submissions record a bounded `ruleset_version`.
- `game_key` on favorites, runs, and submissions references `games(game_key)`.
- `leaderboard_scores.submission_id` references `score_submissions(id)` and is unique
  when present.
- verification levels are limited to `legacy`, `provisional`, `validated`, and
  `verified`.
- `is_verified` can be true only when `verification_level = 'verified'`.
- supporting indexes exist for every foreign-key and primary server query path.

### Grants and policies

- `anon` and `authenticated` cannot insert, update, or delete leaderboard rows.
- `authenticated` cannot insert into the legacy `game_scores` table.
- neither browser role can read either manual backup table.
- neither browser role can access billing, webhook, run-session, or score-submission
  tables directly.
- authenticated users can update only their own presentation fields; aggregate,
  entitlement, subscription, and Stripe columns are not writable.
- creator applications and game submissions are readable only by their owner and are
  writable only through the server API.
- favorites remain a direct authenticated write constrained to the current user.
- public profile reads return only explicitly public profiles; an owner can read their
  own private profile.

### Functions and triggers

- `finish_provisional_run` is executable only by `service_role`.
- aggregate-stat and backfill functions are not executable by browser roles.
- the score-insert aggregate trigger and profile-to-score name-sync trigger are absent.
- signup retains exactly one profile trigger.
- signup creates a deterministic, non-email username and a private profile.
- mutable-search-path and anonymous-executable `SECURITY DEFINER` advisor findings
  introduced by the foundation are zero.

### Legacy preservation

- the synthetic legacy row survives with its ID and score unchanged;
- the row is reclassified as legacy and no longer marked verified;
- the migration does not delete any score or profile rows;
- before a production merge, a read-only preflight must reconfirm 69 scores and 15
  profiles, and the post-migration check must prove those exact IDs still exist;
- the manual backup subsets remain untouched and inaccessible to browser roles.

## Run workflow tests

Use a synthetic authenticated user and the platform server boundary. Do not call the
service-role function from a browser client.

1. Start a run for an allowlisted first-party game.
2. Confirm the stored database ticket is a SHA-256 hash, not the returned bearer ticket.
3. Finish with the matching user, run ID, ticket, score, and bounded JSON object.
4. Confirm one run, one submission, and one leaderboard row share the same user, game,
   mode, and ruleset version.
5. Confirm the leaderboard row is `provisional` and `is_verified = false`.
6. Retry the same finish and require a conflict with no duplicate row.
7. Try a different user, bad ticket, expired run, negative score, oversized score,
   non-object metrics, and metrics over 8 KiB; every attempt must fail without creating a
   submission or leaderboard row.
8. Try a game key absent from `games`; the run must be rejected.
9. Confirm direct REST inserts with `anon` and `authenticated` fail even if the caller
   supplies `is_verified = true`, another user ID, or a fabricated submission ID.

## Application compatibility checks

- Platform sign-in and sign-out complete without exposing a service key.
- A new signup receives one private profile and can edit only presentation fields.
- Public profile URLs return not found for private profiles and load after opt-in.
- Platform leaderboards render legacy and provisional trust labels accurately.
- WORDaVOID and WreckaVOID start and finish runs through the platform API.
- VOIDaVOID continues to fail closed rather than falling back to a direct score insert.
- Creator application and game-submission routes use the server client and preserve
  ownership/status rules.
- Stripe code may be exercised only with test-mode configuration; no live charge is part
  of this sprint.

## Advisor and regression checks

After the migration and fixtures:

- run Supabase security and performance advisors;
- compare findings with the frozen Sprint 0 counts;
- explain every remaining `SECURITY DEFINER`, mutable search path, duplicate policy,
  unindexed foreign key, and unused-index finding;
- run `npm run test:foundation`;
- execute `supabase/tests/database/platform_foundation.sql` on the branch;
- run platform type-check and production build;
- build the three staged first-party games;
- run repository tests and the complete npm audit;
- verify no secret values or player-identifying rows appear in artifacts.

## Failure and rollback rules

- A migration error means the branch is disposable; correct source and recreate or reset
  the branch. Never patch production manually to make the migration pass.
- Any missing legacy fixture, privilege regression, duplicate submission, signup failure,
  or unexplained advisor regression blocks Sprint 1.
- A runtime failure blocks the coordinated deploy even if the SQL assertions pass.
- Production rollback requires both the recorded Netlify deploy and a database-forward
  remediation plan. A schema migration is not made safe merely because the web deploy can
  be rolled back.

## Sprint 1 exit evidence

Sprint 1 can be marked complete only when the pull request contains:

- migration diff and static verification output;
- branch identifier and bounded lifetime, but no credentials;
- pgTAP output;
- synthetic legacy before/after evidence;
- direct-write denial evidence for both browser roles;
- one-use run success and replay-failure evidence;
- new-user private-profile evidence;
- security and performance advisor deltas;
- platform/game build results;
- explicit production merge and rollback notes.

Until that packet exists, the foundation is locally prepared, not production-ready.
