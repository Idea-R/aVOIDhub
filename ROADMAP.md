# aVOIDgame.io delivery roadmap

Updated: 2026-08-17

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
- Architecture preparation for Supabase profiles/leaderboards and Stripe membership without prematurely shipping those systems.

### Out of scope for the first live milestone

- Rewriting the individual playable games.
- Finishing the TankaVOID game.
- Charging users, enabling AdSense placements, or accepting creator uploads.
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
- Production deploy, DNS changes, billing activation, ad activation, secrets, data migrations, and merges: explicit approval required at the action boundary.

## Milestones

1. **Baseline shell — complete.** Next.js foundation, honest catalog, desktop/mobile QA, and local commits.
2. **Visual direction — complete.** Researched six reference sites and generated six distinct desktop/mobile concept boards.
3. **Dependency modernization — complete.** Updated the platform to Next 16.3.1 and React 19.2.8; moved compatible workspaces to Vite 8.2.1 while retaining WORDaVOID on its verified Vite 7/plugin 4 line; removed unused vulnerable dependencies; reconstructed VOIDaVOID's manifest; and cleared the complete npm audit.
4. **Netlify preview — complete.** Linked the existing site, preserved the three bundled game routes, and deployed a Windows-safe draft export.
5. **Preview verification — complete.** The refined shell, bundled games, local artwork, related domains, canonical metadata, application icon and manifest, complete same-origin sitemap, responsive layout, semantic structure, Tanka state, cache policy, native motion, accessibility, Lighthouse performance, and Git-driven Netlify Linux build are verified.
6. **Production decision — gated.** Review the chosen visual direction and verified preview before switching production.

## Current next action

Review the verified release-candidate draft and approve or request changes before production rollout.
