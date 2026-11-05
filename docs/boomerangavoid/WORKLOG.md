# BoomerangaVOID work record

## 2026-11-04 — Astra scope and handoff completed

Requested outcome: a dedicated original boomerang arena party game for the AVOID site, planned with Astra and then built with GPT-6.1 Sol, with useful agents and minimal user intervention.

Work completed in this planning pass:

- Read game-building and GitHub workflow skills, `C:\dev\AGENTS.md`, current/legacy package and build records, modern platform instructions and active delivery decisions.
- Located registered aVOID project and existing public `Idea-R/aVOIDhub` repository. Read Git status/refs/remotes without modifying persistent Git configuration.
- Identified heavily changed legacy `C:\dev\aVOID` versus modern `C:\dev\aVOID-main` repair checkout. GitHub confirms repository default `main` and PR #61 remains open/unmerged. No local fetch, branch change or Git write occurred.
- Two bounded **gpt-6-astra** workers audited platform/authentication and saved REA research. The platform worker directly inspected live login in Chrome; only email magic links were offered. No account form was submitted.
- Located REA 6.7.0 installation and saved benchmark research. Read historical results without rerunning them. Verified Boomerang Fu's high-level mechanics using official public sources; no game binary, extraction or purchase.
- Authored the complete product/architecture/milestone plan, Sol execution brief, validation matrix, task backlog and supporting audit reports. Public documentation checked for current Colyseus netcode, Three.js rendering/model workflow, browser gamepads and Supabase OAuth/redirect behavior.
- An independent Astra review prompted explicit one-stick curve/recall/Twin Arc rules, precise simultaneous-hit arbitration, a complete Relay Seed objective contract, input expiry/tick windows, streamed-map readiness and public-room admission. These were resolved in the final specification. Numerical budgets remain measurable starting targets rather than invented benchmark results.

No game source, assets, authentication settings, credentials, remote branches, PRs, database schema/data, hosting resources or deployments were created or changed. No BoomerangaVOID game tests were run because implementation has not begun. The supporting reports identify their own narrower observations and limits.

## Verified resume point

