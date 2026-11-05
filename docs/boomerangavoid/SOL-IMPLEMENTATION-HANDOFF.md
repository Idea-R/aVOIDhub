# GPT-6.1 Sol implementation handoff — BoomerangaVOID

Use **gpt-6.1-sol** as the implementation lead. The user explicitly requested Astra for scope/plan, then Sol 6.1 for the final build, with useful parallel agents. This document is an actionable build brief, not a claim that a build chat has already been launched.

## Goal

Build BoomerangaVOID through the complete V1 in `BOOMERANGAVOID-PLAN.md`: an original, beautiful browser party arena with responsive movement, dash, slash/deflect, throw/curve/recall, funny non-graphic eliminations, bots, local multiplayer and real authoritative online rooms for up to six seats. Deliver the full lobby → match → results → rematch loop; six original characters, six arenas, eight upgrades and three modes; integrate into the existing aVOID site and existing platform identity. Preserve clear readability and low input latency as content expands.

User-authorized direction: work autonomously on the project; use relevant agents and available browser/computer tools; keep the work in the AVOID project/repository; eventually host on the existing site and make Google login work. This planning delegation held deployment/publication, new credentials and persistent-access expansion for their required approvals. Carry those boundaries into the build unless newer direct user instructions resolve them. Finish all concrete code, verification and configuration proposals before asking for a final gated action. Do not invent a permission question for ordinary local implementation, tests or reversible isolation.

## Read first

1. This complete bundle: `BOOMERANGAVOID-PLAN.md`, `VALIDATION-MATRIX.md`, `BACKLOG.md`, `platform-audit.md`, `rea-research.md` and `WORKLOG.md`.
2. `C:\dev\AGENTS.md`; all instructions in the selected implementation worktree. For platform code, `apps/platform/AGENTS.md` requires relevant installed `node_modules/next/dist/docs/` reading before edits.
3. Current repository `DECISIONS.md`, `ROADMAP.md`, `WORKLOG.md`, `docs/V1-COMPLETION-PROGRAM.md`, package scripts, CI and platform registry/hosting config. Read active records before relying on older sprint references.
4. Applicable `build-playable-web-games`, `github-workflow`, and, when actually doing assets, `blender-game-assets` instructions. Use the current available tools; do not assume a browser API or asset generator capability.

## Exact discovered locations

