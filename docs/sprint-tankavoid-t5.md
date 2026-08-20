# Sprint evidence — TankaVOID T5 five-wave content run

- Date: 2026-08-20
- Issue: [#32](https://github.com/Idea-R/aVOIDhub/issues/32)
- Branch: `codex/tankavoid-t5-content-run`
- Draft PR: pending at the time of this evidence commit
- Base: exact T4 commit `05c898a`
- Public state: Coming Soon; no platform staging or deployment

## Intended outcome

Turn the one-encounter directional-combat proof into one complete, bounded run. T5 adds four behavior identities, nine total hostiles, five fixed waves, deterministic inter-wave pacing, one final coordinated pressure event, and a result that explains what happened. It does not reopen the old prototype pile or pretend local combat facts are a platform score.

## Frozen run

| Wave | Name | Hostiles | Tactical question |
| ---: | --- | --- | --- |
| 1 | Cut the angle | Scout | Can the player keep the fast flanker off a side plate? |
| 2 | Break the line | Bruiser | Can cover and frontal armor answer direct pressure? |
| 3 | Crossfire | Scout + hunter | Can the player choose between a close flank and a long firing lane? |
| 4 | No safe range | Bruiser + hunter | Can one position answer two preferred ranges? |
| 5 | Last command | Commander + scout + hunter | Can the player survive the close while both specialist behaviors remain active? |

Scout, bruiser, hunter, and commander are source-defined profiles rather than procedural variants. The seed changes only small spawn offsets and orbit direction. It cannot change membership, health, weapons, damage, or wave count.

The first deployment lasts 180 simulation ticks. Later deployments last 90 ticks, wave-clear holds last 120 ticks, and each non-final clear repairs exactly 28 hull points up to the 220-point maximum. The final result hold lasts 90 ticks. These are fixed-step states owned by the simulation; React owns no wave, repair, or result timer.

## Behavior and result boundary

- Scout is the fastest flanker and has the lowest health and shell damage.
- Bruiser is the slowest ordinary tank and applies direct medium-range pressure.
- Hunter prefers the longest range, strafes at range, and fires more often than a bruiser.
- Commander exists only in wave five, has the largest health pool, and closes directly. It is the final pressure tank, not a second weapons or boss subsystem.

The result reports waves, enemies disabled, active combat time, damage, hits/shots, and field repair. It remains explicitly local and engineering-only. T5 does not create a score, run ticket, receipt, personal best, leaderboard row, account dependency, or claim of verification.

## Balance evidence

Two deterministic pilot cadences ran across seeds 1–10:

| Pilot | Fire cadence | Combat-time range | Final-hull range | Shots | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Fast lead-aim | 20 ticks / 0.33 s | 22.13–26.12 s | 200.8–204.6 | 69–81 | Ten five-wave clears |
| Deliberate lead-aim | 120 ticks / 2.00 s | 129.82–153.78 s | 47.3–94.0 | 66–78 | Ten five-wave clears |

The deliberate case exists because browser gesture automation exposed an overly sharp first balance. The original 140-hull/high-damage tuning could kill a careful slow-input player before wave five. T5 now preserves failure—an idle player still reaches `player-disabled`—while leaving enough room for deliberate aim and release. T7 still owns feel testing and final difficulty tuning on hardware.

## Ownership and ceilings

| Resource | T5 ceiling | Observed terminal/active behavior |
| --- | ---: | --- |
| Active enemies | 3 | Exact wave-five roster |
| Active projectiles | 32 | Fixed pool; zero at terminal result |
| Retained impacts | 12 | Fixed history |
| Retained cover strikes | 8 | Fixed history |
| Static cover | 4 | Unchanged arena |
| Particles | 0 | No hidden effect system |
| Logical draw-items | 64 | Active diagnostics stayed below the ceiling |
| Input listeners | 12 | Stable through pause, restarts, and responsive checks |
| Resize owners | 1 | Stable |
| Running frames | 1 | Zero while paused and at results |
| Audio contexts / voices | 1 / 8 | One context; zero paused/result voices |

Projectile collision now chooses the nearest swept enemy hit before comparing cover. Impact history carries the exact target id. Tank separation uses deterministic two-pass pair resolution, and enemy updates stay in stable source order.

## Automated verification

`npm run verify:release --workspace=@avoid/tanka-void` passed after the browser-driven balance and narrow-layout repairs:

- TypeScript: pass.
- ESLint: pass with zero warnings.
- Vitest: 10 files / 39 tests.
- Vite production build: pass.
- HTML: 0.65 kB / 0.38 kB gzip.
- CSS: 14.14 kB / 3.92 kB gzip.
- JavaScript: 193.69 kB / 61.18 kB gzip.
- Initial compressed transfer: 64,753 / 122,880 bytes.
- Largest JavaScript: 193,690 / 266,240 bytes.
- Downloaded media: 0.
- External runtime assets: 0.

The suite covers the exact content manifest, profile relationships, deterministic same-seed runs, exact wave order, nearest-target collision, bounded histories, tank/cover and tank/tank separation, pause freezing, tick-owned deployment/clear/repair/result transitions, idle defeat, ten fast campaigns, ten deliberate campaigns, and every published ceiling. `npm run build:platform` also generated all 21 platform routes successfully.

## Browser evidence

The briefing passed 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, 1440 × 900, and 1920 × 1080 before the active-state pass. The live forced-touch matrix then exercised 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, and 1440 × 900. Every size exposed both labelled touch controls, the live wave/hostile HUD, and all six result metrics. Short results use a contained scroll region rather than document overflow.

The 320-pixel override exposed a real edge case: the browser's available layout width was 291 CSS pixels while the root still enforced `min-width: 320px`. That created 29 pixels of horizontal overflow. Removing the forced minimum produced a 291-pixel canvas, in-bounds HUD and touch controls, and zero document overflow without adding a separate compact runtime.

Real UI gestures reached the fifth wave in both touch and desktop modes with no development mutation, one audio context, 12 listeners, one resize owner, and zero warning/error logs. The browser-control bridge itself takes roughly two seconds per target gesture; its long campaign attempts therefore became slow-input balance probes rather than representative twitch-play timing. The deterministic two-second-cadence suite is the reproducible full-clear acceptance evidence. Screenshot capture was unavailable for this local canvas target, so the browser record uses semantic snapshots, geometry, diagnostics, real pointer/touch gestures, and console output rather than claiming visual captures that do not exist.

Pause focused one labelled dialog, stopped the frame owner, held the fixed tick exactly, and resumed with one frame owner. Results left zero frame owner and remained internally scrollable at the narrowest and shortest sizes.

## Boundary held

- TankaVOID remains Coming Soon and noninteractive on the public platform.
- T5 adds no mine, infantry, barracks, pickup, alternate weapon, ability, destructible cover, upgrade tree, currency, second arena, multiplayer, or platform score.
- Browser responsive evidence is not physical iOS/Android certification.
- No Supabase, Stripe, AdSense, Netlify production, DNS, account, data, or deployment state changed.

## Next action

T6 should integrate the already-built platform detail page, optional platform session, one-use run boundary, accepted result/receipt, and trust-labelled personal/global board without allowing direct score writes. T7 then owns physical-device certification, final balance/art/performance work, deployed smoke, and rollback evidence before the catalog card may change from Coming Soon to Play.
