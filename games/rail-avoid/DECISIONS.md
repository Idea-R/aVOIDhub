# Decisions

## 2026-09-05: Publish the verified game; isolate the next encounter

The user explicitly authorized publication and starting the next slice. PR #62 publishes only the accumulated RailAVOID milestone through the whole-site preview/main pipeline; platform PR #61 stays separate. Production is `16d2fbf` / Netlify `6a9cb816a256f200088a7a3e`.

The new track encounter lives on `codex/railavoid-blocked-track` and is opt-in. A blockage is an undirected edge record, not deleted rail. Withdrawal preserves it, carries normal wounds/Void cost back, and restarts the two existing Greenbelt stages on retry. Only a matching, unclaimed completed attempt clears the link and grants rewards. Inspection/cancellation are free; staying aboard clears only the untravelled plan. Existing art/foes prove the lifecycle, not the authored Spike Captain. See `docs/sprint-07/BLOCKED-TRACK.md`.

The user's follow-up correctly identified that Blender carts are not live: they remain in the separate pilot checkout. Record a port-and-measure gate, not automatic replacement. No Blender files were imported and no asset batch started during this release/slice.

## 2026-09-05: Read the existing combat before expanding encounters

Status: local implementation decision for the approved next milestone.

Enemy intent uses the existing weighted targeting rules, not a newly predetermined victim. Reveal hit count, base damage and the favoured position before action; reveal the actual target and timing/guard reductions once queued. Preview helpers are pure and shared with resolution so opening UI cannot consume RNG. Remove unsupported fire/armor descriptions instead of inventing new rules to justify them.

Swap names a living partner explicitly, spends the active actor's turn only, and never reorders the round. Preview both actors' positions and Strike changes plus the active actor's per-blow targeting risk. Cancel is free. Old already-pending swaps migrate once to their legacy next-living partner; new actions cannot silently choose one. Stale/invalid selections fail without another turn being consumed. Front is rendered nearest the enemy formation.

Keep the existing brass/ink plates, accepted avatars and command-hand footprint. Use a temporary chooser rather than another always-visible panel. Timing windows, enemy values, rewards, engine and asset roster remain unchanged. The next slice is one blocked-link/miniboss encounter, not broad XP/equipment or roster expansion.

## 2026-09-05: Prove conversation continuity before blocking the railway

Status: local implementation under the user's continuation request.

The first keeper encounter concerns a platform hoist and stranded workers, not an impassable main-line obstacle. It reuses existing staged combat. This avoids introducing a compulsory fight before intent, formation controls and escape-route rules are ready. Authored dialogue and a run-scoped keeper reputation are deterministic; no runtime model calls, account progression or deployment are implied. See `docs/sprint-07/KEEPERS-SIGNAL.md` for the bounded charter.

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
