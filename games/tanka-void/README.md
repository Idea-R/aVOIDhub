# TankaVOID

TankaVOID is being rebuilt as a focused directional-armor survival game. The current package is the T2 combat proof: one deterministic fixed-step simulation, one player tank, one bruiser, pooled shells, swept collision, and explicit front/side/rear impact resolution.

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
- Input: keyboard hull control, pointer turret aim, primary-click cannon, Escape pause
- Damage: impact point selects the face; shell travel versus its outward normal selects penetration, glancing, or ricochet
- Feedback: distinct impact shapes plus visible outcome, face, incidence, and damage text
- Touch: visibly deferred to T4
- Score, auth, leaderboard, purchases, platform staging, and public Play route: not active
- Runtime budgets: 120 KiB initial compressed transfer, 260 KiB largest JavaScript asset, no downloaded media or external runtime assets

See [`../../docs/tankavoid-v1-contract.md`](../../docs/tankavoid-v1-contract.md), [`../../docs/sprint-tankavoid-t0-t1.md`](../../docs/sprint-tankavoid-t0-t1.md), and [`../../docs/sprint-tankavoid-t2.md`](../../docs/sprint-tankavoid-t2.md).
