# Sprint 0 Recoverability Packet

- **Program:** [aVOID V1 Completion Program](V1-COMPLETION-PROGRAM.md)
- **Sprint:** 0 — recoverable foundation packet
- **Evidence captured:** 2026-08-20
- **Production changes:** none
- **Database changes:** none
- **Status:** packet complete; hosted branch and backup readback remain approval-gated

## 1. What this packet is for

The platform cannot safely turn on accounts, profiles, creator submissions, subscriptions, or leaderboard writes against the current production database. The problem is not that the proposed platform tables are missing. The problem is that production and source control tell different migration stories, public roles have far more database power than the product needs, and old clients still carry their own ideas about identity and score trust.

This packet freezes the current facts before any repair. It answers five questions:

1. What is running in production right now?
2. Which source, host, database, and domain owns each part?
3. What data must survive, and how will it be labeled?
4. What must be true before a migration can touch production?
5. What is the smallest isolated environment that can prove the repair?

The companion evidence is deliberately sanitized:

- [`production-baseline-2026-08-20.json`](../supabase/audit/production-baseline-2026-08-20.json)
- [`production-readonly-inventory.sql`](../supabase/audit/production-readonly-inventory.sql)
- [`verify-baseline.mjs`](../supabase/audit/verify-baseline.mjs)

No evidence file contains player names, emails, user identifiers, tokens, billing identifiers, or row-level profile data.

## 2. Production control plane

| Concern                    | Current owner/source                                      | Frozen production identifier                                                                      | Recovery note                                                          |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Platform source            | `Idea-R/aVOIDhub`                                         | commit `7cd97883fde8c1dc3648f450396f3bc742e6b0a4` on `main`                                       | Git is the application rollback source.                                |
| Platform hosting           | Netlify team `Idea/R`, site `coruscating-squirrel-a47ad9` | site `780c1b04-64c7-47b6-9423-18953739590e`; deploy `6a86af420792ac00081b14a3`                    | Deploy is ready and tied to the frozen Git commit.                     |
| Platform domain            | `avoidgame.io`, proxied through Cloudflare                | Netlify request headers are present behind Cloudflare                                             | DNS changes are outside this sprint.                                   |
| Platform database/auth     | Supabase organization `Idea/R`, project `aVOID`           | project `jyuafqzjrzifqbgcqbnt`, `us-west-1`, Postgres `17.4.1.041`                                | This is the only database in scope for the shared platform foundation. |
| Supabase plan              | `Idea/R` Pro                                              | development branch price reported as `$0.01344/hour`                                              | Branch creation needs cost confirmation.                               |
| Platform deployment branch | GitHub `main`                                             | no Supabase database branch attached to the deploy                                                | Preview isolation does not exist yet.                                  |
| Stripe                     | Platform server code only                                 | no production billing tables exist; no Stripe customer IDs are stored in the legacy profile table | Do not activate until the database and webhook tests pass.             |
| AdSense                    | Verification scaffolding only                             | no ad runtime; `/ads.txt` remains unconfigured                                                    | Ad activation stays separate from data recovery.                       |

### Netlify rollback target

The exact known-good application rollback target is Netlify deploy `6a86af420792ac00081b14a3`, published from commit `7cd9788` on 2026-08-20. Its secret scan reported no matches. A later release must preserve this deploy identifier in the release ticket before publishing.

Application rollback does not roll back the database. Every database migration must therefore be forward-compatible with both the old and new application for the full deploy window.

### Database backup status

The organization is on Supabase Pro, but the exact scheduled-backup and point-in-time-recovery status for this project has not been read back from the dashboard. The Supabase connector does not expose backup records, and the available browser session is not authenticated to the dashboard.

This is a hard production gate, not an invitation to assume the default plan behavior. Before production migration:

- verify the most recent successful scheduled backup and timestamp;
- record whether point-in-time recovery is enabled;
- create and verify a separate logical backup of the affected public tables and migration history;
- record the restore command, responsible owner, encrypted storage location, and retention period;
- perform a restore rehearsal into a disposable database or branch.

