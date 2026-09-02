# RAILaVOID

*A moving-train logistics and tower-defense roguelite by aVOID Games.*

You command the last train on a continent that is falling into the void. The void front eats the map from the west; you drive east toward the Last Gate. Your train is your base: every car you couple on is a decision about power, heat, ammunition, weight and who gets rescued. Plan track ahead of the locomotive, keep moving (stopping raises the attack pressure), reach settlements before the void takes them, defend the convoy against raiders that board the actual cars, and adapt the train at repair yards. Cross four regions, beat three bosses and breach the Last Gate to win. Lose the locomotive - to enemies, heat, a sapper charge or the void - and the run derails.

## Screenshots

Captured by `npm run verify` into `verify/screenshots/`:

| File | What it shows |
|---|---|
| `title.png` | Title screen after boot |
| `tutorial.png` | First seconds of a run (tutorial card) |
| `early_game.png` | Region 1 after ~2 minutes of autopilot |
| `combat.png` | A spawned wave (raiders, hound, crawler) under fire |
| `mid_game.png` | Region 3, The Ash Steppe |
| `boss_boss_wagon.png` / `boss_boss_brood.png` / `boss_boss_maw.png` | The three bosses |
| `victory.png` / `defeat.png` | Results screens |
| `resize_800x600.png` | Layout at a small viewport |

## Art direction

See `BRAND.md` for the palette, typography, visual language, asset specs and ready-to-paste image-generation prompts used for cutscene frames, event cards, relic icons and key art. The scripted opening plays on a profile's first run and can be replayed from the title menu (Watch intro).

## The map

Three main lines cross the continent: the Central Line (balanced), the Northern Line (mines and armouries, dangerous) and the Southern Line (villages and farms, calmer). Pre-laid crossovers connect them once or twice per region; anywhere else you can cut your own track between lines for rails and time. Junction stops show each branch's line and next settlement.

## Music

The score is seven instrumental tracks generated with Suno for this project (`public/audio/*.mp3`, mapped by mood in `public/audio/manifest.json`). If a track is missing the game falls back to its built-in procedural score, so the game is fully playable without the files.

## Quick start

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # typecheck + production build into dist/
npm run preview          # serve dist/ on http://localhost:4173
npm run verify           # build, launch headless Chromium, run every gate, write verify/report.md
npm run build:standalone # single-file build: dist-standalone/railavoid.html (runs from file://)
```

### Launching Chrome

Start the dev server (`npm run dev`) or preview server (`npm run preview`, port 4173) first, then:

**Windows** (cmd / PowerShell)

```bat
start chrome http://localhost:5173
"C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window http://localhost:5173
```

**macOS**

```bash
open -a "Google Chrome" http://localhost:5173
```

**Linux**

```bash
google-chrome http://localhost:5173
# or: chromium http://localhost:5173
```

**Standalone single file** (after `npm run build:standalone`, no server needed)

```bat
start chrome "%CD%\dist-standalone\railavoid.html"
```

```bash
open -a "Google Chrome" dist-standalone/railavoid.html      # macOS
google-chrome "$PWD/dist-standalone/railavoid.html"         # Linux
```

Replace `5173` with `4173` to open the preview build.

## Controls

| Input | Action |
|---|---|
| Left click on a hex | Plan track (hexes must be adjacent to the plan end and within range) |
| Double click on a hex | Auto-plan a route toward that hex |
| Click a car | Inspect it |
| Right-click drag / middle drag | Pan the camera |
| Mouse wheel, `+` / `-` | Zoom |
| `Space` | Pause / resume |
| `1` / `2` / `3` | Speed 1x / 2x / 4x (4x only with `?dev`; `3` maps to the fastest allowed) |
| `Backspace` | Unplan the last tile (refunds rails) |
| `Space` / `Enter` (in an expedition) | Timed hit: press as your strike lands or as an enemy blow arrives to guard |
| `Enter` | Skip an announcement card (or confirm a cursor plan) |
| `R` | Reverse: back the train down its own track (half speed, full speed with a Caboose); press again to stop and re-plan |
| `D` | Detach the selected car and everything behind it |
| `Tab` | Train panel |
| `Esc` | Menu / close panel |
| `M` | Mute |
| Gamepad | Left stick pan, D-pad / right stick moves the planning cursor, `A` plan, `B` unplan, `Start` pause |

## How to play

1. **Plan ahead.** Click hexes in front of the locomotive. Pre-laid rail (the faint network) is free to follow; new track costs rails and depends on terrain (plains 1, forest/ruins/ash 2, hills/crystal 3, water 4, mountains are impassable).
2. **Keep moving.** The void advances from the west and stopping raises stop pressure, which brings waves faster. Settlements stop the train briefly to load cargo, passengers and crew; depart early with the button if things look bad.
3. **Feed the machine.** Coal burns per hex and scales with weight; food feeds passengers; ammo feeds turrets (they need an ammo supplier car within two positions); rails build track; scrap buys cars and repairs at yards.
4. **Build the train.** Generators power cars within three positions (brownouts when demand exceeds supply); hot cars heat their neighbours and catch fire at 100; radiators cool. Barracks and flamethrowers purge boarders; armour plates block them. Order matters, so reorder at yards.
5. **Answer each enemy.** Raiders board, hounds slow you, crawlers ram and shrug off bullets, harpies fly (flak), sappers mine your planned track (scout car reveals them), wisps ignore bullets and shells (tesla / flame).
6. **Reach the Last Gate.** Beat the Iron Wagon, the Brood Mother and the Void Maw. Score = settlements + passengers delivered + cars intact + time bonus.

## Deploy

The game ships inside the aVOID platform repo (`C:\devVOID-main`, GitHub `Idea-R/aVOIDhub`, Netlify site avoidgame.io). To publish: copy this folder into `games/rail-avoid` (keep that folder's `package.json`/`vite.config.ts`, exclude node_modules/dist/verify screenshots), run `npm run build:platform:netlify` at the repo root, commit and push `main`; Netlify builds in about a minute. `DIRECTION.md` holds the current master plan and hand-off prompts.

## Dev shortcuts

Load the game with `?dev` (for example `http://localhost:5173/?dev`) to allow 4x speed and to mark the page as a dev session (`window.__RAIL_DEV === true`).

