# Stage three: optional battle cries

The simulation and multiplayer share one integration. Battle rules, protocol, server storage and the preview/playground remain independent of sound. This stage plays send-out cries only; move SFX, fainting sounds and music require separate cue mapping work.

## Ownership and sequence

1. Each app creates a host audio adapter and invokes `unlock()` directly in Start/Ready/choice handlers, before any network await. Reconnect never automatically unlocks or plays sound.
2. `apps/shared/battle/audio.js` resolves viewer-visible species through the existing roster and the independent `@battle/pokemon-cries` catalog. Names/nicknames, sprite paths and Pokédex physical dimensions are not sound identifiers.
3. A presentation batch preloads current active cries first, then the player's team, known opponents and species revealed by its switch/drag events. It never requests unrevealed enemy team data. Source aliases deduplicate by asset URL.
4. `playPokeballRelease` emits a cosmetic `reveal` cue on the first frame with positive sprite opacity. Normal motion retains each actor's stagger; reduced motion uses its short fade. The scene forwards only current, visible entries to the presenter, which gives the adapter the corresponding viewer-visible species. No sound URL or battle state enters FX.
5. The audio player plays only an already-decoded buffer. A late fetch stays silent: it is never queued to play afterward. Sound does not extend the release, wait for clip completion, modify displayed HP or affect a server deadline.

With animations disabled, the host plays cries for the newly visible final lineup after the instant scene update, justified by fresh switch/drag events. It omits intermediate entries skipped by that update. A normal opening can play both living active Pokémon. Form/identity corrections, transforms, ordinary snapshots and reconnects are silent.

## Controls and lifecycle

The battle view offers Pokémon cries on/off and volume, independent of animation/reduced-motion controls. Preferences are stored under `battle-lab:audio:v1` in local storage, with safe defaults if storage is blocked. Default volume is 60%. A browser that blocks activation exposes an **Enable sound** retry button. Unsupported audio or failed loads remain optional presentation.

Each batch owns a cancellable sound scope. New batches, skip, reset, quit, an interrupted room, mute, a hidden tab and unmount stop owned voices and invalidate stale callbacks. Normal completion allows the cry tail to finish; it does not use the FX abort signal as a playback lifetime. Returning to the foreground, unmuting or finishing a late download never replays a past entry. Duplicate entry identities are remembered in a bounded ledger.

## Browser runtime and limits

`packages/battle-audio` imports no Pokémon, Vue, renderer, engine or server code. Asset lookup, `AudioContext` creation and fetch are injected. Defaults:

| Limit | Value |
| --- | --- |
| Concurrent fetch/decode jobs | 3 |
| Load deadline, including queue | 10 seconds |
| Decoded PCM LRU | 8 MiB |
| Simultaneous voices | 2; oldest replaced on overflow |
| Per-voice gain at full volume | 0.35, leaving headroom for overlapping cry peaks |

Cache memory uses `AudioBuffer.length × numberOfChannels × 4`, not compressed file bytes. Active sources may retain up to two additional buffers after eviction. Native decodes cannot be aborted; cancelled work retains its concurrency slot until settling, but cannot cache or play its stale result. Actual browser buffer duration governs playback, accounting for the Ogg duration differences measured in stage two.

The runtime uses native Web Audio decoding of the existing Ogg Vorbis files. There is no browser WASM dependency or transcoded fallback. Stage-two native checks cover Chromium; Safari/iOS and Firefox/Android still require device testing. The development listening page remains `/tools/cry-import/preview.html`.

## Hosting and validation

No new server process, endpoint, environment variable, database, third-party runtime API or deployment action is required. The normal Vite build copies `public/audio/cries/` into the static output; Heroku serves those files. The catalog's resolver accepts an alternate asset base URL for a later CDN deployment. This integration retains the current static-server caching policy.

Run `npm test` and `npm run build` for integration checks. Focused coverage is in `tests/battle-audio.test.mjs`, `tests/battle-cries-host.test.mjs`, `tests/battle-cries-presentation.test.mjs`, and the existing release/scene/sequence tests. Asset provenance and decode validation remain separate via `npm run cries:check` and `npm run test:cries`; playback integration does not rewrite source recordings or generated metadata.
