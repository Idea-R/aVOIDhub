# aVOIDgame.io worklog

## 2026-08-20

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
- Built the Sprint P3 canonical eight-title registry and `/games/[slug]/` detail architecture on an isolated branch based on the frozen Sprint 0 baseline.
- Changed every playable directory card to open its first-party detail page before Play; preserved `/voidavoid/`, `/wreckavoid/`, and `/wordavoid/` as focused game routes.
- Added explicit subdomain and independent-domain handoffs for FLIPSIDE, Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D without claiming shared identity, purchases, progression, or scores.
- Kept TankaVOID's directory card noninteractive and gave its direct detail route an honest, non-clickable “No playable build yet” state.
- Added unique metadata, VideoGame structured data, sitemap entries, real captures, controls, device guidance, current-build notes, score/account boundary copy, and a deliberately staged platform-board state.
- Removed an early server-wide leaderboard preview read from P3. Live boards and personal bests now wait for P5's restricted, moderation-aware public read model instead of using the administrative database client on a public page.
- Added `test:catalog`, which verifies all eight IDs and details, seven real play destinations, the three stable hosted routes, independent score boundaries, and TankaVOID's no-play contract.
- Passed platform type-check and the complete Netlify platform/game build; the dependency audit remains at zero vulnerabilities.
- Browser-verified all eight detail routes at tablet size, representative desktop and 390 px phone layouts, zero horizontal overflow, the external-domain target behavior, and TankaVOID's lack of a Play action.
- Committed Sprint P3 as `eeaaadc`, pushed `codex/feature-game-detail-surfaces`, and opened stacked draft PR #5 against `security/sprint-0-recoverability`. Nothing was merged or deployed.

### Next action

Package Sprint P3 as a stacked draft PR for review. Do not merge or deploy it yet. The separate Sprint 1 database branch test remains gated by cost approval; do not apply the score-locking migration separately from the platform and staged game deploy.

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