`window.__RAIL` is always installed and drives the verification harness:

| Member | Purpose |
|---|---|
| `version`, `ready` | `'1.0.0'`, `true` once the app has booted |
| `ctx`, `state`, `sim`, `view` | AppContext, live SimState, SimApi, ViewApi |
| `autopilot.setEnabled(on)`, `autopilot.status()` | Scripted player (routes, shops, resolves events, assigns crew, departs) |
| `newRun(seed?)`, `continueRun()`, `quitToTitle()` | Run flow |
| `warpToRegion(n)`, `spawnWave(types[])`, `spawnBoss(type)` | Jump around the campaign; `type` is `boss_wagon` / `boss_brood` / `boss_maw` |
| `forceVictory()`, `forceDefeat(reason)` | End the run |
| `setSpeed(0|1|2|4)`, `pause()`, `resume()` | Flow control |
| `godTrain()`, `grant({scrap: 100})`, `addCar(type)`, `invulnerable(on)` | Cheats |
| `setWeather(kind)`, `setTime(t)`, `triggerEvent(id?)` | World state |
| `serialize()`, `restore(json)` | Save / load |
| `perf()`, `snapshot()` | Renderer counters, PNG data URL of the frame |
| `waitFor(pred, timeoutMs)`, `stepSim(seconds)` | Poll a predicate; synchronously fast-forward the sim |
| `summary()` | Compact JSON of phase, time, region, cars, resources, enemies, passengers, score, defeat reason |
| `errors[]`, `warnings[]` | Captured `window.onerror`, unhandled rejections, `console.error` / `console.warn` |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the sim / presentation split, determinism rules, coordinates and the rendering layers, and [GAME_DESIGN.md](GAME_DESIGN.md) for the rules of the game.

## Verification report

`npm run verify` builds the game, serves `dist/` with `vite preview`, launches headless Chromium (SwiftShader WebGL) and runs a sequence of gates: boot, start, controls, early game (autopilot), combat, mid game, the three bosses, save/load, victory/defeat, resize, performance, determinism (two seeded runs compared after 30 simulated seconds) and a blank-screenshot check. It writes `verify/report.json`, `verify/report.md` and `verify/screenshots/*.png`, and exits non-zero when a gate fails or any console error was seen. `perf_headless_note` is informational: software rendering in headless Chromium is slower than a real GPU, so re-run with `node verify/verify.mjs --headed` on a desktop to confirm frame rates. Use `--dev` to point the harness at a running dev server (or `VERIFY_URL`), `--url=...` for any other server, and `--help` for all options.

## License and attributions

All art, audio and content are generated procedurally in code. Third-party libraries and their licenses are listed in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
