# aVOIDgame.io worklog

## 2026-08-20

- Started VOIDaVOID V2 on isolated stacked branch `codex/fix-voidavoid-v2-evidence` with issue #20, leaving V0/V1 PR #19 and production untouched.
- Traced every active `Math.random`, `performance.now`, and `Date.now` call and classified outcome-changing versus visual-only use.
- Added unsigned run seeds and independent `world`, `power-up`, `chain`, `score`, and `defense` Mulberry32 streams. Meteor IDs are now per-run sequence IDs; visual particles, shake, color, arcs, and render jitter cannot consume gameplay draws.
- Moved grace-period, chain, combo, and defense timing onto the fixed 60 Hz simulation clock. Power-up intervals are sampled once per scheduled attempt instead of once per frame.
- Added a bounded V1 evidence envelope for ruleset `voidavoid-v2`: ordered tick events, viewport, draw counts, final breakdown, local FNV-1a mutation check, compact run code, and fail-closed `replayable-local` / `invalid-local` status.
- Added deterministic tests for seed reset, stream isolation, meteor physics, power-up schedule/drift, chain composition/positions including compact canvases, defense fallback, score replay, ordering, draw-count, score, shape, and integrity tampering. Final suite: 7 files / 22 tests; 57 active files, 0 lint errors, 0 warnings.
- Passed standalone Vite and full 21-route Next.js production builds. Browser QA passed at 1440×900, 390×844, and 844×390 with no overflow or console errors.
- Completed 20 consecutive result/replay cycles: 20 distinct codes, every result `replayable-local`, 21 starts/finishes total, 20 resets, one loop owner, five input listeners, and no pending terminal frame.
- Recorded the intentional boundary: V2 proves seeded world generation and score arithmetic, not legitimate client input or server trust. No database, Netlify, Stripe, AdSense, DNS, merge, or production state changed.
- Published the two-commit V2 stack as mergeable draft PR #21 above VOIDaVOID V0/V1 PR #19. GitHub has no Actions workflow configured for this head commit, so the recorded local release and browser gates remain the available evidence.

- Started VOIDaVOID V0/V1 on isolated stacked branch `codex/fix-voidavoid-v0-v1-baseline` with issue #18, leaving the dirty main checkout and production untouched.
- Traced the shipping graph and reproduced the misleading baseline: roughly 100 TypeScript errors, 173 lint errors, 10 warnings, no tests, duplicate input/resize/lifecycle owners, false verified-placement copy, game-local auth, external audio, and a 1.57 MB result image.
- Froze the actual survival, meteor, combo, perfect-knockback, chain, meteor-speed/spawn, collision, grace-period, power-up, and terminal rules as local ruleset `voidavoid-local-v1`.
- Replaced the active shell with explicit guest start, compact HUD, single-owner pause/help, honest local result, replay, copy result, and main-menu transitions. Game-local auth/profile/leaderboard/audio/performance-monitor code is outside the canonical graph.
- Added one fixed-step loop with reason-aware manual/help/focus/visibility/terminal pause, one pending RAF, bounded catch-up, one terminal transition, idempotent stop, and lifecycle diagnostics.
- Replaced duplicate mouse/touch registration with five canvas Pointer Events listeners, pointer capture, bounded coordinate mapping, double-tap classification, and exact cleanup.
- Made CanvasManager the only resize owner, restored browser zoom, selected an honest DPR-1 baseline, fixed equal-size initial state publication, removed duplicate renderer resize listeners, and tracked deferred defense timers.
- Added active-graph type/lint gates and 9 focused tests for lifecycle/pause, double-tap, scoring bounds/formulas, and score reset. Final active graph: 51 files, 0 lint errors, 0 warnings.
- Reduced the standalone build from about 425.15 KB JavaScript plus a 1.57 MB image to 255.65 KB JavaScript / 73.57 KB gzip and 9.14 KB CSS / 2.99 KB gzip.
- Browser QA at 1440×900, 390×844, and 844×390 caught and fixed stale 0×0 canvas diagnostics, focusable HUD controls behind dialogs, and decorative short-landscape overflow. Console remained quiet.
- Completed 30 deterministic finish/restart cycles with exactly +30 starts, +30 finishes, and +30 resets while holding one pending RAF, five input listeners, and stable canvas ownership.
- Passed standalone release verification and the full Next.js platform production build. No database, Netlify, Stripe, AdSense, DNS, merge, or production state changed. Evidence is in `docs/voidavoid-v0-v1-contract.md` and `docs/sprint-voidavoid-v0-v1.md`.

