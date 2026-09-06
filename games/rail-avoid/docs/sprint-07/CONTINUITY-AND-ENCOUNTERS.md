# Continuity, conversations and expedition depth

Playtest follow-up: 2026-09-04. Local changes only; no goal, commit or deployment implied.

Update 2026-09-05: the conversation and safe expedition-handoff foundation below is now implemented locally in [The Keeper’s Signal](KEEPERS-SIGNAL.md). The audit and original sequencing remain here as a dated record. Physical obstruction, explicit swap/intent and the new miniboss are still pending.

## This pass

- Notices share one fixed top-right lane. Full text appears immediately; no typewriter, stretch or slide. Opening the inspector, a modal or a junction choice holds the announcement queue until the task closes. Short alerts remain secondary.
- Panels and command controls fade in place, without row-by-row travel or overshoot. Resource chips retain colour feedback without enlarging; normal consumption no longer spawns floating numbers. Combat attack movement and the timing ring are unchanged.
- One shared portrait window frames generic crew as busts in assignment, party selection, the active command card and results. The accepted alpha images and full-body avatars are unchanged; no paid generation or background removal was needed.
- Posting/unassigning preserves keyboard focus within the task. Inspector refreshes retain the open roster and scroll position on the same car. Crew choices expose real button semantics.
- Passenger boarding uses a short receipt with occupied/total seats, coach explanation and delivery destination. Crew remain separate named specialists; passengers do not need individual station assignment.
- Ordinary stage completion is a bottom-anchored continuation card with the scene still visible. Continue deeper is primary; Retreat stays available. At a stage boundary, Conductor health at or below 20% gets a stronger warning. No automatic descent or forced retreat.
- Fixed an input defect: Enter/Space on a focused Retreat choice could trigger Continue instead. Stage choices now support native activation, Tab, F to retreat, and gamepad selection.
- Fixed side-panel close bookkeeping: the inspector-open layout flag could survive a close. New runs and closing panels now release their layout state.
- Fixed a junction projection reset: a hidden→shown transition could preserve the 720×400 fallback inside a different-size container without a ResizeObserver callback. Visible geometry now self-checks; correct layouts retain their existing buttons/focus. Junction controls also fade together in place.

## What exists today (mechanics audit)

- `Crew` stores ID, name, specialty, assigned car and HP. There is **no crew XP, level or unlock state**, including for the Conductor. Enemy `xp` feeds run score, not character progression.
- Each specialty has a fixed expedition skill. The Conductor's Whistle rallies the team; it is not a level unlock.
- Expedition victories grant marks, scrap, a relic choice and sometimes a rescued specialist. Wounds return to the train. Retreat keeps the party but awards no final-chamber loot. Current rules carry downed crew back at 15 HP; there is no permadeath system.
- Existing event requirements cover cars, resources and marks. Contextual conversations, relationship memory, crew/relic dialogue predicates and route-changing dialogue are not implemented.
- Current relics are train-wide run passives, not crew equipment. Randomly named recruits of the same specialty share one generic art pair; this is not yet a distinct named-character catalog.
- Passengers occupy coach capacity, consume food and affect morale. Delivery at yards/terminus grants two rails and one scrap per passenger plus score/morale, subject to storage caps.
- Main-line mystery nodes already include an away-team choice and train ambushes. Crossroads currently resolve to overworld elites/toll choices, not the richer conversation-to-expedition flow below.

## Next bounded sprint: The blocked line

Intent: prove one memorable arrival → conversation → away-team expedition → return sequence before scaling events or portraits. Keep the existing readable-intent/explicit-swap work as prerequisites.

### 1. Stable arrival and dialogue shell

- A stationary location card: place name and scene above, NPC/Conductor exchange in the middle, choices in a fixed lower region. No typewriter delay, hover expansion or moving primary button. A boarding/recruitment receipt updates in this same location instead of opening another panel.
- First NPC: a junction keeper at a barricaded crossroads. Start with two short exchanges and at most three choices. Use authored, seeded dialogue and outcomes; generation is an offline authoring tool, not a paid/runtime dependency.
- Context options: a Mechanic helps inspect the debris; an owned Tinker's Kit exposes a repair solution; a prior promise opens a cooperative response. Show the relevant character/item and requirements alongside the option. Always leave a reachable baseline choice.
- Use one predicate/resolution contract for displayed availability and actual costs. Revalidate at commit; no charge on cancel and no duplicate reward on reload. Choice text must preview time/resource/direction consequences.
- Do not reroute the train silently. A dialogue route change highlights the actual connected rail branch and asks for confirmation.

Gate: no-crew/no-item and eligible fixtures, unavailable options with reasons, keyboard/controller flow, 390/800/1280 widths, readable full copy at 110% scale, save/reload mid-conversation and once-only rewards.

### 2. A blocked-track ambush with a real reason to disembark

