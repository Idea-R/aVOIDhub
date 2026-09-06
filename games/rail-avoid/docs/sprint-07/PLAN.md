# Sprint 07 — Crew Identity and Readable Combat

2026-09-05 gameplay triage: [Convoy recovery](CONVOY-RECOVERY.md) is the latest local slice. Ballistic weapons now use shared ammo without adjacency; operational cars have emergency guards, strengthened by living crew. Staffed stops offer reordering and timed field repairs to 80%. This supersedes the earlier ammo-supply explanation/tracing plan below. Power range and heat adjacency still matter. Publishing remains a separate release step.

Status: UI, generic crew art, Keeper conversation and intent/explicit-swap are published in PR #62 (`16d2fbf`). See [Release](RELEASE.md). [Blocked-track foundation](BLOCKED-TRACK.md) is the current opt-in local slice; the Spike Captain and world spawning remain planned. Art acceptance/provenance: [Route and crew pass](ROUTE-AND-CREW-PASS.md). Current combat evidence: [Readable combat](READABLE-COMBAT.md).

2026-09-05: Readable combat adds shared-rule enemy intents, queued targets, round order and explicit cancellable swaps. Front now appears nearest the opposing formation. Existing damage values, timing windows, rewards and art are retained; human timing/pacing acceptance and representative GPU performance remain separate gates before encounter-frequency expansion.

2026-09-05: [The Keeper’s Signal](KEEPERS-SIGNAL.md) adds the first authored conversation-to-expedition handoff and save-safe return. Its repair/leave alternatives keep the main line open. Phase 2 intent/explicit-swap mechanics still precede the compulsory blocked-link/miniboss slice; they were not silently bundled into this conversation milestone.

Visual follow-up: the user rejected the cool translucent expedition cards. [Expedition card revision](EXPEDITION-CARD-PASS.md) replaces them with native-alpha brass framing, opaque ink plates and a responsive command hand. This is the current visual-review candidate; the previous transparent-wrapper note below is historical, not the selected card treatment.

2026-09-04 follow-up: the user requested direct route-sketch nodes, complete crew avatars, transparent battle containers and action-key timing. Those are now the local review candidate. All seven generic specialty art pairs are present; individual save-stable identity remains pending. The user prioritizes expedition bosses/minibosses and special events next. Supply tracing stays in the backlog; the flak-car confusion is a missing explanation of a working mechanic, not simply missing ammo stock. The earlier [systems review](UI-AND-SYSTEMS-REVIEW.md) inventories 13 car-art gaps, two unused normal-stage enemies and geography/ADS work.

## Proposed goal

Latest feedback and follow-on sequencing: [Continuity, conversations and expedition depth](CONTINUITY-AND-ENCOUNTERS.md). This pass calms reactive chrome and fixes portrait framing and retreat activation. Extend Phase 3's single proven encounter with the blocked-line conversation/ambush example; do not batch-generate a named roster or introduce XP/equipment in the UI-polish pass.

Make an expedition feel like commanding the people aboard the train: consistent crew portraits and avatars, clearly previewed enemy actions, deliberate formation changes, and an after-action screen that explains what happened. Prove one complete encounter before expanding the roster or adding another progression system.

## Phase 0 — Playtest triage and reproducible cases

- Capture seed, region, journey time, train order, crew/HP, UI scale and the last action for every reported issue. Keep screenshots with the fixture, not just in chat.
- Prioritize blocked controls, lost progress, panel overlap, off-track cars and unreadable decisions ahead of new content.
- Reproduce weak-ammo-supply, rear-car loss and late-region pressure with ordinary loadouts. Do not use invulnerable/debug-granted parties to claim balance is solved.
- Measure battle rounds, elapsed decision time, incoming damage, retreat point and remaining Void margin locally. No external telemetry service is required.

Gate: each critical issue has a deterministic failing test before its fix; campaign, save/load and existing focused UI gates stay green. Human feedback sets tuning priorities; automated wins do not establish a first-attempt win rate.

## Phase 1 — The same crew member everywhere

