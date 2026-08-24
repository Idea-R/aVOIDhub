# aVOID V1 Completion Program

- **Status:** Active source of truth
- **Program start:** 2026-08-20
- **Repository:** `C:\dev\aVOID-next` / `Idea-R/aVOIDhub`
- **Production baseline:** `https://avoidgame.io` at merge commit `7cd9788`
- **Program branch:** `codex/docs-v1-completion-program`
- **Current execution branch:** `security/platform-foundation-v1`
- **Related records:** [`ROADMAP.md`](../ROADMAP.md), [`WORKLOG.md`](../WORKLOG.md), [`DECISIONS.md`](../DECISIONS.md)

## 1. Why this document exists

The rebuilt aVOIDgame.io hub is live, but a polished directory is not the same thing as a finished game platform. The hosted games still carry different generations of authentication, profile, score, and interface code. Some builds are playable but fragile. Some score paths were never trustworthy. TankaVOID is a prototype, not a releasable game. FLIPSIDE is substantial but lives in another source, database, and commerce boundary.

This document defines what “V1 complete” actually means for:

- the aVOIDgame.io platform and main page;
- VOIDaVOID;
- WreckaVOID;
- WORDaVOID;
- FLIPSIDE;
- TankaVOID;
- Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D as independent Ideas Realized games represented in the directory.

It is intentionally stricter than “the page loads.” Every V1 definition includes the player experience, platform integration, data trust, responsive behavior, tests, deployment, and an acceptance gate. A title can be live without being V1 complete, and it can be V1 complete without sharing every platform feature.

## 2. Executive diagnosis

### What is genuinely complete

- The Next.js platform shell is live on Netlify with the selected aVOID identity, responsive directory, social links, legal pages, metadata, and preserved game routes.
- VOIDaVOID, WreckaVOID, and WORDaVOID build as independent Vite applications and are staged into the platform deployment.
- FLIPSIDE, Bloomfall, Acrolis Crawlers, and ttt3d.app have verified public destinations.
- The platform repository contains a first implementation of passwordless account pages, profiles, creator intake, membership checkout, entitlements, trust-labeled leaderboards, and one-use run APIs.
- The repository contains an incremental Supabase hardening migration and client changes that stop WORDaVOID and WreckaVOID from inserting scores directly.
- The production dependency audit was clean at the platform launch.

### What is implemented but dormant

- The platform login button is disabled because the production Netlify runtime does not yet have the new `NEXT_PUBLIC_SUPABASE_*` and server-secret configuration.
- Profile, entitlement, creator, Stripe, and run-ticket routes exist but depend on a coordinated database migration and server environment that have not been activated.
- The WreckaVOID game-over submission ordering was repaired in source, but the secure score pipeline it calls is not active in production.
- The AdSense verification and `ads.txt` route exist, but no publisher ID, consent system, ad runtime, or ad request is active.

### Current execution status

- P0 is complete in source: `docs/sprint-0-recoverability.md` and `supabase/audit/` freeze the production schema, grants, policies, functions, migration drift, aggregate row counts, restore target, ownership boundaries, and branch cost without exporting player rows or secrets.
- P1 is locally prepared: the pending foundation migration now revokes inherited browser privileges, preserves old scores as untrusted legacy history, makes profile publication explicit, removes browser-era score side effects, and adds foreign-key/ruleset integrity.
- `supabase/tests/database/platform_foundation.sql` contains 50 database assertions, and `npm run test:foundation` verifies the required migration shape locally.
- Executable SQL, role, run-replay, signup, and advisor testing is still pending on the approval-gated Supabase development branch. Local preparation is not P1 completion.
- The exact branch procedure and exit evidence are in `docs/sprint-1-foundation-test-plan.md`.

### What is unsafe or misleading if activated today

- The live Supabase project contains historical schema drift across 29 migrations and six public tables rather than a reproducible platform baseline.
- The live project currently holds 15 profile rows and 69 primary leaderboard rows that must be preserved and classified as legacy data.
- Existing advisor output flags mutable function search paths, publicly executable `SECURITY DEFINER` functions, overlapping policies, and a Postgres security update.
- Historical game clients treated authentication as score verification. It is not. A signed-in browser can still lie about a score unless the platform can validate or replay the run.
- FLIPSIDE uses a separate Supabase project and direct browser score writes. Its existing profile, cosmetics, entitlement, and checkout behavior cannot simply be merged into the platform by changing a URL.

## 3. Program rules

These are release rules, not suggestions.

1. **One identity, several games.** Hosted aVOID games use the platform session. They do not ship their own competing login and profile systems.
2. **A game page is not the game runtime.** First-party catalog cards open a platform detail page. A clear Play control then opens the immersive game route.
3. **Scores say what was checked.** Historical scores are `legacy`; browser-reported scores are `provisional`; server-validated scores are `validated`; independently replayed or authoritative scores may be `verified`.
4. **No direct score-table writes from browsers.** A hosted game starts and finishes a one-use run through a server boundary.
5. **No pay-to-win.** Membership, cosmetics, and rewarded inventory cannot improve scores, leaderboard position, health, damage, movement, or progression.
6. **Ads stay away from active play.** Ordinary AdSense units belong only on calm platform pages. They do not appear in a canvas, HUD, pause screen, result action, play button, or in-world billboard.
7. **External means external.** Bloomfall, Acrolis, and ttt3d.app retain their own domains, accounts, scoring, and product decisions unless a separate integration is approved.
8. **No public creator content before review.** Applications and submissions remain private until ownership, security, content, and technical checks pass.
9. **Every sprint ends with evidence.** A build without browser verification, data read-back, or acceptance results is unfinished.
10. **Production changes remain gated.** Database migrations, secrets, Stripe activation, AdSense activation, DNS, paid resources, and merges need the approval defined in `ROADMAP.md`.

## 4. What “V1 complete” means

### Universal game gate

A hosted game reaches its own V1 only when all applicable checks pass:

- The core loop can be started, understood, played, ended, and restarted without a reload.
- Keyboard and pointer controls work; touch controls work where the title claims mobile support.
- The layout survives current phone, tablet, laptop, and wide-desktop viewports without clipped controls or horizontal overflow.
- Pause, focus loss, audio state, restart, and navigation behave predictably.
- The game has a concise control/instructions surface outside the active play area.
- A player can play as a guest. Signing in adds persistence, not basic access.
- Hosted authentication comes from the platform rather than a game-specific modal.
- Score submission uses a one-use run and is labeled at its actual trust tier.
- Personal best, board placement, and share state come from the accepted server result rather than optimistic client text.
- Errors fail softly: the run remains playable if identity or leaderboard services are unavailable.
- Production build, type check, lint, focused tests, browser smoke tests, and deployment route checks pass.
- No high-severity dependency or database-advisor issue remains in the feature’s release path.

### Platform V1 gate

The platform reaches V1 when:

- Account creation/sign-in, session refresh, sign-out, and recovery work in production.
- Existing profiles and scores have a documented, reversible migration path.
- Players can edit a public handle, display name, bio, avatar, and approved social links.
- First-party games have detail pages with Play, controls, status, scores, personal best, favorites, and share affordances.
- Leaderboards use the canonical schema and show trust labels.
- At least one game produces server-validated scores; the other hosted games are no more trusted than their evidence supports.
- Creator applications and game submissions are private, entitlement-aware, and reviewable.
- Membership checkout, webhook idempotency, entitlements, cancellation, and portal access pass Stripe test mode before any live price is enabled.
- Privacy, terms, consent, age treatment, `ads.txt`, and ad-free entitlement behavior are verified before the first live ad request.
- Accessibility, mobile behavior, Core Web Vitals, error monitoring, backups, rollback, and incident notes are ready for ordinary production traffic.

### Full-catalog V1 gate

Full-catalog V1 is later than platform V1. It requires the platform gate plus individual V1 acceptance for VOIDaVOID, WreckaVOID, WORDaVOID, and TankaVOID. FLIPSIDE must either pass its documented integration gate or be explicitly classified as an independently operated first-party game. The independent-domain titles need only pass their aVOID directory integration gate.

## 5. Release architecture

```text
Directory card
    ├─ first-party → /games/<slug>/
    │                  ├─ Play → existing immersive route
    │                  ├─ Scores / personal best
    │                  ├─ Controls / status / updates
    │                  └─ Favorite / share
    └─ independent → /games/<slug>/ or direct external launch
                       └─ explicit “Opens <domain>” boundary

Hosted game runtime
    → platform session
    → POST /api/v1/runs
    → play
    → POST /api/v1/runs/<id>/finish
    → accepted result + trust label + receipt/share URL
    → game-specific leaderboard on the platform detail page
```

Existing `/voidavoid/`, `/wreckavoid/`, and `/wordavoid/` routes remain stable for bookmarks. The platform adds `/games/voidavoid/`, `/games/wreckavoid/`, and `/games/wordavoid/` rather than breaking those URLs.

## 6. Planning units and honest effort

One program sprint is **five focused working days** with one primary owner, a written scope, a reviewable increment, and an acceptance readout. The estimates below are engineering effort, not promises about calendar dates. Parallel lanes may shorten elapsed time, but they do not remove integration and QA work.

