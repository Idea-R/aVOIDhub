# WreckaVOID V1 delivery plan

- Status: proposed execution charter
- Date: 2026-08-23
- Canonical source: `games/wrecka-void`
- Production route: `https://avoidgame.io/WreckaVOID/`
- Program source of truth: `docs/V1-COMPLETION-PROGRAM.md`
- First milestone: W0, deterministic baseline and balance laboratory

## 1. Outcome

Ship WreckaVOID as a finished, beatable browser game with an optional endless score chase. Preserve the responsive wrecking-ball physics and strange power-ups that already make the prototype worth saving. Replace accidental difficulty, runtime defects, and random run quality with a readable encounter director, a measurable balance model, and a release process that can be repeated after future rules changes.

WreckaVOID V1 is complete only when a guest can understand, play, win or lose, restart, and share without a reload, and a signed-in player can receive one honestly labeled platform result. Desktop and supported touch controls must both feel intentional. Build, type-check, lint, tests, performance, accessibility, score trust, production deployment, and rollback must all have evidence.

## 2. Scope

### In scope

- Preserve and stabilize the current player, chain, ball, collision, pickup, enemy, boss, and particle ideas.
- Add a finite standard run with a real victory state and retain a separate endless mode.
- Make difficulty time and encounter based rather than an uncontrolled side effect of score.
- Build a seeded balance harness, recorded input traces, automated simulations, and human playtest protocol.
- Repair lifecycle, collision, timing, typing, input, mobile HUD, pause, focus, resize, restart, and terminal-state behavior.
- Give every retained enemy, boss, projectile, and power-up a tested gameplay contract.
- Replace local WreckaVOID authentication and profiles with the platform session.
- Use versioned one-use platform runs and honest score trust labels.
- Add the canonical `/games/wreckavoid/` detail page, personal best, leaderboard, result receipt, favorites, and sharing.
- Add a small sound and feedback set, responsive presentation, reduced-motion behavior, and accessible actions.
- Preserve the current immersive play URL for bookmarks.

### Explicitly later

- Open-world maps.
- A story campaign with authored levels.
- Competitive or cooperative multiplayer.
- Fully authoritative server physics or full deterministic replay verification.
- Transferable currency, creator revenue sharing, or any pay-to-win upgrade.
- AdSense, clickable sponsorships, or purchase prompts inside active play.
- A large soundtrack or a broad cosmetic store.

The finite run and endless mode give V1 a complete product shape without turning one good physics toy into a multi-year campaign project.

## 3. Authority and approval gates

Local research, planning, isolated implementation, tests, balance harnesses, synthetic fixtures, previews, commits, and pull requests may proceed under the aVOID program charter.

Stop for explicit approval before:

- applying or changing the production Supabase migration;
- changing production secrets, OAuth settings, or platform role grants;
- merging and deploying a gameplay ruleset to production;
- deleting or consolidating the duplicate `games/wreck-avoid` source tree;
- activating live Stripe, AdSense, paid resources, or public monetization;
- invalidating, deleting, or silently combining existing leaderboard rows.

## 4. Current evidence

### Reentry correction after stacked work integration

The first audit was performed against production `main` before the dormant WreckaVOID repair stack was reconciled. The integrated T7 game stack now contributes substantial completed work from earlier W0/W1, W2, and W5 branches:

- one fixed-step simulation and animation owner;
- removal of duplicate enemy advancement and the pusher crash;
- bounded terminal completion and restart behavior;
- Pointer Events, pointer capture, responsive canvas ownership, touch-safe controls, and a compact HUD;
- composed pause/focus/help behavior, local procedural audio, reduced motion, semantic dialogs, and bounded particles;
- 31 focused tests, clean TypeScript and lint gates, a passing production build, and a 200 KiB initial-transfer budget.

