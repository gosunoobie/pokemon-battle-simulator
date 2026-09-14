# @battle/battle-fx

Optional Vue-free battle effects for PixiJS 8 and GSAP 3. Contains 309 moves with independent recipes and package-relative effect assets. It imports neither battle-core nor host Pokémon artwork.

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

Exports: `createBattleFx`, `FX_CATALOG`, `EFFECT_TIMINGS`, `PHASE_TIMINGS`. `@battle/battle-fx/catalog` exposes lightweight id/name/tint data without importing the renderer. Advanced options include `effects` registry, `assetLoader(key, url)`, `timelineEngine`, `glowTexture`, and `deadlineMs`.

Effect textures are loaded on demand through the default shared PixiJS Assets cache or your loader. The cache/loader owns those textures; playback cleanup does not evict them. The runtime owns and disposes only its generated glow, while per-play containers/timelines are destroyed on settlement. Keep the included Bootstrap MIT license, Lorc rock CC BY 3.0 attribution and generated-art notes when redistributing assets. A consuming bundler must support `new URL(relativeAsset, import.meta.url)`; Vite is the supplied host integration.

Local packaging: `npm pack --workspace @battle/battle-fx`. PixiJS and GSAP are peers. This is a local package, not a published npm release or a renderer-neutral engine.

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