- Mark a seeded obstruction on an existing rail link. Arrival pauses travel and presents the scene; the player cannot drive through intact debris.
- Inspection leads to an ambush and a two-stage expedition: clear the platform, then confront the miniboss beneath it. Telegraph enemy intent and offer two counterplay paths (formation/guard or specialist utility).
- Make this encounter required to clear this particular route, not a forced loss for every run. Preview the encounter before commitment; allow an existing alternative rail route where geography supports one.
- Retreat remains an action on the player's turn and between chambers. Low-health warnings do not consume turns, choose for the player or repeat every animation tick. A retreat leaves the obstruction in place; explicitly define retry/reset and reward rules before implementing the link.
- Reuse the current clean ruin art for the first fixture; generate only the missing keeper portrait and Conductor/keeper scene after the composition is accepted. Scene images have no baked text/frame or grain; avatars use genuine alpha.

Gate: ordinary three-person and undersized parties, 20% HP boundary, retreat/re-enter, win/reload, blocked-link routing, timing input and no inaccessible reward. Measure time, wounds and Void cost. Debug-granted wins are not balance evidence.

### 3. Prove pacing, then place more expeditions

- Human-test the single loop on Good timing with two sensible compositions. Record how often the player sees an expedition, its length and the recovery opportunity afterward.
- Then add one question-mark variant and one crossroads trigger using the same contract. Tune minimum spacing, repetition and safe recovery before raising frequency across all regions.
- Bosses/minibosses should have a reason to encounter this crew, a readable tell and an outcome that affects the journey. Keep roaming train attackers as pressure between these set pieces.

Gate: two seeded regional playthroughs per composition, no required encounter chain that strands a wounded crew, and no regression to route/UI/standalone tests. Human acceptance precedes a large art batch or live release.

## Following sprint: People worth keeping

1. **Stable named identities.** Add a character key and catalog separate from specialty and mutable display name. Each recruit gets a portrait/avatar pair, short biography, recruitment context and trait. Migrate existing saves without changing their names, health or postings. A second conductor must not replace the player Conductor accidentally.
2. **Small progression system.** Include the Conductor. Proposed five levels with two authored ability decisions; exact thresholds remain a balance decision. Start with progression inside the current run; no account-wide XP carryover is assumed. XP from completed encounters and bounded travel milestones, no idle farming. Once-only grants and save migration before displaying any level bar. Teach the first unlock through one event.
3. **Crew relics, not full equipment.** Start with one slot; consider a second at an earned milestone. Effects are small, explicit and visible in combat previews. Define equip restrictions, ownership, stacking, removal and save behavior. Do not repurpose train-wide relics silently. Full armor/weapon gear sets are a future design note only.
4. **Named pair synergies.** Prototype one complementary pair, visible during party selection and placement. Specify whether it applies to the away team or assigned cars; do not imply both. Useful bonuses, not mandatory pairings. Generic recruits must remain viable.

Longer-term recruitment pools may include several distinct medics, gunners and mechanics, another conductor and an expert marksman. The user's examples (six medics, ten gunners, five mechanics) indicate variety, not an approved batch size. Prove two identities and one synergy before growing a regional catalog.

Gate: old-save migration, identity consistency on every surface, XP duplicate prevention, level/unlock previews matching resolution, relic stacking/equip tests and synergy activation/removal tests. Keep roster simulation bounded; no per-frame portrait generation or autonomous runtime conversations.

## Verification record

Targeted regression: `npm run verify:continuity`. Evidence goes to `verify/screenshots/continuity/` (ignored local screenshots). This covers notices at normal motion, assignment focus/framing, healthy and 21/20/1 HP stage decisions, both retreat keys and responsive controls. Run the existing expedition-card, crew-timing, responsive, inspector and standalone gates before release. This document is not a production release claim.

Verified so far: 41 unit tests pass (one optional test skipped); TypeScript, production build and 6.41 MB standalone export pass. The continuity gate and seven-viewport expedition-card gate pass with no page errors. Native crew images were reused without changes. Visual review includes the phone inspector, crew-selection portraits, healthy continuation card and 20% HP warning.

The first crew-timing run timed out while polling for the short touch timing window. Failure capture was added before a diagnostic rerun; do not treat build success or a granted-party fixture as a timing or campaign-balance result.

The timing rerun passed unchanged combat windows. The broader responsive check exposed the junction fallback-size defect above (captured in `map-first/failure.json`); this was fixed in runtime code, not by weakening the assertion. The inspector's pan fixture now makes its pending junction choice first and verifies it is pointing at the canvas. Previously the stale inspector-open flag inadvertently hid that choice's input shield, so the fixture was testing a different UI state. Usability and standalone smoke checks passed before the final junction correction; affected checks are rerun afterward.

Final runtime reruns pass: responsive HUD/new-run/accessibility transitions (six sizes), inspector and real canvas right-drag (two sizes), continuity/descent, actual-rail overlay geometry (four sizes), and junction keyboard/click-to-resume. Production and standalone builds also pass after the correction. The earlier seven-size expedition-card pass and timing rerun cover the unchanged combat UI. Screenshot fixtures are functional and visual evidence, not a full campaign playtest or real-GPU performance measurement.

Handoff: final unit rerun is 41 passed / one optional skipped. The rebuilt standalone smoke test is ready/running with all six starter-car assets embedded and loaded, zero unexpected errors and one known optional-audio fallback. No production deployment, Git commit, new image generation or campaign-balance claim accompanies this pass.