## 3. Live Supabase baseline

The live project is healthy at the service level. The database is approximately 13.9 MB and has no development branches or Edge Functions. Its application schema is small but historically layered.

### Public tables

| Table                              | Rows | Purpose today                            | V1 disposition                                                                      |
| ---------------------------------- | ---: | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `games`                            |    4 | Legacy game catalog                      | Reconcile into one canonical registry or explicitly retire as a runtime catalog.    |
| `leaderboard_scores`               |   69 | Shared legacy score table                | Preserve every row, relabel every row `legacy`, and remove public writes.           |
| `user_profiles`                    |   15 | Legacy profile and aggregate-stat record | Preserve, make privacy opt-in, separate presentation from billing and entitlements. |
| `game_scores`                      |    0 | WreckaVOID-era score table               | Retire after confirming no active consumer requires it.                             |
| `leaderboard_scores_backup_manual` |   42 | Manual duplicate subset of score rows    | Keep outside the Data API until post-migration retention is approved.               |
| `user_profiles_backup_manual`      |    9 | Manual duplicate subset of profile rows  | Keep outside the Data API until post-migration retention is approved.               |

RLS is enabled on all six tables. That fact is not enough to make them safe because table grants, policies, and privileged functions determine what a caller can actually do.

### Table grants

`anon`, `authenticated`, and `service_role` currently hold all seven table privileges on every public table:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`
- `REFERENCES`
- `TRIGGER`

RLS may prevent some row changes, but it should not be the only barrier between a browser key and operations the browser never needs. The isolated repair must start from explicit revocation, then grant only the narrow operations required by the approved API model.

### Policies that block activation

| Table                | Policy                                     | Problem                                                                                                                |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `leaderboard_scores` | `Anyone can insert scores`                 | `WITH CHECK (true)` lets any Data API caller author a score and its trust flag.                                        |
| `leaderboard_scores` | `Users can update own verified scores`     | It has no `WITH CHECK`, depends on a client-era `is_verified` flag, and permits browser updates to competitive data.   |
| `user_profiles`      | `Users can view all profiles`              | Every authenticated user can read every profile even if `is_public` is false.                                          |
| `user_profiles`      | `unified_user_profile_policy`              | It applies to `ALL`, uses deprecated `auth.role()`, and overlaps with three other permissive policies.                 |
| backup tables        | service-role checks inside public policies | The tables still have public role grants and use `auth.role()` rather than being removed from the exposed API surface. |
| `game_scores`        | client insert policy                       | It preserves the old browser-authored score model that V1 is replacing.                                                |

### Privileged functions

Five `SECURITY DEFINER` functions are callable by both anonymous and authenticated roles:

| Function                                | Intended disposition                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backfill_missing_profiles()`           | Service-only administrative operation, or remove after reconciliation.                                                                                                         |
| `create_user_profile()`                 | Replace with a controlled trigger/server path; never expose as an anonymous definer RPC.                                                                                       |
| `get_user_leaderboard_position(uuid)`   | Make invoker-safe or replace with a privacy-aware read model.                                                                                                                  |
| `get_user_score_history(uuid, integer)` | Make invoker-safe and enforce public/owner visibility without caller-supplied authority.                                                                                       |
| `update_game_statistics(...)`           | Do not trust browser-authored aggregate deltas as competitive evidence. If retained for personal stats, bind the target to `auth.uid()` and keep it out of score verification. |

Ten functions have mutable search paths. Every function retained by V1 must use a fixed empty search path and schema-qualified object names, or be a safe `SECURITY INVOKER` function.

### Triggers

Production currently has three public triggers:

- score insert → `update_user_profile_stats()`;
- profile update → `sync_leaderboard_player_name()`;
- profile update → `update_updated_at_column()`.

The score aggregate trigger is especially important during migration. A backfill that touches score rows must not silently double player totals. The branch test suite must prove whether the trigger is removed, disabled for a controlled migration, or replaced before any data rewrite occurs.

### Advisor baseline

