# Private-room multiplayer runtime

This first slice runs two authenticated guests against the existing `gen3opensinglesv1` battle engine. Guests select one of the three server-owned six-Pokémon presets and a lead. Both ready records must be current before a match starts. The server derives each seat from its guest membership; clients cannot choose a seat, supply mechanics, override the format, or submit arbitrary teams.

The existing solo simulation, regional leagues, custom-team builder, move preview and FX playground remain separate. Multiplayer does not use the solo bot or its session cookie.

## Play locally

1. Run `npm run dev`, or run `npm run build` followed by `npm start` to serve the production build with both APIs. `npm run preview` also mounts the local battle APIs through the Vite plugins.
2. Open **Private battle** on the home page, or `/multiplayer`.
3. Optionally enter a trainer name, create a private room, and copy its invitation link.
4. Open that link in another browser profile/private window or send it to a friend using the same reachable frontend host. Two ordinary tabs in one browser profile share one guest identity.
5. Each guest chooses a preset and lead, then presses **Ready to battle**. Both players must be ready. Changing a selection cancels that guest's readiness.
6. Submit moves or switches. The server waits for all required choices before resolving the turn. A forced replacement is also a server decision.
7. Refresh to resume the current state without replaying old animations. **Forfeit battle** awards the opponent a win; **Back to private rooms** leaves the completed room.

The invitation identifies a room, not a player's credential. Opening a link fills the join field; joining remains an explicit action. No account, custom PvP team, chat, public matchmaking, spectator or database feature is included.

## Frontend and presentation

- `apps/multiplayer/src/App.vue` owns the private lobby, ready controls, polling, countdown, reconnection and battle choices.
- `api.js` is the same-origin HTTP adapter. Every request has its own cancellation and timeout; a poll cannot abort a submitted choice.
- `roomSession.js` validates match identity, viewer revision and event cursor, reconciles acknowledgements and serializes presentation. Older responses cannot restore a previous decision or replay a move. Missing event ranges synchronize the latest view.
- `apps/shared/battle/BattleView.vue` and its adjacent modules contain the reusable scene, HUD and presentation sequence. Solo and multiplayer use the same move FX, Poké Ball releases, fainting, idle motion, effectiveness feedback, introduction and outcome overlays. The existing simulation import paths remain compatibility wrappers.

Both guests see their own Pokémon near the camera with back artwork. Seat IDs remain engine identities; the presenter translates them into each viewer's perspective. HP, PP, legal choices and outcomes come from the engine. Animation timing, skipping and reduced motion never alter those results.

The page normally polls an active room every 1.5 seconds, a lobby every 2 seconds, and a background tab every 10 seconds, with backoff on failure. Commands request an immediate follow-up update. Browser visibility recovery requests a full synchronization. This first version uses HTTP polling, not WebSockets.

## Server responsibilities

- `apps/server/rooms/routes.js` owns HTTP parsing, the multiplayer cookie, configured-origin checks, request limits and sanitized errors.
- `apps/server/rooms/service.js` owns guest authentication, membership, room commands, private projections, retries and deadlines.
- `apps/server/rooms/memoryStore.js` owns serializable records and atomic transactions. Engine objects are temporary candidates; committed private checkpoints remain authoritative.
- `apps/server/rooms/presets.js` validates the server preset catalog under Open Singles.
- `apps/server/rooms/policy.js` supplies explicit runtime limits.

`createMultiplayerService(options)` exports `handle(req, res)`, `middleware(req, res, next)` and `close()`. The middleware can sit beside the solo middleware. Its factory accepts `publicOrigin`, optional HTTP `rateLimits`, and forwards room-service dependencies such as `engineFactory`, `roomStore`, `clock`, `presetCatalog` and `policy`. Tests can disable scheduled cleanup with `autoCleanup: false`; production uses the normal cleanup timer. Await `close()` when the owning host permits asynchronous shutdown.

## HTTP surface

