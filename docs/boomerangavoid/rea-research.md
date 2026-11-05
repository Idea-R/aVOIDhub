# BoomerangaVOID: REA research and observation plan

Prepared 2026-11-04. Read-only investigation; no application edits, installs, game execution, extraction, publication, credentials, or deployment. Only this report was created. Public game research used the official website and publisher Steam listing. Existing REA documentation and experiment records were read locally; their historical results were not rerun.

## Recommendation

Build BoomerangaVOID as an original browser party arena using public mechanic descriptions as inspiration. Borrow REA's evidence discipline and the existing Mechanics Lab's reproducible input/state comparisons. Keep REA optional: there is no available Boomerang Fu gameplay artifact in this investigation, and inspecting its marketing website would analyze that website rather than the shipped game's simulation. Exact Boomerang Fu parity is neither established nor necessary for this original game.

## Located reference and installation

| Item | Exact location / identity |
| --- | --- |
| Upstream project | https://github.com/morluto/rea |
| Saved research | `C:\dev\IdeasRealized\docs\research\technology\rea-2026-10-19\README.md` |
| Architecture and capability audit | `C:\dev\IdeasRealized\docs\research\technology\rea-2026-10-19\02-mechanics-and-architecture.md` |
| Retained source evidence | `C:\dev\IdeasRealized\docs\research\technology\rea-2026-10-19\evidence\` |
| Historical source commit | `833136507dd79d959340b09862a53af344e4f1b3` |
| Release used by saved experiments | `rea-agents` version `6.7.0` |
| Mechanics Lab | `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab` |
| Verified installed package | `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab\node_modules\rea-agents\package.json` |
| Package CLI entry | `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab\node_modules\rea-agents\scripts\rea.mjs` |
| Experiment 002 result | `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab\experiments\002-tower-cycle\result.md` |
| REA license capture | `C:\dev\IdeasRealized\docs\research\technology\rea-2026-10-19\evidence\upstream--LICENSE` |

The installed package metadata identifies `git+https://github.com/morluto/rea.git` and version 6.7.0. A standalone REA Git checkout was not identified in the targeted search; the saved research plus installed npm package are concrete local references. No current upstream version claim is made. The older research mentions a user fork, but this investigation did not establish its URL or checkout.

Read workspace instructions at `C:\dev\AGENTS.md` and Lab instructions at `C:\dev\IdeasRealized\Projects\REA-Mechanics-Lab\AGENTS.md`. No AGENTS.md was found at the directly checked IdeasRealized research ancestor paths or aVOID root. Lab instructions preserve frozen experiments, separate source-reveal from reconstruction, and prohibit treating instructed filesystem separation as enforced isolation. No Lab files were changed. `rg` is unavailable on this host; targeted PowerShell searches were used. The broad Projects search was stopped once the relevant evidence was found.

## What REA provides

