# Building the authentic Generation 3 battle engine

**Engineering decision and implementation guide · 14 September 2026**  
**Status:** Recommended design, reviewed against repository commit `b42be22`. The production engine, adapter, server and load gates described here are not implemented by this document. Existing preview behavior is preserved.

**Implementation follow-up:** The [headless engine package](/Users/cdr/pokemon-battle-vue/packages/battle-engine/README.md) now implements the initial Gen 3 adapter slice. It uses checked startup registration instead of a vendor-file configuration overlay; the server, live client presenter and deployment gates below remain separate work. The comparison and diagnostic numbers in this guide record the preceding design review.

## 1. Recommendation and what “best” means

**Build a server-authoritative battle engine package that wraps the already pinned Pokémon Showdown implementation. Give the rest of the project a small, project-owned interface. Keep the existing `battle-core` as the FX showcase engine.**

This is the strongest fit for completing an authentic Gen 3 multiplayer game while working on one module at a time. You retain ownership of team editing, rooms, commands, privacy, storage, presentation, sprites, effects and sound. Showdown supplies the coherent mechanics and legality implementation that would otherwise take substantial work to reproduce.

“Best” here means the most credible route to correct, maintainable, deployable battles for this scope. It does **not** mean the fastest simulator has been established by a comparative benchmark. Three alternatives have not been implemented, and a local simulator diagnostic cannot certify a multiplayer service.

The current source pin is `pokemon-showdown@0.11.11`, commit `739a5e1fee432ad80ff7136d70cca993be358b59`. Use it as the first evaluation baseline because the imported data already uses it. It is not a claim that this version is the newest or free of defects. Preserve the exact dependency lock and source integrity checks when introducing a runtime package. See the [source lock](/Users/cdr/pokemon-battle-vue/tools/data-import/source-lock.json).

Read this with the [release contract](/Users/cdr/pokemon-battle-vue/docs/PROJECT_CONTRACT_V1.md) and [overall architecture guide](/Users/cdr/pokemon-battle-vue/docs/PRODUCTION_ARCHITECTURE_GUIDE.md). This document specializes the engine design and takes account of the completed data import; it does not silently approve proposed product defaults.

## 2. Review and grade the current implementation fairly

**Current `battle-core`: 8/10 as a fixed-outcome FX preview; 2/10 against the authentic Gen 3 production-engine requirement.** These are engineering assessments against two different purposes, not percentages of mechanics completed.

| Area | Current finding | Consequence for the engine |
| --- | --- | --- |
| Module boundary | Pure JavaScript, no renderer or browser dependency; outcomes commit independently of animation. | Preserve this separation. |
| Preview transactions | `{ before, after, event }` supports atomic damage, healing, recoil and optional presentation. | Useful showcase API; a whole match requires multiple ordered events and private views. |
| State validation | Unknown condition strings and fractional HP are accepted; arbitrary nested actor values remain mutable after shallow freezing. | Do not treat this as a production input boundary. |
| Damage | Ordinary damage and effectiveness wording come from preview records. | Stats, types, abilities, modifier ordering and rule RNG require a real simulator. |
| Turn lifecycle | No complete party, PP, simultaneous decisions, turn scheduler, replacements, residual phase or match result lifecycle. | Add a separate engine implementation instead of growing the preview resolver around incompatible assumptions. |
| Conditions | Screens/hazards are represented on preview actors; the caller can supply hit history. | Real side conditions, Pokémon volatiles and history must be engine-owned. |
| Tests | The focused core suite passed **32/32** in this review. Its assertions cover the intended preview. | This is evidence of preview stability, not Gen 3 conformance. |

Evidence: [state validation](/Users/cdr/pokemon-battle-vue/packages/battle-core/src/index.js:24), [move resolution](/Users/cdr/pokemon-battle-vue/packages/battle-core/src/index.js:57), [fixed damage](/Users/cdr/pokemon-battle-vue/packages/battle-core/src/index.js:226), [core tests](/Users/cdr/pokemon-battle-vue/tests/core.test.mjs). Move rule records are now individually frozen; the older review's mutable-registry finding is resolved.

There are **335 preview moves and 354 canonical Gen 3 moves**. The importer found 90 differing reference fields across 80 preview moves. Examples include Flamethrower 90 versus Gen 3's 95 power, Knock Off 65 versus 20, and preview Struggle recoil versus historical damage-based recoil. These intentional samples must not become production rules. The [import report](/Users/cdr/pokemon-battle-vue/tools/data-import/reports/REPORT.md) records every difference and the 19 moves without a preview rule.

The data package's 386 base species, 33 explicit forms, 354 moves, 106 items, 76 abilities, 25 natures and 17 types provide a strong reference foundation. Its callback inventory deliberately omits executable mechanics. A JSON field such as Hidden Power's `basePower: 0` cannot implement IV-dependent damage, and a list of individually obtainable moves does not prove a four-move set legal.

## 3. Compare the implementation approaches

Scores below use a 1–5 scale: 1 = substantial mismatch/unbuilt foundation; 3 = plausible with substantial bespoke work; 5 = strongest fit for this project's delivery constraints. Each contribution is `weight × score / 5`.

