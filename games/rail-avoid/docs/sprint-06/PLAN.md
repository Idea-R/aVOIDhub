# Sprint 06 — Encounter Worldbuilding Pass

## Goal

Turn the proven illustrated-event and staged-expedition systems into a broader content language: every major mystery should establish its own place, and later ruin stages should introduce recognizable enemy identities rather than repeat the opening roster.

## Current review status

Release candidate verified locally and on the hosted preview for PR #60 on 2026-09-04. The eight scene repaints use the cleaner, no-grain direction. All eight enemy avatars were corrected through GPT Image 1.5 using native `background=transparent`, inspected against light/dark backgrounds, and encoded as v3 WebPs. Rejected drafts remain outside public assets. Unit, full campaign, standalone and remote focused encounter gates pass; the preview's runtime assets match the local hashes. See `RELEASE.md` and PR #60's release-verification comment for final publication status, and `NATIVE-ALPHA.md` / `NATIVE-ALPHA-HASHES.json` for art provenance.

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
