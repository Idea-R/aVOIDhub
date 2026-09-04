# Encounter-depth release evidence — 2026-09-04

## Scope

Sprint 05 staged-expedition foundation plus Sprint 06 clean scenes, six distinct mystery illustrations, Drowned Interchange outcomes, deeper enemy rosters and eight native-alpha enemy cutouts. No platform source, auth, schema or billing changes.

## Verified before release

- Unit suite: 32 passed, one optional test skipped.
- Full campaign verifier: all required gates passed, including bosses, expedition progression, save/load, victory/defeat, viewport and deterministic replay. Zero console errors, page errors, warnings or failed requests.
- Headless performance: 14.2 average FPS under SwiftShader software GL. This is not a GPU performance sign-off; human hardware testing remains required.
- Focused expedition gate: scene assets, formation, swap, stage progression and 1280×720 bounds passed locally.
- Native avatars: all eight sources structurally checked and manually reviewed against cream/navy; all runtime files retain true alpha. Hashes and generation provenance are included in this folder.
- Standalone HTML: 6.00 MB; offline file boot passed, six starter images embedded/loaded, no errors (one expected audio fallback).
- Whole-site application build: passed for all assembled games and the Next.js platform. Local Netlify adapter packaging failed resolving an `@swc/helpers` path on Windows; no deployment resulted from that attempt. Hosted preview is the release gate.

## Release procedure

Hosted preview accepted: `https://deploy-preview-60--coruscating-squirrel-a47ad9.netlify.app`, deploy `6a9b2ed05ec6720008a307d1`, game revision `c9658abf9e6360b0993cbd0bc80f4917594a5a1a`. The remote focused expedition test passed all six mystery scenes, formation, Swap, depth decision and stage transition at 1280×720. Shared-site smoke checks passed all seven pages (hub, login, RailAVOID catalog and four games), 25 linked scripts/styles, exact candidate bundle hashes and all eight enemy runtime hashes. GitHub's shared release verification and Netlify build/header/redirect checks passed.

Release PR: `https://github.com/Idea-R/aVOIDhub/pull/60`, from `codex/railavoid-encounter-depth` into `main`. Attach the final production deploy ID to that PR's release-verification comment. That timestamped comment is the definitive publication record; this file alone does not claim the build is live.

Before promotion, run the focused encounter gate on the actual preview and smoke-test the hub, login, public game routes and emitted assets. After promotion, verify the custom domain serves the candidate's hashed RailAVOID bundle and repeat the focused gate. Do not publish a Rail-only folder over the shared site.

Previous production deploy captured before work: `6a99741d1aabe80008bc9c2a`, commit `3da24367da9be8388705704975b346c639db70cd`, site `780c1b04-64c7-47b6-9423-18953739590e`. If rollout fails, use the verified previous deploy as the rollback target without deleting build history.

## Handoff

Playtest: `PLAYTEST.md`. Next goal plan: `../sprint-07/PLAN.md`. API/tool access: `../DEVELOPMENT-TOOLKIT.md`. Do not mistake the broader Away Team roadmap for completed work in this release.