- Introduce a stable character/art key independent of random display names and transient combat IDs. Preserve existing names, specialty, health and assignments in old saves.
- Use one definition across train cards, assignment, party selection, battle and results. Explicitly distinguish an authored named character from a generic specialty portrait; avoid silently giving unrelated recruits the same identity.
- Keep the accepted Conductor. Generate a paired portrait and native-alpha full-body avatar for Gunner and Medic first; after in-game acceptance, extend the same pipeline to Engineer, Mechanic, Surveyor and Quartermaster.
- Keep Signal Box Storybook silhouettes, clean paint, readable specialty props and current navy/brass/violet palette. No scene grain and no avatar background, frame or baked floor shadow.

Gate: one old-save fixture migrates without loss; all crew surfaces resolve the same definition; every new source passes native alpha, framing and manual light/dark edge review; no missing assets at 1280×720. Pause batching if the first pair is inconsistent.

## Phase 2 — Intent before input

- Build a visible round timeline and enemy intent cards showing action, target or targeting rule, hit count and expected range before commitment.
- Generate previews from the same deterministic resolver used for attacks. Never advance RNG while hovering or inspecting. Remove unsupported armor/fire-counter claims unless the corresponding rule is implemented and tested.
- Replace the current next-living-member Swap with an explicit partner/position choice. Show its turn cost and changed front/rear risk before confirmation; keep cancellation safe.
- Make Strike, Guard and specialty choices show target and timing instructions. Support keyboard focus and a reduced-motion timing presentation using the same timing windows.
- Give the victory/retreat docket clear surviving portraits, wounds, actual rewards and Return to Train/Descend decisions. Preserve party and reward continuity.

Gate: intent preview equals resolution for each attack type and position; timing input cannot double-resolve; swap, downed-target, cancel and retreat cases pass. Browser checks cover mouse/keyboard, 75/100/110% UI scale and 1920×1080, 1366×768, 1280×720 and 800×600 without hiding primary actions.

## Phase 3 — One complete ruin, then roster depth

- Author one two-stage Greenbelt ruin and one Spike Captain miniboss fixture using the Phase 2 rules. Give the boss one visible tell and at least two counters before adding combinations.
- Revisit Shade and Brute: their accepted art exists, but the current normal stage tables no longer select them. Introduce them deliberately through weighted, seeded regional variations with distinct roles, not arbitrary stat inflation.
- Validate two sensible party compositions on Good timing; keep retreat meaningful and rewards single-award. Confirm what happens with a damaged or undersized party.

Gate: the entire arrival → preparation → two stages → reward → return loop works with normal resources. Replay is deterministic, full-health and wounded runs are covered, and a human can explain the enemy tell without reading the log.

## Phase 4 — Release and the next expansion decision

- Re-run unit, native-alpha, focused expedition, campaign and standalone tests.
- Measure performance on an actual GPU and compare to Sprint 06 on the same machine; SwiftShader is functional evidence only. Pool effects, avoid per-frame DOM creation and load portraits/scenes on demand where practical.
- Publish a whole-site draft, verify RailAVOID and shared hub/game/auth routes, then promote the tested revision and record rollback evidence.

Gate: no unresolved critical playtest issues; accepted art and source hashes backed up on GitHub; preview and production smoke tests pass.

## Following goals, not hidden scope in this one

- Crew XP/five levels/two authored unlock decisions: implement only after identities and intents are stable. Require save migration, capped deterministic XP, once-only rewards and no surprise changes to posting bonuses.
- Multi-crew stations and Cab Crew upgrade; visible power/heat tracing; revisit-aware siding service geography. Ammo adjacency has been removed, not deferred for clearer tooltips.
- Tempo and four shared conditions, introduced through one tested ability at a time.
- Main-boss world-avatar handoff, after the miniboss loop proves itself; roaming elites stay in world combat.
- Shoreline-constrained docks, bridge tiles and weather-specific event pools. The current Drowned Interchange is an illustrated encounter, not a world-generation bridge feature.
- ADS: first reuse the existing deterministic fixtures in a local/staging palette. Shared login and server-verified admin role come through the platform; never grant admin by matching an email in client code. Verify the existing developer account/role separately before changing access. Production mutations and leaderboards remain isolated.
- Crew interiors, frame-by-frame animation and a large content batch remain later work.

Tool and asset workflow: `../DEVELOPMENT-TOOLKIT.md`. Playtest checklist: `../sprint-06/PLAYTEST.md`.
