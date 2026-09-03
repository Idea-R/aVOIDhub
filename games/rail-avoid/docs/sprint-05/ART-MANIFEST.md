# Sprint 05 — Generated Art Manifest

This records immutable generation inputs and the derived runtime assets. Runtime files are accepted only after identity, matte, bounds, size and in-game readability review.

## Conductor combat master v1

- Identity reference: `public/art/crew/conductor.webp`
- Immutable keyed source: `docs/sprint-05/art-source/conductor-combat-v1-key.png`
- Derived alpha review source: `docs/sprint-05/art-source/conductor-combat-v1-alpha.png`
- Runtime mapping: `public/art/crew/conductor-combat.webp`
- Composition: full body, three-quarter right-facing command pose, complete silhouette, no baked scenery or shadow.
- Style lock: Signal Box Storybook; hand-inked contours, restrained gouache, navy railway greatcoat, brass trim and subtle violet rim light.
- Generation note: the first otherwise-accepted generation returned a baked checkerboard and was rejected. The accepted source was regenerated against a controlled green key and passed deterministic alpha extraction.
- Dimensions: 1086 × 1448 px; visible bounds `[141, 44, 932, 1409]`.
- Keyed source: 1,566,591 bytes; SHA-256 `EDE0F79CC03DEEAC1A7490FCAA68CB6A27DBDF8E8460EEC7ECA565B8EAD9F6B7`.
- Alpha review source: 930,346 bytes; SHA-256 `CF9A40E470A98FE8CE7A9D8C1B5E9C8B42C9A6AC09A4F4BD0B4EB22921E5EFF7`.
- Runtime WebP: 80,718 bytes; SHA-256 `D9D605B66B9B9DCBB945FC5A5E00F39196FC5CF1A67981847AEB0EC75E4B347A`.
- Acceptance: true alpha confirmed, 1,125,977 fully transparent pixels and 1,858 antialiased edge pixels; integrated into the expedition stage with the existing portrait in the party picker.

Primary generation prompt:

> Create a production-ready full-body combat character master for the same woman shown in the identity reference. Preserve her recognizable face, conductor cap, navy greatcoat, brass trim, whistle and capable serious personality. Show her facing right in a commanding ready stance. Use expressive model-railway proportions, hand-inked contours and restrained gouache. Keep the complete isolated character readable at 96 px, with no scenery, typography, frame or cropped limbs.

Isolation correction:

> Preserve the character exactly and replace every background pixel with one controlled chroma-key field. Add no shadow, scenery, gradient, texture, checkerboard, text or frame.
