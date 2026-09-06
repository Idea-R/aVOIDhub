# Worklog

## 2026-09-05 — Live release and the first blocked-track slice

- Published PR #62 from candidate `994f45a` to main `16d2fbf`; Netlify deploy `6a9cb816a256f200088a7a3e` confirmed published for that commit. Whole-site preview and live smoke passed seven routes/25 assets with exact Rail bundle hashes. Preview and production each passed combat (23 samples) and conversation/save/return (25 samples). Four-size real-rail junction preview passed; shared release CI `34001925334` passed. [Release evidence](docs/sprint-07/RELEASE.md). Previous deploy retained for rollback; separate platform PR #61 untouched.
- Started `codex/railavoid-blocked-track` from production. Added an opt-in saved physical-edge encounter, movement interception, explicit free preparation/cancel/leave, wound-preserving retry and once-only attempt/reward settlement. Existing two-stage Greenbelt foes/art are temporary lifecycle fixtures; no new miniboss, frequency or art claims.
- 89 unit tests passed (one optional skipped), TypeScript and build passed. New browser flow passes 16 checkpoints at four viewport sizes with no errors; the existing seven-viewport expedition-card regression also passes. Found/fixed the illustrated event's phone two-column overflow and short-screen party controls; the crew roster scrolls independently of Start/Cancel. Full campaign/offline rebuild are still required before releasing this new slice. See [charter and evidence](docs/sprint-07/BLOCKED-TRACK.md).
- User asked about Blender carts. Read the actual pilot report/source: locomotive/cargo/coach are built and opt-in-integrated only in `C:/dev/aVOID`, not this release checkout or live. No files were silently ported. Recorded the required measured integration step in ROADMAP.
- Next: finish ordinary-party miniboss/tell/counter fixtures before world spawning. The current new slice remains local-only. Live remains the verified PR #62 milestone.

## 2026-09-05 — Readable combat and deliberate formation (local)

- Continued the user's next milestone in `C:/dev/aVOID-railavoid-release/games/rail-avoid`, preserving the dirty worktree. Bounded charter: `docs/sprint-07/READABLE-COMBAT.md`. No new goal, branch, commit, push, deployment, paid generation or Blender replacement.
- Extracted pure targeting, normal-Strike, guard-reduction, intent and formation helpers shared by simulation/UI. Enemy cards show hits, base damage and targeting rule; queued attacks show the actual victim and timing reductions. Removed unsupported Shade fire/Brute armor claims.
- Added a compact named turn order and rendered front nearest the opposing formation. Added an explicit partner chooser with both position changes, both Strike values and active-actor targeting-risk previews. Cancel does not consume state/RNG; selection uses only the active actor's turn. Mouse, number keys, native keyboard focus and controller choices share the same action path.
- Stored explicit pending swap targets. Old pending swaps migrate once to their legacy next-living partner; invalid/downed/stale selections fail without spending a turn. Inspection/reload does not create a committed action.
- Baseline: 54 passing unit tests and three matched ordinary-party/mixed-foe screenshots. Current: 75 passing unit tests, one optional skipped, TypeScript clean. New browser gate passes 11 viewport/text-scale combinations (23 recorded geometry/input samples), including 1920×1080 through 360×740, landscape 844×450, 75/100/110% scale, large text, normal/reduced motion, real mouse/keyboard/controller, cancellation, reload and downed-partner invalidation. No browser errors.
- Existing expedition-art, seven-size card-layout, 25-state conversation and continuity/retreat suites pass. Timing input passed an unchanged rerun after one software-rendered S-window miss; added an exact incoming target/damage assertion. No timing thresholds changed and no human timing/balance acceptance is claimed.
- Production build and 6.44 MB offline standalone rebuilt. Offline starter/conversation/intent/swap/frame checks pass with no unexpected errors; one known optional-audio file fallback remains. Full campaign regression passes its functional gates with zero console/page errors, warnings or failed requests. Its SwiftShader performance note is not real-GPU acceptance; boosted boss and Perfect-timing fixtures are not balance proof. Details in the milestone charter and `verify/report.md`.
- Resource checkpoint: only the main agent, zero Codex-owned heavyweight MCP helpers. Other applications' helpers untouched. Docker engine unavailable; no Docker/WSL work performed. The local Vite server remains available at `http://localhost:5178/RAILaVOID/`.
- Next: review intent/formation comprehension, then one blocked-track ambush and readable miniboss with ordinary-party Good-timing, wounded-party and retreat/re-entry gates. XP, equipment, larger roster and publishing stay separate.

