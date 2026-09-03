# Sprint 05 — Away Team

Status: planned, ready for implementation after the Sprint 04 production release.

## Outcome

Turn expeditions into a second genuinely tactical game layer where the people recruited onto the train become persistent, recognizable combatants. The player should understand who is acting, what every enemy intends to do, why an action is available, and how a good timing input changed the result without reading the combat log.

This is a system-and-interface rebuild. Replacing silhouettes alone is not sufficient.

## Product principles

1. **The same person everywhere.** One character identity, portrait, combat avatar, specialty, level and wounds must carry across the command deck, crew assignment, expedition picker, battle and result screen.
2. **Intent before reaction.** Every hostile action is telegraphed before the player chooses. Timing tests execution; it does not conceal the rules.
3. **Few states, strong consequences.** Guarded, Exposed, Stunned and Burning are preferable to a large stack of minor modifiers.
4. **Timing patterns express the action.** Strike, guard and specialties do not all use the same shrinking ring.
5. **Portraits identify; avatars perform.** Portraits carry personality in information surfaces. Full-body cutouts carry readable action on the battle stage.
6. **The command deck remains the visual parent.** Navy enamel, brass rules, cream tickets, semantic status colors and readable type continue into combat.

## Phase 0 — Baseline and fixtures

Work:

- Capture the current expedition picker, active turn, incoming attack, win, loss and 1280×720 states.
- Add deterministic debug fixtures for each region, every specialty, each standard foe and each miniboss.
- Record current battle length, damage taken, input timing distribution and retreat rate in the verification report.
- Add a dedicated `verify:expedition` command that can enter a battle without walking the campaign there.

Exit gate:

- Fixtures reproduce the same state from the same seed.
- Existing expedition simulation tests remain green.
- Baseline screenshots and metrics are committed to `verify/screenshots/sprint-05/baseline/`.

## Phase 1 — Persistent crew and combat content contract

Work:

- Split immutable identity from run state:
  - `CrewDefinition`: character key, display name, portrait, avatar, specialty, combat discipline, biography and visual accent.
  - `Crew`: character key, car assignment, HP, level, XP, unlocked ability choices and wounds.
- Add defensive migration defaults so current saves load without losing crew.
- Award XP from distance travelled, settlements survived and expeditions won. Use five clear levels rather than open-ended stat growth.
- Levels 2 and 4 each offer one of two authored unlocks. The choice changes an action, target rule or status—not a hidden percentage.
- Add `FoeDefinition`: rank, region, stats, intent deck, resistances, asset key and reward profile.
- Keep the combat state serializable and deterministic. Art URLs and display copy live in definitions, not saves.

Initial level rhythm:

- Level 1: specialty action.
- Level 2: choose one tactical modifier.
- Level 3: modest HP/resolve increase.
- Level 4: choose an advanced action or upgrade the specialty action.
- Level 5: signature passive with a visible trigger.

Exit gate:

- Old save fixture migrates and resumes.
- New crew state round-trips through save/load.
- XP and unlock choices are deterministic and capped.
- No current train-posting bonus changes accidentally.

## Phase 2 — Combat rules rebuild

Work:

- Add three party positions: front, middle and rear. Position changes legal targets and enemy threat, not movement simulation.
- Replace opaque enemy sequencing with a visible intent queue for the remainder of the round.
- Give actions explicit damage, target, timing pattern, cooldown and status previews.
- Add a shared **Tempo** meter: Good and Perfect execution builds Tempo; advanced abilities spend it. Misses never erase an entire turn.
- Define the major-boss handoff: an authored avatar approaches on the world map, telegraphs engagement range, and transitions into this combat layer. Existing roaming elites remain in world combat.
- Use four shared conditions: Guarded, Exposed, Stunned and Burning.
- Replace the nondeterministic-feeling Bribe result with a known contract: spend scrap to force a non-boss foe to withdraw or to Expose a boss.
- Keep the Void pressure cost, but show the exact travel margin before the player commits to another round.

Timing patterns:

- Strike: a marker crosses a clearly labeled impact zone.
- Guard: press after the enemy tell begins and before the impact notch.
- Precision specialties: two-step input, with the second window widened after a Good first input.
- Support abilities: deliberate hold-and-release or target confirmation; never fake difficulty with tiny windows.
- Reduced motion: static lane with the same timestamps and audio/haptic cues.

Exit gate:

- Unit coverage for positions, intent order, Tempo, cooldowns, four conditions, retreat and every specialty.
- One deterministic party can win every standard region fixture using legal player inputs.
- Minibosses cannot be removed by Bribe, stun-lock or a single perfect opening turn.

## Phase 3 — Art system and vertical slice

Work:

- Generate a locked visual sheet for the Conductor, Wren, one Rail Thug and the Greenbelt Spike Captain before batching the roster.
- Each crew member receives one 4:5 portrait and one full-body, stage-facing combat master. Derive thumbnails from the portrait; do not generate inconsistent duplicates.
- Each foe receives one full-body combat master suitable for both the stage and a cropped dossier portrait.
- Require genuine alpha on combat cutouts. Reject baked checkerboards. If generation does not produce reliable alpha, key a controlled flat background and inspect the exported edge matte at 200%.
- Store immutable sources and a manifest with prompts, dimensions, hashes and runtime mappings.
- Animate cutouts with transform, recoil, hit flash, shadow and effect layers; do not require frame-by-frame character animation in this sprint.

