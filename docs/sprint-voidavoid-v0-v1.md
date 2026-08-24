# Sprint evidence — VOIDaVOID V0/V1 baseline repair

Date: 2026-08-20
Branch: `codex/fix-voidavoid-v0-v1-baseline`
Issue: [#18](https://github.com/Idea-R/aVOIDhub/issues/18)
Base: `codex/fix-wordavoid-wd3-experience` at `1c22688`

## Intended outcome

Write down the real VOIDaVOID rules, isolate the code that actually ships, and make start/pause/focus/resize/death/replay/teardown dependable without changing the original game into a different product.

## Baseline

- Standalone Vite build passed, but shipped about 425.15 KB of JavaScript plus a 1.57 MB result image.
- App type-check failed across active and stale code with roughly 100 errors.
- Lint reported 173 errors and 10 warnings.
- No focused tests existed.
- The game auto-started through its old password-auth shell.
- Game-over UI claimed verified placement even though the browser was trusted to write scores.
- Touch listeners were registered on both `window` and the canvas; cleanup removed only one set.
- Manual pause could be cleared by focus/visibility resume.
- The stop path did not clean up the loop or all canvas/listener owners.
- Resize had three owners and mixed DPR-scaled backing pixels with logical input coordinates.
- External audio and a periodic development interval had no complete lifecycle owner.

## Delivered

- Replaced the active shell with explicit start, restrained HUD, single-owner pause/help, local result, replay, share-copy, and main-menu paths.
- Removed game-local auth, profile, leaderboard, performance monitor, large result art, and audio from the shipping import graph.
- Scoped type-check/lint to the canonical entry graph while leaving historical alternatives available for later archival decisions.
- Added a fixed 60 Hz loop with composed pause reasons, bounded catch-up, one pending frame, idempotent stop, and diagnostics.
- Replaced window/touch duplication with five canvas-owned Pointer Events listeners and exact cleanup.
- Made CanvasManager the resize owner, restored browser zoom, selected an honest DPR-1 V1 baseline, and fixed the equal-size initial observation case.
- Removed duplicate renderer/engine resize listeners and tracked deferred defense-effect timers.
- Preserved meteor, defense, power-up, knockback, fragment, chain, survival, meteor, and combo mechanics.
- Added pure score helpers and tests without pretending the current random score stream is reproducible.
- Restored normal UI cursors, keyboard focus, reduced motion, tactile controls, and responsive dialogs.
- Removed the HUD from the focus surface whenever a blocking dialog owns the screen.

## Verification

| Gate | Result |
| --- | --- |
| `npm run type-check --workspace=@avoid/void-main` | Pass |
| `npm run lint --workspace=@avoid/void-main` | Pass: 51 active files, 0 errors, 0 warnings |
| `npm run test --workspace=@avoid/void-main -- --run` | Pass: 3 files, 9 tests |
| `npm run build --workspace=@avoid/void-main` | Pass |
| `npm run build:platform` | Pass: Next.js production build and 21-route classification |
| Desktop browser 1440×900 | Pass: start/play/pause/help/result, no overflow |
| Portrait browser 390×844 | Pass: 390×844 canvas, controls and result within viewport |
| Short landscape 844×390 | Pass after removing decorative-orbit overflow |
| Browser console | Pass: 0 warnings, 0 errors |
| Repeat-run soak | Pass: 30 starts/finishes/resets, one RAF pending, five input listeners |

Final standalone assets:

- JavaScript: 255.65 KB / 73.57 KB gzip.
- CSS: 9.14 KB / 2.99 KB gzip.
- HTML: 5.56 KB / 1.68 KB gzip.

## Honest limitations

- Scores are local and unranked.
- Random world and point decisions are not seeded.
- No platform run ticket or receipt exists yet.
- Audio is dormant.
- DPR 2 is not claimed.
- Browser-emulated pointer/mobile checks are not physical-device certification.
- Historical alternate source remains in the repository but outside the canonical compilation graph.
- No production database, Netlify site, Stripe account, AdSense account, DNS record, merge, or deploy changed.

## Exit

V0 and the local V1 runtime gate pass. Continue with V2 seeded evidence only after review of the scoring contract. Platform leaderboard/session work remains V3 and depends on the coordinated platform foundation.
