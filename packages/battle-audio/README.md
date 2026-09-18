# Battle audio

An optional browser presentation service with no Pokémon, renderer, Vue, game-state or SFX-catalog dependency. The host resolves IDs to `{ url, bytes?, sha256? }` and decides when a sound is appropriate. One lazy `AudioContext` serves cries, SFX and UI through separate gain buses and a shared master.

```js
import { createAudioPlayer } from '@battle/battle-audio'

const audio = createAudioPlayer({ resolveAsset: id => manifest[id] ?? null })

// Call directly from a click/tap, before awaiting a network request.
void audio.unlock()
void audio.preload(['incoming-actor'])

// Legacy cry API: false unless already decoded and the context is running.
audio.play('incoming-actor')

const scope = {}
void audio.preload(['attack-recording'], { scope, priority: 10 })
// The presentation controller supplies an already-validated native buffer region.
const handle = audio.playSegment('attack-recording', {
  startSeconds: 0.2,
  endSeconds: 0.7,
  gainDb: -3,
  category: 'sfx',
  scope,
})
// A missing/unready sound returns null, never queues a late play.
if (handle) void handle.finished.then(({ reason }) => { /* diagnostic only */ })
audio.stopScope(scope)
```

## Playback and ownership

`unlock()` creates/resumes synchronously within the gesture and resolves to `false` when unsupported, blocked, muted or suspended. Retry a blocked context from another gesture. `preload(ids, { signal?, scope?, priority? })` never creates a context and returns `Promise<boolean[]>`. Loading never triggers playback.

`play(id)` remains a whole-buffer cry API returning a boolean, with the same effective gain of `0.35 × master volume` and a two-cry limit. A new cry replaces the oldest cry. `playSegment(id, options)` returns `null` or `{ finished, cancel }`. Options are native-buffer `startSeconds`/exclusive `endSeconds`, `gainDb` from −60 to +6, optional absolute AudioContext `when`, category `sfx` (default), `cries` or `ui`, priority, scope and AbortSignal. Playback rate is always one. Invalid, empty, out-of-range or late-scheduled regions stay silent; nothing is clamped to fit. Omitting `when` starts immediately. Scheduling is limited to the next 120 seconds.

`finished` resolves with a reason: `ended`, `cancelled`, `replaced`, `interrupted` or `failed`. It never rejects. Cancellation settles immediately, then uses an eight-millisecond owned fade when supported. Future sources cancel immediately. Replacement cancels immediately to preserve the physical voice limit. `stopScope(scope)` cancels that scope's voices and preload subscriptions, including an explicitly undefined/default scope. It does not invalidate the scope permanently. `stopCategory(category)` stops only that category's voices. `setCategoryEnabled(category, false)` also prevents new playback until re-enabled; neither operation cancels shared preload work.

`readyInfo(id)` returns `{ sampleRate, sampleFrames, durationSeconds }` from the decoded browser buffer, or `null`; it never fetches. The manifest's source duration is not a substitute. `contextTime()` returns the running context clock or `null`. The host owns alignment and source-frame conversion; this package does not estimate codec offsets or infer sound roles.

## Bounded resources

Defaults are:

| Resource | Limit |
| --- | ---: |
| Decoded Float32 PCM LRU | 16 MiB |
| Encoded file | 8 MiB |
| Decoded file | 8 MiB / 120 seconds |
| Physical fetch/decode jobs | 3 |
| Waiting jobs | 32 |
| Subscribers per shared job | 64 |
| Voices, including cancellation fades | 8: cries 2, SFX 4, UI 2 |
| Accounted working memory | 48 MiB |
| Loading deadline, including queue time | 10 seconds |

Asset identity includes URL, expected bytes and SHA-256. Aliases with identical descriptors share a job and cache entry. Supplied byte counts and SHA-256 must match before decode; unavailable integrity APIs fail silently for hashed assets. Streaming responses enforce the encoded limit while reading; a non-streaming response is checked after `arrayBuffer()` returns. The latter fallback cannot limit allocation inside an injected response implementation.

Each caller has its own cancellation subscription. Canceling one never aborts another. The last cancellation aborts the download and prevents caching; an unabortable native decoder keeps its physical slot and reservation until it finishes. Higher numeric priorities run first in the waiting queue (stable among equals); another subscriber can promote a waiting job. Playback can replace an older equal-or-lower-priority voice only within its own category.

Working memory counts unique buffers across cache and active/fading voices, plus a reservation of twice the encoded bound and the decoded-file bound for each physical job. A single bounded assembly buffer receives streamed chunks; the two encoded reservations cover assembly and an optional exact-length copy, without accumulating a list of tiny chunks. LRU eviction does not erase the accounting for a buffer still retained by a playing node. Jobs wait if memory cannot be reserved. The 48 MiB limit is application accounting, **not a claim about total browser memory**: decoder internals, browser networking and an oversized native decode before its result is rejected are not controllable by JavaScript. `diagnostics()` exposes cache/retained/reserved/working bytes, jobs, subscriber and voice counts, sample rate and reported output latencies.

## Mixing, preferences and lifecycle

Volume defaults to `0.6`; `setVolume(0…1)` changes the master, with a short ramp where supported. Cry gain remains `0.35` for normal native samples; a native clip whose sample peak exceeds one is attenuated only enough to restore that bound. Two cries therefore reserve at most `0.70` before the master. SFX and UI reserve `0.25` and `0.05` respectively. Each uses its authored linear gain and a shared attenuation of `min(1, 1 / sum(native peak × authored gain))` across scheduled, playing and fading voices. A single ordinary 0 dB SFX is not penalized for three imaginary companions. The bus never boosts a clip. Necessary gain reductions apply before starting the new source; released headroom returns over 15 ms where supported. Fading sources retain their full peak reservation until cleanup.

This bounds summed native sample peaks across the three categories at master volume one. It is not loudness normalization or a true-peak limiter, and cannot guarantee a particular device's analog output level. Relative authored SFX gains remain intact within a shared mix; actual production listening is still appropriate.

Hosts own preference storage and UI. Existing `getState()` / `onState` keep `{ enabled, volume, status, suspended, loadError }`. Status is `locked`, `ready` or `unavailable`. File errors do not make a running context unavailable. `loadError` is `null`, `load` for network/integrity/deadline errors, or `decode` for codec errors. A successful new load clears it. Deliberate cancellation, unknown IDs, budget rejection and cache hits leave it unchanged.

`stop()` cancels all owned voices and pending loads while retaining decoded cache. Muting/backgrounding with `setEnabled(false)` / `setSuspended(true)` also stops. Resuming never replays anything. External context interruption terminates current voices with `interrupted`. `dispose()` additionally clears cache, removes listeners and closes the context; late results cannot repopulate it. Dependencies (`createContext`, `fetch`, `crypto`) and limits are injectable for tests. Audio never pauses or decides a battle result.
