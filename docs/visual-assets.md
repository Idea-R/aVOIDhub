# Visual asset record

Updated: 2026-08-20

## First-party game captures

These images are direct browser captures of Ideas Realized game properties, recorded for the “Other games by Ideas Realized” directory cards. They are presented as editorial previews and link to the source domains.

| Game | Source | Local asset | Capture state | Usage |
| --- | --- | --- | --- | --- |
| Bloomfall | https://bloomfall.io/ | `apps/platform/public/games/bloomfall-live.webp` | Character selection | Directory card |
| Acrolis Crawlers | https://play.acrolis.io/ | `apps/platform/public/games/acrolis-live.webp` | Local-guest game menu | Directory card |
| Tic Tac Toe in 3D | https://ttt3d.app/local | `apps/platform/public/games/ttt3d-live.webp` | Local game board | Directory card |

Captured at a desktop browser viewport on 2026-08-19 and converted to WebP without compositional edits.

## Generated aVOID atmosphere

- Mode: built-in image generation, new asset
- Selected asset: `apps/platform/public/avoid-depth-field-v1.webp`
- Original generated output: `C:\Users\palli\.codex\generated_images\01a00f3a-a9f2-72a0-816e-f2bfa0734e94\exec-e415d304-4ef7-4471-a15c-ca23eec903a5.png`
- Usage: low-opacity background texture for the external-games section; it is not presented as game artwork.
- Known limitation: generated texture is intentionally abstract and carries no product information.

Prompt summary: wide, text-free editorial arcade atmosphere using dimensional glass planes, teal and acid-lime orbital lines, one coral signal glow, halftone grain, and central negative space on a dark void field.

## Proposed meteor identity

- Mode: built-in image generation with an existing aVOID meteor artwork reference, followed by deterministic transparency extraction after two generated PNGs baked a checkerboard into the image.
- Selected working asset: `apps/platform/public/brand/avoid-meteor-mark.png`
- Usage: header and footer brand lockups, install manifest, and the visual basis for the deterministic SVG favicon.
- Status: proposed working identity pending owner review; implemented in the draft preview, not production.
- Original generated outputs:
  - `C:\Users\palli\.codex\generated_images\01a00f3a-a9f2-72a0-816e-f2bfa0734e94\exec-252549ca-dec6-4816-8c07-43453da9b54e.png`
  - `C:\Users\palli\.codex\generated_images\01a00f3a-a9f2-72a0-816e-f2bfa0734e94\exec-3ae7217f-caa3-43a7-9700-ce3d81583270.png`
  - `C:\Users\palli\.codex\generated_images\01a00f3a-a9f2-72a0-816e-f2bfa0734e94\exec-1bd0d6bb-06d1-4f25-89d6-12d24ec2f84b.png`

Prompt summary: a compact vector-friendly meteor emblem derived from the fiery aVOID game icon language—faceted dark core, cyan rim, coral/orange speed tail, a small acid-lime spark, no text, and a silhouette that remains readable at favicon size.

## Ideas Realized social source

Reviewed `https://ideas-realized.com/` on 2026-08-19. Its elevated right-side social rail, reveal labels, shadows, and press depth informed the aVOID signal dock. The aVOID implementation uses its own darker arcade-hardware treatment and the verified Ideas Realized destinations for X, Instagram, Facebook, and LinkedIn.

## Founding Player medal

- Mode: built-in image generation, new project asset, followed by one background-extraction attempt.
- Selected asset: `apps/platform/public/brand/founding-player-medal-v1.png`
- Original generated output: `C:\Users\palli\.codex\generated_images\01a00f3a-a9f2-72a0-816e-f2bfa0734e94\exec-5f48fb11-b1aa-4ea9-a3a8-a8abba054126.png`
- Usage: dimensional membership artifact. All labels remain accessible HTML; the generated image contains no product copy.
- Known limitation: the background-extraction pass returned an opaque white background. The site integrates it with `mix-blend-mode: multiply` inside a clipped, container-owned composition rather than presenting it as transparent.

Prompt summary: an asymmetrical meteor-shaped enamel and molded-rubber collectible with a crown notch, chunky black bevels, cream enamel, cyan edge light, acid-lime accent, and orange impact streak; no text, circular seal, generic achievement badge, or UI container.
