# WORDaVOID WD3 play-experience hardening evidence

Date: 2026-08-20

Issue: [#16](https://github.com/Idea-R/aVOIDhub/issues/16)

Branch: `codex/fix-wordavoid-wd3-experience`

Base: `codex/fix-wordavoid-wd1-validation`

Status: source and local browser gates complete; production deploy and physical-device sign-off pending

## Outcome

WD3 turns WORDaVOID's fragile global-keyboard demo loop into an explicit, responsive play surface. The game now owns typing focus, pause reasons, arena dimensions, motion preference, local-progress migration, submission state, and repeat-run transitions. Guest play remains available when the platform or audio layer is unavailable.

This sprint does not activate the dormant Supabase foundation, promote score trust, deploy production, or claim physical mobile-device certification.

## Changes delivered

### Input and focus

- Added a focusable `Type here` surface that accepts physical-keyboard and software-keyboard input without storing typed text.
- Removed global printable-character capture. The only global game shortcut is Escape; printable input is accepted only by the owned typing surface.
- Rejects Ctrl/Command/Alt chords, repeats, composition events, dead keys, multi-character strings, pasted text, and characters outside the competitive ASCII-letter contract.
- Arena clicks return focus to the typing surface, while buttons and dialogs retain their own focus and do not leak characters into play.
- Added an accessible focus-trapped dialog owner for pause and results. Resume restores typing focus.
- Window blur and document visibility add a `focus` pause reason. Manual and focus pauses compose, so clearing one cannot accidentally resume the other.

### Responsive playfield

- The rendered arena owns game dimensions through `ResizeObserver`, window resize, and `visualViewport` resize.
- Spawn, movement, and targeting calculations use the owned viewport rather than ad hoc `window.innerWidth` and `window.innerHeight` reads.
- Existing prompts recenter when the arena changes size or orientation.
- The application uses dynamic viewport height and a safe-area-aware mobile typing bar.
- HUD, menu, settings, and result layouts now fit narrow portrait and short landscape viewports without document overflow.

### Motion, audio, and feedback

- System `prefers-reduced-motion` is always honored; the saved in-game setting can request additional reduction.
- Decorative loops and particles stop or simplify under reduced motion without changing rules, score, health, or timing.
- Particle and score-popup timers are bounded and cleaned up.
- Audio reports `idle`, `initializing`, `ready`, or `unavailable`; initialization uses saved volume values and failure degrades to silent play with a retry action.
- Removed duplicate blocking pause presentation and strengthened visible keyboard focus.

### Local history and failure states

- Replaced the unversioned progress blob with `wordavoid-progress-v1` and a bounded migration from the legacy `wordavoid-stats` key.
- Corrupt or out-of-range fields are sanitized and produce an honest recovery notice instead of crashing the menu.
- Replaced the “full stats coming soon” placeholder with a real local-history surface.
- Local saving and platform submission are independent. A local-storage error cannot suppress a platform finish, and submission states distinguish local-only, rejected, and unavailable outcomes.
- Abandoned runs are neither saved nor submitted.

### Repeat-run and sharing lifecycle

- Added a synchronous start guard and generation token so rapid Play Again actions cannot allow an older asynchronous start to replace a newer run.
- A stale finish cannot clear the active ID of a newer run.
- Removed stale delayed targeting work and cleaned transient timers.
- Results distinguish `GAME OVER` from `RUN ENDED`; abandoned zero-input runs no longer claim achievements.
- Share uses native Web Share when available, then a clipboard fallback, and reports cancellation/failure without losing the result.
- Added a real How to Play surface in place of a dead menu action.

## Automated verification

From `C:\dev\aVOID-word-wd3`:

```text
npm run verify:release --workspace=@avoid/word-avoid
  type-check: pass
  lint: pass with zero errors/warnings
  tests: 5 files, 33 tests passed
  production build: pass

npm run build:platform:netlify
  VOIDaVOID build: pass
  WreckaVOID build: pass
  WORDaVOID build: pass
  hosted-game preparation: pass
  Next.js production build: pass, 21 routes generated

git diff --check
  pass
```

Focused tests cover competitive input filtering, software-keyboard event parsing, pause-reason composition, viewport recentering, local-progress migration/corruption/round-trip, abandon-without-submit behavior, and stale finish/start races.

The production build still reports WORDaVOID's known greater-than-500-KB chunk warning. It is a WD4 bundle/balance release concern, not a runtime failure introduced by this sprint.

## Browser verification

Local production-representative Vite runtime: `http://127.0.0.1:5176/WORDaVOID/`.

| Check                   | Evidence                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop layout          | 1704 × 1054 rendered without horizontal overflow; menu, game, pause, and results rendered correctly                                                        |
| Physical-key input      | Typing surface auto-focused after launch; a competitive letter changed run accuracy; Ctrl+L did not enter gameplay                                         |
| Control isolation       | Pressing a letter while the Pause control had focus did not change accuracy or steal focus                                                                 |
| Pause dialog            | One semantic dialog, typing surface disabled, Resume initially focused, Escape restored the typing surface                                                 |
| Arena refocus           | Clicking the arena restored focus to the typing surface                                                                                                    |
| Narrow portrait         | Requested 320 × 700 device viewport; browser-reported 355 × 777; document matched viewport, controls and typing surface remained in bounds                 |
| Short landscape         | Requested 844 × 390; browser-reported 937 × 433; document matched viewport and no horizontal overflow occurred                                             |
| Live orientation change | Active run changed landscape to portrait; input focus survived and all four sampled prompts remained inside the measured arena                             |
| Reduced motion          | Preference persisted across reload; root state was reduced and no visible decorative-motion nodes remained                                                 |
| Repeat-run soak         | 20 end/restart cycles completed with one result dialog, zero stale typing surfaces after exit, one game keydown owner, and no duplicate restart transition |
| Console                 | No application warning or error from the local origin; two development-only React DevTools extension notices were external                                 |

The browser environment verified the mobile input surface and its input-event parser. No physical iOS or Android keyboard was available in this sprint, so production release still requires one real iOS and one real Android pass covering keyboard opening, visual-viewport resize, typing, pause, orientation, and result actions.

## Acceptance result

- **WD3 source gate:** pass.
- **WD3 automated gate:** pass.
- **WD3 local browser gate:** pass.
- **Physical mobile-device gate:** pending.
- **Production deploy/rollback gate:** pending and intentionally untouched.
- **Database/run-ticket execution:** remains part of WD1/WD2 and the approval-gated Supabase foundation exercise.

## Next dependencies

1. Exercise the platform foundation and WD1 transaction on an approved isolated Supabase branch.
2. Complete WD2 session, detail-page, board, personal-best, and canonical receipt integration.
3. Run WD4 balance, bundle, physical-device, production smoke, and rollback evidence.
