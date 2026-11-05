# BoomerangaVOID authoritative rooms

From repository root use `npm run workspace:boomerang-server`. Local guest testing additionally needs `BAV_ALLOW_GUESTS=1`; it is impossible in `NODE_ENV=production`. Default bind/port are `127.0.0.1:2777`. See `environment.example`, `Dockerfile`, `render.yaml.example` and `docs/boomerangavoid/CONFIGURATION-PROPOSAL.md` for production boundaries.

`/health` is public, no-store, and includes protocol/content/boot audience epoch plus readiness. `/rooms` lists opt-in waiting rooms without player identities. `/metrics` exists only outside production. Game clients send legal inputs; the shared simulation alone resolves hits and scores. Room state is ephemeral. No leaderboard or database persistence is enabled.

Tests need a live local server and `BAV_TEST_ENDPOINT`; `npm run verify:boomerangavoid:release` creates its own isolated test server with clearly test-only signing material, runs all room tests, then stops it. `verify/network-proxy.mjs` is an optional local WebSocket-frame impairment proxy, not production middleware. Its stalls simulate ordered transport delay, not real packet dropping.
