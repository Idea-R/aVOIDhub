# Shared leaderboard connection, source gate

Updated: 2026-08-24
Status: source and local verification complete; database rehearsal pending

## Outcome

VOIDaVOID and WORDaVOID now use the platform's same-origin session for ranked run requests. Guest play still works without an account or database connection.

VOIDaVOID receives a server-owned seed and one-use ticket before a signed-in run. The game records score events, submits the finished evidence once, and shows whether the platform saved, rejected, or could not reach the run. The platform ignores the browser's final score and rebuilds survival, meteor, combo, and perfect-knockback points from the evidence.

WORDaVOID no longer opens its old game-owned Supabase session to reach the platform. Its existing deterministic prompt and keystroke evidence now travels through the platform cookie session used by the rest of aVOIDgame.io.

## Board behavior

- Each hosted game has a separate board.
- WORDaVOID Classic and Time Attack have separate mode views.
- One player's best accepted score occupies one row per game and mode.
- A score-review rejection drops out of the board because current rows join the accepted submission record.
- `server replay` means the platform rebuilt the score from deterministic evidence.
- `bounded` means the platform checked and recomputed a smaller terminal summary.
- Both capabilities remain `provisional`. Neither is presented as verified anti-cheat.
- Game detail pages now load accepted board previews and personal bests for all four hosted games, not only TankaVOID.

## Shared VOIDaVOID contract

`packages/voidavoid-contract` is now the single pure contract used by the game and the platform. It owns:

- the `voidavoid-v2` ruleset and evidence envelope;
- seeded random stream behavior used during score replay;
- score formulas for survival, meteor hits, chain events, combos, and perfect knockbacks;
- evidence integrity and deterministic replay checks;
- the server-issued run manifest.

Moving this logic out of the game prevents the browser and server validators from drifting apart. It also fixed a real evidence gap: the old recorder could not explain combo points if that gameplay path became active.

## Trust boundary

The server owns the account, run id, game key, mode, ruleset, seed, ticket, accepted score, and receipt. A browser cannot choose its verification label or write directly into the new score path.

The run is still provisional because a modified browser can fabricate a plausible action stream after receiving the seed. Stronger VOIDaVOID trust requires bounded pointer and action evidence or authoritative simulation. The FNV integrity code catches accidental changes; it is not a signature.

## Verification completed

- `@avoid/voidavoid-contract`: typecheck and 2 tests pass.
- VOIDaVOID: zero-warning active-graph lint, 32 tests, production build, and transfer budget pass.
- WORDaVOID: typecheck, lint, 33 tests, and production build pass.
- Platform: typecheck and 33 tests pass.
- Full four-game assembly and all 30 platform routes build successfully.
- Leaderboards pass desktop and 390 px mobile browser checks with no horizontal overflow. WORDaVOID mode controls remain visible on mobile.
- VOIDaVOID guest start and result states pass at 390 × 844 and 844 × 390 with no overflow, one focused result dialog, honest local status, and styled platform links.
- The browser console produced no warnings or errors during the responsive pass.
- npm audit reports zero vulnerabilities.

## Database rehearsal still required

No paid Supabase branch or production migration was created. Before ranked saving is called live, the isolated rehearsal must prove:

1. passwordless cookie continuity from the platform into each hosted game route;
2. valid start, finish, retry, expiry, wrong-user, and consumed-ticket behavior;
3. VOIDaVOID and WORDaVOID score recomputation against synthetic valid and tampered evidence;
4. receipt, personal-best, per-mode board, and one-best-row read-back;
5. RLS and grants that prevent browser inserts into legacy and foundation score tables;
6. rollback to the current production schema and deploy.
