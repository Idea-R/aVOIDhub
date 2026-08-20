# WreckaVOID W0/W1 repair evidence

- **Date:** 2026-08-20
- **Branch:** `codex/fix-wreckavoid-v1-baseline`
- **Base:** `security/platform-foundation-v1`
- **Game:** `games/wrecka-void`
- **Issue:** `https://github.com/Idea-R/aVOIDhub/issues/6`
- **Draft PR:** `https://github.com/Idea-R/aVOIDhub/pull/7`
- **Status:** W0 and W1 local exit gates complete; no production deployment

## Sprint intent

This slice establishes a truthful WreckaVOID baseline and removes the crash- and lifecycle-level defects that made later platform integration unsafe. It does not activate the dormant platform database, production auth, score acceptance, Netlify deployment, Stripe, or AdSense.

## Reproduced baseline

Before this repair, the Vite production build passed while the standalone TypeScript and lint gates failed. There were no automated tests. Inspection and targeted runtime reproduction found:

- pusher collisions referenced `damage` before declaration and could throw in live play;
- `EnemyManager` and `GameEngine` both advanced enemies, doubling movement;
- the RAF effect depended on frequently changing React state and could be torn down and recreated during play;
- capped variable delta time made simulation results depend on refresh rate and slow frames;
- lethal damage changed the terminal state before the old guarded finish path could run;
- score finishing had no explicit one-per-run gate;
- the enemy type declaration excluded three enemy variants that the implementation actually spawned;
- canvas input was mouse-only, ignored CSS-to-bitmap scaling, and started at a hard-coded desktop coordinate;
- the 390 × 844 HUD wrapped into overlapping columns and offered no touch pause/help controls;
- archived source was included in lint, masking the canonical runtime’s actual gate;
- projectile renderers and several UI/auth files carried stale or unsafe types.

## Implemented repair

- Added a fixed-step accumulator at 60 simulation steps per second with a five-step catch-up limit and suspended-time dropping.
- Made one stable RAF owner read current gameplay dependencies through refs instead of rebuilding the loop on React updates.
- Made `EnemyManager` the only enemy-physics owner.
- Fixed the pusher collision temporal-dead-zone crash and corrected retained enemy types.
- Added `RunCompletionGate` so each run has exactly one terminal finish transition and restart explicitly resets it.
- Moved the finish decision into the same simulation step as lethal damage.
- Replaced mouse listeners with Pointer Events, primary-pointer capture, canvas coordinate scaling, and `touch-action: none`.
- Centered initial input from the live canvas bitmap instead of a desktop constant.
- Reworked the compact HUD at narrow breakpoints and added touch-accessible pause and help controls.
- Made help temporarily pause an active run and preserve an already-paused run.
- Corrected power-up, physics, enemy, projectile, auth/profile, and renderer typing so the canonical game passes its own type and lint gates.
- Excluded the preserved archive from the canonical runtime lint target.

## Automated evidence

Run from the repository root:

```text
npm run typecheck --workspace=@avoid/wrecka-void
npm run lint --workspace=@avoid/wrecka-void
npm run test --workspace=@avoid/wrecka-void
npm run build --workspace=@avoid/wrecka-void
```

Result on 2026-08-20:

| Gate                          | Result                             |
| ----------------------------- | ---------------------------------- |
| Standalone TypeScript         | Pass                               |
| ESLint                        | Pass, zero warnings                |
| Vitest                        | Pass, 5 files / 14 tests           |
| Vite production build         | Pass                               |
| Next.js runtime build         | Pass with staged WreckaVOID bundle |
| npm audit from locked install | Zero vulnerabilities               |

The focused suite covers:

- equal one-second simulation at 30, 60, and 120 Hz;
- pause/suspension without a resume burst;
- capped catch-up after a long frame;
- pusher deflection, damage, destruction, and score;
- lethal terminal state and no post-death time advance;
- subscriber cleanup and clean state reset;
- one finish transition per run and reset after restart;
- pointer mapping at 1× and scaled canvas density.

## Browser/device evidence

The local Vite runtime was exercised in the in-app Chromium browser.

