# aVOIDgame.io worklog

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
- `docs/platform-rebuild.md`

### Current gate

The production deploy and merge remain intentionally unchanged until the user reviews the release candidate and explicitly approves rollout.

### Next action

Review the refined draft, then approve or request changes before the production deploy and merge.
