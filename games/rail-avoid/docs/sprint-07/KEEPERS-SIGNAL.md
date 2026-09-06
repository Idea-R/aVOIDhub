# The keeper's signal — delivery charter

Date: 2026-09-05. Source of truth: `C:/dev/aVOID-railavoid-release/games/rail-avoid`.

## Outcome and first milestone

Prove one crossroads conversation → party preparation → existing staged expedition → return sequence. The location card stays in place, names useful crew/items, explains costs, and survives cancellation/reload without losing the encounter or duplicating rewards.

## Scope and authority

- Local implementation, authored copy, tests, screenshots and roadmap updates are authorized by the user's continuation request.
- Reuse accepted clean scene art and the existing Conductor portrait. No generation is required for this mechanics foundation.
- No production deployment, Git publication, account changes, runtime AI, XP, equipment, new character roster or new combat balance in this milestone.
- Physical rail obstruction, the Spike Captain, readable intent and explicit partner swaps remain subsequent milestones. This encounter concerns a stranded maintenance crew below a platform, not an impassable rail link.

## Work and dependencies

1. Main agent: shared choice requirements, persistent dialogue and safe preparation/return state.
2. Main agent: fixed location-card composition and keyboard/controller interaction, preserving existing panels.
3. Main agent: simulation tests, responsive screenshots, expedition/input regressions and build/standalone checks.

Success: every displayed requirement is rechecked by the resolver; cancellation spends nothing; 390/800/1280 layouts expose all choices; dialogue, active combat and results restore; final rewards are awarded once; retreat returns to a meaningful decision with wounds retained. Automated fixture wins are not campaign-balance evidence.

Next dependency after review: combat intent and explicit swaps, then a real blocked-link/miniboss loop with route alternatives and measured pacing.

## Local implementation

- Crossroads use two short authored exchanges with a junction keeper and the Conductor. One stationary brass-framed location card holds the scene, dialogue, requirements and choices. Phone/short-window conversations temporarily use the full play area; ordinary travel HUD sizing is unchanged. Large-text choice cards grow to fit their copy. No typewriter, hover expansion or entrance replay between replies.
- A fit Mechanic reduces the base hoist repair cost from 24 to 8 scrap. The owned Tinker’s Kit reduces it to 3 and is not consumed. Repair awards 3 marks and run-scoped keeper goodwill. Later keepers contribute up to 4 scrap, with a minimum final cost of 1. This is a prototype economy, not a campaign balance claim.
- Repair rescues local workers; it does not add all of them as train crew or passengers. Actual settlement boarding/recruitment appears in the same card footer. Leaving costs nothing and ends the visit. The route is never changed by dialogue.
- Preparation retains the unresolved event. Cancel and reload return to that decision at no cost. The existing region-appropriate two/three-stage expedition is reused. Retreat or defeat returns to the original decision with wounds retained; retry restarts the stages and awards no earlier-stage loot. Winning grants the existing expedition reward once, then returns through the relic choice to a keeper receipt.
- UI and simulation share requirements; commit checks current resources, crew health and relic ownership. Step tokens reject stale clicks from a preceding reply. Visited settlement guards prevent replaying the visit for more rewards.
- Saves now preserve expedition and relic phases, pending attacks and result summaries. Checkpoints cover dialogue changes, preparation, chamber boundaries, results and relic choices; hiding/leaving the page saves the active task. Loading through the title binds the saved simulation before UI/autosave listeners run.
- Scheduled introductory camera moves cannot cover event/shop/relic/expedition tasks. Legacy event cards now fade in place rather than typing and sliding.
- Immediate retreat already charged one round of Void travel. The UI now discloses that minimum and uses the same cost helper as the resolver. No timing window or damage multiplier changed.
- The title/demo autopilot understands the new preparation state, avoiding a new idle loop when no human UI is active.

## Evidence

