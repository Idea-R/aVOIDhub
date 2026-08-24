# VOIDaVOID V0/V1 gameplay and runtime contract

Updated: 2026-08-20
Status: V0 specification and V1 local runtime gates complete; V2–V4 remain open

## What this document is for

This is the contract for the shipping VOIDaVOID play path in `games/void-avoid`. It records what the old game actually does, which source tree is canonical, what the V0/V1 repair changed, and what the result does **not** claim.

The repair keeps the original meteor-avoidance game and its defense, power-up, combo, fragment, and chain-detonation systems. It does not replace the game with a smaller demo.

## Canonical runtime

The release entry is `src/main.tsx` → `src/App.tsx` → `src/components/Game.tsx` → `src/game/core/GameEngine.ts`.

That path owns:

- one `GameEngineCore` per mounted canvas;
- one fixed-step `GameLoop`;
- one canvas-owned `InputHandler`;
- one `CanvasManager`/`ResizeManager` pair;
- one `EngineCore` system collection; and
- one React shell for start, HUD, help, pause, results, and replay.

The TypeScript and lint gates start from `src/main.tsx` plus the three focused test files. TypeScript follows their imports and checks the resulting 51-file shipping graph. Historical alternate apps, engines, auth screens, performance experiments, audio integrations, and canvas backups remain in source history, but they are not part of the V1 release graph.

This is an intentional quarantine, not a claim that every historical file has been repaired.

## Player contract

### Start and steering

- Play begins only after the player chooses **Enter the field**.
- The player signal starts at the center of the rendered canvas.
- Mouse and pen movement steer the signal.
- One active touch pointer steers the signal; additional simultaneous pointers are ignored.
- Pointer coordinates are mapped through the rendered canvas rectangle and clamped to its bounds.
- Browser zoom remains available. The game does not intercept Ctrl/Cmd zoom, wheel zoom, or pinch zoom.

### Pulse knockback

- A mouse double-click or a nearby, short double-tap requests a pulse.
- A double-tap must use two taps no more than 320 ms apart. Each tap must last no more than 220 ms and move no more than 48 canvas pixels.
- A pulse consumes one collected charge. With no charge, the request does nothing.
- Meteors within 150 pixels are destroyed. Meteors between 150 and 300 pixels are pushed away with force that falls as distance increases.
- A player can hold at most three charges.

### Meteor and collision rules

- The first three seconds are a grace period.
- At each 60 Hz simulation step, spawn probability is `0.003 + min(gameTime / 150, 0.017)`. This rises from 0.3% to a maximum of 2% per step.
- No more than 50 meteors are active.
- A meteor enters from a random edge and initially aims at the current player position.
- Base speed is `0.8 + min(gameTime / 90, 2)`, multiplied by a random value from 0.8 through 1.2.
- A meteor has a 15% chance to be a super meteor. Super meteors move at twice the calculated speed.
- Regular radius is 6–12 pixels. Super radius is 12–16 pixels.
- The player collision radius is 6 pixels. Contact is terminal when the center distance is less than the player radius plus meteor radius.
- Off-screen meteors are released after crossing a 50-pixel margin.

Meteor movement remains frame-step based inside a fixed 60 Hz simulation. That preserves the old game feel across normal display refresh rates. Converting entity movement to elapsed-time units would be a ruleset change and belongs in a later version.

### Power-ups, defense, and chain detonation

- A knockback power-up attempts to spawn every 5–20 seconds before 60 seconds and every 3–12 seconds afterward.
- Power-ups grant a pulse charge on contact.
- The electrical defense system can destroy or deflect meteors and can end a run when the player enters its live danger zone.
- Chain fragments award 10 points each.
- Completing a fragment chain clears active meteors, awards the documented chain score, and triggers bounded visual effects.

## Score contract: local ruleset `voidavoid-local-v1`

This ruleset is local and unranked. Random score bonuses and unseeded world generation mean the server cannot reproduce a run yet.

### Survival

`floor(max(0, elapsedSeconds) × 5)`

### Meteor destruction

- Regular meteor: 5 base points plus a random integer from 0 through 10.
- Super meteor: 15 base points plus a random integer from 0 through 15.

### Knockback combo

The running combo counts meteors destroyed across successful knockbacks. It expires after three seconds without a successful continuation.

| Combo count | Base bonus |
| ---: | ---: |
| 3 | 50 |
| 4 | 75 |
| 5 | 100 |
| 6–7 | 125 |
| 8–9 | 175 |
| 10–11 | 250 |
| 12–14 | 350 |
| 15+ | 500 |

The base bonus is multiplied by the current knockback streak:

- 1–2 consecutive knockbacks: 1×;
- 3–4: 1.5×;
- 5–6: 2×;
- 7–9: 2.5×; and
- 10+: 3×.

A single knockback also gets a perfect bonus before the same streak multiplier: 25 for three meteors, 35 for four, and 50 for five or more.

### Chain completion

Chain completion awards 250 points plus 30 points per cleared meteor, multiplied by:

- 1× for one or two meteors;
- 1.5× for three or four;
- 2× for five through nine;
- 2.5× for ten through fourteen;
- 3× for fifteen through nineteen; and
- 4× for twenty or more.

### Result truth

- The result sheet shows survival, meteor, combo, total, and best-chain values from the completed local run.
- The best score is stored only in the browser under `voidavoid-local-best-v1`.
- The game does not insert a score, carry a guest score through sign-up, calculate a claimed leaderboard placement, or call an authenticated player “verified.”
- The result sheet says exactly what happened: **Saved on this device. No platform placement was claimed.**

## Lifecycle contract

- `start()` resets the simulation before requesting the first frame.
- The loop uses a 60 Hz fixed step, clamps one browser-frame delta to 100 ms, and executes at most six catch-up steps before dropping excess accumulated time.
- Only one animation frame may be pending.
- Manual pause, help, focus loss, visibility loss, and terminal state are separate reasons. Clearing one reason cannot clear another.
- A terminal transition is accepted once per run. It pauses the simulation before publishing the result.
- Replay clears terminal state, resets simulation/performance/presentation state, and requests one frame.
- Unmount/stop cleanup is idempotent and removes loop, pointer, resize, orientation, visual-viewport, canvas-behavior, and React-owned keyboard listeners. It clears deferred defense effects and object pools.

## Canvas and responsive contract

- The rendered game container owns canvas width and height.
- The V1 backing bitmap deliberately uses device-pixel-ratio 1. The older systems mix backing-store and logical pixels, so pretending to support DPR 2 would make collision/input/render coordinates disagree. A full logical-pixel conversion belongs in V4.
- ResizeObserver is the normal owner. Window resize is only its fallback; orientation and visual-viewport changes feed the same manager.
- A resize publishes authoritative state even if layout already assigned the same backing dimensions.
- Portrait and short-landscape shells must not introduce horizontal overflow. Blocking result/help/pause surfaces may scroll internally when required.

## Presentation and accessibility contract

- Menus and dialogs use the system cursor; the play canvas uses a crosshair.
- Buttons have visible keyboard focus, hover, and pressed depth.
- The HUD is removed from the accessibility/focus surface while a blocking dialog is open.
- Escape toggles manual pause or closes help.
- Text and controls remain readable without the original globally hidden cursor.
- Reduced-motion preference removes decorative animation and transition duration. It does not change physics or scoring.
- Audio is intentionally dormant in V1. The historical external music stack is not part of the release graph and the UI does not promise sound. Local, lifecycle-safe audio is V4 work.

## Evidence captured for V0/V1

- Active graph: 51 TypeScript files, zero lint errors, zero warnings.
- Focused tests: 9 passing across fixed-step/pause lifecycle, double-tap classification, scoring bounds/formulas, and score reset.
- Standalone production build: 255.65 KB JavaScript / 73.57 KB gzip and 9.14 KB CSS / 2.99 KB gzip.
- The previous 1.57 MB decorative result image is no longer in the shipping graph.
- The previous build was about 425.15 KB JavaScript / 112.17 KB gzip; the repaired build is about 40% smaller before compression and 34% smaller after compression.
- Full Next.js platform production build passes with all 21 routes generated or classified.
- Browser QA passed at 1440×900 desktop, 390×844 portrait, and 844×390 short landscape.
- The browser console had zero warnings and zero errors.
- A 30-cycle deterministic finish/restart soak produced exactly +30 sessions started, +30 sessions finished, and +30 resets. It retained one pending animation frame, five pointer listeners, and a 1440×900 DPR-1 canvas.

Browser pointer emulation is not physical-device certification. Physical iOS/Android touch, orientation, browser chrome, and sustained performance remain V4 release evidence.

## V2–V4 work that remains

### V2 — deterministic score evidence

- Seed every score-affecting random decision.
- Version difficulty and score rules in a shared contract.
- Record bounded events and prove whether server recomputation is practical.
- Keep the result provisional unless the evidence supports a stronger label.

### V3 — platform integration

- Start and finish a one-use platform run without allowing browser-authored identity, game key, ruleset, or trust level.
- Add `/games/voidavoid/` board, personal best, status, and receipt-based sharing.
- Use the platform session; do not restore the game-local password/profile stack.
- Handle guest, signed-in, expired ticket, rejected finish, retry, and service-outage paths.

### V4 — release hardening

- Convert all simulation/render/input systems to one logical-pixel model before enabling high-DPR backing stores.
- Add local, consent-aware audio with mute persistence and complete teardown.
- Measure long-run frame time and heap behavior on target devices.
- Test real iOS and Android touch/orientation behavior.
- Run accessibility and performance audits on the deployed candidate, then verify rollback.

## V0/V1 exit decision

V0 and the local V1 runtime gate are complete. VOIDaVOID is safe to review as a responsive, guest-first, local-score game. It is not ready for a shared leaderboard, stronger score trust, platform identity, audio, or production release until V2–V4 pass their own gates.