Vertical-slice gate:

- The same Conductor is immediately recognizable in command deck portrait, party picker and battle avatar.
- Full-body cutouts have clean edges against all four region backdrops.
- No image exceeds 220 KB at runtime without a documented exception.
- Art remains readable at 1280×720 and under color-blind modes.

Full asset matrix: `CONTENT-MATRIX.md`.

## Phase 4 — Expedition command UI rebuild

Composition:

- **Top mission rail:** site name, miniboss/encounter rank, round, exact Void-time cost and a compact turn timeline.
- **Left party rail:** large portrait cards with position, HP, level, Tempo contribution, cooldowns and visible wounds.
- **Center stage:** authored combat avatars, target relationships, action telegraphs and damage/status feedback.
- **Right threat desk:** selected enemy dossier, current intent, following intent and resistance/status details.
- **Bottom action deck:** three large action cards plus a contextual retreat control. Cards show effect, target, cost, cooldown and input pattern before selection.
- **Combat record:** collapsed by default; expands as a railway telegraph drawer. It supports diagnosis but does not carry essential battle information.

Required invisible states:

- Hover, keyboard focus, selected target, active actor, legal/illegal target, disabled action with reason, cooldown, insufficient Tempo, incoming attack, perfect/good/miss, status applied/expired, downed, victory, loss and retreat.
- First-battle onboarding reveals party position, enemy intent, action choice and timing input one step at a time.
- Keyboard and gamepad navigation use a predictable party → targets → actions → timeline order.

Exit gate:

- Essential body copy is at least 12 px at 1280×720; primary values/actions are at least 14 px.
- Every unfamiliar icon has hover and focus help.
- No overlap or clipped primary action at 1920×1080, 1600×900, 1366×768, 1280×720 and 800×600.
- Screen-reader announcements name actor, action, target, result and changed HP/status without duplicating animation chatter.

## Phase 5 — Roster, monsters and minibosses

Ship the first complete authored set:

- Seven crew identities: Conductor plus one named character for each existing specialty.
- Four standard foes: Rail Thug, Void Hound, Void Shade and Scrap Brute.
- Four region minibosses:
  - Greenbelt — **The Spike Captain:** marks a crew member, then executes a heavy rail-spike swing unless interrupted.
  - Rust Reaches — **Furnace Foreman:** gains armor while the furnace burns; players can target the furnace to apply Exposed.
  - Ash Steppe — **The Ash Cantor:** alternates silence and a delayed area chant; position and Tempo management matter.
  - Void Frontier — **The Gate Warden:** changes intent after half HP and mirrors the last specialty used against it.
- Seven specialty ability glyphs and four shared condition glyphs. These remain clean interface symbols rather than miniature paintings.
- A major-boss encounter shell using the Iron Wagon as the first test: world avatar, approach telegraph, pre-fight readiness state and deterministic transition into battle. Full boss roster content may follow after the shell is verified.

Exit gate:

- Every encounter has a counter-readable intent pattern and at least two viable party compositions.
- Each miniboss demonstrates one mechanic before combining it with another.
- Content validator reports no missing portrait, avatar, intent, ability or accessible label.

## Phase 6 — Balance, regression and production release

Targets:

- Standard expedition: 3–5 minutes and 3–5 rounds on the first attempt.
- Miniboss: 5–8 minutes and 4–7 rounds.
- Good timing is sufficient; Perfect play is an advantage, not a requirement.
- A sensible party at full health has a 70–85% first-attempt win rate in its intended region during human playtests.
- Retreat remains a meaningful choice before the expected cost of the next enemy intents exceeds the reward.

Verification:

- Unit: state migration, XP/unlocks, derived stats, all actions/statuses/intents, rewards and deterministic replay.
- Browser: party selection, target/action loop, each timing pattern, keyboard, gamepad, reduced motion, large text and three color-blind modes.
- Visual: authored-asset presence/load, alpha-edge sample, semantic state snapshots and overlap checks at five viewport sizes.
- Performance: 60 FPS target on the reference GPU; no per-frame DOM allocation; at most seven active combat cutouts and pooled effects.
- Campaign: complete scripted run through standard expedition, miniboss, save/load during an expedition, victory, defeat and return to train.
- Packaging: production build and standalone HTML both load all required combat art without network-relative failures.
- Release: draft deploy, remote acceptance gate, production deploy, custom-domain smoke test.

## Definition of done

- Crew are persistent people rather than specialty labels.
- Their portrait, avatar, level, unlocks and wounds agree everywhere in the game.
- A player can predict an enemy turn and understand every result without opening the log.
- All seven specialties have a useful combat identity and at least one unlock choice.
- Four standard foes and four minibosses are authored, mechanically distinct and visually coherent.
- The expedition screen meets the command deck's visual, responsive and accessibility standard.
- The full deterministic campaign, standalone artifact and production deploy pass.

## Explicitly deferred

- Free-roaming interior train simulation.
- Skeletal or frame-by-frame character animation.
- More than one named recruit per specialty.
- Relationships, romance, permadeath and procedural personality text.
- Voice acting and cinematic miniboss introductions.