- `npm run verify:conversation`: eight size/text combinations; 25 screenshots/states; no failures or page errors. Includes disabled requirements, fixed card/choice coordinates, unclipped button text, keyboard and mocked-controller input, Cancel, full-page reload of an active fight, restored victory/relic selection and the final receipt.
- `npm test`: 54 passed, one optional skipped. Includes natural settlement arrival, old-save compatibility, current-cost validation, relic retention, stale clicks, no-cost cancel, repeated arrivals, minimum Void cost, restored pending combat, retreat/re-entry and once-only reward resolution.
- TypeScript and a production build passed. Seven-size `verify:expedition-cards`, `verify:continuity`, `verify:usability` and six-size `verify:responsive` passed after the new flow and copy. Campaign/export results are recorded at handoff below.
- One unit run exceeded an existing 5-second bounty-test timeout while running beside browser/build work; the sequential rerun passed unchanged. The controller fixture now holds input until a real gamepad poll has observed it, instead of assuming a 150 ms frame interval in software rendering.
- `verify:crew-timing` passed on an unchanged sequential rerun. Its first run missed the short S/Space windows under software rendering; no gameplay timing windows were relaxed. Manual input-feel acceptance remains pending. The usability gate now samples the CSS animation's own clock for the 140 ms hover delay and waits for rendered pause controls instead of relying on a fixed wall-clock sleep.
- Final campaign regression (`node verify/verify.mjs --no-build`, using the freshly built production bundle) passed every required gate, including the three existing bosses, expedition progression, save/load, victory/defeat and determinism; zero console/page errors, warnings or failed requests. The first run exposed a stale canvas-click fixture under the junction overlay. The corrected fixture chooses a branch with the real `1` hotkey and checks the target is canvas before placement/Backspace. No runtime input shield was bypassed.
- Campaign boss fixtures use a boosted/invulnerable train, and the expedition fixture uses Perfect timing. They establish functional progression, not balance. The software-GL run measured 12.7 average FPS; real-GPU performance acceptance remains pending.
- Final standalone build: 6.42 MB. `npm run check:standalone` passed from `file://`: ready/running, all six starter-car images embedded and loaded, conversation scene/portrait/frame embedded, three choices present and arrival → briefing works. Zero unexpected errors; one known optional-audio fallback. No deployment or Git publication accompanied this local handoff.

Screenshots are local/ignored in `verify/screenshots/conversation/`: `briefing-1280-720-0.75.png`, `briefing-800-600-0.75.png`, `briefing-390-844-0.75.png`, `briefing-390-844-1.1.png`, `restored-victory.png`, and `expedition-return.png`.

## Human review on a test run

1. Visit a crossroads and read the keeper's request. Check that the card and numbered choices stay anchored between replies.
2. Compare the baseline choice with a fit Mechanic or an owned Tinker's Kit. Confirm the displayed scrap price, retained relic and resulting marks. These are local workers, not automatic new recruits.
3. Prepare an away team, then Cancel. The same briefing should return without spending anything. Enter a battle and retreat: wounds and the disclosed Void cost remain, but the encounter can be attempted again.
4. Finish the expedition, make the relic choice and return through the receipt. Reload during dialogue, an active fight or results; Continue should restore that task.
5. Try a small window and large text. Report any choice that is clipped or difficult to read. Judge the encounter's cost, duration and reward with ordinary crew; the automated victory fixture does not establish balance.

## Still explicitly pending

- A physical blocked rail link, map marker, alternative-route confirmation, obstruction retry state and the Spike Captain miniboss.
- Resolver-backed enemy intent previews and explicit swap partners. These are the next implementation slice before making away-team combat mandatory on a route.
- Ordinary Good-timing party/pacing playtests; the new dialogue economy and expedition frequency need human acceptance.
- A unique keeper portrait and dedicated conversation scene after composition review. This pass reuses accepted ruin/Conductor art; no new API generation.
- Stable named character catalog, crew XP/unlocks, one/two crew-relic slots, pair synergies and ADS are later milestones, unchanged by this pass.
- Git backup/publication and a verified whole-site staging/production release are separate from this local implementation.
