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
- Status: accepted and implemented locally for Sprint P3

First-party catalog cards should open `/games/<slug>/` pages with controls, status, scores, personal best, favorites, share, and a clear Play action. Preserve the current immersive routes for bookmarks and focused play. External titles must state the destination domain and cannot imply shared account or leaderboard behavior.

The Sprint P3 implementation extends the detail surface to all eight catalog titles. TankaVOID is the deliberate exception to card navigation and Play: its directory card remains a noninteractive coming-soon artifact, while its direct detail URL documents the rebuild target without exposing a playable route. Favorites remain P4 work, and live personal-best/board reads remain subject to the P1/P5 data gates.

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

## D-035 — Give WORDaVOID one explicit typing and pause boundary

- Date: 2026-08-20
- Status: accepted for WD3

Competitive letters belong only to a focusable typing surface; global keyboard ownership is limited to Escape. Browser shortcuts, controls, repeated keys, composition, paste, and characters outside the ASCII V1 contract cannot become evidence accidentally. Manual and focus-loss pauses are independent reasons, and one semantic dialog owns each blocking state. The rendered arena owns viewport dimensions, while system reduced motion is mandatory and may suppress decoration only. Browser-emulated mobile input is a release candidate, not physical-device certification.

## D-036 — Isolate VOIDaVOID before making it competitive

- Date: 2026-08-20
- Status: accepted for V0/V1

Keep the recognizable meteor, defense, pulse, fragment, and chain-detonation game, but define one canonical runtime graph before adding platform features. The local V1 build uses one fixed 60 Hz loop, one canvas Pointer Events owner, one resize owner, composed pause reasons, an explicit guest start, and local-only result truth. Historical auth, profile, leaderboard, audio, alternate engine, and performance experiments may remain in repository history but cannot compile into the release path. Use DPR 1 until every active system shares one logical-pixel model. Do not rank the current random score stream; seeded evidence and platform run receipts are later gates.

## D-037 — Separate deterministic score evidence from client trust

- Date: 2026-08-20
- Status: accepted for V2

Derive named world, power-up, chain, score, and defense streams from one recorded unsigned run seed. Cosmetic randomness stays outside those streams so performance and visual settings cannot change an outcome. Use the 60 Hz simulation tick for every gameplay timer and record bounded score events in tick order. A local verifier may call matching arithmetic `replayable-local`, but an unsigned browser envelope remains unranked and provisional. Only a server-issued ticket plus bounded input or authoritative simulation evidence can justify stronger trust in V3.

## D-038 — Keep VOIDaVOID accessibility, sound, and motion outside the score contract

- Date: 2026-08-20
- Status: accepted for V4

Use a small procedural Web Audio palette that starts only after a player gesture, persists mute, reports failure honestly, and owns exact voice/context teardown. The OS reduced-motion request is mandatory and may suppress particles, shake, shadows, trails, and decorative chain/defense work, but it cannot change gameplay streams, collisions, timing, scoring, or evidence. One semantic dialog owns each blocking state; score updates are not a continuous live region. Enforce central particle and shipping-transfer ceilings in code. Browser emulation, local FPS, and heap samples complete the local gate, while physical devices, deployed audits, production smoke, and rollback proof remain separate release evidence.

## D-039 — Rebuild TankaVOID around directional combat, not prototype breadth

- Date: 2026-08-20
- Status: accepted for T0/T1

Preserve both prototype histories, then remove the incompatible monorepo generations from the active graph. The stronger standalone tree is a mechanics reference, not a production base. Establish one seeded 60 Hz simulation, loop, input owner, resize owner, logical-pixel viewport, and exact lifecycle before porting combat. T2 must pass an impact vector into pure face/incidence/damage math; it cannot call a generic `takeDamage(damage)` path. TankaVOID remains Coming Soon until the narrow directional-combat loop, content, platform, device, deploy, and rollback gates pass.

## D-040 — Let the struck plate and shell travel answer different questions

- Date: 2026-08-20
- Status: accepted for T2

Swept collision supplies the impact point. The defender-center-to-impact direction selects front, left, right, or rear armor; inverse projectile travel is then compared with that plate's outward normal to determine penetration, glancing, or ricochet. Do not select both face and incidence from projectile travel: with four nearest faces that would cap incidence at 45° and make the frozen 50°/68° thresholds unreachable. Primary pointer-down is a queued action pulse rather than a transient level so a complete click between fixed ticks cannot disappear.

## D-041 — Make T3 cover structural and the encounter states explicit

- Date: 2026-08-20
- Status: accepted for T3

Use four indestructible barricades around a clear central lane. Tanks resolve as circles against cover and each other; shells resolve the nearest swept tank-or-cover intersection; and the bruiser cannot fire through a blocked sight line. Treat deployment, combat, and the final-impact hold as deterministic running substates rather than timers owned by React. Enforce one enemy, four cover pieces, 32 projectiles, eight tank impacts, eight cover strikes, zero particles, 56 logical renderer draw-items, five catch-up steps, and a 250 ms accepted frame-delta clamp. Do not add destructible scenery, debris, waves, touch, progression, or scoring to make this slice appear larger.

