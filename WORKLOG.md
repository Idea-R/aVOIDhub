# aVOIDgame.io worklog

## 2026-08-23

- Audited the canonical `games/wrecka-void` source and the live production route as the first full game-repair target.
- Recorded a live desktop guest run that started, moved, scored, collected a power-up, reached wave 3, and ended at 68 seconds with score 364 near the first boss transition.
- Verified that the 390 px gameplay route has no page overflow but the 40 px HUD overlaps score, wave, time, help, and guest status; the input manager has no Pointer Events or touch path.
- Quantified the current enemy curve: 1.39 spawns per second at wave 1, 2.5 at wave 5, and a 3.33-per-second floor from wave 7 onward, with no active population cap and unbounded speed growth.
- Confirmed that ordinary enemies are advanced twice per frame, boss contact can apply 30 damage every frame, collision result indices are not de-duplicated, the pusher path reads a value before declaration, bosses accumulate every 60 seconds, and boss fire cooldown eventually reaches zero.
- Confirmed that Vite production build passes, standalone TypeScript validation fails with engine and typing defects, lint reports 29 errors and three warnings, and WreckaVOID has no tests.
- Added `games/wrecka-void/docs/V1-DELIVERY-PLAN.md` with a bounded V1 charter, ten-minute Wreck Run, optional Endless Yard, balance laboratory, measurable targets, W0 through W7 delivery sequence, effort range, and production acceptance checklist.
- Kept gameplay code, production, Supabase, Netlify, authentication, score data, payments, advertising, and domain state unchanged during the planning pass.

### Next action

Start W0 locally: freeze the current values as a legacy ruleset, add seeded randomness and failing tests for the critical correctness defects, then create the first deterministic balance comparison before changing production rules.

## 2026-08-20

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

Review the Sprint 1 migration and `docs/sprint-1-foundation-test-plan.md`, then approve or decline the 72-hour Supabase development branch at the last verified `$0.01344/hour` (about `$0.97`). Do not apply the score-locking migration separately from the platform and staged game deploy.

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

The production deploy and merge remain intentionally unchanged until the user reviews the release candidate and explicitly approves rollout.

### Next action

Review the refined draft, then approve or request changes before the production deploy and merge.

## 2026-08-20 — Player and Creator membership contract

- Opened issue `#38` and created isolated branch `codex/feature-membership-creator-contract` from the exact reviewed platform-foundation head `f1976f2`.
- Defined Free Player, Founding Player, and Creator offers in `docs/membership-creator-v1.md`, including cosmetic, advertising, subscription, hosting, and future payout boundaries.
- Kept ordinary accounts, profiles, favorites, play, and eligible leaderboards free. Paid benefits remain comfort, identity, cosmetics, early access, and creator capacity—never score or gameplay power.
- Made creator application free and separated review approval from subscription entitlement. Creator checkout and private game submission now require approved status; game submission additionally requires an active `creator.submit_game` entitlement.
- Removed paid `creator.profile` from the plan mapping so payment cannot create approval or publication. Added the supporter-cosmetic entitlement promised by the Player offer.
- Added focused pure eligibility tests plus database/static assertions that paid plans do not grant creator approval.
- Rewrote membership and creator-intake copy around observable requirements, private review, hosting lanes, and honest live-vs-planned boundaries.
- Consulted the current Supabase changelog before implementation. The Data API exposure change is already handled by explicit grants; current Node 22 and TypeScript versions satisfy the announced client-library requirements.
- Passed seven focused eligibility tests, platform type-check, the 52-assertion foundation verifier, and the complete 21-route Next production build.
- Browser-verified the membership and creator-intake pages at 390 × 844 and 1440 × 900 with no horizontal overflow, visible overlap, or console warning/error.
- Pushed commit `cadf7ca` and opened stacked draft PR `#39` above `security/platform-foundation-v1`; production remains unchanged.
- Confirmed Netlify had not produced Git-driven previews for PR #37 or #39. A direct Windows Netlify runtime build reproduced the known adapter trace bug, resolving `@swc/helpers` above the worktree.
- Published a deliberately static, non-production feedback deploy `6a8774281ba9d8a5d0370ddc` at `https://membership-review-39--coruscating-squirrel-a47ad9.netlify.app`; accounts, checkout, API routes, ads, and migrations remain inactive there.
- Verified HTTP 200 for the review shell, membership, creator intake, and all three bundled games. Live browser checks confirmed the correct membership/creator copy, disabled transaction and application controls, no console warning/error, and no mobile overflow at 390 × 844.
- No Supabase branch or migration execution, Stripe Product/Price, charge, AdSense request, creator publication, payout, DNS change, or production deploy occurred.

