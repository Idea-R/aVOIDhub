# Convoy recovery release — 2026-09-05

The user authorized publishing the tested local build to aVOID Games. Release the
three RailAVOID commits through the existing whole-site Netlify preview and GitHub
PR workflow; do not publish a game-only directory over the shared site.

## Candidate and boundary

- Branch: `codex/railavoid-blocked-track`; gameplay candidate `7bcfc44`.
- Includes shared ammo, convoy guards, staffed-stop reordering/field repairs,
  continuation hotkeys and RPG crossroads dialogue. Blocked-track lifecycle is
  included but ordinary-world spawning remains off.
- All changes are under `games/rail-avoid`. Platform PR #61 is separate and must
  remain untouched. Unaccepted local artwork is excluded.
- No Blender replacement is included: the separate three-car pilot remains
  experimental, without a full roster or representative hardware comparison.
- Netlify site: `780c1b04-64c7-47b6-9423-18953739590e`, `avoidgame.io`, production
  branch `main`. Captured rollback deploy: `6a9cb816a256f200088a7a3e`, commit
  `16d2fbfd4c3102c2e42d218831082906ec285912`.

## Verification and release gates

Existing local evidence: 117 unit tests, typecheck, production and standalone
builds, standalone/browser controls, six recovery viewports, inspector/right-drag,
blocked-track fixtures and broad functional campaign checks. See
`CONVOY-RECOVERY.md` for the mixed balance results and software-renderer limitation.

Recovery and dialogue scripts accept `--url` and `--out` so the same isolated
browser fixtures can exercise hosted preview and production without changing
player saves or server data. Hosted fixture URLs use `?dev` only for inspection.

Before merging: verify the whole-site preview, exact RailAVOID bundle hashes,
shared routes/assets, and recovery/dialogue controls. Merge the tested head only;
then confirm its production deploy and repeat the live checks. Record final IDs
and results in the release PR. Do not describe a successful deploy as proof that
the full second-zone balance is solved.
