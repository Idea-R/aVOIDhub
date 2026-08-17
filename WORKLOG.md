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
- Removed the unused `@vercel/blob` and WreckaVOID router dependencies, updated the retired hub's used router, and moved all five web workspaces to Vite 8.2.1 with the matching React plugin.
- Reconstructed VOIDaVOID's incomplete package manifest so its React, Supabase, icon, TypeScript, lint, and Vite imports are declared by the workspace that uses them.
- Updated WORDaVOID to Vitest 4.1.10, separated its Supabase client from the browser entrypoint, removed the duplicate player reset key, and added a passing regression test for reset state.
- Migrated WreckaVOID and WORDaVOID from removed object-style `manualChunks` behavior to Vite 8/Rolldown code-splitting groups.
- Reduced VOIDaVOID's production JavaScript from 544.20 KB / 142.68 KB gzip to 425.60 KB / 112.28 KB gzip and split WORDaVOID's former 1.10 MB monolith into cacheable chunks no larger than 345.26 KB.
- Refreshed Browserslist compatibility data without changing target browsers; the complete production and development npm audit now reports zero vulnerabilities.
- Confirmed TankaVOID is still a non-buildable prototype with incompatible gameplay APIs; it remains deliberately unlinked and excluded from the staged platform games.

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
- Independent Vite 8 builds for the hub, VOIDaVOID, WreckaVOID, and WORDaVOID
- `docs/platform-rebuild.md`

### Current blocker

The required Chrome DevTools performance-trace MCP is disabled, so Core Web Vitals evidence is still pending. A paid PageSpeed fallback was found but not invoked because paid resources require explicit approval. Production remains intentionally unchanged until performance evidence and rollout approval are complete.

### Next action

Review the refined draft, capture the final Core Web Vitals trace when an approved trace path is available, resolve any material findings, then request production approval.
