# Next Plan — "Reason to fight, reason to stop" (shipped 2026-09-02)

Goal: every wave, node and detour must pay out in something the player wants, and the train must occasionally leave the map for a short, skill-based crew scene that still costs void margin.

## 1. Loot from defence
- Enemies drop **salvage crates** (scrap / ammo / rails) on death; crates sit on the ground and are collected automatically when any car passes within reach.
- **Elite** enemies (one per wave from region 2, glowing, 1.6× HP) always drop a **relic choice** and **Void Marks**. Bosses drop a relic choice and a purse of marks.

## 2. Relics (permanent run passives, pick 1 of 3)
Eighteen relics such as Coal Heart (coal burn −20%), Iron Couplings (a destroyed middle car no longer sheds the cars behind it), Grease Tin (+8% speed), Void Compass (+1 plan range), Militia Banner (haven militia ×2), Salvage Hooks (double loot chance), Cargo Nets (bigger pickup reach), Sapper's Manual (all charges revealed), Hound Whistle (bites don't slow), Ember Gloves (heat damage halved), Bounty Board (bounty rewards +50%), Conductor's Watch (events pay marks).

## 3. Bounties and Void Marks
- Settlements post **bounties** on arrival (kill N of a type before the timer ends, deliver N passengers to the next yard, reach a named node before its deadline). Max two active. Rewards: Void Marks plus rails or scrap.
- **Void Marks** are the rare currency: markets sell a relic choice for marks, shrines take marks for a bigger blessing.

## 4. Expeditions (timed-hit turn-based crew scenes)
- New **Expedition Site** nodes (ruins, bunkers) in every region. Arriving offers "Send an expedition": choose up to three crew (the Conductor always goes).
- Side-view turn-based fight against on-foot enemies (thugs, hounds, void shades). Actions: **Strike** (press on impact for a perfect hit), **Guard** (press as the enemy blow lands to halve or negate it), a **Special** per specialty (Engineer Overcharge, Gunner Volley, Medic Patch, Surveyor Flare stun, Mechanic Wrench guard-strike, Quartermaster Bribe, Conductor Whistle rally), and **Flee**.
- Each round moves the void forward eight seconds of travel. Winning pays a relic choice, marks and salvage; sometimes a rescued crew member. Losing sends the crew back hurt with no reward.

## 5. Ship
- [x] Sim (18 unit tests), UI scene + relic/bounty HUD + announcement cards, world drops and node art, harness gate `progression`, live at avoidgame.io/railavoid.

## Next candidates
- More foe types and site variants (boss sites with a pre-fight choice), illustrated relic and event cards, a run summary that lists relics and bounties, difficulty presets, and the platform leaderboard adapter.

---

# Plan 3 — "Three Lines" (route choice)

Goal: the pre-laid network becomes three main lines across the continent so every region asks which line to ride, and switching lines is a priced decision.

1. **Three main lines** generated per run: the Central Line (balanced: yards, fuel, shrines), the Northern Line through the highlands (mines, armouries, depots, expedition sites; higher threat, richer salvage) and the Southern Line through the lowlands (villages, farms, clinics, markets; more passengers, calmer). All three leave the start and merge again at the Last Gate ring.
2. **Crossovers**: one or two pre-laid connectors per region between neighbouring lines (free but where the generator puts them); everywhere else you cut your own track between lines (4–8 hexes: rails, time, and exposure).
3. **Readability**: each line has its own colour on the map and in the route panel; junction stops show the line names and the next settlement on each branch; hovering a branch highlights it.
4. **Balance**: line-specific threat, bounty and salvage weights; the void front is shared so long cross-cuts are the risk.
5. Verified by worldgen tests (three connected lines, crossovers per region), the harness, and a redeploy.
