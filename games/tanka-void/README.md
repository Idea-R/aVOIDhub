# TankaVOID

TankaVOID is being rebuilt as a focused directional-armor survival game. The current package is the T1 proving-ground foundation: one deterministic fixed-step simulation, one input owner, one responsive canvas viewport, and explicit briefing/run/pause/result/restart states.

It is not a public game build yet. The aVOID catalog must keep TankaVOID marked **Coming Soon** until the later combat, content, platform, device, deployment, and rollback gates pass.

## Commands

From the repository root:

```powershell
npm run dev --workspace=@avoid/tanka-void
npm run verify:release --workspace=@avoid/tanka-void
```

The development URL is `http://localhost:5175/TankaVOID/`. Add `?smoke=1` to expose local lifecycle controls and diagnostics. Production builds write to `dist/TankaVOID/`, which is intentionally not staged into the platform.

## Current contract

- Canonical world: 1200 × 720 logical pixels
- Simulation: fixed 60 Hz, maximum five catch-up steps per rendered frame
- Input: keyboard hull control, pointer turret aim, Escape pause
- Touch: not claimed in T1
- Score, combat, auth, leaderboard, purchases, and public Play route: not active
- Runtime budgets: 120 KiB initial compressed transfer, 260 KiB largest JavaScript asset, no downloaded media or external runtime assets

See [`../../docs/tankavoid-v1-contract.md`](../../docs/tankavoid-v1-contract.md) and [`../../docs/sprint-tankavoid-t0-t1.md`](../../docs/sprint-tankavoid-t0-t1.md).
