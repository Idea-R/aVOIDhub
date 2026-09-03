# Decisions

## 2026-09-03: Preserve the existing world style

Status: approved by the user.

The current map, procedural world art, rail network, and restrained supernatural palette remain the visual foundation. The pulp and minimalist studies are references only, not replacement skins.

## 2026-09-03: Operations-desk card system

Status: approved by the user.

Use the earlier operations-desk mockup as the direction for HUD hierarchy. Cards must represent actionable systems such as resources, cars, crew, stops, and events. Decorative card containers are not a goal.

## 2026-09-03: Dense game UI rules

Status: implementation decision.

Color communicates state or category. Primary actions stay visible, secondary actions remain contextual, unfamiliar controls have hover or focus help, and changed components include selected, disabled, empty, warning, and danger states.

## 2026-09-03: No simulation expansion in this sprint

Status: scope boundary.

Crew progression and the inside-train view remain on the roadmap. This sprint may expose existing crew effects more clearly but will not add XP, traits, pathfinding, or balance changes.

## 2026-09-03: Announcements defer to decisions

Status: implemented.

Large announcement cards are hidden while a modal decision is open and resume if their timer remains. A decision surface must never be obscured by non-interactive presentation.

## 2026-09-03: Compact mode keeps identity before detail

Status: implemented.

At narrow desktop sizes, train cards retain the car name, hull percentage, selection, and crew posting while secondary heat and operational badges collapse. Horizontal scrolling preserves access to the full consist.

## 2026-09-03: Rebuild the components, not their decoration

Status: approved by user correction and implemented.

The prior operations-desk pass preserved too much of the thin resource ribbon and miniature consist spreadsheet. The new system changes composition and component anatomy: directive module, manifest instruments, rolling-stock schematics, embedded crew stations, and an equipment-bay inspector. The world renderer and simulation remain unchanged.

## 2026-09-03: Procedural rolling-stock silhouettes are an interface layer

Status: implemented.

Car silhouettes are CSS-rendered and driven by the existing car role data. They make system identity visible now while leaving a clean replacement point for authored carriage cutaways or generated art later.

## 2026-09-03: Authored rolling stock replaces starter placeholders

Status: implemented after user review.

The six cars visible at the beginning of a run use generated, strict side-elevation railway illustrations in a shared ink-and-gouache production style. Gatling upgrades change the image at levels II and III, establishing the pattern for mechanically meaningful visual progression. `carArtFor` is the single level-aware mapping seam; types without art continue using their functional CSS schematics.

## 2026-09-03: Do not ship fake transparency

Status: implemented.

The initial image outputs visually resembled transparent PNGs but encoded the checkerboard as opaque RGB. Production assets were regenerated on a controlled navy field that blends into the command-deck plate. The frame atlas remains a concept reference until it can be exported as real transparent nine-slice pieces.
