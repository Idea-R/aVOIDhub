# WORDaVOID deterministic validation contract

Date: 2026-08-20

Status: WD1 release candidate implemented in source; isolated database execution and production activation remain gated

Issue: [#14](https://github.com/Idea-R/aVOIDhub/issues/14)

Ruleset: `wordavoid-v1.0.0-rc.1`

Dictionary: `wordavoid-dictionary-2026-08-20`

Dictionary SHA-256: `c479fbf36f13b30f471161b749055f257a486fc7c5706693d65f1a13a3350579`

Normalization: `ascii-lower-v1`

## Purpose

WD1 replaces WORDaVOID's browser-authored score with evidence that the platform can recompute. The client still renders and simulates the game, but it does not get to choose the ranked prompt stream, user identity, ruleset, dictionary, score, accuracy, WPM, streak, duration, level, health, or terminal reason as authoritative facts.

The implementation is shared by the Vite game and the Next.js finish route through `@avoid/wordavoid-contract`. A rules change must change the package contract and version; copying a formula into a second application is not an acceptable release path.

This is a validation boundary, not proof that a human played. A syntactically valid evidence stream can still be automated by a hostile client. WD1 therefore exposes `validationCapability: server_recomputed` while the pending database foundation continues to store the result as `provisional`. Bot detection, rate limits, authoritative simulation, and any promotion to `validated` or `verified` require later review and tested policy.

## Frozen V1 content

The competitive dictionary is generated from the five existing common-word arrays in `games/word-avoid/src/data/words.ts`.

| Difficulty | Entries | Levels |
| --- | ---: | --- |
| Easy | 418 | 1–10 |
| Medium | 555 | 11–20 |
| Hard | 501 | 21–30 |
| Extreme | 269 | 31–40 |
| Boss | 27 | 41+ |
| **Total** | **1,770** | |

`packages/wordavoid-contract/tools/generate-dictionary.mjs` sorts and serializes that content into `dictionary.generated.ts`. Release verification fails if the source arrays and committed artifact differ. The version and SHA-256 travel in both the run manifest and submitted evidence; a content change without a new version/hash is rejected.

## Run start

Only `classic` and `timeAttack` are V1 modes.

A signed-in client requests `POST /api/v1/runs` with `gameKey: wordavoid` and the mode. The platform:

1. derives the user from the bearer session;
2. checks the write origin and game origin allow-list;
3. generates a 256-bit one-use ticket and stores only its SHA-256 hash;
4. generates an 18-byte base64url seed;
5. stores the ruleset and validation metadata on the run session;
6. returns the ticket plus a manifest bound to the persisted run ID.

Classic receives a 50-minute ticket lifetime and Time Attack a 10-minute ticket lifetime. Those are submission envelopes, not gameplay duration promises. Time Attack still has exactly 120,000 ms of active play. Guest and unconfigured local play receive an in-memory local manifest and never produce a platform placement.

The manifest contains:

| Field | Owner | Rule |
| --- | --- | --- |
| `runId` | Platform | Persisted UUID for signed-in play; local opaque ID for guests |
| `seed` | Platform/local fallback | 16–128 URL-safe characters |
| `mode` | Platform | `classic` or `timeAttack` |
| `rulesetVersion` | Shared contract | Exact RC identifier |
| `dictionaryVersion` | Shared contract | Exact generated-content version |
| `dictionaryHash` | Shared contract | Exact generated-content SHA-256 |
| `normalizationVersion` | Shared contract | `ascii-lower-v1` |

## Deterministic prompt generation

`createWordAvoidPrompt(seed, sequence)` is random-access. It does not depend on prior JavaScript RNG state, render cadence, viewport, or ambient process state.

- Sequence starts at zero and has no gaps.
- Level is `floor(sequence / 5) + 1`.
- Difficulty comes only from that level.
- A portable FNV-1a/mix32 sample selects the word within the frozen difficulty pool.
- A separate sample lane produces a stable 16-bit `angleTurn`.
- The prompt ID is the generated dictionary entry ID, not client prose.

The validator regenerates the expected prompt from the stored seed. A changed prompt ID, changed sequence, changed dictionary, or unsupported mode rejects the run.

## Input and time normalization

Competitive input accepts exactly one Unicode-NFKC-normalized ASCII letter matching `/^[a-z]$/`. Uppercase ASCII is normalized to lowercase. Space, punctuation, digits, emoji, multi-character strings, and IME/composition output are ignored by the V1 runtime rather than inserted as poisonous evidence.

Every event time is an integer count of wall milliseconds since local run start. The validator derives active time by subtracting closed pause intervals. Events must be monotonic. Gameplay events during a pause, a second pause, a resume without a pause, or a finish while paused are rejected.

The game loop resets its frame clock when play resumes. The visible session clock, scoring response time, WPM duration, Time Attack clock, and server recomputation all exclude paused time.

## Evidence schema

The finish request binds its header to the manifest and submits an ordered event list:

| Event | Required fields | Meaning |
| --- | --- | --- |
| `spawn` | `sequence`, `promptId`, `atMs` | A deterministic prompt became active |
| `attempt` | `sequence \| null`, `key`, `atMs` | One normalized competitive key; null means no word was targetable |
| `miss` | `sequence`, `atMs` | An active prompt reached the player |
| `pause` | `atMs` | Active time stopped |
| `resume` | `atMs` | Active time resumed |
| `finish` | `health \| timer`, `atMs` | The run reached a competitive terminal rule |

The evidence header repeats `runId`, ruleset, dictionary version/hash, and normalization version. The client may include a summary for diagnostic comparison, but a changed field rejects the request; it never overrides recomputation.

Hard limits bound validation work to 12,000 events, 45 minutes wall duration, 30 minutes active duration, and 32 simultaneously active prompts.

## Server recomputation

The validator starts from 100 health and zero counters, replays each event, and derives:

- score from prompt length, deterministic difficulty/level, active response time, and pre-completion streak;
- completed and missed words;
- attempted and correct characters;
- maximum streak;
- accuracy;
- WPM from correct characters and active duration;
- final level;
- health from frozen per-difficulty miss damage;
- terminal reason.

Classic is accepted only when recomputed health is zero. Time Attack accepts `timer` only at 120,000–120,250 active ms and also accepts a legitimate earlier health terminal. A client-side health edit, score edit, aggregate edit, prompt edit, or ruleset edit has no authority.

## Finish and retry behavior

`POST /api/v1/runs/[runId]/finish` loads the run by authenticated user, reconstructs the manifest from stored server metadata, validates the evidence, and passes only the recomputed score/metrics to the service-only transaction.

`finish_provisional_run` locks the run row. The first valid finish writes one `score_submissions` row and one linked `leaderboard_scores` row, then marks the run finished. A concurrent or later retry with the same valid ticket returns those same IDs and trust label. A wrong ticket is rejected before the existing receipt is disclosed. Rejected, expired, wrong-user, or non-started runs do not create a second result.

Executable SQL race/read-back testing is still required on the approval-gated Supabase development branch. Static verification proves the migration shape, not PostgreSQL runtime behavior.

## Client behavior

- The game asks the platform for a manifest only when Supabase is configured and a session exists.
- Local/guest start does not make placeholder network calls.
- Classic and Time Attack spawn from the manifest; hidden experimental modes retain their unranked local paths.
- Spawn, attempt, miss, pause, resume, and competitive finish events are recorded in the Zustand store.
- Quit produces no competitive finish and no platform result.
- The client runs the same validator before sending. This improves failure handling but is not a security boundary; the server always repeats validation.
- The finish helper makes one immediate safe retry after a network or server failure, using the same ticket and evidence so a lost first response resolves to the original receipt.
- Direct legacy leaderboard inserts are not used by this path.

## Rejection classes

The contract returns stable codes for invalid manifest/header identity, ruleset/dictionary/normalization drift, malformed or excessive evidence, invalid/out-of-order time, pause-state errors, sequence gaps, prompt mismatch, excessive active prompts, inactive prompt references, invalid input, missing/duplicate finish, events after finish, invalid terminal reason/duration, and forged summaries.

The API returns those codes without echoing the submitted evidence. A rejected platform finish must not block guest/local play or erase local statistics.

## Verification matrix

Automated coverage includes:

- all 1,770 dictionary entries and the committed hash;
- 500 random-access prompts from one seed;
- seed divergence and normalization boundaries;
- Time Attack pause exclusion and exact terminal duration;
- Classic health terminal, miss damage, maximum streak, score, WPM, and accuracy;
- run/ruleset/dictionary/prompt tampering;
- sequence gaps, time ordering, invalid keys, duplicate finish, and forged summaries;
- server reconstruction from persisted validation metadata;
- client deterministic spawn, ignored out-of-contract keys, pause-aware WPM, evidence emission, local validation, and health-ending submission;
- service-only grants and source-level idempotent receipt behavior.

## Deliberate limits and next gates

WD1 does not activate the production database, secrets, auth UI, or leaderboard. It does not claim bot resistance, verified human play, mobile software-keyboard support, authoritative game physics, or balance approval.

Before production ranking:

1. execute the foundation migration and pgTAP suite on the isolated Supabase branch;
2. exercise first finish, simultaneous finish, same-ticket retry, wrong-ticket retry, expiry, and wrong-user cases with read-back;
3. verify origin behavior and abuse limits;
4. keep accepted WORDaVOID rows `provisional` until the product explicitly approves a promotion policy;
5. complete WD2 platform session/detail/boards/receipt integration and WD3 input/accessibility/repeat-run hardening.
