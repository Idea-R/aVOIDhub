# RAILaVOID — Improvement Roadmap

Status after the first public early-access deploy (avoidgame.io/railavoid). Ordered by player impact.

## Completed sprint: Command Deck Rebuild

- [x] Replace the top stat ribbon with a two-tier command deck.
- [x] Replace compressed train cards with large rolling-stock schematics.
- [x] Embed crew stations, operational state, hull, heat, power, and supply directly in each car.
- [x] Recompose the car inspector as a matching equipment bay.
- [x] Generate and integrate authored art for the six-car starter consist, with Gatling I–III upgrade variants and procedural fallbacks for the wider roster.
- [x] Preserve direct crew focus/posting and existing game controls.
- [x] Complete focused, overlap, full-game, build, and standalone verification.

Detailed plan: `docs/sprint-04/PLAN.md`. Review: `docs/sprint-04/REVIEW.md`.

### Post-release usability patch

- [x] Add a saved 75–110% interface-size control, defaulting to 75%, without shrinking essential text into illegibility.
- [x] Separate resources from operations in the top deck and preserve a compact, complete 1280×720 layout.
- [x] Rebuild repair-yard train cards and distinguish rolling-stock levels from the locomotive's four engine-system tracks.
- [x] Make settlement clicks plan to the destination or its closest legal approach tile.
- [x] Add a map-oriented junction dial with track direction and destination labels.
- [x] Replace the fog colour film with discrete drifting cloud banks and expose each weather effect in the HUD.
- [x] Give the locomotive a weak, ammo-free conductor guard so losing the only weapon car is not an unrecoverable combat state.
- [x] Make the Repair Yard an exclusive workspace that automatically collapses the rolling-stock deck and car inspector.
- [x] Clarify that ballistic weapons draw from the shared ammo reserve only when Cargo Hold, Foundry or Armoured Cargo is within two car positions; include 12 commissioning ammo with a newly bought ballistic weapon.
- [x] Sort junction choices by the branches' real map positions, label their compass direction and make a selection explicitly resume a paused journey.
- [x] Put a prominent Resume action in the play area whenever time is paused; the top pause control also changes to a play symbol.
- [x] Slow the route rail's hover reveal and animate its contents as one component instead of instantly popping rows in and out.
- [x] Remove the redundant full-screen first-junction announcement that competed with the actionable junction dial.

Verification and implementation notes: `docs/sprint-04/USABILITY-PATCH.md`.

## Next sprint: Away Team (in progress)

- [ ] Establish deterministic expedition fixtures and a dedicated browser verification command.
- [ ] Add persistent crew identity, XP, five levels and two authored unlock decisions.
- [ ] Rebuild expedition rules around party positions, visible enemy intents, Tempo and four shared conditions.
- [ ] Generate consistent portrait/combat art for seven crew, four standard foes and four region minibosses.
- [ ] Replace the current expedition layout with a command-deck-quality party rail, stage, threat desk and action deck.
- [ ] Balance standard encounters and minibosses, then complete campaign, standalone and production verification.

Detailed plan: `docs/sprint-05/PLAN.md`. Art/content matrix: `docs/sprint-05/CONTENT-MATRIX.md`.

Sprint 03 (readability and crew discovery) is archived in `docs/sprint-03/`.

## 1. Feel and pacing (in progress)
- [x] Faster train (0.42 hex/s), shorter settlement stops (12 s), 12 s post-haven wave grace, reversing.
- [x] Custom cursors, hover feedback on settlements/cars/hexes, no-overlap HUD layout, compact HUD, volume mixer (ambience/UI), log hidden by default.
- [ ] "Express" toggle: 1.5× default sim speed for veterans, saved in settings.
- [x] Three main lines (Central / Northern / Southern) with crossovers; junction chooser shows line names and the next settlement on each branch.
- [x] Auto-route a clicked settlement to the destination or nearest legal approach tile.
- [ ] Add a route confirm chip ("12 hexes · 6 rails · 40 s") for long auto-routes.

