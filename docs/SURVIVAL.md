# Solo Survival

**Battle Simulation** offers two modes: **Regional League** at `/simulation` and
**Survival** at `/survival`. Both setup screens provide League / Survival mode
choices and share the team builder and battle presentation. Survival uses its own
run rules and does not create a two-player room.

## Rules

The current run rules are `gen3-survival-v2`: the requested victory revival rule
replaces the original permanent-elimination rule. The engine profile remains
`gen3survivalsinglesv1`; its battle mechanics have not changed.

- Begin with six legal, distinct Gen 1–3 base species at level 100. Presets, manual
  teams and the randomizer are all supported. Sets stay fixed once the run starts.
- Each round is a complete battle against a fresh server-generated team of six.
  All 386 base species remain eligible; encounter strength varies.
- On a player victory, each survivor recovers
  `max(1, floor(maximum HP / 4))`, capped at its maximum HP. Benched survivors heal.
  Each fainted Pokémon instead revives at `max(1, floor(maximum HP / 2))`.
  A revived member does not also receive the survivor's 25% recovery.
- Status conditions and temporary stat changes clear between encounters. Original
  moves, full PP, original held items, forms and abilities are restored. Consumed,
  swapped and knocked-off items do not carry into the next encounter.
- Fainted members remain unavailable for the rest of the current battle. After
  a victory, all six original members are available for the next round; any of
  them, including a revived Pokémon, can be the next lead.
- Score counts wins, not the current round number. Loss, draw (including the
  existing 500-turn cap) or forfeit ends the run without healing or revival. If
  the engine declares a win with no survivors, count the win and revive the team
  normally. Engine winner decisions remain authoritative.
- There are no public rankings, automatic difficulty escalation, party
  replacements or mid-run set edits.

On a win, 70/400 HP becomes 170/400, 0/400 becomes 200/400, and 0/301
becomes 150/301. A fainted Shedinja with 1 maximum HP revives at 1 HP.

This is a casual mode with a modest matchup-aware AI. It uses only its own team
and the opponent facts revealed to its side, with deterministic tie-breaking.
It is not a competitive search engine or a promise of balanced encounters.

## Sessions and limitations

Runs currently live in server memory. Refresh/reconnect in the same browser works
within the configured inactivity window (30 minutes by default). A server restart
or expiry removes the run. The UI explains this before starting; no durable-save
or cross-device promise is made. Deploying this as a durable public challenge
requires a transactional storage adapter and a tested engine-version upgrade policy.

Survival shares the existing solo session allocation (14 in the default combined
host, alongside 10 multiplayer matches). A run owns one published engine; mutations
use a temporary checkpoint-restored candidate and dispose it on replacement/failure.
Pre-run owner records are capped at 128, expire with inactivity, and allocate no
engines. Start receipts are capped at 16 per owner; run advance receipts at 64 and
round summaries at 16. Match logs/checkpoints reset for each new encounter.

## State ownership

`apps/server/survival-run.js` owns the original six, stable `slot:1`–`slot:6` run
identities, fainting, recovery/revival, score and current encounter. A per-match map
relates the original roster to engine member identities after lead ordering.
Party array positions are never used as permanent identity.

The dedicated `gen3survivalsinglesv1` engine profile permits one through six
distinct members under Gen 3 legality, without League NPC exceptions. The host
requires six starting player members and six opponents. Its support for smaller
parties remains an engine capability; current victory recovery returns all six
original members to each next encounter. Initial player HP is a
strict server-only argument applied before battle startup; editable teams cannot
carry HP or battle state. The engine's terminal roster provides exact HP/faint
state at completion. Original legal sets are rebuilt for the next round.

Every battle mutation operates on a candidate restored from the last committed
checkpoint. A successful mutation publishes the checkpoint, run state and result
together. Terminal settlement heals, revives and counts the win once. The terminal
battle view retains actual finishing HP, including fainted members at zero; the
recovery screen separately displays recovered HP and identifies revivals.

Continue freezes an available lead, next opponent and battle seed into one pending
record before creating the replacement engine. If creation fails, retry uses that
same record. Failed generation, AI driving, engine operations or commit retain the
last valid run and report an interruption rather than adjudicating a loss.

Only the current owner sees its run and team. Opponent sets, battle seeds, private
checkpoints and AI internals never enter HTTP responses. Generation uses the
existing validated starter collection; its identity and the engine/rule/AI
versions belong to the private run record. Existing move FX remain presentation only.

## HTTP integration

All routes use `/api/simulation`, same-origin checks and the existing scoped
HttpOnly cookie. The request body bounds remain 20 KiB for teams and 4 KiB for
ordinary commands.

- `GET /owner`: establish/acknowledge pre-run ownership; returns a noncredential
  owner ID and revision. A pending failed start can return its owner's original
  request, so refresh can recover the same intent.
