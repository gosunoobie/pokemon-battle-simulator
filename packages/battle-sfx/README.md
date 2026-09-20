# @battle/battle-sfx

An independent Generation 3 sound catalog. Stage A accounts for 530 supplied MP3s
and all 354 canonical game moves, with explicit candidate mappings and decoded
inspection metadata. **These are candidates for listening review, not approved
playback recipes.** Importing or looking up a record never fetches or plays audio.

The package has no runtime dependencies. It imports no battle engine, battle
rules, renderer, FX, Vue, decoder or browser playback API. The default entry
retains the Stage A candidates; the separate `./runtime` entry now supplies the
approved Stage C subset for the host's `@battle/battle-audio` integration.

```js
import {
  SFX_CATALOG, getSoundAsset, getMoveSound, getBattleSound,
} from '@battle/battle-sfx'

const mapping = getMoveSound('flamethrower')
// mapping.status === 'candidate'
// mapping.reviewStatus === 'needs-listening'
// mapping.playback.normal === 'unreviewed'
const asset = getSoundAsset(mapping.assetIds[0])
// asset.url, file, bytes, sha256, mime and decoded inspection metadata
// asset.reviewStatus === 'candidate'; no timing or perceptual approval is implied.

getMoveSound('Flamethrower') // null: exact canonical ID required
getMoveSound('flame-thrower') // null: no runtime alias guessing
getBattleSound('unknown') // null
getSoundAsset('unknown') // null

getSoundAsset(mapping.assetIds[0], {
  baseUrl: 'https://assets.example.com/sound_effects/',
})
```

`SFX_CATALOG` is recursively frozen. Move/event lookups return immutable catalog
records; asset lookup returns an immutable descriptor whose filename is encoded
into its URL. Asset IDs, canonical game move IDs and semantic event IDs are
different namespaces. IDs are case-sensitive and are not display names. Explicit
aliases such as the game's `visegrip` and the FX/filename spelling “Vice Grip” are
catalog metadata, never a runtime name transformation.

There are 352 candidate move mappings. Mirror Move and Nature Power are marked
`called-move`, with no invented source file or client-side rule inference. Their
event-dependent policy still needs review. The Stage A catalog continues to mark
normal, reduced-motion and instant playback as unreviewed. A decoded duration or a `part 2`
filename cannot establish a launch, impact or recovery cue.

The default asset base is `/sound_effects/`. Alternate bases must be root-relative
paths or HTTP(S) URLs without credentials, whitespace, query or fragment; invalid
bases throw `TypeError` for a known asset. Unknown IDs return `null` without a URL
lookup. Audio files are **not bundled in this package**. A consumer must publish
the matching files and provide their base URL. The workspace currently serves the
existing files in `public/sound_effects/`, preserving their bytes and URLs.

Decoded measurements use the pinned build-time decoder recorded by the import
pipeline. Browser decoders may resample or handle encoder delay differently;
runtime region selection and perceived synchronization require native-browser
measurement and listening. This catalog supplies no approved regions, gain,
looping or scheduling policy.

Generated files are owned by `tools/audio-import`; do not edit them by hand. See
the [import guide](../../tools/audio-import/README.md) for reproduction and
validation, and the [implementation plan](../../docs/BATTLE_SFX_PLAN.md) for the
staged rollout. See [NOTICE](./NOTICE) for provenance and
the unresolved rights status.

The Stage A default export includes full audit metadata (about 640 KB of source
JS); it is not imported by any production app. Production imports the compact
runtime entry below, keeping the inspection metadata in the authoring outputs.

## Stage B review records

`@battle/battle-sfx/review` exports pure authoring helpers independently of the
full catalog: `createReviewRecord`, `validateReviewRecord`, `approveReviewRecord`,
`resetReviewRecord`, `nativeRegionFrames`, `exportReviewBundle` and
`importReviewBundle`. Callers inject
the catalog and current visual-revision map; the bench also supplies a
`visualDurations` map to validate move anchors against actual clip durations.

Records pin their source hash, reference PCM/frames, audit lock and visual
revision. They support 1–8 frame-based regions with sound/visual anchors, explicit
native offsets and gain. Inward native-frame conversion accounts for resampling
quantization without clamping. Approval requires reviewer notes, both perspective
checks and measured native decoding with manual alignment confirmation. An exact
settings/evidence snapshot detects later edits; it is not a cryptographic
signature or production release authorization.

New drafts never receive automatic listening approval. The separate
[pilot review bundle](../../tools/audio-import/review/PILOT_REVIEW.md) preserves
the user's approvals for 11 configurations across 10 moves. See the
[local audition workflow](../../docs/SFX_AUDITION_BENCH.md).

## Stage C approved runtime subset

