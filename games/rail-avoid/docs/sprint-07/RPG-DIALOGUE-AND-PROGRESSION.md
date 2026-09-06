# RPG dialogue, shortcuts and the content gap

2026-09-05 follow-up. This UI pass is local, not published. It builds on `8f476fe` without enabling blocked-track spawning or importing the Blender pilot.

## Actual content inventory

- One expedition rules/structure family. Ruin sites, question-mark away missions and the Keeper's crossroads dialogue all call the same stage generator. They are three entrances, not three distinct adventures.
- Four fixed region sequences: Greenbelt and Rust Reaches have two stages; Ash Steppe and Void Frontier have three. There is no seeded per-location roster variation.
- Three battle backgrounds: Outer Works, Buried Concourse, Void Sanctum. Every expedition starts at Outer Works and uses that same descent order.
- Eight defined/art-backed foes: Rail Thug, Void Hound, Void Shade, Scrap Brute, Ash Cult Fusilier, Rail-Maw Crawler, Lantern Wraith, Iron Sentinel. Six appear in normal stage tables; Shade and Brute are unused there. Barricade's local fixture reuses the Greenbelt sequence, not a new content family.
- Seven crew specialties and seven fixed Specials. No crew XP, levels or ability unlocks exist in `Crew`, expedition resolution or save data. Enemy `xp` fields are legacy score metadata; they do not award crew experience. World kills currently add `SCORE.kill` to run score instead.
- The Keeper is the one stateful NPC dialogue chain, with mechanic/relic checks and goodwill. Other encounters are event choices, not bespoke NPC conversations. Main bosses still fight in the world; the Spike Captain expedition miniboss remains planned.

## This implementation

- C continues from stage/result/visit receipt, starts the selected team and resumes pause. Enter/Space retain native focused-control behavior; C never chooses among dialogue or relic branches. 1–9 choose the current screen's numbered options. Esc cancels where safe; F retreats in combat. Existing action S/G/E/W/F, route and speed keys stay unchanged.
- Visible key badges and a Controls explanation. Ignore held-key repeats and browser modifier combinations; stop numeric events leaking into world speed after an event/relic closes.
- Fixed two-person crossroads conversation: accepted Conductor avatar on the left, Mara's own native-alpha upper body on the right, speaker-labelled text immediately below. Full text, no typewriter delay, fixed control positions and responsive overflow. Existing choices/costs/save-safe receipt are unchanged.
- Mara uses explicitly selected GPT Image 1.5 via the bundled CLI, native `background=transparent`. V1 is selected after inspecting actual light/dark composites. The image viewer showed hidden RGB color outside the silhouette; an initial partial-alpha-count heuristic incorrectly rejected it. V2 correction and V3 regeneration were tried before proper compositing revealed V1 was clean and the best style match. They are not runtime assets. Preserve alpha; do not infer a halo merely from near-opaque interior pixels or an RGB preview. Prompt files and deterministic export script accompany the source.

## Next bounded content/progression work (not implemented here)

1. **Encounter identities:** persist an encounter-definition ID and seed. Author three genuinely different two-stage profiles: keeper rescue (disrupt guards to reach workers), rail ambush (telegraphed captain plus escort), and void ruin (rear-targeting Shade pressure). Different objectives/rosters/scene order, not three new names on the same fight. Keep old saves on the legacy profile; choose tables once, not again on reload. No new bulk art batch before the first playable profile is accepted.
2. **Crew experience:** save-stable crew identity; bounded participation XP at completed stages, including the Conductor; a once-only reward ledger; explicit +XP/level progress on results and crew details. Define retreat/downed awards and caps before tuning. Add one authored unlock decision first, without silently changing station bonuses. Require old-save migration and reload/retreat/no-farming tests. Do not label marks or run score as XP.
3. **Variation gate:** two ordinary party compositions, wounded runs and Good timing; record rounds, wounds and Void cost. Verify meaningful tactical differences and accessible retreat. Then decide event frequency and introduce a miniboss. A solver win or additional enemy illustration is not proof of balance.
4. **Later:** individual recruit identity/portraits, one or two equipped crew relics and pair synergies. No full gear inventory or cross-platform account changes in this pass.

## Verification record

- 89 unit tests passed, one optional skipped. An initial concurrent run exceeded the existing five-second deterministic-test timeout while two software-rendered browser suites ran; an unchanged isolated rerun passed. No gameplay/test limits changed.
- `verify:dialogue-shortcuts`: five dialogue viewports, actual C/Enter/F/numeric flow, repeat/modifier rejection, native Cancel/Retreat, result/relic/pause continuity passed without page errors. Screenshots: `verify/screenshots/dialogue-shortcuts/`.
- `verify:conversation`: 25 states, normal/large text through 360px and 844×450 landscape, stable choice geometry, costs, keyboard/controller, save/reload and expedition return passed. Large text initially clipped reply cards; increased their reserved height. Short dialogue panes scroll independently when needed.
- `verify:expedition-cards`: seven viewports, frame alpha, loaded images, action and crew-selection flow passed. Typecheck and production build passed.
- Portable build and offline test passed: both dialogue images/frame embedded, no unexpected browser errors (one pre-existing optional-audio fallback). New Mara image is 81,744 transfer bytes, 480×600, 1,152,000 decoded RGBA bytes (~1.10 MiB). No 3D or Phaser rendering changes; representative GPU/frame-time comparisons were not performed, so this is functional/visual evidence, not a claim of improved performance.
- Final art: [runtime](../../public/art/npcs/mara-dialogue-v1.webp), [native PNG master](../../output/imagegen/native-alpha/mara-dialogue-v1.png), [generation prompt](mara-dialogue-prompt.txt). Explicit GPT Image 1.5 CLI; genuine alpha checked on light/dark backgrounds at `verify/screenshots/dialogue-art/mara-edges.png`. No background keying or alpha replacement. Alternatives remain unintegrated.
- Production remains PR #62. This local pass does not add XP, new encounter profiles, world spawning, Blender replacements, platform-wide remapping or a deployment. Existing command keys elsewhere are preserved; C is the common RailAVOID continuation convention, not a claim that every action in every aVOID game is now mapped.