The production baseline reports 22 security and 17 performance advisories.

Security:

- 10 mutable function search paths;
- 5 anonymous-executable `SECURITY DEFINER` warnings;
- 5 authenticated-executable `SECURITY DEFINER` warnings;
- leaked-password protection is not enabled;
- the project Postgres build has security patches available.

Performance:

- 3 per-row auth evaluation warnings;
- 3 overlapping permissive profile-policy warnings;
- 10 unused indexes;
- Auth is configured with an absolute rather than percentage-based connection allocation.

The isolated branch must reach zero critical security findings introduced or retained by the platform migration. Unused indexes and connection allocation require evidence and do not justify blind deletion or configuration changes.

## 4. Migration history reconciliation

Production records 29 migrations. The repository contains ten unique migration versions across the root, hosted games, and archived duplicate trees.

Only seven versions overlap. Twenty-two live versions are absent from every tracked migration path, and three tracked versions are absent from production:

- `20250607070000_fix_current_time_issue`
- `20250705173200_enhanced_leaderboard_system`
- `20260820064235_avoid_platform_foundation`

The first two tracked files may consolidate behavior represented by several live migrations, but matching intent is not matching migration history. The foundation migration assumes legacy objects already exist and therefore cannot reproduce the database from an empty project.

### Required source-of-truth repair

Do not rename historical live migrations or mark unexecuted files as applied.

The repair sequence is:

1. Export the exact live public schema, function definitions, triggers, grants, policies, and `supabase_migrations.schema_migrations` records.
2. Recover missing historical SQL from Supabase/Git history where possible.
3. Create a reviewed baseline migration representing the live schema at one declared cut line.
4. Move pre-baseline fragments into a clearly labeled historical directory that is not treated as a fresh migration chain.
5. Make the next forward migration depend only on the baseline, not on hidden production history.
6. Prove an empty local database can apply baseline → foundation → tests.
7. Prove a production-shaped branch can apply only the forward foundation migration without destructive drift.

The baseline is not complete until both paths pass. A branch cloned from production proves upgrade compatibility; an empty local database proves reproducibility.

## 5. Legacy-data contract

### Scores

Production contains 69 scores:

| Game       | Rows | Marked `is_verified` | Guest rows |
| ---------- | ---: | -------------------: | ---------: |
| TankaVOID  |    3 |                    3 |          3 |
| VOIDaVOID  |   60 |                   39 |         23 |
| WORDaVOID  |    3 |                    3 |          3 |
| WreckaVOID |    3 |                    3 |          3 |

There are no duplicate session-ID groups and no missing profile references among scores that have a user. Those are useful integrity facts, but they do not prove gameplay legitimacy. The clients were able to author their own values.

The migration contract is therefore:

- preserve all 69 rows and their original IDs, timestamps, scores, game keys, names, and session strings;
- add `verification_level = 'legacy'` to every existing row;
- set the deprecated `is_verified` field to `false` for every existing row so an old reader cannot continue displaying a false claim;
- never create `score_submissions` or run tickets retroactively for these rows;
- exclude legacy rows from validated/verified boards by default;
- allow an explicitly labeled legacy board or player-history view if product review wants one;
- record before/after counts and per-game score sums in the migration test to prove preservation without storing row-level evidence in Git.

The existing foundation migration adds the `verification_level` column but does not clear old `is_verified = true` values. It must be corrected before branch testing.

### Profiles

Production has 15 auth users, 15 identities, and 15 profile rows. All 15 profiles are public. One row carries the old `is_pro_member` flag; no profile contains a Stripe customer identifier.

V1 says public profiles are opt-in. The safe proposed mapping is:

- preserve every profile and its presentation fields;
- set the default for new profiles to private;
- treat existing `is_public = true` as legacy state, not proof of informed opt-in;
- make existing profiles private during the coordinated migration unless the owner explicitly chooses grandfathered visibility;
- move billing status out of `user_profiles`;
- do not create Stripe subscriptions from `is_pro_member`;
- hold the one legacy pro flag for an owner-reviewed manual entitlement mapping.