## 2. Train mechanics and upgrades (first pass shipped)
- [x] Car levels I–III at yards (+HP, +damage, +power, +storage, +passengers, +cooling).
- [x] Locomotive tracks: Speed, Boiler pressure, Reinforced frame, Track crew.
- [ ] Specialisation choice at level III (e.g. Gatling → Twin-Link (rate) or Hardened (armour-piercing)).
- [ ] Coupling rules: heavy cars slow cornering on hills; armoured cars protect neighbours from shells.
- [ ] Field repairs between yards: Mechanic crew can spend scrap while moving (slow), Repair Drone car (tier 2) heals neighbours; hull "dent" states visible on the model.
- [x] Crew assignment discovery pass: persistent CREW READY ticket, direct car-inspector handoff, specialist effect copy, crew-posting tutorial.
- [ ] Crew as characters: generated portraits, two specialties/traits each, a short bark line on assignment.
- [ ] Add capacity-based crew stations rather than one universal slot: most cars start at one; selected level-II work cars unlock a second; Barracks/crew accommodation can reach three; the locomotive's second station requires a dedicated **Cab Crew** engine upgrade.
- [ ] Make roles legible and useful across the consist: Conductor is a unique command role, Gunners operate and improve weapons, and Hands provide modest close-defense/repair/reload value on ordinary cars. Posted crew may give a car a weak defensive response, but do not turn every logistics car into a full turret.
- [ ] Add visible car-to-car supply tracing in Train and Yard views so selecting a weapon highlights the supplier feeding it and any broken adjacency link.

### Service geography

- [x] Full Repair Yards repair, buy, sell, upgrade and reorder the consist.
- [ ] Add clearly marked **Rail Sidings** at selected non-yard settlements for reorder-only service. Target at least one useful siding per region, preview it in route information and preserve Repair Yards as the only place for structural upgrades.
- [ ] Add a route-map service legend and settlement tooltip that distinguishes Yard, Siding, Market and Haven before arrival.

### Future feature: Inside the train / Crew View
- [ ] Phase A — schematic cutaway: click **View Crew** or zoom into a car; show a performant 2D cutaway with crew station, assignment slot, health, level, XP and specialty effects. Reuse one interior shell per car role and sprite-sheet crew at 8–12 fps.
- [ ] Phase B — living train: crew walk only between a small set of authored stations; no free pathfinding. Suspend off-screen animation and cap the active interior at 8 crew / 12 ambient props / 24 particles.
- [ ] Phase C — crew progression: XP from distance travelled, settlements survived, battles and expeditions; levels unlock one of two specialty upgrades plus a secondary trait. Avoid random stat soup—every choice must change a visible job.
- [ ] Phase D — synergies and incidents: Gunner + weapon, Engineer + generator, Mechanic + damaged hull, Medic + occupied coach, Surveyor + Scout, Quartermaster + Cargo. Interior events and bark lines reflect current assignments.
- [ ] Performance gate: Crew View must hold 60 fps on the project reference machine, allocate no per-frame DOM nodes, pool sprites, and simulate off-screen crew at coarse 0.5 s ticks.

## 3. Journey nodes (Slay the Spire density)
- [x] 4 new node types: Watchtower (early warning), Shrine (boon choice), Wreck (salvage / free car), Market (trade).
- [x] 24 events: 14 passenger, 5 fixed-location and 5 concealed-signal encounters. Target 45–50, in tiers: common (25), region-exclusive (4 × 4), rare (6), shrine-style (6).
- [ ] Each event gets a painted card illustration (generated on-brand: violet void, gold rail, ink-and-wash miniature look) and a small consequence tag row.
- [x] First event-room pass: `?` signals sit directly on every region's main lines and conceal cache/relic, crew combat, train ambush, distressed crew and damaged weapon-car outcomes until arrival.
- [ ] Add region-specific concealed-event pools and multi-stop follow-up chains.
- [ ] Boss "hangar" nodes with a pre-fight prep choice (Spire elite-style rewards).
- [ ] Weather-specific event pools: obscured threats and navigation dilemmas in fog, washouts/rescues in rain, heat and visibility incidents in ashfall and storms. Always preview the mechanical consequence before a choice.
- [ ] Author bridge track tiles for legal water crossings instead of letting ordinary track terminate visually at a shoreline.
- [ ] Add water-edge destinations—dock, ferry landing, fishing camp, rescue and smuggler berth—with events tied to their shoreline placement. Open water remains impassable except at authored bridge/ferry links.