- Started WORDaVOID WD3 on isolated stacked branch `codex/fix-wordavoid-wd3-experience` with issue #16, leaving the dirty main checkout and production untouched.
- Replaced global printable-key capture with an owned typing surface that supports physical and software-keyboard events, rejects shortcuts/repeats/composition/out-of-contract characters, and restores focus after arena clicks and pause.
- Added composable manual/focus pause ownership, one semantic pause/result dialog, measured arena viewport ownership, live orientation recentering, dynamic-viewport/safe-area layout, and responsive HUD/menu/result surfaces.
- Made reduced motion honor the operating system plus the saved preference, bounded transient particle/score timers, and made audio initialization, saved gains, failure, and retry states truthful.
- Versioned and sanitized local progress with legacy migration, replaced the fake stats placeholder, separated local save from platform finish, stopped abandoned-run persistence/submission, and added explicit result/submission/share states.
- Guarded asynchronous start/restart generations and stale finishes, removed delayed targeting work, and browser-proved 20 repeat-run cycles without duplicate dialogs, inputs, or restart transitions.
- Passed WORDaVOID typecheck, zero-warning lint, 5 files / 33 tests, production build, full hosted-game/Next.js assembly, Git whitespace checks, desktop/narrow/landscape browser QA, live orientation change, focus isolation, reduced-motion persistence, and quiet application console.
- Recorded the honest physical-device and production boundaries in `docs/sprint-wordavoid-wd3.md`; no database, Netlify, Stripe, AdSense, DNS, or production state changed.
- Published WORDaVOID WD3 for review as mergeable stacked draft PR #17 above WD1 PR #15.