1. Read `SOL-IMPLEMENTATION-HANDOFF.md` and the main plan.
2. Verify/fetch remote main, inspect current worktrees and create/reuse isolated Boomeranga feature work under `C:\dev\_worktrees\aVOID\`; preserve legacy and PR #61.
3. Move the bundle into the implementation branch and make this the ongoing work record.
4. Execute M0/M1 and the early two-client networking spike; continue through the authorized V1 scope.

Current implementation status: **not started**. A Sol build chat was not launched by this delegated planning pass; the coordinator can create one using the supplied prompt and verified project ID. This prevents an accidental duplicate build while the parent is coordinating projects.

## Remaining release prerequisites

- Exact current production deploy/source identity, remote Google provider/redirect settings and authenticated login canary.
- A persistent server runtime for real online play; no existing one found in the inspected AVOID architecture.
- Any new credentials/persistent access, billable hosting, deployment/publication and migration approval needed by the actual configuration proposal.
- Real-device/controller and external-network evidence after code exists.

None prevents local game implementation or local client/server testing.

## 2026-11-05 - Sol implementation checkpoint (in progress)

- Freshly fetched `origin/main=0e69577536f5de173d57f12725cc08ba98333f95`; isolated branch `feature/boomerangavoid` at `C:/dev/_worktrees/aVOID/boomerangavoid`. Legacy dirty checkout and pending PR #61 untouched.
- Two Sol 6.1/high workers delivered pure simulation and Three.js client; Astra/high independent contract review found eight issues, corrected by lead with regressions. Runtime model metadata unavailable.
- Implemented 6 arenas/characters, 8 upgrades, 3 modes, bots, local party/tutorial/settings/touch, authoritative Colyseus rooms, protocol/ticket checks, Google application flow, safe callback and held catalog/build integration.
- `npm run verify:boomerangavoid:release` passes: five typechecks; 38 sim tests; 5 protocol tests; 40 platform tests; 4 live server tests including 6 real SDK clients, reconnect, stale input, owner election, loading cleanup and cross-room create-ticket rejection; catalog contract; full six-game + Next16.4.5 production assembly.
- Patched affected Next and Zod dependencies. A complete root dependency audit still needs final recording; do not imply a zero-advisory repository.
- Browser baseline: real movement/short Space/J/K presses pass; tutorial opponent neutral until duel; no 390px menu overflow. Draw calls reduced from 822 to63 attract and680 to33 two-seat. Chrome headless SwiftShader is visual/input evidence, not device performance.
- Original models exported from runtime, rigged in isolated Blender5.2 CLI, .blend + 6 GLBs/12 clips each preserved; neutral source review render inspected. Runtime GLB/animation validation in progress. Game rendering retains optimized procedural animation pending any accepted export integration.
- Netlify read-only API verifies live production deploy `6a9cdccc91ff570008363f2f` and commit equal to base above. Site `780c1b04-64c7-47b6-9423-18953739590e`, avoidgame.io, production branch main.
- Read-only deployed Supabase public auth settings: backend matches `jyuafqzjrzifqbgcqbnt.supabase.co`; Google disabled, email enabled, signup enabled. No credential values printed/copied, settings changed, database migrations applied, services provisioned, remote branch/PR/deploy created.

Resume: finish two-browser room/refresh/match/rematch journey (real keyboard driver), touch/local6-seat UI journey, actual-stream impaired network regression, exported asset/animation validation, narrow missing online mixed-party/public-lobby controls, server receipts proposal if required, final tests/artifacts, commit + draft PR/Netlify preview when ready. Production host/Google/security changes remain action-time gates; no production release claim.

## 2026-11-05 - Review candidate frozen

- Final full source gate passed: 41 simulation, 6 protocol, 45 platform and 4 live-server tests; five typechecks; catalog; complete six-game plus Next production assembly. Timestamp and lockfile hash: evidence/local-release-checks.json. Platform foundation static verification also passed (52 pgTAP assertions checked structurally; no live database migration/test implied).
- Final two-browser real-input journey passed on the latest server: create/join, ready/start, refresh restores same seats, full first-to-three match and rematch lobby; zero page errors. Two-local-plus-one-remote public Quick Join and independent keyboard input passed. Emulated multi-touch movement+dash, portrait/landscape bounds and six-seat couch start passed.
- Actual WebSocket-frame impairment (120ms RTT,20ms jitter,1% injected transport stalls) completed a six-client match/reconnect without inconsistent results. This is not real packet-loss or subjective playability certification.
- Seeded Node22/Chrome155 replay initially exposed a projectile overlap roundoff divergence at tick1723. Scale-aware boundary tolerance plus captured regression corrected it; all18 map/mode cases x2400ticks now match at360checkpoints. Firefox/WebKit unverified.
- Six original rigged GLBs and12clips each loaded/animated in actual Three; source .blend and portable generator retained. Runtime still uses optimized matching procedural assets/animation. Browser input/capture evidence is separate from physical GPU/mobile performance.
- Added self-hosted licensed fonts and runtime dependency notices. Next16.4.5/platform Zod4.6.7 patched; root audit remains32 advisories (10low17moderate5high0critical), including unrelated baseline workspaces/dependency chains.
- Google application flow is implemented, but deployed provider is disabled; credentials/redirect/security settings untouched. Persistent WSS hosting/shared signing secret unprovisioned. Concrete $7/month Render/Oregon proposal and exact env names, Google callback expectations, safety boundaries and rollback are in CONFIGURATION-PROPOSAL.md.
- No main merge/production release, paid service, OAuth credential change, remote security setting or database migration/result persistence. Catalog remains in development. Physical devices, two external networks, chosen-host capacity/soak and DATA-01/A05 remain open.
- Parent-reviewed enum-only outcome receipts recorded for the simulation/client assignments and independent review. Worker writes/resources stopped. Publishing a feature branch/draft PR for review is the next authorized operation; its link and preview status are reported separately.
