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

Move the buildable workspaces to the newest toolchain that passes both compilation and browser runtime checks, remove unused vulnerable runtime dependencies, and keep the complete dependency audit clean. Use Vite 8 for the hub, VOIDaVOID, and WreckaVOID. Keep WORDaVOID on Vite 7.3.6 with React plugin 4.7 because newer plugin generations compile but leave its current application blank at runtime. Preserve TankaVOID's source for a later rebuild, but do not stage or link it: its recovered prototype currently has incompatible gameplay APIs and does not pass TypeScript compilation.

## D-011 — Ship display-sized WebP artwork in addition to source PNGs

- Date: 2026-08-17
- Status: accepted

Use pre-compressed WebP assets for the platform hero and catalog cards so the Windows static-review build does not depend on Next's runtime image optimizer. Keep the original PNG source assets available for future art direction and regeneration. The release candidate reduces the six requested images from 7.92 MB to 560 KB while the normal Netlify Next runtime remains free to optimize them further.

## D-012 — Build the Netlify site from the monorepo root

- Date: 2026-08-17
- Status: accepted

Install dependencies and run the platform/game build orchestration from the repository root so every npm workspace receives its declared tools. Keep `apps/platform` as Netlify's package directory, publish `apps/platform/.next`, and declare the bundled Next runtime explicitly because this pre-existing site's framework detector otherwise treats the root workspace as an unknown framework. This arrangement is verified by the Git-driven Linux deploy preview at commit `1f38533`.

## D-013 — Treat AdSense as domain-level infrastructure, not game UI

- Date: 2026-08-19
- Status: accepted working rule pending account confirmation

Use the approved `avoidgame.io` root-domain entry for normal aVOID subdomains. Add privacy and terms surfaces before ad activation, verify the account through an environment-provided publisher ID, publish the matching root `ads.txt`, and configure a Google-certified consent flow where required. Ad placements may appear only on calm platform-directory surfaces; never overlay active gameplay, controls, pause states, or game-over actions.

## D-014 — Use direct game captures and restrained physical depth

- Date: 2026-08-19
- Status: accepted working direction pending preview review

Represent separately hosted Ideas Realized games with direct captures from their own live properties, label them as live-site captures, and preserve their independent-domain language. Use generated art only as non-representational atmosphere. Let cards respond to pointer position with shallow tilt and moving light; give links and CTAs distinct hover and pressed states; disable the effect for touch-only and reduced-motion contexts.

## D-015 — Build the identity around the aVOID meteor

- Date: 2026-08-19
- Status: proposed working direction pending owner review

Use a compact cyan-rimmed, orange-tailed meteor as the platform mark so the identity connects to the original aVOID artwork and survives favicon scale. Pair it with the existing aVOIDgame.io wordmark. Adapt Ideas Realized's social-rail behavior into an aVOID-specific signal dock with darker arcade hardware, verified official destinations, hover reveals, tactile press depth, keyboard focus, and a compact footer fallback on smaller screens.

## D-016 — Separate authenticated scores from verified scores

- Date: 2026-08-20
- Status: accepted

Authentication proves who submitted a score, not how the score was earned. Replace direct browser inserts with short-lived one-use run tickets and a service-role-only finishing transaction. Label current browser-reported runs `provisional`. Reserve `verified` for runs the platform can independently recompute or replay.

## D-017 — Use Billing before Connect

- Date: 2026-08-20
- Status: accepted for MVP

Use Stripe Billing, hosted Checkout, signed webhooks, database entitlements, and Customer Portal for player and creator memberships. Do not introduce Stripe Connect until the product has an approved reason to route game sales or revenue share to creators. Membership can unlock ad-free platform pages and creator workflow; it cannot improve scores or game outcomes.

## D-018 — Moderate creator content before publication or ads

- Date: 2026-08-20
- Status: accepted

Creator applications and game submissions enter a private review queue. Profiles, games, leaderboards, and monetization are activated independently after ownership, content, security, and technical review. Pending, rejected, empty, login, checkout, and administration surfaces never carry ads.

## D-019 — Keep decorative artifacts inside responsive layout lanes

- Date: 2026-08-20
- Status: accepted

Do not pin seals, badges, or decorative controls over responsive copy. Give prominent artifacts their own grid lane and let them stack naturally on small screens. Use asymmetrical collectible shapes, shallow perspective, tactile press depth, and transform-based motion with reduced-motion fallbacks instead of generic thin circular badges or disclaimer pills.

## D-020 — Use separate platform detail and immersive play routes

- Date: 2026-08-20
- Status: proposed for V1 program review

First-party catalog cards should open `/games/<slug>/` pages with controls, status, scores, personal best, favorites, share, and a clear Play action. Preserve the current immersive routes for bookmarks and focused play. External titles must state the destination domain and cannot imply shared account or leaderboard behavior.

## D-021 — Give every title its own V1 gate

- Date: 2026-08-20
- Status: accepted as program structure

Platform V1, full-catalog V1, and individual game V1 are separate milestones. WreckaVOID, WORDaVOID, VOIDaVOID, FLIPSIDE, and TankaVOID each carry their own current-state evidence, sprint sequence, trust boundary, effort range, and acceptance checks in `docs/V1-COMPLETION-PROGRAM.md`. A working URL does not satisfy a title’s V1 gate.

## D-022 — Rebuild TankaVOID around the combat idea, not every prototype system

- Date: 2026-08-20
- Status: proposed for V1 program review

Preserve the prototype in history, then build a clean fixed-step vertical slice around deliberate hull movement, turret aim, directional armor, impact angle, and readable damage. Do not make multiplayer, campaign progression, infantry, every pickup, or every prototype boss a V1 requirement.
