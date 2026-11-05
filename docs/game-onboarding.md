# Adding a game to aVOID

The catalog and hosted build pipeline have separate responsibilities. `apps/platform/src/data/games.ts` owns public presentation, availability and the score boundary. `apps/platform/game-build-manifest.json` owns hosted workspaces, build outputs, staged directories and friendly play routes. Both are checked together by `npm run test:catalog --workspace=@avoid/platform`. Adding a catalog entry does not implement ranked scoring or approve a release.

## Choose the boundary first

- A hosted game is built in this repository and copied into the platform's `public` folder. It has a manifest entry, even when its catalog status is `soon`.
- A subdomain or independent game keeps its own build, deployment, account, saves and score systems. Add its catalog entry with an HTTPS destination; do not add a build manifest entry or imply shared aVOID benefits.
- For a game that is not ready, use `status: "soon"`, omit `playHref`, and use `playRoute: null` if a review build is being staged. Do not add a friendly public route for it.

TankaVOID remains `soon`; its `TankaVOID` directory is assembled for release review and is not a promise of private access. Its public friendly route and Play action remain held by the existing release requirements. FLIPSIDE, Bloomfall, Acrolis and ttt3d retain their current account and score boundaries. RAILaVOID retains browser-local scoring.

## Add a hosted workspace when the game is ready

1. Add or finish the game's workspace under `games/`, with a unique `@avoid/<workspace>` package name and a deterministic `build` script. Do not copy another game's active worktree or import unrelated changes. Update and review the lockfile when workspace dependencies change.
2. Configure the Vite base URL to match the staged directory, including exact case and trailing slash. For a directory named `Example`, use `/Example/`. Emit to either `dist/Example` at repository root or `games/example/dist`. Keep output directories dedicated to generated game files.
3. Add one object to the manifest's `games` array. The following is a template, not an enabled game:

   ```json
   {
     "id": "example",
     "name": "Example",
     "workspace": "@avoid/example",
     "source": "dist/Example",
     "publicDirectory": "Example",
     "playRoute": "/example/"
   }
   ```

   IDs use lowercase slugs. Existing platform routes such as `login`, `account`, `teams`, `api` and `leaderboards` are reserved, including case-insensitive public-directory collisions. The public directory is one safe directory name; sources cannot contain traversal, backslashes, absolute paths or arbitrary repository folders. IDs, workspaces, sources, public directories and non-null play routes must be unique, ignoring case. Build output must contain a nonempty `index.html`. Source and target ancestors and trees cannot contain symlinks or directory junctions. The staging script validates every entry before replacing any target and preserves unrelated public files. Run staging only while game builds and the manifest are not being modified concurrently.

4. Add a complete `Game` object to `originalGames` in `games.ts`. Supply its canonical `/games/example/` detail route, `/games/example.webp` artwork, three complete highlights, at least three labeled facts, and at least two honest device-support notes. Supply the description, premise, availability and status copy used by the UI. A playable hosted game's `playHref` must match the manifest's `playRoute`; a coming-soon game omits it and uses a null manifest route. Keep the nine existing titles and their relative order. The verifier permits additional titles without editing a fixed title count.
5. Add the friendly route and asset-cache rules in root `netlify.toml` before the platform catch-all handling. For the example above:

   ```toml
   [[redirects]]
     from = "/example"
     to = "/Example/"
     status = 301

   [[redirects]]
     from = "/example/*"
     to = "/Example/:splat"
     status = 200

   [[headers]]
     for = "/Example/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   ```

   Use immutable caching only for content-hashed assets. Do not apply it to HTML, service workers or mutable data. Next's `public` folder serves the staged files; the manifest does not generate deployment rewrites. Test both the friendly path and the case-sensitive asset paths after deployment.

## Add an external listing

Add a complete `Game` object to the appropriate catalog group with `hosting: "independent"` or `"subdomain"`, an HTTPS `playHref`, an explicit handoff label, and `score.scope: "independent"` or `"none"`. Omit `score.gameKey`. Use status and availability copy that reflects the destination's actual release state. Do not add its workspace, output, redirects or account integration to this build pipeline. For a coming-soon listing, omit Play entirely.

## Score contract

Use `score.scope: "none"` for a new unranked game, or `"independent"` for browser-local or game-owned scores. Describe the real storage and account boundary in `score.headline` and `score.copy`. These choices require no platform score adapter.

Platform ranking is separate work. Before using `score.scope: "platform"` and a `gameKey` equal to the catalog ID, extend and review the score types, `apps/platform/src/lib/games/registry.ts`, start/finish API handling, evidence validators and any database game-key/ruleset allowlists. Follow `docs/sprint-shared-leaderboards-v1.md` and the existing shared contract packages. The server must own identity, game key, mode, ruleset, seed, one-use ticket, accepted score and receipt. Recompute the score or validate a bounded terminal result on the server; never accept browser-written leaderboard rows or a client-selected verification label.

Prove guest play still works without sign-in; verify valid, malformed, tampered, wrong-user, expired, retried and already-consumed submissions. Keep ranked-saving claims provisional and staged until database rehearsal and release requirements pass. Catalog registration alone provides no account migration, score verification or database capability.

## Verify and release

From repository root, with the existing lockfile dependencies installed:

```sh
node --test apps/platform/scripts/game-onboarding.node-test.mjs
npm run test:catalog --workspace=@avoid/platform
npm run typecheck --workspace=@avoid/platform
npm run test --workspace=@avoid/platform
npm run build:platform:netlify
```

`build:platform:games` reads the manifest and builds its workspaces sequentially, stopping at the first error. `prepare:platform:games` reads the same manifest and stages their outputs; no second hardcoded workspace list is needed. The production command then builds the Next platform. Use `npm run build:platform:preview` for the separate static preview path where needed.

Review the resulting diff, asset size and each game's own tests, budgets and release criteria. In an authorized deploy preview, verify the detail page, artwork, Play link, friendly URL with and without a trailing slash, HTML and all JS/CSS requests, correct MIME types, browser console, asset cache headers, and reloads. Exercise keyboard, pointer and physical touch devices that the listing claims to support. Test returning to the hub and any score/account handoff. Check that coming-soon games have no Play action or friendly redirect, and that external games still open their own domains.

Confirm the deployment's Next adapter, real redirects, cache behavior, cookie continuity and rollback to the previous deployment. Static preview success alone does not prove those production behaviors. Record any remaining database or physical-device checks before public availability changes.

BoomerangaVOID is not registered or copied by this change. When its separate implementation is ready and approved for integration, follow these steps using its actual workspace, build output and release evidence.