- Started WORDaVOID WD1 on isolated stacked branch `codex/fix-wordavoid-wd1-validation` with issue #14 after WD0 reached clean draft PR #13.
- Added `@avoid/wordavoid-contract`, generated and hash-locked the 1,770-entry competitive dictionary, and froze ruleset `wordavoid-v1.0.0-rc.1` plus `ascii-lower-v1` normalization.
- Replaced V1 prompt randomness with random-access seed/sequence generation for word, level, difficulty, and angle. Classic and Time Attack now emit spawn, attempt, miss, pause, resume, and competitive terminal evidence.
- Added bounded pure server recomputation for score, completed/missed words, attempted/correct characters, maximum streak, accuracy, WPM, active duration, level, health, and terminal reason. Tests reject changed identity, rules, dictionary, prompts, order/time, input, terminal state, and summaries.
- Extended platform run start with a server-generated WORDaVOID manifest and finish with stored-manifest reconstruction. Browser-authored score/metrics are ignored for WORDaVOID; the route passes only recomputed values into the service-only persistence function while retaining its honest `provisional` label.
- Made the prepared finish transaction idempotent under its existing row lock: a valid retry returns the original submission/leaderboard receipt, while a wrong ticket is rejected before receipt disclosure. Static foundation verification and the 50-assertion pgTAP packet remain intact; executable SQL evidence still waits for the isolated Supabase branch.
- Made all competitive timing pause-aware, reset the animation clock on resume, froze the visible session clock during pause, ignored non-contract keys, kept quit local, and removed fake no-environment Supabase calls from run start.
- Passed the contract dictionary check, 12 contract tests, 15 WORDaVOID tests, 2 platform tests, standalone typecheck/zero-warning lint/build, foundation static verifier, and complete hosted-game/Next.js assembly.
- Browser-checked a narrow rendered viewport and desktop viewport with no horizontal overflow; Classic deterministic prompt rendering; frozen positions and clock while paused; safe resume; Time Attack countdown; and a quiet console. Detailed contract and evidence are in `docs/wordavoid-validation-contract.md` and `docs/sprint-wordavoid-wd1.md`.
- Published the two-commit WD1 review boundary as stacked draft PR #15 above the clean WD0 head; no merge or deployment occurred.
- Started WORDaVOID WD0 on isolated stacked branch `codex/fix-wordavoid-wd0-baseline` with issue #12 after WreckaVOID W5 reached clean draft PR #11.
- Traced all eight advertised WORDaVOID modes. Kept Classic Survival and two-minute Time Attack as the V1 set; classified Perfect Run and Daily Challenge as duplicate Classic behavior and four bespoke modes as partial experiments.
- Added a typed mode/ruleset contract and changed the menu so six deferred experiments have no Start control or ranked promise.
- Extracted and tested the common-word score formula, exact Time Attack duration, character-based accuracy and standardized-character WPM.
- Removed the artificial 60% accuracy floor, added maximum-streak ownership, fixed result/persistent streak reporting, and made replay preserve the selected mode.
- Browser QA at 360 px caught and then verified fixes for a clipped title and difficulty selector. The final 1440 × 900, 360 × 640, 844 × 390, and 320 × 568 menu checks have no horizontal overflow and expose exactly two Start actions plus six deferred labels.
- Time Attack smoke proved the active countdown, Escape pause, Resume state, and a frozen timer across a 1.2-second paused interval.
- Fixed out-of-root Vite output hygiene so stale hashed bundles cannot accumulate into platform deploys; stopped shipping an unreferenced 245,811-byte source screenshot and removed the broken Vite favicon reference.
- Passed WORDaVOID typecheck, zero-warning lint, 2 files / 9 tests, production build, and the complete hosted-game staging plus Next.js build. Detailed evidence is in `docs/sprint-wordavoid-wd0.md`.
- Published WORDaVOID WD0 for review as stacked draft PR #13 above the clean WreckaVOID W5 review boundary.
- Started WreckaVOID W5 on isolated stacked branch `codex/fix-wreckavoid-w5-hardening` with issue #10 while W3 remains gated on the isolated platform data environment.
- Replaced the active 1,500,458-byte PNG with a 31,846-byte WebP, fixed the stale favicon, and added a release budget that passes at 168,404 bytes of compressed HTML/CSS/JavaScript plus WebP against a 204,800-byte limit.
- Bounded React clock presentation to roughly 10 Hz without altering fixed-step simulation time; capped particles at 480 normally and 96 under reduced motion; added a rolling frame monitor for development evidence.
- Added a semantic focus-trapping dialog surface and applied it to help, pause, exit, and results. Corrected a browser-caught double-dialog defect so exit confirmation alone owns focus and its pause reason.
- Added viewport pause ownership: a sub-320 × 320 playfield now freezes behind the support message and restoring size clears only the viewport reason.
- Added a described keyboard-focusable canvas, keyboard-accessible upgrade explanations, global-shortcut exclusion for interactive controls, visible focus treatment, and polite share-status announcements.
- Removed fake no-env Supabase requests so an unconfigured guest build loads without repeated leaderboard errors; old auth and ranked-score activation remain W3/W4 work.
- Added retained-mechanics coverage for boss/projectile, second chain, power-up, pusher, particle, pause, frame, clock, and keyboard paths. Final release verification passed 9 files / 31 tests, typecheck, zero-warning lint, production build, and build budget.
- Browser-verified 1440 × 900, 360 × 640, 844 × 390, and 300 × 300 states; one-dialog focus ownership; narrow results; reduced motion; production smoke-control removal; and quiet no-env reload.
- The 300-frame sample held 16.7 ms average / 16.8 ms p95 / 16.9 ms max with zero 50 ms frames. Forty finish/restart cycles held RAF 1, input 1, timers 0, and one-for-one 41 finishes/restarts; heap settled at 38.43 MB versus a 37.79 MB baseline after decreasing through the second 20-cycle batch.
- Mobile Lighthouse against the production Vite preview scored 98 performance, 100 accessibility, 100 best practices, and 100 SEO, with 1.8 s FCP, 2.1 s LCP, 0 ms TBT, 0 CLS, and 168 KiB transfer.
- Passed the complete hosted-game staging plus normal Next.js build after W5. No production deploy or external-service mutation occurred; detailed evidence is in `docs/sprint-wreckavoid-w5.md`.
- Published WreckaVOID W5 for review as draft PR #11, stacked only on the verified W2 branch so its source and evidence remain independently reviewable.
- Started WreckaVOID W2 on isolated stacked branch `codex/fix-wreckavoid-w2-responsive` with issue #8 after publishing the clean W0/W1 draft PR #7.
- Replaced hard-coded window-height canvas math with rendered-canvas `ResizeObserver` ownership, dynamic viewport/flex layout, visual viewport/orientation synchronization, safe-area padding, pointer clamping, and a readable 320 × 320 minimum-playfield guard.
- Added reason-aware `manual`, `help`, and `focus` pause ownership. Browser smoke proved help cannot resume a manually paused or focus-paused run and focus return clears only its own reason.
- Added six-second in-run coaching, a persisted and accessible procedural audio control with impact/damage/power-up/pause/game-over cues, and reduced-motion suppression for decorative particles/sparks.
- Compactified the game-over surface so Score, Share, Play Again, and Sign In remain visible at 360 × 640 without document overflow.
- Passed WreckaVOID typecheck, lint with zero warnings, 19 focused tests, and production build. Browser-verified 1440 × 900 desktop, 360 × 640 portrait, 844 × 390 live landscape resize, 300 × 300 unsupported guard, pause-reason composition, audio preference persistence, onboarding dismissal, and narrow result layout.
- Passed the complete Netlify build pipeline after W2: VOIDaVOID, WreckaVOID, and WORDaVOID built and staged, then the normal Next.js runtime generated all 21 static pages and retained its dynamic server routes.
- Re-ran 20 terminal/restart cycles after W2; owners remained RAF 1, input 1, timers 0 with one finish and restart per cycle. Recorded evidence in `docs/sprint-wreckavoid-w2.md`.
- Started the first hosted-game repair slice on isolated branch `codex/fix-wreckavoid-v1-baseline`, stacked on the dormant platform foundation rather than editing the dirty main checkout.
- Reproduced WreckaVOID’s misleading baseline: Vite built while standalone TypeScript and lint failed, no tests existed, pusher collisions could crash, enemy movement was applied twice, RAF ownership followed React state churn, lethal score submission was skipped, and mobile controls/HUD were not viable.
- Added a bounded fixed-step clock, stable single RAF owner, one-finish-per-run gate, same-step terminal handling, canonical enemy-physics ownership, corrected retained enemy types, and the pusher collision fix.
- Replaced mouse-only input with scaled Pointer Events and pointer capture, centered initial mobile input, prevented canvas gestures, and added responsive touch pause/help controls with a compact 390 px HUD.
- Passed WreckaVOID standalone typecheck, lint with zero warnings, 14 focused Vitest checks, Vite production build, and locked dependency audit with zero vulnerabilities.
- Browser-verified desktop Play/input/scoring/pause and 390 × 844 Play/touch/pause/help with exact viewport canvas sizing and no horizontal overflow. No gameplay exception was observed; missing local Supabase configuration remains expected and scoring activation remains dormant.
- Added a development-only `?smoke=1` terminal-state seam that production compilation removes, then completed 40 browser-driven Force game over → Play Again cycles. RAF owners remained one, input owners remained one, deferred timers remained zero, and finishes/restarts advanced one-for-one to 41 including calibration.
- Measured the final 20-cycle sample with Chrome Performance metrics: used JS heap moved from 25,379,668 to 23,870,636 bytes, a 1,509,032-byte decrease rather than an accumulation trend. W0 and W1 local exit gates are complete; W2 is next.
- Rebuilt and staged all three hosted games with the repaired Wreck bundle, then passed the normal Next.js runtime production build. The legacy Windows static-export review build still rejects the foundation branch’s dynamic finish API; this pre-existing review-mode incompatibility is recorded rather than bypassed.
- Recorded the repair, device matrix, commands, evidence, remaining W0/W1 exit work, and later-sprint boundaries in `docs/sprint-wreckavoid-w0-w1.md`.
- Corrected the pending platform-foundation migration against the frozen production baseline; the migration remains unapplied to Supabase.
- Replaced the inherited all-table browser grants with a deny-by-default Data API surface. Browser roles retain public catalog/leaderboard reads, owner-scoped profile presentation updates, entitlement/application reads, and owner-scoped favorites only.
- Removed all browser score writes on both canonical and legacy score tables, blocked browser access to manual backup, billing, webhook, run, and submission tables, and reserved run finalization and aggregate updates for `service_role`.
- Preserved the 69-row production migration contract by reclassifying pre-foundation scores as `legacy`, clearing the untrusted `is_verified` flag, and adding a validated trust-consistency constraint rather than deleting history.
- Made new profiles private by default and included the production-gated D-024 conversion of the 15 legacy public profiles to private until their owners opt in.
- Replaced email-derived signup usernames with deterministic non-email handles, retained exactly one signup trigger, removed the score-insert aggregate and leaderboard-name-sync triggers, and fixed trigger-function search paths.
- Added game-key and submission foreign keys, query-path indexes, ruleset versioning, one-use ticket validation, bounded JSON metrics, and service-only run finalization.
- Added `supabase/tests/database/platform_foundation.sql` with 50 pgTAP assertions and `npm run test:foundation` as a fast local structural/security gate.
- Added `docs/sprint-1-foundation-test-plan.md` with synthetic legacy fixtures, direct-write denial tests, one-use run replay tests, app compatibility checks, advisor deltas, rollback rules, and exact Sprint 1 exit evidence.
- Passed the foundation verifier, Sprint 0 frozen-baseline verifier, Prettier, and Git whitespace checks. Docker Desktop and the Supabase CLI are not active locally, so executable SQL remains gated on the approved Supabase development branch.
- Reinstalled the locked dependency graph with zero audit findings, passed the platform type-check, WORDaVOID regression test, and the complete staged VOIDaVOID/WreckaVOID/WORDaVOID plus Next.js production build. The root lint command remains red on pre-existing workspace debt: missing/broken shared and retired-hub ESLint configuration plus legacy TankaVOID, VOIDaVOID, and old `wreck-avoid` findings; those are catalog-game sprint gates rather than migration regressions.
- Published the isolated foundation work as stacked draft PR #4 (`security/platform-foundation-v1` into `security/sprint-0-recoverability`). The commit and pull request contain no production database mutation or secret value.
- Completed the sanitized Sprint 0 recoverability packet at `docs/sprint-0-recoverability.md` without changing production.
- Captured the aVOID Supabase production baseline through read-only metadata and aggregate queries: six public tables, 29 live migrations, 17 public functions, three triggers, 22 security advisories, 17 performance advisories, 15 profiles, and 69 legacy scores.
- Quantified migration drift: 22 live migration versions have no tracked SQL anywhere in the repository, while three tracked versions have not run in production.
- Confirmed all six public tables grant all table privileges to `anon`, `authenticated`, and `service_role`; five anonymous-executable `SECURITY DEFINER` functions and the permissive score policy remain live.
- Classified every existing score as `legacy`, the old `is_verified` field as untrusted, all 15 profiles as public-by-default legacy state, and the manual backup tables as duplicate subsets rather than independent restore points.
- Recorded the exact application rollback commit/deploy, platform/database ownership, independent-domain boundaries, required environment variable names/scopes, and the active auth/score consumers.
- Added `supabase/audit/production-readonly-inventory.sql`, a sanitized frozen JSON baseline, and `supabase/audit/verify-baseline.mjs` so the packet can be checked without exporting player or secret data.
- Supabase reported a development-branch price of `$0.01344/hour` (about `$0.97` for 72 hours). No branch was created; cost confirmation remains approval-gated.
- Exact scheduled-backup/PITR readback remains a production gate because the connector does not expose backup records and the available browser session was not signed in to the Supabase dashboard.
- Started the sustained aVOID V1 completion goal with `docs/V1-COMPLETION-PROGRAM.md` as its source of truth.
- Drafted separate V1 definitions, scope boundaries, sprint sequences, effort ranges, dependencies, and acceptance gates for the main platform, WreckaVOID, WORDaVOID, VOIDaVOID, FLIPSIDE, TankaVOID, and the independent Ideas Realized directory titles.
- Defined a 5-day evidence-based sprint model, separate platform/full-catalog gates, three bounded workstream lanes, approval boundaries, and Sprint 0 as a recoverability packet with no production changes.
- Re-ran TankaVOID type-check and confirmed the prototype has dozens of incompatible engine/entity/system contracts; the program treats it as a narrow rebuild rather than a cosmetic repair.
- Created `codex/docs-v1-completion-program` from the merged production `main` branch. No production, database, Netlify, Stripe, AdSense, or domain state changed in this documentation sprint.
- Audited the live Supabase project and found that clients could insert arbitrary `leaderboard_scores`, including `is_verified = true`; several public `SECURITY DEFINER` functions and permissive policies also need hardening.
- Audited VOIDaVOID, WreckaVOID, WORDaVOID, and the public FLIPSIDE bundle. Confirmed every current score path was browser-authored; WreckaVOID's intended submission was also skipped by its game-over state ordering.
- Designed an incremental platform migration with explicit RLS/grants, membership and entitlement tables, private review queues, run sessions, score submissions, Stripe webhook idempotency, and a service-role-only atomic run-finishing function.
- Added passwordless Supabase authentication, session refresh proxying, editable profiles, opt-in public player pages, social links, and account entitlement visibility.
- Added per-game platform leaderboards with explicit legacy/provisional/validated/verified trust labels.
- Added one-use run-ticket APIs and updated WORDaVOID and WreckaVOID to submit through them. Fixed WreckaVOID's game-over ordering bug and moved its leaderboard read to the canonical score table. Disabled VOIDaVOID's unsafe direct carryover write until its full lifecycle adapter exists.
- Added Stripe-hosted subscription Checkout, Customer Portal, signed webhook verification, retry-safe event storage, subscription reconciliation, and entitlement grant/revocation. Stripe Connect remains deliberately out of the MVP until creator payouts exist.
- Added creator applications and entitlement-gated private game submissions; neither publishes content automatically.
- Added a root `ads.txt` route that returns plain-text 404 without a valid publisher ID and generates the exact standard seller line only from a validated `ca-pub-…` value. No AdSense runtime or ad request was added.
- Read the connected Netlify project's environment inventory without exposing values. It currently contains only the legacy game `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; every server-runtime, Stripe, price, label, site URL, and AdSense variable for the new platform is still absent.
- Passed platform type-check and Next production build, all three staged game builds, and the platform production dependency audit with zero vulnerabilities.
- Kept production, the live database, Stripe charges, AdSense requests, and Netlify environment values unchanged.
- Replaced the overlapping circular Founding Player seal and thin disclaimer pill with a generated meteor collectible, a tactile angled membership ticket, and a container-owned responsive artifact lane.
- Verified the membership section across desktop, laptop, tablet, and phone viewports with no horizontal overflow, no copy/art overlap, no escaped controls, and a clean browser console.
- Received explicit approval to push the reviewed platform candidate live; the production rollout is now in progress while database, Stripe, and AdSense activation remain separately gated.