Those repairs are now the baseline, not work to repeat. The remaining V1 center of gravity is the finite Wreck Run and encounter director, impact-driven damage and meaningful upgrades, platform identity/run receipts, ruleset-specific leaderboards, physical mobile confirmation, and deployed canary/rollback evidence. The W0 through W7 sequence below remains the product acceptance map; completed engineering pieces should be credited against their matching exits after the consolidated branch passes preview QA.

### Verified live behavior

- The landing page and game route load in production.
- A desktop guest run can start, move, score, take damage, collect a power-up, die, and reach the result screen.
- A simple live smoke run ended at 68 seconds, wave 3, score 364, with one speed upgrade.
- The first boss timer begins at 60 seconds, which overlaps the point where a new player is still learning the chain.
- The 390 px game canvas fits the viewport, but score, wave, time, help, and guest status overlap in the 40 px HUD.
- Mobile gameplay has no touch or Pointer Events implementation. The input manager listens only for mouse and keyboard events.
- Production emits no immediate console error in the ordinary early-game path.

### Build and source health

- The Vite production build passes.
- Standalone TypeScript validation fails across the game, including collision, enemy union, power-up option, duplicate import, and second-chain result typing defects.
- ESLint reports 29 errors and three warnings. It also scans tracked backup source in `archive/`.
- There are no unit, simulation, component, or browser tests for WreckaVOID.
- The shipped logo is about 1.5 MB.
- `GameEngine.tsx` is 649 lines and owns React state, animation lifecycle, physics, collisions, scoring, run submission, rendering, reset, and input coordination.
- `EnemyManager.ts` is 717 lines and owns spawning, enemy definitions, boss definitions, projectiles, minions, AI, timing, and cleanup.

### Confirmed correctness defects

1. `PhysicsEngine.updateEnemies()` is called inside `EnemyManager.update()` and again from `GameEngine.updatePhysics()`. Normal enemies therefore advance twice per simulation frame.
2. The pusher ball-collision branch reads `damage` before it is declared. A pusher collision can throw at runtime after wave 12.
3. Player contact has no invulnerability window. Boss contact deals 30 damage every collision frame and can erase 100 health in four frames.
4. Every overlapping enemy contributes damage in the same frame. A crowd can create an unreadable one-frame death.
5. Ball, main chain, and second chain process the same enemy independently before removal. The same enemy can be scored or dropped more than once.
6. Destroyed enemy indices are concatenated without de-duplication, then removed with repeated array splices. Duplicate indices can remove an unrelated neighboring enemy.
7. Boss drops are checked from that duplicate index list, so one boss can produce more than one guaranteed drop.
8. Difficulty is driven by cumulative score. Strong kills accelerate waves and incoming pressure, which makes successful play punish itself.
9. The React state listener publishes game time every frame. The animation callback depends on changing React state and can be canceled and recreated repeatedly.
10. Physics caps a long frame to 16 ms rather than using a fixed-step accumulator. Device speed can alter simulation and scoring.
11. A run ticket begins when the engine mounts rather than when the player deliberately starts a run.
12. Score completion collapses rejected, expired, offline, unavailable, guest, and accepted outcomes into an ambiguous result screen.

## 5. Why the current balance becomes impossible

### Enemy pressure

The normal spawn interval is `max(800 - wave * 80, 300)` milliseconds. Base enemy speed is `40 + wave * 8` pixels per second before type multipliers. Because normal enemies currently advance twice each frame, practical movement is approximately double the authored value.

| Wave | Spawn interval | Enemies per second | Authored base speed | Approximate current movement |
| ---: | -------------: | -----------------: | ------------------: | ---------------------------: |
|    1 |         720 ms |               1.39 |                  48 |                           96 |
|    3 |         560 ms |               1.79 |                  64 |                          128 |
|    5 |         400 ms |               2.50 |                  80 |                          160 |
|    7 |         300 ms |               3.33 |                  96 |                          192 |
|   10 |         300 ms |               3.33 |                 120 |                          240 |
|   20 |         300 ms |               3.33 |                 200 |                          400 |