| Viewport   | Evidence                                                                                                              | Result |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| 1440 × 900 | Home → Play, pointer movement/retraction, live scoring, Space pause, Resume                                           | Pass   |
| 390 × 844  | Home → Play, exact viewport canvas, no horizontal overflow, centered start, touch move, touch pause, touch help/close | Pass   |
| 1440 × 900 | Development smoke mode, 40 terminal transitions and Play Again cycles                                                 | Pass   |

Desktop play reached a non-zero score and paused without a gameplay exception. Mobile canvas metrics were exactly 390 × 804 beneath the 40 px HUD, with document width 390 px. The help and pause surfaces were exposed as named buttons and remained readable at the target width.

Local browser logs contain only the expected warnings/error from deliberately absent local Supabase configuration and the unavailable local leaderboard request. No gameplay exception was observed. Production scoring was not exercised because its coordinated foundation is intentionally dormant.

### Supported-device policy recorded by W0

The local W0 gate officially proves current Chromium at 1440 × 900 and 390 × 844. WreckaVOID V1 will require current Chrome/Edge desktop, current Firefox desktop, current Chrome Android, and current/latest-minus-one Safari iOS at a minimum 360 px portrait width before production acceptance. Untested engines remain release candidates, not silently supported claims. Orientation, safe-area, and dynamic browser-chrome behavior remain W2 gates.

### Repeated-run lifecycle and memory evidence

The development build exposes a smoke panel only when both Vite development mode and `?smoke=1` are present; production compilation removes the panel. Its Force game over action uses the same terminal gate as real play.

Forty browser-driven Force game over → Play Again cycles completed. Checkpoints after cycles 1, 5, 10, 15, 20, and the final additional 20-cycle sample all held:

```text
RAF owners: 1
Input owners: 1
Deferred timers: 0
Finish transitions: exactly one per cycle
Restarts: exactly one per cycle
```

The final panel read `RAF 1 · input 1 · timers 0 · finishes 41 · restarts 41`, including the initial harness calibration cycle. Chrome Performance metrics over the measured final 20-cycle sample moved from 25,379,668 to 23,870,636 used JS heap bytes, a decrease of 1,509,032 bytes. This is not a full long-session profiler, but it rejects the W1 accumulation failure the gate was designed to detect.

The complete hosted-game staging pipeline built VOIDaVOID, WreckaVOID, and WORDaVOID and copied the repaired Wreck bundle into the platform. The normal Netlify/Next runtime build then passed all 21 generated pages plus dynamic API routes. The separate Windows static-export review mode remains incompatible with the foundation branch’s dynamic `/api/v1/runs/[runId]/finish` route; that pre-existing review-mode limitation is not a game build regression and was not bypassed.

## Exit status

### W0 — baseline and smoke harness

Complete locally. The reproducible bug list, canonical game gate, deterministic unit harness, supported-device policy, desktop/mobile start/control smoke, and repeatable terminal/restart harness are recorded.

### W1 — lifecycle and terminal state

Complete locally. The stable RAF owner, fixed-step clock, one-finish gate, same-step lethal transition, timer cleanup, focused tests, 40-cycle owner check, and measured 20-cycle heap sample pass. Production/deployed behavior remains gated with the later release slice.

## Deliberately deferred to later WreckaVOID sprints

- Replace the WreckaVOID-specific password/Google/profile UI with the platform session (W3).
- Activate and prove accepted/rejected one-use platform results on the isolated Supabase branch (W3).
- Move the canonical leaderboard and personal best to `/games/wreckavoid/` (W4).
- Replace generic share text with canonical result receipts (W4).
- Add audio, reduced-motion treatment, deeper accessibility, first-minute balance, boss/projectile/second-chain path coverage, asset reduction, and long-run performance evidence (W2/W5).

## Next smallest safe slice

Begin W2 with safe-area/dynamic viewport ownership, orientation and focus-loss coverage, first-minute onboarding, and reduced-motion/audio decisions. Keep W3 platform auth and accepted-score proof blocked on the coordinated isolated foundation environment rather than reconnecting the old game-local auth.
