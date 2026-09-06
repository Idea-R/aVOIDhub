# Map-first UI and readable combat release — 2026-09-05

## Authority and boundary

The user authorized publishing the verified local game and starting the next planned slice. Release the accumulated RailAVOID-only UI, crew art, Keeper conversation and readable-combat work on `codex/railavoid-map-first-ui` through a hosted whole-site PR preview, then merge the accepted revision to production `main`. Preserve the separate platform repair PR and all other games. Never deploy a Rail-only folder over the shared site.

Next-slice implementation stays separate from this release. Its first local gate is a blocked-link/retreat contract, followed by one readable two-stage ambush/miniboss and normal-party pacing evidence. No automatic publication of that new slice.

## Preflight

- Repository: `Idea-R/aVOIDhub`, public product; source checkout `C:/dev/aVOID-railavoid-release`, game `games/rail-avoid`.
- Fetched `origin/main` matches base `25d6820105c6d98dee793cf7d7d1164625fbd44b`. All pending source changes are under RailAVOID. No platform/auth/schema/billing source changes.
- Netlify CLI confirms site `780c1b04-64c7-47b6-9423-18953739590e`, `coruscating-squirrel-a47ad9`, `https://avoidgame.io`, Git production branch `main`. The app connector needs reauthentication; the existing CLI credentials work. No credential changes.
- Captured current production/rollback deploy: `6a9b3076b2be240008d79f83`, commit `25d6820105c6d98dee793cf7d7d1164625fbd44b`.
- Completed local evidence: 75 unit tests passed, one optional skipped; TypeScript/build; full functional campaign; 11 combat viewport/scale combinations; expedition art/cards, conversation/continuity, keyboard/controller/mouse/save/offline checks. See `READABLE-COMBAT.md` for the known headless timing rerun and real-GPU/human balance limitations.
- Accepted crew/frame PNG masters and WebPs are included with provenance. The unaccepted first frame attempt remains local and is not part of the release.

## Release gates

1. Review and back up the exact scoped source and accepted masters on GitHub.
2. Let the existing Linux/Netlify pipeline build the entire site. Verify the preview's RailAVOID JS/CSS bytes, shared hub/login/catalog/game routes, and actual combat/conversation controls in isolated browser contexts.
3. Merge only the tested commit after checking current `main` and required checks. Wait for the corresponding production deployment, then verify the custom domain and repeat the focused checks.
4. Record PR, commit, preview, production deployment and live verification evidence. Preserve the captured deploy for rollback; do not delete deployment history.

## Published

- [PR #62](https://github.com/Idea-R/aVOIDhub/pull/62) merged; candidate `994f45a8829ae8d8ebcd3be9cd5d95117eb73255`, production commit `16d2fbfd4c3102c2e42d218831082906ec285912`.
- Hosted preview `6a9cb6813770e400075cd660` passed seven shared routes, 25 linked assets and exact game bundle hashes; combat 23 samples, conversation 25 samples, actual-rail clickable junctions at four sizes. Shared release CI run `34001925334` passed.
- Netlify confirms published production deploy `6a9cb816a256f200088a7a3e` for that production commit. Live at [avoidgame.io/railavoid/](https://avoidgame.io/railavoid/), published 2026-09-06 00:48:19 UTC (September 5 locally).
- Custom-domain smoke passed all seven routes and 25 assets; all three game bundle hashes match the verified preview/local candidate. Evidence: `verify/screenshots/release-live/site-smoke.json`. Focused production checks and final evidence are recorded in PR #62.
- Rollback remains the captured previous deploy above. Separate platform PR #61 was not changed. Next work is isolated on `codex/railavoid-blocked-track`, local only.
