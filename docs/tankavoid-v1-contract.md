# TankaVOID V1 contract and prototype recovery record

- Date: 2026-08-20
- Issue: [#24](https://github.com/Idea-R/aVOIDhub/issues/24)
- Current release-candidate branch: `codex/tankavoid-t7-release-hardening`
- Ruleset target: `tankavoid-v1-rules-1`

## Product sentence

TankaVOID is a short top-down survival game about exposing the right side of your tank at the right time. The hull is slow enough to make facing a decision; the turret can aim independently; front, side, and rear hits produce visibly different outcomes.

The first releasable slice is not the old prototype with every idea repaired. It is one polished arena, five escalating waves, three ordinary enemy behaviors, and one final pressure event built around readable directional armor. This bounded mode is now called **Proving Grounds** in product planning: it can become the tutorial, daily challenge, browser demo, and ranked ruleset while a separately scoped Expedition mode recovers the old prototype's larger-world survival ambition.

## T0 source and recovery record

Two source histories mattered:

| Source                                                                                           | State before T0                                                                                  | Decision                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `games/tanka-void` in `Idea-R/aVOIDhub`                                                          | React placeholder plus 16 incompatible engine/entity/system files; 78 TypeScript errors          | Replace the active graph. Preserve through repository history.              |
| `C:\dev\TankAVOIDz`, remote `Idea-R/TankaVOID`, branch `feat/get-game-working`, commit `e30e813` | Stronger playable mechanics prototype; 19 modified and 5 untracked entries; one TypeScript error | Preserve exactly. Treat as mechanics reference, not the production runtime. |

The standalone dirty work was frozen before the rebuild branch was created:

| Recovery artifact                              | Contents                                                                                             | SHA-256                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `C:\dev\TankAVOIDz-recovery-20260820-0700.zip` | Working source including the 24 dirty/untracked entries; excludes `.git`, `node_modules`, and `dist` | `FD88B538CB6027A3D95A771A0A00FDFF387B73837D5E1012001C7E714BEBE425` |
| `C:\dev\TankAVOIDz-history-20260820.bundle`    | All committed refs and history from `Idea-R/TankaVOID`                                               | `CD0066CB728386264890931805E61D4F4BFBCADFD377D917AB256FE051D4004E` |

These recovery files stay local and outside Git because the working snapshot is user-owned prototype material, not reviewed production source. The source worktree itself was not edited, cleaned, stashed, or committed during T0.

## What is worth salvaging

The standalone prototype proves that the game can support:

- deliberate hull movement with independent turret aim;
- a projectile entity and multiple fire profiles;
- player, enemy, boss, infantry, mine, pickup, terrain, particle, and track-mark experiments;
- pointer, keyboard, early joystick, and touch-fire experiments;
- a `Tank.takeDamage(damage, angle?)` concept that distinguishes front, side, and rear;
- a canvas camera, wave loop, survival clock, and score presentation.

Those are design references. No module earns a direct port until its math is isolated, typed, tested, and shown to fit the V1 contract.

## What is explicitly rejected

- The monorepo `Game.ts` and its mutually incompatible entity APIs.
- The standalone window-wide custom-event projectile bus.
- Duplicate keyboard/pointer/resize ownership between `Game` and `InputManager`.
- Hard-coded “Anonymous” leaderboard rows and any browser-owned accepted score.
- Three weapons, infantry, barracks, landmines, eight pickups, progression, multiple bosses, and every particle/terrain system as default V1 scope.
- Repairing a nearly compiling prototype by loosening TypeScript or adding compatibility shims.
- Advertising touch, multiplayer, accounts, rankings, or purchases before their own gates pass.

## Canonical run lifecycle

```text
briefing → running ⇄ paused → complete → restart
    ↑                                  ↓
    └──────────── return to briefing ──┘
```

T3 refines `running` without changing the outer ownership boundary:

```text
deploying (180 ticks) → combat → resolved (90 ticks) → complete
```

- One `GameRuntime` owns one simulation, one fixed-step loop, one input controller, one `ResizeObserver`, one canvas renderer, and teardown.
- Simulation advances at 60 Hz. A rendered frame may process at most five catch-up steps. Additional backlog is dropped and recorded instead of creating a death spiral.
- Start and restart take an unsigned 32-bit seed. All later world, spawn, AI, and score-affecting randomness must derive from named streams rooted in that seed.
- Pause stops simulation time and the frame owner. Blur clears held input and pauses. Resume begins with a fresh frame-time baseline.
- Finish is idempotent. A completed drill has no pending frame. Destroy removes all listeners and the resize observer.
- The world is always 1200 × 720 logical pixels. The bitmap may render at DPR 1–2, but input and simulation never use bitmap coordinates.

## T1 input contract

- `W`/up and `S`/down control forward and reverse throttle.
- `A`/left and `D`/right rotate the hull. Reverse steering changes direction naturally.
- Pointer movement aims the turret through the same letterbox transform used by rendering.
- Primary pointer down records one trigger pull per down edge. T1 does not create a projectile or score.
- Escape toggles manual pause. Expected browser shortcuts are not captured.
- Touch is deliberately unclaimed. T4 decides whether a two-stick/turret control scheme is good enough to ship.

## T2 directional-combat contract

T2 must implement this contract as pure tested math before visual effects:

1. A projectile carries position, previous position, normalized travel direction, speed, base damage, penetration, owner, and deterministic identifier.
2. Collision provides an impact point and the defender's hull angle. The game never calls `takeDamage(damage)` without an impact vector.
3. Convert the defender-center-to-impact direction into defender-local space. The impact point chooses the physical plate; projectile travel is reserved for incidence:
   - front face: absolute local angle ≤ 45°;
   - rear face: absolute local angle ≥ 135°;
   - otherwise left or right side.
4. Use the struck face's outward normal to calculate incidence from the normal:
   - greater than 68°: ricochet, zero hull damage;
   - 50–68°: glancing hit, 45 percent of the face-adjusted damage;
   - below 50°: penetrating hit, full face-adjusted damage.
5. Initial face multipliers are front `0.55`, side `0.90`, rear `1.35`. They are balance constants, not hidden random rolls.
6. Feedback must state the outcome with at least two channels: shape/motion plus sound or text. Color alone is insufficient.
7. Deterministic tests cover face boundaries, shallow and square incidence, left/right symmetry, zero-length input rejection, damage clamping, and exact repeatability.

T2 implements that separation explicitly. Choosing a face from projectile travel would constrain every four-face incidence to 45° or less and make the written glancing/ricochet thresholds unreachable. Swept collision therefore supplies the impact point, the center-to-impact vector chooses the face, and the inverse travel vector is compared with that face's outward normal.

## T3 encounter-loop contract

- The arena owns exactly four fixed barricades: two north, two south, with an unobstructed central lane.
- Tanks are circles for world separation. They cannot overlap cover or each other, and collision correction is deterministic.
- A shell resolves the nearest swept collision across its target and all cover. Cover in front of a tank always wins; there is no through-cover damage.
- The bruiser cannot fire through cover. When line of sight is blocked, it routes toward the central lane until it can reacquire the player.
- Deployment locks all combat input and AI for 180 ticks. A disable locks movement/input, clears live shells, and holds the final impact for 90 ticks before completion.
- Tank-impact and cover-strike histories each retain at most eight entries.
- T3 cover is indestructible. Destruction, debris, and particles are not hidden or implied systems.

## T4 control, audio, and accessibility contract

- Keyboard/pointer is the supported local-browser path. Touch is a release candidate until a physical iOS and Android matrix passes.
- One input controller owns keyboard, canvas pointer, drive-thumb, and aim-thumb state. Left-thumb drag maps to throttle and hull turn; right-thumb drag maps to aim; releasing an armed right thumb queues exactly one bounded trigger pull.
- Touch pads are semantic, container-bound controls with reactive knobs. They may not overlap the HUD, coaching surface, each other, or the viewport safe edge at a claimed size.
- Audio is procedural and local. One context is created only after a player gesture, eight voices are the hard ceiling, mute persists, failure is reported honestly, and pause/result/teardown leave zero voices.
- System reduced motion is mandatory. The local preference may request additional reduction but may not restore motion the operating system disabled. Motion and sound choices never affect the simulation or a future score contract.
- First-run coaching is short, device-aware, locally dismissible, and derived from existing encounter state. It cannot introduce timers or a second gameplay owner.
- Browser emulation is acceptable for responsive and Pointer Events evidence, but it is not physical-device certification.

## T5 five-wave content contract

T5 turns the proving encounter into one bounded run. It keeps one arena, one player cannon, the existing armor rules, and no pickups or upgrade screen.

| Wave | Name           | Hostiles                                 | Positioning problem                                                    |
| ---: | -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
|    1 | Cut the angle  | One scout                                | Fast lateral pressure exposes a side plate.                            |
|    2 | Break the line | One bruiser                              | Slow frontal pressure tests cover and facing.                          |
|    3 | Crossfire      | One scout and one hunter                 | The scout closes while the hunter holds a long firing lane.            |
|    4 | No safe range  | One bruiser and one hunter               | Cover must answer two different preferred ranges.                      |
|    5 | Last command   | One commander, one scout, and one hunter | The commander closes while the two specialist behaviors remain active. |

The behavior identities are fixed:

- **Scout:** fastest hull and turn rate, lowest health and shell damage, and an orbiting flank preference.
- **Bruiser:** slowest ordinary hull, highest ordinary health, and direct medium-range pressure.
- **Hunter:** maintains the longest range, strafes when settled, and fires more often than a bruiser.
- **Commander:** final-wave-only pressure tank with the largest health pool and a direct close; it is not a second boss system or a source of special weapons.

The first wave deploys for 180 ticks. Later waves deploy for 90 ticks after a 120-tick clear hold. A clear repairs exactly 28 hull points before the next deployment, capped at maximum health. The final clear enters the existing 90-tick result hold. Combat, deployment, clear holds, repair, victory, and defeat all use simulation ticks; React owns no wave timer.

All five wave definitions are static and versioned in source. The run seed may vary the small spawn offset and orbit direction, but cannot change wave membership, health, weapons, damage, or the number of hostiles. The same seed and input history must reproduce the same complete snapshot.

T5 result metrics are local facts, not a score: waves cleared, enemies disabled, elapsed active simulation time, damage dealt/taken, armor repaired, hits, shots, and ricochets. The future `tankavoid-v1-rules-1` score remains a T6 platform boundary and is not silently calculated or accepted in T5.

T5 raises only the ceilings required by the written roster:

- three active enemies;
- 32 active projectiles;
- 12 retained tank impacts;
- eight retained cover strikes;
- zero particles;
- 64 logical renderer draw-items;
- one simulation, one frame owner, one resize owner, 12 input listeners, one audio context, and eight audio voices.

## T6 platform run and receipt contract

T6 connects the bounded five-wave run to the platform without changing its public Coming Soon state.

- The browser asks the same-origin platform for one authenticated run. The server creates the unsigned 32-bit seed and returns it in a manifest with mode `five-wave` and ruleset `tankavoid-v1-rules-1`.
- A guest, an unavailable platform, or an unconfigured preview still starts immediately with a local seed. Failure to save never invalidates the local result.
- Only natural `run-cleared` and `player-disabled` terminals are eligible. The development-only systems check never submits.
- The terminal summary contains bounded integer values for waves, disabled enemies, commander state, combat ticks, damage, repair, shots, hits, ricochets, and remaining hull.
- The server rejects wrong-run, wrong-mode, wrong-ruleset, impossible wave/kill/commander combinations, living defeats, dead clears, overlong runs, and inconsistent hit totals.
- The server ignores any browser-authored score and recomputes the frozen additive formula from the accepted summary.
- A successful finish is idempotent through the platform's one-use ticket function and returns an immutable `/results/<submission-id>/` receipt.
- Trust remains `provisional`; the capability is `bounds_recomputed`. This proves the identity, ticket, ruleset, bounds, and score math, not the truth of every browser-authored combat event.
- Accepted TankaVOID rows may appear on its platform detail page and personal-best view. Historic rows stay `legacy` and cannot be mixed into this board.
- The build may be assembled for deployment review, but the catalog has no Play link and no public lowercase redirect until T7 physical-device, deployed, and rollback evidence passes.

Mines, infantry, barracks, pickups, alternate weapons, abilities, destructible cover, upgrade trees, progression currency, additional arenas, multiplayer, and platform scoring remain rejected for this sprint.

## T7 release-candidate contract

T7 certifies the bounded Proving Grounds build without silently widening its public claim.

- One root release command owns contract, game, platform, catalog, foundation, assembly, review-artifact, and no-public-route checks.
- Pull requests affecting the Tanka release surface run the same command on Linux CI.
- Frame diagnostics report rendered frames, average and maximum delta, long frames above 34 ms, and dropped simulation time.
- Portrait, short landscape, desktop, pause/focus, reduced-motion, muted-audio, and repeated-reset behavior must stay inside the written ownership and capacity ceilings.
- Browser viewport emulation does not establish physical iOS or Android support.
- A local or deployed review artifact does not authorize a friendly route, catalog Play action, database activation, or production deployment.
- The five-wave ruleset stays frozen even if a larger Expedition mode is approved later. Expedition receives its own mode, ruleset, progression, performance, and score contracts rather than mutating ranked Proving Grounds history.

T7 source and browser evidence lives in [`sprint-tankavoid-t7.md`](sprint-tankavoid-t7.md).

## V1 content and score boundary

The intended run is five waves in one arena:

- scout: flanks and exposes the player's side;
- bruiser: slow frontal pressure;
- hunter: holds range and punishes a stationary turret line;
- final pressure event: one commander or equivalent coordinated close.

The initial score contract for `tankavoid-v1-rules-1` is additive and replayable:

- post-armor damage dealt: one point per damage point;
- normal enemy disabled: 75 points;
- wave cleared: 200 points;
- final pressure event cleared: 500 points;
- active survival time: two points per completed second.

Hits, shots fired, ricochets, movement, and damage absorbed do not directly award points. Accuracy, absorbed damage, face-hit counts, deflections, survival time, and wave reached remain receipt metrics. Balance may change constants only under a new ruleset version.

No browser result is accepted merely because it carries these totals. Platform submission remains provisional until a one-use server ticket and bounded evidence or deterministic replay reproduce the result.

## Performance and release budgets

T1 establishes the floor that later sprints must preserve:

- 120 KiB maximum initial compressed transfer;
- 260 KiB maximum single JavaScript asset;
- no downloaded audio/video or external runtime assets;
- one canvas and one pending frame while running;
- eight input listeners and one resize observer for the current keyboard/pointer contract;
- no listener, frame, observer, or canvas growth across twenty runs;
- maximum five simulation catch-up steps per rendered frame.

T3 adds and enforces these encounter ceilings:

- one active enemy;
- four static cover pieces;
- 32 active projectiles;
- eight retained tank impacts;
- eight retained cover strikes;
- zero particles;
- 56 logical renderer draw-items;
- five catch-up simulation steps per rendered frame;
- a 250 ms accepted frame-delta clamp, with the largest accepted delta diagnosed.

The draw-item ceiling counts bounded logical render entries rather than individual Canvas API methods.

T4 changes the input ceiling from eight to 12 listeners by adding four delegated touch-surface listeners. It also adds hard ceilings of two owned touch pointers, one audio context, eight audio voices, zero downloaded media, and zero external runtime assets. The frame, observer, simulation, projectile, impact, cover, enemy, particle, and draw-item ceilings do not change.

T5 raises only the content ceilings: three active enemies, 12 retained tank impacts, and 64 logical draw-items. Four cover pieces, 32 projectiles, eight cover strikes, zero particles, one simulation/frame/resize owner, 12 listeners, one audio context, and eight voices remain fixed. The 220-point player hull and low single-digit enemy shell damage remain the Proving Grounds baseline. T7 adds cumulative frame-quality diagnostics but does not raise a content or runtime ceiling.

## Public boundary

TankaVOID stays **Coming Soon** and noninteractive in the aVOID catalog. T6 stages the review build and implements the source-level provisional score boundary; T7 adds CI, diagnostics, presentation, responsive-browser, and lifecycle evidence. Neither sprint activates the pending database or adds a public friendly route. Publication still requires the short-lived database acceptance matrix, physical-device evidence, a successful Git-driven deploy-preview smoke, and verified rollback evidence.
