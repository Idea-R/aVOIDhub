# aVOIDgame.io delivery roadmap

Updated: 2026-08-20

## Charter

### Outcome

Ship a production-ready rebuild of aVOIDgame.io that presents the verified catalog honestly, preserves every playable route, gives related Ideas Realized games a clear home, and creates a safe foundation for profiles, leaderboards, creator hosting, subscriptions, cosmetics, and tactful advertising.

### Success measures

- The new Next.js shell deploys successfully through a Netlify draft preview.
- `/voidavoid/`, `/wreckavoid/`, `/wordavoid/`, and `flipside.avoidgame.io` remain playable.
- TankaVOID is visibly coming soon and never launches a broken route.
- Bloomfall, Acrolis Crawlers, and ttt3d.app are credited as other games by Ideas Realized without promising shared leaderboards.
- Desktop and mobile layouts pass visual, keyboard, reduced-motion, console, and basic performance checks.
- Dependencies are current enough for a supportable production baseline, with breaking upgrades isolated and recorded.
- Production is switched only after the preview and rollback path are verified.

### In scope

- Next.js platform shell, catalog, navigation, metadata, design system, and responsive behavior.
- Visual research and six reviewable high-fidelity design directions.
- Dependency audit and safe upgrades for the new platform app.
- Netlify configuration, draft deploy, route-preservation QA, and production handoff.
- Supabase profiles, trust-labeled leaderboards, Stripe membership entitlements, creator intake, and their server-side security boundaries.

### Out of scope for the first live milestone

- Rewriting the individual playable games.
- Finishing the TankaVOID game.
- Activating real charges, live AdSense requests, creator payouts, or unreviewed public uploads.
- Migrating production data or changing DNS before preview approval.

### Source of truth

- Repository worktree: `C:\dev\aVOID-next`
- Branch: `codex/feature-next-platform-shell`
- Draft PR: `https://github.com/Idea-R/aVOIDhub/pull/1`
- Git-driven preview: `https://deploy-preview-1--coruscating-squirrel-a47ad9.netlify.app`
- Platform app: `apps/platform`
- Production site: `https://avoidgame.io`

### Authority and gates

- Local research, implementation, tests, commits, dependency updates, and preview artifacts: proceed.
- Netlify draft deploy: authorized by the current project charter.
- Production deploy and merge of this reviewed candidate: approved on 2026-08-20. DNS changes, billing activation, ad activation, secrets, and data migrations remain separately gated.

## Milestones

1. **Baseline shell — complete.** Next.js foundation, honest catalog, desktop/mobile QA, and local commits.
2. **Visual direction — complete.** Researched six reference sites and generated six distinct desktop/mobile concept boards.
3. **Dependency modernization — complete.** Updated the platform to Next 16.3.1 and React 19.2.8; moved compatible workspaces to Vite 8.2.1 while retaining WORDaVOID on its verified Vite 7/plugin 4 line; removed unused vulnerable dependencies; reconstructed VOIDaVOID's manifest; and cleared the complete npm audit.
4. **Netlify preview — complete.** Linked the existing site, preserved the three bundled game routes, and deployed a Windows-safe draft export.
5. **Preview verification — complete.** The refined shell, bundled games, local artwork, related domains, canonical metadata, application icon and manifest, complete same-origin sitemap, responsive layout, semantic structure, Tanka state, cache policy, native motion, accessibility, Lighthouse performance, and Git-driven Netlify Linux build are verified.
6. **Production rollout — approved and in progress.** Push the reviewed candidate through a fresh Git-driven preview, preserve the rollback deploy, then verify the production switch route by route.
7. **AdSense readiness — local foundation complete.** Truthful privacy and terms surfaces, domain-level verification support, consent and `ads.txt` gates, and directory-only placement rules are documented without activating ad requests. The correct account and publisher identifier remain external inputs.
8. **Live-capture interaction refresh — preview complete.** Replaced the three external-game placeholders with direct first-party captures, added a restrained generated atmosphere layer, and gave cards and primary controls legible hover, press, focus, touch, and reduced-motion behavior.
9. **Meteor identity and social presence — preview complete.** Established a proposed meteor mark rooted in the original aVOID game artwork, integrated it across platform identity surfaces, and adapted the Ideas Realized social rail into an aVOID-specific signal dock with a mobile footer fallback.
10. **Platform foundation — local implementation complete.** Added passwordless accounts, editable public profiles, creator intake, private game submissions, trust-labeled leaderboards, one-use run tickets, Stripe Checkout/Portal/webhooks, and entitlement state. Updated WORDaVOID and WreckaVOID to stop direct score inserts; VOIDaVOID score carryover now fails closed until its full adapter exists.
11. **Security migration — review gated.** The incremental migration closes the public score-write hole and adds RLS-protected platform tables, but must be tested on a Supabase development branch and deployed in lockstep with the platform and game adapters.
12. **Monetization activation — account gated.** Confirm Stripe products/prices and test webhook behavior; confirm the exact AdSense publisher ID, site status, CMP, and age treatment before any real charge or ad request.

## Current next action

Commit and push the approved shell, verify a fresh Git-driven preview, and publish production without activating database, Stripe, or AdSense behavior. The coordinated migration and test-mode account flows remain the next gated platform milestone.