| Size    | Typical focused effort | Use                                             |
| ------- | ---------------------: | ----------------------------------------------- |
| XS      |        less than 1 day | Small content/config/test correction            |
| S       |               1–2 days | Isolated component or narrow integration        |
| M       |               3–5 days | One reviewable sprint outcome                   |
| L       |              6–10 days | Two connected sprint outcomes                   |
| XL      |             11–20 days | Multi-system feature or substantial game repair |
| Program |               20+ days | Product track requiring several release gates   |

The complete program is not a two-week cleanup. For the platform and hosted first-party titles, a realistic solo sequence is roughly **30–45 focused sprint-weeks**. With two or three disciplined lanes, the likely elapsed range is **16–24 weeks**, assuming prompt reviews and no source, account, billing, or migration surprises. The separate Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D product programs are not included in that total; only their aVOID directory integration is included. Each title can ship its V1 independently instead of waiting for the whole catalog.

## 7. Main platform and directory

### Current state

The platform is a Next.js 16 App Router application in [`apps/platform`](../apps/platform). The production shell is live and responsive. The current cards in [`src/data/games.ts`](../apps/platform/src/data/games.ts) still send hosted games directly to their immersive routes. Account, leaderboard, creator, membership, privacy, and terms surfaces exist.

The new account flow is not active in production. [`src/lib/env.ts`](../apps/platform/src/lib/env.ts) requires a publishable Supabase configuration, and [`src/components/AuthForm.tsx`](../apps/platform/src/components/AuthForm.tsx) disables submission when it is absent. The current form is email OTP only. The hosted games still contain their own older auth implementations.

The platform server routes and migration establish a useful direction, but they have not been tested against an isolated copy of the live schema. The live project has:

| Object                      | Current rows | Program treatment                                                 |
| --------------------------- | -----------: | ----------------------------------------------------------------- |
| `public.user_profiles`      |           15 | Preserve, normalize, and map into the canonical profile contract  |
| `public.leaderboard_scores` |           69 | Preserve as `legacy`; never upgrade trust automatically           |
| `public.game_scores`        |            0 | Retire after verifying no hidden consumer depends on it           |
| `public.games`              |            4 | Reconcile with the typed platform registry                        |
| two manual backup tables    |  51 combined | Snapshot, document ownership, then archive outside the public API |

Of the 69 historical primary score rows, 48 are currently marked `is_verified = true`, 32 have no user, 60 belong to VOIDaVOID, and three each are labeled TankaVOID, WORDaVOID, and WreckaVOID. Those labels reflect old client behavior, not independent verification. All 69 must enter the new model as `legacy`.

Production records 29 migrations while the repository root contains only three migration files. The database therefore cannot be reproduced from the current root history. The staged foundation migration closes important score-write paths, but it assumes legacy objects already exist, leaves unsafe historical `user_profiles` policies in place, and mixes direct client grants with admin-client application routes. It must be reconciled rather than applied unchanged.

Other release gaps are concrete: `/games/wreckavoid/` currently returns 404; the platform package has no unit/integration/E2E test scripts; favorites exist only as proposed schema; the global header has no signed-in state; creator review/admin surfaces do not exist; and the 20-minute run-ticket expiry is unsuitable for an unbounded survival run unless renewal or game-specific duration rules are added.

### Platform V1 experience

A new visitor can browse without an account. A returning player can sign in once, keep that session across hosted routes, edit a profile, favorite games, see personal bests, and share accepted results. Game cards open useful detail pages instead of dropping every visitor directly into a canvas. Leaderboards explain their trust. Creator and membership surfaces are functional but conservative. Independent games remain clearly independent.

### Required V1 scope

#### Data and security

- Take a recoverable production schema/data snapshot and record restore steps.
- Create or approve an isolated Supabase development branch; never test the score-locking migration first against production.
- Reconcile the 29 live migration records with the committed migration history.
- Remove unsafe existing `user_profiles` policies, including authenticated reads that ignore the intended `is_public` boundary and policies built around deprecated `auth.role()` checks.
- Produce a clean baseline or reviewed incremental migration for profiles, links, favorites, follows, games, leaderboards, run sessions, submissions, entitlements, billing, creator intake, moderation, and webhook events.
- Use a private, unexposed schema for billing, anti-cheat, moderation, and privileged helpers.
- Enable RLS on every exposed table and make Data API grants explicit.
- Remove or restrict publicly callable `SECURITY DEFINER` functions and fix mutable function search paths.
- Preserve old scores as `legacy`, including original IDs and timestamps where possible.
- Upgrade the project’s Postgres patch level after backup and compatibility review.
- Run security/performance advisors and role-based tests as anonymous, player A, player B, creator, moderator, and service.

#### Identity and profiles

- Establish one platform auth client and session contract for the Next.js shell and hosted Vite games.
- Support email OTP/magic link plus Google after redirect origins and consent-screen ownership are verified.
- Keep passwords out of the first platform V1 unless a real support requirement justifies them.
- Create profiles automatically through a restricted server boundary or safe trigger.
- Enforce normalized unique handles and collision handling.
- Add display name, bio, avatar, country/region display choice, privacy, and approved social links.
- Provide account export/delete request paths and document session revocation behavior.
- Remove or redirect duplicate game-specific login/profile interfaces as each game integrates.
- Design FLIPSIDE cross-origin identity as a later one-time code/PKCE exchange; never pass a platform token through `postMessage`.

#### Game detail surfaces

- Add `/games/[slug]/` routes backed by the canonical registry/database.
- Give every hosted game a distinct page composition, artwork, description, controls, device support, status, update notes, Play control, scores, personal best, favorites, and share action.
- Keep existing play URLs stable and obvious.
- Give external titles an equally polished detail surface only when it adds context; the launch control must say which domain opens.
- Give TankaVOID a noninteractive development page until its playable gate passes.
- Keep ads away from Play controls and any embedded or active game surface.

#### Leaderboards and results

- Replace admin-wide leaderboard reads with a purpose-built public query/view that exposes only approved fields.
- Add game, board, mode, period, ruleset version, run ID, trust tier, and achieved timestamp.
- Make one-use run consumption idempotent.
- Derive player identity, game key, and trust on the server.
- Add cursor pagination and stable tie-breaking.
- Add per-user/IP start/finish abuse limits and game-specific expiry/renewal for long-running modes.
- Add personal-best and immutable result/receipt pages.
- Add moderation flags and a safe invalidation path without deleting audit history.
- Publish definitions for `legacy`, `provisional`, `validated`, `verified`, and `rejected`.

#### Favorites, socials, creators, and membership

- Let players favorite games and optionally follow approved public creator profiles.
- Keep follower and favorite privacy choices explicit.
- Keep creator applications and game submissions private by default.
- Add an internal moderation queue before any creator page or game can become public.
- Let applicants see status and requested changes without exposing internal reviewer notes.
- Test Stripe Billing in test mode: Checkout, signed raw-body webhook, duplicate/out-of-order events, entitlements, Customer Portal, cancellation, renewal, and failure recovery.
- Do not use Stripe Connect until creator payouts or marketplace funds flow are approved.
- Confirm the exact AdSense publisher ID, site status, consent platform, US-state message, and age treatment before ad runtime activation.
- Render no ad runtime or slot for an active ad-free entitlement.

#### Reliability and operations

- Add structured error reporting without collecting game telemetry that is not disclosed.
- Add health/smoke checks for the shell, auth callback, public leaderboard read, run start/finish, and every game route.
- Record backup, rollback, environment ownership, secret rotation, and incident steps.
- Add CI gates for platform type-check/build, hosted game builds, focused tests, migration lint/advisors, and route smoke tests.
- Introduce CSP in report-only mode, remove violations, then enforce it with route-appropriate origins.
- Verify phone, tablet, laptop, wide desktop, keyboard, reduced motion, focus order, screen-reader names, and browser console state.

### Platform sprint breakdown

| Sprint | Outcome                                                                                 | Size | Depends on                                              | Evidence to exit                                                                                   |
| ------ | --------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P0     | Production snapshot, live-schema inventory, data classification, restore rehearsal plan |    M | Branch cost/approval if using hosted branching          | Snapshot identifiers, row counts, restore instructions, no writes to production                    |
| P1     | Reviewed canonical schema and migration against an isolated database                    |    L | P0                                                      | Migration applies from baseline; generated types; zero unaccepted security-advisor findings        |
| P2     | Production-shaped auth/session/profile vertical slice in preview                        |    L | P1, Netlify env ownership                               | Email and Google test sign-ins, refresh, sign-out, profile creation/edit, cross-route session test |
| P3     | Canonical game registry and `/games/[slug]/` page system                                |    M | P1                                                      | All catalog slugs render; hosted Play and external-domain boundaries verified on mobile/desktop    |
| P4     | Favorites, social links, public profiles, privacy controls                              |    M | P2, P3                                                  | Player A/B RLS tests; URL validation; public/private read behavior                                 |
| P5     | Run, result, personal-best, and leaderboard read model                                  |    L | P1, first game adapter                                  | Replay/idempotency tests, stable ordering, trust labels, receipt route                             |
| P6     | Creator intake and moderation queue                                                     |    M | P2, P4                                                  | Owned drafts, private submission, reviewer-only state transitions, audit record                    |
| P7     | Stripe test-mode membership and entitlement lifecycle                                   |    L | P2, Stripe product decisions                            | Checkout/portal/webhook tests, duplicate/out-of-order events, revoke/renew behavior                |
| P8     | Consent and directory-only AdSense canary readiness                                     |    M | Privacy decisions, exact publisher ID, site Ready state | CMP/opt-out QA, paid no-request proof, spacing/CLS checks; no gameplay ads                         |
| P9     | Platform release hardening                                                              |    L | P0–P8 applicable V1 scope                               | CI green, accessibility/performance/browser matrix, backups, rollback, production smoke test       |

