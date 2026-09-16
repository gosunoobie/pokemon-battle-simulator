# Local battle simulation server

This is a single-process visual simulation prototype with an automated opponent. It is not the production multiplayer service: sessions are in memory, and a restart or 30 minutes of inactivity ends them. There is no account system, database, matchmaking, or battle deadline service.

`simulationPlugin()` from `simulation.js` mounts `/api/simulation` in Vite development and preview servers. `createSimulationService()` exposes ordinary Node middleware and `close()`. `start.mjs` serves the built `dist` directory and the same API; its default address is `127.0.0.1:3000`. Set `HOST=0.0.0.0` explicitly for access from another computer, and `PORT` to change the port.

```sh
npm run build
node apps/server/start.mjs
```

The engine stays on the server. A random HttpOnly, SameSite=Strict cookie identifies the player's p1 session. Mutating requests require a matching Origin and JSON input with bounded, allowlisted fields. Responses contain only p1's permitted view and events; rule seeds, checkpoints, p2 requests and private end records are never returned. The three selectable teams are public fixtures; their entire sets validate under the battle's Gen 3 profile.

The automated opponent chooses the first available damaging move, then another legal move or switch when necessary. It does not evaluate strategy or inspect p1's secret state. Both automated decisions and player choices go through the engine's ordinary legal decision port. Reloading retrieves the same in-memory battle; retrying an admitted command keeps its original engine acknowledgment.

The UI starts regional Elite Four challenges. `league-rosters.js` holds pinned
FRLG Kanto, GS Johto and RS Hoenn (Steven) parties; `league-run.js` owns the
five-round lifecycle through an injected engine factory. Team choices remain the
three existing six-member presets. The server validates every NPC set at startup
with `gen3regionalleaguev1`, which allows original party sizes/repeated species
and a narrow NPC-only Karen/Murkrow exception. See
[roster provenance](../../docs/LEAGUE_ROSTERS.md).

`GET /config` includes public `leagues` and `leagueProfile` metadata. Create a run
with `POST /match` containing `{regionId, presetId, leadIndex, expectedMatchId}`.
Responses include `run` alongside the permitted battle view. Only a p1 engine
win unlocks `POST /advance` with `{runId, matchId}`. It creates a fresh battle
against the next trainer, fully restoring the original team, lead and held items.
An exact retry for a previously advanced match in the same run returns the
current battle without advancing again. Unknown/stale run IDs fail with 409;
losses/draws and already completed challenges cannot advance. No client field can
declare victory or choose an opponent/stage. Creating without `regionId` retains
the old single-battle API for compatibility; the current UI supplies a region.

The run and its current battle share one cookie, inactivity timeout and session
capacity slot. Progress and Champion results survive reloads while that session
exists, but are lost on restart, deployment, sleep or expiry. There is no durable
save or trophy history. Deploy backend and frontend from the same revision; the
existing Vercel wildcard proxy already forwards the new `/advance` endpoint.

Every choice, forfeit and deletion includes the displayed `matchId` in its JSON body. Creating/replacing a battle includes `expectedMatchId` (the current match ID, or `null` when no session exists). Stale tabs receive `409 MATCH_CHANGED` before a battle mutation; they must fetch the current match before continuing. `GET /api/simulation/match` without a cursor returns a complete permitted snapshot for this synchronization.

Default limits are 24 active sessions, 600 requests per session per minute, 60 new matches per minute, and 4 KiB JSON request bodies. Expired/replaced sessions and stopped servers dispose their engines. An unsupported protocol projection stops that session with a safe error. These limits are bounds for the local prototype, not measured production capacity.

## Vercel frontend and Render backend

The repository-root `vercel.json` forwards `/api/simulation/*` to
`https://pokemon-battle-simulator-r1p3.onrender.com/api/simulation/*` and disables
rewrite caching. The browser continues using relative API URLs and same-origin
cookies; no `VITE_API_URL` or browser CORS configuration is needed.

Deploy the Render **Web Service** from the repository root, using Node 24,
build command `npm ci --include=dev && npm run build`, start command `npm start`,
and health check `/api/simulation/config`. Set these Render environment variables:

```env
HOST=0.0.0.0
PUBLIC_ORIGIN=https://pokemon-battle-simulator-drab.vercel.app
```

Leave Render's supplied `PORT` in place. `.nvmrc` selects Node 24; pin a tested
exact runtime version before relying on persisted engine checkpoints.

`npm start` reads `PUBLIC_ORIGIN` once at startup. It must be one HTTP(S) origin,
with no credentials, path, query, fragment or wildcard; a trailing slash is
accepted. Use HTTPS in production. The origin must be the actual browser-facing
Vercel domain, not the Render hostname or a page such as `/simulation.html`.
With an HTTPS public origin, session creation, refresh and deletion all use
Secure, HttpOnly, SameSite=Strict host-only cookies, even when Render forwards
HTTP internally. Origin and Fetch Metadata checks remain enabled. Forwarded
headers never determine trust. Arbitrary Vercel preview domains are not allowed;
use a separate backend/origin configuration for staging.

Without `PUBLIC_ORIGIN`, the original direct-connection origin checks remain.
Vite development/preview uses this local behavior and does not read the deployed
origin setting. This does not enable direct browser calls across the Vercel and
Render domains.

Push these changes to the connected deployment branch. Redeploy Render with the
variables above, then redeploy Vercel from the same revision (`npm run build`,
output `dist`). First check `/api/simulation/config` on the **Vercel** domain,
then start a battle, choose a move and reload `/simulation.html` to verify the
session. A direct Render config response alone does not verify mutation origins
or cookie forwarding.

Keep one backend instance. Sessions still live only in memory and are lost on
restart, deployment or free-service sleep. Render Free can take longer to wake
than the client's 15-second timeout; allow it to wake and reconnect if needed.
