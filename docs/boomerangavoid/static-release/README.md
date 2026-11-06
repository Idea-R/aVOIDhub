# BoomerangaVOID local-play preview

This release serves the frozen game candidate
`c9866d5fd370f348702da6cbae499b8f9adbdefc` at `/boomerangavoid/`.
Practice and two-to-six-seat Couch Party run on one device without login.
Online rooms, Google sign-in integration, account sync and shared results are
unavailable in this build. Browser-supported controllers and touch controls are
included; physical-device compatibility and low-end performance need further
testing.

## Source and artifact

`game-candidate.json` records the original archive SHA-256 hashes, 124 exact
browser-workspace source hashes, 21 artifact files and two supporting fixtures.
The bot fixture retains the original deterministic scenario, rather than the
authoring session's browser outcome. The art manifest omits machine-specific
reference paths. Their original and derived hashes are recorded.

The default game build explicitly uses Vite `local-release` mode. This scope
ignores inherited room URLs and invitation parameters, hides online entry and
skips account refresh and synchronization. Development studio hooks are absent
from the production entry point. No room service, signing secret, API endpoint,
Supabase change or environment variable is added by this launch.

```sh
npm ci --ignore-scripts
npm run verify:tankavoid:release
npm run typecheck --workspace=@avoid/boomerangavoid-sim --workspace=@avoid/boomerangavoid-protocol --workspace=@avoid/boomerang-avoid
npm test --workspace=@avoid/boomerangavoid-sim --workspace=@avoid/boomerangavoid-protocol --workspace=@avoid/boomerang-avoid
node --test tools/verify-boomerang-static-boundary.node-test.mjs
node tools/verify-boomerangavoid-static-site.mjs --staged
```

The release verifier builds all six site games and the Next platform. The static
verifier fails on changed source or compiled runtime bytes. Its sole artifact
normalization allowance is CRLF/LF in `ORIGINAL-ASSET-PROVENANCE.md`, checked
against the frozen text hash. Git attributes preserve imported source bytes
across Windows and Linux checkouts.

## Site boundary

Netlify rewrites the lowercase public path to physical
`apps/platform/public/BoomerangaVOID/`. Only hashed `assets/*` receives immutable
caching; HTML and unversioned models retain normal revalidation. The new route,
its assets and its static information page bypass session-refresh middleware.
Existing private paths retain their previous matcher behavior.

The homepage adds one explicitly labeled local-preview link. The game catalog,
existing game source, auth handlers, account APIs and database schema remain
unchanged. The separate auth/team and online-game branches are not merged.

The production dependency patch updates Next to 16.4.5 and Zod to 4.6.7, removes
WORDaVOID's unused Zod dependency, and includes their patched transitive
dependencies. The final production audit on November 6, 2026 reported zero
critical, high or moderate issues and four existing low-severity findings in the
Resend dependency chain. The game retains its frozen runtime dependencies.

## Publication and rollback

The existing Netlify site is `coruscating-squirrel-a47ad9`
(`780c1b04-64c7-47b6-9423-18953739590e`), serving `avoidgame.io` from `main`.
Use its PR preview and verify routing, MIME types, cache headers, asset hashes,
local gameplay, truthful availability and existing site behavior before merging.
No provider resource, credential or settings change is required.

The independently verified pre-launch rollback deploy is
`6a9cdccc91ff570008363f2f`, source
`0e69577536f5de173d57f12725cc08ba98333f95`. Recheck the currently published
deployment immediately before launch. Publishing a previous successful Netlify
deploy restores its atomic artifact; a source revert is also needed to prevent
a subsequent automatic `main` deployment from replacing the rollback.

The retained original game artifact ZIP SHA-256 is
`c26497483d985a6a2d341a29ea9c49b52d428aee918318639774865074f980a3`.
Publication, hosted verification and deployment identifiers are recorded in the
release task and pull request after those actions actually succeed.