**Expected platform effort:** approximately **47–76 focused engineering days** (roughly 9–15 solo sprint-weeks), excluding approval delays, SMTP/OAuth ownership, Stripe/AdSense account review, and major surprises in the live schema. Two disciplined lanes may reduce elapsed time to 6–10 weeks, but schema/auth and release gates remain serial.

### Platform V1 acceptance checklist

- [ ] Existing production profiles and scores are preserved and classified.
- [ ] No browser can insert or promote an accepted leaderboard row directly.
- [ ] No public role can execute privileged maintenance functions.
- [ ] Login, refresh, logout, profile creation, profile editing, and privacy work in a production-shaped preview.
- [ ] Every first-party game has a detail page and stable Play route.
- [ ] At least one game returns a server-validated result and shareable receipt.
- [ ] Cross-user RLS tests prove players cannot read or mutate private records they do not own.
- [ ] Creator submissions stay private until reviewed.
- [ ] Stripe behavior is test-mode complete or visibly unavailable; no half-working live checkout.
- [ ] AdSense is either correctly consented and entitlement-aware or completely absent.
- [ ] Accessibility, responsive, performance, build, smoke, backup, and rollback evidence is attached to the release record.

## 8. WreckaVOID

The detailed balance model, product shape, delivery charter, sprint evidence, and release checklist now live in [`games/wrecka-void/docs/V1-DELIVERY-PLAN.md`](../games/wrecka-void/docs/V1-DELIVERY-PLAN.md). This section remains the catalog-level gate; the game plan is the execution source for W0 through W7.

### Current state

WreckaVOID is the best first repair target because it already has a recognizable home screen, gameplay loop, leaderboard screen, profile screen, support surface, game-over presentation, and share controls. It is also carrying the most obvious “old application inside the new platform” problem.

The game lives in [`games/wrecka-void`](../games/wrecka-void). [`src/App.tsx`](../games/wrecka-void/src/App.tsx) switches between its internal pages. [`src/pages/HomePage.tsx`](../games/wrecka-void/src/pages/HomePage.tsx) contains the old landing experience and auth entry. [`src/hooks/useAuth.ts`](../games/wrecka-void/src/hooks/useAuth.ts) still implements its own email/password and Google flow. [`src/components/Game/GameEngine.tsx`](../games/wrecka-void/src/components/Game/GameEngine.tsx) owns a large imperative canvas loop. [`src/components/Game/GameOverlays.tsx`](../games/wrecka-void/src/components/Game/GameOverlays.tsx) owns pause, result, sharing, and sign-in messaging.

Historically, WreckaVOID wrote to a separate empty `game_scores` table. The intended game-over submission was skipped because state changed before the next guarded loop could submit. The current source branch contains a one-shot ordering correction and a platform run adapter, but production cannot complete that path until the platform auth/run backend is active.

### Confirmed release blockers

- [`src/game/CollisionDetection.ts`](../games/wrecka-void/src/game/CollisionDetection.ts) uses a pusher collision’s `damage` value before that value is declared, creating a real temporal-dead-zone crash when the path runs.
- The game loop publishes React state every frame, and the animation callback/effect depend on that changing state. This can repeatedly cancel and recreate the RAF loop rather than keeping one stable simulation owner.
- Delta time is capped rather than processed through a fixed-step accumulator, so slow devices can change simulation and scoring behavior.
- [`src/game/InputManager.ts`](../games/wrecka-void/src/game/InputManager.ts) handles mouse/keyboard only. Canvas size is based on `window.innerHeight` rather than dynamic viewport/safe-area ownership.
- Google auth redirects to `/game`, but the application has no matching routed page and production is mounted under the WreckaVOID path.
- Score finish failure collapses to an apparent success state; players cannot tell saved, rejected, expired, guest, offline, or unavailable apart.
- `games/wreck-avoid` and `games/wrecka-void` contain near-duplicate source trees. Only the latter is staged into production.
- There is no game audio system and essentially no ARIA/focus behavior.
- Vite build passes, but standalone type-check fails with real engine/type defects; lint currently reports 29 errors and three warnings; there are no tests.
- A roughly 1.5 MB logo is shipped in the current build and should not block first play.

### WreckaVOID V1 experience

A guest opens the platform WreckaVOID page, understands the controls, launches quickly, and plays a stable physics-survival run. Keyboard/pointer and supported touch input are explicit. Pause and focus loss are safe. The result screen shows an honest score, survival context, personal best when signed in, and a shareable result. The game no longer asks the player to create a second WreckaVOID account. The platform detail page holds the leaderboard and richer context; the immersive route stays focused on play.

### Required V1 scope

#### Core playability

- Establish a reproducible bug baseline for start, movement, wrecking-ball physics, collision scoring, enemies, damage, death, restart, pause, focus loss, resizing, and repeated runs.
- Break the oversized game loop into testable lifecycle boundaries without rewriting working physics for style alone.
- Guarantee exactly one terminal transition and one finish attempt per run.
- Select `games/wrecka-void` as canonical and remove the duplicate tree from active tooling after preservation/ownership review.
- Remove stale animation frames, listeners, audio nodes, and timers after restart or navigation.
- Define supported browsers and minimum viewport; provide a deliberate unsupported-device message if a mode cannot work.
- Add touch controls only if they meet playability and visibility standards; do not claim mobile support based on a canvas fitting the screen.
- Use Pointer Events, pointer capture, `touch-action`, safe-area insets, and orientation/browser-chrome resize tests for any mobile claim.
- Tune the first minute so a new player can learn movement and impact without reading a wall of text.
- Verify color, motion, hit feedback, screen shake, particles, and audio do not obscure essential state.

#### Platform integration

- Replace WreckaVOID’s local auth modal/profile navigation with platform account status and sign-in links.
- Start a platform run when actual play begins, not when the menu loads.
- Finish through the one-use run endpoint with duration, waves, destruction totals, damage, and other bounded metrics.
- Treat the initial leaderboard tier as `provisional` or `validated` through server plausibility rules; do not call client physics `verified` without replay or authoritative simulation.
- Define run expiry/renewal for survival sessions longer than the platform’s current 20-minute ticket.
- Move the canonical board to `/games/wreckavoid/`; leave only compact personal/result context in the game runtime.
- Share the canonical result receipt rather than generic promotional copy.
- Fail open for play and fail closed for ranking when auth or scoring services are unavailable.

#### Presentation and product cleanup

- Build a distinct `/games/wreckavoid/` platform page with artwork, controls, Play, scores, personal best, share, and current status.
- Reduce the old internal home screen to a purposeful game menu or bypass it after the platform page.
- Remove obsolete “join the leaderboard” and support/payment language that does not match the live platform.
- Standardize aVOID header/return behavior without putting the whole platform navigation over the active canvas.
- Add a clear audio toggle, pause command, reduced-motion behavior where practical, and readable result actions.
- Add a small purposeful impact/damage/game-over sound set rather than a large soundtrack requirement.

#### Tests and telemetry

- Unit-test score calculation inputs, terminal state, and run-finish idempotency.
- Add a deterministic harness for state transitions even if full physics replay is deferred.
- Add browser tests for guest start/restart, signed-in accepted finish, service failure, pause/focus loss, and repeated runs.
- Measure long-task behavior, frame stability, memory after repeated restarts, asset loading, and canvas resize.
- Log finish rejection reason codes server-side without collecting unnecessary raw play data.

### WreckaVOID sprint breakdown

| Sprint | Outcome                                                                           | Size | Exit evidence                                                                                 |
| ------ | --------------------------------------------------------------------------------- | ---: | --------------------------------------------------------------------------------------------- |
| W0     | Bug baseline, gameplay contract, supported-device matrix, automated smoke harness |    M | Repro list, recorded control matrix, build/lint result, repeatable start/death/restart smoke  |
| W1     | Stable lifecycle and terminal-state repair                                        |    L | One finish transition, no duplicate loops/listeners, repeated-run memory check, focused tests |
| W2     | Responsive input, pause/focus/audio, first-minute onboarding                      |    L | Desktop/touch matrix, focus-loss QA, readable HUD/results at target breakpoints               |
| W3     | Platform session and one-use run integration                                      |    L | Guest and signed-in flow, failure fallback, idempotent finish, no direct score writes         |
| W4     | Detail page, personal best, leaderboard, receipt sharing, old UI retirement       |    M | `/games/wreckavoid/` acceptance pass and canonical receipt share                              |
| W5     | Balance, performance, accessibility, production hardening                         |    L | Browser matrix, frame/memory evidence, accessible actions, deployment and rollback smoke      |

**Expected WreckaVOID effort after the shared platform foundation:** **15–24 focused engineering/QA days**. Allow **20–30 days** when platform-detail integration, asset cleanup, and release support are owned by the same lane. It rises further if deterministic replay becomes a V1 requirement.

### WreckaVOID V1 acceptance checklist