All routes begin with `/api/multiplayer`. POST bodies must be JSON objects no larger than 4 KiB. The service validates each operation's allowed fields and semantics. The room ID belongs in the path, never the body.

| Method and path | Purpose |
| --- | --- |
| `POST /guest` | Create or resume a guest, optionally providing `name`. This is the only route that sets the credential cookie. |
| `GET /config` | Public preset, move and policy catalog; no credentials are created. |
| `GET /session` | Return the authenticated guest and current room envelope, if any. |
| `POST /rooms` | Create a lobby using `operationId`, with optional preset and lead. |
| `POST /rooms/join` | Join with `operationId` and `inviteToken`. |
| `POST /rooms/:roomId/selection` | Select own preset/lead using the expected own `selectionRevision`. |
| `POST /rooms/:roomId/ready` | Set readiness bound to `selectionRevision` and `membershipEpoch`. |
| `POST /rooms/:roomId/choice` | Submit `commandId`, `matchId`, `decisionId` and the current legal action. |
| `POST /rooms/:roomId/forfeit` | Explicitly forfeit the authenticated active seat. |
| `POST /rooms/:roomId/leave` | Leave a lobby or terminal room; active matches require explicit forfeit. |
| `GET /rooms/:roomId/updates` | Poll using `afterRevision`, `afterCursor`, optional `matchId`, and optional `sync`. |

Mutations other than choices carry an `operationId`; choices can use their `commandId` as the operation identity. Retrying the same semantic operation returns its acknowledgement. Reusing an identity for different intent is rejected. An engine-level illegal action can return HTTP 200 with `ack.accepted: false`; the client must inspect acknowledgements, not status alone.

Updates use an independent viewer revision as well as the event cursor. A player's accepted choice can change its decision to `wait` without adding battle events. The other player's revision does not expose that hidden choice. Unchanged polls omit the full view. Full synchronization reconciles the current authoritative state instead of replaying historical animations.

## Cookies and deployment

The bearer credential is `battle_multiplayer_v1`, with `HttpOnly`, `SameSite=Strict`, and `Path=/api/multiplayer`. It is never returned in JSON. Its default lifetime is an absolute 24 hours; polling and reconnecting do not renew it. The server stores a credential hash. Expired gameplay requests return HTTP 401 and never silently create a replacement guest. Explicitly calling `/guest` can create a new identity, which cannot reclaim an earlier guest's seat.

Set `PUBLIC_ORIGIN` to the exact browser-facing origin, for example `https://your-frontend.vercel.app`. It must contain no credentials, path, query or wildcard. HTTPS configuration adds `Secure` even though Render's internal connection is HTTP. The allowed browser origin is never expanded using caller-supplied `Forwarded` or `X-Forwarded-*` headers. Mutations require an exact Origin match; foreign Origin and cross-site Fetch Metadata are rejected on reads as well. Missing Origin is permitted on GET, consistent with same-origin browser fetches and the solo API.

Proxy `/api/multiplayer/*` from Vercel to the Render Node service alongside `/api/simulation/*`. Keep browser requests same-origin and return `Cache-Control: no-store`; the adapter sends this for success and error responses. There is no CORS wildcard or direct Render-domain cookie fallback. Cookies with the solo name, duplicate multiplayer cookies, malformed credentials and caller-supplied seat fields cannot authenticate another player. Use separate browser profiles or a private window to test two guests: two tabs sharing a cookie are one guest.

For the current deployment:

1. Redeploy the updated Node code to the existing Render web service. Keep `npm start` as its start command, `HOST=0.0.0.0`, the platform-provided `PORT`, and `PUBLIC_ORIGIN=https://pokemon-battle-simulator-drab.vercel.app`. Keep the existing dependency/build setup; this feature adds no dependencies.
2. Redeploy the Vercel frontend from the same revision with `npm run build` and output directory `dist`. The checked-in `vercel.json` now forwards both API namespaces to `pokemon-battle-simulator-r1p3.onrender.com` and opts multiplayer responses out of caching.
3. Check `/api/multiplayer/config` on the **Vercel** origin, then create and play a room in two isolated browser sessions on that origin. Check refresh, one forced switch, forfeit and leaving the result.