| Criterion | Weight | A: Extend preview | B: New custom engine | C: Pinned Showdown adapter | D: Maintain a Showdown fork |
| --- | ---: | ---: | ---: | ---: | ---: |
| Achieve and retain rules correctness | 30 | 1 | 2 | 4 | 4 |
| Solo delivery and maintenance | 25 | 2 | 2 | 5 | 2 |
| Modular boundaries and replacement | 15 | 2 | 5 | 4 | 4 |
| Deterministic recovery feasibility | 10 | 2 | 4 | 4 | 4 |
| Enforceable privacy boundary | 10 | 2 | 4 | 4 | 4 |
| Diagnosis and upgrade discipline | 5 | 2 | 3 | 4 | 3 |
| Performance under deployment load | 5 | Pending | Pending | Pending | Pending |
| **Design subtotal / 95** | | **32** | **56** | **81** | **65** |
| **Normalized design grade** | | **34/100** | **59/100** | **85/100** | **68/100** |

Performance is excluded from the normalized grade, not awarded a default passing score. Privacy, correctness and recovery are mandatory release gates even if a weighted average looks good.

**A — Extend the preview:** lowest recommendation. It couples preserving a successful visual test fixture to replacing its fixed-outcome assumptions. A fast implementation of fixed damage is not a fast implementation of authentic mechanics.

**B — Write a clean custom engine:** viable if implementing the simulator itself is a primary learning or product goal. It offers maximal internal design freedom but requires independent legality, historical arithmetic, interaction ordering, regression research and years of maintenance. All 386 species means this cannot ship as a small collection of popular moves without changing the release contract.

**C — Wrap the pinned engine:** recommended. Its principal risks are integration errors, upstream bugs, undocumented APIs and rule-policy mismatches. Those risks can be concentrated in a narrow adapter, explicit versioning and a substantial test corpus. The adapter is still real engineering work; installing a package is not a production architecture.

**D — Fork Showdown:** reserve for a demonstrated behavior requirement that configuration and an adapter cannot express. Renaming messages, adapting animation IDs and building a Vue client do not justify permanent ownership of an engine fork. A checked-in custom format definition is configuration, not a reason to rewrite upstream mechanics.

## 4. Specify one exact ruleset before wiring battles

The confirmed contract is turn-based singles, authentic Gen 3 mechanics, and all National Dex #001–386 with applicable historical forms. Network communication is live; turns are decision driven. No 60 Hz simulation loop is required.

The following remain **proposed** in contract v0.2: exactly six distinct species; level 100; one to four legal moves; Species Clause; no tier bans, extra competitive clauses or opponent team preview; a 90-second decision deadline; and a 500-turn draw limit. Carry these into a decision list, not into code disguised as confirmed rules.

Create a versioned project format such as `gen3-open-singles-v1`, containing:

| Decision | Required specification |
| --- | --- |
| Mechanics | `gen3`, exact engine revision, known historical discrepancies and adopted interpretation. |
| Content and obtainability | Gen 3 acquisition policy, event restrictions, version/form constraints and excluded later content. |
| Teams | Team and move limits, levels, duplicate species/items, legal starting forms, accepted IV/EV/nature/ability/item values. |
| Competitive policy | Explicit clauses and bans, including an explicit decision about sleep/freeze/evasion/OHKO/endless-battle policies. Do not inherit them unnoticed. |
| Information | Opponent HP representation, team visibility, initial ordering/lead selection, revealed information and private requests. |
| Match operation | Time limit, timeout arbitration, forfeit, turn cap, crash/no-contest, and whether a submitted choice can be changed. |

Recommended first policy for choice editing: submissions are final for that decision, with a UI confirmation before submission if desired. This simplifies recovery; it is a recommendation, not an existing product decision. If undo is enabled, specify and test the race with the opponent's final choice.

Neither `gen3ou` nor `gen3customgame` is the product's format. OU bans some roster members; the pinned Custom Game enables debug and permits 24 Pokémon, 24 moves and level 9999. Ubers also carries its own competitive policy. Inspect the **fully expanded** rule table, including inherited callbacks and numerical settings, rather than approving a short format name. [Pinned format definitions](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/config/formats.ts)

A displayable form is not necessarily a legal initial set. The validator can normalize Castform-Sunny to Castform; Deoxys has generation-specific team constraints. Return any accepted normalization to the player before ready confirmation. Do not silently erase a requested form or treat all 419 roster entries as distinct legal species.

**Register the chosen format reproducibly at engine startup/build time.** The pinned loader supports `config/custom-formats`; integrate this through a controlled runtime artifact containing the unmodified vendor package plus a separately hashed project configuration. Avoid editing a developer's installed package by hand. Verify the format resolves in a fresh process and after snapshot restoration. The data importer's checksum remains the checksum of its pristine dependency; a runtime artifact must additionally identify its custom configuration. [Pinned format loader](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/dex-formats.ts)

Do not construct an anonymous `new Dex.Format(...)` and assume saving the battle preserves it. In this pin, serialization records the format's base ID, not the full supplied definition; `@@@` custom-rule suffixes can also disappear. Restoration can therefore resolve a different ruleset. Prefer a registered immutable format ID; assert the resolved rules digest on create, restore and replay. [Pinned state serializer](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/state.ts)

## 5. Package boundaries and dependency injection

Introduce only the packages needed for each milestone. The names below are proposed, not existing APIs.