- [ ] Five consecutive guest runs can start, end, and restart without reload or accumulating handlers.
- [ ] Desktop controls, pause, focus loss, audio, resize, and supported touch behavior pass the device matrix.
- [ ] No WreckaVOID-specific password, Google, profile, or membership system remains in the player path.
- [ ] A signed-in finish creates at most one accepted/provisional platform result.
- [ ] An offline or rejected score never blocks restart and never appears as accepted.
- [ ] The game page shows controls, status, leaderboard, personal best, and a working Play route.
- [ ] Share uses a canonical result URL.
- [ ] Build, lint, focused tests, browser smoke, performance, accessibility, and deployed-route checks pass.
- [ ] The pusher, boss, projectile, second-chain, and every retained power-up path run without console exceptions.
- [ ] Twenty restarts do not increase RAF loop or event-listener counts.

### Explicitly later

- Fully authoritative server physics.
- Competitive multiplayer.
- Campaign progression, economies, or transferable rewards.
- In-game AdSense or clickable gameplay billboards.

## 9. WORDaVOID

### Current state

WORDaVOID lives in [`games/word-avoid`](../games/word-avoid) and is the strongest candidate for the platform’s first genuinely validated leaderboard. Its Zustand game store in [`src/stores/gameStore.ts`](../games/word-avoid/src/stores/gameStore.ts) owns the run lifecycle, typing statistics, and result dispatch. The game already has mode selection, result presentation, local statistics, audio, animations, and a native Web Share action.

The application has more modern React/UI dependencies than the other originals, but it is sensitive to toolchain changes: newer React plugin generations compiled successfully and then rendered a blank application. The verified line remains Vite 7.3.6 with React plugin 4.7. Its Tone audio and Supabase leaderboard clients were deferred behind user action to reduce initial JavaScript. The legacy lint debt was cleared, but the current automated test coverage is still only a narrow store regression.

Historical score payloads trusted browser-authored WPM, accuracy, words typed, mode, and level. The current source contains a platform run adapter, but a `validated` tier requires a server-issued word/ruleset seed and server recomputation rather than accepting those fields as facts.

### Confirmed release blockers

- The menu advertises eight modes, but `perfectRun` and `dailyChallenge` have no distinct store behavior and currently fall through to Classic semantics.
- Accuracy is derived from spawned words rather than character attempts/mistakes and is artificially floored at 60 percent. It is not a valid competitive accuracy metric.
- The result screen reports current streak as “best streak,” even though a miss resets current streak to zero.
- Input is a global `keydown` listener with no focusable input bridge. Mobile software keyboards have nothing to focus, so the game is not meaningfully mobile-playable.
- Arena coordinates read window size but do not subscribe to resize/orientation or normalize existing entities after viewport changes.
- Reduced motion exists as a setting but does not control the many infinite Framer animations or the system preference.
- Audio gains initialize at zero and the music layer is placeholder/disabled, so current settings can claim behavior the player does not hear.
- Platform identity/save failure is invisible. The adapter silently depends on a pre-existing browser session.
- An unused legacy leaderboard API still contains anonymous/authenticated direct inserts and a client-authored `is_verified: true` path. It must be deleted, not merely blocked by a migration.
- “Full stats” is a coming-soon placeholder; persistence is localStorage only.
- Build, strict type-check, lint, and the one existing reset-state test pass, but the main chunk is about 548 KB and the test suite is far below a competitive scoring bar.

### WORDaVOID V1 experience

A player chooses a clearly explained mode, begins with keyboard focus in the correct place, understands the incoming-word rules, and can complete, pause, or restart a run without focus traps. Audio starts only after interaction and respects the saved preference. A signed-in result is recomputed from a server-issued sequence and appears on the correct mode board with WPM, accuracy, and score. Guests can still play and keep local history.

### Required V1 scope

#### Core playability and accessibility

- Define the V1 mode set and hide experimental or redundant modes until their scoring contracts are stable.
- Limit V1 to Classic Survival and two-minute Time Attack unless another mode passes a separate scoring/balance gate.
- Verify word generation, difficulty ramp, spawn timing, input parsing, casing, punctuation, backspace, IME/composition behavior, pause, finish, and restart.
- Ensure typing focus survives expected interaction without capturing browser shortcuts or trapping navigation.
- Track characters attempted/correct, corrected errors, words completed/missed, current streak, maximum streak, and active duration as first-class metrics.
- Add readable control/mode explanations outside the active arena.
- Respect reduced motion and audio preferences; keep critical feedback available without sound or color alone.
- Remove the artificial 60-percent accuracy floor and let honest poor results remain poor results.
- Define phone support honestly. A typing game may support mobile keyboards, but only after viewport, keyboard-resize, focus, and performance QA.
- Keep initial audio and leaderboard code deferred and maintain a sensible bundle budget.
- Hide or relabel music controls until an actual music layer exists; make working SFX volume reach the runtime gain.

#### Validated score contract

- Version the word dictionary, mode rules, scoring formula, difficulty curve, and normalization rules.
- Issue the word sequence or deterministic seed from the server at run start.
- Submit answer outcomes/timing evidence sufficient to recompute score, WPM, accuracy, words completed, and duration.
- Reject impossible timestamps, unknown words, altered rulesets, reused runs, and inconsistent totals.
- Use an idempotency key so retries return the same result.
- Publish separate boards per scoring contract/mode rather than mixing incomparable runs.
- Keep historical rows as `legacy`; do not retroactively validate them.

#### Platform integration

- Consume the platform session and remove any implicit reliance on a separately initialized game auth state.
- Delete the unused direct-write leaderboard API so it cannot be reintroduced accidentally.
- Add the `/games/wordavoid/` detail page with modes, controls, Play, boards, personal bests, and result sharing.
- Return a receipt URL from finish and use it in Web Share plus a copy-link fallback.
- Preserve local-only guest stats and explain when a run is not ranked.
- Keep gameplay available when the platform service is offline.

#### Tests and hardening

- Unit-test every scoring formula and mode contract.
- Property-test invariants such as accuracy bounds, nonnegative duration, stable seed generation, and idempotent recomputation.
- Add store tests for start/pause/resume/end/restart, audio preference, focus state, and failed submission.
- Add browser tests for desktop keyboard, mobile virtual keyboard if supported, reduced motion, audio initialization, share fallback, and repeated runs.
- Pin and document the verified Vite/plugin compatibility line until an isolated upgrade passes runtime tests.

### WORDaVOID sprint breakdown

| Sprint | Outcome                                                                  | Size | Exit evidence                                                                             |
| ------ | ------------------------------------------------------------------------ | ---: | ----------------------------------------------------------------------------------------- |
| WD0    | V1 mode inventory, scoring specification, bug/input baseline             |    M | Written contract per included mode, unsupported-mode decision, input/browser matrix       |
| WD1    | Deterministic run start and server score recomputation                   |    L | Seed/ruleset tests, tamper rejection, idempotent result, no client-trusted aggregates     |
| WD2    | Platform session, game detail page, boards, personal best, receipt share |    L | Guest/signed-in integration and `/games/wordavoid/` acceptance pass                       |
| WD3    | Focus, mobile-keyboard, motion/audio, error, and repeat-run hardening    |    L | Browser matrix, accessibility checks, deferred-load evidence, no blank-runtime regression |
| WD4    | Balance, content, deployment, and release verification                   |    M | Mode balance readout, CI green, deployed smoke and rollback evidence                      |

**Expected WORDaVOID effort after the shared platform foundation:** **12–20 focused engineering/QA days**. Allow **15–24 days** when the same lane owns the detail page, platform integration, statistics surface, and release support. It remains the strongest first `validated` title because its score can be recomputed.

### WORDaVOID V1 acceptance checklist

- [ ] Every included mode has a versioned scoring and word-generation contract.
- [ ] The server can reproduce every accepted aggregate from submitted evidence.
- [ ] Tampered, expired, reused, or inconsistent runs are rejected without blocking play.
- [ ] Keyboard focus, pause, restart, audio, reduced motion, and supported mobile-keyboard behavior pass.
- [ ] Guest local history and signed-in platform results are clearly different.
- [ ] The game page and mode-specific boards work across target viewports.
- [ ] Share provides a canonical receipt and copy fallback.
- [ ] Type-check, lint, unit/property/store tests, build, live-runtime, and deployed-route checks pass.
- [ ] Accuracy can honestly fall below 60 percent and “best streak” is the true maximum.
- [ ] Unsupported modes cannot masquerade as distinct finished modes.

### Explicitly later

- Multiplayer typing races.
- User-supplied public word lists without moderation.
- AI-generated competitive dictionaries that cannot be reproduced.
- Ads during active typing or between prompt and input.

## 10. VOIDaVOID

### Current state

VOIDaVOID lives in [`games/void-avoid`](../games/void-avoid) and carries the original brand identity. Its game engine and React shell are separate enough to build, but its account/profile/leaderboard layer grew around the original game rather than a shared platform. [`src/store/authStore.ts`](../games/void-avoid/src/store/authStore.ts) contains a substantial password-oriented auth implementation. [`src/api/leaderboard.ts`](../games/void-avoid/src/api/leaderboard.ts) historically wrote guest and signed-in scores directly and treated the latter as verified. The unsafe sign-up score carryover is now disabled in the platform branch.

Score generation includes client-side randomness, so identical inputs cannot currently reproduce a run. Normal signed-in game-over submission was also incomplete: much of the direct write behavior centered on carrying a guest score through sign-up rather than finishing every authenticated run consistently.