## D-042 — Treat touch as a single-owner candidate until hardware proves it

- Date: 2026-08-20
- Status: accepted for T4; physical certification pending

Route keyboard, pointer, drive-thumb, and aim-thumb state through one `InputController`. The left thumb owns throttle and hull turn; the right thumb owns aim and queues exactly one cannon shot when released. React may present labelled, responsive pads but cannot become a second gameplay-input owner. Audio is one gesture-created procedural context with eight bounded voices and exact silence on pause/result/teardown. System reduced motion is mandatory and neither motion nor sound may change simulation truth. Browser Pointer Events and responsive emulation can establish a release candidate, but only physical iOS and Android evidence can establish a public touch-support claim.

## D-043 — Make T5 escalation behavioral, not feature breadth

- Date: 2026-08-20
- Status: accepted for T5

Build one static five-wave manifest from four readable tank profiles: scout, bruiser, hunter, and final-wave commander. Escalation comes from speed, range, approach, crossfire, health, and coordinated composition—not mines, infantry, pickups, alternate weapons, upgrades, new arenas, or boss-only machinery. Keep deployment, clear holds, field repair, and results on simulation ticks; keep the seed limited to small spawn/orbit variation; and preserve fixed entity/render/audio/input ceilings. A fast pilot and a deliberate one-shot-every-two-seconds pilot must each clear ten seeds, while an idle player must still lose. These local facts do not create a platform score or trust claim.

## D-044 — Recompute TankaVOID arithmetic without overstating browser trust

- Date: 2026-08-20
- Status: accepted for the T6 source gate; database execution pending

Create each ranked attempt on the platform with a server-owned run id, unsigned seed, exact `five-wave` mode, and `tankavoid-v1-rules-1` identity. At natural completion, accept only a bounded terminal summary whose identity matches the stored manifest; reject impossible wave, kill, commander, shot, damage, repair, time, and hull combinations; and recompute the score on the server. The browser never supplies an authoritative score, user id, trust flag, game key, mode, or ruleset. This establishes the `bounds_recomputed` capability but remains `provisional`, because a browser can still fabricate plausible evidence. Do not use `verified` without independently reproducible simulation or replay evidence. Keep guest play complete, stage the full review build, and withhold the friendly Play route and catalog action until the database and T7 release gates pass.

## D-045 — Treat five waves as Proving Grounds, not the ceiling of TankaVOID

- Date: 2026-08-20
- Status: accepted for product planning; expansion implementation not started

Preserve the T0–T7 five-wave mode as the deterministic Proving Grounds ruleset: tutorial, browser demo, daily challenge, performance baseline, and ranked platform mode. The recovered prototype shows a broader original ambition—large scrolling terrain, survival waves, barracks, infantry, bosses, multiple weapons, mines, pickups, experience, and levels—but those disconnected systems do not become release scope merely because they exist.

Plan a separately versioned Expedition mode around larger scrolling sorties, sector objectives, extraction decisions, tank buildcraft, and optional endless continuation. It receives its own mode, score/evidence contract, performance ceilings, progression rules, and acceptance train. Do not mutate `tankavoid-v1-rules-1`, delay the Proving Grounds review gate, or add multiplayer before the single-player sortie proves retention. Two-player cooperative sorties may be evaluated later; public PvP and persistent open-world infrastructure remain outside the approved scope.

## D-046 — Require the intersection of data, device, deploy, and rollback evidence for public Tanka Play

- Date: 2026-08-20
- Status: accepted

Local source, responsive browser emulation, and a review artifact are necessary but not sufficient to publish TankaVOID. The catalog can change from Coming Soon to Play only after the coordinated database matrix, physical iOS/Android checks for any claimed mobile support, Git-driven deployed-route smoke, and a verified rollback target all pass. A failure in one gate keeps the public route held without erasing the completed local candidate evidence.

## D-047 — Separate creator approval from creator payment

- Date: 2026-08-20
- Status: accepted for the membership source gate

Creator application is free. Human review establishes creator approval; Stripe establishes only subscription state. Private game submission and paid hosting capacity require both an approved application and an active Creator entitlement. Payment cannot create a creator profile, approve an application, publish a game, enable ads, or promise revenue sharing. Cancellation removes subscription-sourced capacity without deleting creator ownership, application, profile, submission, or review history.

Free accounts retain core profiles, favorites, play, and eligible leaderboards. Founding Player and Creator plans may add ad-free eligible platform pages, noncompetitive identity/cosmetics, selected experiments, and reviewed creator capacity. No plan may change score, damage, armor, movement, ranked trust, or other competitive outcomes.

## D-048 — Keep role selection out of the login surface

- Date: 2026-08-20
- Status: accepted

