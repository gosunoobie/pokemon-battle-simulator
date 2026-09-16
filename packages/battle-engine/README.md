# @battle/battle-engine

An independent **Node 24+ headless Gen 3 battle engine** backed by pinned Pokémon Showdown `0.11.11`. It handles legal teams, complete singles simulation, move/switch requests, viewer-specific observations, system results, checkpoints and replay. Existing `battle-core` and all FX recipes remain separate.

Run from the repository:

```sh
npm run test:engine
npm run engine:demo
```

The demo completes a battle, restores a pending first player's choice, and checks that replay reproduces both players' observations and events. A fresh checkout installs the runtime through the root lockfile; install scripts are unnecessary for this simulator adapter (`npm ci --ignore-scripts`). There is no runtime import from `tools/data-import` or the preview app.

## Implemented scope

The `gen3opensinglesv1` profile adopts the architecture guide's first-build defaults: exactly six distinct base species, level 100, one through four legal moves, Gen 3 Obtainable validation and Species Clause. All #001–386 species are eligible subject to full-set legality. Held-item duplicates are allowed. There are no tier bans, opponent team preview, extra sleep/freeze/evasion/OHKO clauses, undo, bag actions or debug rules. Completed turn 500 ends the match in a draw if mechanics have not already produced a result.

The first submitted member is the lead. Species/forms, nature, ability, IV/EV limits, event combinations and movesets are checked by the same format that runs the battle. Castform battle forms may normalize to base Castform; displayable forms are not automatically selectable initial battle forms.

The optional `createEngineFactory({ profileId: 'gen3regionalleaguev1' })` selects
a separate NPC league profile: one through six members and repeated species,
with the same Gen 3 mechanics, level 100 and full-set validation. It does not
change the default Open Singles profile. Both profiles can coexist in one process;
their distinct identities prevent cross-profile checkpoint/replay restoration.
Regional trainer rosters and tournament progress belong to the host, not this package.

`factory.validateOpponentTeam(team)` validates the NPC seat. For the league
profile only, Karen's sourced Gold/Silver Murkrow set (Quick Attack, Whirlwind,
Pursuit, Feint Attack) has a narrowly pinned move exception. Its other moves and
all remaining fields still undergo ordinary validation; the exact exception is
part of the profile identity. `validateTeam()` and the p1 seat reject that move
combination. `create()` uses the appropriate validator for each seat, including
on replay. Default Open Singles opponent validation has no exceptions. See
[provenance and discrepancy](../../docs/LEAGUE_ROSTERS.md).

This package supplies the headless engine slice. Authentication, sockets, rooms, matchmaking, durable database commits, real-time deadlines and the live Vue presenter are separate server/client work. No client should construct or adjudicate an authoritative battle locally. Browser resolution exposes only an error stub, without the simulator dependency graph.

## Public port

```js
import { createEngineFactory } from '@battle/battle-engine';

const factory = createEngineFactory();
const checked = factory.validateTeam(submittedTeam);
if (!checked.valid) return { errors: checked.errors };
// Present checked.changes before ready confirmation in the future team UI.
const engine = factory.create({
  matchId: 'server-issued-match-id',
  teams: { p1: checked.team, p2: otherCheckedTeam },
  // Omit seed for a fresh private SodiumRNG seed.
});

const decision = engine.getDecision('p1');
const response = engine.submitDecision('p1', {
  commandId: 'seat-scoped-retry-key',
  decisionId: decision.id,
  action: { kind: 'move', slot: 1 },
});
const view = engine.getPlayerView('p1');
const updates = engine.getEvents('p1', previousCursor);
```

The surrounding service derives `p1`/`p2` from authenticated seat ownership. The engine never authenticates a client-supplied seat. `matchId` defaults to `battle` for local fixtures; the service must supply unique match IDs.

