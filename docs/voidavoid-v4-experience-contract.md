# VOIDaVOID V4 experience and hardening contract

Updated: 2026-08-20
Status: local source/browser gate complete; physical-device and deployed-route certification pending

## Player promise

VOIDaVOID remains an immediate guest game. Entering the field is the only action required to start. Sound, reduced motion, pause, controls, result copy, replay, and return-to-menu behavior are available without an account or network request.

V4 changes presentation and resource ownership only. It does not change the `voidavoid-v2` fixed-step simulation, named gameplay random streams, scoring formulas, or evidence vocabulary.

## Audio contract

- Sound is generated locally with the Web Audio API. No MP3, WAV, music CDN, or third-party audio request is part of the active graph.
- The first `AudioContext` is created and resumed only after Enter the field, Retry sound, or an explicit Sound on action.
- The preference is versioned and stored locally. Muting suspends the context and stops active voices; unmuting resumes the same context when possible.
- A blocked or unsupported context becomes `unavailable`. Play continues, the UI says what happened, and a player gesture can retry.
- Start, impact, charge, pause, and game-over cues are deliberately short. Impact sounds are rate-limited.
- Every oscillator is tracked until `ended`; page teardown stops voices and closes the context. Back-forward-cache page hides do not destroy state that the browser intends to restore.
- Sound has no simulation callback and cannot consume gameplay RNG or change score evidence.

## Motion and visual-effects contract

- The operating-system `prefers-reduced-motion` request is always honored.
- A persisted Reduced choice can opt into the same treatment even when the system preference is not reduced.
- Reduced motion clears decorative particles, prevents screen shake, removes canvas particle bursts, disables shadows/trails, and uses compact power-up/chain presentation.
- Reduced motion does not change meteor physics, spawn streams, collisions, power-up availability, chain completion, scoring, or evidence.
- The central particle owner rejects additions beyond its current ceiling. Full presentation is capped at 300, performance fallback at 150, and reduced motion at 48.

## Accessibility and focus contract

- The canvas has a concise accessible name and offscreen control instructions. It accepts focus so dialog dismissal can return to a predictable place.
- Score updates are not an `aria-live` stream. Results and explicit copy/failure messages are announced at meaningful transitions instead of every 200 milliseconds.
- Pause, controls, and result surfaces have one semantic `dialog` owner with a heading, description, initial focus, and a Tab/Shift+Tab boundary.
- Closing controls or resuming returns focus to the field. Result focus begins on Play again.
- Every visible button has a name, toggles expose state, and menu/dialog surfaces retain the system cursor and visible focus ring.
- Escape closes Controls or toggles manual pause without clearing focus/visibility pause reasons.

## Performance and transfer contract

- The FPS sampler treats the first frame as a baseline. It no longer interprets a large page-lifetime timestamp as a zero-FPS sample and immediately degrades every run.
- Frame times use consecutive animation timestamps; the 500 ms FPS window is independent.
- The release check fails above 140 KiB compressed initial transfer, above 320 KiB for the largest JavaScript file, or when a downloaded audio file is emitted.
- Runtime diagnostics expose one loop, pointer-listener count, terminal frame state, presentation mode, particle ceiling, FPS sample, object estimate, audio context count, and active voices.

## Supported local browser matrix

The local V4 browser gate covers 390×844 portrait phone, 844×390 short landscape, 768×1024 tablet, 1440×900 desktop, and 1920×1080 wide desktop. These checks prove responsive layout and browser-emulated pointer behavior. They do not certify physical iOS/Android touch latency, browser chrome, safe-area hardware, thermal behavior, or long-session battery impact.

## Deferred release gates

- Physical iOS and Android pointer/double-tap/orientation sign-off.
- A deployed `/voidavoid/` smoke test plus production rollback evidence.
- A formal deployed accessibility/performance audit. The heavyweight Chrome DevTools audit server was intentionally not enabled for this local slice; repeatable source budgets, browser semantics, runtime FPS, and heap samples are recorded instead.
- V3 platform tickets, receipts, personal bests, boards, and any ranked trust label.
- DPR 2 rendering until every canvas system shares one logical-pixel contract.
