# WreckaVOID + TankaVOID shared identity and cosmetic slice

Date: 2026-08-23

## Outcome

The first two launch games now consume one platform-owned player context. WreckaVOID no longer ships its stale password, Google OAuth, direct Supabase profile, or direct leaderboard UI. Both games read the same cookie-backed platform session, expose an honest guest state, and offer one free look plus one Founding Player look backed by the existing `cosmetics.supporter` entitlement.

Cosmetics are deliberately render-only:

- WreckaVOID `Founder ember` changes the player, chain, links, glow, and wrecking ball palette.
- TankaVOID `Founder meteor` changes player armor, trim, armor guide, and player shell color.
- Neither selection changes simulation input, health, damage, movement, scoring, run evidence, or leaderboard trust.
- Locked selections cannot be stored through the UI. A previously stored member selection falls back to the standard look when the current player context does not return the entitlement.

## Platform contract

`GET /api/v1/player` returns only server-derived identity and active entitlement state. Guest and runtime-disconnected responses are explicit. Authenticated responses ensure the owned profile, read active `user_entitlements`, and derive per-game cosmetic unlocks on the server.

The games call this same-origin route with the platform cookie. WreckaVOID run start and finish also use the cookie-backed platform endpoints, eliminating its competing browser-local Supabase session. TankaVOID already used the platform run endpoints and now shares the same player/cosmetic read path.

## Verification completed

- Platform cosmetic tests: free looks remain free; supporter looks remain locked without and unlocked with `cosmetics.supporter`.
- Platform suite: 30 tests and TypeScript pass.
- Foundation migration verifier: 52 assertions pass.
- WreckaVOID: 37 tests, TypeScript, zero-warning lint, production build, and 111,494-byte initial-transfer budget pass. Removing the legacy Supabase surface reduced the previous 168,839-byte transfer result by 57,345 bytes.
- TankaVOID: 44 tests, TypeScript, zero-warning lint, production build, and 68,403-byte initial-transfer budget pass.
- Complete four-game, 30-route Netlify-shaped platform assembly passes.
- Local browser checks pass at 1440 × 900, 390 × 844, and 844 × 390 with no horizontal overflow.
- WreckaVOID launches cleanly on the phone layout with the shared sign-in and leaderboard routes.
- TankaVOID briefing, desktop controls, touch deployment, and active dual-stick combat render cleanly; warning/error console is empty.

## Remaining activation gates

Source behavior is complete, but real member unlock and public score persistence still require the coordinated backend canary:

1. Create the approved short-lived Supabase development branch and run the migration/data/RLS/concurrency matrix.
2. Configure the preview runtime with isolated Supabase server credentials and prove magic-link session continuity through both games.
3. Create Stripe test-mode products/prices, complete Checkout and webhook reconciliation, and prove `cosmetics.supporter` appears and disappears with subscription state.
4. Prove Wreck and Tank accepted results, personal bests, profile links, and ruleset-specific boards against synthetic users.
5. Run Git-driven preview desktop/phone checks, physical iOS/Android controls for Tank, and rollback rehearsal.
6. Merge and promote only after the canary passes. No production schema write, live charge, or AdSense request is part of this slice.