The privacy choice must be approved before production migration. Branch fixtures will test both data preservation and private-by-default behavior.

### Manual backup tables

All 42 manual score-backup IDs also exist in the live score table. All nine manual profile-backup IDs also exist in the live profile table. These are duplicate subsets, not independent restore points.

For V1:

- revoke all Data API access from `anon` and `authenticated`;
- move them to a private/archive schema or exclude them from the exposed schema;
- retain them until a verified logical backup and restore rehearsal exist;
- delete them only under a later, explicit retention decision.

## 6. Active auth and score consumers

The source tree contains multiple generations. “Present in the repository” and “part of the production build” are not the same thing.

| Consumer                                   | Current behavior                                                                                                               | V1 action                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Next.js platform                           | SSR Supabase session, server admin client, profile/creator/run/Stripe APIs are implemented but dormant                         | Activate only against the isolated, tested foundation.                                 |
| WreckaVOID canonical source                | Reads Supabase session, starts/finishes platform run tickets, reads shared scores; still owns local signup/profile UI          | Remove local account ownership and use the platform session/surfaces.                  |
| WORDaVOID canonical source                 | Game store uses platform run tickets; an unused legacy `LeaderboardAPI` still contains direct inserts and verified language    | Delete the dead direct-write module and version the active score contract.             |
| VOIDaVOID canonical source                 | Direct writes are disabled, but old local auth/profile UI, verified reads, public RPCs, and profile-stat updates remain active | Build the full platform adapter and remove false verified semantics before activation. |
| `games/wreck-avoid` duplicate              | Separate legacy source and deploy config reference another Supabase project                                                    | Exclude from canonical build and archive after source comparison.                      |
| `apps/game-hub` and shared legacy services | Old password auth and alternate `game_scores`/global leaderboard model                                                         | Keep out of production compilation; mine only for explicitly reviewed behavior.        |
| FLIPSIDE                                   | Separate repository, Supabase concerns, auth, commerce, and direct browser score writes                                        | Keep identity and scores independent until its own migration is approved.              |
| Bloomfall, Acrolis, TTT3D                  | Independent domains and product data                                                                                           | Never point them at the shared aVOID database as part of this foundation.              |

## 7. Environment contract

Only variable names, owners, and scopes belong in project documentation. Values and secrets do not.

### Platform variables

| Variable                               | Exposure             | Required scope                         | Owner                                                                   |
| -------------------------------------- | -------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser-visible      | build and runtime                      | Supabase project `aVOID`                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible      | build and runtime                      | Supabase project `aVOID`; use an enabled publishable key                |
| `SUPABASE_SECRET_KEY`                  | Secret               | Netlify runtime only                   | Supabase project `aVOID`; never expose to Vite or `NEXT_PUBLIC_*`       |
| `NEXT_PUBLIC_SITE_URL`                 | Browser-visible      | production/deploy-context specific     | Netlify canonical URL                                                   |
| `STRIPE_RESTRICTED_KEY`                | Secret               | Netlify runtime only                   | Stripe platform account; preferred over unrestricted secret key         |
| `STRIPE_SECRET_KEY`                    | Secret fallback      | Netlify runtime only                   | Stripe platform account; remove fallback after restricted key is proven |
| `STRIPE_WEBHOOK_SECRET`                | Secret               | Netlify runtime only                   | Stripe endpoint scoped to the exact environment                         |
| `STRIPE_PLAYER_PRICE_ID`               | Server configuration | Netlify runtime                        | Stripe test/live product set                                            |
| `STRIPE_CREATOR_PRICE_ID`              | Server configuration | Netlify runtime                        | Stripe test/live product set                                            |
| `NEXT_PUBLIC_PLAYER_PRICE_LABEL`       | Browser-visible      | build                                  | Product copy, not billing authority                                     |
| `NEXT_PUBLIC_CREATOR_PRICE_LABEL`      | Browser-visible      | build                                  | Product copy, not billing authority                                     |
| `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT`    | Browser-visible      | build/runtime only after AdSense gates | AdSense account                                                         |