### Next action

Exercise test-mode Stripe subscription and cosmetic fulfillment plus executable database acceptance once the non-production resources are approved. AdSense activation remains a separate gated step.

## 2026-08-20 — Role-aware platform workspaces

- Opened issue `#40` and created isolated branch `codex/feature-platform-role-dashboards` from the membership/creator contract head.
- Rebuilt `/login/` as a branded signal gate with a validated local return path and one passwordless identity across player, creator, and admin surfaces.
- Rebuilt `/account/` as a player deck for owned profile, accepted-run and favorite counts, entitlements, membership, creator state, and profile editing.
- Added `/creators/dashboard/` with an explicit application → review → membership → private-submission sequence and owned submission inventory.
- Gated `/creators/submit/` at the page boundary as well as the API boundary; only approved creators with an active `creator.submit_game` entitlement can reach the live form.
- Added `/admin/` with creator, game, score-integrity, and membership signals plus real review controls.
- Added `/api/admin/review` with same-origin enforcement, authenticated user validation, server-controlled app-metadata authorization, whitelisted transitions, and an optimistic concurrency check.
- Kept review approval separate from publication, deploys, payments, entitlements, ads, and deletion.
- Reused the existing generated orbital depth field as the common control-room atmosphere. Built responsive tactile controls in HTML/CSS instead of generating fixed-size button images.
- Updated shared platform-page hero composition and global navigation so login, accounts, creator pages, membership, leaderboards, policy pages, and the new operations surfaces share the same identity.
- Added 12 focused role, return-path, and admin-transition tests; the platform suite now passes 19 tests.
- Passed platform type-check and the 24-route Next production build.
- Browser-reviewed every platform-owned route at 768 × 900 and 390 × 844 with no horizontal overflow or undersized visible buttons. Visually reviewed login, account, creator, and admin surfaces at desktop and phone widths; no console warning or error was present.
- The static-export review command remains blocked by the existing dynamic run-finish API and is not the correct build shape for authenticated server routes. Production remains unchanged.
- Pushed commits `fdd6452` and `90a347f`, then opened stacked draft PR `#41` against the membership/creator contract branch.
- The direct Windows Netlify runtime build reproduced the known `@swc/helpers` trace failure after the complete application build passed.
- Built a temporary static feedback package with API, callback, dynamic player, and ads routes absent and all role surfaces forced into their explicit runtime-disconnected states.
- Published non-production deploy `6a878bfb69cf762ff5930039` at `https://role-dashboard-review-41--coruscating-squirrel-a47ad9.netlify.app/`.
- Verified HTTP 200 for the shell, login, account, creator application/workspace/submission, membership, leaderboards, admin, privacy, terms, and all three bundled game routes. Public mobile browser QA found no overflow or console warning/error.
- Confirmed production remains deploy `6a86af420792ac00081b14a3`.

### Next action

Publish the branch as a draft PR and non-production Netlify runtime preview, then exercise authenticated player, creator, and admin paths against approved non-production Supabase fixtures before any production role assignment or migration.

## 2026-08-20 — Creator rhythm and opening run

- Reworked `/creators/apply/` around an explicit spacing hierarchy so the workflow cards, application form, requirements, and publication boundary no longer run together.
- Added tactile lime, orange, and dark icon blocks to creator intake and requirements without introducing fixed-size bitmap controls.
- Added a session-scoped landing-page opening run with falling meteors, shards, and blocks; a dodging player marker; rising score; final collision; and an impact-to-page reveal.
- Added an always-available replay control plus skip, Escape, focus, and reduced-motion behavior. Repeat navigation in the same browser session does not replay automatically.
- Browser-checked the new creator rhythm and opening sequence at 1440 × 1000 and 390 × 844 with no horizontal overflow.

### Next action

Publish the refreshed static feedback build on the existing draft PR, then collect reaction to the motion timing before adding game-specific intro variants.
