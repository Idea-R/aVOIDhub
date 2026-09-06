# Map-first interface and systems review

2026-09-04. Implementation branch: `codex/railavoid-map-first-ui`, based on production main `25d6820`. This is a local candidate, not a publication record.

## Design direction

The world is the primary interface. Navy and brass remain the frame, but the frame must not cover the railway the player is trying to choose. The running prototype is the design reference; no new scenery or decorative image containers were generated for this pass.

- Keep supplies, passengers/crew, Void distance, pause/speed and Menu visible.
- At 1536 px wide or below, or 850 px high or below, use map-first mode automatically. The existing Compact HUD preference now means “Map-first HUD on large screens.” Larger text remains independent of panel density.
- Open Route and Bounties deliberately. Hovering is not a command to expand a panel.
- Collapse the train deck to Manage train, aggregate hull and critical-car warnings. Keep the available-crew shortcut. Opening a car hands space to its inspector.
- A junction owns one decision surface: bounded map-oriented dial, matching numbered endpoints, direction, destination, line and distance. Clicking the diagram, selecting its card or pressing the number selects the same branch and resumes travel.
- Events take the inactive train deck out of the layout. Inspector, yard and modal bodies scroll within the viewport; their dismissal/actions stay reachable.
- Small battles reflow both teams and the action menu. The battle log opens on request; it does not sit over the action buttons. Phone portrait uses two team rows, not six desktop-width characters squeezed into one row.

### Running visual references

Reproduce with `npm run verify:responsive` from the game directory. Screenshots are local QA artifacts, intentionally not runtime assets:

- `verify/screenshots/map-first/junction-1280x720.png`
- `verify/screenshots/map-first/junction-800x600.png`
- `verify/screenshots/map-first/event-1280x720.png`
- `verify/screenshots/map-first/inspector-390x844.png`
- `verify/screenshots/map-first/expedition-800x600.png`
- `verify/screenshots/map-first/expedition-390x844.png`

The clear rectangular map band at the opening junction measured approximately 51% of the full 1280×720 viewport and 53% at 1024×768 before the last small label refinements. This conservative geometry excludes the entire top bar, left rail width and bottom dock. It is not a pixel-level occlusion score or a promise for every combat/modal state. The 800×600 junction remains denser (about 38% by that same measure); the train is visible, the direction cards fit, and its full deck is closed by default.

## Confirmed issues addressed in this candidate

| Finding | Change / proof |
| --- | --- |
| Route, junction and train panels demanded space simultaneously. | Explicit drawers and compact train summary; mouse, Escape and viewport checks. |
| Junction direction labels and branches escaped the miniature diagram. | Contained endpoints, matching numeric choices, destination-first cards. Old junction CSS removed rather than retaining its conflicting variants. |
| Auto-planning could pay rails to save a few hexes. | Search existing rail and player-built links first. Only use construction when no valid forward rail route reaches the destination. Adjacent map clicks use the same policy. |
| Construction-weighted cost was also treated as path depth. | Track step depth separately in the fallback search. |
| A routeable destination showed “Not adjacent to the plan” as an error. | Explain click-to-route; preserve actual void, mountain and resource errors. This hint is not a guaranteed affordability preview. |
| Four-option events advertised only keys 1–3. | Hint uses the actual option count. |
| Global shortcuts intercepted normal focus and button activation. | Tab navigates controls; Enter/Space activate focused buttons. Train inspector moves to T, with help text updated. |
| Map signage selected a branch but could leave the simulation paused. | Successful map-sign branch selection resumes, like the HUD chooser. |
| Small battle characters/actions/log inherited desktop footprints. | Responsive teams and action grids, explicit log toggle and scroll-bounded result cards. |

Rail-first regression fixtures cover old and player-built curves, adjacent destinations, destinations beyond planning range, zero rails, disconnected construction, blocked rail, occupied route, reversing and the planning limit. Following rail may take longer: that is now the deliberate default. A future explicitly labelled Build shortcut mode can offer a cost preview; it must not be an invisible planner preference.

## Wider game review: what should come next

This is a systems-level review of the game code, content definitions, render/UI integration and release evidence. It is not a claim that every balance combination, save history, platform permission or device has been exhaustively audited.