- Registered project: “aVOID Games”, ID `93e87ff7-593b-46bd-8557-858f50717584`, `C:\dev\aVOID`. Another registered label “aVOLVE Game” points to the same path; do not duplicate projects merely because of that label.
- Repository: https://github.com/Idea-R/aVOIDhub — public, default branch `main`, existing repository satisfies the user's repo requirement.
- Legacy checkout: `C:\dev\aVOID`, branch `codex/blender-rail-pilot`, HEAD `4653e58`, many existing modifications/deletions/untracked assets. **Never reset, clean, stage everything or release this old tree.**
- Modern reference checkout: `C:\dev\aVOID-main`; clean at `f7052f5`, branch `codex/fix-platform-repair-sprint-1`. [PR #61](https://github.com/Idea-R/aVOIDhub/pull/61) was confirmed open/unmerged on 2026-11-04. Do not switch or repurpose this pending branch.
- Locally recorded `origin/main=0e69577`; it was not fetched by the planning pass. Local branch `main=4653e58` is stale. Verify/fetch current remote main before making a new release branch.
- Existing isolation tree: `C:\dev\_worktrees\aVOID\`. Prefer a dedicated feature worktree here via the applicable Git workflow; first list and reuse an existing matching one if present.
- Site: https://avoidgame.io/ ; Netlify `coruscating-squirrel-a47ad9`, ID `780c1b04-64c7-47b6-9423-18953739590e`. Build root with Node 22/npm 10, publish Next platform `.next` using plugin. No current production deploy ID verified.
- REA notes: `C:\dev\IdeasRealized\docs\research\technology\rea-2026-10-19`; installed REA 6.7.0 in `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab\node_modules\rea-agents`. Use evidence discipline; no game binary exists in this investigation.

## First execution batch

1. Read status/worktree list, verify current remote main and existing Boomeranga branches, record all recovery refs. Select a dedicated feature branch/worktree without touching either existing checkout's work. Do not auto-merge PR #61. Import only necessary reviewed return-path code if the new auth integration needs it; record any overlap.
2. Copy this planning bundle to the implementation branch's `docs/boomerangavoid/`; keep one authoritative work record from then on. Register explicit worker ownership if delegating.
3. Establish four workspaces: `games/boomerang-avoid`, `packages/boomerangavoid-sim`, `packages/boomerangavoid-protocol`, `apps/boomerangavoid-server`. Use TypeScript/Vite/Three.js for the new renderer and Node/Colyseus for authoritative rooms. Verify current package/version compatibility before installing and pin the lockfile; do not upgrade unrelated games/platform.
4. Implement a pure fixed-step simulation with serialized state, seeded RNG, legal normalized inputs, collision/events, one map, weapon lifecycle and one complete round. Keep DOM, sockets, rendering and wall-clock out of the sim. Add meaningful rules tests.
5. Implement one finished-feeling local playable slice, then exercise that same simulation via a local two-client server early. Validate input, catch/recall/deflect, simultaneous hits, death, scores and reset before increasing content. Keep the representative art readable and record a real-input match.
6. In parallel, inspect existing Google provider/redirect configuration using authorized read-only access. Live login is email-only. Prepare the Google UI/callback integration and test plan without creating credentials or changing remote settings blindly.
7. Continue M2–M6, keeping completed checkpoints and remaining requirements explicit. The first arena is an integration checkpoint, not the user's final deliverable.

Proposed commands to **create and document** in the workspaces (these do not exist yet):

```text
npm run dev --workspace=@avoid/boomerang-avoid
npm run dev --workspace=@avoid/boomerangavoid-server
npm run test --workspace=@avoid/boomerangavoid-sim
npm run test --workspace=@avoid/boomerangavoid-protocol
npm run test --workspace=@avoid/boomerangavoid-server
npm run verify --workspace=@avoid/boomerang-avoid
npm run verify:boomerangavoid:release
```

Use available free localhost ports discovered at execution time and document exact client/server URLs. Background helpers launched on Windows must use hidden windows. Stop only processes the task owns.

## Build and integration boundaries

- Core simulation and protocol worker owns the two packages plus server; renderer/feel worker owns game render/input/audio; art worker owns `assets-src/boomerangavoid` and exported original models; platform worker owns a narrow auth/registry integration slice. Lead owns lockfile/root scripts and final merge. QA reviews after the slice exists and does not change worker source without coordination. Start only the workers actually useful for the current checkpoint.
- The game is one member of a larger product. Preserve current games, domains, account permissions, checkout/ad status and unrelated work. No runtime AI, commerce system, chat service or third-party analytics is required.
- Netlify is the frontend host; no existing persistent room server was found. Package and test a local server now, then prepare a concrete approved-host plan. Do not claim local tabs or Steam-style remote streaming are true internet multiplayer proof.
- Integrate catalog `apps/platform/src/data/games.ts`, explicit root game-build list, `apps/platform/scripts/prepare-games.mjs`, route rewrites/cache rules, metadata and CI. Catalog entry stays in development until release gates pass. Future detail `/games/boomerangavoid/`; future play `/boomerangavoid/`.
- Add Google to current `AuthForm.tsx` via the existing Supabase SSR client and PKCE callback; retain email. Use validated `next`, safe room tickets and minimal identity scopes. Never forward SSR cookies to another domain or put long-lived tokens in invites. Do not adopt legacy browser-auth services.
- Server decides hits, wins, seat ownership and final results. Clients send inputs only. Server-originated results must use trusted idempotent writes; local/bot matches cannot masquerade as ranked online wins. No production data migration or public test scores during development.

## Definition of done and reporting

Pass `VALIDATION-MATRIX.md`, including the real six-seat match, impaired networking, reconnect, original assets in motion, real target-device samples and Google callback/session canary. Run existing affected platform checks and the complete production assembly. Record commands, environment, revision, screenshots/video, JSON reports, known limitations and rollback.

When remote setup is needed, return an exact proposal: provider/account target, region/plan/cost, config keys (never secret values), hostname, deployment artifact, capacity evidence, review URL path, migration scope and rollback. Complete independent code and tests while that item is pending. No production release, new credential or broader persistent permission should be implied to have happened.

At each checkpoint report what changed, what was actually tested, how to play locally, what remains and the next executable step. Final V1 means the complete scope is playable and verified; if a service or hardware gate is unavailable, label the release candidate and name that precise blocker. Do not declare a polished multiplayer game complete from screenshots or a passing build alone.
