# Sprint 03 Plan

## Baseline and contract

Deliverables:

- Charter, decisions, roadmap entry, and worklog.
- Clean pre-change unit and production-build baseline.

Gate:

- `npm test`
- `npm run build`

## Establish the desk language

Deliverables:

- Shared raised and inset card treatments derived from the existing palette.
- Larger, two-level resource cards with value, capacity, and meaningful state.
- Clearer mission, region, stop, and warning hierarchy.

Gate:

- `npm run typecheck`
- `npm run build`
- Screenshot review at 1920x1080 and 1366x768.

## Make the consist readable

Deliverables:

- Train cards show full car identity where space permits.
- Hull state and operational state have labels, not unexplained bars alone.
- Crew posting and serious faults remain visible in the collapsed strip.
- Compact breakpoints retain horizontal scrolling and readable selection.

Gate:

- Focused HUD DOM checks.
- Existing overlap check at supported widths.
- Manual screenshot inspection.

## Make crew posting direct

Deliverables:

- The selected car exposes available specialists as actionable cards.
- Every specialist card explains its effect and current availability.
- Posting and unposting provide immediate confirmation and keep the player in context.
- The unassigned-crew callout opens the first viable car and lands on the assignment controls.

Gate:

- Automated acquisition-to-assignment interaction check.
- Keyboard-focus and disabled-state assertions.

## Integrate and release locally

Deliverables:

- Focused verification script and saved screenshots.
- Full project verification report.
- Single-file standalone build and boot check.
- Updated roadmap, worklog, decisions, and status record.

Gate:

- `npm test`
- `npm run verify`
- `npm run build:standalone`
- `npm run check:standalone`
