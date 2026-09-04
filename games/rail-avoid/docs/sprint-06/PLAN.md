# Sprint 06 — Encounter Worldbuilding Pass

## Goal

Turn the proven illustrated-event and staged-expedition systems into a broader content language: every major mystery should establish its own place, and later ruin stages should introduce recognizable enemy identities rather than repeat the opening roster.

## Current review status

Local integration; not deployed. The eight scene repaints use the cleaner, no-grain direction. All eight enemy avatars have now been corrected through the GPT Image 1.5 API using native `background=transparent`, inspected against light/dark backgrounds, and encoded as v3 WebPs. Rejected v2 drafts and failed native variants are preserved outside public assets. The production build passes with the new images; final release verification remains separate from this asset pass. See `NATIVE-ALPHA.md` and `NATIVE-ALPHA-HASHES.json` for provenance and review.

## Scope

1. Give the false signal, rainbound survivor, abandoned gun car and waterside dock unique illustrated establishing shots.
2. Add the Drowned Interchange to the unknown-signal pool with food, passenger and salvage choices.
3. Expand Away Team combat with the Ash Cult Fusilier, Rail-Maw Crawler, Lantern Wraith and Iron Sentinel.
4. Escalate deterministic stage rosters by region and depth while preserving the front/middle/rear formation rules.
5. Keep all content data-driven enough for a later ADS encounter preview and fixture picker.

## Verification

- Unit tests lock the new mystery outcome and deep-ruin roster contract.
- Focused browser verification opens every illustrated mystery, checks its 1600×900 art, visible choices and viewport bounds.
- Expedition verification checks staged formation and progression; unit tests cover regional rosters. All eight avatar files are checked at 480×600 with alpha; native sources additionally pass light/dark silhouette review.
- Production build, standalone package and full deterministic campaign gate remain green.

## Deferred

- Unique scene illustration for every passenger-only onboard event.
- Animated parallax layers derived from the scene paintings.
- New active abilities, status effects and loot tables for each enemy identity.
- Authenticated ADS authoring, which remains a platform/admin sprint rather than game-client code.
