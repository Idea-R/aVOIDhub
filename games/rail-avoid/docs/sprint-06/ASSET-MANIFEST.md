# Sprint 06 Asset Manifest

Status: native-alpha correction accepted and hosted-preview verified for release PR #60. All current enemy runtime files use `-v3.webp`, generated through GPT Image 1.5 with `background=transparent`. Eight of eight native PNGs pass structural and light/dark visual review; remote files match the accepted hashes. Current source/runtime filenames and hashes are in `NATIVE-ALPHA-HASHES.json`; prompts and correction history are in `NATIVE-ALPHA.md`. The v2 enemy table below is historical provenance for rejected drafts stored outside public assets. Scene v2 files remain current. Publication evidence is linked from `RELEASE.md`.

Scenes and original enemy designs were generated with the built-in image-generation tool. Current enemy cutouts were corrected using the explicitly authorized GPT Image 1.5 API and then encoded as compact alpha WebPs. The supplied September 2 RailAVOID illustrations and the accepted Sprint 05 assets were style references.

## Shared encounter-scene prompt

> Repaint the RailAVOID encounter in a clean hand-inked storybook style with smooth matte gouache color fields, controlled cel-like shading, confident contours and larger readable shape masses. Preserve the narrative subject, staging, camera angle and 16:9 composition. Keep the deep navy, aged brass, amber lantern and restrained violet palette. Avoid paper/canvas/film grain, stippling, noisy speckles, gritty overlays, excessive micro-detail, text, UI and decorative borders.

| Runtime file | Encounter | SHA-256 |
| --- | --- | --- |
| `public/art/scenes/false-signal-v2.webp` | `mystery_ambush` | `a86aebd3f807861db252c8a8b2f7a5a2c582650e204ab5f3dfecd063a343a4ac` |
| `public/art/scenes/rainbound-survivor-v2.webp` | `mystery_survivor` | `420bbc74dfba71b6950a7b3c7321fe70235cdf402dc2bee444eb3552107dab6b` |
| `public/art/scenes/abandoned-gun-car-v2.webp` | `mystery_weapon` | `7c2627749f9ce652f92ddb677e006f4f3622f3b56f996337fc509cf0a6ba726f` |
| `public/art/scenes/waterside-rail-dock-v2.webp` | `mystery_dock` | `8791f34f357dda21511e7e3ea38d306f3b57691c9e40ee65c498a3863fb29774` |

The four subject prompts respectively specify: a red false signal and raider barricades; a lone female gunner shielding a lantern in heavy rain; a repairable anti-air gun car on an overgrown siding; and a rail dock with a steam fishing launch, trade platform and short inlet bridge.

## Shared enemy-portrait prompt

> Isolate the RailAVOID enemy exactly as designed and remove the entire background. Output a genuine transparent RGBA cutout with alpha 0 outside the subject. Preserve its identity, pose, proportions, colors, gear, lighting and fine silhouette. Preserve semitransparent spectral edges only where the creature requires them. No backdrop, vignette, floor, shadow, frame, checkerboard, text, UI or cropped gear.

| Runtime file | Combat key | Range | SHA-256 |
| --- | --- | --- | --- |
| `public/art/enemies/ash-cult-fusilier-v2.webp` | `fusilier` | ranged | `187f0a019a76a9b9cec39deae1c769ad7427d462a5e659478606d3a5b572a8bf` |
| `public/art/enemies/rail-maw-crawler-v2.webp` | `crawler` | melee | `3b138186a03a8d6ee87622078f71c5e23db7d0c61de31251fe5a3246c3c62bb3` |
| `public/art/enemies/lantern-wraith-v2.webp` | `wraith` | ranged | `b693d8439bbfd723cc64fcfc47c34f02ea212fc022e7b32c12cf9de90c50d6f4` |
| `public/art/enemies/iron-sentinel-v2.webp` | `sentinel` | melee | `6ec054a4ad5787490a9bf02356c47bc6b08141c88aca21e7853f120b0be0366c` |

The individual subjects are a masked cult rifleman, a low four-legged bogie-and-furnace crawler, a floating spectral signalman with a chained beam lantern, and a plated ruin guardian with a pile-driver fist and shield forearm.

## Production treatment

- Scenes: 1600×900 WebP, quality 82.
- Avatars: 480×600 alpha WebP, quality 84 / alpha quality 100.
- The v2 checker-preview extraction experiment was rejected after visual review. Its utility has been removed. Native GPT Image 1.5 output is required for the correction pass; see `NATIVE-ALPHA.md`. No color-keying or mask reconstruction is permitted.
