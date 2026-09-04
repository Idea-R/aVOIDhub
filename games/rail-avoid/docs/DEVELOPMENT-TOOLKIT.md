# RailAVOID development toolkit

Verified locally on 2026-09-04. Access below describes this Windows user/host, not every cloud task. Credentials never belong in this document or the repository.

## Game and release architecture

- Game: TypeScript, Phaser 3 and Vite in `games/rail-avoid`; deterministic simulation under `src/sim`, rendered world under `src/render`, DOM interface under `src/ui`.
- Whole site: Next.js platform in `apps/platform`, assembled with independently built games by `npm run build:platform:netlify` from the repository root. Do not deploy only RailAVOID to the shared site's root.
- Public URL: `https://avoidgame.io/railavoid/`, routed to `/RAILaVOID/`.
- GitHub: `Idea-R/aVOIDhub`, production branch `main`. Use a scoped release PR, verify a hosted preview, then merge/deploy when authorized.
- Netlify: existing site `coruscating-squirrel-a47ad9`, ID `780c1b04-64c7-47b6-9423-18953739590e`. CLI authentication was verified. Do not create a duplicate site.
- Local Netlify Next packaging currently fails on Windows resolving an `@swc/helpers` middleware dependency outside the repository. The application build itself passes. Prefer the hosted Linux build rather than modifying shared auth/middleware to work around local packaging.

## Image routes

1. Built-in Image Gen: concept exploration, clean scene paintings, reference-driven edits and composition studies. Inspect results; a checker-looking preview is not proof of transparency.
2. Native transparent sprites: the bundled ImageGen CLI with explicit `gpt-image-1.5`, `background=transparent` and PNG. This route was used successfully for all eight accepted v3 enemies. The audited edit path forwards the requested model directly and contains no model fallback.
3. Other providers: no second external image-provider credential was verified for RailAVOID in this pass. Discover an installed connector and confirm access when a concrete need arises; do not infer access from a package name. Heavy 3D/MCP helpers stay disabled unless needed.

Read `C:/Users/palli/.codex/skills/.system/imagegen/SKILL.md` before generation. The bundled CLI is `C:/Users/palli/.codex/skills/.system/imagegen/scripts/image_gen.py`. Discover the current Python runtime using workspace dependencies; the verified runtime here was `C:/Users/palli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`, with OpenAI/Pillow dependencies cached through `uv` outside source.

Load the configured Windows User credential only in the child PowerShell process running generation:

```powershell
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    throw 'OPENAI_API_KEY is not configured for this Windows user.'
}
```

Never print it, put it on a command line, dump the environment or persist it elsewhere. Standing user authorization covers reasonable task-scoped native generation/corrections; it does not cover unrelated spending or deployment.

Use the direct CLI recipe and prompts in `sprint-06/NATIVE-ALPHA.md`. On this Windows setup, convert a reference WebP losslessly to PNG for upload to avoid the SDK's `application/octet-stream` MIME rejection. Use one proof asset before a batch; keep requests sequential and obey retry delays on rate limits without changing models.

## Asset acceptance and storage

- Direction: `../BRAND.md` is current. Smooth clean gouache, confident ink shapes, no paper/canvas grain. The UI draws frames; scenes do not bake them in.
- Accepted masters: `output/imagegen/native-alpha/*.png`, intentionally backed up in Git. Rejected variants: ignored `output/imagegen/rejected/`; temporary references: ignored `tmp/imagegen/`.
- Runtime: `public/art/enemies/*-v3.webp` and `public/art/scenes/*-v2.webp`; crew and cars have separate families. Current enemy hashes: `sprint-06/NATIVE-ALPHA-HASHES.json`.
- `npm run verify:avatars`: native source alpha/framing checks and light/dark QA composites. Inspect those composites manually for halos, ground shadows, enclosed holes and cropped extremities. QA composites are not deliverable backgrounds.
- `tools/export-native-avatars.mjs`: accepted alpha-preserving crop/contain/padding and WebP export. No colour-keying, checker extraction or mask reconstruction. Treat its current v3 batch as provenance, not a command to overwrite accepted assets.
- Keep stable asset keys in content definitions; avoid storing paths or image data in save files. Use versioned names for replacements to avoid stale cache ambiguity.

## Verification commands

From the repo root, append `--workspace games/rail-avoid` to package commands:

- `npm run dev`: local game at port 5178, `/RAILaVOID/`.
- `npm test`: deterministic simulation/unit tests.
- `npm run verify`: built-game campaign, controls, combat, bosses, persistence, resize and replay gates.
- `npm run verify:expedition -- --url=https://<preview>/RAILaVOID`: scene loading, staged battle, formation/swap and viewport tests. Debug fixtures affect only local browser simulation.
- `npm run verify:hud`, `verify:inspector`, `verify:usability`, `verify:junction`: focused regression tools; check each script's URL options before remote use.
- `npm run build:standalone` then `npm run check:standalone`: one-file offline artifact and browser smoke check.
- `npm run perf:headed`: GPU-backed performance work; do not equate software-rendered headless FPS with player hardware.

Next goal: `sprint-07/PLAN.md`. Shared ADS authentication belongs to the platform and needs server-side role validation; no game-local email allowlist.
