# Platform role dashboards

Updated: 2026-08-20

Issue: [#40](https://github.com/Idea-R/aVOIDhub/issues/40)  
Branch: `codex/feature-platform-role-dashboards`

## Outcome

The platform now has one visual and authorization language for account access, the player deck, the creator workspace, private build intake, and the administrator control room. These surfaces use the same meteor/telemetry identity as the public directory without disguising unavailable data or inactive services.

## Route map

| Route | Audience | Runtime behavior | Static review behavior |
| --- | --- | --- | --- |
| `/login/` | Signed out | Sends a Supabase passwordless link and returns to a validated local path | Shows the complete flow without sending email |
| `/account/` | Authenticated player | Shows owned profile, eligible run/favorite counts, entitlements, creator state, billing link, and profile editor | Shows an explicit data-disconnected state |
| `/creators/apply/` | Signed-in applicant | Submits a free private creator application | Form remains disabled when the runtime is absent |
| `/creators/dashboard/` | Authenticated player or creator | Shows the latest application, active creator entitlement, gate sequence, and owned private submissions | Shows the workflow without sample records |
| `/creators/submit/` | Approved creator with active `creator.submit_game` entitlement | Accepts a private game submission | Form is visible but disabled |
| `/admin/` | Server-assigned platform administrator | Shows creator, game, score-integrity, and active-membership queues | Shows the designed control room with no production data |
| `/api/admin/review` | Server-assigned platform administrator | Executes only whitelisted status transitions with a same-origin check and optimistic concurrency guard | Unavailable without the runtime |

## Authorization model

- Authentication establishes identity; it does not establish administrative authority.
- Administrator access is granted only when Supabase Auth `app_metadata.platform_role` equals `admin`.
- `user_metadata` is never used for authorization because users can edit it.
- A non-admin authenticated request to `/admin/` receives the not-found surface.
- The review API independently repeats authentication and role checks. Hiding the page is not treated as authorization.
- The Supabase secret key remains server-only. No privileged client is created in browser code.
- Creator approval and creator subscription remain independent gates.

## Review controls

Creator applications can move from pending to reviewing or declined, and from reviewing to approved or declined. Game submissions move through submitted, reviewing, changes requested, approved, or declined according to the explicit transition table. Score submissions in manual review can be provisionally accepted or rejected.

No dashboard control deletes data, publishes a game, deploys code, creates a charge, grants an entitlement, or activates advertising. Approval records a review result only.

## Visual system

- Reuses the project-owned `avoid-depth-field-v1.webp` as a low-contrast control-room atmosphere.
- Keeps buttons, tabs, status plates, and queue controls as scalable HTML/CSS rather than bitmap button art.
- Uses shallow offset shadows, asymmetric corners, pressed states, restrained hover lift, and a single animated signal indicator.
- Keeps decorative artifacts in their own layout lanes; no badge is pinned across headings.
- Converts the dashboard rail into a horizontal scrollable workspace switcher on phones.
- Preserves the existing reduced-motion override and avoids animation-dependent meaning.

## Activation checklist

1. Configure the existing Supabase public and secret runtime variables in a non-production context.
2. Test the coordinated foundation migration on the approved Supabase development branch before connecting these screens to migrated data.
3. Assign `app_metadata.platform_role = admin` to a dedicated administrator account through an authorized server or Supabase administrative workflow. Do not add an admin self-selection UI.
4. Refresh the administrator session after changing app metadata so the JWT claim is current.
5. Exercise every permitted and denied transition with synthetic creator, game, and score-review fixtures.
6. Confirm non-admin users receive not-found for `/admin/` and `403` from the review API.
7. Confirm approved review status does not publish, deploy, charge, grant entitlement, or enable ads.

Production role assignment, database migration, secrets, charges, and publication remain gated.

## Verification evidence

- `npm run typecheck --workspace @avoid/platform`
- `npm run test --workspace @avoid/platform` — 19 tests pass
- `npm run build --workspace @avoid/platform` — 24 application routes build successfully
- Browser review at 1440 × 1000, 768 × 900, and 390 × 844
- All platform-owned routes remain within the viewport at tablet and phone widths
- No visible interactive button below 40 × 40 CSS pixels at the phone breakpoint
- No browser warning or error in the reviewed routes

The legacy static-export command remains blocked by the pre-existing dynamic `/api/v1/runs/[runId]/finish` route under Next `output: export`. The production server build is the authoritative build gate for authenticated and API-backed pages.
