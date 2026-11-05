# BoomerangaVOID delivery backlog

The table below is the original planned work breakdown. Current implementation/acceptance status is in [RELEASE-CANDIDATE.md](RELEASE-CANDIDATE.md); source implementation does not by itself pass device, hosted-auth or capacity gates. Acceptance IDs refer to `VALIDATION-MATRIX.md`. The implementation lead may split tasks further but must retain the V1 scope and evidence gates.

| ID | Milestone / owner role | Deliverable | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| PLAN-01 | Astra / coordinator | Existing project, live login, source and REA audit; complete plan and Sol brief | — | Complete; planning bundle |
| BASE-01 | M0 / lead | Current remote main/deploy comparison, dedicated available worktree, branch and work record | PLAN-01 | B00 |
| BASE-02 | M0 / lead | Four workspaces, locked compatible tools, local client/server launch, shared schema | BASE-01 | B01 |
| SIM-01 | M1 / simulation | Fixed timestep, serializable state, seeded map/spawns, input and event contracts | BASE-02 | C01, C07 |
| SIM-02 | M1 / simulation | Movement/dash, geometry and swept collision, action timing | SIM-01 | C01, C02, C06 |
| SIM-03 | M1 / simulation | Slash/deflect/shove, throw/curve/recall/catch, shield and kill arbitration | SIM-02 | C03–C06 |
| VIEW-01 | M1 / client | Orthographic Three.js arena, two characters, input mapping, local multiplayer seats | BASE-02 | U01, V01 |
| VIEW-02 | M1 / client + art | Representative animation, sound, trails, death feedback; local practice tutorial | SIM-03, VIEW-01 | U02, V01 |
| LOOP-01 | M1 / lead | Real-input FFA match through rematch; seed/state/browser harness | SIM-03, VIEW-02 | C07, U02 |
| NET-01 | M2 / networking | Authoritative rooms, ownership, sequenced legal inputs, versioned state/events | SIM-01 | N01, N02 |
| NET-02 | M2 / networking + client | Prediction/reconciliation, interpolation, latency telemetry, event deduplication | NET-01, LOOP-01 | N03, N04, N07 |
| NET-03 | M2 / networking | Room invites, asset-hash loading barrier, opt-in public Quick Join, reconnect lease, spectator join and host-role transfer | NET-02 | N05, N06, N09 |
| HOST-01 | M0–M2 / platform | Read-only existing-runtime inventory; exact host/region/cost/config proposal if needed | BASE-01 | Pending deployment decision; no provisioning |
| PARTY-01 | M3 / client | Keyboard/controller/touch lobby, mixed local/remote seats, settings and accessibility | NET-03 | U01–U03 |
| BOT-01 | M3 / simulation | Three fair bot difficulties, nav/cover/return behavior, seeded soak driver | SIM-03 | C09 |
| MODE-01 | M3 / simulation | Teams, Relay Seed, complete score/result/rematch semantics | LOOP-01, NET-03 | C10 |
| ART-01 | M1–M4 / art | Original style sheet, editable rigs, six character exports and animation clips | VIEW-01 | V01 |
| MAP-01 | M4 / design + simulation | Six authored arenas, hazards, nav paths, structural map validator | SIM-03, BOT-01 | C09, V01 |
| POW-01 | M4 / simulation | Eight upgrade rules, compatibility data, recursion/spawn caps | SIM-03 | C08 |
| FEEL-01 | M4 / client + art | Final audio/FX/death variants, camera readability, polish all modes/maps | ART-01, MAP-01, POW-01 | U03, V01–V03 |
| AUTH-01 | M0–M5 / platform | Read-only Google/Supabase/Netlify config audit, exact missing settings | BASE-01 | A02, no new credentials |
| AUTH-02 | M5 / platform | Google UI in current SSR platform, pending/error states, safe callback return | AUTH-01 | A01, A03 |
| AUTH-03 | M5 / platform + server | Single-use room tickets, verified seat identity, CSRF/origin/token boundaries | NET-03, AUTH-02 | A04 |
| DATA-01 | M5 / platform | Minimal draft schema and isolated tests for preferences/server receipts | AUTH-03 | A05; migration separately gated |
| HUB-01 | M5 / lead | Catalog/detail/play routes, game artifact assembly, root scripts and CI | FEEL-01 | P01, P02 |
| QA-01 | M6 / independent QA | Six-seat real journey, deliberate malformed inputs and network impairment | PARTY-01, MODE-01, POW-01 | C01–C10, N01–N07 |
| QA-02 | M6 / lead + QA | Named desktop/mobile/controller tests, visual captures, soak/capacity run | QA-01 | N08, U01–U03, V01–V03 |
| REL-01 | M6 / lead | Concrete candidate package, host proposal, exact remote changes and rollback | QA-02, HUB-01, DATA-01 | Reviewable release; no publication implied |
| REL-02 | M6 / lead | Authorized hosted preview with real Next auth + persistent WSS, real Google canary | REL-01 + required approval/access | A03, N01, R01 |
| REL-03 | M6 / lead | Operations report, final candidate evidence, approved production release/rollback | REL-02 | R02, R03 |

## Decisions fixed by this plan

Native online rooms and local party play both belong to V1. Use the existing public monorepo and modern platform. Gameplay authority stays in a shared pure simulation on the room server. Use original 3D diorama assets and six content-complete arenas instead of chasing the reference's entire map count. Local practice does not require login; online identity reuses the platform. No leaderboard claim without trustworthy server results.

## Decisions deferred until evidence is available

Exact compatible package versions, optimal snapshot rate/interpolation delay, capacity of a chosen host, whether bounded lag compensation is necessary, approved host/cost/region, actual remote Google provider readiness and precise production deploy identity. These decisions must be resolved with a concrete spike/configuration read or test, not left as vague TODOs at release.
