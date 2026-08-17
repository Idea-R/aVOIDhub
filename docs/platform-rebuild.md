# aVOIDgame.io platform rebuild

Status: local foundation built and verified; production routing not changed.

## Architecture decision

Build a new Next.js platform shell beside the existing Vite hub. Keep every playable game as an independent build and route it through the platform domain or its existing subdomain.

This is safer than rewriting the games or replacing the current deployment in place. It also gives the platform server-rendered metadata, predictable first paint, server-side auth and billing options, and proper game detail pages without forcing those concerns into each game bundle.

## What the audit found

- The current hub is React 19, TypeScript, Vite 7, Tailwind 3, React Router, Framer Motion, Supabase, and a client-side Stripe helper. It is not Next.js.
- The root package requires Node 20.19 or newer, but both Netlify configurations still pin Node 18.
- The production home page says TankaVOID is available, but its play target is not deployed.
- VOIDaVOID, WreckaVOID, and WORDaVOID load from production paths.
- FLIPSIDE, Bloomfall, Acrolis Crawlers, and ttt3d.app are live on their named domains.
- The current home page presents unsupported aggregate counts and includes invalid leaderboard dates. The new shell does not repeat either claim.

## Product boundary

### aVOID originals

- VOIDaVOID
- WreckaVOID
- WORDaVOID
- FLIPSIDE
- TankaVOID — coming soon and non-interactive

### Other games by Ideas Realized

- Bloomfall
- Acrolis Crawlers
- Tic Tac Toe in 3D

These external games keep their own domains and do not promise shared aVOID leaderboards.

## Design direction

The shell carries forward the strongest patterns from the current Ideas Realized site: editorial type, asymmetric composition, a two-zone primary CTA, clear navigation, soft depth, careful mobile behavior, and restrained motion. It uses a more tactile arcade treatment rather than copying the studio site.

Motion starts with CSS and Framer Motion. Do not add Lenis, GSAP, and WebGL together. A single lightweight ambient hero effect can be considered after real-device performance testing and only if it respects reduced motion.

## Safe path to production

1. Build a deploy preview for `apps/platform` on Node 20.19 or newer.
2. Preserve the verified game destinations: `/voidavoid/`, `/wreckavoid/`, and `/wordavoid/`.
3. Decide whether those paths remain static deploy artifacts, separate Netlify sites behind rewrites, or game subdomains. Do not proxy blindly; game assets use path assumptions that must be tested.
4. Add first-party game detail pages and keep launch links separate from metadata routes.
5. Move Supabase auth to `@supabase/ssr` with explicit row-level security before adding profiles, favorites, or creator tools.
6. Add Stripe Checkout and portal endpoints only on the server. Do not ship secret material or authoritative subscription logic to the client.
7. Add consent-aware ad slots after legal pages, privacy controls, and layout-shift reservations exist. Keep ads out of active play surfaces.
8. Validate desktop, mobile, keyboard navigation, reduced motion, game launches, redirects, metadata, and Core Web Vitals in the deploy preview.
9. Switch production only after the preview passes; retain the old site as the immediate rollback target.

## Verification completed

- `npm run typecheck --workspace=@avoid/platform`
- `npm run build --workspace=@avoid/platform`
- Desktop visual review
- 390 × 844 mobile visual review
- Mobile menu open, close, and anchor navigation
- TankaVOID has no nested link or button
- Related games clearly identify their destination domains
- Browser console has no warnings or errors