### Next action

Publish WORDaVOID WD3 for review. Then either execute the documented foundation/WD1 SQL and concurrency matrix after explicit approval of the short-lived Supabase branch, or start the independent VOIDaVOID V0/V1 baseline repair. Do not apply the score-locking migration separately from the platform and staged game deploy.

## 2026-08-19

- Resumed the clean release-candidate worktree at `a13f04d`; the draft PR remains open, mergeable, and clean while the legacy `main` checkout remains intentionally untouched with pre-existing deletions.
- Verified Netlify deploy preview `6a832932124b140008f7ee8d` is still ready, unpublished, attached to PR #1, and serving the exact branch head. Production remains on restored deploy `6980919035d9cae6748f9f58`.
- Confirmed Google AdSense now manages normal subdomains at the root-domain level, so `flipside.avoidgame.io` belongs under the `avoidgame.io` site entry rather than a separate site record.
- Checked the currently signed-in Google account and found it is not associated with an AdSense account; the correct account and publisher ID remain required inputs.
- Audited the release candidate for monetization readiness and found no privacy page, terms page, valid `ads.txt`, consent configuration, or publisher-ID hook.
- Added plain-language privacy and terms routes, reusable legal-page and footer components, sitemap entries, and an environment-validated `google-adsense-account` verification meta tag.
- Kept the AdSense runtime disabled and recorded a directory-only placement rule that excludes active game surfaces.
- Passed the platform type-check, normal Next production build, and complete Windows static-review build with all three staged games.
- Browser-verified `/privacy/` and `/terms/` at desktop and 390 × 844 mobile widths with correct headings, working legal navigation, zero horizontal overflow, and no console warnings or errors.
- Replaced the Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D monograms with direct first-party browser captures of their character select, game menu, and spatial board states; recorded source and usage provenance in `docs/visual-assets.md`.
- Generated one text-free aVOID dimensional atmosphere asset and limited it to a low-opacity external-directory background so it cannot be mistaken for game artwork.
- Added pointer-responsive card tilt and light, tactile hover/press states for launch keys and major CTAs, strong focus treatment, and explicit touch/reduced-motion fallbacks.
- Reduced the four new visual assets to 218.6 KB of WebP output in total.
- Passed the platform type-check and complete static preview build after the visual refresh.
- Browser-verified the refreshed external-game section at 1280 × 800 and 390 × 844, including live image crops, dynamic matrix3d hover response, clean console output, and clipped root overflow on mobile.
- Published draft deploy `6a868dd1cfd3428f743943c7` to the stable `avoid-platform-preview` alias and reverified all three live captures, desktop/mobile overflow, and a clean deployed browser console. Production was not changed.
- Reviewed the live Ideas Realized social rail and verified its X, Instagram, Facebook, and LinkedIn destinations.
- Generated a proposed compact meteor identity from the original aVOID meteor art direction, corrected the generator's baked checkerboard with deterministic alpha extraction, and integrated the mark into the header, footer, manifest, and favicon system.
- Adapted the Ideas Realized social interaction into an aVOID signal dock with darker arcade-hardware styling, per-network accents, hover account reveals, tactile press depth, focus states, and a compact footer presentation.
- Browser-verified the identity at 1280 × 720 and 390 × 844, including social hover state, mobile dock hiding, footer fallback, landmark naming, and zero horizontal overflow.
- Published the combined refresh as draft deploy `6a869202290d729379475257` at the stable `avoid-platform-preview` alias; verified the 512 px meteor asset, SVG icon, legal routes, official social destinations, desktop hover reveal, mobile breakpoint, and clean browser console. Production remains on deploy `6980919035d9cae6748f9f58` at commit `4653e58`.