```text
apps/game                           apps/server
  Vue controls                         transport / sessions / rooms
  live presentation                    match service + persistence
  scene / FX / audio                    composition root
       │                                     │
       └──── battle-protocol ────────────────┤
                                             │
                                      battle-engine port
                                             │
                                      engine-showdown-gen3
                                             │
                                      pinned Showdown + format

game-data ──> team editor / reference UI
pokemon-sprites ──> scene
battle-core ──> existing preview only
battle-fx ──> cosmetic scene contract only
```

| Component | Owns | Forbidden dependencies / behavior |
| --- | --- | --- |
| `battle-engine` | Project-owned port, engine identity and contract fixtures. | Vue, Pixi, database, sockets, wall-clock deadlines. |
| `engine-showdown-gen3` | Vendor instance, team validation, command mapping, protocol interpretation, checkpoints and viewer projections. | App imports, FX, client-supplied damage or state. |
| `battle-protocol` | Runtime-validated commands and viewer-safe wire messages, schema versions. | Vendor classes, hidden engine state, renderer objects. |
| Server match service | Seats, serial ownership, durable accepted commands, timers, deduplication, result lifecycle. | Damage formulas or animation timing. |
| Live presenter | Display order, text, animation/audio requests, catch-up and reconciliation. | Rule RNG or authority over results. |
| `game-data` | Immutable reference records, source identities and editor candidates. | Runtime battles or executable rules callbacks. |

The server composition root can call `createMatchService({ engineFactory, store, clock, idGenerator })`. Tests inject an in-memory store and controllable clock. No dependency-injection framework is needed.

A stateful simulator can sit behind this port. Do not deep-clone a full battle on every action to force it into the preview's immutable API. The adapter owns mutable internals; its returned DTOs and checkpoints must be detached and inaccessible for external mutation.

The runtime engine uses **its own pinned Dex and mechanics together**. Reference data generated from the same pin drives UI, not an independently replaceable damage database. Check data/engine/format compatibility before joining a match. A browser with stale data receives a version mismatch and refresh guidance; the server remains authoritative.

Keep Showdown and its validator out of the browser dependency graph for this first slice. The client can check basic team shape locally and request authoritative validation from the server. Add an import/bundle boundary gate so importing a shared protocol type cannot accidentally ship the server engine. Prefer the documented simulator stream API; isolate direct `Battle`, serialization and format-loader access in small version-specific modules. Upstream explicitly does not promise semantic-version compatibility for undocumented APIs. [API stability guidance](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/README.md)

Moves, abilities, items and conditions are highly interacting rules modules inside the simulator. They can be researched and tested independently without becoming separate network services or hot-swappable packages. Upgrading a generation should select a new tested engine profile and data bundle, not change live battles underneath their players.

## 6. Design the engine port around decisions and observations

This is an illustrative contract to implement and test, not code that exists today:

```js
const engine = engineFactory.create({
  engineProfileId, // server allowlist -> pinned runtime and registered format
  canonicalTeams,
  privateSeed,
});

engine.getIdentity();                 // versions and resolved rules digest
engine.getPlayerView(seat);           // detached, viewer-safe observation
engine.getDecision(seat);             // legal choices, wait or finished
engine.submitDecision(seat, choice);  // rejection OR ordered viewer updates
engine.adjudicate(systemDecision);    // service-only forfeit or declared draw
engine.exportCheckpoint();           // opaque private bytes, engine use only
engine.dispose();

engineFactory.validateTeam(profileId, submittedTeam);
engineFactory.restore(checkpoint, expectedIdentity);
```

Keep low-level engine rejection distinct from a match-service duplicate or stale-command rejection. A legal first player's choice may be accepted while no turn has resolved. Forced replacements may ask only one player for input. Do not assume every pair of commands produces exactly one turn or one damage event.

`adjudicate` is a privileged service port, never an unrestricted client command. The service maps an authenticated forfeit or an approved timeout/turn-cap decision to it. An infrastructure no-contest is a durable service terminal transition that prevents further engine commands and disposes the engine; it does not pretend the simulator determined a winner. Record reason codes and ordered system decisions so replay can reproduce the complete match lifecycle.

The network command contains only intent:

```json
{
  "protocolVersion": 1,
  "matchId": "server-issued-id",
  "commandId": "unique-retry-key",
  "decisionId": "seat-specific-request-token",
  "action": { "kind": "move", "slot": 1 }
}
```

The authenticated session determines the seat. The client cannot assert a source actor, seed, HP delta, damage, result, legal action list or ruleset definition. Switching refers to a stable owned team-member identity that the adapter maps to the current vendor request. The server validates ranges and payload size before invoking the simulator.

**Use three separate counters:** a private durable command sequence, a separate event cursor per viewer, and a seat-specific decision ID. Private-only events must not create visible gaps in the opponent's cursor. Accepting player 1's choice must not invalidate player 2's still-open choice by incrementing a shared “expected revision.” Direct simulator requests do not supply the complete application request-token mechanism; the host must own it. [Pinned request protocol](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/SIM-PROTOCOL.md)

