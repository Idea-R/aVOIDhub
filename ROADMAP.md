# aVOIDgame.io delivery roadmap

Updated: 2026-08-20

## Charter

### Outcome

Move the live aVOIDgame.io rebuild through the phased V1 completion program: secure identity/data, first-party game detail pages, honest competition, and a separate acceptance gate for each hosted game.

### Success measures

- The new Next.js shell deploys successfully through a Netlify draft preview.
- `/voidavoid/`, `/wreckavoid/`, `/wordavoid/`, and `flipside.avoidgame.io` remain playable.
- TankaVOID is visibly coming soon and never launches a broken route.
- Bloomfall, Acrolis Crawlers, and ttt3d.app are credited as other games by Ideas Realized without promising shared leaderboards.
- Desktop and mobile layouts pass visual, keyboard, reduced-motion, console, and basic performance checks.
- Dependencies are current enough for a supportable production baseline, with breaking upgrades isolated and recorded.
- Production is switched only after the preview and rollback path are verified.
- The main platform and each game reach the V1 gates defined in `docs/V1-COMPLETION-PROGRAM.md`.

### In scope

- Next.js platform shell, catalog, navigation, metadata, design system, and responsive behavior.
- Visual research and six reviewable high-fidelity design directions.
- Dependency audit and safe upgrades for the new platform app.
- Netlify configuration, draft deploy, route-preservation QA, and production handoff.
- Supabase profiles, trust-labeled leaderboards, Stripe membership entitlements, creator intake, and their server-side security boundaries.
- Phased repair and platform integration for WreckaVOID, WORDaVOID, and VOIDaVOID.
- A deliberately narrow TankaVOID rebuild and an explicit FLIPSIDE ownership/integration decision.

### Out of scope for the completed shell milestone

- Rewriting the individual playable games.
- Finishing the TankaVOID game.
- Activating real charges, live AdSense requests, creator payouts, or unreviewed public uploads.
- Migrating production data or changing DNS before preview approval.

### Source of truth