| Area | Evidence and gap | Next deliverable |
| --- | --- | --- |
| Ammo and power | `src/sim/train.ts` calculates nearby suppliers; shared ammo stock alone does not make a weapon supplied. Global power totals also do not explain local reach. `src/ui/inspector.ts` shows status text, not a traced connection. | Selecting a weapon highlights its supplying car and effective range. Buying/reordering previews supply, power and heat before committing. Distinguish “no stock,” “no supplier” and “no power.” |
| Passengers | `src/sim/settlements.ts` already rewards delivery at depots/terminus with two rails and one scrap per passenger. Coach capacity and food consumption matter, but the HUD barely taught that loop. | Capacity and destination guidance, an arrival receipt and explicit rescue-versus-supply trade-offs. Avoid a second redundant passenger currency. |
| Crew identity | `Crew` has name, specialty, HP and one assignment index. There is no XP/level/art identity field. Only the Conductor has integrated portrait/combat art across the main crew surfaces. | Stable identity keys, old-save migration and matching Gunner/Medic portrait-avatar pairs first. XP and multi-crew cars follow later. |
| Car art coverage | 23 car definitions; `src/ui/carArt.ts` has authored art for 10 types. Only Gatling has three authored upgrade variants. The stale catalogue comment said 22 and has been corrected. | Fill the 13 missing silhouettes by functional family: Boiler/Reactor, Fabricator/Foundry, Armoured Cargo, Tesla/Flamethrower, Scout/Rail Layer, Sleeper, Armour Plate/Caboose/Signal. |
| Expedition intentions | Front/middle/rear targeting and specialty bonuses work in `src/sim/expedition.ts`. Swap selects the next living ally, not a chosen partner. Combat descriptions mention armour/fire weaknesses without equivalent per-foe armour/fire rules there. | Shared deterministic intent preview/resolver, explicit swap target, accurate descriptions and one testable miniboss tell/counter. |
| Enemy reuse | Shade and Brute remain defined and have accepted alpha art, but `expeditionStageRoster` does not select them. | Seeded regional encounter variation with distinct roles; do not merely increase HP. |
| Encounter variety | Six mystery events have images and outcomes. Shrine and many other events remain text-only; mystery tables rotate globally rather than being authored around weather/location. | Give the shrine a proper illustrated arrival, then three contextual event families with truthful map markers and visible consequences. Reuse clean accepted scenes where the location actually matches. |
| Geography | Drowned Interchange is an illustrated resource encounter. It does not establish physical shoreline docks or traversable bridge tiles. Yards handle structural changes; reorder-only sidings remain planned. | Service legend plus a useful siding per region; shoreline-constrained nodes and bridge generation need separate connectivity tests. |
| Bosses | Main bosses are world-combat systems, not an avatar-to-expedition handoff. | Prove the readable miniboss loop first, then design one boss transition with save/return/reward guarantees. |
| Balance | Deterministic tests and debug-assisted campaign runs establish correctness, not ordinary-player survival rates. Void, ammo adjacency, heat and rear-car loss interact. | Fixed-seed normal-loadout trials recording first car loss, resource starvation, detours, retreat, rounds and remaining Void margin. Tune one pressure source at a time. |
| UI maintenance | `styles.css` contains multiple generations of compact/HUD rules. Tutorial and legacy verification assumptions expect an expanded deck. | Consolidate component ownership behind the new layout contract; keep readable-type and no-hidden-action assertions. Review tutorials against the collapsed defaults. |
| Production / ADS | Existing platform hosts the game; tooling and native image pipeline are documented in `docs/DEVELOPMENT-TOOLKIT.md`. Local game debug controls are not an authenticated studio. | GPU-backed performance run, whole-site hosted preview and save compatibility gate. ADS needs platform-authenticated, server-verified roles and staging fixtures, never client email matching. |

## Proposed next bounded sprint (earlier review)

Superseded sequencing and current art/UI acceptance: [Route and crew pass](ROUTE-AND-CREW-PASS.md). The findings below are retained as the earlier review snapshot, not the current crew-art inventory.

1. Accept the map-first UI against the supplied screenshots and a human playthrough. Add failures as reproducible fixtures; do not publish an unreviewed art overhaul.
2. Build supply tracing and purchase/reorder previews. Gate: every displayed connection/status agrees with the simulation, including a destroyed supplier and a new flak car.
3. Ship Gunner and Medic identity pairs through the existing native-alpha pipeline. Gate: the same identity appears in assignment, party picker, combat and results; verify alpha on cream/navy and migrate an old save.
4. Ship intent previews and explicit Swap selection in one two-stage ruin. Gate: preview equals resolution without consuming RNG; cancellation, downed allies and retreat preserve state.
5. Run normal-loadout balance trials and a GPU performance comparison. Release only after whole-site preview, responsive/interaction checks, campaign/save-load and standalone checks.

Do not add XP, multi-crew capacity, bridge generation, a main-boss conversion and ADS administration to this same sprint. Each changes a different contract and would hide the evidence of what improved the game.

## Verification status at the earlier review

- Simulation: 39 passed, one optional test skipped.
- TypeScript and production game build passed.
- Map-first HUD, explicit drawers, numeric/dial junction selection, event isolation and large-text resizing passed across six viewport sizes; extended small inspector/combat checks are part of the same harness.
- Focused inspector/right-drag, usability and staged expedition gates passed. An expedition gate timed out while multiple software-rendered browser suites ran together; its isolated rerun passed. Headless timeouts are not GPU performance evidence.
- Local visual review completed on the generated screenshots. No new images generated or paid API calls made.
- This candidate has not been deployed. Full campaign, standalone and whole-site hosted-preview gates must run before promotion.
