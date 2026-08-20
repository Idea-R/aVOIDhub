# Sprint evidence — VOIDaVOID V4 experience hardening

Date: 2026-08-20
Branch: `codex/fix-voidavoid-v4-hardening`
Issue: [#22](https://github.com/Idea-R/aVOIDhub/issues/22)
Draft PR: pending
Base: VOIDaVOID V2 commit `03b05a2`

## Intended outcome

Finish the safe local portion of VOIDaVOID V4: reliable local sound, system-aware reduced motion, accessible blocking surfaces, bounded presentation work, responsive controls, and enforceable transfer limits. Preserve the V2 game/evidence contract and keep server, deployment, and physical-device claims out of this branch.

## Delivered

- Added a five-cue procedural Web Audio palette with gesture-only activation, persistent mute, suspend/resume, retryable failure, tracked voices, and page teardown.
- Kept dormant CDN/blob audio code outside the canonical graph and made the build fail if downloaded audio ships.
- Added versioned sound and motion preferences; the OS reduced-motion request always wins.
- Made reduced motion suppress particles, screen shake, shadows, trails, and intensive chain/defense effects without touching game streams or score evidence.
- Enforced the particle ceiling at the central insertion point.
- Replaced noisy live score announcements with semantic game status, focusable canvas instructions, named toggles, and one-owner pause/help/result dialogs.
- Added initial focus, Tab/Shift+Tab containment, and focus return to the canvas.
- Fixed the first-frame FPS baseline bug and added a regression test for healthy 60 Hz and genuinely slow windows.
- Added an explicit release budget and development diagnostics for audio, presentation, performance, and lifecycle ownership.

## Automated evidence

Command: `npm run verify:release --workspace=@avoid/void-main`

- TypeScript: pass
- Active graph: 63 files, 0 lint errors, 0 warnings
- Vitest: 10 files, 30 tests pass
- Vite production build: pass
- Budget: 83,328 bytes initial compressed transfer against 143,360 bytes
- Largest JavaScript: 273,789 bytes against 327,680 bytes
- Downloaded audio files: 0

Command: `npm run build:platform`

- Next.js 16.3.1 production build: pass
- 21 application routes classified/generated

## Browser evidence

| Check | Result |
| --- | --- |
| Desktop | 1440×900, 1440×900 canvas, no horizontal overflow |
| Portrait phone | 390×844; start card and four HUD actions remain inside the viewport |
| Short landscape | 844×390; start card, preferences, HUD, and canvas stay inside 844×390 |
| Tablet | 768×1024; full canvas and HUD fit with no horizontal overflow |
| Wide desktop | 1920×1080; full canvas and HUD fit with no horizontal overflow |
| Dialog semantics | Help/result dialogs have unique labelled/described IDs, no unnamed visible buttons, focus begins inside the dialog, and last-to-first Tab wrap passes |
| Focus return | Closing Help returns focus to the canvas |
| Reduced motion | Effective state reaches the canvas runtime; particle ceiling becomes 48 and active decorative particles clear |
| Audio | Start gesture creates one running context; mute suspends it; unmute resumes the same context; final active voices are zero |
| Frame sample | Five consecutive desktop samples reported 60 FPS and 16.67 ms average frame time with the full 300-particle ceiling |
| Replay/resource soak | 20 starts, 20 finishes, 19 resets, 20 unique replayable-local codes, five pointer listeners, no terminal frame, one audio context, zero final voices; maximum observed terminal particle count 60 of 300 |
| Heap sample | Raw JS heap moved from 10,435,800 to 9,864,360 bytes after a separate 20-cycle sample, a decrease of 571,440 bytes |
| Console | No warnings or errors across the browser matrix and repeat-run passes |

The heap comparison is a browser sample, not a universal memory guarantee. Physical devices and a deployed long-session trace remain release gates.

## Trust and release boundary

V4 does not make a score more trustworthy. Audio, motion, and performance settings do not enter named gameplay RNG streams, and every result remains `replayable-local` and unranked. Server-issued tickets, bounded input evidence, accepted receipts, personal bests, and boards remain V3.

No database, Supabase branch, Netlify configuration, Stripe resource, AdSense setting, DNS record, merge, production deployment, or live game changed.
