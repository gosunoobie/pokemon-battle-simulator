# Local battle simulation server

This is a single-process visual simulation prototype with an automated opponent. It is not the production multiplayer service: sessions are in memory, and a restart or 30 minutes of inactivity ends them. There is no account system, database, matchmaking, or battle deadline service.

`simulationPlugin()` from `simulation.js` mounts `/api/simulation` in Vite development and preview servers. `createSimulationService()` exposes ordinary Node middleware and `close()`. `start.mjs` serves the built `dist` directory and the same API; its default address is `127.0.0.1:3000`. Set `HOST=0.0.0.0` explicitly for access from another computer, and `PORT` to change the port.

```sh
npm run build
node apps/server/start.mjs
```

The engine stays on the server. A random HttpOnly, SameSite=Strict cookie identifies the player's p1 session. Mutating requests require a matching Origin and JSON input with bounded, allowlisted fields. Responses contain only p1's permitted view and events; rule seeds, checkpoints, p2 requests and private end records are never returned. The three selectable teams are public fixtures; their entire sets validate under the battle's Gen 3 profile.

The original single-battle and League opponent chooses the first available damaging move, then another legal move or switch when necessary. Survival uses a separate modest matchup-aware policy with deterministic tie-breaking and only its own private/revealed opponent information. Both automated decisions and player choices go through the engine's ordinary legal decision port. Reloading retrieves the same in-memory battle; retrying an admitted command keeps its original engine acknowledgment.

The team builder can generate six complete Gen 3 sets, retain locked members,
reroll individual slots, and undo the latest generation. `POST /team/random`
accepts `{team, lockedSlots}` (six editable draft slots and zero-based retained
indexes) and returns `{valid, team, errors, changes, collection}`. Generation
never creates or changes a battle/session. The public solo preparation endpoints
share a limit of 120 validation/generation requests per minute and accept bounded
20 KiB envelopes; the engine still limits submitted teams to 16 KiB. Invalid
locked sets fail without changing the draft. Locked species use catalog names or
IDs; upstream shorthand aliases are not part of this editor contract.

The collection contains one starter set for each of the 386 base species, sampled
with equal odds without duplicate base species. It includes legendaries and weak
species, so matchup strength varies. Sets pass the existing validator and a
documented baseline quality checklist; they are not competitively balanced.
See [the collection tool](../../tools/team-generation/README.md) for provenance,
reproduction and coverage checks. The existing three demo presets are unchanged.

Battle Simulation offers Regional League at `/simulation` and Survival at
`/survival`, with League / Survival choices on both setup screens. Regional League
starts Elite Four challenges. `league-rosters.js` holds pinned
FRLG Kanto, GS Johto and RS Hoenn (Steven) parties; `league-run.js` owns the
five-round lifecycle through an injected engine factory. Team choices include the
three existing presets and validated custom or generated six-member teams. The server validates every NPC set at startup
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
the old single-battle API for compatibility; the Regional League UI supplies a region.

The run and its current battle share one cookie, inactivity timeout and session
capacity slot. Progress and Champion results survive reloads while that session
exists, but are lost on restart, deployment, sleep or expiry. There is no durable
save or trophy history. Deploy backend and frontend from the same revision; the
existing Vercel wildcard proxy already forwards the new `/advance` endpoint.

Battle Simulation's Survival mode at `/survival` is an endless solo challenge
against fresh random teams. After wins, survivors recover 25% max HP and fainted
members revive at 50% max HP (both rounded down, minimum 1). Revived members do not
also gain the survivor heal. Loss, draw and forfeit end the run without recovery.
PP, original items and temporary conditions reset between rounds.
`survival-run.js` owns immutable checkpoint candidates, once-only settlement,
bounded history and prepared-opponent retries under `gen3-survival-v2` run rules.
The existing `gen3survivalsinglesv1` engine profile still supports one through six
members; victory recovery now returns all six originals to the next round.
A pre-run `/owner`
bootstrap makes Survival starts idempotent even after a lost first response.
Technical errors preserve the last committed Survival checkpoint. See
[Survival rules and API](../../docs/SURVIVAL.md) for exact ownership, retry and
recovery contracts. Runs remain RAM-only; no durable-save promise is made.

Every choice, forfeit and deletion includes the displayed `matchId` in its JSON body. Creating/replacing a battle includes `expectedMatchId` (the current match ID, or `null` when no session exists). Stale tabs receive `409 MATCH_CHANGED` before a battle mutation; they must fetch the current match before continuing. `GET /api/simulation/match` without a cursor returns a complete permitted snapshot for this synchronization.

The standalone service defaults to 24 active sessions; the combined host partitions 24 into 14 solo (including Survival) and 10 multiplayer matches. Other defaults are 600 requests per session per minute, 60 new matches per minute, and 4 KiB command bodies (20 KiB team envelopes). Expired/replaced sessions and stopped servers dispose their engines. An unsupported projection stops an ordinary simulation; Survival retains its last valid checkpoint. These limits are bounds for the local prototype, not measured production capacity.

## Vercel frontend and Render backend

Public pages use `/simulation`, `/multiplayer`, `/survival`, `/preview` and `/playground`.
Vite development/preview and the built Node host resolve these to the existing
HTML entries and redirect old `.html` links with HTTP 308. Query strings are
preserved; browsers retain fragments such as multiplayer invitations. Vercel
uses [`cleanUrls`](https://vercel.com/docs/project-configuration/vercel-json#cleanurls)
with `trailingSlash: false` for the same public paths. API routes keep their
existing paths. Redeploy Vercel for the new navigation and hosting configuration;
redeploy the Node host to use clean page URLs when accessing it directly.

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
Vercel domain, not the Render hostname or a page such as `/simulation`.
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
then start a battle, choose a move and reload `/simulation` to verify the
session. A direct Render config response alone does not verify mutation origins
or cookie forwarding.

Keep one backend instance. Sessions still live only in memory and are lost on
restart, deployment or free-service sleep. Render Free can take longer to wake
than the client's 15-second timeout; allow it to wake and reconnect if needed.
