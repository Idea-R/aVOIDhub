# BoomerangaVOID platform audit

Read-only review, 2026-11-04. No production configuration, credentials, auth permissions, repository files, or deployments were changed. This report is the only file written.

## Decisive findings

1. **The named `C:\dev\aVOID` checkout is legacy and heavily dirty.** Branch `codex/blender-rail-pilot`, HEAD `4653e58`, remote `https://github.com/Idea-R/aVOIDhub.git`. Many existing modifications, deleted old game directories, and untracked game/docs/assets are present. Preserve them. Its `apps/game-hub` Google auth is not the current production login.
2. **Current platform source is available in `C:\dev\aVOID-main\apps\platform`.** That checkout is clean but on pending repair branch `codex/fix-platform-repair-sprint-1`, HEAD `f7052f5`, same remote. Locally recorded `origin/main` is `0e69577` (RailAVOID shared ammo/convoy guards, PR #63). Local branch `main` remains `4653e58`. No fetch was performed; remote freshness and deployed commit remain unverified.
3. **Verified live URL: https://avoidgame.io/**. The live login was directly inspected in Chrome at https://avoidgame.io/login on this date. It displays an enabled **Email my sign-in link** form and no Google sign-in action. No form was submitted. Root and https://avoidgame.io/railavoid/ were also retrieved through the web tool.
4. **Google login is a new integration task on the current platform.** Current platform and locally recorded origin/main both use Supabase email OTP/magic link, SSR cookies and PKCE code exchange. Google is absent from the current AuthForm and platform OAuth code. Existing legacy Google code must not be counted as working production Google login.
5. **Build the new game against the current monorepo/platform baseline, in an isolated new worktree after verifying/fetching origin/main.** Do not repurpose either dirty legacy checkout or pending repair branch. Integrate only reviewed repair changes if needed. The worktree itself was not created in this audit.

## Instructions and deployment evidence

- Read `C:\dev\AGENTS.md`: temporary-worktree rules are DM5dot5-specific; generic read-only audits should use the existing checkout. No nested AGENTS.md exists in the legacy aVOID source tree.
- Read `C:\dev\aVOID-main\apps\platform\AGENTS.md`: before writing platform code, read relevant installed Next documentation under `node_modules/next/dist/docs/`; this version has changed APIs. No code written here.
- `C:\dev\aVOID-main\netlify.toml`: `npm run build:platform:netlify`, publish `apps/platform/.next`, `@netlify/plugin-nextjs`, Node 22/npm 10. Specific legacy game redirects and asset caches coexist with the Next runtime.
- `C:\dev\aVOID-main\package.json`: workspace globs `packages/*`, `apps/*`, `games/*`; root engines Node >=20.19/npm >=10. Explicit game-build list precedes prepare-games and platform build.
- `C:\dev\aVOID-main\apps\platform\scripts\prepare-games.mjs`: safely copies each enumerated game's compiled bundle into platform `public`; adding a game requires adding its explicit source/target. Existing paths are VOIDaVOID, WreckaVOID, WORDaVOID, RAILaVOID and review-only TankaVOID.
- Site identity from local `.netlify/state.json` and `aVOID-main/docs/sprint-0-recoverability.md`: site `coruscating-squirrel-a47ad9`, ID `780c1b04-64c7-47b6-9423-18953739590e`, Netlify team `Idea/R`. Corresponding base hostname is `coruscating-squirrel-a47ad9.netlify.app`; custom live URL verified as above. Exact current Netlify deploy/branch mapping not queried.
- `aVOID-main/docs/sprints/platform-repair-1.md` identifies pending PR #61 and `https://deploy-preview-61--coruscating-squirrel-a47ad9.netlify.app/`; it explicitly says production was not changed by that sprint. Do not infer current deployed fixes from that branch.
- Legacy `C:\dev\aVOID\netlify.toml` is unsuitable as baseline: Node 18 conflicts with engines, build names include missing workspaces, and catch-all precedes game-specific rewrites. Legacy build-all-games.ps1 deletes dist and skips failed game builds. None was executed.

## Auth, configuration and integration contract

Current source paths under `C:\dev\aVOID-main`:

| Source | Finding |
| --- | --- |
| `apps/platform/src/components/AuthForm.tsx` | `signInWithOtp`; return URL `/auth/callback?next=...`; no Google action. Same finding at locally recorded origin/main. |
| `apps/platform/src/app/auth/callback/route.ts` | Exchanges `code` using `exchangeCodeForSession`; redirects to validated local next path; failure returns `/login/?error=link`. |
| `apps/platform/src/lib/supabase/client.ts` | `@supabase/ssr` browser client. |
| `apps/platform/src/lib/supabase/server.ts`, `src/proxy.ts` | Server cookie client and refresh through `getClaims`. |
| `apps/platform/src/lib/auth/request-user.ts` | Accepts verified cookie session, or verifies explicit bearer via Supabase `getUser`; never trusts arbitrary client user ID. |
| `apps/platform/src/lib/env.ts` | Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; server admin needs `SUPABASE_SECRET_KEY`; canonical redirect uses `NEXT_PUBLIC_SITE_URL`. |
| `apps/platform/src/lib/auth/return-path.ts` | Repair branch validates local paths and accepts legacy returnTo alias; origin/main version differs. Preserve local-only redirect validation and standardize on next. |
| `apps/platform/src/app/api/v1/player/route.ts` | Platform-owned player/entitlement endpoint; guest response supported. Profile ensured server-side; cosmetics currently wreckavoid/tankavoid. |
| `apps/platform/src/app/api/v1/runs/route.ts` | Authenticated run ticket creation, allowed-origin checks, server-generated entropy, ruleset registry and expiration. This is not an authoritative multiplayer room loop. |
| `apps/platform/src/lib/games/registry.ts` | Existing ranked-game registration requires explicit extension; avoid treating a new multiplayer game's browser-submitted result as authoritative. |

Config status: legacy aVOID root `.env` contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, debug/environment and per-game port keys. Values were not printed or copied. No root/platform `.env*` file was observed in the inspected aVOID-main locations. Remote deployed key presence, Google-provider enablement, Google client ID/secret, consent screen audience, redirect allowlists and Supabase schema/policies were **not** verified. An enabled live form only suggests public runtime configuration is present; it proves neither account sign-in nor server secret health.

Google implementation should use the existing platform SSR browser client with `signInWithOAuth({ provider: 'google', options: { redirectTo: platformCallbackWithSafeNext } })`, reuse PKCE callback and profile identity, and retain email login. Before claiming completion, verify provider setup and redirects on an isolated preview, then test consent cancellation/error, callback return to the game, refresh, logout, and existing-email identity behavior. Do not request unrelated Google scopes. Official source: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Cookie SSR design reference: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Potential current defects/risks from source inspection (not reproduced authenticated): AuthForm has no pending-submit guard or catch/finally for thrown network errors; callback's failure drops the original next destination; runtime-enabled check covers public keys but not server secret availability. Pending repair branch fixes some return-path/handoff behavior absent from recorded main. Legacy UnifiedAuthService duplicates clients and awaits database requests inside auth-state callbacks; it should not be adopted as the new adapter.

## Runtime boundary and sibling-game requirements

Current Next/Netlify server endpoints handle identity, profiles, run validation, creator workflow and Stripe requests. No persistent authoritative room server, Colyseus/PartyKit application, or deploy configuration for such a server was found in current platform source/workspace manifests. Netlify game assets plus Next request handlers are reusable; the active multiplayer room process is a new service responsibility.

Recommended boundary for parent plan: same-origin game client at a proposed `/boomerangavoid/`, platform login and `/api/v1/player`, new persistent multiplayer service with server-authoritative match results, and Supabase persistence through trusted server operations. For remote room entry, design short-lived audience-bound join authorization from the platform; do not forward raw SSR cookies or put durable credentials in URLs. Browser clients send inputs, never trusted final score/account/entitlement facts. Hosting vendor and final endpoint are unresolved design/deployment choices; do not claim any provisioned capacity.

Required integration touchpoints: new workspace/package and route; explicit build list and prepare-games entry; catalog `apps/platform/src/data/games.ts`; game registry/contract as applicable; redirects/cache rules; player/cosmetic entitlements only if supported; server-authoritative result persistence; isolated migration rehearsal; browser auth/return-path and gameplay/network acceptance evidence.

## Tests and limits

- `apps/platform/package.json`: Next 16.3.1 range, React 19.2.8 range, Supabase JS 2.112.3 and SSR 0.12.4; scripts typecheck, Vitest, catalog/styles/routes verification.
- `.github/workflows/tankavoid-release.yml`: Node 22, `npm ci --ignore-scripts`, `npm run verify:tankavoid:release`; trigger paths do not yet cover a Boomeranga game/server/contract, so extend or add dedicated CI.
- Existing `packages/voidavoid-contract`, `wordavoid-contract`, `tankavoid-contract` demonstrate shared validation contracts. Root `test:foundation` targets Supabase foundation verification.
- No builds, tests, email sends, login/consent completion, remote mutations, migrations, deploys, or persistent server launches were performed during this read-only planning audit.
- Public HTTP via sandbox PowerShell was blocked by network permissions; web tool could read root/game but not login. Chrome read-only navigation successfully verified login. This is a transport limitation, not evidence that login is down.
- The production code revision, actual remote provider settings, authenticated end-to-end login, schema readiness and persistent-server hosting remain explicit release prerequisites.
