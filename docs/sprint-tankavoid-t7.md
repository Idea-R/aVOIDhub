# Sprint evidence — TankaVOID T7 release hardening

- Date: 2026-08-20
- Issue: [#36](https://github.com/Idea-R/aVOIDhub/issues/36)
- Branch: `codex/tankavoid-t7-release-hardening`
- Draft PR: [#37](https://github.com/Idea-R/aVOIDhub/pull/37)
- Base: exact T6 commit `0a81360`
- Public state: Coming Soon; no friendly Play route or production deployment

## Intended outcome

Turn the T6 platform-integrated build into a measurable release candidate. T7 adds one CI/release command, frame-quality diagnostics, a restrained visual pass, responsive and lifecycle evidence, and a deploy-preview/rollback gate. It does not convert browser emulation into a physical-device claim, activate the pending database, or publish TankaVOID.

## One-command release gate

`npm run verify:tankavoid:release` now runs the complete Tanka release boundary:

1. shared score-contract verification;
2. TankaVOID type-check, zero-warning lint, tests, build, and bundle budgets;
3. platform tests and type-check;
4. catalog and platform-foundation contract verification;
5. full Netlify platform assembly;
6. assembled Tanka review-artifact checks; and
7. an assertion that no public Tanka redirect exists.

`.github/workflows/tankavoid-release.yml` runs the same command on relevant pull requests and by manual dispatch with read-only repository permission, a 15-minute limit, dependency caching, and stale-run cancellation.

## Performance diagnostics

The fixed-step loop now reports cumulative rendered frames, measured average frame delta, frames above 34 ms, maximum frame delta, and dropped simulation time. Stop/reset clears each counter. Tests cover the accumulation and reset contract, and development diagnostics expose the values without adding production telemetry or third-party code.

The candidate retained its existing hard ceilings: one frame owner, one resize observer, 12 input listeners, one audio context, eight audio voices, three simultaneous enemies, 32 projectiles, 12 retained tank impacts, eight cover strikes, four cover pieces, 64 logical draw items, and zero particles.

## Presentation and copy

The arena remains procedural and asset-free. Low-opacity combat lanes, sector labels, a center line, tank shadows, and a large ghosted TankaVOID stencil improve depth and orientation without changing collision or increasing shipped media. Public metadata and the in-game release language now describe the directional five-wave game rather than the old placeholder generation. The initial UI snapshot also matches the real 220-point player hull.

These changes are a legibility pass, not a claim that the five-wave proving ground is the complete long-term commercial shape. The old prototype's larger-world survival ideas remain preserved for a separately approved product expansion.

## Automated verification

The complete release command passes locally:

- Shared Tanka contract: 1 file / 9 tests.
- TankaVOID: type-check, zero-warning lint, 11 files / 43 tests, production build.
- HTML: 0.68 kB / 0.40 kB gzip.
- CSS: 14.73 kB / 4.02 kB gzip.
- JavaScript: 200.50 kB / 63.37 kB gzip.
- Initial compressed transfer: 67,051 / 122,880 bytes.
- Largest JavaScript asset: 200,506 / 266,240 bytes.
- Shipped media: none.
- External runtime assets: none.
- Platform Tanka tests: 2 files / 5 tests.
- Platform type-check: pass.
- Catalog contract: 8 titles, 8 detail pages, 7 Play destinations, one honest Coming Soon state.
- Platform foundation verifier: 50 assertions.
- Full assembly: VOIDaVOID, WreckaVOID, WORDaVOID, TankaVOID, and 29 Next.js pages.
- Tanka review index and its hashed CSS/JavaScript assets: present.
- Public friendly Tanka route: held.

## Responsive, lifecycle, and frame evidence

Browser checks used the real pointer/touch event paths and viewport emulation. They are useful release-candidate evidence, but they are not physical-device certification.

| Candidate           | Result                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 360 × 780 portrait  | 116 px controls; HUD, coach, and controls stayed in bounds with zero measured intersections and no horizontal overflow      |
| 844 × 390 landscape | 105.6 px controls; HUD, coach, and controls stayed in bounds with zero measured intersections and no overflow               |
| 1920 × 1080 desktop | 12-second active combat averaged 16.7 ms, reached a 17 ms maximum, and recorded zero long frames or dropped simulation time |

Escape created one focused pause dialog, released the frame owner, and held the simulation tick. Continue restored one frame owner. The motion control switched the runtime to reduced motion; the sound control muted the owned audio path. No warning or error was recorded.

A 21-start / 20-reset soak finished with:

- 4,566 rendered frames;
- 16.7 ms average and 17 ms maximum frame delta;
- zero long frames and zero dropped simulation time;
- one simulation/frame/resize owner while active and none at terminal;
- 12 input listeners;
- one audio context, zero terminal voices, and the eight-voice ceiling intact;
- zero terminal projectiles or impacts; and
- fixed cover, enemy, draw-item, projectile, impact, and strike capacities.

## Deploy-preview gate

The local Netlify command completed the Next.js application build, then Netlify's Windows Next runtime adapter failed in `onBuild` while resolving `@swc/helpers` above the repository root. No draft deploy was uploaded. The repository was not modified with a machine-wide dependency workaround.

The intended release route is the normal Git-driven Linux deploy preview from the draft pull request. Its URL, route smoke results, production rollback target, and build status remain open until that preview exists.

## Gates still held

- Physical iOS Safari and Android Chrome input, audio, orientation, safe-area, thermal, and sustained-frame evidence.
- The T6/WD1 run-ticket and accepted-result matrix on an approved short-lived Supabase branch.
- Git-driven deploy-preview smoke for the hub, Tanka detail, board, unavailable receipt, review artifact, and absent friendly route.
- A verified production rollback target and rehearsal record.
- The product decision and separately scoped work for a larger Expedition/survival mode.

No Supabase migration, Stripe or AdSense activation, DNS change, production deploy, public Play route, or production-data write occurred.

## Release decision

T7 is locally release-candidate complete, not publicly releasable. Keep TankaVOID Coming Soon until the database, physical-device, deployed-route, and rollback gates all pass. The five-wave build may serve as the future Proving Grounds mode even if the commercial game expands into a larger sortie-based survival structure.