A duplicate command is identified by **`(matchId, authenticatedSeat, commandId)`**, checked only after seat authorization. Store a hash of the canonical validated payload and a seat-specific acknowledgment. The same key and payload return that saved outcome; a different payload is rejected. One seat must never retrieve the other seat's acknowledgment by guessing its retry key. A stale decision returns the latest permitted decision/view. Rejected and duplicate commands must not consume rule RNG or repeat mechanics.

The simulator accepts administrative stream commands as well as player choices. Do not concatenate arbitrary browser strings into it. Construct only allowlisted internal commands from validated structured intent. [Pinned simulator interface](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/SIMULATOR.md)

## 7. Treat team validation as its own complete workflow

1. Parse a bounded project team DTO; reject unknown fields, invalid numbers, unrecognized IDs and unsupported content before expensive validation.
2. Resolve reference IDs to vendor identities using a versioned mapping. Preserve original set order and immutable member IDs.
3. Clone the normalized input and run the pinned `TeamValidator` under the **same resolved format** used for simulation.
4. Return structured errors and the canonical accepted team. The validator may normalize or mutate sets; validation is not just a boolean operation.
5. Show changes requiring user understanding, then lock the canonical team at ready confirmation. Hash the canonical bytes with format/engine identity.
6. Revalidate server-side before starting, even if a browser check already passed. The simulator does not automatically validate supplied teams. [Team API](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/TEAMS.md)

Server errors should identify set and field without relying on English prose as machine identifiers. Preserve vendor explanation text for display where useful, but do not make gameplay depend on parsing that prose. Avoid inventing detailed error codes the vendor does not expose; use a general legality error with a safe explanation until reliably classified.

Required team fixtures include individually legal but jointly incompatible moves, event-constrained nature/IV/ability combinations, breeding/evolution sources, zero/four/five moves, oversized teams, invalid stats, Gen 4-only content, legal mythicals, base versus battle-only forms, and Gen 3 Deoxys constraints. Reuse the importer's Shedinja and Pikachu combination fixtures as regression inputs, not as exhaustive legality proof.

## 8. Preserve hidden information before presenting anything

Maintain three distinct representations: complete engine state, a player's permitted observation, and the client's currently displayed observation. Only the second crosses the network. A public result is a project-owned result object, not the simulator's private end record.

The adapter needs an observation ledger for each seat, advanced from that seat's filtered protocol. Record what has actually been revealed, stable identity mappings and pending request data. Rebuilding a reconnect view directly from the simulator's complete current objects can reveal an unrevealed move or item even if live events were correctly filtered. Persist these ledgers with the adapter checkpoint, or deterministically reconstruct them from retained per-seat observations before accepting new commands. Test that a live view and a restored view at the same cursor are identical.

At this pin, raw update messages can include `|split|` branches. `getPlayerStreams` separates side/spectator observations and private requests; omniscient and default replay output are unsuitable for live clients. The end record contains private teams, seed and input history. Filter through the correct visibility channel **before** mapping events, and consume raw end data only in a private server collector. [Pinned stream implementation](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/battle-stream.ts)

Use **one raw-stream reader**. The supported splitter consumes the raw stream and drops end metadata; adding a second reader to collect results can steal messages from it. Implement a tested dispatcher/tee that routes updates into the visibility splitter and end metadata into the private result collector. Consume or explicitly discard every unused output branch, including omniscient/spectator branches, so unconsumed buffers do not grow throughout a match. Test complete-message framing and disposal as well as redaction.

The player view may include the player's exact HP, PP and full party. Opponent details include only what the selected format/protocol has revealed: public HP representation, observed species/forms, moves/items/abilities when revealed, and public conditions. Never leak exact HP through auxiliary fields, future animation requests, logs or reconnection data. A percentage/bar representation is not the same thing as distributing the exact fraction internally to the browser.

Use stable project team-member IDs for the owning player and opaque observed identities for opponents. A field slot is a position; it is not a Pokémon identity. Vendor party order can change during switching. Test switch-out, return, Transform and form changes so neither private party order nor a stale sprite is inferred from array positions.

Project events might include move announcement, miss/failure, HP change, status, stat stage, item/ability revelation, weather, side condition, switch, form change, faint and result. Preserve their causal order and connect related events with an action ID. Do not require every turn to fit `{ source, target, damage }`.

Handle unrecognized vendor messages explicitly. Purely cosmetic unsupported text may use an escaped, already redacted text fallback. Unknown state-bearing messages must cause resynchronization through a separately verified, visibility-safe snapshot projection or a controlled match error; they must not silently leave an incorrect client view. An observation ledger that missed the unknown mutation cannot repair itself by simply re-sending its old values. Stop the affected match/profile when a trustworthy projection is unavailable. Never send unknown raw messages “temporarily” to debug a live UI.

## 9. Make deterministic progress durable

Use one serial command owner per match. Start with one backend deployment and a bounded pool of simulator workers; multiple live matches can share each worker. Workers own simulator objects and queues, while the match service owns transport and persistence. Avoid a worker per move or per socket. Node recommends worker pools for CPU-intensive tasks because creation overhead can exceed the benefit. [Node 24 worker guidance](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html)

For the first production slice, checkpoint after every accepted decision boundary, including a pending first-side choice. Optimize checkpoint frequency only after recovery and size measurements justify it.

**Command transaction:**