- Repository worktree: `C:\dev\aVOID-next`
- Active documentation branch: `codex/docs-v1-completion-program`
- Active Sprint 0 branch: `security/sprint-0-recoverability`
- Active Sprint 1 branch: `security/platform-foundation-v1`
- Active Sprint 1 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/4`
- Active game-repair branch: `codex/fix-wreckavoid-v1-baseline`
- Active game-repair issue: `https://github.com/Idea-R/aVOIDhub/issues/6`
- Active game-repair draft PR: `https://github.com/Idea-R/aVOIDhub/pull/7`
- Active WreckaVOID W2 branch: `codex/fix-wreckavoid-w2-responsive`
- Active WreckaVOID W2 issue: `https://github.com/Idea-R/aVOIDhub/issues/8`
- Active WreckaVOID W2 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/9`
- Active WreckaVOID W5 branch: `codex/fix-wreckavoid-w5-hardening`
- Active WreckaVOID W5 issue: `https://github.com/Idea-R/aVOIDhub/issues/10`
- Active WreckaVOID W5 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/11`
- WreckaVOID W5 evidence: `docs/sprint-wreckavoid-w5.md`
- Active WORDaVOID WD0 branch: `codex/fix-wordavoid-wd0-baseline`
- Active WORDaVOID WD0 issue: `https://github.com/Idea-R/aVOIDhub/issues/12`
- Active WORDaVOID WD0 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/13`
- WORDaVOID WD0 contract: `docs/wordavoid-v1-contract.md`
- WORDaVOID WD0 evidence: `docs/sprint-wordavoid-wd0.md`
- Active WORDaVOID WD1 branch: `codex/fix-wordavoid-wd1-validation`
- Active WORDaVOID WD1 issue: `https://github.com/Idea-R/aVOIDhub/issues/14`
- Active WORDaVOID WD1 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/15`
- WORDaVOID WD1 validation contract: `docs/wordavoid-validation-contract.md`
- WORDaVOID WD1 evidence: `docs/sprint-wordavoid-wd1.md`
- Active WORDaVOID WD3 branch: `codex/fix-wordavoid-wd3-experience`
- Active WORDaVOID WD3 issue: `https://github.com/Idea-R/aVOIDhub/issues/16`
- Active WORDaVOID WD3 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/17`
- WORDaVOID WD3 evidence: `docs/sprint-wordavoid-wd3.md`
- Active VOIDaVOID V0/V1 branch: `codex/fix-voidavoid-v0-v1-baseline`
- Active VOIDaVOID V0/V1 issue: `https://github.com/Idea-R/aVOIDhub/issues/18`
- VOIDaVOID V0/V1 contract: `docs/voidavoid-v0-v1-contract.md`
- VOIDaVOID V0/V1 evidence: `docs/sprint-voidavoid-v0-v1.md`
- Active VOIDaVOID V2 branch: `codex/fix-voidavoid-v2-evidence`
- Active VOIDaVOID V2 issue: `https://github.com/Idea-R/aVOIDhub/issues/20`
- Active VOIDaVOID V2 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/21`
- VOIDaVOID V2 contract: `docs/voidavoid-v2-evidence-contract.md`
- VOIDaVOID V2 evidence: `docs/sprint-voidavoid-v2.md`
- Active VOIDaVOID V4 branch: `codex/fix-voidavoid-v4-hardening`
- Active VOIDaVOID V4 issue: `https://github.com/Idea-R/aVOIDhub/issues/22`
- Active VOIDaVOID V4 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/23`
- VOIDaVOID V4 contract: `docs/voidavoid-v4-experience-contract.md`
- VOIDaVOID V4 evidence: `docs/sprint-voidavoid-v4.md`
- Active TankaVOID T0/T1 branch: `codex/tankavoid-t0-t1-foundation`
- Active TankaVOID T0/T1 issue: `https://github.com/Idea-R/aVOIDhub/issues/24`
- Active TankaVOID T0/T1 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/25`
- TankaVOID V1 contract: `docs/tankavoid-v1-contract.md`
- TankaVOID T0/T1 evidence: `docs/sprint-tankavoid-t0-t1.md`
- Active TankaVOID T2 branch: `codex/tankavoid-t2-directional-combat`
- Active TankaVOID T2 issue: `https://github.com/Idea-R/aVOIDhub/issues/26`
- Active TankaVOID T2 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/27`
- TankaVOID T2 evidence: `docs/sprint-tankavoid-t2.md`
- Active TankaVOID T3 branch: `codex/tankavoid-t3-encounter-loop`
- Active TankaVOID T3 issue: `https://github.com/Idea-R/aVOIDhub/issues/28`
- Active TankaVOID T3 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/29`
- TankaVOID T3 evidence: `docs/sprint-tankavoid-t3.md`
- Active TankaVOID T4 branch: `codex/tankavoid-t4-controls-feedback`
- Active TankaVOID T4 issue: `https://github.com/Idea-R/aVOIDhub/issues/30`
- Active TankaVOID T4 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/31`
- TankaVOID T4 evidence: `docs/sprint-tankavoid-t4.md`
- Active TankaVOID T5 branch: `codex/tankavoid-t5-content-run`
- Active TankaVOID T5 issue: `https://github.com/Idea-R/aVOIDhub/issues/32`
- Active TankaVOID T5 draft PR: `https://github.com/Idea-R/aVOIDhub/pull/33`
- TankaVOID T5 evidence: `docs/sprint-tankavoid-t5.md`
- Active TankaVOID T6 branch: `codex/tankavoid-t6-platform-integration`
- Active TankaVOID T6 issue: `https://github.com/Idea-R/aVOIDhub/issues/34`
- TankaVOID T6 evidence: `docs/sprint-tankavoid-t6.md`
- WreckaVOID W2 evidence: `docs/sprint-wreckavoid-w2.md`
- WreckaVOID W0/W1 evidence: `docs/sprint-wreckavoid-w0-w1.md`
- Program source of truth: `docs/V1-COMPLETION-PROGRAM.md`
- Sprint 0 evidence: `docs/sprint-0-recoverability.md`
- Merged shell PR: `https://github.com/Idea-R/aVOIDhub/pull/1`
- Git-driven preview: `https://deploy-preview-1--coruscating-squirrel-a47ad9.netlify.app`
- Platform app: `apps/platform`
- Production site: `https://avoidgame.io`

### Authority and gates

- Local research, implementation, tests, commits, dependency updates, and preview artifacts: proceed.
- Netlify draft deploy: authorized by the current project charter.
- The initial shell production rollout completed on 2026-08-20. Later production merges/deploys, DNS changes, billing activation, ad activation, secrets, paid resources, and data migrations remain gated by their sprint acceptance evidence and explicit approval.

## Milestones

