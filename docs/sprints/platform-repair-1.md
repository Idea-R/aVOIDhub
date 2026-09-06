# Platform Repair Sprint 1

Started: 2026-09-04
Status: complete release candidate; production release and service activation remain gated
Baseline: `origin/main` at `25d6820`
Integration: `codex/fix-platform-repair-sprint-1` in `C:/dev/aVOID-main`

## Charter

Repair the shared presentation and public navigation defects found in the September 4 health check. Include the small, independently testable login and creator-form handoff fixes so the improved pages do not discard user context.

Success means valid shared CSS, stable responsive layouts in both motion preferences, accurate catalog counts and destinations, page-specific metadata, preserved login destinations and creator drafts, passing targeted tests and production builds, and a reviewable release candidate with recorded browser evidence.

Keep the Next.js platform, meteor artwork, cream/teal/orange/lime identity, asymmetric corners, game routes, and hosted-game contracts. This is repair, not a new design system. Design read: preserve the playful editorial arcade for players and creators, using the existing native CSS language. Dials stay near the existing 8/6/4 on the home page; utility pages favor direct actions and restrained motion. The dashboard guide governs utility surfaces.

## Scope and authority

In scope: shared CSS and responsive structure; catalog counts/grid/link labels; compact utility headers and safe social-dock placement; metadata; stale public copy; WreckaVOID login links; recoverable creator application input; tests and local preview.

Out of scope: game balance/content, rebuilding WreckaVOID's launcher, production database repair/migrations, live sign-in email tests, subscription pricing/activation, ad requests/consent activation, new assets, dependency upgrades, DNS, and unrelated worktrees. Launcher consolidation and real score/payment journeys remain subsequent batches.

User authorized a documented sprint, implementation, a new goal, and credit-conscious subagents. Local edits, tests, branches, and coherent commits are authorized implementation work. One release PR/preview may be prepared under the existing GitHub/Netlify workflow. Production merge/deploy, secrets, data changes, billing, and advertising retain the roadmap's explicit release gates. A local passing state is not production activation.

## Phases and gates

| Phase | Owner | Deliverable | Exit check | Status |
| --- | --- | --- | --- | --- |
| 0. Baseline and plan | Coordinator | Fresh baseline, protected dirty work, plan and root-log pointers | No old work overwritten; scope recorded | Complete |
| 1. Shared presentation | Coordinator | Media-block repair, relevant CSS cleanup, responsive grid/utility/dock fixes | CSS regression and normal/reduced-motion layout parity | Complete |
| 2. Handoffs and wording | Drizzt / Regis | Return destinations and application recovery; bounded copy cleanup | Regression tests and reviewed meaning | Complete |
| 3. Catalog and page identity | Coordinator | Derived counts, honest external links, canonical/noindex metadata | Registry/source tests and route checks | Complete |
| 4. Integration and browser QA | Coordinator | Integrated changes, builds, viewport/motion/error-state evidence | Required checks recorded | Complete |
| 5. Release handoff | Coordinator | Coherent commits, final diff and release/rollback instructions | Candidate vs live and service gates clearly identified | Complete |

## Worker board and ownership

- Coordinator: `globals.css`, homepage/catalog rendering, shared platform header/social dock, metadata, structure tests, root delivery records and final integration. Reuses the clean `aVOID-main` checkout; older dirty root/audit/catalog worktrees stay untouched.
- Drizzt (`gpt-5.6-sol`, high): `C:/dev/_worktrees/aVOID/platform/sprint-1-auth`, branch `codex/fix-platform-auth-handoffs`. Owns creator application form and narrow draft/request helpers/tests, login return compatibility, and WreckaVOID sign-in links/tests. No CSS, database, auth-provider, or billing changes.
- Regis (`gpt-5.6-luna`, medium): `C:/dev/_worktrees/aVOID/platform/sprint-1-copy`, branch `codex/fix-platform-public-copy`. Owns visible strings only in membership, game detail, and leaderboard pages. No behavior, metadata, layout, policy, price, or capability inventions.