1. Authenticate, enforce ownership, check command deduplication and the seat's decision token.
2. Apply the command on the owning worker, collecting the detached checkpoint and viewer outputs. Nothing is sent to clients yet.
3. In one database transaction, append the accepted command, save checkpoint and service metadata, save deduplication response, and append per-viewer messages to an outbox.
4. Commit, then acknowledge and publish outbox messages. Clients deduplicate event cursors; delivery may happen more than once.
5. If commit fails or its outcome is uncertain, stop that worker's match processing. Inspect durable state and restore it before retrying. Never continue from a speculative in-memory state that storage did not commit.

This provides durable single application of commands with retryable delivery, not a magical exactly-once network. If the second choice resolves a turn and a crash occurs before commit, reconstruct from the last durable boundary and retry deterministically. If the crash follows commit but precedes acknowledgment, the saved command result answers the retry.

Apply the same persist-before-publication rule to initialization and all terminal transitions. Save engine identity, canonical teams, seed, initial checkpoint and opening observations before announcing that the battle has started. Journal ordered **system decisions** as well as player choices: timeout forfeits, manual forfeits, turn-cap draws and service no-contests. Replay consumes these records in order; it does not rerun wall-clock timers. A terminal record is idempotent and rejects later choices, including those arriving from an old worker or socket.

When more than one backend can own a match, add a storage-backed owner lease and monotonically increasing fencing token. Every write must check the token so an expired owner cannot commit after a replacement. Do not implement distributed ownership before there is a second owner to coordinate, but keep match IDs and repository methods ready for it.

Persist an envelope containing:

| Private record | Why it is required |
| --- | --- |
| Engine package version, source digest, adapter version | Interpret mechanics and snapshot shape consistently. |
| Registered format ID, definition and expanded-rules digests | Prevent restoration under subtly different rules. |
| Reference data version/digest and wire schema | Reject incompatible catalogs and migrations. |
| Canonical starting teams and private starting seed | Deterministic input replay. |
| Opaque detached simulator checkpoint, checksum and command sequence | Fast recovery with corruption/version checks. |
| Adapter observation ledgers, identity mappings and pending requests | Reconstruct precisely what each player knows, including through switching and restoration. |
| Pending decisions, seat tokens, deadlines, result and delivery cursors | Recover service behavior outside the simulator. |
| Accepted command journal, deduplication outcomes and outbox | Recover retries and publications correctly. |

The simulator's input log records choices when they are committed together; it is insufficient as the sole record of a pending first player's accepted choice. `toJSON()` also aliases the live log at this pin: serialize/deep-copy immediately, and do not recursively freeze its returned object. Restoring the battle and rebinding its send callback does not itself implement reconnect or retransmit all initial requests. Explicitly rebuild permitted observations and pending decisions from the restored engine/service state. [Battle lifecycle](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/battle.ts)

Use the vendor PRNG state and draw order; keep the private initial seed server-side. Wall-clock time, IDs, animations, logging, snapshots and reconnects must not draw from rule RNG. Cosmetic seeds are separate values with no recoverable relationship to the private battle seed. Replay equality should compare a canonical representation of mechanics, ordered events, requests and RNG state; exclude deliberately external wall-clock metadata, not inconvenient differences.

Selecting the Gen 3 mod does not select the original GBA random-number generator. The diagnostic explicitly selects Showdown's Gen5RNG through its seed format. Reproducibility here means matching outcomes under the recorded simulator algorithm, seed and decisions. Define the production algorithm in the engine profile and evaluate historical mechanics/distributions separately; do not claim a simulator seed reproduces a cartridge seed. [Pinned PRNG implementation](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/sim/prng.ts)

Hash the actual format configuration artifact as well as a canonical expanded rule table. A JSON serialization of a format object omits executable callbacks and is insufficient to identify behavior. Include the pinned vendor tree and adapter build in the compatibility identity, and reject unrecognized snapshot versions rather than guessing a migration.

## 10. Timers, reconnection and results belong to the match service

Persist an absolute deadline for each open decision; use a monotonic clock while the process runs and a documented wall-clock policy after restart. Reconnecting or a failed command must not grant a new timer. The deadline starts when the server creates the decision, not when animation ends.

Route accepted choices, forfeits and deadline expiration through the same serial owner. Define whether arrival before the deadline or processing before the deadline counts; recommended policy is authenticated ingress time with bounded ingress queues, followed by serialized arbitration. Stamp a complete, authenticated, size-checked command when the ingress dispatcher admits it, and enqueue it without an intervening asynchronous operation. The same dispatcher must place an expiry marker after all already admitted commands for that deadline; expensive legality/worker work happens after admission. If those operations cross processes, supply an equivalent ordering barrier before resolving expiry. A client timestamp is never evidence of timely arrival.

Persist the admission/expiry ordering and the winning decision with the durable outcome. Explicitly test a valid pre-deadline choice queued behind a slow command and an expiry callback. Specify the outcome when both required seats expire at the same boundary, instead of allowing timer callback order to pick a winner. An ingress queue that cannot safely admit more work triggers backpressure/service handling; it must not silently accept and then discard a player's timely decision.

Server admission or worker failure must not become a player's forfeit. If recovery cannot safely finish within the service's recovery policy, produce the proposed explicit no-contest. Turn-cap, timer and no-contest policies need their own reason codes and tests alongside ordinary battle wins/losses/draws.

