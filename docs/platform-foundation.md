# aVOID platform foundation

Updated: 2026-08-20

## What is implemented locally

- Passwordless Supabase sign-in with server-refreshed sessions.
- Editable player profiles with opt-in public pages and social links.
- Per-game leaderboards that show `legacy`, `provisional`, `validated`, or `verified` trust instead of conflating authentication with score verification.
- One-use, 20-minute run tickets and an atomic server-only score-finishing function.
- Founding player and creator membership definitions, Stripe Checkout, Customer Portal, signed webhook intake, idempotent event storage, and database-backed entitlements.
- Creator applications and an entitlement-gated private game-submission queue.
- A root `/ads.txt` response that stays 404 until an exact valid AdSense publisher ID is configured.

## Score trust model

| Level | Meaning |
| --- | --- |
| `legacy` | Imported from the old direct-write system; authenticity was not independently established. |
| `provisional` | Authenticated user plus a server-issued, one-use run ticket. The browser still supplies the score. |
| `validated` | Game-specific bounds and evidence were checked, but the full run was not reproduced. |
| `verified` | The platform independently recomputed or replay-validated the run. |

WORDaVOID is the first planned verified adapter because a future server-issued seed and event log can make the run deterministic. VOIDaVOID and WreckaVOID remain provisional until their randomness and physics can be replayed or validated. FLIPSIDE remains external and unranked until its source, separate Supabase project, profiles, cosmetics, and checkout state are reconciled.

## Coordinated database rollout

The migration at `supabase/migrations/20260820064235_avoid_platform_foundation.sql` deliberately revokes browser inserts and updates on `leaderboard_scores`. Do not apply it independently of the platform API and game-client adapters.

1. Create a Supabase development branch after its cost is confirmed.
2. Apply the migration to the branch and run the security/performance advisors.
3. Set branch credentials only in a Netlify deploy-preview context.
4. Test sign-in, profile edits, run start/finish/idempotency, creator application, Checkout test mode, webhook retry, entitlement grant/revocation, and paid-member no-ad-request behavior.
5. Deploy the platform and staged games together.
6. Apply the reviewed migration to production during the coordinated release window.
7. Keep the old production deploy and a forward-only compatibility migration ready for rollback.

## Stripe boundary

The MVP uses Stripe Billing, Checkout Sessions, and Customer Portal. It does not use Stripe Connect because the platform is not yet routing sales or revenue share to creators. Revisit Connect only when a concrete creator payout model is approved. Automatic Tax stays off until Ideas Realized confirms its registrations and tax settings.

## AdSense boundary

The platform currently performs verification only. It loads no AdSense runtime and requests no ads. When the exact publisher ID, site status, consent messages, and age-treatment decision are confirmed, the first canary is one manually placed responsive unit after the complete hosted-originals catalog. Paid users must receive neither that unit nor the AdSense runtime.

Standard AdSense display inventory never belongs in game canvases, HUDs, pauses, results, launch controls, leaderboards, profiles, checkout, or creator-review pages. In-world sky signs and billboards stay house art or separately sold direct sponsorship creative. H5 game ads are a later, application-only track.