### Next action

Review the updated Netlify draft preview and proposed meteor identity, then authorize the commit/push and production rollout. The correct AdSense account and publisher identifier remain required before ad verification or activation.

## 2026-08-17

- Audited the existing Vite hub, Netlify configuration, production catalog, related domains, and unfinished tank project.
- Verified live routes for VOIDaVOID, WreckaVOID, WORDaVOID, FLIPSIDE, Bloomfall, Acrolis Crawlers, and ttt3d.app.
- Confirmed TankaVOID is presented as available on the old hub while its playable deployment is missing.
- Inspected the Ideas Realized Next.js design system and carried forward its strongest navigation, typography, mobile, motion, and CTA patterns.
- Built the isolated Next.js 16 shell in `apps/platform`.
- Added the typed game catalog and explicit `playable`, `external`, and `soon` states.
- Verified desktop and 390 × 844 mobile layouts, mobile navigation, native game rails, Tanka non-interactivity, reduced-motion support, and a clean browser console.
- Passed platform TypeScript and production builds.
- Committed the shell as `89556ca` and the architecture record as `31868c4`.
- Created the sustained delivery goal and formalized the charter, approval gates, and milestones.
- Researched Playdate Catalog, Apple Arcade, Epic Games Store, Xbox Game Pass, IndieList, and Gamoola for interaction and visual-system references.
- Generated six aVOID-specific desktop/mobile concept boards in `design/mockups` and recommended a hybrid of the editorial, tactile-hardware, and disciplined-terminal directions.
- Updated the platform to Next.js 16.3.1 and React/React DOM 19.2.8; the platform production dependency audit now reports zero vulnerabilities.
- Preserved VOIDaVOID, WreckaVOID, and WORDaVOID as independent Vite builds staged into the Next shell with validated, allowlisted copy targets.
- Repointed hosted catalog entries to same-origin `/voidavoid/`, `/wreckavoid/`, and `/wordavoid/` routes.
- Linked the worktree to the existing Netlify site without changing production.
- Diagnosed a Windows-only Netlify adapter bug that emitted escaped `\\var\\task` imports into the generated Lambda handler.
- Added an explicit static-export review mode for local Windows draft deployments while retaining the normal Next runtime configuration for Netlify's Linux production builds and future server features.
- Deployed and verified draft `6a830b9207ce5828543731a7` at `https://avoid-platform-preview--coruscating-squirrel-a47ad9.netlify.app`.
- Confirmed HTTP 200 for the shell, all three bundled games, robots, sitemap, FLIPSIDE, Bloomfall, Acrolis Crawlers, and ttt3d.app.
- Folded the recommended visual blend into the production candidate: editorial hierarchy, tactile launch controls, darker terminal-grid catalog surfaces, live directory telemetry, and a higher-contrast two-color wordmark.
- Replaced the CSS hero background with a priority `next/image` asset so the normal Netlify runtime can optimize the production LCP image.
- Found and fixed static-review artwork failures by disabling Next image optimization only when `AVOID_STATIC_EXPORT=1`; direct artwork URLs now return HTTP 200.
- Recovered FLIPSIDE's public social artwork from its verified domain and added it to the hosted catalog.
- Verified the refined 390 × 844 mobile composition using an isolated iframe viewport and checked the complete semantic tree at that width.
- Raised small-action contrast to measured ratios of 6.27:1 for primary controls, 5.12:1 and 4.52:1 for the brand colors, and 7.48:1 for external-card actions.
- Deployed refined draft `6a830fc14c35c43909a37982` at `https://avoid-platform-preview--coruscating-squirrel-a47ad9.netlify.app`.
- Reverified HTTP 200 for the shell, four catalog artworks, three bundled games, robots, sitemap, and all four external game domains.
- Added immutable one-year caching for hashed Next and game-build assets, plus one-day caching with one-week stale revalidation for mutable catalog artwork.
- Deployed caching-verified draft `6a83109532cefed8bede8fe4`; live response headers match the intended policies.
- Pushed `codex/feature-next-platform-shell` to `Idea-R/aVOIDhub` and opened draft PR `#1`; `main` and production remain untouched.
- Removed the single-use Framer Motion runtime from the platform shell and replaced it with a progressive native CSS reveal that preserves reduced-motion behavior.
- Reduced initial review-build CSS/JS from 708.6 KB raw / 219.5 KB gzip to 592.2 KB raw / 181.9 KB gzip, saving 116.4 KB raw and 37.6 KB gzip (about 17.1%).
- Deployed the native-motion revision as draft `6a83129b27906932b1a037d2` at the stable review alias.
- Reverified the public shell, three bundled game routes, robots, sitemap, four catalog artworks, and all four external game domains; every request returned HTTP 200.
- Confirmed the live browser supports the native view-timeline reveal, the scrolled reveal resolves to full opacity with no transform, and the hero artwork is loaded.
- Audited the full monorepo dependency graph and found high-severity advisories in unused VOIDaVOID blob code and WreckaVOID router code, plus stale development bundlers.
- Removed the unused `@vercel/blob` and WreckaVOID router dependencies, updated the retired hub's used router, and moved the hub, VOIDaVOID, and WreckaVOID to Vite 8.2.1 with the matching React plugin.
- Reconstructed VOIDaVOID's incomplete package manifest so its React, Supabase, icon, TypeScript, lint, and Vite imports are declared by the workspace that uses them.
- Updated WORDaVOID to Vitest 4.1.10, separated its Supabase client from the browser entrypoint, removed the duplicate player reset key, and added a passing regression test for reset state.
- Migrated WreckaVOID from removed object-style `manualChunks` behavior to Vite 8/Rolldown code-splitting groups.
- Reduced VOIDaVOID's production JavaScript from 544.20 KB / 142.68 KB gzip to 425.60 KB / 112.28 KB gzip.
- Refreshed Browserslist compatibility data without changing target browsers; the complete production and development npm audit now reports zero vulnerabilities.
- Confirmed TankaVOID is still a non-buildable prototype with incompatible gameplay APIs; it remains deliberately unlinked and excluded from the staged platform games.
- Caught a blank WORDaVOID page in the live browser after the first Vite 8 preview despite successful builds and HTTP checks; isolated the incompatibility to React plugin 5/6 and pinned that workspace to Vite 7.3.6 with plugin 4.7.0.
- Rebuilt and deployed corrected draft `6a83193487024b29b1019126`; browser runtime checks confirm the platform shell, VOIDaVOID canvases, WreckaVOID start screen, and WORDaVOID mode selector all render.
- Replaced opacity-based scroll reveals with transform-only motion and corrected the remaining muted label colors to WCAG AA contrast.
- Made the animated Play/Publish split control expose a real background on its active half so automated and assistive tooling can resolve the intended contrast.
- Converted the six platform hero/catalog images from 7.92 MB of PNG sources to 560 KB of display-sized WebP assets, a 92.9% transfer reduction while retaining the PNG originals in repository history.
- Deployed release-candidate draft `6a831c7d3c4ff63feb510e5c` and verified the optimized shell in a live browser.
- Refreshed the draft configuration as deploy `6a831d22a694d2419845f423`; the stable preview alias now serves the WebP hero with the intended one-day cache and one-week stale revalidation policy.
- Captured public Lighthouse 13.4.1 evidence: mobile 96 performance / 100 accessibility / 100 best practices / 100 SEO, with 1.6 s FCP, 2.2 s LCP, 30 ms TBT, and 0 CLS; desktop 99 / 100 / 100 / 100, with 0.3 s FCP, 0.6 s LCP, 20 ms TBT, and 0 CLS.
- Inspected the Git-connected Netlify deploy path and found that PR deploy `6a831d8c3a2383000810412a` failed because the former `apps/platform` base directory installed only that workspace before trying to build sibling Vite games.
- Moved the Netlify build command and dependency installation to the monorepo root, retained `apps/platform` as the package directory, and made the bundled Next runtime explicit so Netlify processes `.next` instead of uploading it as an ordinary directory.
- A legacy Netlify build API call ignored its requested branch and rebuilt the existing `main` commit as production. It never published the candidate; the exact prior production deploy `6980919035d9cae6748f9f58` was immediately restored and the normalized live HTML was verified against its immutable permalink.
- Verified the final Git-driven Linux deploy preview `6a83220801143400082cd2b0` at commit `1f38533c218d637db5d4cff523a74c9f89e19712`: the Next runtime completed successfully, deployed its server handler, processed all redirects and headers, and reported zero secret-scan findings.
- Reverified the Linux preview shell and routes over HTTP, then confirmed VOIDaVOID renders two canvases, WreckaVOID renders its five-button start experience, and WORDaVOID renders its 16-button mode selector. Production remains on the restored February deploy.
- Added a generated SVG application icon, install manifest, canonical metadata, Ideas Realized structured data, and sitemap entries for all three same-origin playable routes; no unverified Instagram account was invented.
- Moved WORDaVOID's Tone audio engine behind the first real user gesture and its Supabase leaderboard client behind score submission, reducing initial JavaScript from 1,004.08 KB / 259.32 KB gzip to 547.68 KB / 140.86 KB gzip (45.5% raw and 45.7% gzip) while preserving both deferred features.
- Browser-tested the optimized WORDaVOID menu, game launch, deferred Tone load, and audio initialization; added accessible names to its audio, pause/resume, and end-game HUD controls.
- Cleared WORDaVOID's 31 legacy lint errors and five hook warnings with behavior-preserving typing and dead-code cleanup; lint, type-check, tests, production build, and live gameplay verification now all pass.

