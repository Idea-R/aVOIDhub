# Readable combat — milestone charter

2026-09-05. Canonical source: `C:/dev/aVOID-railavoid-release/games/rail-avoid`.

Status: implemented and functionally verified locally; ready for human review. Not published.

## Outcome

Before committing a turn, the player can read enemy attack count, damage and targeting rule, see the round order, and choose exactly which living ally to swap positions with. Preview and resolution share pure rules; inspecting must not consume randomness. Existing art, timings, attack values and rewards remain intact.

## Scope and authority

- Main agent owns this local implementation, tests, responsive screenshots and handoff.
- Add compact enemy intents and round order, explicit cancellable Swap selection, honest action/position descriptions, saved swap targets and compatibility with old pending swaps.
- Preserve weighted target selection: an intent states a targeting rule before an attack, not a guaranteed victim. Once queued, show the actual target and remaining blows.
- No asset generation, Blender integration, new enemies/bosses, XP/equipment, general balance retuning, Git publication or deployment. Those remain separate milestones.

## Sequence and gates

1. Capture the existing mixed melee/ranged fixture at desktop and phone sizes; run baseline tests.
2. Extract shared targeting/damage/position rules and test preview parity, no RNG mutation, multi-hit/stun/guard/downed cases. Store explicit swap targets, reject invalid selections, and preserve old saved pending swaps deliberately.
3. Reuse the existing brass/ink cards. Keep the primary attack readout visible on small screens; put fuller target probabilities and swap consequences in a focused chooser. No new always-open sidebar.
4. Verify actual mouse/keyboard/controller selection, cancellation with no consumed turn, resume/reload, all current crew roles, 75/100/110% scale, large text and reduced motion. Run conversation/expedition regressions, TypeScript, build and offline smoke.

Success is functional and visual evidence at gameplay size. Software-rendered browser results are not real-device performance or human timing/balance acceptance. Next dependency: one blocked-track encounter and a readable miniboss, with ordinary-party pacing tests before increasing expedition frequency.

## Implementation and evidence

- Shared contracts: `src/core/expeditionRules.ts`, used by simulation and UI. Preview reads never consume RNG. Normal Strike and incoming guard reductions use the same calculation as resolution; specialty actions retain their existing behavior.
- `src/sim/expeditionRules.test.ts` covers all eight enemy definitions, target RNG parity, remaining blows, stun, downed targets, guard/timing/rally/position damage, invalid/stale swaps, explicit saved swaps, legacy migration and stable turn order. Full unit result: 75 passed, one optional skipped (54 passed at baseline). TypeScript passes.
- The chooser previews both position changes, both Good-Strike values and the active actor's per-blow targeting chances. Inspection/cancel/reload is non-mutating; selecting a partner consumes exactly one turn. Number keys refer to visible partners, not global crew slots.
- Baseline screenshots: `verify/screenshots/combat-readability/before/`; seed 12345, region 3 authored Fusilier/Hound opening, ordinary-health Conductor/Gunner/Medic, high quality, 75% UI, reduced motion. No inflated stats in this visual fixture.
- Candidate screenshots and machine-readable bounds/input results: `verify/screenshots/combat-readability/after/`. `npm run verify:combat-readability` passes 11 viewport/scale combinations (23 geometry/input samples), from 1920×1080 through 360×740, plus 844×450 landscape, large text and 75/100/110% scale. Confirms real mouse/keyboard/controller, cancel/reload purity, downed/stale partner invalidation and normal/reduced motion. Old captures at `battle-1280x720.png` predate the final numbered-scale filenames; review the latter.
- S/Space/E/G, pointer activation, repeat suppression and double-resolution tests pass, including exact incoming target/guard readout. The first software-rendered run missed S; the unchanged rerun passed. No timing thresholds were relaxed. Headless CDP scheduling is not a human timing-comfort test.

- Existing expedition-art, seven-size card-layout, 25-state conversation and continuity/retreat suites pass with no browser errors. Production build and 6.44 MB standalone rebuilt; offline starter/conversation/intent/swap/frame checks pass. One known optional-audio file fallback; zero unexpected offline errors.
- Final `npm run verify` passes its functional gates: opening controls, early/midgame, all three bosses, expedition/relic progression, save/load, both end states, resizing, deterministic replay and screenshot capture. Zero console/page errors, warnings or failed requests. Boss fixtures are boosted and expedition completion uses Perfect timing; neither establishes campaign balance. The headless performance note remains: average 15.3 FPS at auto-low on SwiftShader, not a GPU acceptance result or a before/after comparison. Full generated evidence: `verify/report.md` / `verify/report.json`.

Release status: local only. No GPU-performance or campaign-difficulty claim is made from these fixtures. No new image files or larger textures were introduced; the chooser reuses existing portrait/frame URLs. First-use decoding and residency depend on which portraits were already loaded, and were not benchmarked here. Actual frame-time/performance comparison on representative GPU hardware remains pending.

## Human review

Can a new player identify the next threat without opening the log, explain why a front/rear swap changes risk, and cancel the chooser without losing their place? Try a multi-hit foe and a ranged foe together. Check that the same G/Space input feels comfortable after a swap at ordinary display refresh. These are comprehension/timing gates, not established by automated completion.

## Next milestone gate

One authored blocked-track ambush/Spike Captain encounter should follow only after review of this combat UI. Define the blocked link and escape/re-entry rules first; then prove arrival → preparation → two stages → single reward → return with a full and wounded ordinary party on Good timing. At least two readable counters must work. Increase expedition frequency only after that loop and its Void/time cost are understandable in play. Keep new boss art opt-in until its gameplay-size and performance comparison passes; the Blender pilot is not replacement approval.
