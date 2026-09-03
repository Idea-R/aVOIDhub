# RAILaVOID — Direction Plan (hand-off edition)

Written 2026-09-02 after the second playtest. This is the master plan for the next stretch of work. Each workstream ends with a self-contained prompt you can paste into another agent (GPT, Codex, Claude) with the repo open at `railavoid/`. Read `GAME_DESIGN.md`, `ARCHITECTURE.md`, `BRAND.md`, `STATUS.json` first; they describe what exists.

State of play: the game is live at avoidgame.io/railavoid with three-line routing, upgrades, relics, bounties, expeditions, a scripted opening, a no-overlap HUD, custom cursors and announcement cards. What is not right yet: direction and choice readability on the track, the overall UI feel, the event roster is thin (18), region 2 balance spikes (air enemies with no counter), and there is no in-app dev studio, so every check still costs a run of the game.

---

## Workstream 1 — Direction, choice and reversing clarity

**Problem** (from the screenshot at Maryard Crossroads): the train's heading is not obvious, the two junction options are equal-weight chips with no spatial anchor, and reversing looks like normal driving.

**Design**
- **Heading**: a bright chevron "nose" on the locomotive pointing along the current edge, plus a faint dotted "intent line" from the loco through the planned path to its end, always visible (not only when hovering).
- **Planned path**: pulse runs *from* the loco *toward* the plan end (direction of travel is encoded in the pulse direction), not a static dash.
- **Junction choice**: the chooser buttons and the in-world signage share one colour and one number per branch; hovering/focusing a button lights that branch on the map (thick glow along the first four hexes) and dims the others; the currently selected/planned branch stays lit with a "▶ GOING" tag and the others fade to 40%. Keyboard focus ring equals map highlight.
- **Reversing**: the whole track behind the train tints amber, the loco headlight goes off and both rear lanterns pulse red, a "◀ REVERSING" ribbon sits above the strip, the intent line points backwards, and the engine audio pitch drops. On stop, the re-anchor point flashes.
- **Old vs planned track**: traversed track is dimmed (exists), the *next* tile the train will enter gets a bright ring.

**Where**: `src/render/trainLayer.ts` (nose, lanterns), `src/render/trackLayer.ts` (directional pulse, next-tile ring), `src/render/lineLayer.ts` (branch highlight on hover/focus; expose `highlightBranch(index|null)` on ViewApi), `src/ui/hud.ts` junction chooser (hover → view.highlightBranch), `src/ui/hud.ts` reversing ribbon, `src/audio/ambient.ts` (reverse pitch).

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (Phaser 3.90 + TS, sim/render/ui separated; read ARCHITECTURE.md, src/app.ts ViewApi, src/render/lineLayer.ts, src/render/trackLayer.ts, src/render/trainLayer.ts, src/ui/hud.ts), make the train's heading and route choice unmistakable: add a chevron nose to the locomotive pointing along its current edge; draw a dotted intent line from the loco through the planned path; make the planned-track pulse travel in the direction of movement; add `highlightBranch(index: number | null)` to ViewApi (implemented in lineLayer) that glows the first four hexes of a junction option and dims the others, and call it from the junction chooser on hover/focus and after a pick ("▶ GOING" tag on the chosen one); make reversing obvious (track behind tints amber, headlight off, rear lanterns pulse red, a "◀ REVERSING" ribbon above the strip, intent line pointing back, engine pitch down). Verify with Playwright screenshots at a junction stop, mid-move, and while reversing; keep tsc clean and `verify/ui-overlap.mjs` at zero overlaps.

---

## Workstream 2 — UI reset

**Problem**: the HUD grew feature by feature; it is functional but not yet a single designed system. Density is uneven, hierarchy is flat (everything is a small caps label), and the diagram identity is only in the map, not in the chrome.

**Direction: "the ticket office"**. One material (navy plate with paper-grain), one accent system (gold for player things, violet for the void, coral for danger, line colours for routes), two type sizes for labels, three for numbers, Cinzel only for titles. Components are tickets, stamps and telegrams, not generic panels.

