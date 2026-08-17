# aVOIDgame.io decisions

## D-001 — Rebuild the platform shell in Next.js

- Date: 2026-08-17
- Status: accepted
- Owner: Ideas Realized

Use a side-by-side Next.js 16 App Router application for the platform shell. Keep individual games as independent builds. This gives the hub server-rendered metadata and a safe path to server-side auth, billing, and creator tools without rewriting working games.

## D-002 — Preserve game ownership boundaries

- Date: 2026-08-17
- Status: accepted

aVOID originals may participate in shared platform features once integrated. Bloomfall, Acrolis Crawlers, and Tic Tac Toe in 3D remain “Other games by Ideas Realized,” keep their domains, and do not promise shared leaderboards.

## D-003 — Treat TankaVOID as coming soon

- Date: 2026-08-17
- Status: accepted

TankaVOID remains visible for discovery but has no link or button until a verified deployment exists. The recovered source in `C:\dev\TankAVOIDz` is preserved for a later rebuild.

## D-004 — Use selective motion

- Date: 2026-08-17
- Status: accepted

Start with CSS and Framer Motion. Do not combine Lenis, GSAP, and WebGL by default. A single ambient canvas or WebGL hero effect may be added only after it earns its performance cost and respects reduced-motion preferences.

## D-005 — Preview before production

- Date: 2026-08-17
- Status: accepted

Netlify draft deployment and route verification precede any production switch. Preserve the current live site as the rollback target until the new deployment is approved.

## D-006 — Keep monetization inactive in milestone one

- Date: 2026-08-17
- Status: accepted

Membership, cosmetics, creator hosting, and AdSense may be designed and architected, but no checkout, ad inventory, creator submission, or paid promise goes live in the first shell milestone.

## D-007 — Use a static export only for Windows-built review deploys

- Date: 2026-08-17
- Status: accepted

Netlify Next Runtime 5.15.13 generated invalid Lambda import paths when the monorepo draft was built locally on Windows. Use `AVOID_STATIC_EXPORT=1` for Windows CLI review deploys. Keep the normal Next runtime build as the default for Netlify's Linux production pipeline and future server-side platform features.

## D-008 — Take security updates without forcing unrelated breaking migrations

- Date: 2026-08-17
- Status: accepted

Move the platform to Next.js 16.3.1 and React 19.2.8 to clear known production advisories. Hold TypeScript 7, Framer Motion 13, Lucide 1.x, and Node type 26 migrations until each can be isolated and verified on its own merits.

## D-009 — Build the production candidate from directions 01, 05, and 06

- Date: 2026-08-17
- Status: accepted as working direction pending user review

Combine the editorial hierarchy of direction 01, the physical launch-control language of direction 05, and the restrained telemetry and grid linework of direction 06. Avoid fake leaderboards, fake profile activity, and decorative controls that imply unavailable functionality.

## D-010 — Modernize the buildable games without presenting TankaVOID as finished

- Date: 2026-08-17
- Status: accepted

Move the active Vite workspaces to Vite 8 and the matching React plugin, remove unused vulnerable runtime dependencies, and keep the complete dependency audit clean. Preserve TankaVOID's source for a later rebuild, but do not stage or link it: its recovered prototype currently has incompatible gameplay APIs and does not pass TypeScript compilation.