There is no population cap. Enemies that enter the arena bounce inside it, so any kill deficit becomes permanent crowd debt.

### Boss pressure

A boss appears every 60 seconds regardless of whether the previous boss is alive.

- Boss health is `200 + 100 * priorBossCount`.
- Boss size also grows every appearance.
- Shot cooldown is `2000 - 200 * priorBossCount` milliseconds with no lower bound.
- At the eleventh boss the cooldown reaches zero. After that, the condition can fire a volley every frame.
- Every boss is configured with a minion timer, even when its visible ability list does not claim minion spawning.
- `lastMinionSpawnTime` starts at zero, so the first minion pair can appear immediately.
- Previous bosses keep shooting and spawning while new bosses arrive.

This is an uncapped multiplicative threat curve, not a tuned endless curve.

### Player offense

- Ball damage starts at 2 and reaches only 4 after all three ball-damage levels.
- Main-chain damage uses `ceil(1 + level * 0.3)`. Levels one, two, and three all round to 2, so two advertised levels provide no additional damage.
- Second-chain damage has the same compression. Only the first upgrade changes rounded damage.
- Heavy chain resistance rounds back to at least one damage, which makes much of the underlying multiplier invisible.
- Damage does not use impact speed or impulse. A slow touch can deal the same damage as a high-momentum wrecking hit.
- Collision damage has no explicit per-target cooldown for the ball.

The numbers do not consistently reward the physics behavior the game is selling.

### Power-up economy

Power-ups begin on a 15 second timer, reduced by one second per wave to an eight second floor. Forty percent are permanent.

At wave 1, a player who collects every pickup receives an expected permanent upgrade about every 35 seconds. At wave 7, the theoretical interval falls to about 20 seconds. Actual collection is less reliable because pickups enter from arena edges and can be missed.

Run power therefore depends heavily on random rarity, category, spawn edge, and player access while enemy pressure grows deterministically. There is no pity rule, no duplicate protection for capped stats, and no guaranteed answer to a damage or survivability deficit before the first boss.

## 6. V1 product shape

### Standard: Wreck Run

A ten-minute, three-act arena run with a real victory state.

| Act | Time          | Purpose                                                            | Checkpoint                   |
| --- | ------------- | ------------------------------------------------------------------ | ---------------------------- |
| 1   | 0:00 to 2:30  | Learn movement, retract, impact, pickups, and readable enemy roles | Scout boss                   |
| 2   | 2:30 to 5:30  | Build a coherent upgrade direction and combine enemy roles         | Destroyer or Mothership boss |
| 3   | 5:30 to 10:00 | Use the completed build against controlled mixed pressure          | Final boss and extraction    |

Defeating the final boss produces victory, a result receipt, and an invitation to continue into Endless Yard or start another seeded run.

### Endless: Endless Yard

An opt-in score mode with soft-capped pressure, rotating mutators, versioned leaderboards, and no claim that the player is expected to defeat infinity. It reuses the standard run systems after those systems are proven.

### V1 content budget

- One responsive arena with readable boundaries and safe-area ownership.
- Six core enemy roles plus retained special enemies only after their tests pass.
- Three boss checkpoints assembled from the current UFO behaviors.
- The current permanent and temporary power-up concepts, rebalanced into meaningful choices.
- One result/victory presentation, one loss presentation, and one canonical platform receipt.
- A small impact, warning, pickup, damage, boss, victory, and loss sound set.

## 7. Balance contract

The values below are starting hypotheses for the harness and playtests. They are not production promises.

### Experience targets

