# Sprint evidence — TankaVOID T2 directional combat

- Date: 2026-08-20
- Issue: [#26](https://github.com/Idea-R/aVOIDhub/issues/26)
- Branch: `codex/tankavoid-t2-directional-combat`
- Draft PR: [#27](https://github.com/Idea-R/aVOIDhub/pull/27)
- Base: TankaVOID T0/T1 commit `9eead82`

## Intended outcome

Prove the reason to keep building TankaVOID. One player tank and one bruiser must exchange real shells, and hull facing must change the result without hidden rolls. Keep every later-system temptation—waves, infantry, mines, progression, accounts, and scores—outside this slice.

## Implemented combat boundary

- Independent hull rotation and pointer-aimed turret.
- One player cannon and one deterministic enemy cannon.
- A fixed pool of 32 projectiles. Every live projectile carries previous/current position, normalized travel, speed, base damage, penetration, owner, and deterministic identifier.
- Swept segment-versus-oriented-box collision, so a fast shell cannot skip through a tank between fixed ticks.
- Pure impact resolution with exact face and incidence boundaries:
  - front through ±45°;
  - rear from ±135°;
  - left/right sides between those limits;
  - under 50° is a penetration;
  - 50–68° is glancing at 45 percent damage;
  - over 68° is a zero-damage ricochet;
  - front, side, and rear multipliers remain `0.55`, `0.90`, and `1.35`.
- Health clamping, enemy disable, player disable, automatic terminal state, and clean restart.
- Eight retained impact records, with shape plus visible outcome/face/incidence/damage text. Color is not the only signal.
- Player statistics for accepted shots, hits, deflections, dealt damage, and received damage. The result is explicitly local engineering evidence, not a platform score.

## Contract clarification

The collision point selects the armor plate. Shell travel determines incidence against that plate's outward normal. If shell travel also selected the nearest of four faces, incidence could never exceed 45°, making the frozen 50°/68° glancing and ricochet thresholds impossible to reach. This clarification is recorded in the V1 contract and Decision D-040.

## Browser defect found and repaired

A quick pointer click could complete between two 60 Hz simulation ticks, so the old level-state input lost the shot. Pointer-down now enters a bounded four-pull queue; the simulation consumes one pulse per fixed step. The real browser retest accepted six clicks as six shells and six hits, disabled the target with 120 total damage in four seconds, and left the player at 112 hull.

## Automated verification

`npm run verify:release --workspace=@avoid/tanka-void`:

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Vitest: 8 files / 21 tests.
- Vite production build: pass.
- HTML: 0.65 kB / 0.37 kB gzip.
- CSS: 9.90 kB / 3.08 kB gzip.
- JavaScript: 169.87 kB / 54.54 kB gzip.
- Initial compressed transfer: 57,331 / 122,880 bytes.
- Largest JavaScript: 169,877 / 266,240 bytes.
- Downloaded media: 0.
- External runtime assets: 0.
- Root dependency audit after clean install: 0 vulnerabilities.

`npm run build:platform` generated all 21 platform routes successfully. TankaVOID remains deliberately absent from platform staging.

## Browser evidence

Briefing viewports:

- 320 × 568
- 390 × 844
- 844 × 390
- 768 × 1024
- 1440 × 900
- 1920 × 1080

Running viewports:

- 320 × 568
- 390 × 844
- 844 × 390
- 768 × 1024
- 1440 × 900

Every checked size retained one canvas and zero document overflow. HUD actions stayed inside the viewport. Narrow screens display a direct note that keyboard/pointer combat is active and touch driving is deferred to T4.

The natural terminal paths were exercised in both directions: the bruiser disabled an idle player in fourteen seconds, and a player-fire sequence disabled the bruiser with six accepted shots. Escape produced one labelled pause dialog, focused its primary action, and left no frame pending.

Twenty additional restart/system-check cycles retained:

- 21 starts / 21 finishes / 20 resets from the soak baseline;
- one canvas;
- eight input listeners;
- one resize observer;
- zero terminal projectiles;
- zero terminal animation frame;
- zero duplicate IDs;
- zero unnamed buttons;
- zero document overflow.

The development browser log contained only Vite connection/hot-update messages and the React development notice; there were no warnings or errors.

## Boundary held

- No touch-driving claim.
- No waves, cover, extra enemies, boss, pickups, mines, progression, scoring, platform ticket, account, leaderboard, or commerce work.
- No platform staging or public Play route.
- No Supabase, Stripe, AdSense, Netlify production, DNS, or deployment change.
- TankaVOID remains Coming Soon.

## Next action

T3 turns this combat proof into a repeatable encounter loop: one intentional arena/cover layout, enemy spawn and terminal pacing, collision separation, explicit entity/draw/frame ceilings, and ten natural start-to-result runs with stable ownership and frame behavior.