### Confirmed release blockers

- Multiple generations of engine, loop, input, resize, performance, and application code remain compiled together. The active React path uses `game/core/GameEngine`, while stale alternate engines and a duplicate app still fail type/lint gates.
- Vite build passes, but standalone type-check fails across active and stale code; lint currently reports 173 errors and ten warnings; there are no tests.
- Score submission is deliberately disabled and returns failure, while game-over/account copy still promises “verified leaderboard,” “Sign Up & Save Score,” and “Verified Player.”
- Guest result UI calculates where an unsaved score might rank and presents it as “You placed,” which is not a recorded placement.
- Email/password, mock/offline credentials, recovery, password change, and separate auth subscription logic remain inside the game. The auth-state subscription is not retained for cleanup.
- Touch handlers are attached to both window and canvas, while cleanup removes only the window registrations. Gestures can double-fire and canvas listeners leak.
- Game-loop blur/focus/visibility listeners have a cleanup method, but the active engine stop path does not call it.
- Simulation consumes raw frame delta; competitive behavior is unproven across 30/60/120 Hz and throttled tabs.
- Accessibility and reduced-motion support are absent, and the system cursor is hidden across UI layers where modal/button interaction still occurs.
- Production music depends on external blob URLs while local fallback audio assets are effectively absent.
- The root app initializes old auth and auto-starts play after roughly half a second, while an unused alternate app defines a different pre-game flow.
- A roughly 1.57 MB art asset remains in the play build.

### VOIDaVOID V1 experience

A player launches the original meteor-avoidance game, immediately understands cursor/touch steering, sees readable danger and score feedback, and can complete and restart a run reliably. The game preserves its fast, simple identity. Platform identity is optional for play and useful for persistence. Results are provisional until seeded gameplay/evidence makes stronger validation honest.

### Required V1 scope

#### Core game and input

- Document the actual scoring formula, meteor lifecycle, collisions, survival/distance metrics, difficulty ramp, pause, death, and restart behavior.
- Create a reproducible state/lifecycle harness around engine start, frame loop, game-over transition, teardown, and repeated runs.
- Trace the active import graph and remove/archive dead engine/application generations from compilation before adding new mechanics.
- Confirm pointer capture, touch steering, resize, device pixel ratio, visibility/focus loss, and orientation behavior.
- Make danger, player location, collision feedback, score, and pause state readable without relying on one color or excessive motion.
- Remove account prompts from the immediate game-over path when they compete with replay.
- Remove false saved-placement, verified-player, and score-persistence language until returned server state supports it.
- Verify audio initialization, mute state, teardown, and repeated-run memory.

#### Score and trust

- Start a platform run at the first playable frame and finish exactly once at terminal state.
- Version the scoring/difficulty contract.
- Seed all gameplay randomness that affects score and record the seed/ruleset with the run.
- Decide the V1 evidence tier:
  - `provisional` if the server only checks duration/rate bounds;
  - `validated` if compact events and a seeded simulation can reproduce the score;
  - never `verified` solely because the user is signed in.
- Remove all direct inserts and guest-to-account score promotion.
- Add a VOIDaVOID platform-run adapter; none exists in the current game source.
- Preserve accepted results through an idempotent receipt flow.

#### Platform and presentation

- Replace the in-game auth/profile stack with the platform session and links.
- Add `/games/voidavoid/` with the original story, controls, Play, board, personal best, status, and share.
- Keep `/voidavoid/` fast and focused.
- Add canonical result sharing and a copy-link fallback.
- Restore the system cursor and visible focus whenever the player is interacting with menus, dialogs, or buttons.
- Keep guest local bests if useful, but never silently merge them into ranked history.

#### Tests and hardening

- Unit-test scoring and difficulty functions.
- Test seeded random generation and deterministic event ordering.
- Add lifecycle tests for start/death/restart, tab hide/show, resize, service outage, and rejected finish.
- Add browser tests across pointer and supported touch devices.
- Measure frame stability, large-canvas cost, memory after repeated runs, and initial asset transfer.

### VOIDaVOID sprint breakdown

| Sprint | Outcome                                                                  | Size | Exit evidence                                                                |
| ------ | ------------------------------------------------------------------------ | ---: | ---------------------------------------------------------------------------- |
| V0     | Gameplay/scoring specification and lifecycle bug baseline                |    M | Formula/metric contract, device matrix, reproducible run smoke               |
| V1     | Stable engine lifecycle, input, resize, pause/focus, restart             |    L | Repeat-run and memory checks, pointer/touch evidence, focused tests          |
| V2     | Seeded randomness and versioned score evidence                           |    L | Same seed/events reproduce the same score or documented provisional boundary |
| V3     | Platform session, run adapter, detail page, personal best, receipt share |    L | No direct writes; guest/signed-in/failure paths; `/games/voidavoid/` pass    |
| V4     | Visual/audio/accessibility/performance and release hardening             |    L | Browser/device matrix, frame/memory report, CI and deployed smoke            |

**Expected VOIDaVOID effort after the shared platform foundation:** **20–35 focused engineering/QA days**. The largest uncertainty is whether the active engine can be isolated and made deterministic without changing the game’s feel.

### VOIDaVOID V1 acceptance checklist

- [ ] The scoring, difficulty, randomness, and terminal-state contracts are written and versioned.
- [ ] Repeated runs do not accumulate frames, listeners, audio, or stale state.
- [ ] Pointer and claimed touch behavior pass target devices and orientations.
- [ ] No game-specific login/profile flow remains in the play path.
- [ ] No browser inserts or promotes leaderboard rows directly.
- [ ] Score trust matches actual server evidence.
- [ ] The detail page, personal best, board, receipt share, and stable play route work.
- [ ] Build, lint, focused tests, browser smoke, performance, accessibility, and deployment checks pass.
- [ ] The source tree has exactly one active engine, loop, input owner, auth path, and score path.
- [ ] Double tap triggers exactly one action and twenty route/replay cycles do not grow listeners, timers, audio, canvases, or RAF loops.

### Explicitly later

- Global verification claims without deterministic replay.
- Complex progression or economies that dilute the original one-more-run loop.
- In-game advertising.

## 11. FLIPSIDE

### Current state

FLIPSIDE is live at `https://flipside.avoidgame.io` and is the richest product in the current catalog. Its source exists at `C:\dev\flipside-arena` with remote `Ideas-Realized/flipside-arena`. The game includes four stunt arenas, two-to-four-player realtime rooms, timed score/rampage/last-stand battles, Google auth, profiles/socials, avatar storage, cosmetics, entitlements, and checkout scaffolding.

The source explicitly separates Lovable Cloud auth from the multiplayer/leaderboard Supabase concern. The browser writes `flipside_scores` directly, and battle totals are client-simulated before podium submission. Its current account and commerce state do not automatically cross into the aVOID platform. No automated test/spec files were found. Public metadata still contains Lovable author/social/badge residue. AdSense code remains disabled because no ad client is configured, which is the correct release state.

The platform cannot responsibly promise a shared FLIPSIDE profile or leaderboard until both Supabase boundaries, Stripe ownership, environment contract, score flow, and deployment rollback are audited.

### FLIPSIDE V1 classifications

FLIPSIDE needs two separate definitions:

1. **Directory V1:** it is accurately represented as a first-party game on an aVOID subdomain, with a platform detail page, clear launch, verified ownership/branding, status, controls, and an explicit note that its current account/score world is independent.
2. **Integrated V1:** it uses the platform identity and result contract or a documented cross-origin bridge, its current entitlements are reconciled, and any shared leaderboard meets the same trust rules as hosted games.

Directory V1 may ship before integrated V1. The platform must not hold the rest of V1 hostage to a missing source repository.

### Required directory V1 scope

- Locate and document the source repository, deployment owner, Supabase project, Stripe ownership, and rollback path.
- Remove remaining Lovable author, social, badge, and TODO residue from the owned production metadata/UI.
- Add `/games/flipside/` with accurate modes, controls, screenshots/video, status, Play, and ownership language.
- Add visible aVOIDgame.io/Ideas Realized return branding inside FLIPSIDE without obstructing play.
- Keep its current leaderboard and membership claims separate from the shared platform until audited.
- Verify desktop/mobile launch, multiplayer entry, profile access, and checkout links do not dead-end.
- Add baseline automated smoke coverage for title-to-driving, arena switch, room creation, match/podium, and return-to-play.

### Required integrated V1 scope

- Audit the full source, database grants/RLS, direct score writes, realtime room trust, avatar/storage policies, cosmetics, entitlements, and checkout/webhooks.
- Test room capacity, late join, disconnect/rejoin, stale presence, rematch, and two-browser synchronization.
- Choose one identity boundary:
  - migrate FLIPSIDE to the platform Supabase project; or
  - keep its project and use a short-lived one-time authorization exchange with exact origins and PKCE.
- Never share raw Supabase/Stripe tokens through query strings or `postMessage`.
- Replace direct score inserts with a server-authoritative or evidence-backed result flow.
- Treat free-roam stunt submissions as provisional unless the server can validate them.
- Treat multiplayer ranking as untrusted until the room outcome is authoritative or independently verifiable.
- Map existing cosmetics/subscriptions to platform entitlements without double-billing or silently removing access.
- Add exact-origin CORS/CSP, abuse limits, idempotency, and cross-origin logout/session tests.

