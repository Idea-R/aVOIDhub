# BoomerangaVOID simulation

Pure TypeScript, fixed 60 Hz, JSON-serializable authoritative rules. No DOM, sockets, wall clock, or hidden random state.

```ts
const state = createMatch(config, seats);
step(state, { ...getBotInputs(state), ...humanInputs });
```

Call `getBotInputs` on the persistent authoritative state before each step. It records delayed bot perception and decision memory in `state.internal`; preserve that field when cloning snapshots. Human input is normalized defensively; the server must additionally validate seat ownership, sequence numbers, and rate limits. Buttons are held states: the simulation recognizes fresh edges and a five-tick input buffer. `step` mutates its state. `restartMatch` returns a fresh state. `releaseRelaySeed(state, seatId)` drops the carrier's objective immediately on disconnect without eliminating the seat or adding protection.

Exports include canonical types, `RULES`, six `ARENAS`, six `CHARACTERS`, eight `UPGRADES`, `createMatch`, `step`, `getBotInputs`, `restartMatch`, `releaseRelaySeed`, and `stateHash`.

`getArena(state)` resolves the current round's arena, including local studio drafts and ordered stages. `platformPosition(state, platform, tick?)` gives the deterministic triangle-path floor position; `isShutterClosed(state, hazard)` includes pressure-plate overrides. Use these same helpers in rendering. Tideglass floors carry grounded riders and provide swept support over actual pits. Dash crosses unsupported floor only while active; falling ignores combat shields and spawn protection. Foundry plates open their target shutter while occupied and for four seconds after release. `state.switches` serializes shutter expiry ticks and resets at each round.

Local studio configuration may provide `arenaDraft`, `enabledUpgrades`, and one to six canonical `stageIds`. Draft and list data are copied at match creation. Stages rotate at round boundaries; a draft applies when the selected stage matches `mapId`. An empty upgrade pool suppresses new drops. These fields are local-only and must be rejected at online admission.

Combat uses continuous moving circle/rectangle/sector contacts. Groups within normalized tick time 0.0001 resolve terrain and projectile clashes, deflections, catches and objective pickup, defenses, then batch damage. Paths are rebuilt after contact changes. Original owner and current damage attacker remain separate. Death and scoring are emitted once; same-time trades remain possible. Walls use conservatively expanded rectangular colliders. Dash is ten ticks (166.7 ms), covering 2.5 units, followed by normal movement control; it grants no weapon immunity.

FFA and teams use countdown, one-life rounds, closing boundaries, round/match results and fresh rematches. Relay uses two teams, the neutral seed, alternating targets, contested half-second dwell, three deliveries, a five-minute clock with tied sudden death, carrier shove, shield drops, respawns, and visible protection. All eight upgrades have bounded effects and weapon slots; two passives plus one shield are allowed. A third passive explicitly replaces the oldest. All passive pairs are permitted by content data.

Run from the repository root:

```text
npm test --workspace=@avoid/boomerangavoid-sim
npm run typecheck --workspace=@avoid/boomerangavoid-sim
```

Coverage includes action boundaries, fractional movement and continuous facing, independent movement/aim dash direction, moving-floor support and swept falls, pressure-plate collision/expiry, local stage order and upgrade pools, replay cloning, movement and thin-wall sweeps, blocked recall and safe rematerialization, simultaneous trades and earlier death invalidation, shield grace, reflected owner/team handling, one-time scoring, full Relay objective rules, every upgrade, all 21 passive pairs, authored objective/spawn clearance, and six-bot runs on every arena. Three earlier isolated mutations (double scoring, one extra dash tick, omitted catch) were each detected by the tests; see `verify/mutation-results.json`. Mutations were applied only to disposable local test copies, never to this package's final source.

`stateHash` includes the rules, authored content, upgrade definitions and complete state, with sorted object keys and floats rounded to 1e-9. Replay tests compare cloned Node states and seeded bot decisions. Cross-browser/runtime replay equivalence, human feel, arena tactical balance, and target-device performance still require integration evidence. Bots use delayed legal inputs with reactive cover/gap steering; their skill balance needs live playtesting. Package tests do not establish hosted networking, rendering, or authentication readiness.