Do not point the browser's API requests directly at Render. No new frontend API URL variable or database secret is required. If the public hostname changes, update `PUBLIC_ORIGIN`; if the backend hostname changes, update the rewrite destination. Vercel preview domains are separate origins and are not implicitly allowed by the production origin setting. These deployment steps have not been executed as part of the local implementation.

## Adding persistence later

`roomStore.transact(scope, operation)` is asynchronous and owns the atomic boundary. Its transaction view exposes keyed reads/writes for guests, token hashes, rooms, active memberships and invitations. The RAM implementation serializes writers and publishes immutable copied records only after a successful operation. Candidate engines are restored from checkpoints, advanced, then exported; the store never owns live engine objects.

A database adapter must preserve atomic checkpoint, private-view revision, deadline, result and command-receipt publication, plus unique active membership and invitation ownership. It will need real SQL transactions, appropriate indexes, locking/version checks and an efficient transactional read view; replacing a Map with independent SQL `get`/`save` calls is insufficient. The current in-transaction methods are synchronous over that read view, so an adapter must hydrate the needed records before invoking the callback or evolve the transaction interface deliberately. Store-interface injection avoids tying the room UI or battle engine to a database client; it does not remove the persistence design work.

Guest IDs can later map to authenticated account principals. Persist versioned preset/team snapshots and engine checkpoints separately from account profiles. Derive history and achievements from a committed terminal result with a unique match ID so retries cannot award them twice. Durable recovery and multi-instance room ownership remain future work.

## Limits and operating boundaries

Default HTTP budgets use a fixed 60-second window:

| Scope | Default |
| --- | ---: |
| All multiplayer requests, global | 6,000 |
| Guest create/resume, global | 120 |
| Public config reads, global | 600 |
| Reads per authenticated guest | 240 |
| Commands per authenticated guest | 120 |
| Create/join attempts per authenticated guest | 30 |

Forwarded IP addresses do not bypass these limits. HTTP 429 includes `Retry-After`. Rate bookkeeping is bounded independently of supplied tokens. These are defensive defaults, not measured throughput guarantees.

Default room policy caps guests at 128, retained rooms at 32 and active matches at 10. Lobby inactivity expiry is 15 minutes, a required decision has a five-minute server deadline, and terminal results are retained for 15 minutes. Presence is informational; polling, refresh and animation completion do not reset gameplay deadlines. Consult `policy.js` for all caps, including receipt and event-delivery bounds.

The combined Node host uses `apps/server/capacity.js` to partition a default budget of 24 into **14 solo sessions and 10 active multiplayer matches**. `resolveHostCapacity({ serviceOptions, multiplayerOptions, maxActiveBattles })` returns validated options for both services and rejects allocations whose sum exceeds the host budget. Deployment entry points must pass both returned option objects to their services. The standalone service factories remain independently injectable for tests and separate hosts. This static partition is deliberately conservative: completed solo sessions still occupy a slot until deletion/expiry, while terminal multiplayer rooms retain checkpoints under the separate retained-room cap. It is a count guard, not a claim that all allowed workloads fit a particular memory tier.

Run exactly **one backend process/instance** for this RAM-only slice. Rooms, guest identities, checkpoints and retained results disappear on restart or deployment. A second independently running process cannot serve the same room reliably. A paid service reduces idle shutdowns but does not make state durable. Do not advertise restart recovery or horizontal scaling until an external transactional store and room ownership mechanism are implemented.

## Focused HTTP checks

Run `node --test tests/multiplayer-http.test.mjs` with permission to bind a loopback port. The suite verifies isolated guest cookies, absolute expiry, Vercel-origin proxy behavior, forbidden origins and spoofed headers, strict and bounded JSON, chunked-body errors, private per-seat updates, hidden-choice revisions, command retries, p2 switching, stale identities, forfeits, rate limits and sanitized failures. The room-service unit tests cover transaction and deadline semantics separately.