| Player state      | Target                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| First 30 seconds  | Player understands movement and sees one successful wrecking impact                                        |
| First run         | At least 70% of observed new players reach the first boss                                                  |
| Third run         | 40% to 60% of observed players complete Wreck Run                                                          |
| Practiced player  | 70% or better completion without one mandatory upgrade path                                                |
| Expert player     | Reliable standard completion and differentiated Endless Yard scores                                        |
| Death readability | No full-health death occurs without at least 500 ms of visible warning or accumulated recoverable mistakes |
| Build variety     | At least three upgrade families complete the standard run within 15% of each other in seeded bot tests     |

### Encounter-director rules

- Advance acts by elapsed encounter time and boss completion, not by score.
- Use a threat budget rather than one uncapped global spawn timer.
- Cap active ordinary enemies and active projectiles by tested arena area and device class.
- Permit only one active boss in Wreck Run.
- Reduce ordinary spawn pressure during boss introduction and recovery windows.
- Clamp normal and boss movement, fire cadence, projectile count, and minion count.
- Telegraph every new enemy role before mixing it into ordinary pressure.
- Apply a short player damage cooldown and a clear hit reaction.
- Consolidate simultaneous contact into one bounded damage event.
- Give bosses per-attack telegraphs and collision cooldowns.

Initial harness candidates:

- 18 to 28 ordinary enemies on desktop, subject to frame and readability evidence.
- 14 to 22 ordinary enemies on supported mobile layouts.
- 450 to 650 ms player damage invulnerability after contact.
- 900 ms minimum boss shot cooldown.
- One boss, 24 ordinary enemies, and 32 live projectiles as initial hard safety caps.

### Offense and scoring rules

- Derive wreck damage from bounded impact velocity or impulse plus an upgrade multiplier.
- Give every damage upgrade a measurable effect without relying on rounding accidents.
- Apply per-target hit cooldowns so persistent overlap cannot generate frame-rate-dependent damage.
- Resolve each enemy death once by stable enemy ID.
- Grant each drop once by stable enemy ID.
- Score enemy value, impact quality, streak, boss phase, survival, and optional risk bonuses separately.
- Keep survival difficulty independent from score gain.
- Version every scoring and balance ruleset. Never merge incompatible rules into one ranked board.

### Power-up rules

- Preserve random pickups, but add a pity counter for permanent upgrades.
- Do not offer capped or currently unusable upgrades unless the result converts to a useful fallback.
- Guarantee one survivability or damage answer before the first boss.
- Present enough pickup identity that a player can make a deliberate risk decision.
- Define stacking and replacement behavior for temporary effects.
- Keep health, damage, size, speed, chain length, second chain, electric, berserk, and hyper spin noncommercial gameplay systems.
- Cosmetics may recolor or restyle these systems later but cannot change their numbers.

## 8. Balance laboratory

W0 creates a deterministic laboratory before any broad tuning.

### Required controls

- Move every gameplay constant into a typed, versioned ruleset.
- Replace direct `Math.random()` use with an injected seeded random source.
- Run physics through a fixed-step clock.
- Record compact input traces for pointer, keyboard, and touch control paths.
- Provide a headless or canvas-free simulation seam for encounter, health, spawn, pickup, score, and terminal-state rules.
- Keep rendering outside the deterministic state transition.

### Required metrics

For each seeded run, capture:

- seed, ruleset, mode, duration, victory/loss, and terminal reason;
- frame count, dropped steps, long frames, and maximum entity counts;
- spawn, kill, escape, and active population by enemy type;
- damage dealt by ball, main chain, second chain, electric effect, and other retained sources;
- damage taken by enemy contact, boss contact, projectile type, and overlapping sources;
- boss time to kill, attacks fired, minions created, and phase reached;
- power-ups spawned, offered, collected, missed, capped, and active time;
- score components, wave/act transitions, health curve, and upgrade curve;
- finish attempt count and accepted/rejected/unavailable result.

Production telemetry should retain only bounded aggregates needed to operate and balance the game. Raw pointer traces remain local or in explicit test fixtures.

### Test agents

