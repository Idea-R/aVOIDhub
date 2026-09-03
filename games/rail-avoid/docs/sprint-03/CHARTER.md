# Sprint 03 Charter: The Train Is the Interface

## Outcome

Ship a preservation-first HUD refinement that makes RailAVOID easier to read and operate while keeping the existing map, rail network, palette, and game identity intact.

## Success measures

- The objective, region, resources, danger state, current stop, and train condition remain scannable without opening a panel.
- Each train car reads as a real status card with a name, hull state, heat or operational state, crew posting, and urgent faults.
- An unassigned specialist is visible and can be posted to a car through a direct card workflow without deciphering a dropdown.
- Resource cards explain what the resource does through hover and keyboard-focus help.
- Primary text is comfortably readable at 1920x1080 and 1366x768. Compact layouts remain usable at 1280x720 and 800x600.
- Existing simulation behavior, keyboard controls, accessibility settings, save/load, and standalone delivery continue to pass.

## In scope

- Operations-desk visual tokens and panel hierarchy.
- Objective, resource, stop, train-strip, inspector, and crew-posting presentation.
- Semantic color for good, warning, danger, selected, and unassigned states.
- Keyboard-focus, hover, selected, disabled, and empty states for changed controls.
- Focused Playwright verification plus the existing full harness.

## Out of scope

- Replacing the world/map art direction.
- Crew leveling, traits, interior train view, or new crew simulation.
- New cars, enemies, encounters, or balance changes.
- Production deployment or changes outside `games/rail-avoid`.

## Source of truth

- Workspace: `C:/dev/aVOID/games/rail-avoid`
- UI implementation: `src/ui/`
- Simulation contracts: `src/core/` and `src/sim/`
- Verification: `verify/`
- Visual baseline: `verify/screenshots/early_game.png`
- Direction reference: `design/concepts/railavoid-hud-operations-desk.png`

## Authority and gates

Local implementation, tests, screenshots, and standalone builds are authorized. Publishing, production deployment, destructive cleanup, commits, pushes, and external service changes are not part of this sprint.

## First milestone

Create the shared card hierarchy and resource presentation, then prove it builds before changing the train and crew workflows.
