# Expedition card UI revision

Local review candidate, 2026-09-04. No commit, push or deployment in this pass.

## Direction

The user rejected the previous expedition's cool translucent action surfaces. This revision uses the existing frame atlas and rolling-stock cards as references: solid navy enamel, warm brass hardware, cream type and restrained violet corners. The scene and transparent avatars stay exposed between individual components. There is no full-width opaque command tray.

The dense-UI skill guided the split between primary commands, utilities and secondary logs. The image-generation skill supplied one reusable native-alpha border rather than baking labels into artwork. The writing skill guided brief, literal interaction labels: timed attack, immediate rally and brace now. Combat rules and rewards were not changed.

## Implemented

- Three framed command cards for Strike, Guard and the active crew's specialty, with smaller Swap/Flee controls. An active-crew portrait/nameplate anchors the hand on taller screens.
- Character and enemy status plates use the same frame, with explicit Ready, Your move, Guarding, Selected target and Defeated labels. No overhead arrow, turn number or reticle was restored.
- Crew selection, stage decisions and victory/retreat results share the same opaque enamel and brass vocabulary. The existing seven specialty avatars/portraits are reused.
- The timing banner and defensive timing ring use warm brass/cream. S, E, G, Space/Enter, pointer input and gamepad bindings are preserved, as is repeat/double-press protection.
- The command hand reserves its layout footprint while hidden during timing, keeping the battlefield stable between beats. The battle log remains explicitly opened.
- Compact portrait layout stacks the identity strip above three cards and two utilities. Shallow landscape windows omit the duplicate active portrait and use five commands in one row. Short phones suppress the long foe description, which remains in the target's accessible label/title; the formation rules remain visible.
- The old floating-controls override block was removed from `expedition.css`. The new scoped design lives in `expeditionCards.css`. No route overlay, simulation, save schema or campaign-balance changes were made.

## Asset provenance

Reference: `design/concepts/railavoid-frame-atlas-v1.png`. Its checkerboard is baked RGB, so it was not shipped or color-keyed.

Two sequential calls used the bundled `image_gen.py edit` CLI with explicit `--model gpt-image-1.5 --background transparent --output-format png --quality high --input-fidelity high --size 1024x1024`. The configured Windows User key was loaded only into the child process; it was not printed or stored. The second request tightened the empty-background requirement. No alternate model or model fallback was used.

- Initial prompt: [expedition-frame-prompt.txt](expedition-frame-prompt.txt).
- Correction prompt: [expedition-frame-correction.txt](expedition-frame-correction.txt).
- Accepted master: `output/imagegen/native-alpha/expedition-brass-frame-v2.png`.
- Runtime: `public/art/ui/expedition-brass-frame-v2.webp`, 25,304 bytes, 512 pixels wide.
- Encoder: `tools/export-expedition-frame.mjs`. It crops with transparent padding, resizes and encodes WebP; it does not reconstruct, threshold or replace alpha. Original masters remain intact.
- Master SHA-256: `7697807270B5D7E727C77AC459FA31A0918B99C445FE846C0DFD8D832D87F437`.
- Runtime SHA-256: `1E00AE9BDF4CC7962E83920089B7944606A430AD78904250BDA69AD33D6A116E`.

Native alpha and empty corners/center were verified. The frame was inspected over cream and navy; no visible haze or checkerboard remains. As with the crew masters, a few nearly invisible alpha pixels are preserved, not keyed away. The runtime frame uses Vite-managed imports in both consuming modules so the game base path and single-file exporter work.

## Verification

- 41 unit tests passed; one existing optional test skipped.
- Typecheck and game production build passed.
- `verify:expedition-cards` passed: 1920×1080, 1280×720, 1024×768, 800×600, 390×844, 360×740 and 844×450; loaded native-alpha frame, action bounds/touch heights, status plates clear of commands, battle-log access and crew-selection-to-battle flow.
- `verify:crew-timing` passed: every specialty's art, S/Space/E/G, pointer input, held keys and double-input suppression.
- Enlarged text at 110% scale passed action-bounds checks at 1280, 800 and 390 pixels wide. A two-person party completed both stages, displayed the framed victory/crew result and returned from expedition mode. Stage-choice and result cards also passed 390×844 content-overflow checks and visual review; long decision buttons wrap inside their frame.
- Staged expedition gate passed, including authored encounter scenes, Swap, depth choice and the second-stage art change. Standalone packaging and the existing Chrome file smoke passed (one expected optional-audio fallback, no unexpected errors).
- Final standalone battle smoke opened the rebuilt HTML through `file://`, entered expedition mode and decoded the embedded 512-pixel frame with all five commands present. No page errors. This checks the new frame itself, beyond the older starter-car smoke.
- The broader responsive gate initially sampled a stale first-load route projection at 1920×1080. An isolated reproduction showed a node 56 pixels outside the sketch at 350 ms, then correctly inside after the resize callback. The gate now waits for loaded fonts and SVG projection dimensions matching the current map container. No route geometry or gameplay code was changed. The full six-viewport rerun passed.

Screenshots and machine-readable measurements: `verify/screenshots/expedition-cards/`. Fixtures grant crew to exercise the UI; they do not prove campaign pacing or balance. Screenshots are local QA evidence, not committed assets.

## Next decision

Get human approval of this visual direction before adding more card artwork. Then return to Sprint 07's resolver-backed enemy intents and explicit Swap partner selection, followed by one proven miniboss expedition. Full campaign/save-load testing, actual-GPU performance and production release remain separate gates.
