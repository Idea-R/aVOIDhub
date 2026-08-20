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

The root Netlify configuration builds this app and stages the three supported Vite games into the Next.js output. Draft PR #1 is the release-candidate path; production remains on the preserved legacy deploy until rollout is explicitly approved.

## AdSense boundary

`NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` may contain a publisher identifier in the exact form `ca-pub-0000000000000000`. When it is valid, the platform emits Google's `google-adsense-account` verification meta tag.

The platform deliberately does not load the AdSense runtime yet. Before ad requests are enabled:

- confirm the correct AdSense account and publisher identifier;
- publish a matching root-domain `ads.txt` file;
- configure Google's certified consent flow for applicable regions;
- create named ad units and reserve their layout dimensions; and
- keep ad units out of active game, control, pause, and game-over surfaces.

## Platform runtime

The normal Next.js runtime now includes account, profile, leaderboard, creator-intake, and Stripe routes. The Windows `build:preview` static export remains a visual-review tool and cannot represent these server features.

Required deploy-context variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL`
- `STRIPE_RESTRICTED_KEY` (preferred; server only)
- `STRIPE_WEBHOOK_SECRET` (server only)
- `STRIPE_PLAYER_PRICE_ID`
- `STRIPE_CREATOR_PRICE_ID`
- `NEXT_PUBLIC_PLAYER_PRICE_LABEL`
- `NEXT_PUBLIC_CREATOR_PRICE_LABEL`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` (verification and `ads.txt` only)

No secret belongs in a `NEXT_PUBLIC_` variable. Use Stripe test mode and a Supabase development branch until the coordinated release checklist in `docs/platform-foundation.md` passes.
