# Sprint 05 — Encounter Depth Asset Manifest

Generated 2026-09-03 with the built-in image-generation tool in reference-image generation mode. Runtime outputs were resized and encoded with Sharp as WebP. Generator originals remain in the Codex generated-image store; the game contains optimized derivatives only.

## Shared scene recipe

Create a wide RailAVOID encounter backplate in the existing Signal Box Storybook style: dark hand-inked dieselpunk fantasy, restrained gouache texture, deep navy shadows, tarnished brass light, subtle violet void contamination, no text, no logos, no UI, and no characters. Keep open readable foreground space for combatants and use a thin navy/brass/violet story-card border. The environment should establish a specific moment rather than look like a generic background.

Scene subjects:

- `lantern-camp-v1.webp`: a lonely improvised railway camp and signal lantern beside broken track at night.
- `ruin-approach-v1.webp`: a train-side away team approach to a monumental buried ruin entrance at the edge of the void.
- `buried-concourse-v1.webp`: an underground railway concourse with clocks, lamps, collapsed masonry, rails and a distant blue-green passage.
- `void-sanctum-v1.webp`: the final underground chamber, fractured stone and rail architecture overtaken by controlled violet void light.

## Shared enemy portrait prompt

> Create a production-ready enemy combat portrait for the RailAVOID browser game. Match the supplied character design closely. Dark storybook dieselpunk fantasy, precise ink outlines, restrained painterly texture, muted iron and soot palette with one controlled accent color, brass details, ominous but readable at small UI size. Three-quarter full-body heroic pose, centered, all important anatomy and gear visible. Place the character against a seamless deep midnight-navy vignette (#070b18) with faint smoke and a soft ground shadow. This is a deliberately rectangular game portrait, NOT a transparent cutout. Absolutely no checkerboard, no border, no text, no lettering, no UI, no logo, no multiple characters. Portrait 4:5 composition.

Subject suffixes:

- Rail Thug: wiry human railway marauder in a patched long coat and cap, steel rail-club, rust-red scarf.
- Void Hound: lean unnatural quadruped with charcoal hide, jagged violet crystal growths and faint internal glow.
- Void Shade: tall spectral humanoid in shredded railway-worker remnants, smoky lower body, lavender eyes and wisps.
- Scrap Brute: massive scavenger in riveted boiler plate, chains and railway scrap, with an amber furnace glow.

The first two alpha-removal attempts were rejected because the apparent checkerboard was baked into opaque RGB pixels. The accepted runtime approach uses intentionally rectangular navy portrait plates. Full transparent combat masters remain a later art-system deliverable.

## Runtime files

| File | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/art/scenes/lantern-camp-v1.webp` | 1600×900 | 178836 | `c51b238d7ab4a8b0c532990b02c2ac58873611334a0c0e3df8ec6f6f696a54ab` |
| `public/art/scenes/ruin-approach-v1.webp` | 1600×900 | 250114 | `1dc7d73290eff1e81567fe4b26a553f6837e0a174870bf5ac61ca9f873170760` |
| `public/art/scenes/buried-concourse-v1.webp` | 1600×900 | 203158 | `5156772fd4bf9a23b045fa05dc89c074fb313221e0e36e04eeec78d0f9b12c71` |
| `public/art/scenes/void-sanctum-v1.webp` | 1600×900 | 226200 | `629f062ceda5f5d2e9d4cd4f49198f13b6c93d1a3d20f2bc0ccae9876a2e975c` |
| `public/art/enemies/rail-thug-v1.webp` | 480×600 | 24396 | `378fe89faa4e84329356f1e3526d05cd390852181a88f757f707f8637e016c00` |
| `public/art/enemies/void-hound-v1.webp` | 480×600 | 29730 | `7fe6e4558408317f0a33843be1ddbe8c6f0df939acb79a498c758bc1e6ed0bd5` |
| `public/art/enemies/void-shade-v1.webp` | 480×600 | 29764 | `292f917040263e721417a568b9791f9f2347495d63d8150d42f8ac2f6c90a44d` |
| `public/art/enemies/scrap-brute-v1.webp` | 480×600 | 36116 | `41bd0b3409d39b2d5e9cb6dd1c04c0b2178a4283c44a6b7a27153e89149ae98a` |

## Runtime mapping

- Mystery cache, survivor, damaged weapon and ambush cards use Lantern Camp.
- Expedition-site and away-team cards use Ruin Approach.
- Expedition stages use Ruin Approach → Buried Concourse → Void Sanctum.
- Enemy kind keys `thug`, `hound`, `shade`, and `brute` map to their matching portrait plate.

## Acceptance

- All scene files decode at 1600×900; all enemy plates decode at 480×600.
- Focused browser verification checks event art, stage-one formation, portrait loading, swap behavior, the stage-clear decision, stage-two scene change, and 1280×720 bounds.
- Scene files above the earlier 220 KB character-art budget are accepted because that budget was intended for cutouts. They remain below 260 KB and replace several procedural backdrop layers.