- `POST /match`: a Survival start sends `mode: 'survival'`, one team or preset,
  `leadIndex`, `expectedMatchId`, `expectedRunRevision`, `expectedOwnerId`,
  `expectedOwnerRevision` and `operationId`. Region selection is mutually exclusive.
  Retry the same body/operation to recover a lost response. Changed intent under
  one operation ID is rejected; expired owners cannot replay old revision-zero starts.
- `DELETE /owner` with `revision`: explicitly cancel a pending start. It does not
  delete the active run. The UI first checks whether the original start succeeded.
- `GET /match`, `POST /choice`, `POST /forfeit`: reuse existing battle transport.
  Survival choices pass through the run's checkpoint/AI/settlement boundary.
- `POST /advance`: sends `runId`, completed `matchId`, run `revision`,
  `operationId` and available `leadMemberId`. Pending retries retain the original
  command, including its old expected revision. Successful duplicates return the
  current encounter without changing it.
- `DELETE /match`: Survival requires `matchId`, `runId` and current `revision`.
  A stale tab cannot delete a run that has progressed. A legacy League start
  cannot replace a Survival session; explicitly end it first.

The browser may retain a bounded pending start request in session storage to retry
the same team choice after refresh. It does not persist authoritative HP or scores.

## Verification and maintenance

Run `npm run test:survival`, the relevant simulation/multiplayer integration suites,
and `npm run test:engine`. Shared presentation changes also require `npm test` and
`npm run build`. HTTP tests need temporary localhost listeners.

Engine tests cover initial HP, compact party sizes, switches and identities,
terminal state, Transform, fresh PP/items/status and checkpoint/replay round trips.
Run tests cover once-only survivor recovery and 50% revival, bounded histories,
duplicate/stale requests and failure rollback. HTTP tests cover ownership, initial
creation retries, forged input, privacy, capacity and preservation of existing modes.

The engine identity includes adapter source, profile/data and runtime identity.
Never silently restore old checkpoints under incompatible code. Plan a drain,
compatible runtime or explicit migration before a public upgrade.

### Local verification — revival rules, 27 September 2026

- `npm test`: 1,127 application tests passed, including the revised recovery,
  HTTP configuration and client presentation/lead-selection checks.
- Run tests cover 50% revival without an additional 25% bonus, odd maximum HP,
  a one-HP minimum, repeated revival and lead changes, no recovery after losses,
  and once-only settlement through retries and commit failures. A real-engine
  test faints Shedinja, wins the battle, and begins the next round with the
  revived Shedinja as lead at 1 HP.
- Client checks keep fainted members at 0 HP throughout final battle playback,
  then reveal server-confirmed revival and permit the revived lead.
- `npm run build` passed. The idle local preview server was refreshed, and the
  browser showed the new 25% survivor recovery / 50% revival rules without
  console errors. No engine or effect recipes changed for this revision.

### Historical local verification — original rules, 27 September 2026

The following checks exercised `gen3-survival-v1`, before the requested 50% revival
rule. They document the original implementation and do not certify the revised
recovery arithmetic or revived-member selection.

- `npm test`: 1,125 passing application tests, including Survival run/AI/HTTP/UI
  contracts and existing simulation, multiplayer, music and presentation coverage.
- `npm run test:engine`: 72 passing engine tests, including carry-over HP,
  terminal roster identity and later-round checkpoint/replay restoration.
- `npm run teams:check`: the existing validated 386-species collection is unchanged.
- `npm run build`: production build passed. The existing large FX chunk warning
  remains; no effect recipes or new dependencies were introduced.
- Browser check of the normal production server: the initial entry navigation,
  start, moves, switches, multiple permanent eliminations, refresh during a turn,
  forfeit/results and return to setup. At 390 × 844 the page had no horizontal
  overflow; battle controls remained usable. No browser console errors observed.
- Real-engine integration completes two whole six-opponent battles, verifies
  once-only settlement and full PP/condition reset, and continues with a new lead.
- A temporary browser-only server fixture supplied six predictable legal opponents
  through the existing generator, leaving the engine, run manager, HTTP routes and
  production UI unchanged. Two wins and continuation into round three verified
  recovery after animation, changed leads, score, restored PP and intermission
  refresh. Raichu's finishing 318/324 HP remained on the battlefield while the
  recovery roster showed 324/324 (+6), then the next encounter began at 324/324
  with Thunderbolt 24/24 and Light Screen 48/48. The fixture server was stopped;
  normal generation still draws from all 386 species.

These checks preceded the requested navigation move into Battle Simulation.
After that move, the 15 client/music checks and production build passed again.
Browser checks confirmed Home → Battle Simulation → Survival, both mode selections,
the removal of Survival from Private Battles, and a 390-pixel mobile layout without
horizontal overflow or observed console errors.
That navigation change preserved the `/survival` route, then-current rules, engine
and API contracts. The later `gen3-survival-v2` revision changes victory recovery;
its verification must check revival separately.

This verifies local behavior. The mode has not been deployed, and durable saves
and competitive balance remain outside this version.