## 4. Presentation
- [x] Cinematic run intro, region cards, boss intros, victory/defeat cameras, letterbox cards.
- [ ] Opening cutscene: 25 s shot list (void swallowing Lastlight, train pulling out, title card) with the Suno theme; skippable, once per profile.
- [x] Component-level command-deck HUD rebuild while preserving the current world style.
- [x] First production rolling-stock art slice: starter consist plus visible Gatling upgrade progression.
- [x] Second production rolling-stock art slice: Flak Battery, Cannon Car, Radiator Car and Medical Car (10 of 22 car types now authored).
- [ ] Complete authored rolling-stock art for the remaining 12 car types and their meaningful level-III silhouettes.
- [ ] Generated production key art for the title, catalog card and each region's title card.
- [ ] Boss intro vignettes (2–3 panels) and a short victory sequence at the Last Gate.
- [ ] Major bosses appear as authored world avatars that approach the train, then hand off to the Away Team combat layer. Keep roaming elites as readable open-world pressure rather than converting every threat into a modal battle.
- [ ] Menus: unified panel system with tabs (Train / Crew / Journey log / Settings), controller focus rings, and a map overview (minimap with void front and settlement deadlines).

## 5. Balance
- [x] First deterministic pacing pass: faster train, larger starting reserve, lighter early waves/elites, safer starter hulls, post-haven grace, first-boss escape route and counter messaging.
- [x] New purchases couple ahead of the Caboose, preserving its rear-guard role and keeping an early Cannon inside Cargo ammo range.
- [ ] Human playtest pass per region with telemetry (deaths by cause, time per region, scrap spent per car type). Current deterministic probe now reaches the Brood Mother instead of dying at the Iron Wagon; validate across player skill levels.
- [ ] Region 3–4 pressure vs. Tesla/Flak affordability; Void Maw readability.
- [ ] Difficulty presets (Scenic / Standard / Blackout) and daily seed.

## 6. Platform
- [x] Live at avoidgame.io/railavoid via the aVOIDhub platform catalog.
- [ ] Platform leaderboard adapter (score scope → "platform") once the run summary is bounded and replayable.
- [ ] Longer combat track (second Suno take) and per-region ambient stems.

### Agent Development Studio (ADS)

- [ ] Build ADS as a shared aVOID Games platform tool, not a second RailAVOID login. Reuse the existing `/login` session and require the server-assigned Supabase `app_metadata.platform_role=admin` role; never expose a client-side admin selector.
- [ ] Verify the `shane@ideas-realized.com` account in the shared platform before assigning or changing any production role. Account creation and role grants require a separate, explicitly confirmed platform operation.
- [ ] Ship a staging-only RailAVOID workspace first: deterministic seed launcher, region/settlement teleport, encounter and boss fixture palette, scene/portrait browser, train composition editor, asset-placement coordinates, and snapshot/restore.
- [ ] Separate staging data from production runs and leaderboards. Every mutating tool shows the active environment and seed; production mutation is out of scope for the first ADS release.
- [ ] Add content validation for missing art, unreachable encounter choices, invalid rewards, enemy intent loops, and viewport collisions before an encounter can be promoted.
- [ ] After the encounter-depth slice is proven, expand ADS into a reusable game-owner portal for other aVOID titles rather than hard-coding RailAVOID assumptions into platform auth.
