# Sprint evidence — VOIDaVOID V2 deterministic runs

Date: 2026-08-20
Branch: `codex/fix-voidavoid-v2-evidence`
Issue: [#20](https://github.com/Idea-R/aVOIDhub/issues/20)
Base: VOIDaVOID V0/V1 commit `f28b41d`

## Intended outcome

Make every score-affecting random decision reproducible, freeze a versioned run envelope, and prove that the final score can be independently recomputed without claiming that a local browser is trustworthy.

## Baseline

- Meteor, power-up, chain, score, and defense fallback decisions used `Math.random`.
- Chain, grace-period, combo, and defense timing mixed fixed-step updates with `performance.now`.
- Power-up spawn intervals were resampled every frame.
- Meteor IDs used unseeded randomness and influenced defense tracking.
- Result state contained no ruleset, seed, event order, replay status, or integrity check.

## Delivered

- Added stable named RNG streams derived from one unsigned 32-bit run seed.
- Seeded all decisions that can change collision, collection, destruction order, or score.
- Kept cosmetic randomness separate so visual or performance settings cannot consume gameplay draws.
- Moved grace, chain, combo, and defense behavior onto simulation time.
- Replaced duplicate dead meteor spawning in `InputSystem` with the single `MeteorManager` owner.
- Gave meteors deterministic per-run sequence IDs.
- Added compact tick-ordered score events, final evidence, local verification, and fail-closed status.
- Added a restrained result-line run code while preserving the explicit unranked boundary.

## Automated evidence

Command: `npm run verify:release --workspace=@avoid/void-main`

- TypeScript: pass
- Active graph: 57 files, 0 lint errors, 0 warnings
- Vitest: 7 files, 22 tests pass
- Vite production build: pass
- Output: 263.17 kB JavaScript / 76.25 kB gzip; 9.14 kB CSS / 2.99 kB gzip

Command: `npm run build:platform`

- Next.js 16.3.1 production build: pass
- 21 application routes classified/generated

## Browser evidence

| Check | Result |
| --- | --- |
| Desktop | 1440×900; run code and clean replay status rendered |
| Portrait phone | 390×844; document 390×844; result dialog fully visible |
| Short landscape | 844×390; document 844×390; dialog and all actions within viewport |
| Replay soak | 20 resets; 21 starts and finishes total; 20 unique new codes; every result `replayable-local` |
| Runtime ownership | One fixed-step loop, five pointer listeners, no pending frame at terminal state |
| Console | No warnings or errors |

## Trust boundary

V2 proves deterministic random streams and score arithmetic. It does not prove that the client generated legitimate collisions or pointer input. Results remain local and unranked. Server-issued tickets, bounded input evidence, accepted receipts, and data-backed placement remain V3.

## External state

No database, Supabase branch, Netlify site, Stripe resource, AdSense setting, DNS record, merge, or production deployment changed.