**Concrete changes**
1. **Top bar** becomes a single ticket strip: resources as five stamped counters with fixed widths (no jitter), region/clock as a punched header in the centre, controls right. Height 48px; nothing else in the top 64px.
2. **Left rail** becomes a vertical "signal box": route (plan range, on-line), bounties, relics and log as stacked telegram cards that expand one at a time (accordion), never all at once.
3. **Bottom dock**: the train strip is the hero, 20% taller, each car a small iso card with a level pip row and one status icon slot (never stacked badges); the stop pill and wave banner become one "line status" ticket above it.
4. **Modals** (shop, inspector, event, relic, expedition result): one frame component with a stamp header, consistent button row (primary gold / secondary navy / danger coral), consistent close behaviour (Esc, click outside, X).
5. **Motion budget**: entrances 220 ms, exits 160 ms, one easing curve (`cubic-bezier(.2,.8,.2,1)`), gsap only for count-ups and the cinematic; remove decorative loops except the void meter shiver and the announcement typewriter.
6. **Readability**: minimum label 12px, minimum body 14px, contrast ≥ 4.5:1 on every plate; tooltip cards limited to 4 rows.
7. **Audit**: a UI gallery in the dev studio (Workstream 5) renders every component in every state for screenshot review.

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (DOM UI in src/ui/**, styles in src/ui/styles.css, gsap helpers in src/ui/motion.ts, layout zones in src/ui/layout.ts, brand rules in BRAND.md), redesign the HUD as one system called "the ticket office": a 48px top ticket strip with fixed-width stamped resource counters, a left "signal box" accordion (route, bounties, relics, log), a bottom dock where the train strip is the hero (taller iso car cards, one status icon slot, level pips) with a single line-status ticket above it, and one shared modal frame (stamp header, primary/secondary/danger button row, Esc/outside/X close) reused by shop, inspector, event, relic and expedition result. Two label sizes, three number sizes, Cinzel for titles only, 220/160 ms motion with one easing, contrast ≥ 4.5:1. Keep every existing behaviour, `data-panel` attributes, reduced motion, gamepad, and `verify/ui-overlap.mjs` at zero overlaps across 1920/1600/1366/1280. Deliver before/after screenshots of title, running HUD, shop open, junction stop, event modal, expedition.

---

## Workstream 3 — Events and internal conflicts

**Goal**: 45–50 events with real consequences, plus a light **crew conflict** system so the train feels crewed.

**Structure**
- **Tiers**: common (28: supplies, weather, morale), region-exclusive (4 × 4: Greenbelt refugees, Rust Reaches labour disputes, Ash Steppe sickness/ash, Frontier void cults), rare (6: unique relic offers, secret spur lines, the "ghost train"), shrine-style service events (6).
- **Chains**: some events set flags (`state.flags`) that unlock follow-ups later in the run (e.g. spare the deserters at Kelspur → they return with ammo at a crossroads; refuse → they sabotage a bounty). Three chains in the first pass.
- **Crew conflicts**: each crew member gets two traits (e.g. Greedy, Pious, Brave, Cautious, Loyal, Bitter). Events check traits: a Pious medic objects to selling shrine offerings; a Greedy quartermaster demands a cut of marks; two Bitter crew fight and one must be assigned apart (adjacency again). Resolution options can promote a trait to "Devoted" (bonus) or "Resentful" (malus, may quit at a yard). Morale becomes per-crew and rolls up.
- **Consequence surfacing**: every choice writes a one-line "ledger" entry with the effect; the results screen shows the ledger.
- **Art**: each event gets a 3:2 illustration from BRAND.md prompts; the modal shows it above the telegram text.

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (events are data in src/core/passengerEvents.ts and resolved in src/sim/simEvents.ts; crew in src/core/types.ts Crew; UI modal src/ui/eventModal.ts), expand the event system to ~48 events in tiers (common, region-exclusive, rare, service), add `state.flags` for three event chains with follow-ups, add crew traits (two per crew from a set of eight) with trait-gated options and Devoted/Resentful outcomes, per-crew morale rolled up into train morale, and a run ledger of choices shown on the results screen. Keep events deterministic via ctx.rng.events, unit-test chain resolution and trait gating in src/sim/*.test.ts, and add an `art` field per event pointing at public/art/events/<id>.webp with a graceful fallback when the file is missing.

---

## Workstream 4 — Balance review (what went wrong in region 2)

**Findings from the playtests and probes**
- **No anti-air counter when air arrives.** Harpies appear from region 2 (weights [0, 2, 7, 5]); the starter train has only a gatling (ground only). The first Flak/Tesla costs 40/75 scrap at a yard, but region 1 scrap income is ~50–70 and the first yard often comes after the first harpy wave. This is the "little flying orb minions" wall. **Immediate mitigation applied**: harpy weight is now 0 in region 2 and ramps in region 3, and gatlings get a weak anti-air mode (25% damage) so nothing is unanswerable.
- **Scrap economy is flat**: salvage drops and bounties help, but the first yard purchase should be reachable by the end of region 1 for a player who fights well. Target: 80–100 scrap by the first yard.
- **Damage upgrades arrive late**: car levels require a yard; add field alternatives (a Foundry converts scrap to ammo, but nothing converts scrap to damage). Proposal: **Workshop car** (tier 1, 28 scrap) that lets you apply one car level per 60 s while moving, at 1.5× cost.
- **Wave pacing**: intervals 38/34/30/27 s are fine at 0.38 hex/s, but stop pressure in the wild doubles frequency quickly; add a 15 s grace after leaving a haven.
- **Elites** need a visible tell 3 s before the wave (the warning banner should name "ELITE").

**Method**: run the headless balance probe (`PROBE=1 npx vitest run src/sim/probe.test.ts`) with three canned strategies (turtle: buys defence; rusher: buys speed; trader: hoards marks) and record time-to-death, scrap curve and cause of death per region; iterate numbers in `src/core/config.ts` and `src/core/enemies.ts` until all three strategies reach region 3 and at least one wins with good play. The dev studio's Balance Lab (Workstream 5) automates this.

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (tuning in src/core/config.ts, enemies in src/core/enemies.ts, wave director in src/sim/waves.ts, headless probe src/sim/probe.test.ts), build a headless balance lab test that runs three scripted strategies (turtle/rusher/trader) over seeds 1–10 and writes a CSV (seed, strategy, death time, death cause, region reached, scrap at first yard, first anti-air purchase time). Then tune so all strategies reach region 3 on average and the turtle wins ≥ 30% of seeds: fix air enemies arriving before any anti-air is affordable (gate harpies until a flak/tesla was offered or give gatlings 25% anti-air), target 80–100 scrap by the first yard, add a Workshop car that applies car levels in the field, add a 15 s wave grace after leaving a haven, and name elites in the wave warning. Keep all existing unit tests green.

---

## Workstream 5 — Agent Dev Studio (ADS) for RAILaVOID

Mirror the Bloomfall studio (docs/agent-first-game-dev-studio.md in that repo): instruments instead of anecdotes. RAILaVOID is a Vite/Phaser app without a router, so the studio is a second entry point: `dev.html` → `src/dev/main.ts`, excluded from the production build unless `VITE_DEV_STUDIO=1`, and gated at runtime by the `?dev=<owner token>` query (token in `.env.local`) plus `noindex`. Player code never imports from `src/dev/**`.

**Invariants already satisfied**: seeded generation (mulberry32 streams), JSON state, headless sim, `window.__RAIL` hooks, deterministic tests. Add: `src/sim/placement.ts` as the single "may this spawn here" contract used by waves, loot and node placement; a report pile with `open/fixed/archived`.

**Surfaces (build in this order)**
1. **Map Review** (`/dev.html#maps`): flat 2D canvas of a seed: terrain, three lines by colour, hubs, settlements by type with deadlines, threat heat-map, void front over time (scrub 0–30 min). Reroll seed, layer toggles, legend, click a tile for its record. Headless audit button: lines connected, every region has yard/fuel/crossroads, no settlement on mountain/water, void reaches the terminus after ≥ 25 min at base speed.
2. **Balance Lab** (`#balance`): run N seeds × strategies headlessly in a worker, chart scrap/HP/void margin over time, death causes, per-wave DPS vs HP; diff two config snapshots.
3. **Proving Yard** (`#yard`): the real engine on a flat rig with the train parked: spawn desk (any enemy type, count, elite toggle, side), train desk (compose any car list, set levels, assign crew), freeze/step/clear/heal hotkeys, live stats (dps by car, heat, power ratio), damage numbers on; a boss rig with all three bosses; an expedition rig that opens the timed-hit scene with chosen crew/foes.
4. **Scene Stage** (`#scenes`): play any cinematic (opening, region, boss, victory, defeat) with a scrubber, edit shot timings/zooms in a JSON that the render reads (moves timings out of code), preview announcement cards and event modals with arbitrary text/art.
5. **UI Gallery** (`#ui`): every HUD component in every state (empty, low, full, damaged, boarded, disabled, reversing), every modal, at 1920/1366/1280, with the overlap checker inline.
6. **Asset Studio** (`#assets`): car textures, settlement clusters, enemy sprites and the new painted art side by side with anchor/scale nudges persisted to `public/art/anchors.json` and streamed live to the renderer.
7. **Report Pile** (`#reports`): right-click-drag on the map/yard captures seed, tile, sim time, nearby actors, a cropped snapshot and a note; statuses and markdown export.

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (Vite + Phaser + TS; deterministic sim in src/sim with window.__RAIL hooks in src/debug/devApi.ts; read ARCHITECTURE.md), build an Agent Dev Studio as a second Vite entry `dev.html` → `src/dev/main.ts`, gated by `?dev=<token>` (VITE_DEV_TOKEN) with noindex and excluded from the player bundle, with these surfaces as hash routes and a left nav: Map Review (flat 2D canvas of a seed with lines, hubs, settlements, threat and a void-front time scrubber, layer toggles, reroll, headless audit), Balance Lab (worker-run headless sims across seeds and scripted strategies with charts and config diff), Proving Yard (real engine on a flat rig: spawn desk, train desk, freeze/step/clear hotkeys, live dps/heat/power, boss and expedition rigs), Scene Stage (play/scrub cinematics with timings in a JSON the render reads; preview announcements and event modals), UI Gallery (every component in every state at three widths with the overlap checker), Asset Studio (anchors/scales persisted to public/art/anchors.json and streamed live), and a Report Pile (right-click-drag capture with seed/tile/time/actors/snapshot/note, open/fixed/archived, markdown export). Add src/sim/placement.ts as the single spawn-legality contract and route waves/loot/node placement through it. Follow the Bloomfall studio conventions in C:\dev\Bloomfall\docs\agent-first-game-dev-studio.md. Keep tsc clean and add a headless audit script `npm run audit:map`.

---

## Workstream 6 — Art drop-in

Generate with the BRAND.md prompts and place under `public/art/**`; wire: event card illustrations (3:2) in the event modal, relic icons (1:1) in the chooser and relic bar, region title cards (21:9) behind the region cinematic card, five painted cutscene frames layered under the opening's cards with a slow push-in, crew portraits (4:5) in the picker and expedition scene, key art on the title and the platform catalog.

**Prompt**
> In `C:\dev\aVOID\games\rail-avoid` (art direction in BRAND.md; UI in src/ui/**; cinematic cards in src/ui/cinematic.ts), add an art manifest `public/art/manifest.json` and loaders with graceful fallbacks, then wire illustrations into the event modal, relic chooser/bar, region cards, the opening (painted frames under the cards with a slow push-in), crew picker/expedition scene and the title screen. Files follow the naming in BRAND.md §5.

---

## Order of operations
1. Workstream 4 quick mitigations (done) → Workstream 1 (small, high impact) → Workstream 5 surfaces 1–3 (they make everything after cheaper) → Workstream 2 → Workstream 3 → Workstream 6 → Workstream 5 surfaces 4–7 → balance passes in the lab until three strategies reach region 3.
2. After each workstream: `npm run test`, `npm run verify`, `npm run perf:headed`, then rebuild the monorepo distribution and deploy through the platform workflow described in README.md.
