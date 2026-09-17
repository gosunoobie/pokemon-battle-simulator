# Battle audio

An optional browser presentation service with no Pokémon, renderer, Vue, or battle-state dependencies. The host resolves asset IDs to `{ url }` and decides when a sound is appropriate.

```js
import { createAudioPlayer } from '@battle/battle-audio'

const audio = createAudioPlayer({ resolveAsset: id => manifest[id] ?? null })

// Call directly from a click/tap handler, before awaiting a network request.
void audio.unlock()
void audio.preload(['incoming-actor'])

// A presentation cue may play a ready clip. A missed cue stays silent.
audio.play('incoming-actor')
```

`unlock()` lazily creates and resumes the owned `AudioContext`. It resolves to `false` when unsupported, blocked, muted, or suspended. A blocked context can be retried from a later gesture. `preload(ids)` never creates a context and resolves to readiness booleans; it deduplicates assets by URL. `play(id)` returns `false` unless the clip is already decoded and the context is running. No asynchronous load callback starts a sound.

The default limits are three concurrent fetch/decode operations, a 10-second loading deadline including queue time, an 8 MiB decoded Float32 PCM LRU, and two simultaneous voices. A new voice replaces the oldest voice when the limit is reached. A buffer larger than the cache budget is rejected. Playing nodes can retain their buffers after LRU eviction; this additional memory is bounded by the voice limit. Native `AudioBuffer` duration governs playback, not source-file metadata.

Volume defaults to `0.6`, with per-voice gain capped at `0.35` at full volume for headroom. `setVolume(0…1)` changes active voices too. Hosts own any preferences storage and UI. `getState()` and the optional `onState` callback provide `{ enabled, volume, status, suspended, loadError }`; status is `locked`, `ready`, or `unavailable`. Individual file failures do not make a healthy audio context unavailable. `loadError` is `null`, `load` for HTTP/network/queue failures, or `decode` for decoding failures; a timeout reports its current phase. A later successful new load clears the warning. Deliberate cancellation, unknown IDs, cache-budget rejection, and cache hits do not change it.

`stop()` stops owned voices and aborts pending loads while preserving the decoded cache. `setEnabled(false)` and `setSuspended(true)` also stop. Re-enabling or returning to the foreground never replays sounds. `dispose()` additionally clears the cache, removes listeners, and closes the owned context. An unabortable native decode retains its concurrency slot until it finishes, but cancellation/deadline immediately settles the caller and prevents its result from entering the cache.

Dependencies (`createContext`, `fetch`) and limits are injectable for tests. The service never pauses or awaits a battle result.