1. **Baseline shell — complete.** Next.js foundation, honest catalog, desktop/mobile QA, and local commits.
2. **Visual direction — complete.** Researched six reference sites and generated six distinct desktop/mobile concept boards.
3. **Dependency modernization — complete.** Updated the platform to Next 16.3.1 and React 19.2.8; moved compatible workspaces to Vite 8.2.1 while retaining WORDaVOID on its verified Vite 7/plugin 4 line; removed unused vulnerable dependencies; reconstructed VOIDaVOID's manifest; and cleared the complete npm audit.
4. **Netlify preview — complete.** Linked the existing site, preserved the three bundled game routes, and deployed a Windows-safe draft export.
5. **Preview verification — complete.** The refined shell, bundled games, local artwork, related domains, canonical metadata, application icon and manifest, complete same-origin sitemap, responsive layout, semantic structure, Tanka state, cache policy, native motion, accessibility, Lighthouse performance, and Git-driven Netlify Linux build are verified.
6. **Production rollout — complete.** PR #1 merged at `7cd9788`; production deploy `6a86af420792ac00081b14a3` and the shell/game/legal routes were verified.
7. **AdSense readiness — local foundation complete.** Truthful privacy and terms surfaces, domain-level verification support, consent and `ads.txt` gates, and directory-only placement rules are documented without activating ad requests. The correct account and publisher identifier remain external inputs.
8. **Live-capture interaction refresh — preview complete.** Replaced the three external-game placeholders with direct first-party captures, added a restrained generated atmosphere layer, and gave cards and primary controls legible hover, press, focus, touch, and reduced-motion behavior.
9. **Meteor identity and social presence — preview complete.** Established a proposed meteor mark rooted in the original aVOID game artwork, integrated it across platform identity surfaces, and adapted the Ideas Realized social rail into an aVOID-specific signal dock with a mobile footer fallback.
10. **Platform foundation — local implementation complete.** Added passwordless accounts, editable public profiles, creator intake, private game submissions, trust-labeled leaderboards, one-use run tickets, Stripe Checkout/Portal/webhooks, and entitlement state. Updated WORDaVOID and WreckaVOID to stop direct score inserts; VOIDaVOID score carryover now fails closed until its full adapter exists.
11. **Security migration — review gated.** The incremental migration closes the public score-write hole and adds RLS-protected platform tables, but must be tested on a Supabase development branch and deployed in lockstep with the platform and game adapters.
12. **Monetization activation — account gated.** Confirm Stripe products/prices and test webhook behavior; confirm the exact AdSense publisher ID, site status, CMP, and age treatment before any real charge or ad request.
13. **V1 completion program — documentation complete and under review.** The detailed per-platform and per-title program, sprint sequence, effort ranges, dependencies, and acceptance gates live in `docs/V1-COMPLETION-PROGRAM.md` and draft PR #2.
14. **Sprint 0 recoverability packet — complete; branch approval pending.** The live schema, grants, policies, functions, advisors, migration drift, auth/score consumers, environment ownership, rollback targets, branch cost, and legacy-data mapping are frozen in `docs/sprint-0-recoverability.md`. No production state changed.
15. **Sprint 1 isolated foundation repair — local gate complete; paid branch pending.** The forward migration now denies browser writes by default, makes profile publication explicit, preserves legacy scores without trusting their old verified flag, removes browser-era score triggers, adds ruleset/FK integrity, and ships 50 pgTAP assertions plus a static verifier. Create the 72-hour Supabase development branch only after cost approval, then run the documented data/API/advisor matrix against synthetic fixtures.
16. **P3 game details — source complete; review pending.** Eight static `/games/[slug]/` detail pages, honest internal/external Play boundaries, and responsive staged leaderboard states are published in draft PR #5 without activating dormant platform data.
17. **WreckaVOID W0/W1 repair — local gates complete.** The canonical game now passes standalone typecheck, lint, 14 focused tests, and production build. The collision crash, doubled enemy movement, unstable variable-step loop, skipped terminal finish, desktop-only input, mobile pointer start, and narrow HUD controls are repaired. Forty deterministic terminal/restart browser cycles held one RAF owner, one input owner, zero deferred timers, and one finish per run; the measured final 20-cycle heap sample decreased by about 1.5 MB.
18. **WreckaVOID W2 responsive play — local gates complete.** Rendered-canvas viewport ownership, orientation-safe pointer bounds, a 320 × 320 support guard, reason-aware manual/help/focus pauses, touch controls, first-run coaching, persisted procedural audio, reduced-motion particle suppression, and a compact phone result screen pass 19 tests plus the desktop/portrait/landscape browser matrix. A post-change 20-restart smoke retained one RAF and one input owner.
19. **WreckaVOID W5 hardening — local gates complete.** The active logo dropped from 1.50 MB to 31.85 KB, an enforceable 200 KiB transfer budget passes at 168.4 KB, game-clock React presentation and particles are bounded, service-unconfigured guest play is quiet, and semantic single-owner dialogs/focus/viewport pauses pass 31 tests. Desktop/phone/landscape browser checks, a 40-cycle restart sample, and mobile Lighthouse at 98 performance / 100 accessibility / 100 best practices / 100 SEO are recorded in `docs/sprint-wreckavoid-w5.md`. No deploy occurred.
20. **WORDaVOID WD0 baseline — local gates complete.** Classic and two-minute Time Attack are the two source-enforced V1 modes; six duplicate/partial experiments are visible but unranked and non-launchable. The score formula is pure, accuracy has no 60% floor, maximum streak survives misses, restart preserves the selected mode, stale build artifacts are removed, and the menu passes four viewports with no horizontal overflow. Typecheck, zero-warning lint, 9 tests, production build, and full platform assembly pass; evidence is in `docs/sprint-wordavoid-wd0.md`.
21. **WORDaVOID WD1 validation — source gate complete; database execution pending.** The game and platform share a frozen 1,770-word dictionary/hash, deterministic seed/sequence generator, normalization, scoring, and bounded evidence validator. The runtime emits pause-aware evidence, the server recomputes every accepted aggregate, and the prepared service-only transaction returns the same receipt on valid retries. Contract/game/platform tests, zero-warning lint, production builds, full platform assembly, and narrow/desktop browser smoke pass. The isolated Supabase branch must still prove SQL, concurrency, expiry, wrong-user, and read-back behavior before activation; evidence is in `docs/sprint-wordavoid-wd1.md`.
22. **WORDaVOID WD3 experience hardening — local gates complete.** The owned typing surface, composable pause/focus lifecycle, rendered-arena viewport, reduced-motion/audio behavior, versioned local progress, explicit failure states, share fallback, and guarded repeat-run transitions pass 33 tests, standalone/full-platform builds, responsive browser QA, and a 20-cycle restart soak. Physical iOS/Android and production deploy/rollback evidence remain WD4 release gates; evidence is in `docs/sprint-wordavoid-wd3.md`.
23. **VOIDaVOID V0/V1 baseline and lifecycle — local gates complete.** The actual scoring/difficulty/randomness contract was frozen as local/unranked; the canonical 51-file graph established one fixed-step loop, one Pointer Events path, one responsive resize manager, composed pause reasons, exact teardown, and honest local results. Typecheck, zero-warning lint, 9 tests, standalone/full-platform builds, desktop/portrait/landscape QA, and 30 finish/restart cycles passed; evidence is in `docs/sprint-voidavoid-v0-v1.md`.
24. **VOIDaVOID V2 deterministic evidence — local gates complete.** One run seed now derives independent world, power-up, chain, score, and defense streams; all gameplay timers use the fixed simulation clock; and bounded ordered score events replay the final breakdown or fail closed. The 57-file canonical graph passes zero-warning lint, 22 tests, standalone/full-platform builds, three responsive browser sizes, and 20 consecutive replayable-local result cycles. Server-issued tickets, pointer/physics validation, receipts, and ranked placement remain V3; evidence is in `docs/sprint-voidavoid-v2.md`.
25. **VOIDaVOID V4 experience hardening — local gates complete.** Local gesture-only audio, persisted sound/motion choices, OS-aware reduced motion, focus-owned dialogs, bounded particles, corrected frame sampling, and an 83,328-byte initial-transfer gate pass 30 tests and five browser sizes. A 20-cycle sample retains one audio context, five pointer listeners, zero terminal voices/frames, and a decreasing raw heap measurement. Physical iOS/Android, deployed audit, production smoke, and rollback evidence remain release gates; evidence is in `docs/sprint-voidavoid-v4.md`.
26. **TankaVOID T0/T1 recovery and runtime foundation — local gates complete; review pending.** The 78-error monorepo generation and the 24-entry dirty standalone prototype are preserved and inventoried. One seeded fixed-step simulation, input owner, resize owner, logical viewport, and explicit drill lifecycle now pass zero-warning type/lint, 10 tests, a 54,130-byte initial-transfer gate, six briefing viewports, five running viewports, and a 20-cycle browser soak with one canvas, eight listeners, one observer, and no terminal frame. The two-commit boundary is published in draft PR #25. TankaVOID remains Coming Soon; T2 directional combat is next.
27. **TankaVOID T2 directional combat — local gates complete; review pending.** Impact-point face selection, shell incidence, fixed front/side/rear multipliers, a 32-shell pool, swept oriented collision, one bruiser, readable outcomes, automatic disable/results, and a queued trigger boundary pass zero-warning type/lint, 21 tests, and a 57,331-byte initial-transfer gate. A real six-shot browser win, a natural player-disable result, six briefing sizes, five running sizes, pause focus, and a 20-cycle ownership soak passed without overflow or runtime growth. The two-commit boundary is published in draft PR #27. TankaVOID remains Coming Soon; T3 encounter-loop work is next.
28. **TankaVOID T3 encounter loop — local gates complete; review pending.** Four tactical barricades, swept cover strikes, tank/cover and tank/tank separation, line-of-sight-aware bruiser routing, a three-second deployment, 1.5-second result hold, bounded histories, and explicit enemy/cover/projectile/particle/draw/frame ceilings pass zero-warning type/lint, 28 tests, the full platform build, and a 59,208-byte initial-transfer gate. Six responsive sizes, pause/focus, a repaired short-screen result dialog, and ten actual pointer-driven six-hit wins passed with one canvas, eight listeners, one observer, zero terminal frame, and no runtime growth. TankaVOID remains Coming Soon; T4 device/control work is next.
29. **TankaVOID T4 controls and feedback — local gates complete; physical-device review pending.** A unified input owner now supports deliberate left-drive/right-aim-release touch controls, while gesture-owned procedural audio, persisted sound/motion choices, mandatory system reduced motion, first-run coaching, and responsive settings preserve the deterministic encounter. Zero-warning type/lint, 33 tests, the full 21-route platform build, and a 62,857-byte transfer gate pass. Seven briefing sizes, six active sizes, five six-shot touch-path wins, pause/focus, one audio context, 12 listeners, zero terminal frames/voices, and a quiet browser log pass. Touch remains a release candidate until physical iOS/Android evidence; TankaVOID remains Coming Soon and T5 content is next.
30. **TankaVOID T5 five-wave content run — local gates complete; review pending.** A static five-wave roster now deploys scout, bruiser, hunter, and commander behaviors as nine bounded hostiles, with tick-owned pacing, field repair, multi-target swept collision, distinct rendering/audio cues, and six honest local result metrics. Fast and deliberate two-second-cadence pilots each clear ten seeds; zero-warning type/lint, 39 tests, the full 21-route platform build, and the 64,753-byte transfer gate pass. Six active responsive sizes, narrow-result scrolling, pause/focus, final-wave UI reachability, one audio context, 12 listeners, and an empty warning/error log pass. TankaVOID remains Coming Soon; T6 platform integration and T7 physical/deployed hardening remain.
31. **TankaVOID T6 platform integration — source/local gates complete; database execution pending.** A shared contract now freezes the server-created manifest, bounded terminal evidence and server-recomputed score. Optional platform start/finish, provisional accepted receipt, accepted-only Tanka board and personal best, responsive receipt UI, one transient retry, quiet guest fallback, and systems-check exclusion pass 52 contract/game tests, 5 platform tests, 50 foundation assertions, type/lint/bundle budgets, full 29-page assembly, production-mode HTTP checks, and desktop/phone/landscape browser QA. No browser-authored score is trusted, no result is called verified, and no legacy Tanka row can enter the new board. The coordinated Supabase migration has not run; Tanka remains Coming Soon with no public Play route until the database matrix and T7 physical/deployed release gates pass.

## Current next action

Review the stacked hosted-game branches and TankaVOID T0–T6. Execute the shared run-ticket/data matrix only on an approved short-lived Supabase branch, then take TankaVOID through T7 physical touch certification, final balance/art/performance, deploy-preview smoke, and rollback proof before changing Coming Soon to Play. VOIDaVOID V3, WreckaVOID W3, WORDaVOID WD2, executable WD1/T6 acceptance, and data-backed platform work remain gated on that branch. Production data, secrets, Stripe, AdSense, DNS, and production deploys remain untouched.
