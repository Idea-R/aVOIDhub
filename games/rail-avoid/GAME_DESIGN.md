# RAILaVOID — Game Design

*A moving-train logistics and tower-defense roguelite. aVOID Games.*

## Fantasy
You command the last train on a continent that is falling into the void. The void front eats the map from the west; you drive east toward the Last Gate. Your train is your base: every car you couple on is a decision about power, heat, ammunition, weight and who gets rescued.

## Core Loop (one run ≈ 30 min)
1. **Plan track** ahead of the locomotive (click hexes). Old rail lines are free; new track costs rails and depends on terrain.
2. **Keep moving.** Stopping raises *stop pressure*: attack waves come faster. The void front never stops.
3. **Reach settlements** before their void deadline: collect cargo, passengers and specialist crew, repair at yards, buy cars.
4. **Defend** the convoy: enemies chase, ram, fly over, sap the track and *board the actual cars*.
5. **Adapt** the train composition at repair yards; reorder cars because adjacency matters.
6. Cross four regions, beat three bosses, breach the Last Gate → victory. Locomotive destroyed or swallowed by the void → derailment.

## Core Tension (as specified)
| Tension | Implementation |
|---|---|
| Safe routes consume scarce track | Direct plains routes need new rails; pre-laid rail networks are free but wind through raider country. |
| Resource routes attract attacks | Mines / armories / depots sit on high-threat tiles; the wave director uses tile threat. |
| Rescuing settlements adds obligations | Passengers eat food, get hurt by boarders, trigger events; but they pay rails/scrap on delivery and bring specialists. |
| Heavy trains are powerful but slow | Speed = f(power/weight); coal burn scales with weight; the void front is only slightly slower than an unloaded train. |
| Detached cars save the locomotive | Detach the rear N cars: instant weight loss, and the abandoned segment lures enemies for 20 s. A destroyed *middle* car splits the train and loses everything behind it. |

## Map
- 56×26 flat-top hex continent, four vertical regions of 14 columns.
- Terrain: plains, forest, hills, mountain (impassable), water (bridge), ruins, ash, crystal.
- **Pre-laid rail network**: a spine plus branches with junctions per region. Players switch routes by planning along a branch.
- **Void front**: a noisy column frontier advancing east at a tuned rate; occasional *rifts* open ahead of the train (scripted per region) forcing detours.
- ~40 settlements: village, depot (rails), mine (scrap), farm (food), fuel (coal), clinic (medic), armory (ammo), yard (repair/shop), terminus.

### Regions
1. **Greenbelt** — plains & forest, raiders + hounds. Teaches planning, boarding, food.
2. **Rust Reaches** — hills, mines, ruins. Crawlers (armored) and sappers. Boss: **Iron Wagon** (rival train on a parallel line).
3. **Ash Steppe** — ash plains, storms, ashfall. Harpy drones and void wisps. Boss: **Brood Mother**.
4. **Void Frontier** — crystal, rifts, all enemy types. Boss: **Void Maw** at the Last Gate.

## Train
Locomotive (index 0) + up to 9 cars. Each car: HP, heat, crew slot, boarders.

### Propagation Rules
- **Power**: a generator powers cars within 3 positions. If demand in its span exceeds output, every consumer in the span runs at *output/demand* (brownout). Consumers sum contributions from all generators in range. Unpowered weapons fire at 40% rate.
- **Heat**: cars generate heat while active; heat diffuses 15%/s of the difference to adjacent cars. ≥80 heat: 2 dmg/s. ≥100: fire (5 dmg/s, spreads to neighbours). Radiators cool themselves and neighbours. Rain/storm cool the whole train.
- **Ammo**: weapons need an *ammo supplier* (Armory, Cargo Hold, Foundry, Armored Cargo) within 2 positions or they cannot fire.
- **Boarding**: boarders attach to a car, deal damage, then walk one car toward the locomotive every 4 s. Barracks marines fight boarders in adjacent cars; flamethrowers purge boarders in adjacent cars; passengers in a boarded car take casualties.

