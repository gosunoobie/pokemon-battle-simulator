# Local battle simulation server

This is a single-process visual simulation prototype with an automated opponent. It is not the production multiplayer service: sessions are in memory, and a restart or 30 minutes of inactivity ends them. There is no account system, database, matchmaking, or battle deadline service.

`simulationPlugin()` from `simulation.js` mounts `/api/simulation` in Vite development and preview servers. `createSimulationService()` exposes ordinary Node middleware and `close()`. `start.mjs` serves the built `dist` directory and the same API; its default address is `127.0.0.1:3000`. Set `HOST=0.0.0.0` explicitly for access from another computer, and `PORT` to change the port.

```sh
npm run build
node apps/server/start.mjs
```

The engine stays on the server. A random HttpOnly, SameSite=Strict cookie identifies the player's p1 session. Mutating requests require a matching Origin and JSON input with bounded, allowlisted fields. Responses contain only p1's permitted view and events; rule seeds, checkpoints, p2 requests and private end records are never returned. The three selectable teams are public fixtures; their entire sets validate under the battle's Gen 3 profile.

The automated opponent chooses the first available damaging move, then another legal move or switch when necessary. It does not evaluate strategy or inspect p1's secret state. Both automated decisions and player choices go through the engine's ordinary legal decision port. Reloading retrieves the same in-memory battle; retrying an admitted command keeps its original engine acknowledgment.

Every choice, forfeit and deletion includes the displayed `matchId` in its JSON body. Creating/replacing a battle includes `expectedMatchId` (the current match ID, or `null` when no session exists). Stale tabs receive `409 MATCH_CHANGED` before a battle mutation; they must fetch the current match before continuing. `GET /api/simulation/match` without a cursor returns a complete permitted snapshot for this synchronization.

Default limits are 24 active sessions, 600 requests per session per minute, 60 new matches per minute, and 4 KiB JSON request bodies. Expired/replaced sessions and stopped servers dispose their engines. An unsupported protocol projection stops that session with a safe error. These limits are bounds for the local prototype, not measured production capacity.
