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

### Evidence

- `npm run typecheck --workspace=@avoid/platform`
- `npm run build:platform`
- `npm run build:platform:netlify`
- `npm run build:platform:preview`
- `npm audit --omit=dev --workspace=@avoid/platform`
- `docs/platform-rebuild.md`

### Current blocker

The required Chrome DevTools performance-trace MCP is disabled, so Core Web Vitals evidence is still pending. A paid PageSpeed fallback was found but not invoked because paid resources require explicit approval. Production remains intentionally unchanged until performance evidence and rollout approval are complete.

### Next action

Capture the final Core Web Vitals trace, resolve any material findings, then request production approval.