```js
import {
  SFX_RUNTIME_CATALOG, getMoveSoundPlan, getFxSoundPlan, getRuntimeSoundAsset,
} from '@battle/battle-sfx/runtime'

const plan = getMoveSoundPlan('doublekick') // Canonical game ID.
getFxSoundPlan('double-kick')              // Explicit reviewed FX ID.
const asset = getRuntimeSoundAsset(plan.assetId)
// asset.url: /audio/sfx/<sha256>.mp3; bytes, sha256, mime and reference metadata.
getMoveSoundPlan('fly', { phase: 'prepare' }) // null: unapproved phase.
getMoveSoundPlan('tackle', { outcome: 'miss' }) // null: no success sound.
```

The recursively frozen runtime catalog selects **10 whole-recording defaults**
from the 11 approved configurations. Absorb Part 1 remains an approved alternative
and is not scheduled. The 10 content-addressed MP3 copies total **887,339 bytes**;
existing `/sound_effects/` files, their URLs and the original archive are unchanged.
Audio remains separately published, not embedded in this package. Asset lookup
also accepts a validated `baseUrl`, defaulting to `/audio/sfx/`.

Plans preserve the reviewed regions, gain and timing with playback rate one and
natural recording tails. Only `phase: 'attack'`, `mode: 'normal'` and
`outcome: 'hit'` return plans; unsupported IDs, preparation, reduced motion,
instant presentation, misses, failures and immunity return `null`. Lookup does
not load, decode, schedule or apply battle results.

`npm run sfx:runtime` compiles the explicit selection after checking the pinned
review bundle, approvals, source hashes and current visual revisions.
`npm run sfx:runtime:check` verifies the generated files without writing them.
Authoring uses the isolated audit tools; production installs/builds consume
committed output and require no authoring decoder dependencies.

The host currently permits the reviewed **Chrome 152 / 48 kHz** native profile,
checking each decoded buffer's exact reviewed frame count. Other browser majors,
families or decoding results remain silent pending review. See the
[runtime pilot guide](../../docs/SFX_RUNTIME_PILOT.md) for host behavior and limits.

## Simulation and move-preview technical drafts

`@battle/battle-sfx/draft-runtime` independently exports
`DRAFT_SFX_RUNTIME_CATALOG`, `getDraftMoveSoundPlan`, `getDraftFxSoundPlan` and
`getDraftRuntimeSoundAsset`. Their lookup and asset-base conventions match the
approved runtime, but all 323 additional plans explicitly carry
`reviewStatus: 'technical-draft'` and `nativeCompatibility: null`.

These immutable plans preserve the generated whole-recording regions and
attenuation defaults. The host must explicitly opt in to play the complete actual
native buffer at visual start; it must not treat reference frames as reviewed
browser trimming coordinates. Other phases, modes and outcomes return `null`.
The catalog does not fetch or play audio. No approval records are modified.

Solo simulation and move preview opt in; multiplayer does not. See the
[integration and validation guide](../../docs/SFX_SIMULATION_DRAFTS.md) and the
explicit compiler command `npm run sfx:simulation:check`.


## Accepted review batches

`@battle/battle-sfx/accepted-runtime` exports `ACCEPTED_SFX_RUNTIME_CATALOG`,
`getAcceptedMoveSoundPlan`, `getAcceptedFxSoundPlan` and
`getAcceptedRuntimeSoundAsset`. It contains 44 final plans from all seven user-accepted batches. Batch 6’s
Ancient Power supersedes Batch 4’s version. The shared host selects these before pilot/draft defaults, without
falling back to an older version for unsupported decoders. Assets reuse the
original MP3 bytes at hash-addressed URLs.

Plans contain reviewed native-second regions, sound/visual anchors and a cosmetic
`visualRate`. These accepted plans work across Web Audio browsers and device sample rates: the host validates decoded duration instead of matching a browser major and exact frame count. Archived native measurements remain provenance. Audio remains at its original speed and pitch. The host supplies
pacing to the separate FX clock; no gameplay data enters this package. The
compiler validates source/PCM/visual identities and actual native decode bounds.
Psychic adds the reviewed Hit Normal Damage recording at −6 dB, starting at
0.85 s. The host preloads and validates both recordings before scheduling either
voice, then owns both under the same clock and cancellation scope. Batch 2's
final pins the exact native measurement export separately from the user's chat
approval; its archived unreviewed accent verdict is preserved as historical data.

Regenerate with `npm run sfx:accepted`; verify with `npm run sfx:accepted:check`.
See [accepted Batch 1](../../docs/SFX_SYNC_BATCH_01.md) and
[accepted Batch 2](../../docs/SFX_SYNC_BATCH_02.md) and
[accepted Batch 3](../../docs/SFX_SYNC_BATCH_03.md) for timing and browser scope.
Batch 3 pins the approved Thunder Punch visual accent as metadata; its renderer
lives in the separate optional FX entry, with no graphics dependency here.

The [seven-batch rollout](../../docs/SFX_ACCEPTED_ROLLOUT.md) pins the latest custom visuals, native measurements and 45 assets. Only Batch 5 sets `taperEdits: true` for its reviewed 12 ms edited-boundary fades. Full source boundaries remain untapered.
