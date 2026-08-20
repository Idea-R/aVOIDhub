# WORDaVOID WD0 baseline evidence

Date: 2026-08-20

Issue: [#12](https://github.com/Idea-R/aVOIDhub/issues/12)

Branch: `codex/fix-wordavoid-wd0-baseline`

Stack base: `codex/fix-wreckavoid-w5-hardening` at `c72e9f1`

Contract: [`wordavoid-v1-contract.md`](wordavoid-v1-contract.md)

## Outcome

WORDaVOID now has a source-enforced V1 boundary instead of eight equal-looking promises. Classic Survival and two-minute Time Attack are the only playable V1 modes. Six duplicate or partial experiments remain visible as an unranked Mode Lab without Start controls. The draft score/stat contract is pure and tested, the two known result lies are repaired, and the menu survives the target WD0 viewport matrix without horizontal overflow.

No Supabase branch, database row, secret, Stripe state, AdSense state, DNS record, Netlify environment, production deploy, or merge changed.

## Source archaeology

The inventory traced every `GameMode` from the menu into the Zustand store:

- `perfectRun` and `dailyChallenge` had no branch behavior and ran as Classic.
- `waveDefense` changed word-pool difficulty and wave labels but had no completed-mode contract.
- `skillTraining` always selected `doubleLetter`; no skill selection or training outcome existed.
- `digitAssault` and `geometricTyping` had separate mechanics but reused word-shaped aggregate statistics that are not comparable.
- Only `timeAttack` had a distinct, complete terminal rule: 120 seconds of active loop delta.

The direct-write legacy leaderboard API still exists and remains a WD2 deletion gate. WD0 did not reactivate it. The current platform adapter remains provisional and cannot honestly validate browser-authored aggregates.

## Implemented WD0 changes

### Versioned product boundary

- Added `src/contracts/v1.ts` as the typed inventory for all eight modes.
- Added draft ruleset and dictionary identifiers.
- Centralized the Time Attack duration at 120,000 ms.
- Rendered Start actions only for Classic and Time Attack.
- Listed the six deferred modes with concise reasons and no interactive launch path.
- Restart now preserves the selected mode instead of forcing Classic.

### Honest statistics

- Added first-class correct/attempted character counters.
- Accuracy is `round(correct / attempted × 100)` and can reach zero.
- Removed the artificial 60% floor.
- WPM uses five correct characters as one standardized word.
- Added `maxStreak`; a miss resets the active streak without deleting the run maximum.
- Result and persistent longest-streak comparisons use `maxStreak`.
- Local total characters now increments from correct character evidence.

### Testable score baseline

- Extracted the common-word formula into `calculateWordScore`.
- Bounded negative length, response time, streak, and level inputs.
- Locked the existing easy/medium/hard/extreme/boss multipliers in tests.
- Documented why `Math.random()` prompt selection and ambient `Date.now()` prevent ranked validation until WD1.

### Responsive and build hygiene

- Phone title size now fits 320–360 px widths.
- Difficulty selection becomes a compact responsive grid instead of clipping the right side.
- Mode control layout stacks on narrow screens.
- Card and page padding scale down on phones.
- Vite now empties its out-of-root target before every build.
- Disabled the unused public directory for the production game build and removed the broken Vite favicon reference. The 245,811-byte unreferenced screenshot remains preserved in source but is no longer shipped.

## Automated verification

`npm run verify:release --workspace=@avoid/word-avoid` passes:

- TypeScript: pass
- ESLint: pass, zero warnings
- Vitest: 2 files / 9 tests pass
- Vite production build: pass

The focused tests cover:

- two V1 modes and six deferred modes;
- unique inventory for all eight named modes;
- exact Time Attack duration;
- deterministic common-word score examples;
- accuracy at 0%, 33%, 100%, and malformed-counter bounds;
- standardized-character WPM;
- reset state;
- Classic versus Time Attack start state;
- wrong-key attempt evidence;
- maximum streak surviving a miss.

`npm run build:platform:netlify` passes after the game changes:

- VOIDaVOID built and staged;
- WreckaVOID built and staged;
- WORDaVOID built and staged;
- Next.js compiled and type-checked;
- 21 static pages generated and dynamic platform routes retained.

Known unrelated build warnings remain: VOIDaVOID ineffective dynamic imports and its 1.57 MB art asset. WORDaVOID still warns that its main chunk is 550.25 KB uncompressed; bundle reduction remains WD3 work.

## Artifact baseline

The clean production output contains six files totaling 1,141,192 bytes uncompressed:

| Artifact | Raw | Gzip | Load boundary |
| --- | ---: | ---: | --- |
| HTML | 0.79 KB | 0.44 KB | Initial |
| CSS | 28.22 KB | 5.76 KB | Initial |
| Main game JavaScript | 550.25 KB | 141.54 KB | Initial |
| Tone/audio chunk | 344.62 KB | 81.60 KB | First input/audio initialization |
| Supabase chunk | 216.32 KB | 56.94 KB | Authenticated platform-run path |
| tslib | 0.99 KB | 0.52 KB | Deferred dependency |

Before `emptyOutDir`, the output also contained three stale hashed main bundles and three stale stylesheets from prior builds. They would have been copied by `prepare-games.mjs` even though HTML did not reference them. The final build removes them.

## Browser evidence

The Vite runtime was checked in the in-app Chromium browser after the source changes.

| Viewport | Document size | Horizontal overflow | V1 Start actions | Deferred labels |
| --- | --- | --- | ---: | ---: |
| 1440 × 900 | 1425 × 986 | No | 2 | 6 |
| 360 × 640 | 345 × 2212 | No | 2 | 6 |
| 844 × 390 | 829 × 1688 | No | 2 | 6 |
| 320 × 568 | 305 × 2420 | No | 2 | 6 |

The first 360 px check caught a clipped title and a horizontally clipped difficulty selector. Both were corrected and rechecked visually.

Time Attack browser smoke confirmed:

- its runtime displays the mode and a 1:59 countdown after launch;
- Escape pauses the run;
- the button changes to Resume;
- the Time Left display remained at 1:50 across a 1.2-second paused wait;
- the runtime exposed no third V1 Start action.

The current pause overlay is not a semantic dialog, and the game still lacks a software-keyboard focus bridge. Those are documented WD3 failures rather than hidden mobile claims.

## Acceptance readout

- [x] Every advertised mode is mapped and classified.
- [x] Classic and Time Attack have explicit draft contracts.
- [x] Duplicate/partial modes cannot be launched as finished V1 modes from the menu.
- [x] Accuracy below 60% and maximum streak behavior are covered by tests.
- [x] Input and browser-support boundaries are explicit.
- [x] Standalone release verification passes.
- [x] Full hosted-game/platform assembly passes.
- [x] Target menu viewports have no horizontal overflow.
- [ ] Server-issued prompt sequence and recomputation exist. This is WD1.
- [ ] Mobile software keyboard is supported. It is explicitly unsupported until WD3.
- [ ] Production route/rollback smoke exists. This is WD4.

## Rollback

The source rollback target is the clean WreckaVOID W5 head `c72e9f1`. WD0 is a stacked branch and can be omitted without rewriting the completed WreckaVOID slices.

## Next smallest slice

WD1 can proceed locally with a deterministic dictionary/seed sequence and a pure server recomputation harness. Persisted tickets, RLS, and end-to-end platform acceptance remain gated on the approved isolated Supabase environment.
