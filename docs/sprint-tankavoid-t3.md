# Sprint evidence — TankaVOID T3 encounter loop

- Date: 2026-08-20
- Issue: [#28](https://github.com/Idea-R/aVOIDhub/issues/28)
- Branch: `codex/tankavoid-t3-encounter-loop`
- Draft PR: [#29](https://github.com/Idea-R/aVOIDhub/pull/29)
- Base: TankaVOID T2 commit `e75c8a1`

## Intended outcome

Turn the T2 armor proof into one complete encounter that can be started, played, resolved, and restarted repeatedly. T3 adds only the arena structure and lifecycle needed to make that fight honest. Touch controls, waves, progression, scores, accounts, and platform publication remain later work.

## Arena and collision contract

The 1200 × 720 arena now contains four fixed 170 × 120 barricades. Two sit north and two south, leaving a wide central firing lane while creating four real hiding positions.

- Tanks use circle-versus-axis-aligned-box separation and cannot enter a barricade.
- The player and bruiser use symmetric circle separation and cannot occupy the same space.
- Shells test their complete fixed-tick segment against both the target tank and every barricade. The nearest collision wins, so a shell cannot damage a tank through cover.
- Cover strikes retain a separate eight-entry history and use a visible square impact mark.
- Cover is tactical and indestructible in T3. No durability or decorative debris system is implied.

The bruiser checks the player-to-enemy segment before firing. If a barricade blocks that line, it steers back toward the central lane and holds fire until the player is visible again.

## Encounter pacing

The existing `briefing → running ⇄ paused → complete` lifecycle now contains three deterministic running stages:

```text
deploying (180 ticks) → combat → resolved (90 ticks) → complete
```

- Deployment lasts three simulation seconds. Movement, AI, aiming, and fire are locked while the canvas counts down.
- Combat enables the input owner and the bruiser.
- The first disabled tank begins a 1.5-second result hold. Speeds stop, live shells are cleared, input is disabled, and the final impact remains visible.
- The semantic result dialog appears only after that hold. On short screens it owns an internal scroll area, opens at its heading, and receives focus without scrolling the title away.
- Manual pause is available only during combat. Paused and completed runs have no pending animation frame.

## Explicit runtime ceilings

| Resource                 | T3 ceiling | Enforcement/evidence                                                  |
| ------------------------ | ---------: | --------------------------------------------------------------------- |
| Active enemies           |          1 | Single bruiser snapshot and runtime diagnostic                        |
| Static cover             |          4 | Frozen arena definition and runtime diagnostic                        |
| Active projectiles       |         32 | Fixed reusable pool                                                   |
| Tank-impact history      |          8 | Bounded retained slice                                                |
| Cover-strike history     |          8 | Bounded retained slice                                                |
| Particles                |          0 | No particle subsystem in T3                                           |
| Render draw-items        |         56 | Arena + cover + tanks + bounded projectiles/histories + stage overlay |
| Catch-up steps per frame |          5 | Fixed-step loop constructor boundary                                  |
| Accepted frame delta     |     250 ms | Fixed-step clamp; largest accepted delta is diagnosed                 |

“Draw-items” means bounded logical renderer entries, not raw Canvas API method calls. This distinction keeps the ceiling reproducible while leaving low-level drawing implementation free to change.

## Automated verification

`npm run verify:release --workspace=@avoid/tanka-void`:

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Vitest: 8 files / 28 tests.
- Vite production build: pass.
- HTML: 0.65 kB / 0.38 kB gzip.
- CSS: 9.96 kB / 3.08 kB gzip.
- JavaScript: 176.86 kB / 56.40 kB gzip.
- Initial compressed transfer: 59,208 / 122,880 bytes.
- Largest JavaScript: 176,860 / 266,240 bytes.
- Downloaded media: 0.
- External runtime assets: 0.
- Root dependency audit after clean install: 0 vulnerabilities.

The tests cover swept cover strikes, unobstructed sight lines, tank/cover correction, tank/tank separation, deployment lockout, terminal hold, bounded histories, stable fixed-step diagnostics, and ten deterministic natural encounters. `npm run build:platform` also generated all 21 platform routes successfully.

## Browser evidence

The briefing and live encounter were checked at:

- 320 × 568
- 390 × 844
- 844 × 390
- 768 × 1024
- 1440 × 900
- 1920 × 1080

Every size retained one canvas and zero document overflow. The HUD, controls, touch-boundary note, and result surface stayed inside the viewport. Browser QA found and repaired one phone-only defect: focusing the primary result button could scroll the 320 × 568 result title above the viewport. The result dialog now has a viewport-bounded internal scroller and focuses the dialog heading surface without moving it.

Escape produced one labelled dialog, focused the dialog, and left no frame pending. The browser warning/error log was empty.

Ten actual pointer-driven browser encounters then completed naturally. Every run recorded:

- six accepted shots and six hits;
- an `enemy-disabled` / “Armor line broken” result;
- one canvas;
- eight input listeners;
- one resize observer;
- zero terminal projectiles;
- zero terminal animation frame;
- four cover pieces;
- no document overflow;
- no listener, observer, canvas, or frame-owner growth.

The tenth result reported 10 starts, 10 finishes, 9 restarts, 8/8 retained impacts, 0/8 cover strikes for the central-lane path, 0/1 active enemies, 16/56 draw-items, 0/0 particles, and a 17 ms largest accepted frame delta.

## Boundary held

- No touch-driving claim, touch control, audio, onboarding expansion, or physical-device certification.
- No extra enemies, waves, boss, pickups, destructible cover, particles, score, account, leaderboard, or commerce work.
- No platform staging or public Play route.
- No Supabase, Stripe, AdSense, Netlify production, DNS, or deployment change.
- TankaVOID remains Coming Soon.

## Next action

T4 must decide the supported device claim. Prototype intentional touch driving, complete the HUD/onboarding/audio/accessibility pass, and verify the selected controls on real target hardware. If touch does not feel deliberate, ship an honest keyboard/pointer boundary instead of weak virtual sticks.
