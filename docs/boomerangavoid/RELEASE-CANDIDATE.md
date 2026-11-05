# BoomerangaVOID implementation candidate

Built on isolated `feature/boomerangavoid` from verified `origin/main` commit `0e69577536f5de173d57f12725cc08ba98333f95`. The dirty legacy checkout and pending platform repair PR #61 were preserved. This is a review candidate, not a production release approval.

## Delivered

- Original Three.js garden arena game: dash, slash/deflect/shove, curved throw, return/recall/catch, six creatures, six hazard arenas, eight bounded upgrades, FFA/teams/Relay Seed, three bot difficulties, tutorial and rematch flow.
- Couch play for 2–6 seats; two shared-keyboard layouts, gamepad mapping, independent touch pointers, reduced motion, volume/mute and saved settings. Online local parties reserve 1–6 seats atomically; host controls private/public rooms, bots and match options.
- A real authoritative Colyseus room service: 60 Hz shared simulation, 20 Hz snapshots, legal-input ownership/rate/tick checks, bounded event history, readiness/version barrier, private invites/public discovery, spectator admission, owner recovery and 20-second reconnect/refresh lease. Client prediction never awards kills or points.
- HMAC room-entry tickets from the existing verified platform session, one-use nonces, 60-second expiry, room/seat/audience binding and boot-epoch invalidation. Production guests are disabled. No production test mutation route exists.
- Google sign-in application flow using the existing Supabase SSR client, safe callback/return paths, pending/error handling and email fallback. Public provider availability is checked before redirecting.
- Existing AVOID catalog/detail/build/Netlify integration, held as **In development** with no public Play or ranking claim. Existing `Idea-R/aVOIDhub` is the project repository; no duplicate repository was created.
- Editable Blender source, six rigged GLB exports with 12 named clips each, original WebAudio music/effects, attribution and dependency licenses. The optimized game renderer currently uses the matching procedural geometry/animation; the GLBs are an independently validated portable asset library.

## Reproduce locally

Node 22.23.2 / npm 10.9.8 were used on Windows. From the repository root:

```powershell
npm ci --ignore-scripts
npm run verify:boomerangavoid:release
```

For interactive review, run in separate terminals:

```powershell
$env:BAV_ALLOW_GUESTS='1'
npm run workspace:boomerang-server
```

```powershell
npm run workspace:boomerang
```

Open `http://127.0.0.1:5177/boomerangavoid/`. Guest mode is deliberately local/test only. The browser smoke checks require an installed Chrome, the game dev server on 5177 and the room server on 2777:

```powershell
npm run verify --workspace=@avoid/boomerang-avoid
```

## Evidence and acceptance status

The source gate runs five workspace typechecks, 41 simulation / 6 protocol / 45 platform unit tests, catalog validation, live room tests with six actual SDK clients, and the complete six-game plus Next production assembly. Its timestamp, exact commands, results and lockfile hash are in [local-release-checks.json](evidence/local-release-checks.json). Only a zero result for every listed command is a passing run.

