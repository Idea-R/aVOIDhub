# Independent authority review and corrective evidence

A bounded Astra/high read-only review inspected simulation/protocol/tickets/room/client/auth contracts. Configured model names were supplied by the delegation; trusted runtime model metadata was unavailable. It produced eight concrete findings, including executed in-memory reproductions. The implementation lead accepted and corrected all eight; this is not a claim that the reviewer independently reran the final implementation.

| Finding | Correction and regression evidence |
| --- | --- |
| Create ticket could join any room by spoofing create intent | Hash actual creator reservation, bind every other join to roomId, preflight before allocation; live signed cross-room abuse regression |
| Packet gaps manufactured held-action releases | Preserve action holds until explicit release/150ms expiry; protocol regression |
| Departed seats blocked lobby restart; direct leave retained relay seed | Prune absent parties on lobby entry/loading timeout and release seed on both drop/leave; lifecycle test |
| Results did not return online UI to lobby | Model authoritative lobby/loading/match stages and restore lobby controls; two-browser match/rematch proof |
| Loading reconnect did not reacknowledge | Reset loadedRound on drop/reconnect and resend exact hash/round acknowledgement |
| Empty owner persisted after peer reconnected | Elect eligible owner during reconnect; live lifecycle regression |
| Refresh token never read; held inputs resumed after reconnect | Validate stored endpoint/room/lease, SDK reconnect at startup, clear controls, wait for neutral and fresh input; actual browser refresh restores same seats |
| Events disappeared between 20Hz snapshots | Bounded 120-tick/256-event server history and client ID deduplication; live event-delivery assertion |

No reviewer resources, remote mutations or user credentials were used. Complete source gate, browser and impaired transport evidence are linked from RELEASE-CANDIDATE.md. Hosted identity, physical-device, full soak and external-network acceptance remain separate.
