# WreckaVOID W5 hardening evidence

Date: 2026-08-20

Issue: [#10](https://github.com/Idea-R/aVOIDhub/issues/10)

Draft PR: [#11](https://github.com/Idea-R/aVOIDhub/pull/11)

Branch: `codex/fix-wreckavoid-w5-hardening`

Stack base: `codex/fix-wreckavoid-w2-responsive` at `0f28a5a`

## Outcome

The independent W5 source and local-release gates are complete. WreckaVOID now has bounded presentation work, bounded particles, an enforceable transfer budget, accessible modal ownership, deliberate keyboard behavior, quiet guest degradation, and measured desktop/phone runtime evidence.

No production deploy, Netlify environment change, Supabase mutation, Stripe action, AdSense action, DNS change, or secret write occurred. A deployed-route and rollback smoke remains a production-release gate.

## Implemented hardening

### Asset and transfer budget

- Replaced the shipped 1,500,458-byte 1024 px PNG with a 31,846-byte 512 px WebP in the active runtime, a 97.9% reduction.
- Kept the old PNG as unreferenced source history; it is absent from the production bundle.
- Replaced the broken Vite favicon reference with the owned WreckaVOID mark.
- Added `tools/check-build-budget.mjs` and `npm run check:budget`.
- The budget fails when:
  - compressed HTML/CSS/JavaScript plus emitted WebP transfer exceeds 200 KiB;
  - one JavaScript file exceeds 230 KiB;
  - the active logo exceeds 50 KiB;
  - any PNG enters the WreckaVOID production bundle.
- Final measured transfer: 168,404 bytes against a 204,800-byte budget.
- Largest JavaScript file: the dormant Supabase chunk at 208,116 bytes against a 235,520-byte budget.

### Runtime work bounds

- Changed the simulation clock to present React state at a maximum cadence of roughly 10 Hz while keeping the fixed-step simulation time exact.
- Added a 300-frame rolling frame monitor for development evidence.
- Capped standard particles at 480.
- Capped reduced-motion particles at 96, reduced explosion density/lifetime, and suppressed electric sparks.
- Extended viewport safety into the pause model. A playfield below 320 × 320 now pauses behind the support message; restoring the viewport clears only the viewport reason.
- Kept production output free of force-finish, focus-simulation, reduced-motion, lifecycle, heap, and frame diagnostics.

### Accessibility and input

- Added a shared semantic modal surface with `role="dialog"`, `aria-modal`, labelled/described relationships, initial focus, Tab containment, Escape handling where appropriate, and focus restoration.
- Prevented help, exit confirmation, pause, and game-over surfaces from exposing competing simultaneous dialogs.
- Exit confirmation now pauses through its own composable reason and focuses the safer Cancel action.
- Added a keyboard-focusable, described playfield with canvas fallback text.
- Prevented global Space/H game shortcuts from consuming keyboard activation on buttons, links, form controls, or editable content.
- Made upgrade explanations reachable by keyboard focus rather than pointer hover alone.
- Added live share-result announcements, visible global focus treatment, and a motion-reduction CSS fallback.

### Unconfigured-service behavior

- Removed fake Supabase network requests when the Vite Supabase variables are absent.
- Guest play, the empty staged leaderboard, auth loading, and platform-run setup now fail quietly instead of emitting repeated request failures.
- Account activation and ranked-score behavior remain W3 work; this change does not reconnect the old browser-owned score path.

## Automated evidence

`npm run verify:release --workspace=@avoid/wrecka-void` passed:

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Vitest: 9 files, 31 tests, all passed.
- Vite production build: pass.
- Build budget: pass.

The retained-mechanics tests now cover:

- pusher deflection, damage, destruction, and points;
- boss creation, spread projectile attack, and non-destructive player contact;
- projectile damage and one-removal reporting;
- second-chain damage/destruction;
- eligible second-chain power-up creation and collection;
- particle caps and reduced-motion behavior;
- game-clock presentation throttling;
- exit/viewport pause composition;
- interactive-control keyboard exclusion;
- rolling frame samples.

`npm run build:platform:netlify` also passed after the final changes:

- VOIDaVOID built;
- WreckaVOID built and staged;
- WORDaVOID built and staged;
- the normal Next.js platform compiled, type-checked, and generated all 21 static pages while retaining its dynamic routes.

Known unrelated build warnings remain in VOIDaVOID dynamic imports and the WORDaVOID 547.79 KiB chunk. They are not WreckaVOID regressions and remain assigned to their own title sprints.

## Browser evidence

The browser matrix used the development-only smoke seam for deterministic lifecycle checks and the production Vite preview for the final shipping-bundle check.

| Check             | Evidence                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Desktop           | 1440 × 900; canvas 1440 × 860; document 1440 × 900; no overflow                                                              |
| Phone             | 360 × 640; canvas 360 × 600; document 360 × 640; no overflow                                                                 |
| Landscape         | 844 × 390; canvas 844 × 350; document 844 × 390; pause/help available                                                        |
| Unsupported       | 300 × 300; support message present; `viewport` pause active; no competing dialog                                             |
| Help              | One semantic dialog; Close receives focus; closing clears only `help`                                                        |
| Exit              | One semantic dialog; Cancel receives focus; `exit` pause active; cancel restores menu focus                                  |
| Pause             | One semantic dialog; Resume receives focus; manual reason clears normally                                                    |
| Result            | At 360 × 640 the result dialog bounds were x 12–348 and y 75–565; Play Again received focus and all actions remained visible |
| Reduced motion    | Runtime reported `motion reduced`; the 96-particle cap/spark suppression passed automated checks                             |
| Production bundle | `/WreckaVOID/` rendered at 360 × 640 with no smoke controls and a 360 × 600 canvas                                           |
| Clean degradation | A fresh no-env reload produced no new Supabase warnings or request errors                                                    |

### Frame and lifecycle sample

At both 360 × 640 and 1440 × 900, a rolling 300-frame sample reported:

- average: 16.7 ms;
- p95: 16.8 ms;
- max: 16.9 ms;
- frames at or above 50 ms: 0.

The post-change repeated-run sample completed 40 deterministic finish/restart cycles:

- RAF owners: 1;
- input owners: 1;
- deferred timers: 0;
- finish transitions: 41;
- restarts: 41;
- active pause reasons: none.

Chromium’s in-page heap reading moved from 37.79 MB before the two batches, to 39.09 MB after 20 cycles, then down to 38.43 MB after 40 cycles and a five-second settle. The second batch decreased rather than continuing the first batch’s rise; the final delta was +0.64 MB. This is consistent with bounded development-runtime allocation rather than linear per-restart retention. W0/W1’s forced-GC sample separately decreased by about 1.5 MB.

### Mobile Lighthouse on the production preview

- Performance: 98.
- Accessibility: 100.
- Best Practices: 100.
- SEO: 100.
- First Contentful Paint: 1.8 s.
- Largest Contentful Paint: 2.1 s.
- Total Blocking Time: 0 ms.
- Cumulative Layout Shift: 0.
- Total transfer: 168 KiB.

The remaining reported opportunities are the render-blocking stylesheet, 67 KiB of unused JavaScript—principally the auth/Supabase path that W3 retires or reconnects—and additional responsive-image sizing. None exceeded the explicit W5 release budget.

## Rollback and remaining release gates

The source rollback target is the clean W2 head `0f28a5a`. W5 is a stacked branch and can be omitted without rewriting W0/W1 or W2.

Before calling WreckaVOID production V1 complete:

- execute W3 against the approved isolated Supabase environment;
- complete W4 personal-best, leaderboard, receipt-sharing, and old-auth retirement;
- test the merged deploy preview in current Chrome, Firefox, Safari/WebKit, and physical touch hardware;
- deploy only with explicit release approval;
- run the production route smoke and prove Netlify rollback to the prior known-good deploy.
