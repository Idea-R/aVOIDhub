# Asset and dependency provenance

Characters, arenas, meshes, UI logo, effects and oscillator audio are original task-authored work for Ideas Realized. No Boomerang Fu code, models, layouts, screenshots or audio were imported. The reference informed action vocabulary and pace only.

Editable geometry and animation: `assets-src/boomerangavoid/`; runtime geometry authoring and presentation: `src/render.ts`; generated audio: `src/audio.ts`. Runtime rendering uses the optimized procedural models/animation; matching GLB exports provide independently validated portable rigs and clips.

DM Sans and Outfit are locally bundled Fontsource variable fonts under OFL-1.1. Runtime library notices, including Three.js and Colyseus SDK dependencies, are retained in `public/licenses/THIRD-PARTY-NOTICES.txt` and copied into the build. Server node_modules retain their original licenses in the container.