- Stationary control, used to detect unavoidable or frame-rate-dependent damage.
- Novice perimeter mover, used to model basic avoidance without skilled swinging.
- Competent swinger, using recorded input from a player who understands retract timing.
- Upgrade-focused variants for damage, health, speed, chain, and mixed builds.
- Stress agent that survives long enough to exercise every boss, projectile, special enemy, and cap.

Every candidate ruleset runs across fixed seeds and at 30, 60, and 120 Hz simulation schedules. Equivalent input must produce equivalent accepted state within the documented tolerance.

## 9. Delivery sequence

### W0: Freeze the truth and build the laboratory, 3 to 5 days

- Record current rules, defects, live behavior, browser/device support, and a short human playtest baseline.
- Add build, type-check, lint, unit-test, and browser-smoke commands that exclude preserved archive source from active lint.
- Introduce seeded RNG, a typed ruleset, fixed-step state seam, metrics, and recorded input traces.
- Add regression tests for the duplicate enemy update, pusher crash, boss contact, duplicate death, duplicate drop, and repeated removal.

Exit: the current broken ruleset is reproducible, the known crashes are failing tests, and balance changes can be compared by seed.

### W1: Simulation correctness and lifecycle, 4 to 6 days

- Establish one stable animation owner and fixed-step accumulator.
- Move gameplay state out of frame-by-frame React publication.
- Resolve collision events once by entity ID.
- Add player and per-target hit cooldowns.
- Guarantee one terminal transition, one finish attempt, and complete cleanup.
- Pass 20 start, death, victory, restart, pause, focus-loss, resize, and navigation cycles without accumulating loops, listeners, timers, or entities.

Exit: physics and results no longer depend on render frequency or duplicated lifecycle work.

### W2: Encounter director and first balanced Wreck Run, 5 to 7 days

- Separate acts from score.
- Implement bounded spawn budgets, population caps, boss gates, recovery windows, telegraphs, and safety clamps.
- Rebuild damage around impact quality and meaningful upgrade increments.
- Add power-up pity, eligibility, and duplicate protection.
- Tune the first ten-minute ruleset with seeded agents and at least five human testers.

Exit: Wreck Run can be won, no seed is mathematically doomed by missing required power, and target completion bands are plausible.

### W3: Controls, mobile, HUD, and onboarding, 4 to 6 days

- Use Pointer Events and pointer capture.
- Add deliberate keyboard movement and retract controls.
- Add a tested touch scheme, landscape guidance, safe-area handling, and dynamic viewport resize.
- Recompose the HUD for phone, tablet, laptop, and wide desktop.
- Add a playable first-30-second tutorial and input-specific help.
- Verify pause, orientation, focus, reduced motion, and visibility changes.

Exit: every advertised device and input passes the matrix. Unsupported modes say so before launch.

### W4: Presentation, feedback, and content completion, 3 to 5 days

- Preserve the existing logo identity while optimizing the 1.5 MB asset.
- Add impact, warning, damage, pickup, boss, victory, and loss feedback.
- Make enemy roles and boss attacks visually distinct.
- Finish victory, loss, build summary, score breakdown, and restart flows.
- Remove stale generic Tailwind dashboard styling from the immersive game surfaces.

Exit: play reads clearly without a wall of text, and all feedback respects audio and reduced-motion controls.

### W5: Platform integration and honest competition, 4 to 6 days

- Start the platform run on deliberate play.
- Remove local WreckaVOID password, Google, profile, and membership paths.
- Finish one-use runs with bounded metrics and a versioned ruleset.
- Show saved, provisional, rejected, expired, offline, unavailable, guest, and retried states accurately.
- Build `/games/wreckavoid/` with controls, device support, Play, status, personal best, favorites, leaderboard, and result receipt sharing.
- Keep gameplay available when platform services fail and keep rankings closed when trust cannot be established.

Dependency: coordinated platform foundation and non-production database acceptance.

Exit: one identity, one result, one trust label, and one canonical share URL.