Reconnection authenticates the existing seat, returns a fresh permitted snapshot at a known event cursor, pending decision and remaining time, then resumes subsequent messages. Buffer live messages while obtaining the snapshot and discard any at or below its cursor. Do not replay minutes of animation before allowing a legal action. Completed matches return their durable result.

## 11. Verify Gen 3 mechanics as interactions, not a count of moves

Adopting Showdown provides an implementation, not proof that every cartridge detail is correct. Maintain a reviewed mechanics corpus with explicit initial teams/state, seed, choices, expected facts, source and rationale. Never generate expected outputs and approve them automatically from the same run being tested.

| Mechanics group | Minimum regression cases |
| --- | --- |
| Stats and legality | Nature/IV/EV calculations; Shedinja HP; historical types/abilities; accepted and rejected complete sets. |
| Damage and category | Dark special/Ghost physical; dual typing and immunity; STAB; burn, critical hits, screens, weather and integer rounding at boundaries. |
| Dynamic/fixed damage | Hidden Power IV-derived type/power/category; Seismic Toss level; Psywave range/accuracy; variable-power HP moves and immunity handling. |
| Decisions and ordering | Speed ties with deterministic seeds; priority; switches; paralysis; moves prevented by sleep/freeze/confusion; forced replacements. |
| PP and choice restrictions | PP use including Pressure; exhausted moves and Struggle; Disable, Encore, Taunt, Choice Band; invalid/stale move-slot submission. |
| Status and residuals | Toxic progression/reset; sleep counters including switching; weather damage; Leech Seed, trapping, Leftovers and fainting order. |
| Multi-turn and multi-hit | Prepare/attack turns; recharge; interrupted moves; independent hit processing, Substitute, recoil, item activation and early fainting. |
| Switching interactions | Pursuit; trapping and Baton Pass; entry hazards; screen/hazard side ownership; stat/volatile reset and legal passing. |
| Items and abilities | Immunities and activation order; berries; Intimidate/weather entry; Knock Off removal state; consumption and recovery; item/ability revelation. |
| Reactive and delayed moves | Counter/Mirror Coat/Bide history; Protect/Endure; Destiny Bond/Perish Song; Future Sight/Doom Desire; called/copied moves. |
| Transform and forms | Starting-form legality; Castform weather changes; Transform move/PP/state identity; Unown appearance versus species identity. |
| Match ending | Last-member faint; double faint/residual ordering; forfeit; agreed turn cap; no extra requests/events after completion. |

Examples of historical behavior that modern intuition can get wrong: Gen 3 categories depend on type; Struggle recoil is based on damage dealt; Explosion/Self-Destruct halve the relevant Defense in damage calculation; Rock types do not yet receive Sandstorm's later Special Defense bonus. Treat these as test subjects tied to the pinned implementation and independent expected-value research, not as isolated patches to the preview. [Gen 3 damage scripts](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/data/mods/gen3/scripts.ts), [move overrides](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/data/mods/gen3/moves.ts), [conditions](https://github.com/smogon/pokemon-showdown/blob/739a5e1fee432ad80ff7136d70cca993be358b59/data/mods/gen3/conditions.ts)

Distinguish these evidence levels:

1. **Schema/provenance checks:** imported artifacts match the pinned source and expected structure.
2. **Adapter conformance:** direct vendor execution and adapter execution agree. This catches mapping and integration errors, not shared engine bugs.
3. **Reviewed mechanics expectations:** independently calculated examples or documented cartridge experiments with provenance. Track disagreements explicitly; do not silently “correct” missing information.
4. **Integration/fault tests:** privacy, replay, persistence, client rendering and recovery behave correctly around those mechanics.

A coverage ledger should list every move, ability, item and condition as vendor-supported, adapter-observable, covered by targeted regression, covered only through integration, or known discrepancy. Do not mark all 354 moves “fully tested” because a single simulator match passed. Incomplete FX coverage is independent of mechanics coverage.

Start the detailed corpus with observable, high-value fixtures:

| Fixture | Specific assertion and method |
| --- | --- |
| Hidden Power IV vectors | All-31 IVs yield Dark/70, all-30 yield Fighting/70, all-zero yield Fighting/30; check category from resulting type. Derive expectations independently of production helpers. |
| Arrival-order independence | Submit the same two legal decisions in opposite network order with the same seed; compare resolved events and RNG state. This tests integration, not cartridge equivalence. |
| Substitute across multiple hits | The breaking hit does not spill excess damage into HP; later hits may damage HP and stop on fainting. Review a separate damage ledger. |
| Pursuit and switching | The departing target is intercepted; PP is spent once; Pursuit is not executed again from the ordinary queue; replacement and entry effects happen once. |
| Spikes thresholds | One/two/three layers use historical 1/8, 1/6, 1/4 HP damage and relevant grounding/immunity rules. Use odd HP totals to expose rounding errors. |
| Historical immunity distinctions | Ordinary Levitate blocks Earthquake; Electric typing alone does not block paralysis; Grass typing alone does not block powder moves in Gen 3. |
| Retaliation exception | Counter's Gen 3 treatment of Hidden Power differs from Mirror Coat's, even when its effective type is special. Use suitable nonimmune participants and independently documented traces. |
| Knock Off and recovery | Removal cannot be treated as an ordinary consumed-item slot; Recycle must not recover a knocked-off item. Include switches before the recovery attempt. |

