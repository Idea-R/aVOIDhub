# Junction and Unknown-Signal Patch

This patch turns route decisions and concealed track encounters into explicit, testable play rather than map decoration.

## Delivered

- Junction buttons are ordered left-to-right by their actual branch endpoints, carry a compass direction and reuse that direction in the radial dial.
- Choosing a junction is an explicit continue action: it plans the selected branch, releases the train and resumes time if the player had paused.
- A paused run gets a central **Resume journey** callout. The top time-control button changes from pause to play, so both locations communicate the same state.
- The route rail waits 140 ms for hover intent and unfolds over roughly 400 ms as one component. Reduced-motion mode still disables the transition.
- The obsolete first-junction announcement was removed because it duplicated and obscured the actionable chooser.
- Every region generates at least one **Unknown Signal** directly on a main rail line. The `?` marker does not disclose its event family before arrival.
- The first concealed pool contains five deterministic encounter families: variable lockbox, away-team combat, moving-train ambush, stranded gunner and damaged weapon car.

## Verification contract

- `npm run verify:junction` drives a seeded run to a real junction, compares control order with projected branch coordinates, verifies explicit direction labels, pauses, chooses the rightmost control and confirms the rightmost branch was planned and time resumed.
- `npm run verify:usability` checks the central pause recovery action, play/pause icon state, route hover intent timing and the revealed mystery-event presentation.
- Simulation tests guarantee at least one on-rail mystery node in every region and cover weapon-car and crew recruitment outcomes.
- `npm run verify:hud` loads Flak, Cannon, Radiator and Medical cards and verifies that each generated image is wired into the live rolling-stock UI.

## Next content expansion

Add region-specific pools, follow-up chains, painted event illustrations and consequence tags. Keep outcomes legible before confirmation even when the event identity itself is concealed.
