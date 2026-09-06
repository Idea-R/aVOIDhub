# Convoy recovery — 2026-09-05

Local gameplay slice on the existing release checkout. Not published. No art, paid generation, backend, account or deployment changes.

## Rules

- Gatling, Cannon and Flak use shared train ammo in every position. No nearby Cargo/Foundry requirement remains. Each shot still costs its authored ammo; purchased guns still add 12 commissioning ammo, limited by storage capacity. Cargo increases capacity; a powered Foundry converts scrap into shared ammo. Power range and heat remain unchanged.
- Every operational car has a separate emergency guard: 4 bullet damage every 1.6 seconds within 110 world pixels (weather still affects range). A living posted crew member adds 3 damage; a gunner adds a further 2. This is ammo-free and independent of the main weapon. It prioritizes boarders on its own car, otherwise targets nearby ground/air enemies. Normal armor/resistance rules apply; it cannot hurt wisps. Offline/destroyed cars cannot shoot. Guards do not turn on production heat or replace Barracks/Flamethrower adjacent boarding clearance.
- Villages, depots, mines, farms, fuel stops, clinics, armories, markets, crossroads and yards permit reordering while stopped. The locomotive remains first; crew assignments follow the car. Buying, selling, upgrades and instant repairs remain yard-only. Unstaffed ruins, wrecks, shrines and mystery nodes do not become workshops. This does not add new map locations or a revisit-stop mechanic.
- **Service stop** holds automatic departure. **Arrange cars** uses the existing inspector; moving a car also holds the stop. **P** toggles field repairs; **X** departs and cancels service. Ending service without departing restores the normal departure countdown. Crossroads remain exposed, without militia protection.
- Field work chooses the lowest-percent living hull, restoring up to 4% of that car's maximum hull every 2 seconds, capped at 80%. It costs 1 scrap per 8 actual HP, including fractional work; it never bills for excess healing or resurrects cars. Completion or empty scrap stops repair, but does not force departure. Yards keep instant full repairs at 1 scrap per 4 HP.
- Work advances only with running world time. Pausing/dialogue/expeditions do not advance repair; the Void continues during active service. Reversing, departing or leaving the eligible location clears service. Save/load preserves a valid held stop and partial cycle; old saves do not start service.

## Verification

Targeted deterministic tests cover every ballistic weapon without a supplier, finite ammo, guards/crew/downed crew/air/wisp/disabled state/own boarders, gun-loss fallback, reordering and crew indices, workshop permissions, rates/costs/caps, pause/world time, cancellation, save/load and invalid locations.

`npm run verify:recovery` exercises keyboard and mouse at 1440×900, 1280×720, 800×600, 390×844, 360×740 and 844×450. Checks include no clipped service controls, repeat/modifier safety, paused repair activation, reordering, departure cleanup, actual scrap/HP exchange, moving Void, and title-screen isolation. Evidence is in ignored `verify/screenshots/recovery/`.

Final checks: typecheck and production/standalone builds pass; 117 unit tests pass, with two opt-in probes skipped. Recovery UI (six viewports), inspector/right-drag, blocked-track (16 cases), and standalone checks pass. The broader campaign harness passes its functional gates (boot, controls, early/mid combat, boss resolution, progression, save/load, victory/defeat, resize, determinism and screenshots) with no page errors or failed requests. Boss gates use debug fixtures and are not difficulty evidence. The last follow-up corrected stale ammo indicators in shops/paused saves, with failing-before/passing-after tests, then repeated unit/build/standalone/recovery checks.

The campaign's headless SwiftShader sample reported 14.3 average FPS and 125 ms worst frame; its harness treats this as a software-renderer note, not a hardware performance pass. No claim of faster rendering or universal performance acceptance is made. The final slice adds no textures.

## Balance evidence and its limits

Before changing mechanics, ran five deterministic ordinary-loadout routes from the starting depot to column 52 (partway into region 2), capped at 1,200 simulated seconds. The policy plans rapidly, takes nearby settlements, assigns available crew, repairs at yards, buys one Cannon when affordable, and resolves any expedition with Good—not Perfect—timing. No grants, warps, invulnerability or damage cheats. This is **not** a human win-rate test or a boss-clear claim.

Baseline revision: `8c2309f`. All five reached column 52; none lost a car. The rear coach was nevertheless critically damaged on seeds 42 and 2026. This baseline does not reproduce the user's slower, exploratory play-through, so it does not invalidate that feedback.

| Seed | Baseline time / damage / coach hull | Candidate time / damage / rear condition |
| --- | --- | --- |
| 12345 | 189s / 3 / 100% | 189s / 0 / all cars full |
| 42 | 292s / 91 / 21% | 280s / 180 / coach lost; cargo 55% |
| 2026 | 171s / 77 / 33% | 168s / 50 / coach 57% |
| 7331 | 191s / 25 / 100% | 191s / 22 / coach full; cannon 87% |
| 91 | 214s / 44 / 62% | 233s / 84 / coach 27% |

Candidate uses the final 4/7/9 guard damage. Field-service policy was enabled, but none of these final routes happened to reach an eligible stop below its 65% trigger with enough Void margin before passing column 52. Field service is therefore proven by focused tests, **not by these five runs**. Earlier 2/5/7 guard trials are tuning experiments, not the accepted numbers. Combat changes affect kill order, loot/IDs, travel and subsequent encounters; shared seeds do not keep every downstream state identical.

Result: direct-ammo behavior and recovery controls work; these samples do **not** establish a universal survivability improvement. Keep the weaker-route result visible. Next tuning should record a slower player-paced route, stop decisions, coach losses and actual field-service usage through the whole second region and the Iron Wagon. Do not compensate by silently increasing all resources or cutting every wave.

Reproduce with PowerShell:

```powershell
$env:RECOVERY_PROBE='1'
$env:FIELD_SERVICE='1'
npx vitest run src/sim/recovery-probe.test.ts
```

`PROBE_COL` optionally extends the endpoint. The regular test run skips this observational probe. No new textures were loaded. Browser tests use SwiftShader for function/layout, not representative GPU performance.

## Next slice

1. Player-paced full-region-2 recovery/crew-posting balance pass, with real playtest feedback and saved seeds.
2. Keep the planned side-view encounter variety, visible crew progression and authored miniboss work after this gameplay triage. Do not mix a new XP system or boss architecture into this repair patch.
