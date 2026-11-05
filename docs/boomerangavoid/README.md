# BoomerangaVOID planning bundle

The complete implementation brief for Shane's original aVOID multiplayer party game. Prepared 2026-11-04. **Local game/server candidate implemented. See the release candidate for tested scope and outstanding release gates.**

- [Implemented candidate, verification and next actions](RELEASE-CANDIDATE.md)
- [Hosting and Google configuration proposal](CONFIGURATION-PROPOSAL.md)
- [Product, mechanics, architecture and milestones](BOOMERANGAVOID-PLAN.md)
- [GPT-6.1 Sol build handoff](SOL-IMPLEMENTATION-HANDOFF.md)
- [Acceptance tests and evidence](VALIDATION-MATRIX.md)
- [Ordered backlog](BACKLOG.md)
- [Current platform, hosting and login audit](platform-audit.md)
- [REA location, research and limits](rea-research.md)
- [Work record and exact resume point](WORKLOG.md)

Existing repository: [Idea-R/aVOIDhub](https://github.com/Idea-R/aVOIDhub). Existing site: [avoidgame.io](https://avoidgame.io/). The registered project is `C:\dev\aVOID`, but the modern platform source and pending repair work are in `C:\dev\aVOID-main`. Both must be preserved; begin the new game on an isolated branch from freshly verified remote main.

The live login was checked in Chrome and offers email magic links only. The plan includes adding Google sign-in to the current Supabase SSR platform, with a real authentication canary before release. Native online multiplayer needs a separate authoritative room service; Netlify continues to host the frontend.

The original planning reports are historical snapshots. Implementation and current evidence are recorded in RELEASE-CANDIDATE.md and WORKLOG.md. No Google credentials, provider settings, database migrations or production deployment have been changed.
