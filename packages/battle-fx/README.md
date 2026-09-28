# @battle/battle-fx

Optional Vue-free battle effects for PixiJS 8 and GSAP 3. Contains 345 moves with independent recipes and package-relative effect assets. It imports neither battle-core nor host Pokémon artwork.

```js
import { createBattleFx } from '@battle/battle-fx'
const fx = createBattleFx()
const handle = fx.play({
  moveId: 'surf', sourceId: 'source', targetIds: ['target'], visualSeed: 42,
}, { scene, onCue: cue => console.log(cue.type) })
const { status } = await handle.finished
fx.dispose()
```

Provide a host scene with `width`, `height`, `unit`, PixiJS `effects` and `camera` containers, and `actor(id)`. An actor exposes `metrics`, `facing`, resettable `pose`, `anchor(name)`, `base(name)`, `resetPose()` and optional `snapshot()`. Anchors are current/resting points in the common effect-layer coordinate space: center, emission, hand, foot, body and ground. The host owns visible bounds, sprite textures, facing and layout. See the workspace `docs/MIGRATION.md` and scene adapter for the full contract.

`play` accepts optional `signal`, `onCue`, `reducedMotion`. Its handle supports `cancel()` and always settles `finished` as completed/skipped/cancelled/failed for supported lifecycle paths. Deadlines default to 6000 ms. Only the first target is animated; unsupported non-hit outcomes skip. The runtime owns one play per scene. Cancellation/replacement removes temporary graphics and restores actor/camera poses. It never reads or changes HP, conditions, PP or turns.

Exports: `createBattleFx`, `FX_CATALOG`, `EFFECT_TIMINGS`, `PHASE_TIMINGS`, `VARIANT_TIMINGS`. `@battle/battle-fx/catalog` exposes lightweight id/name/tint data without importing the renderer. Advanced options include `effects` registry, `assetLoader(key, url)`, `timelineEngine`, `glowTexture`, and `deadlineMs`.

Optional request `variant` selects an explicitly registered cosmetic clip: Curse supports `self-setup` and Mirror Move supports `source-cast`. Both require only the source. `VARIANT_TIMINGS[moveId][variant]` describes their timing. Unknown variants and unsupported phase combinations skip safely; ordinary offensive moves still reject self targeting. The host selects these variants from public resolved events, never by passing types or battle history into FX.

The 17 multi-hit recipes also accept optional request `hitCount`, an already-resolved cosmetic contact count. The renderer-free `@battle/battle-fx/multi-hit` entry exports `MULTI_HIT_LIMITS` for their capacities (one through five for variable volleys, two for Double Kick/Twineedle/Bonemerang, three for Triple Kick, six for Beat Up). Normal playback emits ordered `{ type: 'hit', hitIndex: 1 }` cues through the supplied count, then one final `impact`. Counts may be one after an early stop. Invalid/unsupported counts skip without borrowing actor poses. Omitting the count preserves the standalone recipe's original contacts and aggregate cue.

Counted builders return `{ duration, hitTimes }` in authored seconds; the runtime validates these and uses the selected duration. The optional presentation clock includes `hitTimes` in its start notification, scaled to wall seconds. Each move still owns its art and contact paths. Reduced motion remains one short aggregate impact. Hosts reveal their existing per-hit snapshots at indexed cues, and must reconcile their complete committed result on completion or any interrupted/missing-cue path. FX never receives HP, party state or rule RNG.

Effect textures are loaded on demand through the default shared PixiJS Assets cache or your loader. The cache/loader owns those textures; playback cleanup does not evict them. The runtime owns and disposes only its generated glow, while per-play containers/timelines are destroyed on settlement. Keep the included Bootstrap MIT license, Lorc rock CC BY 3.0 attribution and generated-art notes when redistributing assets. A consuming bundler must support `new URL(relativeAsset, import.meta.url)`; Vite is the supplied host integration.

Local packaging: `npm pack --workspace @battle/battle-fx`. PixiJS and GSAP are peers. This is a local package, not a published npm release or a renderer-neutral engine.

## Weather continuation

The separately loaded `@battle/battle-fx/weather` exports `playWeatherContinuation({ weatherId, visualSeed }, { scene, signal, reducedMotion })`. IDs are `rain`, `sun`, `sandstorm` and `hail`. It returns `{ finished, cancel }` and plays a short field-only continuation without repeating a move cast, requiring actors, emitting impact cues or changing actor/camera poses. The supplied scene needs only `effects`, `width`, `height` and `unit`. Each clip owns its graphics and timeline, cleans up on all exits, and replaces only earlier weather continuation on that scene. Reduced motion uses a short tint. Optional `timelineEngine` and `deadlineMs` support integration/testing.

Hosts trigger continuation from already-resolved weather start/upkeep events and retain responsibility for ordering, expiry, damage and final-state reconciliation. The four original weather move animations remain independent and unchanged; continuation receives no battle state or weather-duration counter.

## Condition reactions and persistent hazards

The separate `@battle/battle-fx/conditions` entry exports `playConditionReaction({ kind, actorId, visualSeed }, { scene, signal, reducedMotion })`. Supported kinds are `spikes`, `poison`, `burn`, `leech-seed`, `sleep`, `paralysis`, `freeze`, `confusion`, `cure`, `blocked`, `boost` and `unboost`. A reaction owns a short graphics timeline and returns `{ finished, cancel }`. It emits no impact cue and changes no actor pose or gameplay state. Optional `timelineEngine` and `deadlineMs` support testing and bounded host playback.

