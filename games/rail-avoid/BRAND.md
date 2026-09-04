# RAILaVOID — Brand & Art Direction

A guide for humans and image agents. Everything generated for RAILaVOID (cutscene frames, event cards, relic icons, region title cards, key art, catalog thumbnails) should read as one hand: **a warmly painted model-railway storybook inside the graphic discipline of a hand-printed transit poster, being eaten by the void.**

The Sprint 02 art study selected **Signal Box Storybook** for characters, cars and world art, with **Hand-Printed Transit Poster** retained for HUD, menus, tickets and typography. This hybrid gives the crew enough warmth to become characters without losing the clean route language that makes the strategy readable.

## 1. The idea in one line
An expressive painted model railway operated through an enamel signal box and framed like a screenprinted ticket, with the void bleeding in violet from the west.

## 2. Palette (use these exact values)
| Role | Hex | Use |
|---|---|---|
| Night navy (ground) | `#0b0e1a` | backgrounds, plates, letterbox |
| Deep ink | `#1b2238` | secondary panels, shadows |
| Gold (brand accent) | `#e8c170` | hairline frames, titles, built track, positive |
| Void violet | `#6d5fd6` | the void, relics, rare, "aVOID" wordmark |
| Coral (danger) | `#e86f6f` | enemies, damage, crossroads, warnings |
| Ice (info) | `#6fb7e8` | water, scouting, tooltips |
| Line amber (Northern) | `#e8a94f` | Northern Line, highlands |
| Line cream (Central) | `#e8dcb8` | Central Line |
| Line teal (Southern) | `#6fd3c8` | Southern Line, lowlands |
| Paper | `#e6e9f2` | text, highlights |

Rule of thumb per image: 70% navy/ink darks, 20% one region colour, 10% gold, and a violet void intrusion on the western edge unless the scene is explicitly "safe".

## 3. Typography
- **Cinzel** (600/800) for titles, wordmarks, card headers: tracked out +0.08em, small caps feel.
- **Special Elite** for body copy, telegram lines, captions: typewriter, slightly uneven.
- In generated images: text is allowed only as *diegetic* signage (station names, tickets, telegrams). Never bake UI copy into art.

## 4. Visual language
- **Camera**: 3/4 isometric tilt (about 30° elevation) for world scenes; straight-on "poster" framing for cards; low heroic angle for the train.
- **Rendering**: confident ink linework over smooth matte gouache/model-railway forms, clean colour fields and controlled cel-like shading. No paper, canvas or film grain, stippling, noisy speckles or gritty overlays. Use one soft light source (dusk or lantern light), gold rim light on the train and restrained violet light near the void. Crew portraits can show expressive faces; avoid photorealism.
- **Interface**: deep navy enamel plates, brass hairlines, warm cream ticket stock, signal lamps, lever/route-diagram motifs, square-cut corners. Use pills only for status tags. The map stays dominant; controls read as railway hardware, not futuristic glass.
- **The train**: stubby toy-like proportions, deep-navy body, gold trim lines that grow with upgrades, red rear lanterns, coloured car roofs by role (coral weapons, ice medical, cream coaches, amber boiler). Steam is thick, cream, a little cartoonish.
- **The void**: not black, but a violet-black gradient with erosion tendrils, floating rock shards, faint star-nebula inside, hexes crumbling at the edge.
- **Settlements**: tiny clustered buildings with warm window lights; a white station ring marker as the "diagram" layer floats above them.
- **Enemies**: silhouettes first. Raiders in patched coats with rail-spike weapons, Void Hounds as smooth violet shapes with three glowing eyes, Crawlers as beetle-tanks, Harpies as ragged rotor-winged figures, Wisps as candle flames of violet light, Sappers with backpacks of red charges.
- **Frames**: the interface supplies gold hairlines, punched-ticket motifs and violet corner ticks. Keep scene paintings border-free so they crop responsively; never bake frames or labels into combat avatars. Decorative framing belongs in a separate UI layer.

## 5. Asset specs
| Asset | Ratio / size | Notes |
|---|---|---|
| Event / expedition scene | 16:9, 1600×900 runtime | one moment, readable foreground, no baked frame or UI |
| Relic icon | 1:1, 512×512 | single object on a dark plate, gold rim light, no text |
| Region title card | 21:9, 2016×864 | landscape sweep with the line colour dominant |
| Cutscene frame | 16:9, 1920×1080 | letterbox-safe: keep focal content inside the central 72% height |
| Crew portrait | 4:5, 800×1000 | bust, dusk light, one prop per specialty |
| Crew / enemy combat avatar | 480×600 runtime; native PNG master | full body and gear, generous transparent margins, no ground shadow or backdrop |
| Catalog / key art | 16:9 and 1:1 crops | the train small against a huge crumbling continent |

Current scenes: `public/art/scenes/*-v2.webp`. Current enemy cutouts: `public/art/enemies/*-v3.webp`; immutable accepted PNGs: `output/imagegen/native-alpha/`. Crew assets live in `public/art/crew/`. Future relic/region/cutscene families use their own directories. Scenes use WebP quality 82; avatars use quality 84 and alpha quality 100. Version replacements rather than silently overwriting accepted art.