| Method | Contract |
| --- | --- |
| `factory.getIdentity()` | Detached engine, adapter-build, format and reference-data fingerprints. |
| `factory.getProfile()` | Detached explicit policy/defaults and format definition. |
| `factory.validateTeam(team)` | `{valid, team, errors, changes}`; no caller mutation. |
| `factory.validateOpponentTeam(team)` | Same contract, with only the selected profile's explicit NPC exceptions. |
| `factory.create({teams, matchId?, seed?})` | Validates both teams and creates an engine at the first decision. |
| `factory.restore(checkpoint)` | Restores private engine state, observations, request IDs, receipts and journal under identical code/data/rules identities. |
| `factory.replay(record)` | Replays admitted player attempts and system decisions, including a pending first choice. |
| `engine.getDecision(seat)` | `{id, kind, moves, switches, canSwitch}`; kind is `move`, `switch`, `wait` or `finished`. |
| `engine.submitDecision(seat, command)` | Structured acknowledgment with `accepted`, optional `code`, and the caller's next decision. |
| `engine.getPlayerView(seat)` | Detached permitted reference observation, current decision and result. |
| `engine.getEvents(seat, afterCursor = 0)` | Detached ordered facts after that viewer's cursor; never use another viewer's cursor. |
| `engine.adjudicate(systemDecision)` | Privileged service-only forfeit, draw or no-contest. |
| `engine.exportCheckpoint()` | Private JSON string with checksum and version envelope. |
| `engine.exportReplay()` | Private starting teams/seed and ordered admitted-command/system journal. |
| `engine.dispose()` | Idempotently destroys simulator resources and prevents further use. |

Move slots are one-based, as returned in the request. Switch actions use `{kind:'switch', memberId:'p1:2'}` with an ID returned by `decision.switches`; its current vendor party index remains an implementation detail. Do not store a switch slot across turns. Forced replacements can issue additional decisions within one turn.

Each seat has its own decision counter. Accepting p1's choice leaves p2's open decision valid; p1 waits until the required choices resolve. Submitted choices are final. Requests describe known legal options; hidden trapping/disable information can cause the simulator to reject an apparent option and update that seat's request. The client must use the returned decision.

Admitted command receipts are scoped to this match instance plus `(seat, commandId)` and canonical payload digest. Exact retries return the saved acknowledgment; different payloads under that admitted key are rejected. Malformed, stale and visibly illegal commands are rejected **before admission** and allocate no journal/receipt entries. The surrounding service must rate-limit ingress. Admitted commands are bounded to 8,192; a terminal adjudication remains available even at that limit.

## Team defaults and canonicalization

Required set fields are `species`, `ability`, `nature`, and `moves`. Optional defaults are reported through `changes`: level 100; zero EVs; 31 IVs; happiness 255; no held item; non-shiny. Gender and encounter constraints remain subject to upstream legality. IVs must be integers 0–31; EVs 0–255 per stat and at most 510 total. Unknown fields, non-JSON objects, accessors, malformed arrays and oversized input are rejected before vendor code runs.

The validator's exact zero-EV reminder is suppressed because untrained sets are legal. No EV is added, no debug mode is enabled, and other legality errors remain failures. Normalize and confirm teams before locking them in a match. `create()` validates again and uses the accepted canonical teams; it does not implement a user confirmation screen.

## Views, events and private data

`view.own.team` contains stable `memberId`, species, exact `hp:{current,max}`, condition codes (`brn`, `par`, `slp`, etc.), known moves, base stored stats from the private request, and permitted item/ability information. Those stats are not the final effective values after all battle modifiers. `view.own.active` identifies the current active member. `view.opponent.known` starts with only the revealed lead, uses opaque reveal-order IDs, and receives public HP bars and subsequently revealed facts. Unseen party order, unrevealed moves/items/abilities, exact opponent HP, raw requests, seeds and private replay/end records stay inside the adapter.

Events have `{cursor, type, args}`. Protocol-derived events use `args:{opcode,fields}` with actor references rewritten to viewer-local IDs. These are already visibility-filtered facts, suitable for a later presentation adapter; fields are data and must never be rendered as HTML. Result/request events use project-owned structured arguments. Each viewer has an independent contiguous event sequence, so private requests do not create gaps for the opponent.

