# Sprint 02 — HUD, Onboarding and Pacing

## Implemented

- Added a persistent eastbound objective ticket with region and distance progress.
- Rebuilt the resource bank as larger enamel controls with focusable plain-language explanations.
- Made the People/Crew control actionable and added a persistent **CREW READY — Assign to a car** ticket above the train.
- Enlarged train car cards and crew badges; expanded the car inspector with explicit specialist effects and a stronger posting action.
- Added tutorial triggers that were previously unreachable, including crew posting, yards and later-region counters.
- Added crew assignment and starter-coupler explanations to How to Play.
- Increased base travel speed and starting reserves; reduced early wave density, growth, night damage and early elite rate.
- Added a real haven departure beat so a banked wave cannot appear immediately after leaving.
- Strengthened fragile starter utility cars and softened Crawler/Sapper spike damage.
- Changed new purchases to couple ahead of the Caboose by default, preserving both rear defense and ammo adjacency.
- Reworked the Iron Wagon into a fight-or-flight encounter: shell counters are called out, its attrition was reduced, and a train that reaches the end of its rival line can escape it.

## Probe outcome

The original deterministic build lost eight cars and died to the Iron Wagon around 369 simulation seconds, at column 98. The revised informed build reaches the Brood Mother around 568 seconds, at column 120, before the simple unattended policy fails. This is not a final difficulty claim; it establishes that the first boss is no longer the universal progression wall and creates enough runway for human playtesting.

## Next measurement pass

Capture per-seed/per-region arrival time, car losses, damage source, scrap spent, weapon purchases, ammo-starved seconds and boss outcome. Run at least 20 seeds each for Scenic/Standard candidate curves, then compare against five human runs before locking numbers.
