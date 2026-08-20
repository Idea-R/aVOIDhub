# WORDaVOID V1 mode and scoring contract

Date: 2026-08-20

Status: WD1 release-candidate contract; deterministic source path complete, database execution and production activation pending

Issues: [#12](https://github.com/Idea-R/aVOIDhub/issues/12), [#14](https://github.com/Idea-R/aVOIDhub/issues/14)

Ruleset identifier: `wordavoid-v1.0.0-rc.1`

Dictionary identifier: `wordavoid-dictionary-2026-08-20`

Dictionary SHA-256: `c479fbf36f13b30f471161b749055f257a486fc7c5706693d65f1a13a3350579`

Detailed validation contract: [`wordavoid-validation-contract.md`](wordavoid-validation-contract.md)

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
- Signed-in play now requests a server-generated run ID, seed, dictionary version/hash, normalization version, and ruleset version. Guest play uses the same contract with a local-only manifest and cannot place.

### Active play

- One active printable key is one character attempt.
- A character is correct only when it matches the next character of the selected active word under the V1 normalization rule.
- V1 input is Unicode-NFKC-normalized, lowercased, and accepted only when it is exactly one ASCII letter. Punctuation, numbers, spaces, emoji, multi-character strings, and IME/composition output are not competitive V1 evidence.
- A correct character advances the selected word.
- A wrong character resets progress on the selected word and ends its active targeting state.
- A completed word disappears, awards score, increments the completed-word count, increments the active streak, and updates the maximum streak.
- A missed word damages the player, removes the word, and resets only the active streak. The maximum streak survives.
- Pause time does not reduce the Time Attack clock or count toward response time, WPM, session time, or active duration. WD1 tests and browser smoke cover ordinary pauses; WD3 still owns long-background/tab-throttling and repeat-run hardening.

### End

- Classic ends when health reaches zero.
- Time Attack ends when active time reaches 120,000 ms or health reaches zero, whichever occurs first.
- A result includes mode, ruleset, dictionary, score, active duration, completed words, missed words, correct characters, attempted characters, maximum streak, WPM, and accuracy.
- Guest results may be stored locally but are not a platform placement.
- The WD1 server route recomputes signed-in evidence, but the prepared persistence transaction deliberately retains the `provisional` trust label until the isolated database matrix and promotion policy pass.
- Restart repeats the same selected mode. WD0 repairs the old behavior that always restarted Classic.

## Versioned scoring contract

The shared contract package owns the common-word score so the game and server execute the same versioned function.

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

The formula is implemented in `@avoid/wordavoid-contract`; the game compatibility module re-exports it. Competitive words, angles, level, and difficulty now come from the deterministic manifest. Event timing remains browser-observed evidence and is bounded/replayed, not proof of human input.

### Damage and difficulty baseline

The current common-word miss damage is 10/15/20/25/30 for easy/medium/hard/extreme/boss words. Word difficulty changes with level: easy through level 10, medium after 10, hard after 20, extreme after 30, and boss after 40. Spawn rate and speed also change from the higher of level-derived and WPM-derived difficulty tiers.

Adaptive WPM may affect client presentation/movement, but it does not choose prompt difficulty or scoring difficulty. The validator derives prompt level/difficulty from sequence and derives WPM from accepted characters/time. The client cannot submit either tier as fact.

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

## WD1 deterministic evidence

A signed-in start response binds:

- authenticated user when present;
- one-use run ID and secret ticket;
- `wordavoid-v1-*` ruleset version;
- dictionary version and content hash;
- mode;
- deterministic seed or explicit word sequence;
- server start time and allowed duration/expiry;
- normalization version;
- a server-side expiry envelope. Client build version remains a WD2/observability addition.

A finish request must provide ordered evidence sufficient to derive, not trust:

- prompt/word identity;
- spawn or availability sequence number;
- normalized character outcomes;
- monotonic event timing relative to the run;
- completion and miss events;
- pause/resume intervals if pauses are allowed competitively;
- terminal reason.

The server recomputes score, correct/attempted characters, completed/missed words, active duration, WPM, accuracy, maximum streak, level, difficulty, health, and terminal reason. It rejects unknown prompts, inconsistent ordering/timing, changed contracts, wrong users, bad tickets, expired tickets, and invalid terminal states. The prepared service-only transaction row-locks first finish and returns the same linked receipt for a later valid-ticket retry. Executable concurrency/read-back evidence remains gated on the isolated Supabase branch.

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

## WD0/WD1 acceptance evidence

- The source exposes one typed catalog for all eight named modes.
- Only Classic and Time Attack render Start actions in the V1 menu.
- The six deferred modes are visible as unranked experiments without interactive launch controls.
- The Time Attack duration is a shared constant with tests.
- The common-word score function is pure and tested.
- Accuracy can be 0%; the 60% floor is gone.
- Correct-character WPM is pure and tested.
- Maximum streak survives a miss and is used by results/persistent stats.
- Restart preserves the selected mode.
- The generated dictionary, deterministic prompt stream, evidence schema, normalization, and validator are shared by game and platform.
- Server recomputation and client tamper rejection are covered by focused tests.
- The prepared persistence transaction is single-write and idempotent by receipt in source.
- Type-check, lint, tests, build, browser matrix, bundle baseline, and full platform assembly are required before WD0 closes.

WD1 evidence is in [`sprint-wordavoid-wd1.md`](sprint-wordavoid-wd1.md). Its source gate is complete; PostgreSQL execution and production activation are not.

## Explicitly deferred

- Executable SQL concurrency, expiry, wrong-user, and retry read-back on the isolated Supabase branch.
- Trust promotion beyond `provisional`; server recomputation alone does not establish human or bot-free play.
- Platform session, personal best, boards, receipts, and canonical share: WD2.
- Focusable typing bridge, software-keyboard decision, resize normalization, reduced motion, audio, share fallback, and repeat-run hardening: WD3.
- Balance and production release/rollback: WD4.