These are proposed regression expectations checked against the pinned reference, not completed independent experiments. Store a source and verification status per fixture. For stochastic cases, enumerate controlled branches in the test harness rather than asserting that a rare outcome happens during a small random sample. Keep test RNG controls out of the production network contract.

## 12. Connect the engine to existing presentation safely

Keep the current [preview presenter](/Users/cdr/pokemon-battle-vue/apps/game/src/presentation/presenter.js) and its tests. Add a separate live-match presenter that consumes viewer-safe ordered events. Reuse scene and FX interfaces through host adapters; do not pass raw simulator objects into either package.

For an attack, the server already decides hit/miss, damage, statuses and subsequent effects. The live presenter groups related events, starts the matching animation and reveals display changes at suitable cues. Completion, skip, failure, reduced motion and effects-off all reconcile the same latest permitted result. A cue is never a request to calculate or commit damage.

One authentic turn can contain a switch, ability reveal, failed move, several hits, recoil, weather, item healing and multiple faints. The presenter needs a bounded event queue, action groups and cancellation/catch-up behavior. Existing multi-hit recipes have fixed cosmetic contact counts; they may present the aggregate result initially if clearly cosmetic. They must not manufacture intermediate authoritative hits or repeat already-applied damage. A faithful per-hit visual adapter can follow later without changing mechanics.

Maintain a generated, checked move identity mapping. The current importer matches by canonical move number; for example preview `vice-grip` maps to vendor `visegrip`. Removing punctuation is not a complete normalization strategy. The 19 moves with no recipe still get text, state updates and a generic host presentation. They remain legal where the engine permits them.

Sprite assets and form appearance resolve in the host scene. Team editor stats come from reference data; actual battle HP/stats come from the player's permitted engine observation. Do not turn base HP into maximum battle HP or use Pokédex physical dimensions for scene sizing. The default showcase retains its authored HP, level, anatomy and choreography.

Inject audio separately from FX. Both receive cosmetic facts, can be disabled and have cancellation/cleanup contracts. A slow device, blocked audio, missing sprite or animation timeout cannot extend a decision timer or change a result.

## 13. Performance evaluation and deployment design

Optimize the correct simulator after measuring it. Useful metrics are accepted-command acknowledgment, time to resolve a decision batch, worker queue delay, event-loop delay, checkpoint/replay time, bytes per active match, output volume and long-match memory growth. Browser frame rate measures presentation, not server rule throughput.

The accompanying [diagnostic script](/Users/cdr/pokemon-battle-vue/docs/engine-evaluation/probe.mjs) and [recorded output](/Users/cdr/pokemon-battle-vue/docs/engine-evaluation/results.json) provide a reproducible local engine experiment. They are intentionally outside production packages. Their built-in diagnostic format is not the proposed project format; inspect the recorded workload and caveats before using the numbers. No network, database, authentication or deployed concurrency is represented.

Run it from the repository with `node docs/engine-evaluation/probe.mjs`; it uses the already installed isolated importer dependency, verifies its source tree, and rewrites the diagnostic result file. If that dependency is absent, the existing `npm run data:setup` installs the exact importer lock. No production dependency is added by the probe.

Recorded on Apple M4, 10 logical CPUs, 16 GiB RAM, Node 24.4.1:

| Observation | This run |
| --- | ---: |
| Diagnostic assertions | 11 passed |
| Sequential measured matches after 10 warmups | 100 natural wins; 0 capped draws |
| Decision batches measured | 3,474 |
| Warm decision batch p50 / p95 | 0.155 / 0.214 ms |
| First format load and two-team validation | 153.832 ms |
| First battle initialization after validation | 4.771 ms |
| Ordinary / pending-choice checkpoint size | 33,847 / 33,982 bytes |
| Ordinary / pending-choice restore time | 1.362 / 0.476 ms |

The two fixed teams have one offensive move per member, no items and default choices. The first match took 39 decision batches over 30 turns. Snapshot and continuation equality passed both normally and with one player's choice pending. Negative probes reproduced log aliasing and custom-rule loss; preserving the full diagnostic format identity restored those settings. These results support feasibility and identify adapter hazards. They do not award the pending performance score or validate all Gen 3 mechanics.

Before release, run these three workloads on the actual deployment artifact and documented hardware:

| Workload | What it establishes |
| --- | --- |
| Representative legal teams across seeds | Normal decision throughput, correctness and output sizes. |
| Valid difficult interactions and long matches | Bounded called-move/residual/multi-hit work, memory growth, timer and checkpoint behavior. |
| Socket clients with reconnects, duplicate/stale commands and worker crashes | End-to-end latency, persistence, recovery and backpressure under load. |

Separate cold process startup, Dex/format loading, first team validation, first match and warm steady-state measurements. Record sample counts, p50/p95/p99, failures and unfinished matches. Percentiles from a small convenient workload do not establish rare-event behavior. Include network RTT and database time in the client-visible acknowledgment budget; do not compare engine-only CPU time directly with that SLO.