Before release, exercise the built frontend through the actual Vercel-to-Render rewrite with two isolated browser sessions. Local HTTP tests establish application behavior; they do not certify deployed proxy configuration, browser cookie delivery or real-world capacity.

## Implementation verification

Local checks on 16 September 2026:

- Full workspace suite: **551 tests passed**. After the final capacity integration, **57 multiplayer tests** and **183 simulation tests** passed, including the three new capacity tests.
- Battle-engine suite: **61 tests passed**.
- Production build passed. Vite retains its large shared-chunk advisory.
- Two isolated browser sessions exercised creating/joining, different leads, both ready states, a complete turn, a knockout, fainting, a forced replacement and its send-out, same-browser recovery, and opposite victory/defeat results after forfeit.
- The built frontend loaded multiplayer without browser errors; the preserved solo league started, rendered its intro and controls, and quit successfully.

Use `npm run test:multiplayer`, `npm run test:simulation`, `npm run test:engine`, `npm test` and `npm run build` to repeat the appropriate gates. The HTTP and production-host suites need permission to bind loopback ports. Browser observations are manual integration checks, not an automated end-to-end suite.

## Bounded local load observation

Run `node tools/check-multiplayer-load.mjs` to repeat the bounded probe. It starts an ephemeral loopback backend in a separate child process, keeping HTTP client memory outside the server measurements. It creates ten simultaneous multiplayer matches and two idle solo sessions, runs five action cycles per multiplayer room in concurrent bursts, performs 100 unchanged polls, then checks terminal retention, expiry and shutdown. It never targets a deployed service. Engine seeds remain random, so command counts and timings can vary.

Observed 16 September 2026 at 09:09 UTC: Node 24.4.1, macOS arm64, Apple M4, 10 logical CPUs, 16 GiB system memory. The run took approximately 1.34 seconds and accepted 90 battle commands across 50 room action cycles. Cycles include forced-switch requests and are not a guarantee of five completed battle turns. Memory snapshots were taken after explicit garbage collection in the backend child.

| Backend stage | RSS MiB | Used JS heap MiB | Retained rooms | Total checkpoint bytes |
| --- | ---: | ---: | ---: | ---: |
| Initialized, before requests | 284.56 | 56.30 | 0 | 0 |
| Ten PvP matches plus two solo sessions | 311.67 | 60.52 | 10 | 653,669 |
| After five action cycles per PvP room | 380.66 | 62.30 | 10 | 832,486 |
| PvP forfeited; solo sessions deleted | 380.80 | 61.81 | 10 | 840,116 |
| Guest/room expiry processed | 380.41 | 60.19 | 0 | 0 |
| Host closed | 380.41 | 60.20 | — | — |

Peak observed process RSS was 380.83 MiB. Expiry removed all ten room records and their checkpoint bytes; one fresh guest remained for the expiry probe. V8 retained allocated memory, so RSS did not return to its initial value. This observation establishes logical cleanup; it is neither proof of a leak nor proof that repeated long sessions are leak-free.

| Local HTTP measurement | Samples | Median ms | p95 ms |
| --- | ---: | ---: | ---: |
| Create two guests, join and start one room | 10 | 6.50 | 38.94 |
| One accepted battle command under burst concurrency | 90 | 34.46 | 76.90 |
| One room action cycle and both-view resynchronization | 50 | 93.32 | 104.80 |
| Unchanged update poll | 100 | 0.79 | 1.16 |

These are short, early-battle observations on a local workstation. They exclude browsers, animation, internet latency, Vercel proxying, Render's CPU/memory limits, a full fourteen-solo allocation and long battle histories. Do not translate them into a 512 MiB guarantee, a supported-user promise or a production percentile. Before increasing caps or advertising capacity, repeat representative longer battles on the actual deployment tier while monitoring memory, event-loop delay, command latency and retained-room growth.
