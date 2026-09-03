# Sprint 03 Review: The Train Is the Interface

Status: complete on September 3, 2026.

## Delivered

- Preserved the current RailAVOID map and world presentation.
- Established a raised operations-desk card hierarchy using the existing navy, brass, green, warning-red, and void-violet palette.
- Converted each resource into a named card with a large current value, capacity, meter, semantic state, and explanatory hover/focus help.
- Converted the train consist into named, responsive status cards with labeled hull and heat, operational warnings, level, passengers, and crew posting.
- Made every viable empty car advertise an open crew posting when a specialist is waiting.
- Replaced the inspector dropdown with direct specialist cards and a one-click Post action.
- Added focus continuity, posting confirmation, empty states, selected states, danger states, and compact fallbacks.
- Prevented announcement cards from covering modal decisions.

## Verification evidence

- Unit tests: 21 passed, 1 optional skipped.
- TypeScript and production build: passed.
- Focused HUD gate: passed with no page errors.
- Responsive HUD captures: 1920x1080, 1366x768, 1280x720, and 800x600.
- Overlap gate: zero overlaps at 1920x1080, 1600x900, 1366x768, and 1280x720 for shop and inspector stress scenarios.
- Full game harness: all required gates passed, including boot, controls, early game, combat, midgame, bosses, progression, save/load, victory/defeat, resize, determinism, and screenshot integrity.
- Browser diagnostics: zero console errors, page errors, warnings, and failed requests.
- Standalone: 2.39 MB single HTML file rebuilt and booted successfully from `file://`.
- Development asset handling: the conductor portrait uses Vite's supported public URL form; production and standalone builds pass after the correction.
- Headless performance remains informational because Chromium uses SwiftShader software rendering. The sprint adds no Phaser render work.

## Review artifacts

- `verify/screenshots/early_game.png`: integrated early-game HUD.
- `verify/screenshots/sprint-03/hud_1920x1080_assigned.png`: direct crew posting result.
- `verify/screenshots/sprint-03/hud_1366x768.png`: standard compact desktop.
- `verify/screenshots/sprint-03/hud_800x600.png`: minimum verification viewport.
- `verify/hud-sprint-report.json`: focused assertions and layout measurements.
- `verify/report.md`: complete game harness results.

## Next product gate

Run a short human comprehension test with players who have not seen the controls. Measure whether they can explain each resource, post their first specialist, identify an unsupplied weapon, and find the most damaged car without instruction. Continue pacing and difficulty work separately from the HUD sprint.
