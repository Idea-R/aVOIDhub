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

Publication status and final identifiers will be recorded here and in the release PR after verification. This preflight alone does not claim the new game is live.
