# Sprint 06 playtest

Use the live `/railavoid/` route after the release is confirmed. Reload an already-open game tab so it receives the new hashed bundle. Try a fresh run and an existing save separately.

## Main route

1. New Run → first junction → choose each direction on separate runs. Rear cars should stay on actual track. Confirm the direction preview agrees with the map and that play can resume clearly.
2. Pan with right-drag, plan a nearby route, and approach a settlement. Browser context menus must not steal map input. Note any route that stops short unexpectedly.
3. Open a car inspector before arriving at a Repair Yard. The yard should become the active workspace; no hidden decision panel should trap you. Reorder cars, inspect engine upgrades and test a ballistic gun inside/outside supplier range.
4. Try 75%, 100% and 110% UI scale. Look for clipped primary actions, unexpectedly expanding panels and small essential text.

## New encounters and expeditions

5. Visit `?` signals: cache, ruin party, false signal/ambush, rainbound survivor, abandoned gun car and Drowned Interchange have distinct scenes. Check that each image suits the story and choices remain visible.
6. Enter a ruin with recruited crew. Test front/middle/rear placement and Swap; it spends the acting crew member's turn and currently swaps with the next living member.
7. Clear the first chamber. Check the Descend/Withdraw choice, retained injuries, changed scene and new opponents. Regions 1–2 have two stages; regions 3–4 have three.
8. Try both retreat and full victory. Check returned crew health, rewards/recruit and the return to the train. Report if any timing or enemy action feels impossible to read without the log.
9. Play a later-region expedition with ordinary supplies, not debug invulnerability. Compare the cost of healing and lost travel time with the reward.

## What remains unfinished

The Conductor has authored portrait/combat art; other crew still need their complete identity/art pass. Eight enemy assets are accepted, but Shade and Brute are not currently selected by the normal stage tables. Visible intent cards, persistent XP/unlocks and region minibosses are next work. Docks are currently illustrated encounters, not shoreline-constrained map locations. Full GPU performance needs a real-hardware playtest.

## Useful bug report

Include the screenshot, fresh/continued run, seed if known, region, journey time, train order, crew/health, UI scale, browser size and last action. For pacing, note where you felt stuck, which resource ran out first and whether the next decision's cost was clear. Keep a copy of the save before resetting a reproducible issue.
