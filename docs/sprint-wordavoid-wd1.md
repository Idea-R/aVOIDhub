# WORDaVOID WD1 deterministic validation evidence

Date: 2026-08-20

Issue: [#14](https://github.com/Idea-R/aVOIDhub/issues/14)

Draft PR: pending publication

Branch: `codex/fix-wordavoid-wd1-validation`

Stack base: `codex/fix-wordavoid-wd0-baseline` at `5e53813`

Contract: [`wordavoid-validation-contract.md`](wordavoid-validation-contract.md)

## Outcome

The WD1 source gate is complete. WORDaVOID V1 now starts from a versioned deterministic manifest, emits replayable prompt/input/pause/terminal evidence, and uses one shared package for both client presentation and server recomputation. The finish route ignores browser-authored aggregates and passes only its recomputed result into the service-only persistence transaction. Legitimate ticket retries return the original receipt in the prepared migration.

Production remains unchanged. The database migration has not been run against Supabase, the new environment is not configured, no trust label was promoted, and no merge or deploy occurred. Runtime database acceptance remains a named gate rather than an implied result.

## Implemented source

### Shared contract package

- Added `@avoid/wordavoid-contract` as a workspace dependency of the game and platform.
- Generated a frozen 1,770-entry, five-tier dictionary with a committed SHA-256 check.
- Added deterministic random-access prompt generation from seed and sequence.
- Froze ruleset `wordavoid-v1.0.0-rc.1` and `ascii-lower-v1` normalization.
- Centralized score, miss damage, accuracy, WPM, level, difficulty, and duration rules.
- Added a bounded pure validator with stable rejection codes.

### Platform routes

- Run start rejects non-V1 WORDaVOID modes.
- The server generates the seed, stores validation metadata, and returns the bound manifest.
- WORDaVOID finish reconstructs that manifest from the persisted run rather than trusting the request.
- Score and metrics sent to `finish_provisional_run` are the validator's output.
- Responses report `server_recomputed` capability without falsely changing the database trust label.
- The service-only transaction returns the existing linked receipt for a valid retry and remains single-write under a row lock.

### Game runtime

- Guest/local play receives a local manifest without fake Supabase traffic.
- Classic and Time Attack prompts, levels, difficulties, and angles come from the manifest.
- The store emits spawn, attempt, miss, pause, resume, and terminal evidence.
- Non-ASCII-letter keys are ignored in competitive modes.
- Score response time, WPM, persistent playtime, visible clocks, and Time Attack all exclude pauses.
- Resuming resets the animation-frame timestamp, preventing a paused interval from becoming one large catch-up delta.
- Quit remains local and does not masquerade as a competitive terminal.
- A client-side validation pass prevents a known-invalid stream from being sent; server validation remains authoritative.
- A finish request makes one same-ticket/evidence retry after a network or server failure so a lost first response can recover the original receipt.

## Automated evidence

`npm run verify --workspace=@avoid/wordavoid-contract` passes:

- generated dictionary check: 1,770 entries;
- dictionary SHA-256: `c479fbf36f13b30f471161b749055f257a486fc7c5706693d65f1a13a3350579`;
- TypeScript: pass;
- Vitest: 1 file / 12 tests pass.

`npm run verify:release --workspace=@avoid/word-avoid` passes:

- TypeScript: pass;
- ESLint: pass, zero warnings;
- Vitest: 3 files / 15 tests pass;
- Vite production build: pass.

`npm run typecheck --workspace=@avoid/platform` and `npm run test --workspace=@avoid/platform` pass with 2 focused server-contract tests.

`npm run test:foundation` passes the migration static verifier and confirms the 50-assertion pgTAP packet is still structurally present.

`npm run build:platform:netlify` passes:

- VOIDaVOID, WreckaVOID, and WORDaVOID build and stage;
- Next.js compiles and type-checks;
- 21 static pages generate;
- `/api/v1/runs` and `/api/v1/runs/[runId]/finish` remain dynamic server routes.

Known unrelated build warnings remain: VOIDaVOID's ineffective dynamic imports and large art asset, plus WORDaVOID's existing large main chunk. WD1 did not broaden into bundle redesign.

## Browser evidence

Chrome was used because the in-app preview browser could not reach the local Windows server. No page console warning or error appeared.

| Requested viewport | Rendered content viewport | Document width | Horizontal overflow | Result |
| --- | --- | ---: | --- | --- |
| 320 × 700 | 291 × 636 | 277 px | No | Menu and Classic controls remain reachable |
| 1440 × 900 | 1309 × 818 | 1295 px | No | Desktop menu remains contained |

Classic smoke verified:

- the runtime entered play with the correct mode;
- deterministic V1 prompts appeared;
- prompt positions remained byte-for-byte stable during an 800 ms paused sample;
- the visible session clock remained `00:14` across a separate 2.2-second paused wait;
- Resume did not apply the paused interval as a catch-up frame;
- no configured-service error was logged.

Time Attack smoke verified:

- the second V1 Start action entered `time Attack`;
- the 120-second countdown was active (`01:56` after navigation/tool delay);
- the game exposed Pause and End controls;
- no third competitive mode appeared.

## Tamper and trust evidence

Tests reject altered run identity, ruleset, dictionary version/hash, prompt ID, sequence, timestamps, pause state, input, terminal state, and client summary. Store coverage demonstrates that editing client health does not make a valid health terminal: the validator begins from 100 and derives damage from accepted misses.

The server does not yet call a database function that writes `validated`. A recomputed result continues through the existing provisional persistence function, so the source does not overstate the production trust tier.

## Acceptance readout

- [x] Competitive prompts are deterministic from a versioned server-generated seed.
- [x] Dictionary content and normalization are frozen and hash-bound.
- [x] The game emits the ordered evidence needed for recomputation.
- [x] The server derives every accepted aggregate and rejects forged summaries.
- [x] The prepared transaction is one-write and returns the same receipt on valid retries.
- [x] Guest/unconfigured play remains available without fake service requests.
- [x] Type-check, lint, focused tests, production game build, full platform assembly, and browser smoke pass.
- [ ] SQL, concurrency, expiry, wrong-user, and retry read-back pass on the isolated Supabase branch.
- [ ] Production auth/environment and platform placements are active. This is WD2/release work.
- [ ] A bot-resistant or `verified` trust policy exists. It is deliberately not claimed.

## Rollback

The source rollback target is the clean WD0 head `5e53813dc4191ab96df6abef6bf632f6bee42ef8`. WD1 is stacked and can be omitted without rewriting WD0 or the completed WreckaVOID slices.

## Next smallest slice

The safest independent follow-up is WD3 input/focus/reduced-motion/repeat-run hardening. WD2 and the executable half of WD1 should proceed after approval of the short-lived Supabase branch, using the exact database matrix in this contract and `docs/sprint-1-foundation-test-plan.md`.