### Hosted-game build variables

| Variable                  | Consumers                        | Scope                                                                                                               |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | VOIDaVOID, WreckaVOID, WORDaVOID | Netlify build; same isolated project as the platform in preview                                                     |
| `VITE_SUPABASE_ANON_KEY`  | VOIDaVOID, WreckaVOID, WORDaVOID | Browser-visible Netlify build value; migrate to publishable-key naming later                                        |
| `VITE_AVOID_PLATFORM_URL` | WreckaVOID, WORDaVOID            | Netlify build; empty for same-origin production is valid, explicit preview origin is required when hosted elsewhere |

Netlify environment values were not exported because that would risk exposing secrets in logs or repository evidence. The release operator must verify key presence and context in Netlify without copying values into the ticket.

## 8. Catalog source, host, and domain boundaries

| Product                    | Canonical source status                                                               | Current public boundary                    | Shared V1 identity/board?                     |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| Platform + VOID/Wreck/WORD | `Idea-R/aVOIDhub`                                                                     | `avoidgame.io` and same-origin play routes | Yes, after foundation acceptance.             |
| FLIPSIDE                   | `Ideas-Realized/flipside-arena`, clean local `main`                                   | `flipside.avoidgame.io`, Cloudflare-served | No until FLIPSIDE integration program passes. |
| TankaVOID                  | `Idea-R/TankaVOID`, dirty `feat/get-game-working` prototype plus broken monorepo copy | Coming soon; no production play route      | No until rebuilt.                             |
| Bloomfall                  | `Idea-R/bloomfall`, dirty local `main`                                                | `bloomfall.io`, Cloudflare-served          | No; independent account and progression.      |
| Acrolis Crawlers           | private `Idea-R/dungeon-crawler-og`; not cloned in this workspace                     | `play.acrolis.io`, Cloudflare-served       | No; independent account and progression.      |
| Tic Tac Toe in 3D          | canonical source not recovered                                                        | `ttt3d.app`, Cloudflare-served             | No; source recovery is a hard gate.           |

Netlify also contains a ready site named `reliable-cascaron-f42f02` configured for `wreck.avoidgame.io`, but that hostname currently does not resolve. It is not the canonical WreckaVOID production route and must not be treated as a rollback target without a separate source/deploy audit.

## 9. Recovery and rollback procedure

### Before the isolated branch

1. Keep production variables dormant.
2. Re-run the read-only inventory and compare aggregate counts with the frozen JSON.
3. Record the current Git commit, Netlify deploy, Supabase project version, and migration head.
4. Verify scheduled backup/PITR status in the authenticated Supabase dashboard.
5. Produce encrypted logical dumps of:
   - public schema only;
   - public data only;
   - `supabase_migrations.schema_migrations`;
   - auth users/identities using the supported Supabase backup path, not ad hoc CSV in Git.
6. Restore the logical dump into a disposable target and compare table counts, constraints, and aggregate score checks.

### Isolated branch lifecycle

The reported price is `$0.01344/hour`, approximately `$0.97` for 72 hours or `$9.81` for 30.4 days.

Proposed branch contract:

- name: `avoid-platform-foundation-s0`;
- maximum initial lifetime: 72 hours;
- owner: current Supabase `Idea/R` organization owner;
- source: production schema/migrations, with no production data copied by Supabase branching;
- deploy binding: Netlify deploy-preview only, never production;
- data: synthetic users and score fixtures only;
- teardown: delete after evidence is captured, unless an explicit extension is approved;
- cost check: call `get_cost` again immediately before creation and record the confirmed amount.

Creating the branch is a paid external action. The current packet intentionally stops before that call.

### Branch test order

1. Generate current live TypeScript types and schema metadata.
2. Apply a corrected forward foundation migration to the production-shaped branch.
3. Insert synthetic fixtures matching every legacy category:
   - guest and authenticated scores;
   - old `is_verified` true and false values;
   - each game key;
   - public and private profiles;
   - the legacy pro flag;
   - duplicate backup-subset IDs.
