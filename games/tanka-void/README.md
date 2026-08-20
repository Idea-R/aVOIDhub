# TankaVOID

TankaVOID is a focused five-wave tank survival game built around one question: which armor plate are you willing to show the next shot?

The release candidate has one deterministic 60 Hz simulation, four enemy identities, a final commander wave, keyboard/pointer controls, a browser-tested two-thumb candidate, procedural sound, reduced motion, and an optional provisional platform-result flow. Guest play remains complete when the platform is unavailable.

The aVOID catalog must keep TankaVOID **Coming Soon** until the isolated database acceptance matrix, physical-device checks, deployed smoke test, and rollback gate all pass.

## Commands

From the repository root:

```powershell
npm run dev --workspace=@avoid/tanka-void
npm run verify:release --workspace=@avoid/tanka-void
npm run verify:tankavoid:release
```

The development URL is `http://localhost:5175/TankaVOID/`. Add `?smoke=1` for the local diagnostics strip and lifecycle controls. Add `?touch=1` to inspect the touch candidate in a pointer-capable desktop browser. Production builds write to `dist/TankaVOID/` and are copied into the platform assembly as a held review artifact.

## Release contract

- World: 1200 × 720 logical pixels.
- Simulation: fixed 60 Hz, at most five catch-up steps per rendered frame.
- Run: five fixed waves, nine enemies, one final commander.
- Input: keyboard hull control, pointer turret aim, primary-click cannon, Escape pause; touch remains a candidate until physical iOS and Android evidence exists.
- Damage: impact point chooses the armor face; shell travel against the face normal chooses penetration, glancing, or ricochet.
- Score: the platform creates the run identity and seed, checks a bounded natural-terminal summary, and recomputes the score. Trust stays provisional.
- Failure: an unavailable platform never blocks or invalidates local guest play.
- Budgets: 120 KiB initial compressed transfer, 260 KiB largest JavaScript asset, no downloaded media or external runtime assets.
- Public state: no friendly Play route and no catalog Play action until all release gates pass.

See [the V1 contract](../../docs/tankavoid-v1-contract.md), [T6 platform evidence](../../docs/sprint-tankavoid-t6.md), and the root release command for the current acceptance boundary.
