# Sprint 05 — Encounter Depth Asset Manifest

Initial designs generated 2026-09-03 with the built-in image-generation tool in reference-image mode. Scene v2 WebPs remain current. Enemy v2 files below are historical rejected drafts, not runtime assets. The eight accepted v3 cutouts and native PNG masters are recorded in `../sprint-06/NATIVE-ALPHA-HASHES.json` and backed up with the game.

## Shared scene recipe

Create a wide RailAVOID encounter backplate in the Signal Box Storybook style: clean hand-inked dieselpunk fantasy, smooth matte gouache color fields, controlled cel-like shading, deep navy shadows, tarnished brass light and subtle violet void contamination. Keep open readable foreground space for combatants. No paper grain, noisy speckles, decorative border, text, logos or UI. The environment should establish a specific moment rather than look like a generic background.

Scene subjects:

- `lantern-camp-v2.webp`: a lonely improvised railway camp and signal lantern beside broken track at night.
- `ruin-approach-v2.webp`: a train-side away team approach to a monumental buried ruin entrance at the edge of the void.
- `buried-concourse-v2.webp`: an underground railway concourse with clocks, lamps, collapsed masonry, rails and a distant blue-green passage.
- `void-sanctum-v2.webp`: the final underground chamber, fractured stone and rail architecture overtaken by controlled violet void light.

## Shared enemy portrait prompt

> Create a production-ready enemy combat avatar for the RailAVOID browser game. Match the supplied character design closely. Dark storybook dieselpunk fantasy, precise ink outlines, restrained painterly texture, muted iron and soot palette with one controlled accent color and brass details. Use a centered three-quarter full-body pose with all important anatomy and gear visible. Remove the entire backdrop and return a genuine transparent RGBA cutout with no vignette, smoke, floor, shadow, border, text, UI or logo.

Subject suffixes:

- Rail Thug: wiry human railway marauder in a patched long coat and cap, steel rail-club, rust-red scarf.
- Void Hound: lean unnatural quadruped with charcoal hide, jagged violet crystal growths and faint internal glow.
- Void Shade: tall spectral humanoid in shredded railway-worker remnants, smoky lower body, lavender eyes and wisps.
- Scrap Brute: massive scavenger in riveted boiler plate, chains and railway scrap, with an amber furnace glow.

Image Gen's extraction previews baked the checkerboard into opaque RGB pixels. The subsequent v2 alpha-extraction experiment also failed visual review because fringes and enclosed background pockets remained. These enemy files are rejected local drafts, not accepted production assets. The extraction utility was removed. The correction pass now requires native GPT Image 1.5 transparency and light/dark inspection; see `../sprint-06/NATIVE-ALPHA.md`.

## Scene runtime files and historical rejected enemy drafts

| File | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/art/scenes/lantern-camp-v2.webp` | 1600×900 | 138256 | `7ee032f6c9925c8dd72315d92b9326ca2d7812ab8d79ce802909960a9629221d` |
| `public/art/scenes/ruin-approach-v2.webp` | 1600×900 | 188812 | `a312d040335d2f6d1af37d471feeb6d7a271c2bae0657118411f436ea99601b4` |
| `public/art/scenes/buried-concourse-v2.webp` | 1600×900 | 166646 | `adc802f70122800bee8ef4ff46f1d8960887281eeb86bbe9bb07baaf08c8ee9d` |
| `public/art/scenes/void-sanctum-v2.webp` | 1600×900 | 179262 | `6d8b4685ba12214c6ee73314541112dc224986ebf97e4f8fe38f9ecffd8ef531` |
| `public/art/enemies/rail-thug-v2.webp` | 480×600 | 38252 | `dee3aef4b9c7f93a95ed072f2cfad1ebc5ff55fd8655553e66b1b6aa1f37e59f` |
| `public/art/enemies/void-hound-v2.webp` | 480×600 | 59998 | `8260457ec447f16a1d3d75c8d71d2464ddd3039537a40005ee3194beed35c7ba` |
| `public/art/enemies/void-shade-v2.webp` | 480×600 | 77422 | `c878411b28c4dce4c8c2044af7013afd0497177c8cd363825a99ffcc632060c1` |
| `public/art/enemies/scrap-brute-v2.webp` | 480×600 | 55706 | `4bd2387c6dbdeca604e65bba8be41ed22eda367170e941cdf181c48e4da03b22` |

## Runtime mapping

- Mystery cache uses Lantern Camp. Survivor, damaged weapon, ambush and dock now have distinct scenes; see the Sprint 06 manifest.
- Expedition-site and away-team cards use Ruin Approach.
- Expedition stages use Ruin Approach → Buried Concourse → Void Sanctum.
- Enemy kind keys `thug`, `hound`, `shade`, and `brute` now map to their matching accepted v3 avatar, alongside four new Sprint 06 kinds.

## Acceptance

- All scene files decode at 1600×900; all enemy avatars decode at 480×600 with true alpha and transparent corner pixels.
- Focused browser verification checks event art, stage-one formation, portrait loading, swap behavior, the stage-clear decision, stage-two scene change, and 1280×720 bounds.
- Scene files above the earlier 220 KB character-art budget are accepted because that budget was intended for cutouts. They remain below 260 KB and replace several procedural backdrop layers.
