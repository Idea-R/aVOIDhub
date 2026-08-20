# Sprint evidence — TankaVOID T4 controls and feedback

- Date: 2026-08-20
- Issue: [#30](https://github.com/Idea-R/aVOIDhub/issues/30)
- Branch: `codex/tankavoid-t4-controls-feedback`
- Draft PR: [#31](https://github.com/Idea-R/aVOIDhub/pull/31)
- Base: exact T3 commit `04129a3`
- Public state: Coming Soon; no platform staging or deployment

## Intended outcome

Make the one-encounter T3 build understandable and controllable without weakening its single-owner runtime. T4 adds a deliberate two-thumb candidate, small procedural audio, first-run coaching, persistent player preferences, and a responsive settings/HUD pass. It does not add waves, scoring, accounts, platform routes, or a mobile-support claim that has not been tested on physical hardware.

## Device and control decision

Keyboard and pointer remain the supported local-browser control path. Touch is now a release candidate with a frozen contract:

- the left thumb drags for throttle and hull turn;
- the right thumb drags to aim;
- releasing the right thumb queues exactly one cannon shot;
- both pads feed the same bounded `InputSnapshot` consumed by the 60 Hz simulation;
- the input controller, not React, owns pointer capture, queued fire, reset, and teardown.

The two pads are large, separated, labelled semantic groups and kept clear of the HUD. Their knobs react within their own bounds instead of floating independently from the responsive container. `?touch` is an engineering override for browser QA; it is not evidence of a real touchscreen. Physical iOS and Android play remain an explicit T7 release gate.

## Feedback and preference contract

T4 adds a local `TankAudioController` with five procedural cues: cannon fire, tank impact, cover strike, victory, and defeat.

- Audio creates at most one native context and only after a real player gesture.
- Muting is exact and persisted as `tankavoid:sound:v1`.
- Audio failure is shown as unavailable instead of pretending sound is active.
- At most eight voices may be active; pause, result, briefing, and teardown silence them.
- No audio file, timer, network asset, score effect, or entitlement is involved.

Motion choice is stored as `tankavoid:motion:v1`. An operating-system reduced-motion request is mandatory and cannot be overridden by the local control. Reduced motion removes decorative transitions without changing simulation timing, combat, or evidence.

First-run instructions are tick-derived and device-specific. They explain deployment, front armor, cover, and the active controls in short prompts. A player can hide them, restore them for the next run, and retain that choice locally. These prompts never change combat state.

## Ownership and ceilings

| Resource                 | T4 ceiling | Evidence                                                                              |
| ------------------------ | ---------: | ------------------------------------------------------------------------------------- |
| Input listeners          |         12 | Eight existing keyboard/pointer listeners plus four delegated touch-surface listeners |
| Touch owners             |          2 | One drive pointer and one aim pointer; reset clears both                              |
| Queued fire pulls        |          4 | Existing bounded action queue; one aim release adds one pull                          |
| Audio contexts           |          1 | Lazy gesture-owned context, reused across settings and runs                           |
| Audio voices             |          8 | Fixed controller capacity; overflow cues are ignored                                  |
| Downloaded audio/media   |          0 | Procedural Web Audio only                                                             |
| Resize observers         |          1 | Existing runtime viewport owner                                                       |
| Running animation frames |          1 | Existing fixed-step loop owner                                                        |

All T3 encounter ceilings remain unchanged: one enemy, four cover pieces, 32 projectiles, eight tank impacts, eight cover strikes, zero particles, 56 logical draw-items, five catch-up steps, and a 250 ms accepted-frame-delta clamp.

## Automated verification

`npm run verify:release --workspace=@avoid/tanka-void` passed:

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Vitest: 9 files / 33 tests.
- Vite production build: pass.
- HTML: 0.65 kB / 0.38 kB gzip.
- CSS: 14.14 kB / 3.93 kB gzip.
- JavaScript: 187.61 kB / 59.26 kB gzip.
- Initial compressed transfer: 62,857 / 122,880 bytes.
- Largest JavaScript: 187,613 / 266,240 bytes.
- Downloaded media: 0.
- External runtime assets: 0.

The added tests cover touch drive/throttle mapping, normalized touch aim, exactly one shot per aim release, multi-pointer ownership, disabled/reset cleanup, 12-listener ownership and teardown, gesture-only audio creation, one-context reuse, the eight-voice ceiling, mute/unavailable failure, pause silence, runtime cue routing, and audio teardown. `npm run build:platform` also generated all 21 platform routes successfully.

## Browser evidence

The briefing passed at 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, 1440 × 900, and 1920 × 1080 with no document-level horizontal overflow. The two shortest viewports use an internal briefing scroll area; the primary action remains visible and reachable.

The live forced-touch state passed at 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, and 1440 × 900:

- both pads remained inside the viewport;
- the pads did not overlap each other, the HUD, or the coaching surface;
- document horizontal overflow stayed zero;
- pause stopped the frame owner and focused one labelled dialog;
- sound off/on retained one audio context and zero paused voices;
- motion reduced applied at the app root;
- the browser warning/error log remained empty.

Browser QA found one instrumentation defect: the smoke-only diagnostic bar sat above the phone touch pads and could intercept a drag. It now ignores pointer events. After that repair, a right-pad drag/release produced one queued shot. Five complete touch-driven encounters then ended in `Armor line broken`; every win recorded six accepted shots, six hits, 120 damage, zero terminal projectiles, zero terminal frame, one audio context, 12 listeners, and zero active voices.

The normal desktop URL reported `keyboard-pointer`, rendered no touch pads, unlocked one audio context from the Start gesture, and accepted pointer fire. T3 already supplies ten full desktop pointer victories; T4 did not misrepresent a separate partial desktop run as new encounter evidence.

## Boundary held

- Browser emulation proves responsive layout and pointer-event wiring, not physical-device comfort, browser chrome behavior, haptics, thermal performance, or safe-area behavior on actual hardware.
- TankaVOID is still Coming Soon and has no public Play route.
- No extra enemies, waves, boss, pickups, score, account, leaderboard, receipt, or platform integration was added.
- No Supabase, Stripe, AdSense, Netlify production, DNS, data, or deployment state changed.

## Next action

T5 expands the encounter into the narrow V1 content set: scout, bruiser, hunter, five escalating waves, and one final pressure event. Keep the current one-cannon directional-armor identity and reject prototype feature sprawl. Physical touch certification remains a T7 release gate and must be performed before the public card changes from Coming Soon to Play.