### Car Catalogue (22 types, 18+ required)
| Car | Role | Gen/Use | Heat | Notes |
|---|---|---|---|---|
| Locomotive | Drives | +6 | 2 | Fixed at front. |
| Coal Bunker | Coal storage +80 | 0 | 0 | |
| Boiler | +4 power | +4 | 3 | |
| Reactor | +10 power | +10 | 6 | Explodes (AoE on neighbours) when destroyed. |
| Radiator | Cooling | 0 | -6 | Cools neighbours −3/s. |
| Fabricator | scrap→rails | 3 | 2 | 1 rail / 4 s from 2 scrap. |
| Foundry | scrap→ammo | 3 | 3 | 6 ammo / 4 s from 1 scrap. |
| Cargo Hold | +60 all storage | 0 | 0 | Ammo supplier. |
| Armored Cargo | +40 storage, 2× HP | 0 | 0 | Ammo supplier. |
| Gatling Turret | Anti-infantry | 2 | 2 | Fast, low dmg, ×0.35 vs armor, ground only. |
| Cannon | Heavy AoE | 3 | 4 | Slow shells, ×2 vs armor, ground only. |
| Flak Battery | Anti-air | 3 | 2 | Air only, bursts. |
| Tesla Coil | Chain lightning | 5 | 3 | Hits ground+air+wisps, no ammo, needs full power. |
| Flamethrower | Boarder purge | 1 | 4 | Short cone, burns wisps, purges boarders in adjacent cars. |
| Barracks | Marines | 0 | 0 | Fights boarders in adjacent cars; +armour. |
| Medical Car | Heals crew/passengers | 1 | 0 | Resolves sickness events; passengers regenerate. |
| Scout Car | +3 plan range, early warning | 1 | 0 | Reveals sappers on track. |
| Passenger Coach | +12 passengers | 0 | 0 | |
| Sleeper Coach | +20 passengers, comfort | 1 | 0 | Halves negative events. |
| Rail Layer | Track −1 cost, +2 plan range | 2 | 1 | |
| Armour Plate | Buffer car, 3× HP | 0 | 0 | Blocks boarders walking through. |
| Signal Car | Weather forecast, −20% wave size | 1 | 0 | |

### Crew Specialists
Engineer (+2 power in car), Gunner (+35% fire rate), Medic (heals), Surveyor (−1 track cost, +2 range), Mechanic (repairs car 1 HP/s), Quartermaster (+30% storage).

## Enemies (6) — each demands a different answer
| Enemy | Layer | Threat | Counter |
|---|---|---|---|
| Raider | ground, boards | Boarding swarms | Gatling, Barracks, Flame |
| Void Hound | ground, fast | Bites wheels: −speed stacks | Gatling, Tesla |
| Crawler | ground, armored | Rams cars for heavy damage; resists gatling | Cannon, Tesla |
| Harpy Drone | air | Drops boarders / saps power | Flak, Tesla |
| Sapper | ground, stealthy | Plants charge on planned track → derail damage | Scout + any gun (revealed), Cannon |
| Void Wisp | phase | Immune to bullets/shells; drains power & heat | Tesla, Flame |

## Bosses
1. **Iron Wagon** (end of region 2): a rival armoured train on a parallel line — exchanges cannon fire, launches boarders in phases; must be out-gunned or out-run to the switch that breaks its line.
2. **Brood Mother** (end of region 3): giant crawler, armour plates fall off in phases exposing a weak core; spawns hounds; cannon/tesla checks.
3. **Void Maw** (Last Gate): a void entity that opens rifts on your route and pulls the rear car; you must keep the train moving around a loop while Tesla/Flame damage it and flak clears its wisps. Beating it opens the Gate.

## Weather & Time
Day/night cycle of 4 minutes (night: +30% enemy aggression, harpies more common, visibility tint). Weather: clear, rain (cooling, −10% speed), fog (turret range −30%), storm (cooling, drones grounded, lightning strikes heat a random car), ashfall (region 3-4, passengers take damage without Sleeper/Medical).

## Passenger Events
Triggered every ~90 s when passengers > 0: choices with costs/benefits (stowaway, sickness, mutiny over food, volunteer gunner, a child's map revealing a rail shortcut, etc.). Sleeper coach halves negative ones, Medical car unlocks best outcomes.

## Failure & Victory
- **Derailment**: locomotive HP 0, void reaches the locomotive, or a sapper charge detonating under the locomotive. Shows cause, distance, settlements saved, and seed.
- **Victory**: beat the Void Maw and cross the Last Gate. Score = settlements + passengers delivered + cars intact + time bonus.

## Controls
Mouse: click hex to plan, right-click/drag to pan, wheel to zoom, click car to inspect. Keys: Space pause, 1/2/3 speed, Backspace unplan, D detach, Tab train panel, Esc menu, M mute, +/- zoom. Gamepad: left stick pan, cursor planning with A, B unplan, Start pause.