No recursive agents. No worker browser or dependency installation is needed. Parent integrates explicit diffs and runs shared builds; workers stop at their deliverable.

## Verification plan

1. CSS parser regression rejects unclosed blocks and layout selectors inside motion-only conditions.
2. Catalog checks cover playable/queued/external counts and destinations without assuming a fixed card count.
3. Return-path tests cover local destinations and unsafe external/protocol-relative input. All game sign-in links use the same contract.
4. Creator recovery tests cover signed-out transitions, malformed/expired drafts if used, network/JSON errors, and duplicate submissions. No real production application.
5. Platform tests and typecheck; relevant WreckaVOID tests/typecheck/lint; production platform and changed-game builds. Record pre-existing failures separately.
6. Browser: 320, 390, 768, 1280, 1440 widths; normal/reduced motion; home, login, creator intake, membership, board, representative details. Check actual controls/child bounds, navigation, focus, feedback and social collisions.
7. Local signed-out and safe configuration/error states only. Authenticated database, email callback, payment and score end-to-end checks remain explicit service gates unless separately authorized and accessible.

## Evidence and restart point

### Implemented

- Removed the unterminated, duplicate reduced-motion block that trapped shared refinements. One final motion block remains. Added a parser regression to the existing release-check runner.
- Restored creator panels and vertical spacing under normal motion. Kept the established artwork and component identity. No new asset generation or dependencies were needed.
- Replaced fixed card positioning with a balanced two-column grid and a full-width last row for odd counts. Kept the mobile swipe rail; the swipe hint is mobile-only.
- Derived the 05 playable / 03 independent / 01 queued counts from catalog data. External cards now say Independent game because View game first opens the platform detail page. Play destinations are unchanged.
- Removed the queued tank from active board tabs. Public scoring and checkout copy states the current limitations without backend jargon.
- Added compact login/account/creator/admin headers, mobile form-first layout, current-page navigation, and a social dock that stays out of utility content. Footer socials remain available.
- Added page-specific canonicals and noindex for account workflows.
- Fixed all three WreckaVOID sign-in actions to use `next`; safely support legacy `returnTo`. Unsafe return paths fall back to the account page.
- Creator submission saves a 24-hour, tab-scoped draft before a possible sign-in redirect. Failed storage prevents a redirect that would lose input. Request errors preserve the form; concurrent submits coalesce. A valid response receipt is required before clearing a draft.

### Automated evidence

- `npm run test:styles --workspace=@avoid/platform`: reproduced the original unclosed-block failure, then passed after repair.
- `npm run test:catalog --workspace=@avoid/platform`: passed; 9 details, 8 play destinations, 1 coming-soon state. Tests cover derived counts and external card labels.
- `npm run test --workspace=@avoid/platform`: 11 files, 47 tests passed after integration.
- `npm run typecheck --workspace=@avoid/platform`: passed.
- `npm run test:routes --workspace=@avoid/platform`: 12 local routes passed HTTP, canonical and private noindex checks. The tank board is not linked.
- `npm run verify:release --workspace=@avoid/wrecka-void`: typecheck, lint, 38 tests, build and budget passed. Initial transfer 111,508 bytes against a 204,800-byte budget.
- `npm run build:platform:netlify`: passed; all five game bundles assembled and Next production build completed. WORDaVOID retains its pre-existing large-chunk warning. No bundle policy was weakened.
- The 12 route checks also passed against `next start`, not only the dev server.

### Browser evidence

Local review has no configured production backend and sends no account email or real application.

| Surface | Widths | Motion | Result |
| --- | --- | --- | --- |
| Homepage | 320, 390, 768, 1280, 1440 | Normal + reduced | Counts correct; six cards balanced at desktop; mobile swipe rail; sampled actions fit; dock only appears with a wide gutter |
| Creator application | Same five widths | Normal + reduced | Same grid in both preferences; no field/button overflow; requirements gap 52px at 320/390, 58px at 768, about 90px desktop |
| Login | Same five widths | Normal + reduced | No input/button/heading overflow; form precedes story on mobile; warning and form have explicit separation |
| Mobile navigation | 390 | Normal | Opens, follows Membership, and closes at the destination |
| Built membership, leaderboard, Wreck/Bloomfall details, account, admin, creator dashboard/submission | Same five widths | Normal + reduced | 80 combinations; sampled headings, fields and actions fit |
| Built home, creator intake and login | Same five widths | Normal + reduced | 30 combinations; sampled primary actions and form fields fit |

