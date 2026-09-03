# Sprint 04 — Command Deck Rebuild

## Correction

Sprint 03 improved legibility and crew discovery, but retained the old top ribbon and compressed bottom-card composition. The user correctly identified it as an incremental cleanup rather than the expected redesign.

## Outcome

Keep the existing map, train simulation, and interaction contracts while replacing the principal HUD components with a new railway command-deck system:

1. Replace the top stat ribbon with a two-tier command deck: directive, manifest instruments, Void distance, line conditions, and time controls.
2. Replace the small consist cards with a large rolling-stock schematic where every car has a role silhouette, embedded crew station, named status, hull, heat, supply, and fault state.
3. Replace the generic inspector composition with a matching equipment-bay panel and larger direct-posting controls.
4. Preserve keyboard focus, selection, crew assignment, hover cards, route controls, simulation controls, compact mode, and standalone delivery.
5. Verify the redesign at 1920×1080, 1600×900, 1366×768, 1280×720, and 800×600.

## Design rules

- The map remains the stage; the HUD reads as equipment mounted around it.
- Brass is used for command and action, car color for identity, green/amber/red for system state, violet for the Void.
- Primary values remain large; secondary labels may be compact but cannot carry essential meaning alone.
- Crew posting is visible on the train itself, not buried in a roster.
- Compact layouts scroll the train horizontally rather than erasing car identity.

## Verification gates

- TypeScript and production build.
- Unit suite.
- Focused HUD structure, font-size, crew focus/posting, and viewport-bound checks.
- UI overlap scenarios with shop and inspector open.
- Full gameplay harness: boot through bosses, progression, save/load, results, resize, performance probe, determinism, screenshots.
- Standalone HTML build and `file://` boot.