## 2026-09-05 — Keeper conversation foundation (local)

- Continued the approved next slice in the release checkout, preserving all existing uncommitted UI/art work. Charter and decisions: `docs/sprint-07/KEEPERS-SIGNAL.md` and `DECISIONS.md`.
- Added a stable crossroads conversation with Mechanic/relic-aware repair choices, a free exit and run-scoped keeper goodwill. Reused accepted clean scene and alpha portrait/frame assets; no paid generation or production publication.
- Kept event state during crew selection; cancel/reload no longer discards the encounter. Added wounded retreat/re-entry and victory → relic → receipt continuity with single-award tests.
- Preserved expedition/relic state during save restore, added durable task checkpoints, bound the correct simulation before title-load listeners, and prevented scheduled cinematics from stealing dialogue input.
- Replaced the remaining legacy event typewriter/slide and crew-selection bounce. Added readable minimum Void-cost disclosure without changing the cost/timing rules.
- Verified 54 unit tests (one optional skipped), typecheck, production build, eight-combination conversation flow (25 captured states), seven-size expedition-card suite, continuity, usability and six-size responsive checks. Keyboard timing passed an unchanged rerun; software-rendering timing sensitivity is recorded in the charter, not hidden by relaxed gameplay windows.
- Final campaign regression passed all required gates with zero browser errors, warnings or failed requests. Updated the stale controls fixture to make a real junction choice before testing canvas placement. Boosted boss and Perfect-timing fixtures are functional evidence, not balance acceptance; real-GPU performance remains pending.
- Rebuilt the 6.42 MB standalone. Offline smoke passed for starter art and the new scene/portrait/frame plus conversation choices, with zero unexpected errors and one known optional-audio fallback. Left the local server available at `http://localhost:5178/RAILaVOID/`; no commit, push or deployment.
- Resource check: only the main agent; zero Codex-owned heavyweight MCP helpers. Docker engine unavailable; no Docker was used or modified. Existing non-Codex helpers were untouched.
- Next: review the conversation composition, then implement readable intent and explicit swap partners before the blocked-track/miniboss milestone. XP, equipment, roster expansion and live release remain separate.

## 2026-09-03

