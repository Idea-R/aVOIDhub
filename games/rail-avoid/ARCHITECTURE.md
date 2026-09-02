# RAILaVOID — Architecture

Vite + TypeScript + Phaser 3.90. Strict separation between the **simulation** (pure data, deterministic, no Phaser) and the **presentation** (Phaser scenes + DOM UI + Web Audio).

```
src/
  core/      contracts & primitives: types.ts, config.ts, hex.ts, rng.ts, events.ts, cars.ts, enemies.ts
  sim/       deterministic simulation: worldgen, train, route, combat, waves, bosses, weather, passenger events, campaign, save
  render/    Phaser presentation: textures (procedural), map, track, train, enemies, fx, weather, camera
  ui/        DOM panels (title, settings, pause, inspector, shop, events, results) + Phaser HUD
  audio/     Web Audio procedural synth & mixer
  debug/     window.__RAIL developer API + scripted autopilot agent
  main.ts    boot
verify/      Playwright harness (npm run verify)
```

## Determinism
- `SimState` is plain JSON; `Sim` holds it and mutates it in `tick(dt)`.
- Fixed step: 50 ms sim ticks driven by an accumulator; render interpolates.
- All randomness from `Rng` (mulberry32) seeded from the run seed; separate streams for worldgen, waves, events, combat so UI-driven timing does not perturb world generation.
- Save = `JSON.stringify(state)`; load = replace state, re-hydrate derived caches.

## Coordinates
- Flat-top hexes, even-q offset storage (`col,row`), axial `(q,r)` for math.
- World px: `x = R*1.5*q`, `y = R*sqrt(3)*(r + q/2)`. Iso projection: screen `(x, y*ISO_Y)`.
- Enemies live in world px (unprojected); rendering projects.

## Event Bus
`core/events.ts` typed emitter. The sim emits gameplay events (damage, fire, spawn, etc.); render/audio/ui subscribe. UI never mutates state directly — it calls `Sim` commands.

## Propagation (train)
Recomputed each tick in `sim/train.ts`: power spans, heat diffusion, ammo supplier reach, boarding movement. Results cached per car in `car.derived` for UI.

## Wave Director
`sim/waves.ts`: threat budget from region, time, tile threat, stop pressure, day/night. Composition tables per region with **adaptive weights**: the director tracks which weapon classes made kills recently and biases toward enemies that class cannot answer.

## Rendering Layers (depth order)
terrain RT → void → track (diagram) → settlements → ground enemies/train (y-sorted) → projectiles → air → fx → weather → tint → HUD.

## Verification
`verify/verify.mjs`: launches Chromium (Playwright) against `vite preview` (builds first), uses `window.__RAIL` to seed 12345, drive the autopilot, jump to regions/bosses, force victory/defeat, capture screenshots, measure FPS, collect console errors and failed requests, and writes `verify/report.json` + `verify/report.md`.