The current observation is a **protocol reference ledger**, not the finished live battle UI reducer. It retains ordered facts for presentation and tracks core visible state. Transient animation and detailed condition-duration UI belong to the later presenter. Unknown state-bearing opcodes set `complete:false` and list only safe opcode names in `projectionWarnings`; their payload is discarded. A live service must stop or resynchronize through a separately verified projection when this flag is false. It must not silently present the ledger as complete. Debug, arbitrary HTML and private end messages are never forwarded.

## Recovery and deterministic execution

```js
const checkpoint = engine.exportCheckpoint();
// The future match service commits this plus receipts/outbox before acknowledging.
engine.dispose();
const restored = factory.restore(checkpoint);

restored.adjudicate({ kind: 'forfeit', seat: 'p1', reason: 'timeout' });
// Other privileged examples:
// {kind:'draw', reason:'agreement'}
// {kind:'no-contest', reason:'infrastructure'}
```

Exported checkpoints are detached immediately, including the upstream log. Restoration registers the exact named format before `Battle.fromJSON` and recovers each seat's observation ledger, current requests, decision counters and admitted receipts. It does not fall back to Custom Game or reconstruct opponent knowledge from secret engine objects.

New matches use 32 random bytes with the upstream SodiumRNG implementation. Explicit `seed:[1,2,3,4]` or `gen5,` seed strings are available for existing deterministic test vectors; explicit `sodium,` followed by 64 lowercase hexadecimal digits is also supported. Record the exact algorithm and state in private recovery data. These simulator RNGs do not reproduce a GBA cartridge seed sequence. Rendering, clocks, snapshots and retries do not draw battle RNG.

The synchronous engine has no timer, database or delivery guarantees. The match service must serialize decisions and terminal events, persist before acknowledgment/publication, authenticate seats and handle worker failures. A thrown `ENGINE_FAILURE` faults the instance; restore the last durable checkpoint before continuing. System forfeits/draws/no-contests are replayed from the journal rather than recomputed from wall-clock time. The 500-turn cap is deterministic adapter policy reproduced when the same choices replay.

**Checkpoints and replays are trusted private storage artifacts, never client uploads.** The checksum detects corruption; it is not a signature or authentication mechanism. They include both full teams and rule seeds. Size limits are 32 MiB per record, and identities include the source digests of shipped adapter modules. Cross-version migrations are rejected until explicitly implemented. Events/logs grow with the bounded match; production retention, worker limits and storage policies still require service integration and load testing.

## Pinning and verification

The runtime verifies all 1,585 upstream package files against the same source-tree digest used by the importer before loading executable vendor code. It also verifies all 12 files of the `ts-chacha20@1.2.0` RNG dependency resolved from Showdown's context, and checks the actual reference-data bytes against their manifest. The RNG digest and exact Node/V8 versions join the checkpoint identity. No preview rules or callback-free JSON data are injected into the simulator's damage pipeline.

One isolated private API operation registers the immutable named format in `Dex.formats.rulesetCache`. It checks collisions and expanded rules, changes no built-in format and writes no vendor files. This is a deliberate exact-version adapter seam: tests prove fresh-process restoration preserves its rules. `Battle`, channel extraction and serialization internals are also encapsulated here; an upstream update requires revalidation of these seams and replay comparisons.

Tests cover independent damage arithmetic, historical category/Hidden Power behavior, legal missing-FX moves, status/PP/immunity, forced replacements, canonical teams and incompatible sets, redaction, retries, per-seat request IDs, save/restore, replay, system results and package boundaries. They establish a tested integration with the pinned simulator, not exhaustive independent cartridge verification or production multiplayer capacity.

See the [engine architecture guide](/Users/cdr/pokemon-battle-vue/docs/BATTLE_ENGINE_GUIDE.md) for the remaining server, client and production gates.