`createHazardDisplay({ scene })` returns `{ update, destroy }`. Hosts call `update([{ side: 'near', layers: 2 }])` with cosmetic Spikes counts. The scene supplies `terrain` and `hazardSlots.near/far` containing fixed `{ x, y, rx, ry }` platform geometry. The display draws static rings without a particle loop; actor size, pose and replacement do not reposition them. The host owns effects preferences, current counts, removal and disposal.

Live hosts derive reactions and counts from published events, reveal their committed result first, and await reactions after move recovery and before fainting or the next move. Skip, failure, effects-off and reconnect still reconcile the same final view. Persistent hazard artwork can be restored from that view without replaying a cast or reaction.

## Poké Ball release

Send-outs are independent of the move registry and engine. Import them separately when the host has loaded the incoming sprites:

```js
const { playPokeballRelease } = await import('@battle/battle-fx/transitions')
const release = playPokeballRelease({
  scene, actorIds: ['source', 'target'], signal, reducedMotion: false,
})
await release.finished
```

Pass both actor IDs for an opening or just the incoming actor for a switch. The host determines which Pokémon entered and waits before playing another animation on those actors. The transition owns its ball/light graphics and GSAP timeline; `cancel()` or an abort restores the targeted poses and removes its graphics. Reduced motion is a short fade. Shared textures, battlefield platforms, rule state and unrelated actors are untouched. Load/create the transition before making hidden incoming artwork visible to avoid a full-size sprite flash.

The ball visibly tumbles through its throw and opening, with projected button/seam motion, speed trails and a bright burst. When the actor exposes `snapshot()`, an owned white silhouette resolves into the live sprite; its color filter never touches the live actor and is disposed with the release. Adapters without snapshots keep the burst and reveal. Normal duration remains 1.35 seconds, with a 0.1-second stagger for an opening pair.

## Fainting

`playPokemonFaint` from `@battle/battle-fx/transitions` accepts `{ scene, actorIds, signal, reducedMotion }` and returns the same `{ finished, cancel }` handle. The host selects already-defeated actors, finishes any attack using them, and keeps their roots visible until the transition settles. The 0.9-second clip desaturates an owned snapshot and sinks it behind a mask fixed to the sprite's visible bottom-center; it never uses gameplay state or a species-specific offset. A muted ripple and dust remain above the platform. Reduced motion uses a 0.22-second live fade; adapters without snapshots use a bounded dip and fade.

All exits remove the owned copy, mask, filter and graphics, then reset the targeted poses. The host must hide fainted roots after settlement, including skip/failure/cancel, or restore visibility from its current authoritative view if the presentation was superseded. No shared texture or live sprite filter is destroyed or changed.

The active `src/moves/restored/` files preserve the original effects. Each move owns its drawing and motion functions; `src/effect-space.js` only maps semantic coordinates and actor views into a mirrored, uniformly scaled local space. No generic shared beam, burst, slash or flight helpers are required. The host supplies registration origin/floor as well as anatomical sockets. The complete workspace includes original-frame regression fixtures for all 33 moves.


## Two-round clips

Fly, Bounce, Dig and Dive expose `phase: 'prepare' | 'attack'`. Omission selects the attack. Every phase is independently playable and restores actor poses on completion, cancellation and failure; no hidden actor state carries between playbacks. Preparation needs only its source, and emits one `prepared` cue. Attack requires the opponent and emits one `impact` cue. Both reduced-motion phases last 0.8 seconds, with their respective cue at 0.2 seconds. Unsupported phase requests skip instead of falling back to an attack.

```js
const preparation = fx.play({
  moveId: 'dive', phase: 'prepare', sourceId: 'source', visualSeed: 42,
}, { scene, onCue: cue => console.log(cue.type) })
await preparation.finished

// Call separately when the host chooses to preview the next round.
const attack = fx.play({
  moveId: 'dive', phase: 'attack', sourceId: 'source',
  targetIds: ['target'], visualSeed: 42,
}, { scene })
```

`PHASE_TIMINGS.dive.prepare` and `.attack` contain `{ contact, duration }`; preparation's `contact` is the `prepared` cue time. `FX_CATALOG` marks these four moves with `phases: ['prepare', 'attack']`. Each file owns its visuals; phase selection adds no shared visual template and no battle rules. Dig/Dive use an owned masked snapshot when available, with a fade fallback for external adapters lacking `snapshot()`.

## Accepted presentation variants

`@battle/battle-fx/accepted-effects` exports `createAcceptedBattleFx(options)`.
It retains all 345 registrations, selects the latest 20 custom Batch 5–7 recipes,
and wraps Thunder Punch with the approved white-yellow impact flash and
branching lightning at its existing 0.52 s cue.
The original recipe and default package entry stay available. The accent owns
its graphics under the same timeline and cleanup, and requires no sound player,
battle state, Vue or app imports. Explicit `options.effects` remains supported.

The shared game host supplies this factory to the optional
`@battle/battle-fx/presentation-clock` adapter, which applies reviewed visual
pacing. Muting sound does not disable the accepted visual variant.

`ACCEPTED_MOVE_EFFECTS` and `ACCEPTED_EFFECT_TIMINGS` expose the selected descriptors and authored timings. Ancient Power preloads the shared Rock Slide texture before the timeline starts, with owned cancellation and loading deadlines. Hosts reserve enough wall time for approved pacing and the complete endings. See the [rollout record](../../docs/SFX_ACCEPTED_ROLLOUT.md).