### FLIPSIDE sprint breakdown

| Sprint | Outcome                                                               | Size | Exit evidence                                                                                  |
| ------ | --------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------- |
| F0     | Source/infrastructure ownership packet                                |    M | Repositories, deploys, projects, products, owners, secrets locations, rollback path documented |
| F1     | Directory V1 detail page and reciprocal branding                      |    M | Accurate page, launch, device check, independent-boundary copy                                 |
| F2     | Source/database/auth/commerce/realtime security audit                 |    L | Risk register, schema/grants map, score/room/entitlement dataflow                              |
| F3     | Identity and entitlement reconciliation decision/prototype            |    L | Approved migration or one-time exchange, test accounts, no token leakage/double billing        |
| F4     | Result/leaderboard hardening                                          |   XL | No direct accepted score writes, authoritative/evidence contract, abuse and retry tests        |
| F5     | Cross-origin, multiplayer, mobile, performance, and release hardening |    L | Origin policy, room QA, device matrix, deployed/rollback evidence                              |

**Expected FLIPSIDE effort:** **2–3 focused weeks** for a credible browser V1 plus the aVOID detail boundary. Shared aVOID identity and leaderboard migration is another **1–2 weeks** after the two Supabase and commerce boundaries are reconciled.

### FLIPSIDE V1 acceptance checklist

- [ ] The source, project, billing, deployment, and rollback owners are known.
- [ ] The platform detail page and FLIPSIDE reciprocal brand link are accurate and responsive.
- [ ] The site does not imply shared identity, entitlements, or ranking before they exist.
- [ ] Integrated V1, if selected, has one documented identity boundary and no raw token bridge.
- [ ] No client can author an accepted shared leaderboard result directly.
- [ ] Existing paying players retain correctly reconciled access.
- [ ] Realtime room, checkout, profile, avatar, mobile, performance, and deployed-route checks pass.
- [ ] A two-player room completes countdown, match, podium, and rematch; a fifth player cannot silently enter a four-player room.
- [ ] One successful test payment yields one entitlement, while canceled/failed payments yield none.

## 12. TankaVOID

### Current state

The monorepo TankaVOID lives in [`games/tanka-void`](../games/tanka-void), but it is not a buildable game. The prototype contains a canvas engine, player/enemy/boss tank classes, infantry, projectiles, landmines, power-ups, terrain, particles, audio, experience, keyboard/mouse handling, and early touch controls. It also contains incompatible generations of APIs wired together in [`src/core/Game.ts`](../games/tanka-void/src/core/Game.ts), while its React `App.tsx` is still a placeholder.

The current type check fails with dozens of contract errors: missing entity methods, incompatible update/reset signatures, inconsistent collision shapes, missing particle and experience methods, and unfinished power-up behavior. This is not lint debt around an otherwise releasable loop. It is a prototype whose systems do not agree on the game contract.

There is a better standalone prototype at `C:\dev\TankAVOIDz`, remote `Idea-R/TankaVOID`, on `feat/get-game-working` with substantial uncommitted work. It nearly type-checks and contains a usable canvas loop, waves, camera, score, keyboard/mouse/joystick/touch input, directional front/side/rear armor, weapons, enemies, bosses, mines, power-ups, terrain, and particles. It is the mechanics salvage candidate, not the production runtime.

The strongest original idea—directional damage, armor angle, deliberate tank movement, and satisfying impacts—is still disconnected. `Tank.takeDamage` can accept an impact angle, but the projectile collision path currently calls it with damage alone; no demonstrated ricochet contract exists. Its leaderboard is hard-coded sample HTML, its last `dist` predates current source changes, and it has no auth, backend, score security, tests, or production deployment.

### TankaVOID V1 experience

TankaVOID V1 is a focused top-down survival/arena game:

- one player tank with deliberate hull movement and independent turret aim;
- directional armor zones with clear front/side/rear damage consequences;
- projectile travel, impact angle, ricochet/penetration feedback, and readable damage;
- one polished arena with destructible or tactically meaningful cover;
- three normal enemy tank behaviors and one boss or final pressure event;
- a short onboarding run, pause/restart, audio controls, keyboard/pointer support, and viable touch controls if claimed;
- one versioned score contract based on survival and combat accomplishments;
- a platform detail page, provisional/validated board, personal best, and result receipt.

### Deliberately excluded from TankaVOID V1

- Multiplayer or networking.
- A campaign map, large progression tree, inventory economy, crafting, or live service.
- Infantry, mines, eight power-up types, multiple bosses, and every prototype feature unless they directly earn their place in the V1 loop.
- Photorealistic simulation or full ballistic armor modeling.
- Pay-to-win upgrades or rewarded competitive advantages.

### Required V1 scope

#### Rebuild decision and core contract

- Preserve both prototype histories and the dirty standalone work before selecting a source baseline.
- Create a new buildable runtime shell, then selectively port tested math, input, tank motion, directional armor, weapons/projectiles, a small enemy subset, and profiled terrain/particle techniques.
- Write one-page rules for movement, aiming, fire cadence, armor zones, impact angle, penetration/ricochet, damage, enemies, score, death, and restart.
- Select only the reusable math, pooling, rendering, or art/audio pieces that pass isolated tests.
- Rewrite lifecycle/state ownership, collision/damage contracts, responsive scaling, UI/HUD, deterministic runs, tests, and platform score integration.
- Define deterministic fixed-step simulation and seeded run configuration before content expansion.

#### Vertical slice

- Implement one tank, one shell type, front/side/rear armor, one enemy, one arena, score, damage, death, restart, pause, and debug visualization.
- Make hit direction and armor outcome readable through shape, animation, sound, and text/icon feedback.
- Establish keyboard/pointer and touch control prototypes early; reject touch support if it does not feel intentional.
- Add performance budgets for active entities, particles, draw calls, and mobile frame time.
- Prove ten repeat runs without stale loops or memory growth before adding more content.

#### V1 content and platform integration

- Add two more enemy behaviors and one final pressure/boss event.
- Add only the smallest useful set of pickups/upgrades after the base combat is fun.
- Tune run length, difficulty, spawn pacing, scoring, and onboarding through playtest notes.
- Add platform session, one-use runs, detail page, personal best, trust-labeled board, and receipt share.
- Keep score provisional unless the server can replay the deterministic simulation/evidence.

#### Hardening

- Unit-test vectors, angles, collision/penetration, damage zones, score, deterministic seed, and terminal state.
- Add simulation tests that can run without React/canvas.
- Add browser/device tests for input, resize, pause/focus, audio, touch if supported, and repeated runs.
- Add performance captures on target laptop and phone hardware before claiming mobile.

### TankaVOID sprint breakdown

| Sprint | Outcome                                                                                     | Size | Exit evidence                                                                                        |
| ------ | ------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------- |
| T0     | Preserve both prototypes, capture the best playable state, and write the V1 combat contract |    M | Source/dirty-work preservation, salvage list, rejected scope, rules/score/input/performance contract |
| T1     | New buildable engine shell and fixed-step simulation                                        |    L | Clean type/build/lint, headless simulation test, start/stop/restart                                  |
| T2     | Player tank, turret, projectile, directional armor, impact feedback                         |   XL | Playable one-enemy combat slice and damage/angle tests                                               |
| T3     | Arena, cover/collision, enemy behavior, spawn/terminal loop                                 |    L | Ten repeatable full loops with stable memory/frame behavior                                          |
| T4     | Touch prototype, HUD, pause/audio, onboarding, accessibility                                |    L | Device/control decision and target-viewport pass                                                     |
| T5     | Enemy/content expansion and one final pressure event                                        |   XL | V1 content complete, playtest/balance report                                                         |
| T6     | Platform detail/session/run/result/board integration                                        |    L | Guest/signed-in/failure flows and no direct score writes                                             |
| T7     | Performance, balance, browser/device, deployment hardening                                  |    L | CI, frame/memory/device matrix, deployed smoke, rollback evidence                                    |

**Expected TankaVOID effort:** **4–6 engineering weeks plus 1–2 weeks of feel, art, and QA iteration** for the narrow V1 above. A playable vertical slice should appear in the first week. Attempting to rehabilitate every prototype system or add multiplayer would move it beyond this range.

### TankaVOID V1 acceptance checklist

- [ ] A new clean build passes type-check, lint, tests, and production build.
- [ ] Directional armor and impact angle materially change damage and are understandable during play.
- [ ] Shallow-angle hits consistently deflect or reduce penetration under the written rule set.
- [ ] The full start/play/death/restart loop remains stable across repeated runs.
- [ ] The supported input/device claim is backed by actual device evidence.
- [ ] The V1 enemy/content list is complete without reintroducing prototype sprawl.
- [ ] Score has a versioned contract and an honest trust tier.
- [ ] Detail page, Play, personal best, board, and receipt work.
- [ ] Performance, accessibility, browser/device, deployment, and rollback gates pass.
- [ ] Five complete waves and the V1 boss/final pressure event are reachable without development tools.

## 13. Independent Ideas Realized games

Bloomfall (`bloomfall.io`), Acrolis Crawlers (`play.acrolis.io`), and Tic Tac Toe in 3D (`ttt3d.app`) are credited to Ideas Realized but retain their own domains and product worlds. Their complete game-development V1 plans belong in their own repositories after source audits. The aVOID program owns only their directory representation and reciprocal brand relationship unless a separate charter expands the scope.