The saved 6.7.0 documentation describes a TypeScript CLI/MCP coordinator for analysis providers: packaged JavaScript, native binaries through tools such as Ghidra/Hopper/IDA, .NET, Android, network captures, and browser observation. REA supplies structured evidence and provenance; it does not itself turn a video into verified game rules. See the [pinned release README](https://github.com/morluto/rea/blob/rea-agents-6.7.0/README.md).

The retained browser guide describes bounded CDP capture of DOM/accessibility structure, scripts, resource and event metadata, optional screenshots, and comparison surfaces. The observation provider is passive and explicitly excludes general input control. Capture omissions and attach-limited coverage must remain unknown. Canvas pixels alone do not expose player health, collision volumes, hidden timers, or authoritative simulation state. The [captured source guide](https://github.com/morluto/rea/blob/833136507dd79d959340b09862a53af344e4f1b3/docs/browser-observation.md) is a historical source snapshot; do not assume every feature listed there shipped in the installed 6.7.0 package.

The saved license is MIT, copyright 2026 morluto, with notice-preservation requirements. This describes REA's own code, not a license to the target game's code, art, maps, music, or branding. The repository's [disclaimer](https://github.com/morluto/rea/blob/833136507dd79d959340b09862a53af344e4f1b3/DISCLAIMER.md) separately states its intended analysis boundaries. For this task, no game binary or proprietary material was obtained or examined.

## Existing local evidence for usefulness

Experiment 001 reports 1,027/1,027 comparisons on a synthetic packaged JavaScript projectile fixture. It lacked an artifact-only control, so it cannot establish a REA advantage.

Experiment 002 is the stronger comparison. Both an artifact-only reconstruction and an artifact-plus-REA reconstruction matched 1,008 sequences and 36,043 frames on a pinned MIT Open-TD tower component. REA collection added 13.314 seconds and 1,223,137 bytes of evidence around a 5,276-byte artifact, without a measured accuracy improvement. Both workers derived exact arithmetic and execution order by reading packaged JavaScript. Deliberately incorrect variants were caught by the checker.

These are reported historical results, not checks run in this task. The experiment covered one small component and one run per arm; it excluded rendering, projectile travel and multiplayer. It supports using a focused evidence harness now and adding REA when structural inspection solves a real uncertainty. It does not prove REA useless on larger native targets or superior for this game.

Useful patterns to borrow:

- Record source, version, method, observation and uncertainty for each mechanic claim.
- Preserve input sequences, initial state, configuration, code revision and resulting events.
- Freeze candidate and case identities before comparisons; keep subsequent fixes separate from first results.
- Test checker sensitivity with deliberate defects, rather than interpreting every green result as comprehensive proof.
- Treat observed behavior, inference and original design choices as separate fields.

## Publicly confirmed Boomerang Fu mechanics

The [official site](https://www.boomerangfu.com/) describes short local rounds for up to six players, team play against bots, Hide & Seek, and stackable powers. Named examples include shield, fire, ice, multiple boomerangs, teleportation, disguise and telekinesis. It currently lists 36 base-game maps. These are high-level feature claims, not measured timings or interaction specifications.

The [publisher Steam listing](https://store.steampowered.com/app/965680/Boomerang_Fu/) explicitly describes one stick and three buttons; deflecting attacks; recalling dropped boomerangs; curving throws around corners; moving platforms, foliage and arena hazards; AI opponents; an alternate Golden Boomerang mode; and rules that select powers, disable shields or enable friendly fire. It advertises shared-screen play and Remote Play Together. This does not establish a native authoritative online-room protocol.

No frame-by-frame trailer analysis or hands-on gameplay occurred here. Neither gameplay familiarity nor marketing text establishes exact damage, dash invulnerability, homing acceleration, reflection angles, catch radius, attack priority, round duration, item persistence, scoring, bot algorithm, or collision tie ordering. These remain unknown.

## Original design proposals, not recovered behavior

For BoomerangaVOID, establish a small coherent contract first: movement, aim, throw/recall, dash, melee deflection, one returning projectile per player, cover and one shield modifier. Use original character silhouettes, names, palette, audio, effects, arena geometry and interface copy. Do not import the reference game's food cast or reconstruct its maps from screenshots.

Suggested first tuning envelope: 60 Hz simulation, 2–4 initial room participants with a later six-player capacity gate, 45–60 second rounds, a short dash around 120–180 ms with roughly 0.8–1.2 second cooldown, and a throw out-and-back cycle around 0.7–1.2 seconds. These are proposed starting ranges for playtesting, not measurements of Boomerang Fu. Keep values in one configuration module; do not scatter magic numbers through rendering and networking.

Movement-relative timing and readability should drive tuning: how long it takes to cross one cover gap; whether players can recognize a throw and react; how clearly returning projectiles and shield breaks are shown. A fixed measured skill test is more useful than claiming visual similarity.

## Public observation workflow

1. Save a small source ledger with URL, retrieval date, exact feature claim and confidence. Keep official written claims separate from any later visual observations.
2. If reviewing official trailer footage later, record video identity and timecodes, only describe visible actions, and record camera cuts or occlusion. Estimate ranges rather than exact hidden timers. Input timing is unobserved unless clearly demonstrated.
3. Translate each useful observation into an original rule specification. Mark disagreements or new choices explicitly. Do not claim recovered implementation.
4. Validate the new rules against the original game's own acceptance cases and playtests. Without a controllable reference executable, these tests verify the chosen contract, not Boomerang Fu equivalence.

REA is unnecessary to read these public marketing pages. It may later help capture and compare our own browser build's UI/network evidence, but a direct application state hook and scripted input driver will provide substantially clearer gameplay evidence.

## Recommended reproducible input/state harness

Separate the simulation from rendering and transport. Define a pure tick step with serializable state, a fixed tick duration, a seeded random generator and normalized player commands. Keep wall-clock time, DOM input, sockets, audio and particles outside that step.

Suggested case record:

```json
{
  "schemaVersion": 1,
  "caseId": "returning-ring-blocked-by-cover",
  "buildRevision": "record-at-run-time",
  "seed": 41827,
  "tickRate": 60,
  "configHash": "record-at-run-time",
  "mapHash": "record-at-run-time",
  "initialState": {},
  "commands": [{ "tick": 12, "playerId": "p1", "sequence": 1, "moveX": 0, "moveY": 0, "aimX": 1, "aimY": 0, "throwPressed": true }],
  "expectedEvents": [],
  "expectedFinalState": {}
}
```

Emit stable event IDs and tick numbers for throw, return, catch, reflection, shield break, elimination and round outcome. Save state hashes at fixed checkpoints, and dump the first divergent tick plus nearby inputs. Compare exact discrete state and documented numeric tolerances for motion. Sort identities before serialization. Keep presentation effects out of gameplay hashes.

Minimum cases should exercise:

- Throw, outbound travel, return and catch, including owner movement and owner elimination.
- A corner, wall grazing, projectile collision and simultaneous opposing actions.
- Explicit priority for deflection, shield absorption and elimination on the same tick.
- Dash start/end boundaries and held-button versus pressed-button behavior.
- Round end once only, a draw, reset, seeded spawns and illegal spawn prevention.
- Duplicate, late, stale and reordered network commands; disconnect/rejoin; bot takeover if selected.
- Two browser clients observing one authoritative result while the server independently rejects impossible speed and duplicate attacks.

Use the same recorded case for headless simulation and browser playback. The browser layer should expose read-only debug state in development, plus fixed-tick stepping and input injection in the test harness. Capture screenshots at named checkpoints for readability; use state/events for mechanics correctness. Run meaningful mutation checks such as removing a catch condition, extending a dash one tick, or applying a score event twice.

For online play, nominate a single authority for collisions, eliminations, score and round lifecycle. Clients send sequenced input; they must not author authoritative positions or outcomes. Test latency/jitter and reconnection separately from deterministic simulation. None of this netcode is supplied by the public Boomerang Fu description or proven by the saved REA experiments.

## Remaining limits

No blocker prevents an original implementation from this research. Exact reference-game parity remains unsupported because no authorized gameplay artifact, controllable reference session, or measured input/output trace was available. Current REA upstream release and provider readiness were not revalidated; the concrete local installation is 6.7.0. No independent run of the historical lab checks occurred. A standalone REA clone and the user's mentioned fork location remain unconfirmed, but the saved reference and installed package have been located precisely.