### Evidence

- `npm run typecheck --workspace=@avoid/platform`
- `npm run build:platform`
- `npm run build:platform:netlify`
- `npm run build:platform:preview`
- `npm audit --omit=dev --workspace=@avoid/platform`
- Public HTTP route and cache-header verification against deploy `6a83129b27906932b1a037d2`
- `npm audit`
- `npm run type-check --workspace=@avoid/word-avoid`
- `npm test --workspace=@avoid/word-avoid -- --run`
- Independent supported-toolchain builds for the hub, VOIDaVOID, WreckaVOID, and WORDaVOID
- Public Lighthouse mobile and desktop audits against deploy `6a831c7d3c4ff63feb510e5c`
- Git-driven Netlify Linux deploy preview `6a83220801143400082cd2b0`
- Generated `/icon.svg`, `/manifest.webmanifest`, and four-entry `/sitemap.xml` in the static release build
- WORDaVOID optimized build output plus live menu/game/audio browser verification
- `npm run lint --workspace=@avoid/word-avoid`
- `docs/platform-rebuild.md`

### Current gate

The coordinated Supabase foundation remains unexercised until the user approves or declines the proposed 72-hour paid development branch. Production deploys and merges remain intentionally unchanged.

### Next action

Publish WD1 for review. Then either run the documented foundation/WD1 SQL and concurrency matrix after explicit approval of the short-lived Supabase branch, or continue the independent WD3 input/focus/reduced-motion/repeat-run hardening slice. Production activation remains gated.