4. Run pgTAP tests for grants, RLS, functions, profile privacy, and legacy mapping.
5. Run application API tests with anonymous, user A, user B, and service roles.
6. Run Supabase security and performance advisors.
7. Generate fresh TypeScript types and diff them against the intended contract.
8. Connect a Netlify deploy preview using branch-scoped variables.
9. Exercise login → profile → start run → finish once → personal best → board.
10. Re-run the old clients against the branch and prove direct score writes fail cleanly.
11. Capture evidence, remove test users/data with the branch teardown, then delete the branch.

### Production rollout shape

The database release must be additive and compatible first:

1. verified backup and restore point;
2. forward-compatible schema/security migration;
3. platform and hosted-game deploy using the new APIs;
4. read-only smoke and negative security checks;
5. remove transitional compatibility only in a later migration.

If the application deploy fails, republish Netlify deploy `6a86af420792ac00081b14a3`. Do not attempt a destructive database down migration. If the database migration itself damages data or access, stop writes, follow the tested restore/forward-repair procedure, and keep the incident record separate from application rollback.

## 10. Foundation migration corrections required before testing

The existing `20260820064235_avoid_platform_foundation.sql` is useful design work, but it is not production-ready unchanged.

Required changes:

1. Drop every overlapping legacy profile policy, not only score-write policies.
2. Revoke all table privileges from `anon` and `authenticated` before granting the explicit V1 matrix.
3. Remove public grants from the two manual backup tables and move them out of the exposed schema when practical.
4. Revoke `PUBLIC` execute from every function before adding narrow grants.
5. Replace or remove all five exposed `SECURITY DEFINER` functions.
6. Fix every retained function search path and schema-qualify object references.
7. Clear `is_verified` on all legacy rows while setting `verification_level = 'legacy'`.
8. Prevent score-backfill triggers from double-counting profile totals.
9. Make profile visibility private by default and settle the existing-profile migration rule.
10. Replace free-text game keys with foreign keys to one canonical game registry.
11. Keep billing, webhook, run-session, and score-submission tables server-only.
12. Add abuse limits, expiry cleanup, idempotency, mode/ruleset versions, and deterministic board ordering.
13. Remove user-controlled IDs and trust fields from every browser write contract.
14. Add pgTAP and application-level negative tests before any production proposal.

## 11. Sprint 0 acceptance evidence

| Requirement                                                    | Evidence                                                                    | Status                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------- |
| Production application rollback identified                     | Git `7cd9788`; Netlify deploy `6a86af420792ac00081b14a3`                    | Complete                |
| Live project and organization identified                       | Supabase project `jyuafqzjrzifqbgcqbnt`; organization `Idea/R` Pro          | Complete                |
| Live schema, policies, grants, functions, triggers inventoried | Sanitized JSON and repeatable read-only SQL                                 | Complete                |
| Migration drift quantified                                     | 29 live, 10 tracked unique, 22 live-only, 3 tracked-only                    | Complete                |
| Legacy data mapped                                             | 69 scores → legacy; 15 profiles preserved; manual backup subsets classified | Complete                |
| Auth/score consumers mapped                                    | Platform and hosted-client matrix in this packet                            | Complete                |
| Environment ownership mapped without secret values             | Platform and hosted-game variable tables                                    | Complete                |
| Independent-domain boundaries recorded                         | Catalog source/host table                                                   | Complete                |
| Hosted branch cost known                                       | `$0.01344/hour`; 72-hour contract proposed                                  | Complete                |
| Exact scheduled backup/PITR readback                           | Requires authenticated Supabase dashboard                                   | Pending production gate |
| Logical restore rehearsal                                      | Requires an approved disposable target                                      | Pending production gate |
| Hosted development branch created                              | Paid action not yet approved                                                | Pending approval        |

Sprint 0 has produced the recoverability packet without changing production. The next safe action is to approve or decline the 72-hour Supabase branch budget. If approved, Sprint 1 begins by correcting the forward migration locally, creating the branch, and executing the branch test order above.