### Shared aVOID directory V1 gate

- A high-quality, current capture or approved artwork accurately represents the live title.
- The title, genre, description, domain, Ideas Realized credit, status, and device expectations are accurate.
- The launch control states the external domain before opening it.
- The detail/card surface does not imply shared account, membership, favorite persistence, or leaderboard behavior that is not integrated.
- Each external site includes a tasteful “Other games by Ideas Realized” or aVOID linkback when that fits its product identity.
- External links, redirects, HTTPS, social preview, mobile layout, and basic browser behavior are checked on release.
- Changes to the external game itself remain separately deployed and independently reversible.

### Per-title integration scope

| Title             | aVOID V1 treatment                                                                                         | Expected effort | Explicit boundary                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | --------------: | --------------------------------- |
| Bloomfall         | Distinct platform detail/card, current live capture, external launch, Ideas Realized/aVOID reciprocal link |        2–4 days | No shared ladder or platform auth |
| Acrolis Crawlers  | Distinct detail/card, current live capture, controls/status context, external launch, reciprocal link      |        2–4 days | No shared ladder or platform auth |
| Tic Tac Toe in 3D | Distinct detail/card, spatial-rules summary, current capture, external launch, reciprocal link             |        2–4 days | No shared ladder or platform auth |

### 13.1 Bloomfall product V1

#### Current state

Bloomfall source exists at `C:\dev\Bloomfall`, remote `Idea-R/bloomfall`, with a large dirty working tree. The live game at `https://bloomfall.io` already contains three heroes, three difficulties, tutorial/campaign/death/victory/credits phases, signed-in run/milestone recording, email/password and Google auth, and an authenticated ledger.

The product truth has drifted: public metadata promises twelve chapters while the content registry contains 13 named levels. The repository has no test/spec files, its scripts expose build/lint but no dedicated type/test gate, and the README still reads like the original generation prompt/Lovable setup. The dirty tree and campaign reachability are higher risks than a shortage of features.

#### Bloomfall V1 definition

- Three heroes and three difficulties are playable.
- One documented chapter count matches metadata, registry, progression, ending, and credits.
- Every shipped chapter has a reachable entry, required key/door progression, encounters, exit, and completion state.
- Guest campaign play, local continuation, reload/crash recovery, death/retry, victory, and credits work without Supabase.
- Signing in banks run history/milestones but does not become the only save.
- Mobile controls, camera, HUD, audio, motion, and safe areas survive the full campaign.
- The aVOID page explicitly says Bloomfall account/progression are independent.

#### Bloomfall sprint sequence

| Sprint | Outcome                                                                       | Size | Exit evidence                                                                    |
| ------ | ----------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------- |
| B0     | Preserve dirty work, source/scope lock, README/scripts, 12-vs-13 decision     |    M | Named branch, clean runbook, canonical chapter list, type/test gates             |
| B1     | Campaign structural and reachability validation                               |    L | Automated registry/gate/key/exit checks; tutorial/death/transition/victory smoke |
| B2     | Versioned local save, continue/delete/recovery, optional account summary sync |    L | Guest/offline save recovery and cross-user RLS tests                             |
| B3     | Hero/difficulty balance, onboarding, touch, motion/audio/accessibility        |    L | Full-run playtest matrix and target-device evidence                              |
| B4     | Visual/audio/performance/credits/metadata release pass                        |    L | Dense-chapter profiling, owned metadata, structured external playtest            |
| B5     | `/games/bloomfall/` and reciprocal aVOID/Ideas Realized link                  |    M | Accurate independent boundary and responsive external launch                     |

**Expected Bloomfall product effort:** **5–8 focused weeks**. The aVOID directory/detail integration itself is **2–4 days** after product truth is settled.

#### Bloomfall acceptance gate

- [ ] Metadata and runtime agree on one chapter count.
- [ ] Every chapter passes structural reachability validation.
- [ ] Three full hero campaigns complete without development tools or soft locks.
- [ ] Reload/crash recovery preserves a valid local save.
- [ ] Guest campaign works with Supabase unavailable.
- [ ] Signed-in history is player-private and duplicate-safe.
- [ ] Mobile policy is explicit and tested through the full campaign.
- [ ] Type-check, lint, tests, build, browser/console, performance, deploy, and rollback checks pass.
- [ ] The aVOID page never suggests shared aVOID scoring.

### 13.2 Acrolis Crawlers product V1

#### Current state

Acrolis source is in private repository `Idea-R/dungeon-crawler-og`, with the public game at `https://play.acrolis.io`. It already has the most mature planning surface in the catalog: an end-to-end dungeon loop, campaign/overworld/towns, progression, controller and PWA/mobile foundations, Supabase auth/leaderboard/run history/daily/meta systems, a single `npm run verify` gate, and its own V1/Steam roadmap.

Its main risk is breadth. The repository’s own roadmap correctly defines V1 as a scoped completed campaign, real ending, offline-first behavior, coherent art, controller-complete installed build, save recovery, QA, and release operations. Public metadata still carries Lovable TODO/social residue, and no clear aVOIDgame.io/Ideas Realized linkback was found.

#### Acrolis V1 definition

- Complete authored campaign with a real ending and unreachable/experimental systems removed or clearly gated.
- Offline-first guest play and local save as source of truth.
- Optional Supabase link/sync/leaderboards that do not break local play.
- Coherent visual identity, controller-complete navigation/play, installed desktop packaging, save migration/recovery, and full verification/playtest gates.
- Its aVOID page and reciprocal link preserve Acrolis-owned profile/progression/leaderboard behavior.

#### Acrolis aVOID sprint sequence

| Sprint | Outcome                                                                                    | Size | Exit evidence                                                                  |
| ------ | ------------------------------------------------------------------------------------------ | ---: | ------------------------------------------------------------------------------ |
| A0     | Clone/link real repository, verify deploy-to-main relationship and rollback                |    M | Local source, `npm run verify`, deploy/rollback record, owned metadata cleanup |
| A1     | Reconcile formal V1 scope with public build and label incomplete/beta surfaces             |    L | Offline/guest/save/cloud-link/board truth pass                                 |
| A2     | `/games/acrolis/`, accurate controls/platform notes, independent boundary, reciprocal link |    M | Responsive detail, PWA/install context, no mirrored score/profile claim        |

The actual Acrolis product work remains governed by its own roadmap. Its recorded ranges are roughly 2–3 weeks for scope/content, 6–10 weeks parallel art production, 3–4 weeks parallel desktop/Steam work, 2–3 weeks feel/audio/onboarding, and 4+ weeks QA/launch. A realistic overlapping calendar is **14–20+ weeks**. The aVOID integration remains under one week.

#### Acrolis acceptance gate for this program

- [ ] The local clone/source, production deploy, and rollback are known.
- [ ] Public metadata and attribution are owned rather than Lovable-branded.
- [ ] The detail page accurately labels the independent domain/account/leaderboard.
- [ ] No Acrolis record is copied into aVOID leaderboards.
- [ ] `npm run verify` and the game’s own offline, save, controller, soak, installed-build, and playtest gates govern Acrolis product V1.

### 13.3 Tic Tac Toe in 3D product V1

#### Current state

The public game at `https://ttt3d.app` provides local 4×4×4 play, multiple board sizes, several AI levels, Google sign-in, online rooms/matchmaking/readiness, player profiles/stats, realtime leaderboards, server notices, and admin UI. No canonical local source or dedicated accessible repository has yet been recovered. Portfolio evidence exists in `Idea-R/ideas-realized-page`, but the public bundle is not an acceptable source of truth for a deep repair.

The public page still contains TODO comments and Lovable author/social metadata. Its main JavaScript asset is roughly 2 MB uncompressed. The browser updates room records directly, so online integrity depends entirely on uninspected RLS/functions. Source, migrations, CI, deployment, and rollback are hard blockers.

#### Tic Tac Toe in 3D V1 definition

- Focused 4×4×4 local pass-and-play and solo AI with clearly differentiated difficulty.
- Optional signed-in online rooms with authoritative move ordering, reconnect, timeout, forfeit, and exactly-once results.
- Correct win detection for every legal 3D line and supported board size.
- Understandable orbit/layer interaction, keyboard and touch controls, responsive small-screen behavior, and owned branding.
- Honest player statistics/leaderboard with no client-authored wins, losses, streaks, or room result.
- Independent aVOID page and reciprocal Ideas Realized/aVOID attribution.

#### Tic Tac Toe in 3D sprint sequence

| Sprint | Outcome                                                                       | Size | Exit evidence                                                                      |
| ------ | ----------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------- |
| X0     | Recover source, migrations, env inventory, production commit, deploy/rollback |    M | Protected clone, runbook, no minified-bundle development dependency                |
| X1     | Generated rule/win-line, draw, illegal-move, turn, and deterministic AI tests |    L | Exhaustive legal-line fixtures and AI-level expectations                           |
| X2     | Atomic server-validated online moves/results and room lifecycle               |    L | Simultaneous move, reconnect, timeout, forfeit, cleanup, cross-user security tests |
| X3     | Camera/layer onboarding, touch/keyboard/accessibility and bundle/GPU work     |    L | 360 px mobile, keyboard, screen-reader summary, responsive performance evidence    |
| X4     | Owned metadata, `/games/ttt3d/`, controls/rules/privacy, reciprocal link      |    M | No Lovable residue and explicit independent account/leaderboard boundary           |

