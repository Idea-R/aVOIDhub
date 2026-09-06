# Route sketch and complete crew artwork

Local implementation candidate, 2026-09-04. Not published and not a claim of campaign balance.

Visual update: the user subsequently rejected the cool translucent battle cards. See [Expedition card revision](EXPEDITION-CARD-PASS.md) for the current ink-and-brass treatment; route geometry, crew identity and input behavior described here are preserved.

## Player-facing changes

- Junction choice is a floating rail sketch with a branded heading. There is no enclosing panel or destination-button tray. Click a numbered stop node, use its number key (1–6 as available), or the existing gamepad mapping. Choosing still resumes the journey.
- The simulation supplies connected rail tiles. The sketch previews up to six edges using one uniform map projection, preserving bends and compass orientation. Labels report the next known stop and full distance; a far-off destination can lie beyond the displayed six-edge preview. Labels reposition to avoid collisions without moving the rails or nodes. This is a local route sketch, not a promise that choosing commits a whole journey through later junctions.
- World signage and hovercards are suppressed while the sketch owns the decision. Route and train tools remain available. Resize updates the sketch; small screens keep the map-first deck collapsed by default.
- Every current crew specialty has an authored avatar and portrait: Conductor, Engineer, Gunner, Medic, Surveyor, Mechanic and Quartermaster. Party selection, assignment, crew roster, battle and results share specialty art. These are **generic specialty illustrations**, not new persistent named identities. Multiple recruits of one specialty currently share art; save schema and names are unchanged.
- Battle commands sit in transparent layout wrappers with restrained individual action backgrounds. The active character and target use nameplate accents, not an overhead arrow, number or spinning reticle. The battle log opens on request at every screen size. Duplicate stage/round readouts were removed from the Void ticker.
- Timing accepts Space or Enter throughout, S during Strike, E during timed Special and G during an incoming block. Holding a key cannot auto-judge the next window. Mouse/touch and gamepad A remain alternatives. Guard's initial brace and Conductor Rally remain deliberately untimed actions.
- Delayed battle callbacks are cancelled on close and stage rebuild. A stress test restarting directly after a guard exposed an old callback reaching the next timing window; the same test now passes, including touch followed immediately by Space resolving only once.

## Native-alpha generation record

Used the bundled `imagegen/scripts/image_gen.py` CLI, explicitly authorized by the user. Every paid call used `edit --model gpt-image-1.5 --input-fidelity high --background transparent --quality high --size 1024x1536 --output-format png --no-augment`. No alternate model/base URL or automatic model fallback was configured by this pass. Windows User-scope OPENAI_API_KEY was loaded only into the child process; no credential values were logged or persisted.

Seven sequential successful requests produced six accepted new characters. The existing Conductor was retained. The Gunner pilot used a lossless PNG copy of `public/art/crew/conductor-combat.webp`; its first version contained a faint background wash and failed verification. A native-alpha correction preserved that character and removed the wash. The other five roles used the corrected Gunner as the style/clean-alpha reference. The prompt boilerplate refers to the original Conductor style; the actual reference paths are recorded here to disambiguate the requests.

Exact prompt set: `crew-prompts/*.txt`; Gunner correction: `crew-prompts/alpha-correction.txt`. The rejected pilot is preserved under ignored `output/imagegen/rejected/crew-gunner-v1-background-wash.png`, not used by the game. It was moved, not deleted.

Accepted PNG masters live in `output/imagegen/native-alpha/crew-*.png`. Runtime avatars and matching portrait crops live in `public/art/crew/`. Source/runtime SHA-256 hashes and filenames: `CREW-ART-MANIFEST.json`. Production encoder: `tools/export-crew-avatars.mjs`.

All accepted sources passed the existing native verifier and were inspected on cream and navy. Native outputs retain a handful of almost invisible alpha 1–2 edge pixels; the established framing gate checks alpha >8. Encoding preserves those pixels: **no keying, alpha thresholding, mask reconstruction, backdrop painting or background removal**. Runtime sprites add fully transparent padding and have zero-alpha corners. Portraits are deliberate upper-body crops of the same master, not independently generated identities. Six avatar WebPs total about 220 KB; portrait crops add about 50 KB.

## Verification

- Unit suite: 41 passed, one optional test skipped, including real rail traces, no repeated trace tiles and no void crossing.
- Typecheck and game build passed after the final callback fix. The standalone package builds to 6.37 MB with all referenced image assets embedded.
- `verify:route-overlay`: actual existing rail edges, clickable nodes and label bounds at 1280×720, 800×600, 390×844 and 1920×1080.
- `verify:crew-timing`: six runtime alpha/padding checks; all seven specialties rendered across three parties; no procedural crew, overhead arrows, numbers or reticles; S, Space, E and G timing; repeat suppression. Endurance fixture has inflated enemy HP for input testing and is **not balance evidence**.
- Screenshots live under ignored `verify/screenshots/route-overlay`, `crew-timing` and `map-first` directories.
- A development responsive run failed because the old diagram wrapper had no measurable height; the new overlay wrapper now has an explicit footprint. A later run was interrupted by Vite reloading during source edits. The sequential frozen-source responsive rerun passed at 1920×1080, 1455×943, 1280×720, 1024×768, 800×600 and 390×844, including large text and explicit drawers.
- The legacy junction gate needed a 15-second/100-ms DOM polling wait rather than a 5-second animation-frame wait on this software-rendered host; it passed with the longer wait. Actual-rail overlay/node activation and label-collision checks passed at four viewport sizes.
- Staged expedition gate passed: six illustrated mystery events, enemy native alpha, formation/swap, stage choice and stage-two scene handoff. Software-rendered browser checks are functional evidence, not a real-GPU performance claim.
- Final callback-fix reruns passed: all crew/timing/touch checks and staged scene handoff. Chrome `file://` standalone smoke passed with six embedded/loaded starter car images and no unexpected errors; one expected optional-audio fallback was ignored. Full campaign, save/load and real-GPU performance were not re-run in this pass.
- Candidate remains on `codex/railavoid-map-first-ui`, uncommitted and unpublished. Local preview: `http://localhost:5178/RAILaVOID/`. The live aVOID Games site is unchanged.

## Next bounded sprint: make expeditions a pillar

1. **Intent and formation.** Expose enemy target/range/next action from the same resolver used by combat; replace next-ally Swap with an explicit partner choice. Gate: preview equals resolution without advancing RNG; cancellation/downed allies/keyboard/touch remain safe.
2. **One complete miniboss expedition.** Author an approach event, two stages, one recognizable miniboss with a visible tell and two counters, and a single reward/return flow. Reuse approved art until the encounter is proven. Gate: ordinary and wounded parties can complete or retreat on Good timing; no debug grants used as balance evidence.
3. **Boss encounter entry prototype.** In an isolated fixture, a world boss avatar approaches and opens a clear expedition engagement/preparation choice. Test interruption, defeat, retreat and return-to-train ownership. Keep roaming train attackers and elites as travel pressure; do not silently convert every world boss yet.
4. **Measured expansion and release.** After the loop passes, commission the specific miniboss/boss and scene gaps it needs, then expand special-event variety. Run normal-loadout tuning, save/load, campaign, standalone, actual-GPU performance and whole-site preview gates before promotion.

Supply tracing remains a high-value parallel backlog item. Persistent crew identity/XP, multi-crew stations, bridges and ADS authentication are separate contracts, not hidden scope in this UI pass.
