# WORDaVOID V1 mode and scoring contract

Date: 2026-08-20

Status: WD0 draft contract; source-enforced mode boundary, not yet a server-validated ruleset

Issue: [#12](https://github.com/Idea-R/aVOIDhub/issues/12)

Ruleset identifier: `wordavoid-v1-draft.1`

Dictionary identifier: `wordavoid-dictionary-2026-08-20`

## Product decision

WORDaVOID V1 has two modes:

1. **Classic Survival** — an unbounded health-based run.
2. **Time Attack** — the same core word-defense rules with a 120,000 ms active-time ceiling.

The other six menu entries are experiments, not finished modes. WD0 removes their Start controls from the V1 menu and lists them in an unranked Mode Lab. Their source stays intact for later evaluation; no player is told that duplicate or partial behavior is a finished competitive mode.

This is intentionally narrow. A validated leaderboard needs a small number of explicit rules that a server can reproduce. Eight visually different buttons are not eight trustworthy games.

## Mode inventory

| Mode | Current implementation | V1 decision | Why |
| --- | --- | --- | --- |
| Classic Survival | Full common word loop; health ends the run | Include | Clear loop and terminal condition |
| Time Attack | Common word loop plus a 120-second timer | Include | Clear duration and comparable session shape |
| Perfect Run | Falls through to Classic | Defer as duplicate | A mistake does not end the run |
| Daily Challenge | Falls through to Classic | Defer as duplicate | No date, seed, sequence, or daily rules exist |
| Wave Defense | Wave-based word-pool changes | Defer as partial | No versioned wave completion, balance, or score contract |
| Skill Training | Uses only the hard-coded `doubleLetter` list | Defer as partial | No selectable skill or training-session outcome |
| Digit Assault | Bespoke characters/numbers/symbols | Defer as partial | Its unit of play and score are not comparable with words |
| Geometric Typing | Bespoke keyboard patterns | Defer as partial | Pattern evidence, timing, and score are not versioned |

Deferred modes must not appear on a competitive board, use the V1 ruleset identifier, or submit a platform result. Restoring a Start action requires a separate written ruleset and acceptance pass.

## Shared V1 run contract

### Start

- Guest play remains available.
- A run starts from an explicit player action after choosing Classic or Time Attack.
- The run begins with 100 health, zero score, zero completed words, zero attempted characters, zero correct characters, zero active streak, and zero maximum streak.
- Classic has no duration ceiling.
- Time Attack starts with exactly `120000` ms remaining.
- WD1 must replace local randomness with a server-issued run ID, seed, dictionary version, and ruleset version for ranked play.

### Active play

- One active printable key is one character attempt.
- A character is correct only when it matches the next character of the selected active word under the V1 normalization rule.
- The current source compares letters case-insensitively. WD1 must freeze punctuation, number, capitalization, Unicode normalization, and IME rules before ranking.
- A correct character advances the selected word.
- A wrong character resets progress on the selected word and ends its active targeting state.
- A completed word disappears, awards score, increments the completed-word count, increments the active streak, and updates the maximum streak.
- A missed word damages the player, removes the word, and resets only the active streak. The maximum streak survives.
- Pause time must not reduce the Time Attack clock or count toward active duration. The current loop stops its delta updates while paused; WD3 must browser-test long pauses and tab throttling.

### End

- Classic ends when health reaches zero.
- Time Attack ends when active time reaches 120,000 ms or health reaches zero, whichever occurs first.
- A result includes mode, ruleset, dictionary, score, active duration, completed words, missed words, correct characters, attempted characters, maximum streak, WPM, and accuracy.
- Guest results may be stored locally but are not a platform placement.
- A signed-in result remains provisional until WD1 server recomputation accepts its evidence.
- Restart repeats the same selected mode. WD0 repairs the old behavior that always restarted Classic.

## Draft scoring contract

The WD0 implementation extracts the existing common-word score into a pure function so its behavior can be tested before WD1 replaces ambient time and randomness.

For a completed word:

```text
base            = word length × 10
time bonus      = max(0, 100 - response milliseconds ÷ 100)
streak bonus    = active streak before completion × 5
level bonus     = max(1, current level) × 10
subtotal        = base + time bonus + streak bonus + level bonus
word score      = round(subtotal × word-difficulty multiplier)
```

Word-difficulty multipliers:

| Difficulty | Multiplier |
| --- | ---: |
| Easy | 1.0 |
| Medium | 1.5 |
| Hard | 2.0 |
| Extreme | 3.0 |
| Boss | 5.0 |

The draft formula is now centralized in `src/contracts/v1.ts` and covered by unit tests. It is not yet ranked because the client still chooses words, angles, and timing with `Math.random()` and `Date.now()`.

### Damage and difficulty baseline

The current common-word miss damage is 10/15/20/25/30 for easy/medium/hard/extreme/boss words. Word difficulty changes with level: easy through level 10, medium after 10, hard after 20, extreme after 30, and boss after 40. Spawn rate and speed also change from the higher of level-derived and WPM-derived difficulty tiers.

WD1 must decide whether adaptive WPM can affect a competitive run. If it remains, the server must derive it from accepted evidence at the same event boundary. The client may not submit a difficulty tier as fact.

## Statistics contract

### Accuracy

```text
accuracy = round(correct characters ÷ attempted characters × 100)
```

- A run with no attempts displays 100% as a neutral starting value.
- Correct characters are bounded to the attempted-character count.
- Bad play can honestly produce 0–59% accuracy.
- WD0 removes the previous artificial 60% floor.

### WPM

```text
standard words = correct characters ÷ 5
WPM            = round(standard words ÷ active minutes)
```

This replaces the old “completed words per minute” metric, which treated a two-letter and a fourteen-letter word as equivalent. Active duration needs pause-aware ownership before server validation.

### Streak

- `streak` is consecutive completed words since the last miss.
- `maxStreak` is the largest streak reached during the run.
- The result surface displays `maxStreak`.
- Persistent `longestStreak` compares against `maxStreak`, not the terminal current streak.

### Persistent local statistics

WD0 keeps the existing local-only totals. They are convenience history, not a ranked record. The persisted object is currently unversioned and needs a migration envelope in WD3. Platform personal bests and receipts belong to WD2 after the shared data foundation is exercised.

## Ranked evidence required by WD1

A ranked start response must bind:

- authenticated user when present;
- one-use run ID and secret ticket;
- `wordavoid-v1-*` ruleset version;
- dictionary version and content hash;
- mode;
- deterministic seed or explicit word sequence;
- server start time and allowed duration/expiry;
- normalization version;
- client build version.

A finish request must provide ordered evidence sufficient to derive, not trust:

- prompt/word identity;
- spawn or availability sequence number;
- normalized character outcomes;
- monotonic event timing relative to the run;
- completion and miss events;
- pause/resume intervals if pauses are allowed competitively;
- terminal reason.

The server must recompute score, correct/attempted characters, completed/missed words, active duration, WPM, accuracy, maximum streak, level, and difficulty. It must reject unknown prompts, impossible ordering/timing, changed rulesets, expired tickets, wrong users, and replayed finishes. A retry with the same idempotency key must return the same receipt.

## Input and browser baseline

| Surface | WD0 observed contract | V1 position |
| --- | --- | --- |
| Desktop physical keyboard | Global `keydown` captures printable keys during play | Supported, but focus/shortcut exclusions remain WD3 |
| Escape pause/resume | Global `keydown` toggles pause | Supported baseline; modal semantics remain WD3 |
| Pointer | Starts modes and operates menus | Supported |
| Mobile software keyboard | No focusable input bridge exists | Not supported in WD0; do not claim mobile typing support |
| Resize/orientation | Runtime reads `window.innerWidth/innerHeight` without owning resize | Baseline defect; WD3 |
| IME/composition | No composition handling | Not supported for ranked V1 until specified |
| Backspace/correction | No explicit correction model | Not part of the WD0 competitive contract |
| Reduced motion | Setting exists but does not govern all infinite motion or system preference | Baseline defect; WD3 |
| Audio | Deferred Tone load exists; effective gain/music claims require verification | Baseline defect; WD3 |
| Share | Native Web Share only, current page URL, no copy fallback or receipt | Local convenience only; WD2/WD3 |

Mobile visitors should still receive a readable menu and honest “physical keyboard required” message until a real software-keyboard bridge passes viewport and composition tests.

## WD0 acceptance evidence

- The source exposes one typed catalog for all eight named modes.
- Only Classic and Time Attack render Start actions in the V1 menu.
- The six deferred modes are visible as unranked experiments without interactive launch controls.
- The Time Attack duration is a shared constant with tests.
- The common-word score function is pure and tested.
- Accuracy can be 0%; the 60% floor is gone.
- Correct-character WPM is pure and tested.
- Maximum streak survives a miss and is used by results/persistent stats.
- Restart preserves the selected mode.
- Type-check, lint, tests, build, browser matrix, bundle baseline, and full platform assembly are required before WD0 closes.

## Explicitly deferred

- Server-issued seeds and deterministic prompt ordering: WD1.
- Server recomputation, tamper rejection, idempotency, and trust promotion: WD1.
- Platform session, personal best, boards, receipts, and canonical share: WD2.
- Focusable typing bridge, software-keyboard decision, resize normalization, reduced motion, audio, share fallback, and repeat-run hardening: WD3.
- Balance and production release/rollback: WD4.