Use one passwordless login for players, creators, and administrators. Player and creator status comes from owned platform records and entitlements. Administrator authority comes only from server-controlled Supabase Auth `app_metadata.platform_role`; never read `user_metadata`, a query parameter, a client-side switch, or a public profile field as admin authorization. Authenticated pages and every privileged route handler must verify the user independently.

## D-049 — Make review approval operationally narrow

- Date: 2026-08-20
- Status: accepted

The administrator control room may record bounded creator, game, and score-review transitions. A review approval does not publish a game, deploy code, create a Stripe charge, grant an entitlement, activate AdSense, or delete evidence. Those actions remain separate workflows with their own acceptance and production gates.

## D-050 — Give WreckaVOID a finite victory and a separate endless mode

- Date: 2026-08-23
- Status: accepted for WreckaVOID V1 execution

Ship a ten-minute, three-act Wreck Run with boss checkpoints and a real victory state. Preserve an optional Endless Yard for score chasing after the standard encounter model is stable. Do not require open-world maps, a story campaign, or multiplayer for V1. A finite run gives new players a learnable goal and makes balance measurable; the endless mode remains honestly endless rather than presenting infinity as an unbeatable campaign.

## D-051 — Drive WreckaVOID difficulty through an encounter budget, not score

- Date: 2026-08-23
- Status: accepted for WreckaVOID V1 execution

Advance standard-run acts by time and boss completion. Use bounded population, projectile, movement, fire-rate, and minion budgets. Keep score as a result of skill rather than the clock that punishes skill with faster spawns. Every balance and scoring change receives a versioned ruleset so incompatible results do not silently share a leaderboard.

## D-052 — Make wreck damage express impact quality

- Date: 2026-08-23
- Status: accepted for WreckaVOID V1 execution

Preserve the chain and ball physics, but derive offensive damage from bounded impact velocity or impulse plus meaningful upgrade multipliers and per-target cooldowns. Resolve death, points, and drops once by entity ID. Add bounded player hit recovery so contact cannot deal damage every frame. The game should reward a deliberate high-momentum wreck, not frame overlap or rounding accidents.

## D-053 — Launch WreckaVOID and TankaVOID as the first monetization-ready pair

- Date: 2026-08-23
- Status: accepted working interpretation of the owner launch direction

Treat WreckaVOID and TankaVOID as the first two hosted games to carry the platform from polished directory to complete product. Preserve guest play, difficult skill-based progression, ruleset-specific leaderboards, player profiles, noncompetitive cosmetics, and paid membership entitlements. Platform billing, creator hosting, and advertising remain shared services; none may change gameplay power or score trust. Integrate the complete stacked game work into current `main`, then finish data, device, deploy, rollback, balance, and live-service gates on one clean launch branch.

## D-054 — Freeze the first Wreck Run candidate as a bounded three-boss ruleset

- Date: 2026-08-23
- Status: accepted for release-candidate testing

Identify the finite mode as `wreck-run` and its first candidate as `wreck-run-v1.0.0-rc.1`. Advance one wave every 30 seconds to a 20-wave ceiling. Open boss checkpoints at 150, 330, and 600 seconds; the third boss defeat is victory, while time beyond ten minutes is final-boss overtime rather than a fourth act. Cap ordinary enemies at 18, 22, and 24 by act and projectiles at 36, 48, and 60. Reduce ordinary spawn pressure during boss phases. Award 10,000 points per cleared wave and 100,000 per broken boss so going farther dominates combat farming while enemy points still break close ties. Keep submitted results provisional and reject incoherent time, wave, boss, minimum progress score, outcome, mode, and ruleset combinations at the platform boundary.

## D-055 — Give hosted games one platform session and server-derived cosmetic unlocks

- Date: 2026-08-23
- Status: accepted for the first two launch games

WreckaVOID and TankaVOID consume the platform's same-origin cookie session instead of creating game-specific login state. The platform returns owned profile identity and active entitlement keys; each game stores only the player's currently selected cosmetic. A locked or expired member selection falls back to the free look. Cosmetics may change rendering and presentation but never simulation, damage, movement, scoring, run evidence, or trust. Legacy game-owned auth, profile editing, and direct leaderboard reads are removed from the WreckaVOID release bundle rather than left as a second account system.

## D-056 — Separate score replay capability from anti-cheat trust

- Date: 2026-08-24
- Status: accepted for the shared leaderboard source gate

Use one platform session, one-use ticket, server-owned manifest, and server-derived accepted score for every hosted ranked run. Label a result `server replay` when deterministic evidence rebuilds the score and `bounded` when the server recomputes a narrower terminal summary. Store both as `provisional` until the platform proves the underlying player actions or simulation independently. Never translate a successful arithmetic replay into a `verified` claim.

Keep modes separate and show one best accepted row per player per mode. Legacy rows may remain historical, but they cannot inherit a stronger trust label from old browser-authored flags.