| Acceptance | Executed evidence | Remaining limits |
| --- | --- | --- |
| B00/B01, P01/P02 | Isolated base; locked install; typechecks/tests; full game and Next assembly; platform foundation static check | Remote CI/preview status must match the final candidate commit |
| C02–C10 | Boundary/collision/deflection/catch/score/reset/upgrades/maps/bots/mode tests; three deliberate mutations detected; actual six-client match finishes and rematches | Human balance and every visual timing edge need playtesting |
| N01/N02/N05/N09 | Six independent SDK clients; ownership/illegal inputs; stale input neutralization; reconnect; creator ticket abuse; owner/loading cleanup; two browser tabs complete real-input match, refresh and rematch | Local processes/tabs are not two separate internet connections |
| N03/N04/N07 | Actual WebSocket-frame proxy applied 120 ms RTT, 20 ms jitter and 1% injected retransmission-style stalls; six-client match and reconnect completed; authority/event checks pass | Stalls are not true packet loss. No claim for all latency/loss combinations, perceived fairness or correction bounds |
| A01/A04 | Google application/provider-disabled fallback, return-path/origin/room-health checks and HMAC replay/binding tests | Real cookie/OAuth consent/callback/session canary requires provider configuration |
| U01/U02 | Real keyboard action checks; simultaneous emulated touch move+dash; portrait/landscape bounds; six-seat couch start; two-browser online full match/rematch | Full couch match/rematch, physical controllers/mobile and all tutorial steps remain device journeys |
| V01 | Original source/exports; six exported GLBs loaded in actual Three and body animation verified; gameplay/menu/mobile/online captures | Runtime uses optimized procedural animation; no skinned-animation performance claim |
| V02/V03 | Draw calls reduced to 63 attract/33 two-seat in sampled scenes; initial game JS ~216 KB gzip plus CSS/fonts; bounded effects | No named-hardware FPS, mobile FPS, allocation soak, 20-rematch memory or first-load timing certification |
| N06/N08/R02 | Health/readiness, bounded inputs/events/rooms, boot-bound ticket audience, 25-second drain and recovery messaging implemented | Candidate-host capacity/30-minute and 2-hour soak, restart/drain orchestration, telemetry alerts unverified |
| A02/A03/A05/R01/R03 | Read-only live config/deploy audit and concrete configuration proposal | Google disabled, no persistent WSS host, no database result persistence or production release |

Seeded replay now matches Node22 and Chrome155 across all 18 arena/mode cases × 2,400 ticks, at 360 checkpoints after correcting a floating-point contact-boundary divergence. Firefox/WebKit remain untested. Reproduce with `npm run verify:replay --workspace=@avoid/boomerang-avoid`.

Two local keyboard seats plus one remote browser seat passed public Quick Join and independent input routing; see [mixed-party evidence](evidence/mixed-party.json), repeat with `npm run verify:party --workspace=@avoid/boomerang-avoid`.

Evidence: [browser journey](evidence/online-browser.json), [touch input](evidence/touch-input.json), [network impairment](evidence/impaired-network.txt), [asset validation](evidence/asset-validation.json), [independent review/fixes](evidence/independent-review.md), and PNG captures in `evidence/`. Screenshots prove appearance at a moment; state/assertions and real inputs support behavior.

A full couch match test under software-rendered Chrome previously exceeded its 180-second wall-clock limit; it is not reported as passed. The finite browser smoke covers touch and six-seat start; complete couch/device acceptance remains open. Native Chrome opened the game visually, but its scoped debugger was unattached, so no native GPU/FPS measurement was obtained.

## Release blockers and known scope

1. Persistent room hosting and a shared production signing secret are not provisioned. Static preview local play is possible; authenticated internet matches need the proposed WSS service and environment wiring.
2. Deployed Supabase public settings show Google **disabled**, email enabled and signup enabled. Google client/consent/redirect settings and actual existing/new-account login were not verified. No auth credentials or settings were changed.
3. Two external networks, real mobile/controller tests, candidate-host capacity and the stated soak/performance gates remain unverified.
4. Account preferences and trusted match receipts are not persisted; no schema migration was written/applied, and no leaderboard is enabled. Session and room scores are authoritative only within the running match. DATA-01/A05 remain open.
5. The affected Next and platform Zod versions were patched. Root audit still reports 32 advisories (10 low, 17 moderate, 5 high, 0 critical), mostly existing games/dev or optional dependency chains. Broad unrelated major upgrades were not forced. Vite still warns about the single raw game JS chunk exceeding 500 KB; the compressed payload remains small.

Production deployment, main merge, Google security/credential changes, paid hosting and database migrations require the concrete action-time approvals described in [CONFIGURATION-PROPOSAL.md](CONFIGURATION-PROPOSAL.md). Local implementation and a hosted static review do not certify these gates.
