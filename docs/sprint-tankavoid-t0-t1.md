# Sprint evidence — TankaVOID T0/T1 recovery and runtime foundation

- Date: 2026-08-20
- Issue: [#24](https://github.com/Idea-R/aVOIDhub/issues/24)
- Branch: `codex/tankavoid-t0-t1-foundation`
- Draft PR: [#25](https://github.com/Idea-R/aVOIDhub/pull/25)
- Base: VOIDaVOID V4 commit `932263a`

## Intended outcome

Preserve the real directional-tank prototype, stop compiling incompatible generations, and establish the one lifecycle/simulation/input/viewport boundary that T2 combat can safely build on. Keep the public catalog honest and inactive.

## Baseline

- Monorepo package: React placeholder, fake static game shell, 78 TypeScript errors.
- Standalone prototype: branch `feat/get-game-working` at `e30e813`, 19 modified and 5 untracked entries, one TypeScript error.
- Directional damage was disconnected: projectile collision supplied damage but no impact angle.
- Both `Game` and `InputManager` owned overlapping keyboard, pointer, and resize listeners.
- The standalone HTML contained hard-coded anonymous leaderboard rows.

## Delivered

- Created a local dirty-source ZIP and full Git history bundle with recorded SHA-256 values before implementation.
- Replaced sixteen incompatible active source files and the fake static HTML shell with one canonical T1 graph.
- Added a fixed 60 Hz simulation, seeded arena state, deterministic tank movement, bounded catch-up, and explicit run states.
- Added one keyboard/pointer owner, one `ResizeObserver`, a fixed 1200 × 720 world, DPR-capped letterbox rendering, and shared pointer mapping.
- Added explicit briefing, pause, complete, replay, and return paths with honest non-score language.
- Added a responsive branded proving-ground presentation without external assets.
- Added a repeatable release gate and source budget.
- Kept TankaVOID out of the platform build and retained its Coming Soon catalog boundary.

## Automated evidence

Command: `npm run verify:release --workspace=@avoid/tanka-void`

- TypeScript: pass
- ESLint: pass, zero warnings
- Vitest: 5 files / 10 tests pass
- Vite 8.2.1 production build: pass
- HTML: 0.60 kB / 0.36 kB gzip
- CSS: 9.45 kB / 3.00 kB gzip
- JavaScript: 160.13 kB / 51.38 kB gzip
- Initial compressed transfer: 54,130 / 122,880 bytes
- Largest JavaScript: 160,133 / 266,240 bytes
- Downloaded media files: 0
- External runtime asset files: 0
- Root npm audit: 0 vulnerabilities

## Browser evidence

| Check              | Result                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Briefing viewports | 320×568, 390×844, 768×1024, 844×390, 1440×900, and 1920×1080 have zero document-level horizontal overflow; the primary action remains inside the viewport. |
| Running viewports  | 320×568, 390×844, 768×1024, 844×390, and 1440×900 retain one full-viewport canvas and in-bounds HUD actions.                                               |
| Start ownership    | Start focuses the named canvas and reports one pending frame, eight input listeners, and one resize observer.                                              |
| Pause ownership    | Escape opens one labelled modal, focuses Continue, freezes the frame owner, and clears active input.                                                       |
| Repeat-run soak    | 20 starts, 20 finishes, 19 resets; one canvas, eight listeners, one resize observer, and zero terminal frame.                                              |
| Semantics          | No duplicate IDs, unnamed visible buttons, or document-level overflow at the terminal state.                                                               |
| Console            | No application warnings or errors; only Vite/React development messages.                                                                                   |

Two browser-found defects were corrected during the sprint: the active-frame diagnostic was sampled inside the callback gap, and oversized narrow-screen briefing content was vertically centered above the viewport. The loop now tracks active ownership explicitly, while the narrow layout starts at the top and clips horizontal spill.

## Removed from the active branch

The old `core`, `entities`, `systems`, and `utils` implementations were removed from the active source tree after preservation. They remain recoverable through repository history and the standalone recovery artifacts described in `docs/tankavoid-v1-contract.md`.

## Honest boundary and next sprint

T1 is an engineering proving ground, not a game-complete claim. It has no projectile, damage, enemy, score, audio, touch control, auth, board, public Play route, deploy, or rollback evidence.

T2 is next: implement pure directional face/incidence/damage math, one player cannon, one enemy, readable ricochet/penetration outcomes, and deterministic combat tests without reopening the rejected prototype scope.
