# Sprint 04 — Post-release usability patch

## Outcome

Reduce command-deck crowding, make map planning more direct, and explain the game's hidden train rules without changing the established world-art direction.

## Shipped work

- Saved **Interface size** setting from 75–110%, with 75% as the new default. Layout dimensions compress while essential copy retains a readable floor.
- Two-tier top deck: route resources remain together; people, marks, Void and relic operations form a separate rail.
- Consistent repair-yard rolling-stock cards with art, hull, level, price and actions. Normal cars upgrade from their cards; the locomotive links to its dedicated Speed, Boiler pressure, Reinforced frame and Track crew systems.
- Settlement selection asks the simulation for a complete route and falls back to the nearest legal adjacent hex when a structure itself cannot accept track.
- Junction choices include a radial map dial whose spokes and labels follow real branch directions.
- Weather HUD names the current mechanical penalties/bonuses. Fog uses discrete moving cloud banks instead of a solid screen tint.
- The locomotive gains a deliberately weak, ammo-free close-range conductor guard. Weapon cars remain the meaningful offense, but one destroyed Gatling no longer leaves a run entirely helpless.

## Verification gates

- Unit tests cover the locomotive fallback weapon and long settlement-route planning.
- Browser acceptance checks the default scale, settings control, 1664×920 and 1280×720 deck fit, canvas settlement routing, repair-yard content and overflow, weather status, and console errors.
- Existing HUD, car-inspector/right-drag, campaign smoke, production build and standalone gates must remain green before release.

## Explicit follow-ups

- Keep passengers primarily as transported people: coach capacity, food/morale pressure, event subjects, delivery income and score. A later emergency-defense event can let suitable crew/passengers help, but every passenger car should not become a hidden weapon.
- Add weather-specific events only after each weather state has a visible forecast and effect summary.
- Preserve open-world elites. Move named major bosses toward an authored map-avatar approach followed by the Sprint 05 Away Team battle system.
