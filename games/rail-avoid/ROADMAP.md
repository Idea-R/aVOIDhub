# RAILaVOID — Improvement Roadmap

Status after the first public early-access deploy (avoidgame.io/railavoid). Ordered by player impact.

## 1. Feel and pacing (in progress)
- [x] Faster train (0.38 hex/s), shorter settlement stops (12 s), safe havens, reversing.
- [x] Custom cursors, hover feedback on settlements/cars/hexes, no-overlap HUD layout, compact HUD, volume mixer (ambience/UI), log hidden by default.
- [ ] "Express" toggle: 1.5× default sim speed for veterans, saved in settings.
- [x] Three main lines (Central / Northern / Southern) with crossovers; junction chooser shows line names and the next settlement on each branch.
- [ ] Auto-route to a clicked settlement with a confirm chip ("12 hexes · 6 rails · 40 s") instead of hex-by-hex planning for long stretches.

## 2. Train mechanics and upgrades (first pass shipped)
- [x] Car levels I–III at yards (+HP, +damage, +power, +storage, +passengers, +cooling).
- [x] Locomotive tracks: Speed, Boiler pressure, Reinforced frame, Track crew.
- [ ] Specialisation choice at level III (e.g. Gatling → Twin-Link (rate) or Hardened (armour-piercing)).
- [ ] Coupling rules: heavy cars slow cornering on hills; armoured cars protect neighbours from shells.
- [ ] Field repairs between yards: Mechanic crew can spend scrap while moving (slow), Repair Drone car (tier 2) heals neighbours; hull "dent" states visible on the model.
- [ ] Crew as characters: portraits, two traits each, a short bark line on assignment.

## 3. Journey nodes (Slay the Spire density)
- [x] 4 new node types: Watchtower (early warning), Shrine (boon choice), Wreck (salvage / free car), Market (trade).
- [x] 17 events (14 passenger + 3 node). Target 45–50, in tiers: common (25), region-exclusive (4 × 4), rare (6), shrine-style (6).
- [ ] Each event gets a painted card illustration (generated on-brand: violet void, gold rail, ink-and-wash miniature look) and a small consequence tag row.
- [ ] Event "rooms" on the map: a `?` marker beside the track that only resolves when passed; some chain into follow-ups later in the run.
- [ ] Boss "hangar" nodes with a pre-fight prep choice (Spire elite-style rewards).

## 4. Presentation
- [x] Cinematic run intro, region cards, boss intros, victory/defeat cameras, letterbox cards.
- [ ] Opening cutscene: 25 s shot list (void swallowing Lastlight, train pulling out, title card) with the Suno theme; skippable, once per profile.
- [ ] Generated key art for the title, catalog card and each region's title card.
- [ ] Boss intro vignettes (2–3 panels) and a short victory sequence at the Last Gate.
- [ ] Menus: unified panel system with tabs (Train / Crew / Journey log / Settings), controller focus rings, and a map overview (minimap with void front and settlement deadlines).

## 5. Balance
- [ ] Human playtest pass per region with telemetry (deaths by cause, time per region, scrap spent per car type).
- [ ] Region 3–4 pressure vs. Tesla/Flak affordability; Void Maw readability.
- [ ] Difficulty presets (Scenic / Standard / Blackout) and daily seed.

## 6. Platform
- [x] Live at avoidgame.io/railavoid via the aVOIDhub platform catalog.
- [ ] Platform leaderboard adapter (score scope → "platform") once the run summary is bounded and replayable.
- [ ] Longer combat track (second Suno take) and per-region ambient stems.
