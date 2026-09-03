# Sprint 04 Review — Command Deck Rebuild

## Result

The previous card cleanup has been superseded by a component-level HUD redesign without changing the underlying simulation or map rendering.

## Shipped

- A two-tier command deck with a run directive, large manifest instruments, Void chase meter, line-condition module, and time controls.
- A full rolling-stock command surface with 120–146 px tall car schematics, purpose-specific CSS silhouettes, car roles, embedded crew stations, hull and thermal readouts, power/ammo faults, and explicit operational state.
- An equipment-bay inspector with a large car schematic, role/status hero, structured system readouts, and larger crew posting choices.
- A cohesive authored rolling-stock set for the complete six-car starter consist, plus distinct Gatling II and III upgrade art. Cards and the equipment bay use the same level-aware asset resolver; unillustrated car types retain a procedural fallback.
- Responsive desktop and compact compositions. Narrow screens retain the directive, resources, train identity, health, heat, crew, and horizontal access to the full consist.

## Behavior preserved

- Clicking a car selects it and opens the inspector.
- Crew Ready selects a viable car and focuses the first specialist choice.
- Posting updates the crew station on the corresponding train schematic.
- Route, speed, volume, menu, stop, junction, hover-card, shop, and keyboard behaviors remain connected to the same simulation APIs.

## Evidence

- `npm run typecheck`: pass.
- `npm test`: 21 passed, 1 optional skipped.
- `npm run build`: pass.
- `npm run build:standalone` + `npm run check:standalone`: pass; the 2.97 MB single HTML boots from `file://`, renders all six authored cars, and confirms all six are embedded WebP data URLs. The expected optional audio-manifest fetch falls back to the procedural score.
- `npm run verify:hud -- --url=http://127.0.0.1:5179`: pass; five named resources, 20 px desktop values, 10 px labels, labeled hull/thermal data on every car, direct crew focus/posting, bounds at 1920/1366/1280/800.
- The focused HUD gate also confirms six authored starter-car images and automatically exercises the Gatling level-I to level-III asset switch.
- `node verify/ui-overlap.mjs --url=http://127.0.0.1:5179`: zero overlaps at 1920×1080, 1600×900, 1366×768, and 1280×720 with shop and inspector scenarios.
- `npm run verify`: pass across build, boot, controls, early game, combat, mid game, three bosses, progression, save/load, victory/defeat, resize, performance probe, determinism, and screenshots. Zero console errors, page errors, or warnings. One intentionally aborted title-audio request occurred during navigation.
- Headless SwiftShader performance: average 11.9 FPS, minimum 8.6 FPS; this software-rendered note is not a GPU regression gate. The existing real-GPU reference remains 53.1 FPS average / 38.9 FPS minimum on the reference RTX 3080.
- Netlify production deploy `6a993daa056aba6997a0af41`: live at `https://avoidgame.io/railavoid/`. The focused HUD suite passed again against the custom domain, including all six remote art assets, Gatling I→III switching, crew focus/posting and four responsive viewport checks.

## Review boundary

The starter consist is now authored art rather than placeholder geometry. The remaining purchasable car types still use the deliberately retained CSS fallback. The generated frame atlas is a visual study only: its checkerboard is baked into RGB, so it was not shipped as a brittle fake-transparent border.

Generation recipes and runtime mapping are recorded in `ASSET-MANIFEST.md`.