Transparent masters must come from native `gpt-image-1.5` output with `background=transparent` and PNG format. Verify actual alpha, full-body framing and enclosed gaps, then inspect on light and dark backgrounds. Do not substitute colour-keying, checker removal, an opaque navy plate or a painted checkerboard. See `docs/DEVELOPMENT-TOOLKIT.md` and `docs/sprint-06/NATIVE-ALPHA.md` for the working route.

## 6. Do / Don't
**Do**: keep one focal point; let the gold frame breathe; show scale (a tiny train, a vast map); use lantern light; leave 15% dead space at the top of cards for headers.
**Don't**: photorealism, lens flares, glossy 3D, neon cyberpunk, saturated greens, busy backgrounds, paper grain, readable UI text or modern typography inside images. Do not use scene framing or the scene's navy ground for a transparent avatar.

## 7. Master prompt (image agent)
Paste this as the system/style preamble, then append one of the subject prompts below.

```
Style: Signal Box Storybook world art, designed for a transit-poster interface. Painted model-railway forms, precise ink contours, smooth matte gouache fields and controlled cel-like shading; isometric 3/4 tilt for world scenes. Deep navy shadows (#0b0e1a), brass-gold accents (#e8c170), restrained void violet (#6d5fd6), warm station lamps. Stubby expressive steam train in navy with gold trim and coloured car roofs. Settlements are tiny clustered buildings with warm windows. The void is violet-black with crumbling hex tiles and floating shards. One focal point and a readable foreground, no baked frame. No paper/canvas/film grain, halftone, stippling, noisy speckles, text, UI, photorealism, neon or glossy 3D. Muted saturation except gold and violet. For combat avatars, replace all scenery with native transparent alpha: full body and gear, no floor, ground shadow, vignette, frame or cropped extremities.
```

## 8. Subject prompts
1. **Key art / title**: "A small navy steam train with gold trim races east along a cream-coloured rail line across a vast hex-tiled continent at dusk; behind it the western third of the world is crumbling into a violet void with floating shards; three coloured rail lines (amber, cream, teal) fan out ahead toward a distant glowing gate on the horizon; wide 16:9, low heroic angle."
2. **Region 1 — The Greenbelt**: "Rolling green hex plains and dark pine clusters under a warm dawn, a cream rail line curving through small villages with lantern windows, faint violet haze on the far left; 21:9 landscape."
3. **Region 2 — The Rust Reaches**: "Ochre hills, rust-red mine headframes and broken stone ruins, the amber Northern Line climbing a ridge, ash on the wind, a crawler-beetle silhouette on a slope; 21:9."
4. **Region 3 — The Ash Steppe**: "Grey ash plains under a storm sky with lightning, teal Southern Line crossing flooded fields, ragged rotor-winged harpy silhouettes in the clouds; 21:9."
5. **Region 4 — The Void Frontier**: "Violet crystal spires and crumbling hex tiles, a monumental stone gate glowing violet at the far right, wisps of violet flame drifting over the rails; 21:9."
6. **Crossroads hub**: "A fortified railway junction where three coloured lines meet: barricaded platform, two stone watchtowers with sweeping lanterns, a striped toll gate across the track, lantern light on wet rails, coral warning flags; 3:2 event card."
7. **Expedition site**: "A half-buried bunker doorway glowing green among ruined pillars beside the track, three small crew silhouettes with lanterns stepping off a parked train, void motes drifting; 3:2 event card."
8. **Relic icons (set)**: "Single object on a dark navy plate with gold rim light, ink-and-wash, no text: (a) a brass coal-heart furnace door, (b) a compass with a violet needle, (c) a bundle of rail spikes tied with red cord, (d) a rusted grapple hook, (e) an old railway timetable, (f) a signal lantern with a gold flame, (g) iron couplings, (h) a tattered ash-grey cloak; 1:1 each."
9. **Event cards (examples)**: "Stowaway: a young surveyor crouched between coal sacks in a tender car, lantern light from above, blueprint in her hands" · "The Preacher: a gaunt figure in a coach doorway pointing west toward the violet void while passengers watch" · "Rail Shrine: a small stone shrine beside the track with a violet-gold flame and offerings of rail spikes."
10. **Crew portraits**: "Bust of The Conductor in a navy greatcoat and brass-trimmed cap, whistle on a chain, dusk light, calm; 4:5" (variants: Engineer with wrench and goggles, Gunner with a bandolier, Medic with a red-cross satchel, Surveyor with a rolled map, Mechanic with grease-streaked sleeves, Quartermaster with a ledger).

## 9. Cutscene storyboard (opening, ~24 s, matches the in-game camera script)
1. Lantern close-up at Lastlight Depot, void crackling at the frame edge — "aVOID Games presents".
2. Dolly east along the empty Central Line — "The continent is falling into the void."
3. Pull back: three coloured lines fan out — "Three lines. One train."
4. Crossroads hub, towers sweeping lanterns — "Every line meets at the Crossroads."
5. The locomotive lights up, steam burst, departure — the RAILaVOID wordmark.
Painted frames for these five beats (16:9, letterbox-safe) can replace or overlay the live camera later.
