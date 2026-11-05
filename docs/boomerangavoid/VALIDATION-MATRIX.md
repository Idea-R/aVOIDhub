# BoomerangaVOID validation matrix

This is the original acceptance specification. **Current executed evidence and partial/unverified gates are recorded in [RELEASE-CANDIDATE.md](RELEASE-CANDIDATE.md).** Entries are not globally passed by implementation alone. Evidence from existing aVOID or REA work is context only and does not pass a BoomerangaVOID gate. Implementation lead records actual revision, run environment, commands, results and artifact links here or in an adjacent results file.

| ID | Gate | Method and passing evidence |
| --- | --- | --- |
| B00 | Correct base and change ownership | Remote main/production relationship recorded; dirty legacy and PR #61 preserved; new worktree and explicit staged diff contain only owned changes |
| B01 | Build reproducibility | Clean dependency install from lockfile under documented Node/npm; game, sim, protocol and server typecheck/build; no missing assets or path-case errors |
| C01 | Move/stop/facing | Recorded real inputs at 30/60/120/144 render FPS; normalized diagonal speed; no speed change from render rate; deadzone/remap working |
| C02 | Dash | Before/at/after tick boundaries; cooldown and buffered input; marked gaps versus solid walls; weapon vulnerability; no stale hold repeat |
| C03 | Slash/deflect/shove | Inside/outside cone/range and exact timing edges; armed slash can deflect; unarmed shove cannot silently kill; one authoritative event per action |
| C04 | Throw/curve/catch | Fresh press, held press, initial steering limit, moving owner, outbound-to-return, catch; no fresh throw caused by release after catch |
| C05 | Grounded recall | Wall/corner block, moving owner, repeated recall, blocked timeout rematerialization, dead owner; no damaging teleport through cover |
| C06 | Collision/priority | Swept thin-wall/graze/clash; equal-time and ordered-time hit groups; defenses then batch damage; shield grace; dead-owner invalidation only after batch; reflected attack team vs return owner; exactly-once score |
| C07 | Round lifecycle | Real play from lobby to win/loss/draw, countdown, sudden death, round reset, match end and rematch; no residual entities/cooldowns/input |
| C08 | Upgrade combinations | Each of 8 upgrades alone; every allowed pair; rejected combinations explained; bounded spawns, proc depth and effect IDs; no infinite loop |
| C09 | Maps and bots | All 6 maps: safe spawns, fair cover, reachable objectives/recall paths, no hidden hazards; 3 bot difficulties use legal inputs and reaction delay |
| C10 | Modes | FFA/teams and friendly fire; Relay contested pickup/target dwell/score/respawn/timer; airborne weapon cancellation on pickup; shield hit drops seed; disconnected carriers; results match authority |
| N01 | Real separate clients | Two then six clients on local server; final gate two separate internet connections to hosted preview; same match/round results and protocol version |
| N02 | Input security | Wrong-seat, invalid type/NaN/Infinity, oversized, duplicate, stale/future sequence and flood tests; reject impossible movement/cooldown/score without crashing room |
| N03 | Network impairment | Repeat fixed scenario at RTT 0/60/120/200 ms, jitter 0/20/50 ms, packet loss 0/1/3%; document perception/corrections and pass core playability through 120 ms/20 ms/1% target |
| N04 | Transport fidelity | Network proxy or system impairment actually affects WebSocket stream; HTTP throttle alone is not accepted as WSS loss/jitter testing; TCP ordering/head-of-line stalls considered |
| N05 | Reconnect | Drop during dash/throw/death/results/loading; 20-sec lease; refresh; expired ticket; duplicate tabs; frozen connected tab reaches neutral input in 150 ms; no seat theft, immunity, duplicated points or resurrection |
| N06 | Lifecycle/deploy | Lobby-owner leaves; server disconnect/restart; graceful drain; client/server version mismatch; room capacity reached; honest recoverable states |
| N07 | Prediction/events | Acknowledged inputs reconciled, local/remote collision corrections bounded, no duplicate death/audio, no predicted kill permanently shown before authority |
| N08 | Capacity/soak | Candidate instance 20 full rooms/120 seats for 30 min and one full room 2 hr; record tick p95/CPU/RSS/bandwidth/event-loop lag; admission cap; no unbounded resource growth |
| N09 | Readiness/discovery | Slow/failed/stale map download, hash mismatch/retry/timeout, spectator fallback; no unready spawn; opt-in public room filters and atomic mixed-local-seat reservation; honest empty Quick Join |
| A01 | Current Google UI | Google action added to modern platform; keyboard focus/loading/pending guard; email remains usable; local practice never blocked by identity service |
| A02 | Provider configuration | Read existing authorized Google/Supabase config; callback and redirect allowlist exactly fit chosen preview/production targets; no secret values in reports |
| A03 | OAuth real canary | Existing user and allowed new-user path; cancellation, provider error, invalid/expired code, refresh, logout/relogin; safe next returns to intended game/room; no open redirect |
| A04 | Cookie and ticket boundary | Platform SSR refresh verified; same-origin POST CSRF/origin guard; one-use room ticket expiry/audience/seat binding/replay; no cookie/token in URL/logs/third-party requests |
| A05 | Data integrity | Isolated database tests for RLS, duplicate match receipt, forged winner, guest/local outcome, abandoned match; trusted server only writes online results |
| U01 | Controls/devices | Keyboard+gamepad, two keyboard seats where hardware permits, hot-plug/unplug, browser blur, remapping, touch multi-pointer, orientation and safe-area insets |
| U02 | Player journey | New player starts tutorial, performs all 5 actions, joins/creates room, finishes and rematches via real controls; no second promotional landing before play |
| U03 | Accessible presentation | Grayscale/team markers, visible focus, 200% UI text zoom, reduced motion, no essential info only in sound/colour, music/SFX/mute/haptic settings persist |
| V01 | Art in motion | Gameplay-scale captures of all characters/maps; projectiles and hazards never obscured; polished, varied eliminations for every character; original source/export attribution |
| V02 | Performance | Named desktop 1080p target sustained 60 FPS / median ~16.7 ms / p95 <=20 ms; mobile low-quality 30 FPS / median ~33.3 ms / p95 <=40 ms; delivered frames and missed-frame fraction measured separately; no hardware claim from headless |
| V03 | Memory/loading | Initial compressed payload target <12 MB, decode/texture counts, 20 match/rematch cycles without sustained allocation climb, first-load vs warm-load tracked, missing-asset fallback |
| P01 | Platform regression | Existing affected typecheck/unit/catalog/styles/routes/foundation checks where present; complete `build:platform:netlify`; no old game routes/auth links regressed |
| P02 | Build assembly | Explicit game copy target, safe destination boundaries, path-case and Vite base path, direct refresh and asset cache versioning, source-map policy |
| R01 | Release preview | Required authorization recorded; exact candidate commit matches preview; Google auth needs real Next runtime (static export is visual review only); internet WSS tested |
| R02 | Operations | Health/readiness, bounded logs with no PII/tokens, room crash recovery text, telemetry/alerts, region/capacity config, deploy drain and last-good rollback documented |
| R03 | Final review | Scope checklist complete, known limitations visible, no placeholder buttons, fabricated scores or unsupported “verified” claims; final deployment gate separate from code completion |

## Evidence format

Store `verify/results/<revision>/<caseId>/` with a small manifest: timestamp, commit, lockfile hash, protocol/rules/map hashes, seed, browser/OS/device, viewport/DPR/quality, client/server endpoints (redacted if private), exact command/input sequence, expected/actual state, event IDs, screenshot/video and performance sample. Keep authentication secrets, personal account details and tokens out of captures/logs. A screenshot proves appearance at one moment; state/events and real input prove behavior.

For sim replay, serialize sorted IDs and compare discrete fields exactly, floats at a documented tolerance. On divergence report the first tick and nearby commands. Check harness sensitivity using a few deliberate mutations (double scoring, one-tick dash extension, omitted catch collision), then remove mutations. Do not write tests that merely repeat implementation constants without checking behavior.

Use no live public score submissions or public-room load floods. Test local/staging fixtures under explicit test flags; production server must not expose state mutation shortcuts. If real mobile hardware, a controller type, two external networks or Google account consent is unavailable, record that specific gate as unverified and complete all independent checks.