- Started Sprint 03, "The Train Is the Interface".
- Audited the existing HUD, train strip, inspector, crew assignment path, responsive layout, and verification harness.
- Confirmed the simulation already exposes the data needed for the UI slice.
- Baseline passed: 21 tests passed, 1 optional test skipped, production build and TypeScript check passed.
- Next action: implement the shared operations-desk card hierarchy and resource presentation.
- Added named resource cards with explicit capacity meters, larger values, semantic low/full states, and keyboard-focus help.
- Rebuilt the bottom consist as responsive train cards with full identity, labeled hull and heat, operational badges, posted crew names, and visible open crew slots.
- Replaced the crew dropdown with direct specialist cards that show identity, health, specialty effect, and a one-click Post action.
- Added focus continuity from the Crew Ready callout into the first posting choice and immediate confirmation after posting.
- Fixed announcement cards obscuring modal decisions and expanded the overlap harness to include announcements.
- Added `npm run verify:hud`; its resource, train-card, focus, posting, viewport, and page-error gates pass.
- Responsive overlap gate passes at 1920x1080, 1600x900, 1366x768, and 1280x720 in shop and inspector scenarios.
- Full verification passes every required gate with zero console errors, page errors, warnings, or failed requests.
- Final unit result: 21 passed, 1 optional skipped. Standalone file rebuilt at 2.39 MB and boots from `file://` with no errors.
- Corrected the conductor portrait to Vite's supported public-asset URL form; production and standalone builds remain green.
- Sprint 03 implementation is complete. Next action: conduct human comprehension and pacing playtests before expanding crew progression.
- User review identified Sprint 03 as an incremental cleanup rather than the requested redesign.
- Started and completed Sprint 04, "Command Deck Rebuild," as a corrective component-level pass.
- Replaced the old stat ribbon with a two-tier directive/manifest/conditions command deck.
- Replaced miniature consist cards with large purpose-specific rolling-stock schematics and embedded crew stations.
- Rebuilt the inspector composition as a matching equipment bay while preserving the direct crew-posting workflow.
- Focused HUD verification passes at 1920/1366/1280/800; overlap verification reports zero collisions across all shop and inspector scenarios.
- Full gameplay verification passes through all three bosses, progression, save/load, both end states, resize, determinism, and screenshot checks with zero console or page errors.
- Replaced the six starter-card CSS placeholders with a coherent generated rolling-stock set in the existing ink-and-wash industrial style.
- Added distinct Gatling I, II and III images and a level-aware runtime asset resolver; unsupported cars retain their CSS schematic rather than disappearing.
- Rejected the first fake-transparent exports after alpha inspection exposed a baked checkerboard, regenerated the production set on a controlled navy plate, and optimized eight assets to compact WebP files.
- Added authored-art and upgrade-variant assertions to the focused HUD browser gate. Generation recipes and provenance are recorded in `docs/sprint-04/ASSET-MANIFEST.md`.
- Published the verified Sprint 04 root `dist` bundle to the existing aVOID Games Netlify project. Production deploy `6a993daa056aba6997a0af41` is live at `https://avoidgame.io/railavoid/`.
- Ran the focused HUD acceptance suite against the custom production domain: all six generated car images loaded, Gatling I→III art changed, crew posting/focus passed, responsive bounds passed at 1920/1366/1280/800, and there were no page errors.
- Audited the current expedition system: four silhouette foes, a shared timing-ring interaction, specialty actions, six-round Void pressure, no persistent crew levels/unlocks, and a combat log carrying information that should be visible in the stage UI.
- Planned Sprint 05, `Away Team`, covering persistent character identity, XP/unlocks, positions/intents/Tempo/status rules, seven crew art sets, four foe sets, four region minibosses, a complete expedition UI rebuild, and staged verification.
- Implemented the first Sprint 05 encounter-depth slice: four painted scene backplates, scene-led mystery/site cards, staged ruin progression, formation pressure, turn-consuming swaps, a retreat-or-descend decision and four authored enemy avatars.
- Rejected fake-transparent monster batches after alpha inspection. The subsequent alpha WebP drafts passed metadata checks but failed visual review for checker fringes and enclosed background pockets; they are not accepted production cutouts.
- Added deterministic formation, swap and stage-reward tests plus a browser gate for event art, scene transitions, portraits, depth decisions and 1280×720 layout.
- Defined ADS as a future shared-platform, server-role-gated staging studio rather than a game-local authentication system.
- Began Sprint 06's content pass with four distinct illustrated mystery scenes, a new waterside Drowned Interchange event, four authored deep-ruin enemies, and region/depth-specific expedition rosters. User review moved every scene to a cleaner low-grain paint treatment and every enemy to a background-free alpha cutout.
- User authorized the native GPT Image 1.5 API path for transparent assets. Prepared the direct bundled CLI recipe, identity-preserving prompt and native-source light/dark verification. Credential preflight found no configured OPENAI_API_KEY, so paid generation and integration remain pending. No publishing was performed in this pass.
- After the user configured the Windows-user credential, completed all eight native-alpha enemy corrections through GPT Image 1.5. Rejected one cropped Hound and three ground-shadow variants, corrected them with native API edits, and visually accepted the final set on light/dark backgrounds. Exported v3 WebPs without color-keying, switched runtime imports, preserved masters and hashes, and confirmed the production build. Audited the CLI model path: explicit gpt-image-1.5, transparent PNG output, no model fallback and no rate-limit errors. No deployment performed.

## 2026-09-04

- User authorized the live release and requested the next goal plan. Verified the release branch is based on current production main, with working GitHub and Netlify access.
- Re-ran the full campaign gate: all required checks passed with zero browser errors/failed requests. Reconfirmed 32 unit tests passed, one optional skipped; rebuilt the 6.00 MB standalone and passed offline boot.
- Whole-site application build passed. The local Netlify Next adapter failed on a Windows middleware dependency path; no publish occurred. Release proceeds through hosted preview verification instead. See `docs/sprint-06/RELEASE.md` and the release PR for publication evidence.
- Corrected obsolete grain/keying instructions in BRAND and Sprint 05 docs to match the user's clean-scene/native-alpha direction. Preserved accepted PNG masters and rejected local drafts separately.
- Planned Sprint 07 around playtest triage, crew identity/paired art, visible intents, deliberate swaps and one complete ruin/miniboss. XP, multi-station crew, world bridges and authenticated ADS stay separately gated. Added a playtest checklist and a verified development/API toolkit reference.