Keyboard checks: Tab advances from game title to review URL with a visible focus ring; Enter opens the mobile menu; Escape closes it and leaves focus on the trigger. The built-page console returned no warnings or errors. Preview account/admin data and disabled submission/checkout states were visually inspected, not passed off as live operations.

The final copy review also removed homepage claims about likes/follows and clarified that ranked saving and checkout are not ready. This changes wording only, not feature availability.

Draft recovery is tested with storage/request fixtures, not a real email callback. Session storage does not follow a link into a separate tab; the sign-in page explains returning to the original tab. Closing that tab clears the draft. These are deliberate privacy limits, not cross-device draft synchronization.

Both bounded workers are terminal and their reviewed diffs are integrated. Resource cleanup found zero Codex-owned heavy MCP helpers. No Docker resources were used. Existing unrelated helpers and dirty worktrees were left alone.

### Release and rollback

Implementation commit: `a2675a20098e52b29c8968c51dea274d2a62d8ba`.

One release PR: [#61](https://github.com/Idea-R/aVOIDhub/pull/61), from `codex/fix-platform-repair-sprint-1` to `main`. No worker PRs were created.

Review site: [Netlify preview](https://deploy-preview-61--coruscating-squirrel-a47ad9.netlify.app/). Implementation deploy: `6a9b940dc5f48100084f0158`. [CI run](https://github.com/Idea-R/aVOIDhub/actions/runs/33943425307) passed the full existing release-candidate runner. Netlify build, headers and redirects passed; Pages changed was skipped, not failed. The subsequent evidence commit changes documentation only.

Hosted preview checks passed: all 12 HTTP/canonical/noindex routes; creator spacing at 1280 and 390; the Wreck game detail Play action reaches its preserved game route; its Sign In link reaches `/login?next=%2Fwreckavoid%2F` and displays `/wreckavoid/` as the return destination. The preview intentionally leaves email/application submission disabled by configuration. This is not proof that live sign-in or score saving works.

This candidate needs no database migration, new secret, new dependency, DNS change or payment/ad setting. Before a later authorized production merge, record the current production deploy and verify the same candidate preview. Rollback is a code revert/redeploy of the pre-release revision, with the previous Netlify deploy available as the immediate recovery target. No data rollback should be required by this sprint.

Restart: review/release PR #61 under the production gate, then use the following sprint sequence. Do not resume old worker branches or activate production services from this document alone. Main and the live domain were not changed by this sprint.

## Following sprint

Sprint 2 should prove a complete player journey before charging or showing ads:

1. Read-only backend diagnosis: identify the exact leaderboard query/schema failure and current migration state. Deliver a repair/rehearsal plan, with no blind production migration.
2. Isolated identity and scoring rehearsal: verify email callback, profile, one-use run ticket, accepted score, duplicate rejection and leaderboard display. Keep different rulesets/modes separate. Production writes need an approved target and test-account scope.
3. WreckaVOID launch cleanup: make the platform detail page the overview and the game route the compact launcher, without deleting game instructions/settings. Preserve direct game links and touch controls. Remove the repeated Physics survival label and old launcher claims about real-time global competition during that pass.
4. Membership test-mode journey: settle actual benefits, then verify Checkout, webhook idempotency, entitlements, cancellation and paid-user ad suppression. No live charges during this gate.
5. AdSense acceptance: sign in to the owning account, confirm approved domains and publisher ID, then verify ads.txt, consent requirements and one unobtrusive platform placement. No ad loading in gameplay or for ad-free members until these gates pass.

Finish each phase with recorded evidence before opening the next release gate. Larger game balance, campaign work and in-game advertising are separate scopes.
