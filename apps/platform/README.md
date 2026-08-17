# aVOID platform shell

This is the side-by-side Next.js rebuild of the aVOIDgame.io hub. It does not replace or rewrite the individual games.

## Run it

From the repository root:

```powershell
npm install
npm run workspace:platform
```

Production verification:

```powershell
npm run typecheck --workspace=@avoid/platform
npm run build:platform
```

## Catalog rules

- `playable`: hosted by aVOIDgame.io, including subdomains.
- `external`: another game by Ideas Realized with its own domain and no promise of shared leaderboards.
- `soon`: visible for discovery, but rendered without a link or button.

The catalog lives in `src/data/games.ts`. TankaVOID must remain `soon` until a verified playable deployment exists.

## Deployment boundary

The existing Netlify configuration still deploys the Vite hub and legacy game bundles. Do not point production at this app until the route-preservation work in `docs/platform-rebuild.md` is complete and a deploy preview has been reviewed.
