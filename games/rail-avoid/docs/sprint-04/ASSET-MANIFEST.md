# Sprint 04 Asset Manifest — Authored Rolling Stock

Generated with the built-in OpenAI image generation tool on 2026-09-03. Production files are optimized WebP assets in `public/art/cars/`; uncompressed explorations are retained as source references in `design/concepts/` and are not shipped to players.

## Shared production direction

Use this direction for every car so the consist reads as one kit:

> Create one production-ready 2D rolling-stock asset for RAILaVOID. Strict orthographic side elevation, entire rail vehicle visible from coupler to coupler and wheels to roof, centered horizontally. Hand-inked linework with restrained gouache shading, grounded in a late-19th-century industrial railway. Deep navy-black iron, soot, warm aged brass, muted olive or burgundy role accents, and only a restrained violet supernatural glow. Strong readable silhouette at small HUD scale, believable trucks, wheels, couplers, rivets, pipes and functional equipment. No people, no scenery, no rails, no text, no logo, no UI, no perspective, no cast shadow. Preserve generous breathing room around the vehicle. Use a perfectly uniform very dark navy background close to #0b0e1a so it disappears into the command-deck enamel panel. Landscape aspect ratio.

Subject addenda:

- `locomotive-v1.webp` — Compact armored steam locomotive; large boiler, smokestack, cowcatcher, cab and three driving wheels; brass valves and subtle violet boiler energy.
- `barracks-v1.webp` — Armored crew barracks carriage; olive-green plated body, narrow protected windows, roof vents, reinforced doors and practical crew-car details.
- `coal-bunker-v1.webp` — Open coal bunker wagon; clearly visible irregular coal mound, battered dark steel side walls and heavy undercarriage.
- `gatling-v1.webp` — Low armored weapon flatcar carrying one brass-and-steel rotary Gatling mount, ammunition chest and compact shield.
- `cargo-v1.webp` — Enclosed freight boxcar with sliding door, timber-and-iron construction, tied cargo details and readable freight-car silhouette.
- `coach-v1.webp` — Passenger coach with warm window glow, burgundy paneling, brass trim and a clear carriage rhythm.
- `gatling-v2.webp` — Preserve the level-I car exactly, then add a moderate field upgrade: improved armor shield, larger ammunition feed, braced mount and a few extra brass mechanisms. It must still be recognizably the same single-gun car.
- `gatling-v3.webp` — Preserve the same chassis and visual identity, then make the final upgrade unmistakable: twin-linked rotary guns, heavy shield, reinforced platform, dual ammunition feeds and restrained violet energy accents. Avoid turning it into a tank.
- `flak-v1.webp` — Low armoured anti-air flatcar with an unmistakable elevated autocannon, traverse gear, protective shield and shell-feed crates.
- `cannon-v1.webp` — Heavy railway artillery wagon with a long horizontal breech-loading cannon, recoil cradle, mantlet and shell racks.
- `radiator-v1.webp` — Cooling machinery wagon with three large radiator banks, copper plumbing, gauges, vents and restrained teal coolant indicators.
- `medical-v1.webp` — Protected burgundy-and-cream field-hospital carriage with warm frosted windows, roof vents, exterior medicine cabinets and a simple geometric medical emblem.

Second-batch runtime files were generated from the same three first-batch car references and exported at 1774×887. They retain the shared near-black navy presentation used by the existing card art:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `flak-v1.webp` | 98,894 | `B24B777E50DC07DED10C319DFD0B6BC9753997501A18E6B026B38CFEC0C9CD0B` |
| `cannon-v1.webp` | 110,710 | `3CF0C4B3BC500CD064655D07E02669FC2E1A3271C9C800E05D19DDDBC9E41D3B` |
| `radiator-v1.webp` | 118,410 | `B5E93100C290265FD9ACF19D8A7B96C0E5DB0FCA5BDE36C13B3E6E63A8BBFF3D` |
| `medical-v1.webp` | 114,054 | `182581D81FAC977F9990BE6A3B2204426A16EB633FBB15DBCC9CE11722F19E70` |

## Frame exploration

`design/concepts/railavoid-frame-atlas-v1.png` used this prompt:

> Create a clean UI frame asset study for RAILaVOID in the same hand-inked Victorian-industrial railway language. Show four empty, clearly separated container frames on one sheet: a wide command-deck panel, a medium rolling-stock card, a tall equipment-inspector panel, and a small cream railway ticket. Use dark navy enamel, worn brass corner hardware, fine rivets, restrained violet warning accents and generous empty centers. No labels, icons, symbols, train art or decorative clutter. Straight edges, consistent border thickness and production-minded nine-slice geometry.

The atlas is a design reference, not a runtime sprite. Its generated checkerboard is baked RGB rather than real alpha, so the responsive HUD continues to draw scalable borders in CSS until individual transparent nine-slice exports are available.

## Runtime mapping

`src/ui/carArt.ts` imports each file through Vite and maps `CarType` plus car level to the built URL. Gatling levels I–III have distinct art; the other nine authored types currently reuse level I. Missing types deliberately return `null` and render the existing CSS schematic. Build-managed imports also allow the standalone exporter to embed all authored car images as data URLs rather than leaving broken `file://` paths.

## Rejected intermediate outputs

The first transparent-background attempts contained a baked checkerboard and were not copied into the project. The production car files are the regenerated uniform-navy versions listed above.
