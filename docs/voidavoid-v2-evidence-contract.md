# VOIDaVOID V2 deterministic run and evidence contract

Updated: 2026-08-20
Status: local V2 gate complete; platform validation remains V3

## The claim this contract makes

VOIDaVOID now gives every run an unsigned 32-bit seed, separates score-affecting randomness from visual noise, advances gameplay on a 60 Hz simulation clock, and records the ordered events needed to recompute the final score. The browser verifies that evidence before it calls a result `replayable-local`.

That label is deliberately narrow. It means the recorded seed, ticks, score events, and final totals agree. It does **not** prove that the browser reported real pointer movement, legitimate collisions, or an untampered game client. The run remains local and unranked until V3 issues the seed from the platform and validates bounded input or simulation evidence on the server.

## Versioned identifiers

| Field | V2 value | Meaning |
| --- | --- | --- |
| Ruleset | `voidavoid-v2` | Gameplay clock, seeded-world, and score-evidence contract |
| Evidence version | `1` | JSON evidence envelope shape |
| RNG | `mulberry32-v1` | 32-bit deterministic generator used by named gameplay streams |
| Step rate | `60` Hz | One gameplay tick is `1/60` second |
| Canvas scale | DPR `1` | Evidence dimensions are logical canvas pixels |

Seeds are formatted as eight uppercase hexadecimal characters. A normal local run gets its seed from `crypto.getRandomValues`; a time-derived fallback exists only for environments without Web Crypto. Seed generation does not establish trust. Recording the seed only makes the run reproducible.

## Named random streams

Each stream is derived from the run seed with a stable FNV-1a name hash. Drawing from one stream cannot move another stream forward.

| Stream | Score-affecting decisions |
| --- | --- |
| `world` | Meteor spawn check, edge and edge position, super status, speed variation, radius, and deterministic meteor sequence ID |
| `power-up` | Next spawn interval, spawn position, drift heading, drift speed, and drift-change interval |
| `chain` | Chain spawn check, fragment count, and accepted fragment positions |
| `score` | Exactly one point roll for each destroyed meteor, in recorded destruction order |
| `defense` | The direction used only when a deflection begins at the exact center of a defense zone |

The following remain intentionally outside gameplay streams because they cannot change collision, score, or event order: particle IDs and motion, score-text drift, screen shake, meteor color, sparkles, arcs, lightning shape, render jitter, glow, and animation phase. Performance mode may reduce those effects without changing the named gameplay streams.

## Simulation time

Gameplay no longer uses wall-clock time for these decisions:

- the three-second opening grace period;
- chain spawn checks, cooldown, urgency window, and expiry;
- combo expiry;
- defense activation and its one-second player-danger window.

They now read the fixed simulation tick. Manual pause, help, focus loss, and page visibility stop the tick. Resuming does not inject the time spent away from the game.

Power-up intervals are sampled once when a run begins and once after each spawn attempt. The old implementation sampled a new random interval every frame, which made the effective schedule difficult to reason about and tied it to draw count.

## Evidence envelope

The canonical types and verifier live in `games/void-avoid/src/game/run/runEvidence.ts`.

Each completed envelope contains:

- version, ruleset, RNG algorithm, seed, viewport, DPR, and fixed-step rate;
- terminal duration in simulation ticks;
- score events in nondecreasing tick order;
- whether the 4,096-event ceiling was exceeded;
- final survival, meteor, combo, and total values;
- named-stream draw counts for diagnostics;
- an `fnv1a32:` integrity code over the canonical local payload.

The integrity code catches accidental mutation and gives the player a compact run code. It is not a signature and must never be used as proof that a hostile browser is honest.

### Score event vocabulary

| Event | Recomputed effect |
| --- | --- |
| `meteor` | Draw once from the `score` stream, then apply the normal or super-meteor point formula; includes `defense` or `knockback` source for audit context |
| `chain-fragment` | Add 10 meteor-category points |
| `chain-detonation` | Recompute the documented completion bonus and meteor-count multiplier |

Survival score is recomputed from `durationTicks / 60`. V2 currently records no combo event because the canonical play path does not call the dormant combo-scoring method. If that path is activated without extending the evidence vocabulary, verification fails instead of silently accepting the extra points.

## Local verifier

`verifyRunEvidence` rejects an envelope when any of these checks fail:

- wrong version, ruleset, RNG, fixed-step rate, or DPR;
- seed outside unsigned 32-bit range;
- viewport outside the supported 1–3840 by 1–2160 boundary;
- negative, unordered, post-terminal, or more than six hours of ticks;
- more than 4,096 score events or a truncated event list;
- chain clear outside 1–50 meteors;
- score RNG draw count different from the number of meteor-score events;
- recomputed score category or total different from the final result;
- payload integrity code different from the recomputed code.

A passing result receives a code shaped like `12AB34CD-89EF0123` and the status `replayable-local`. A failed result is `invalid-local`; its UI says no placement was claimed.

## V2 proof

- 57 canonical TypeScript files lint with zero errors and zero warnings.
- 7 test files / 22 tests pass.
- Seed reset, named-stream isolation, and stable seed formatting are covered.
- Identical seeds reproduce meteor physics, power-up schedules and drift, chain composition and positions, and the defense fallback.
- Score evidence recomputes the exact final breakdown and rejects score, event-order, draw-count, and integrity tampering.
- Standalone Vite and full 21-route Next.js platform builds pass.
- Browser checks pass at 1440×900, 390×844, and 844×390 without overflow.
- Twenty consecutive finish/replay cycles returned twenty distinct run codes and `replayable-local` every time while retaining one loop owner, five input listeners, and exact session counts.
- The browser console produced no warnings or errors.

## V3 handoff

V3 must not send this local envelope directly to a competitive board and call it validated. The platform adapter still needs to:

1. create a one-use run ticket and issue the seed/ruleset before the first playable tick;
2. bind the ticket to the signed-in account when one exists, while preserving guest play;
3. add bounded pointer/action evidence or an equivalent authoritative simulation strategy;
4. run a server-side validator that ignores client totals and returns the accepted result;
5. store an idempotent receipt and derive personal best, leaderboard placement, and share copy from that receipt;
6. classify this score as `provisional` until the server proves more than score arithmetic.

No production database, Supabase branch, profile, leaderboard, or deployment changed in V2.
