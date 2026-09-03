# Sprint 02 — Art Direction Decision

## Selected direction

**Signal Box Storybook world art + Hand-Printed Transit Poster interface.**

The painted model-railway treatment gives cars and crew warmth, silhouette clarity and room for a future interior cutaway. The transit-poster layer remains the right language for track choices, tickets, warnings and dense systems. The Void Woodcut direction is striking, but too severe for the amount of resource and crew information the game must teach.

## Generated studies

- `design/concepts/railavoid-art-directions.png` — three-way style comparison.
- `design/concepts/railavoid-hud-operations-desk.png` — gameplay-frame redesign using the selected hybrid.
- `public/art/crew/conductor.webp` — first production-format crew portrait (4:5, WebP quality 82).

These are visual-development references, not production-ready UI screenshots. Generated lettering is not shipped as interface text.

## Generation record

Mode: built-in image generation, new image for the direction board; built-in image edit using `verify/screenshots/early_game.png` for the HUD study.

Direction-board prompt:

> Create a polished 16:9 art-direction comparison board for a dark fantasy strategy game named RAILaVOID. The game is an isometric miniature train logistics / tower-defense roguelite racing east while a violet cosmic void consumes the railway behind it. Show three separated directions: Hand-Printed Transit Poster, Signal Box Storybook, and Void Woodcut. Each shows the same patched steam train, crew, boarders, junction and void wall. Premium indie concept art, readable at thumbnail size, no photorealism or franchise characters.

HUD-study prompt:

> Redesign the attached RAILaVOID gameplay screenshot while preserving the central map, routes and train. Use deep navy enamel panels, brass-gold rules, cream ticket labels, subtle grain, signal lamps and route-diagram motifs. Create a legible operations ticket strip, bold objective and void gauge, larger train schematic with crew badges, a persistent CREW READY action, a compact signal-box route panel, and a contextual crew-posting coach mark. Keep the map dominant, body text at least 14–16 px, and avoid futuristic glass UI.

Conductor portrait prompt:

> Production 4:5 character portrait in Signal Box Storybook style. The Conductor wears a deep navy greatcoat and brass-trimmed cap, a whistle chain, and rests one gloved hand on a signal lever. Warm station-lamp key light, faint violet void rim light, ink-and-gouache model-railway storybook rendering, navy/gold/violet palette, clean bust silhouette, no text or UI.

## Production rules derived from the study

1. Map first: HUD frames the playfield instead of floating over its center.
2. Brass/gold means action or continuity; violet is reserved for void pressure and rare relic value.
3. Crew must be visible as people, not only two-letter codes, once portrait assets enter production.
4. Every dense panel has a plain-language summary before numeric detail.
5. Minimum body copy is 14 px at 1080p; micro-labels may be 10–12 px only when paired with a larger value.
