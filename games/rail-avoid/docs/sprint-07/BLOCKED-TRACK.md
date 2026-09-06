# Blocked-track ambush — first local slice

2026-09-05. Source: `C:/dev/aVOID-railavoid-release/games/rail-avoid`, branch `codex/railavoid-blocked-track`, based on published `16d2fbf` (PR #62).

## Charter

Start the next planned ambush milestone by proving a real blocked rail connection, safe withdrawal/re-entry, saved attempts and once-only rewards. Main agent owns implementation and verification. This slice stays local and opt-in through a deterministic debug fixture; ordinary worlds receive no new encounters yet.

Reuse accepted scene/crew/enemy art and existing expedition combat. No Blender replacement, generation batch, XP/equipment, frequency increase, shared platform changes or publication. The Spike Captain's authored tell/counters and balance pass follow this foundation; existing enemies are not presented as a finished miniboss.

## Rules

- A blockage belongs to one undirected, existing rail edge. Do not remove the rail or alter its geometry. Reject placement under the train, on invalid/off-map terrain, or over another encounter.
- Planning cannot cross that edge or spend rails to reopen it. Other routes remain usable. A plan made before placement must stop at the near endpoint, without carrying the locomotive or rear cars through the obstruction.
- Inspecting and cancelling party preparation cost nothing. Staying aboard leaves the obstruction intact, clears only the untravelled plan and lets the player reverse or choose another route. Do not repeatedly reopen the event each tick.
- Starting an attempt records its identity. Fleeing or losing preserves the obstruction and carries existing wounds/normal expedition Void cost back. Re-entry restarts the two stages with full enemies, not healed crew; disclose this before entry.
- Only completing both stages clears the edge. The attempt settles once; reward/result/relic reloads must not duplicate rewards or Void cost. No rewards for a partial clear.
- Old saves without encounter records remain valid. No account/backend authority is introduced.

## Sequence and gates

1. Add the saved encounter/attempt contract, route checks and movement interception. Test both edge directions, already-planned movement, alternative paths and no mutation on rejected operations.
2. Connect one opt-in fixture to existing event → preparation → two-stage combat → result → train UI. Keep retry/leave explicit, with no new permanent chrome. Use normal Greenbelt foes while the miniboss is still unimplemented.
3. Test cancel, wounded retreat, retry, stage transition, full/wounded Good-timing completion, result/relic reload and single award. Run all units, TypeScript/build and browser flow at desktop/phone size. Record limitations honestly.
4. Next slice: author Spike Captain with a visible tell and two proven counters; tune two ordinary party compositions, then decide world placement/frequency. New art requires its separate gameplay-size/performance acceptance.

## Current evidence

- Implemented on the local branch; no world-generation calls place a blockade. `sim.debug.placeTrackAmbush(from, to)` arms one existing edge for local/ADS fixtures; `sim.inspectTrackEncounter()` opens its decision from either endpoint. Starting an ordinary run does not enable this feature.
- 89 unit tests pass (one optional skipped), including 14 focused encounter tests. TypeScript passes. Tests cover already-planned movement/actual six-car trail, no phantom fuel use, an alternate existing-rail detour, invalid placement, free cancel/leave, old-save compatibility, saved preparation/stages/results/relic, partial retreat/loss, and ticket idempotency.
- Conductor/Gunner/Medic at 100 HP and 45 HP complete the existing two Greenbelt stages on Good timing. This is deterministic lifecycle evidence for those fixtures, not a human win-rate, timing or new-boss balance claim.
- `npm run verify:blocked-track`: 16 browser captures/checkpoints, no errors/failures, at 1280×720, 800×600, 390×844 and 844×450. Actual movement opens the event; keyboard preparation/cancel/flee, native Inspect/Continue, retry, stage transition and reward reload pass. The first run caught phone event columns and clipped short-screen crew controls; scoped layout fixes now stack phone decisions and keep Start/Cancel outside the scrollable roster, with three-column crew selection in landscape.
- Final production build passes. Existing seven-viewport expedition-card/alpha/action/crew-selection/stage/result regression passes with no browser errors. The new slice has not been through a full campaign or rebuilt offline standalone yet; those remain release gates before publishing it.
- Screenshots/results: `verify/screenshots/blocked-track/`. Uses accepted false-signal/ruin/crew art unchanged, no new texture requests or asset acceptance claims. Representative GPU timing, normal/reduced-motion timing comfort, the final ambush battlefield art and a larger crew roster's scroller still need their milestone-level checks before publication.

Status: first local lifecycle slice implemented and functionally verified; not published. Next: Spike Captain tell/counters and deliberate world-placement rules. The separate Blender cart pilot is not part of this branch; its port/performance comparison remains a visual integration gate.
