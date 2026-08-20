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

## D-023 — Treat every existing leaderboard row as legacy

- Date: 2026-08-20
- Status: accepted as the migration contract

Preserve all 69 production score rows, but do not carry the client-era `is_verified` claim into V1 competition. The coordinated migration must set `verification_level = 'legacy'` and clear `is_verified` on every existing row. Legacy rows may appear only in surfaces that label them plainly and keep them separate from provisional, validated, and verified results.

## D-024 — Make profile publication an explicit choice

- Date: 2026-08-20
- Status: proposed for production migration approval

New profiles default to private. The 15 existing profiles are all public under a legacy default, which is not proof of an intentional privacy choice. The proposed migration preserves every profile but makes existing profiles private until their owners publish them. Grandfathering current visibility is the alternative and requires an explicit decision before production migration.

## D-025 — Test the foundation on a short-lived paid database branch

- Date: 2026-08-20
- Status: proposed; cost approval required

Use a Supabase development branch cloned from the production schema, synthetic data only, and a 72-hour initial lifetime. The current reported price is `$0.01344/hour`, or about `$0.97` for 72 hours. Do not create or extend the branch without confirming the current cost. Capture evidence and delete the branch after the test window unless an extension is approved.

## D-026 — Record environment ownership without exporting secret values

- Date: 2026-08-20
- Status: accepted

Project records may contain environment variable names, exposure class, context, and owning service. They must not contain secret values, tokens, private keys, webhook secrets, database passwords, or copied Netlify environment exports. Release verification checks presence and scope in the owning service without pasting values into Git or review logs.

## D-027 — Deny browser data writes unless the workflow is deliberately client-owned

- Date: 2026-08-20
- Status: accepted for the Sprint 1 foundation

Revoke inherited table and function privileges from `anon` and `authenticated`, then grant back the smallest documented surface. Score, run, billing, webhook, entitlement mutation, creator application, and game submission writes belong to authenticated server routes. Profile presentation fields and owner-scoped favorites may remain direct client writes because both column grants and RLS constrain them. Manual backup tables have no browser access.

## D-028 — Version every ranked ruleset

- Date: 2026-08-20
- Status: accepted for the Sprint 1 foundation

Every new run session and score submission records a bounded ruleset version. The atomic finishing transaction copies game, mode, user, and ruleset identity from the locked server-created run rather than accepting those values from the finishing client. A leaderboard may compare results only within a compatibility rule defined by the game; a future balance or scoring change cannot silently share a ranking with an incompatible ruleset.

## D-029 — Stabilize WreckaVOID before replacing its feel

- Date: 2026-08-20
- Status: accepted for W0/W1

Keep `games/wrecka-void` as the canonical WreckaVOID runtime. Preserve its recognizable chain-and-ball play while replacing unsafe lifecycle ownership: one fixed-step simulation clock, one RAF owner, one enemy-physics owner, and one terminal finish transition per run. Pointer/touch support and a readable narrow HUD are baseline playability, not a later visual redesign. Do not call W1 complete until a deterministic browser harness proves 20 restart cycles without accumulating RAF callbacks, listeners, timers, or memory.

## D-030 — Let rendered layout own WreckaVOID’s canvas

- Date: 2026-08-20
- Status: accepted for W2

Size the gameplay bitmap from the rendered flex-owned canvas, not `window.innerHeight` arithmetic. Dynamic viewport changes, safe-area padding, orientation, CSS layout, and pointer bounds must converge on that measured rectangle. Below a 320 × 320 playfield, stop play behind a clear support message instead of compressing the HUD and interactions into an unreadable surface.

## D-031 — Compose pause reasons and keep WreckaVOID audio local

- Date: 2026-08-20
- Status: accepted for W2

Manual pause, help, and focus loss are independent reasons; clearing one reason cannot clear another. W2 audio is a small local feedback layer with a persistent mute choice, no score effect, and no platform entitlement. Reduced-motion preference may suppress decorative particles and sparks, but must not silently alter physics, scoring, enemy timing, or leaderboard rules.

## D-032 — Bound presentation work and give every blocking surface one owner

- Date: 2026-08-20
- Status: accepted for W5

Keep WreckaVOID’s fixed-step simulation authoritative while presenting its clock to React at a bounded cadence. Cap particle collections and reduce decorative density under the operating-system motion preference. Help, pause, exit, game-over, and unsupported-viewport states must each have one semantic/focus owner; opening one surface cannot expose a second modal behind it or clear another pause reason. Enforce the shipping transfer ceiling in code rather than relying on a one-time report.

## D-033 — WORDaVOID V1 ships two honest modes before six experiments

- Date: 2026-08-20
- Status: accepted for WD0

Classic Survival and two-minute Time Attack are the WORDaVOID V1 modes. Perfect Run and Daily Challenge are duplicate Classic behavior; Wave Defense, Skill Training, Digit Assault, and Geometric Typing are partial experiments. Keep their source for later evaluation, but remove their Start actions and label them unranked until each has a versioned ruleset, statistics model, balance gate, and server-recomputable evidence. Competitive accuracy is correct characters divided by attempted characters with no motivational floor; WPM uses five correct characters per standardized word; best streak means the run maximum, not the terminal active streak.

## D-034 — Share one WORDaVOID rules engine and separate recomputation from trust

- Date: 2026-08-20
- Status: accepted for WD1 source gate

Generate competitive prompts from a server-created seed and sequence, and use one versioned workspace package for dictionary identity, normalization, prompt generation, scoring, and evidence replay in both game and platform. The browser may report ordered events but may not author accepted aggregates. A recomputed result advertises `server_recomputed` capability while remaining `provisional` until the isolated database exercise and an explicit anti-abuse/trust policy justify promotion. Valid ticket retries return the original receipt under the same row lock; they do not create a second score.