Contract v0.2 proposes **100 simultaneous matches, 200 battle clients plus 50 lobby clients for 60 minutes**, with p95 command acknowledgment at most 250 ms under specified network conditions. This remains an acceptance test, not an achieved capacity. Reserve room for reconnect bursts and worker replacement. Bound payloads, pending commands per seat, event/outbox retention, input validation time and worker execution time. A hung synchronous simulator must be stoppable by its owning worker boundary, not only by a Promise timeout on the same blocked thread.

Deploy a Node-compatible backend with persistent storage independently of the static frontend. Start with one region, a database such as PostgreSQL, and measured worker capacity. A message broker or Redis is optional until distributed queues/ownership require it. Keep secrets and private checkpoints out of static assets. Treat checkpoints and team logs as private application data with defined access and retention.

Pin the runtime and dependencies in the deployment artifact. Drain old instances: stop admitting matches, finish or safely hand over existing ones, and verify restored engine identities. Retain the old engine/config artifact for supported active matches and replay history. A rollback must not attempt to deserialize a new snapshot using an incompatible old adapter.

Track structured operational metrics without full private requests: engine profile, turn/decision counts, queue time, reject category, restore failure, unknown protocol message, desync and no-contest reason. A protocol or rules-digest mismatch should stop admission for the affected profile and produce an actionable diagnostic.

## 14. Implement and review in small vertical slices

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| 0. Freeze format and identities | Approved product decisions; registered project format; engine/data/adapter compatibility manifest. | Fresh process and restore resolve identical rules; legal roster/form fixtures pass; no inherited surprise clauses. |
| 1. Headless engine adapter | Validate/canonicalize teams, create match, accept decisions, expose private views, finish, checkpoint/restore. | Two headless players finish; same seed/inputs reproduce outcomes; pending first choice survives restore; invalid choices do not advance RNG. |
| 2. Mechanics and protocol corpus | Reviewed historical fixtures, event mapping, legal-set and visibility tests. | Known critical Gen 3 cases pass; all required protocol branches have explicit handling; no private information in opponent observations. |
| 3. Durable room service | Sessions/seats, invite rooms, serial commands, timers, transaction/outbox and reconnect. | Crash at each commit boundary; retry/dedup/stale cases; seat recovery; forfeit/draw/no-contest; no deadline reset. |
| 4. Playable client slice | Team editor, legal choices, switch/replacement controls, live presenter, result screen. | Two browser sessions complete a battle with FX on/off; all legal moves usable including missing FX; refresh resumes correctly. |
| 5. Queue and production gates | Same-format unranked matching, admission limits, load/compatibility tests, drain and rollback. | Contract flow, privacy, performance and recovery targets pass on the deployed artifact. |

Do not implement one move at a time by copying its modern metadata into the preview resolver. With the recommended adapter, the full pinned Gen 3 mechanics implementation is available at stage 1; your staged work establishes that the format, adapter, service and UI handle it correctly.

Every stage should receive a short review recording: intended behavior, evidence, remaining discrepancies, boundary changes, and pass/fail exit criteria. Re-run relevant mechanics/replay fixtures when adapter or vendor code changes. Run existing FX suites for shared presentation/lifecycle changes, not for an unrelated documentation edit.

The smallest useful next implementation request is:

> Implement stage 0 and a headless stage 1 prototype behind a project-owned engine port. Keep the preview, FX and scene behavior unchanged. Use the existing exact Showdown pin and an explicit registered Gen 3 format whose remaining product defaults are confirmed before adoption. Add team canonicalization, viewer-safe decisions/events, deterministic replay and checkpoint recovery including a pending first-side choice. Do not add multiplayer transport or change animations in this slice. Report ruleset decisions, validation evidence and remaining blockers.

## 15. Iterative review record and final selection

This iteration reviews designs and a local diagnostic; it does not pretend several production engines have been built and benchmarked.

| Review round | Finding | Change to the selected design |
| --- | --- | --- |
| 1. Current implementation and alternatives | The preview is stable for its purpose but lacks authentic simulation. Imported metadata omits executable behavior. | Preserve it; select C using the weighted rubric and keep runtime rules coherent with the source pin. |
| 2. Pinned API and failure-path inspection | Teams are not auto-validated; private stream/end records leak secrets if broadcast; custom formats can restore incorrectly; pending choices are absent from committed input logs. | Add canonical team acceptance, visibility-first adapters, registered format identity checks, and durable pending-decision checkpoints. |
| 3. Adversarial guide and diagnostic review | Retry keys needed seat scoping; multiple stream readers could compete; ingress/expiry ordering needed an admission point; system adjudications were absent from the sample port. The diagnostic passed 11 assertions and 100 sequential sample matches. | Added seat-scoped deduplication, one stream dispatcher, explicit admission ordering, privileged adjudication and durable system events. Added per-viewer cursors and observation-ledger recovery. Production load remains unmeasured. |

**Selected architecture: C, 81/95 design points, normalized to 85/100.** The useful outcome is a bounded integration plan with explicit release gates. Full Gen 3 correctness, safe multiplayer operation and target-load performance must be demonstrated by implementation and tests before the project is described as production ready.

The independent draft review rated the guide **8.5/10**, with the four mandatory clarifications above required before finalization. A focused second review verified all four corrections and the cursor/projection improvements, rating the final guide **9/10** with no remaining document blockers. That document-quality assessment is separate from the architecture comparison and the current core's grades; it does not award implementation readiness.
