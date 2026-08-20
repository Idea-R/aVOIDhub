# WreckaVOID W2 responsive-play evidence

- **Date:** 2026-08-20
- **Branch:** `codex/fix-wreckavoid-w2-responsive`
- **Base:** `codex/fix-wreckavoid-v1-baseline`
- **Issue:** `https://github.com/Idea-R/aVOIDhub/issues/8`
- **Status:** local W2 exit gates complete; production and cross-engine release gates remain later work

## Outcome

W2 turns the W0/W1-stabilized runtime into a deliberate responsive game surface. It owns the canvas from rendered layout, keeps pause reasons independent, gives touch players direct controls, introduces concise in-run coaching, adds a small functioning audio layer, honors reduced-motion preference for decorative particles, and makes the result surface readable on a 360 px phone.

This sprint does not activate platform auth, accepted score writes, production Supabase changes, Stripe, AdSense, Netlify deployment, or DNS.

## Implemented behavior

### Rendered viewport ownership

- Replaced `window.innerHeight - 40` bitmap math with a `ResizeObserver` on the rendered canvas.
- The root uses dynamic viewport height, a flex-owned HUD/canvas split, and bottom safe-area padding.
- Visual viewport resize/scroll and orientation changes resynchronize the canvas bitmap.
- Existing pointer coordinates are clamped after resize; untouched input recenters in the new playfield.
- A named unsupported-view status replaces crushed gameplay below a 320 × 320 playfield.

### Pause and focus safety

- Added `PauseController` with independent `manual`, `help`, and `focus` reasons.
- Closing help cannot clear manual pause or focus-loss pause.
- Focus return clears only the focus reason and preserves explicit manual pause.
- Restart clears every reason for a fresh run.
- Duplicate blur/visibility timers are canceled before replacement.

### Player guidance and feedback

- Added a six-second, pointer-neutral coaching strip: Drag to steer, Hold to pull in, Swing to strike.
- Added a real audio toggle with a persisted local preference and low-volume procedural impact, damage, power-up, pause, and game-over cues.
- Audio context creation/resume remains user-gesture driven and the runtime releases it on unmount.
- Reduced-motion preference suppresses decorative particles and electric sparks without changing scoring or core physics.
- The phone result overlay now fits Score, Share, Play Again, and Sign In actions inside 360 × 640 without document overflow.

## Automated evidence

| Gate                  | Result                                           |
| --------------------- | ------------------------------------------------ |
| Standalone TypeScript | Pass                                             |
| ESLint                | Pass, zero warnings                              |
| Vitest                | Pass, 6 files / 19 tests                         |
| Vite production build | Pass                                             |
| Full Netlify pipeline | Pass: 3 games staged + normal Next runtime build |

New W2 tests prove pause-reason composition/reset and pointer clamping after viewport changes. The W0/W1 fixed-step, collision, terminal, and input-mapping tests remain green.

## Browser matrix

| Surface               | Evidence                                                                  | Result |
| --------------------- | ------------------------------------------------------------------------- | ------ |
| 1440 × 900 desktop    | Canvas 1440 × 860, no overflow, audio control visible                     | Pass   |
| 360 × 640 portrait    | Canvas 360 × 600, centered input, compact HUD, coaching, no overflow      | Pass   |
| 844 × 390 landscape   | Live resize to canvas 844 × 350, touch controls retained, no overflow     | Pass   |
| 300 × 300 unsupported | Named 320 × 320 playfield guard with readable rotate/resize instruction   | Pass   |
| 360 × 640 result      | Score, share, Play Again, and Sign In visible; document remains 360 × 640 | Pass   |

The development smoke integration proved:

```text
manual + help → closing help leaves manual pause
focus + help  → closing help leaves focus pause
focus return  → clears focus only and resumes when it is the last reason
```

Audio toggle browser evidence proved enabled → muted → reload persisted muted → enabled, with matching `aria-pressed` state and no new runtime error.

After the W2 changes, another 20 deterministic terminal/restart cycles ended at:

```text
RAF 1 · input 1 · timers 0 · finishes 21 · restarts 21 · pauses none
```

## Exit status

W2 is complete as a local source gate. Production acceptance still requires the program’s broader Chrome/Edge, Firefox, Android Chrome, and iOS Safari device policy, real safe-area hardware, deployed focus/visibility behavior, and a subjective audio mix pass on speakers and headphones.

## Next dependency

W3 removes WreckaVOID’s private email/password/Google/profile path and proves guest plus signed-in one-use run behavior. That work depends on the coordinated platform foundation and isolated Supabase test environment. Do not reconnect the old direct score/auth model as a shortcut.