## 2026-08-20 — VOIDaVOID V4 experience hardening

- Created isolated branch `codex/fix-voidavoid-v4-hardening` from reviewed V2 commit `03b05a2`; production and the V2 branch stayed untouched.
- Opened issue `#22` for the bounded local V4 scope.
- Added local procedural sound that creates one context only after a player gesture, persists mute, retries a blocked context, tracks/ends voices, and closes on real page teardown.
- Added versioned sound/motion preferences and made both the OS reduced-motion request and the explicit Reduced choice suppress canvas effects without changing V2 gameplay or evidence.
- Added one-owner semantic dialogs, focus containment, focus return, named canvas instructions, and removed the 200 ms live-score announcement stream.
- Enforced particle ceilings and a release budget that rejects more than 140 KiB initial transfer, more than 320 KiB JavaScript, or any downloaded audio file.
- Found and repaired a first-frame FPS bug that degraded every run because it compared the first animation timestamp with zero.
- Passed 63-file zero-warning lint, 30 tests, standalone/full-platform builds, and an 83,328-byte initial-transfer measurement with zero audio files.
- Browser-checked 390×844, 844×390, 768×1024, 1440×900, and 1920×1080 with no horizontal overflow; dialog focus wrap/return and accessible names passed with a quiet console.
- Recorded five 60 FPS / 16.67 ms desktop samples and a 20-cycle sample with 20 unique replayable-local codes, five pointer listeners, one audio context, zero terminal voices/frames, and a 571,440-byte raw heap decrease.
- Published the two-commit V4 review boundary as stacked draft PR `#23` above VOIDaVOID V2 PR `#21`; no merge or deployment occurred.
- Kept physical-device certification, a formal deployed audit, platform V3, Supabase, Netlify production, Stripe, AdSense, DNS, and rollback proof outside this slice.

### Next action

Review stacked draft PR `#23` and keep physical-device/deployed checks as explicit release gates. The next code dependency is V3/platform data work after the isolated Supabase branch is approved.