**Expected Tic Tac Toe in 3D product effort:** **3–4 weeks** after source recovery; **5–7 weeks** if source cannot be recovered and behavior must be reconstructed. Source recovery is the first ticket, not an assumption.

#### Tic Tac Toe in 3D acceptance gate

- [ ] All legal winning lines and supported board-size rules pass generated tests.
- [ ] Illegal, duplicate, stale, and simultaneous moves resolve server-side to one authoritative state.
- [ ] Reconnect/timeout/forfeit produce exactly one result.
- [ ] Players cannot directly edit stats or another room.
- [ ] Local/AI modes remain usable while signed out/offline.
- [ ] Touch, keyboard, camera/layer onboarding, 360 px mobile, bundle, and low-GPU checks pass.
- [ ] Owned metadata and aVOID detail/linkback replace Lovable residue.

If any independent title later requests platform identity, favorites, membership, or ranking, it becomes its own integration track with source, data, security, and commerce review comparable to FLIPSIDE.

## 14. Phase-by-phase release train

The program ships vertical increments. It does not wait for every title before improving production, and it does not activate unsafe cross-cutting features just because UI already exists.

### Batch 0 — Control plane and recoverability

**Sprints:** 0–1

**Outcome:** everyone works from one plan, the live state is recoverable, and unsafe assumptions are written down.

- Approve this document as the program source of truth.
- Update `ROADMAP.md`, `WORKLOG.md`, and `DECISIONS.md` at every sprint boundary.
- Record the exact production deploy, repositories, environments, domains, projects, owners, and rollback targets.
- Obtain the Supabase development-branch cost before creating one, or approve a local isolated alternative.
- Snapshot and classify production profile/score data.
- Create the release evidence template and active-workstream board.

**Exit gate:** restore steps exist, source/env ownership is known, and the first migration can be tested without touching production.

### Batch 1 — Secure identity and data foundation

**Sprints:** 2–4

**Outcome:** one production-shaped account/profile session and canonical score model work in preview.

- Reconcile the schema/migration history and apply the reviewed foundation to isolation.
- Close public privileged functions and direct score writes.
- Wire Next.js and hosted games to one session contract.
- Migrate test copies of existing profiles/scores as legacy.
- Pass role-based RLS and advisor checks.

**Exit gate:** email/Google test identity, profile CRUD, session refresh/logout, legacy data, and server-only accepted-score writes work in a production-shaped preview.

### Batch 2 — Game pages and shared player surfaces

**Sprints:** 5–6

**Outcome:** the directory becomes a real game platform rather than a launch grid.

- Add the canonical registry and `/games/[slug]/` system.
- Add Play, controls, status, update notes, favorite/share, board, and personal-best slots.
- Add public profiles and approved social links.
- Preserve direct play routes and clear external-domain boundaries.

**Exit gate:** every catalog entry has the correct page/launch behavior on phone, tablet, laptop, and wide desktop.

### Batch 3 — WreckaVOID vertical slice

**Sprints:** 7–12

**Outcome:** the first visibly broken/old original becomes a complete platform-integrated V1.

- Execute W0–W5.
- Retire duplicate auth/profile and obsolete support copy.
- Ship honest provisional/validated results and canonical shares.

**Exit gate:** all WreckaVOID acceptance checks pass in production and rollback is proven.

### Batch 4 — WORDaVOID validated competition

**Sprints:** 13–17

**Outcome:** the platform earns its first server-validated leaderboard.

- Execute WD0–WD4.
- Publish versioned mode boards and result receipts.

**Exit gate:** accepted aggregates are recomputable and all WORDaVOID acceptance checks pass.

### Batch 5 — VOIDaVOID original-game hardening

**Sprints:** 18–22

**Outcome:** the original title gains deterministic or honestly provisional scoring and a stable modern lifecycle.

- Execute V0–V4.
- Keep the game fast and recognizable instead of turning it into a platform demo.

**Exit gate:** all VOIDaVOID acceptance checks pass with no false verification claim.

### Batch 6 — FLIPSIDE ownership and boundary

**Sprints:** can begin after Batch 0; integration waits for Batch 1

**Outcome:** FLIPSIDE is either explicitly independent or safely integrated.

- Execute F0–F1 for directory V1.
- Execute F2–F5 only after source and account ownership are confirmed and integrated V1 is approved.

**Exit gate:** no ambiguous shared-profile/score/payment promise remains.

### Batch 7 — TankaVOID rebuild

**Sprints:** begins after Batch 1; eight focused sprints expected

**Outcome:** the directional-damage tank idea becomes a small finished game, not a giant repaired prototype.

- Execute T0–T7.
- Playtest the one-enemy vertical slice before expanding content.

**Exit gate:** all TankaVOID acceptance checks pass and the “coming soon” card can safely become Play.

### Batch 8 — Creator, membership, and tactful monetization

**Sprints:** 3–5 focused sprints after identity/data foundation

**Outcome:** platform economics work without corrupting play.

- Finish private creator intake/moderation.
- Finish Stripe test-mode membership and entitlement lifecycle.
- Decide pricing/benefits in plain language.
- Activate AdSense only after publisher/site/CMP/age/privacy gates.
- Canary one directory unit for eligible free users; prove paid members send no ad request.

**Exit gate:** payment and advertising behavior is supportable, reversible, disclosed, and separated from gameplay.

### Batch 9 — Full-catalog hardening

**Sprints:** 2–3 after applicable title gates

**Outcome:** platform V1 and full-catalog V1 have release evidence, support notes, and rollback.

- Run the complete desktop/mobile/input/accessibility/performance/security matrix.
- Exercise backup/restore and deploy rollback.
- Review analytics/privacy, errors, support paths, legal surfaces, and operational ownership.
- Publish status/known issues without hiding deferred features.

## 15. Parallel workstream model

Keep one coordinator lane open for scope, integration, evidence, and user decisions. Use no more than three independent worker lanes.

| Lane          | Owns                                                                 | May proceed independently when                 | Must stop for                                                     |
| ------------- | -------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Platform/data | Schema, auth, profiles, run API, result pages, entitlements          | Working in isolation with no production writes | Branch cost, production migration, secrets, billing/ad activation |
| Game repair   | One named game’s engine/input/UI/tests                               | Platform contracts are stubbed/versioned       | Shared contract change, production deploy, scope expansion        |
| Catalog/QA    | Detail pages, captures, external boundaries, browser/device evidence | Content/source ownership is verified           | New public claims, external-site writes, paid assets              |

Every worker task must return changed areas, verification, risks, and the next smallest action. No lane may silently change another title’s score contract or database assumptions.

## 16. Sprint evidence template

Every sprint closes with this record in `WORKLOG.md` or a linked artifact:

```text
Sprint:
Outcome promised:
Completed:
Files/migrations/config changed:
Tests/builds run:
Browser/device evidence:
Data/security read-back:
Known failures/deferred scope:
Production/external state changed:
Rollback target:
Next dependency or approval:
```

## 17. Approval gates

The program may inspect, document, implement locally, run tests, create branches, and produce previews inside the agreed repository charter. It must pause before:

- creating a paid Supabase branch until its quoted cost is presented and approved;
- applying any production database migration or upgrading production Postgres;
- adding/changing production secrets or OAuth/SMTP ownership;
- creating live Stripe products/prices, enabling live checkout, refunds, or changing billing state;
- adding an AdSense publisher ID, consent system, or live ad request;
- changing DNS, domain ownership, access grants, or public creator visibility;
- merging or deploying a later production sprint unless the sprint’s release gate and rollback are reviewed;
- deleting or rewriting legacy profile/score data.

## 18. Immediate next sprint

### Sprint 0 — Recoverable foundation packet

Implementation evidence: [`sprint-0-recoverability.md`](sprint-0-recoverability.md)

**Outcome:** the program can begin database/auth work without risking the current 15 profiles, 69 leaderboard rows, live production site, or rollback.

**Tasks:**

1. Capture the live Supabase schema, grants, RLS policies, functions, triggers, and row-count manifest.
2. Identify every current auth consumer and storage/session key across platform, VOIDaVOID, WreckaVOID, WORDaVOID, and FLIPSIDE.
3. Identify every score read/write/RPC consumer and assign its future contract.
4. Document the production Netlify environment variable names and owners without recording values.
5. Obtain and present Supabase hosted-branch cost, or approve a local isolated Postgres/Supabase environment.
6. Produce a data mapping for existing profiles, scores, game rows, and backup tables.
7. Draft the restore/rehearsal steps and the P1 migration test plan.
8. Update the active workstream board and choose the W0 and P1 owners.

**Sprint 0 acceptance:**

- [x] No production data or configuration was changed.
- [x] All existing rows have a documented destination or archival decision.
- [x] Every privileged function/policy warning has an owner and intended remediation.
- [x] Platform and game auth/score consumers are mapped.
- [x] The isolated database route and its cost/approval status are explicit.
- [x] P1 can start without rediscovering the system.

## 19. Program completion

This goal is complete only when the platform V1 gate and every title’s selected V1 gate have acceptance evidence, the production state is supportable, and `ROADMAP.md` contains no hidden launch blocker. If FLIPSIDE remains independent, that classification must be explicit. If a title’s V1 is intentionally deferred, the main site must say so rather than presenting it as complete.
