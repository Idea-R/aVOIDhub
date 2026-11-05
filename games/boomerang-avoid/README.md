# BoomerangaVOID client

Run from the repository root: `npm run dev --workspace=@avoid/boomerang-avoid`. Open the Vite URL at `/boomerangavoid/`. Build: `npm run build --workspace=@avoid/boomerang-avoid`; output is `dist/BoomerangaVOID`.

The menu opens over a live cosmic-garden diorama. Practice teaches movement, dash, slash, throw, curve and recall in a friendly duel. Couch Party supports 2–6 configurable seats, bots, two shared-keyboard layouts, connected standard gamepads, FFA, teams and relay. Keyboard rollover depends on hardware.

Default keyboard 1: WASD / Space / J / K. Keyboard 2: arrows / Enter / Numpad 1 / Numpad 2. Gamepad: left stick / south / west / east, optional right-stick aim. Settings remap keyboard keys and gamepad buttons. Touch controls use independent pointer capture for simultaneous movement and actions.

`src/net.ts` is the authoritative transport adapter boundary. It must receive server snapshots and send normalized inputs. Online cannot infer wins locally. Local scores are session-only. No hosted server or production online availability is implied by a local build.

Development builds expose a read-only `window.__BOOMERANGAVOID__` snapshot with readiness, screen, simulation state, hash, controls and renderer/frame metrics. No state mutation fixture exists in production or development.

Browser checks should cover 390×844, 844×390, a desktop viewport, keyboard focus, real movement/dash/throw/recall/slash inputs, match completion and rematch. Emulated touch and virtual gamepad tests do not establish physical-device evidence.