### W6: Endless Yard and production hardening, 3 to 5 days

- Add soft-capped endless pressure and rotating mutators on top of the proven standard rules.
- Create a separate versioned endless leaderboard.
- Run accessibility, browser, performance, memory, dependency, score-abuse, and service-failure matrices.
- Optimize assets and first-play loading.
- Verify ruleset isolation between Wreck Run and Endless Yard.

Exit: a long run remains readable, bounded, and competitive without a mathematically guaranteed frame-rate death spiral.

### W7: Release candidate, canary, and handoff, 2 to 3 days

- Publish a reviewable preview with rollback target.
- Run fresh desktop and mobile playtests against production-like services and synthetic accounts.
- Publish rules, controls, trust labels, known issues, and support path.
- Release to production only after explicit approval.
- Smoke the exact deployed commit, monitor errors and finish rejection codes, and prove rollback.

Exit: all V1 acceptance checks pass on the deployed commit and ordinary support ownership is documented.

## 10. Effort and parallelism

Expected effort is 28 to 43 focused engineering and QA days after the shared platform interfaces are available. A solo sequence is roughly six to nine focused weeks. After W1 establishes stable seams, two lanes can safely overlap:

- Game lane: director, balance, controls, presentation, and performance.
- Platform lane: account boundary, run API, detail page, leaderboard, receipts, and service-failure states.

W0 and W1 should not be split across conflicting implementations. Correctness and the deterministic seam are shared dependencies for every later sprint.

## 11. V1 acceptance

- [ ] The production build, TypeScript validation, lint, focused tests, and browser tests pass.
- [ ] Wreck Run has a clear victory state and Endless Yard is explicitly endless.
- [ ] Five first-time testers can explain movement, retract, damage, pickups, and the current objective after playing rather than reading source material.
- [ ] At least 70% of observed new players reach the first boss.
- [ ] Three materially different upgrade families can complete the same fixed seed within the accepted balance band.
- [ ] No pusher, ninja star, boss, projectile, chain, second-chain, electric, berserk, hyper-spin, or drop path throws.
- [ ] One enemy can die, score, and drop at most once.
- [ ] One player damage event cannot repeat every frame.
- [ ] Active entities and projectile rates remain under ruleset caps.
- [ ] Equivalent seeded input produces stable state at supported simulation schedules.
- [ ] Twenty restarts do not increase active animation loops, listeners, timers, or retained entity memory.
- [ ] Pointer, keyboard, and advertised touch controls pass the device matrix.
- [ ] Phone HUD, pause, results, and critical warnings do not overlap or leave safe areas.
- [ ] Guest play works without an account or platform service.
- [ ] Signed-in completion creates no more than one accepted or provisional platform result.
- [ ] Rejected, expired, offline, unavailable, and guest results never present as saved.
- [ ] Leaderboards never compare incompatible rulesets without an explicit compatibility rule.
- [ ] The canonical game page, personal best, leaderboard, favorite, Play, and receipt share work.
- [ ] Desktop P95 simulation frame time stays within 20 ms on the reference machine.
- [ ] Supported mid-tier mobile play sustains the accepted 45 FPS floor with P95 frames within 33 ms.
- [ ] Audio, reduced motion, focus loss, resize, orientation, and browser navigation behave predictably.
- [ ] The deployed commit, error state, result pipeline, monitoring, and rollback route are verified.

## 12. First execution action

Begin W0 without changing production:

1. Extract the current constants into `rulesets/legacy.ts` without changing values.
2. Add a fixed-seed random interface and failing regression tests for the six critical collision and pressure defects.
3. Create a minimal simulation state that advances independently from React and canvas rendering.
4. Record three desktop input traces and one deliberately unsupported mobile trace.
5. Produce the first balance report comparing current rules with a capped, single-update reference candidate.

W0 should end with evidence, not a subjective patch. The first reviewed rules change belongs in W1 or W2 after the baseline can prove what changed.
