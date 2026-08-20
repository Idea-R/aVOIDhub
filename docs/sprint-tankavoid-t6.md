# Sprint evidence — TankaVOID T6 platform integration

- Date: 2026-08-20
- Issue: [#34](https://github.com/Idea-R/aVOIDhub/issues/34)
- Branch: `codex/tankavoid-t6-platform-integration`
- Base: exact T5 commit `0eea9a5`
- Imported platform-detail baseline: `de7be47`
- Public state: Coming Soon; no friendly Play route, production deployment, or database migration

## Intended outcome

Connect the complete five-wave TankaVOID run to the aVOID platform contract without letting the browser author an accepted score. T6 adds a shared manifest and evidence package, server-created run identity, bounded terminal evidence, server score recomputation, an accepted-only board and personal best, and a shareable receipt surface. Guest play remains complete and quiet when platform services are unavailable.

T6 is a source and local-integration gate. It does not claim that the staged database transaction has run, that browser evidence is cheat-proof, or that the game is publicly released.

## Frozen run and score contract

The shared `@avoid/tankavoid-contract` package is the only score-contract implementation used by both the Tanka client and platform server.

| Field | Frozen T6 value |
| --- | --- |
| Game | `tankavoid` |
| Mode | `five-wave` |
| Ruleset | `tankavoid-v1-rules-1` |
| Simulation | fixed 60 Hz |
| Waves | exactly 5 on a clear |
| Hostiles | 8 ordinary + 1 commander |
| Maximum combat time | 72,000 ticks / 20 minutes |
| Maximum damage dealt | 1,270 |
| Maximum damage taken | 332 |
| Maximum field repair | 112 |
| Maximum shots | 4,000 |
| Maximum accepted score | 5,770 |

The server computes the score as:

```text
floor(damage dealt)
+ 75 × ordinary enemies disabled
+ 200 × waves completed
+ 500 when the run is cleared
+ 2 × completed combat seconds
```

The terminal envelope carries the server-created run id, seed, mode and ruleset plus bounded run metrics. Validation rejects identity mismatch, invalid terminal reasons, impossible wave/kill/commander combinations, negative or over-limit numbers, hits above shots, ricochets above hits, and defeat with remaining hull. The browser does not send a proposed score.

## Start, finish, and trust boundary

- `POST /api/v1/runs` creates the manifest and unsigned 32-bit seed on the server.
- The game begins with the returned manifest when the platform is available.
- Guest, unconfigured, timeout, and ordinary network failure fall back to a local run without blocking play.
- Only a natural `run-cleared` or `player-disabled` terminal state can submit. The systems-check route cannot submit.
- The client sends the terminal evidence once and retries one transient failure.
- The server reconstructs identity from the stored run, validates the bounded envelope, recomputes score and metrics, and calls the existing service-only finish transaction.
- Valid accepted results receive a submission id and `/results/<submissionId>/` receipt URL.
- The board and personal best read only accepted `score_submissions` for the exact Tanka mode. The three historic legacy Tanka rows cannot enter this board.

The resulting capability is `bounds_recomputed`, and the trust state remains `provisional`. The platform can prove that accepted arithmetic and summary combinations fit the ruleset; it cannot prove that an untrusted browser played honestly. T6 therefore never uses `verified`.

## Game experience

The briefing checks for a platform session without turning login into a play gate. A server manifest switches the simulation to the server seed; a quiet fallback keeps the local seed. Stale or overlapping start responses are generation-guarded.

Natural results always show the local score. When saving succeeds, the result adds its provisional status, receipt link, and a share/copy action whose language says that bounds and score math were recomputed. Rejected, unavailable, and retry-exhausted states stay explicit without erasing the playable result. Pause and systems-check behavior remain local and cannot create a score submission.

## Platform presentation and privacy

`/games/tankavoid/` remains the canonical presentation route. It describes the current five-wave run, directional armor, four enemy identities, keyboard controls, touch candidate, provisional trust, and held release status. It exposes no Play action while the release gate is closed.

The Tanka board uses accepted-only submissions and deterministic score/date ordering. A signed-in player receives a personal-best query; guests receive a truthful sign-in boundary. Failed or unconfigured reads render a staged state instead of fabricated scores.

`/results/[submissionId]/` accepts only a UUID-shaped id and exposes accepted result facts: player display name, score, game, mode, ruleset, trust, date, and bounded Tanka metrics. It does not expose email, user id, private profile data, or a rejected/pending submission. The receipt is `noindex`.

## Build and public-release boundary

The root assembly now builds TankaVOID and copies it into the platform's generated public assets for review. Immutable caching is configured only for its hashed assets. There is deliberately no lowercase `/tankavoid` redirect and no catalog Play destination. The game remains Coming Soon until T7 proves physical touch behavior, final balance/art/performance, deployed smoke, and rollback.

The assembled file is reachable by its explicit review artifact path during a local build. Next's production server does not synthesize a directory-index route for it; Netlify will receive no friendly redirect until release approval.

## Automated verification

All local gates passed:

- Shared contract: 1 file / 9 tests.
- TankaVOID release gate: TypeScript, zero-warning ESLint, 11 files / 43 tests, production build, and bundle-budget verification.
- TankaVOID output: HTML 0.65 kB / 0.38 kB gzip; CSS 14.73 kB / 4.02 kB gzip; JavaScript 198.68 kB / 62.96 kB gzip.
- Initial compressed transfer: 66,621 / 122,880 bytes.
- Largest JavaScript: 198,686 / 266,240 bytes.
- Platform Tanka tests: 2 files / 5 tests.
- Platform typecheck: pass.
- Platform foundation verifier: 50 assertions.
- Catalog verifier: 8 titles, 8 details, 7 Play destinations, one honest Coming Soon state.
- Full Netlify assembly: all four hosted games built and staged; Next generated 29 pages and every API/dynamic route.

A production-mode local HTTP check returned the deliberate `503 {"error":"platform_unavailable"}` for an unconfigured run start rather than throwing a 500. Tanka detail, leaderboard, and a valid-shape unavailable receipt each returned 200. No production service or database was touched.

## Browser evidence

- Desktop briefing and guest start reached deployment and combat with the T6 session language and no warning/error log.
- The desktop detail page showed Coming Soon, no Play link, the T6 rules and a staged board.
- At 360 × 780, the detail page, receipt, briefing, HUD, coach and both touch pads stayed within the document with no horizontal overflow.
- At 844 × 390, HUD, coach and both controls remained non-overlapping and combat continued without warning/error logs.
- Escape and Continue preserved the single pause owner and resumed the game.
- `?smoke` completed with score shown as an em dash and no platform submission status or receipt, confirming systems-check cannot submit.
- The unavailable receipt rendered its truthful staged state at phone width without exposing a false result.

Browser Pointer Events and responsive emulation remain release-candidate evidence, not physical iOS/Android certification.

## Database gate still open

Read-only inspection confirmed that production does not contain the coordinated platform migration or the `game_run_sessions`, `score_submissions`, and `game_favorites` tables. T6 applied no migration and performed no production write.

Before any real Tanka result can be accepted, the short-lived Supabase development branch must apply the reconciled foundation and prove run creation, ownership, expiry, replay/idempotency, invalid evidence, concurrency, accepted-only reads, personal best, and receipt privacy. That paid branch and all production data changes remain separately approved gates.

## Boundary held

- No direct browser score/table write was added.
- No client-authored score, user id, verification flag, game key, mode, or ruleset is trusted at finish.
- No score is called verified.
- Guest play does not require login or an available backend.
- TankaVOID remains Coming Soon with no public Play action or friendly game route.
- No Supabase migration, Netlify production deploy, DNS, Stripe, AdSense, secret, account, or production-data state changed.

## Next action

Execute the run-ticket/data acceptance matrix on the approved short-lived Supabase branch. T7 then owns physical iOS/Android testing, final feel/art/performance, deploy-preview smoke, production route and rollback proof, and the explicit decision to change the catalog state from Coming Soon to Play.
