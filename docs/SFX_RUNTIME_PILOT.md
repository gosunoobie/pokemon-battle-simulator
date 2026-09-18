# Stage C: approved move-sound pilot

This guide describes the ten approved mappings. Solo simulation and move preview additionally
opts into the [technical draft pack](SFX_SIMULATION_DRAFTS.md); its broader native
whole-buffer policy does not change these pilot approvals or browser checks.

Implemented 18 September 2026. Move preview, solo simulation and private-room
multiplayer now share optional move sounds alongside the existing Pokémon cries.
Battle decisions and the 335 move animations are unchanged. The standalone FX
playground and local audition bench retain their separate workflows.

## Enabled scope

The runtime selects ten recordings from the [approved listening bundle](../tools/audio-import/review/PILOT_REVIEW.md):

| Move | Selected recording |
| --- | --- |
| Tackle | Tackle |
| Flamethrower | Flamethrower |
| Hyper Beam | Hyper Beam |
| Double Kick | Double Kick 1hit |
| Bullet Seed | Bullet Seed 1hit |
| Absorb | Absorb, whole recording |
| Protect | Protect |
| Will-O-Wisp | Will-O-Wisp |
| Rain Dance | Rain Dance |
| Fly | Fly attack |

Each uses its approved whole-file region, zero source/visual anchors, zero native
offset, 0 dB authored gain and normal playback speed. The one-hit recordings play
once; the runtime invents no extra hits or layered impact sounds. Absorb Part 1 is
an approved alternative, not a second layer in the selected recipe.

This pilot enables normal animated, successful presentations only. Fly preparation,
Present, other moves/variants, misses, failures, immunity, reduced motion and
effects-off summaries have no approved move-sound recipe and stay silent. Existing
cries keep their own behavior. Generic damage, faint, healing, UI and music sounds
are not part of Stage C.

**Native compatibility is deliberately narrow:** the host accepts Chrome major
152 (excluding Edge/Opera), then requires each decoded buffer to match the
reviewed 48 kHz sample rate and exact sample count. The observations were recorded
in Chrome 152.0.0.0. A matching profile is an eligibility check, not proof that
every device has identical output latency. Other profiles remain silent for move
SFX until their alignment is reviewed; cries and battle controls still work.

## Ownership and synchronization

1. `tools/audio-import/runtime.mjs` verifies source/audit/PCM/visual pins and the
   review fingerprints, then generates a compact selected catalog and hashed
   copies of the approved original bytes.
2. `@battle/battle-sfx/runtime` supplies immutable plans and descriptors. It has no
   browser, renderer, battle-engine or audio-runtime dependency. The full Stage A
   candidate catalog and Stage B review tools are not production imports.
3. `@battle/battle-fx/presentation-clock` wraps each owned visual timeline. It emits
   a cosmetic start after visual loading and recipe construction, followed by
   timeline observations. Existing impact/recovery/result cues are unchanged.
4. `apps/shared/battle/moveAudio.js` converts approved reference regions to native
   frames and schedules ready buffers from that actual visual start. It cancels
   sound if observed clock drift exceeds 100 ms. It never pauses FX or changes a
   battle result to accommodate audio.
5. `@battle/battle-audio` owns one context, shared loading/cache budgets, category
   buses, voice handles and fades. The host owns battle/preview scopes and uses
   server-revealed move events in live battles. No sound decisions are made by
   the battle engine.

Warm-up uses the current player's available moves, published move events or the
selected preview. Hidden opponent choices are never inferred. A gesture activates
audio; network/decode completion never triggers playback. If the buffer is not
ready at visual start, that presentation stays silent. It is not replayed late.

A completed visual may leave the approved recording's natural tail playing.
Skip, mute, reset, quit, reconnect, backgrounding, scene replacement, failure and
disposal cancel the owned sounds. Starting another preview stops its previous
tail immediately. Live event keys prevent duplicate playback after repeated
updates; stale callbacks cannot stop a newer scope.

## Controls and resource budgets

The shared controls provide Sound, Pokémon cries, Move sounds, master volume and
an Enable sound retry. Preview omits the cry toggle because it has no send-out
flow. Preferences migrate from the previous browser-local mute/volume record to
`battle-lab:audio:v2`. No database is needed. Master mute invalidates the current
live batch, so unmuting resumes with a new batch; re-enabling only Move sounds can
allow later fresh moves in the current batch.

| Resource | Default limit |
| --- | --- |
| Decoded LRU | 16 MiB |
| Encoded file / decoded file | 8 MiB each |
| Accounted working memory | 48 MiB |
| Physical fetch/decode jobs | 3 |
| Queued loads | 32 |
| Subscribers to one load | 64 |
| Voices, including fades | 8 total; cries 2, SFX 4, UI 2 |
| Load timeout | 10 seconds |

Working-memory accounting includes retained buffers, encoded inputs and decode
reservations; browser decoder internals and temporary native allocations are
outside this application budget. Cancellation releases subscribers without
pretending an already-running native decode is cancellable.

Mix budgets reserve 0.70 for cries, 0.25 for SFX and 0.05 for future UI audio.
Measured sample peaks and authored gains determine attenuation; the mixer never
boosts a quiet category. These bounds and tests do not replace listening to the
combined mix on real devices. The existing normal cry gain is preserved.

## Generation, delivery and verification

From the repository root:

```sh
npm run audio:setup          # isolated authoring dependencies, once
npm run sfx:runtime          # validate approvals and generate selected outputs
npm run sfx:runtime:check    # verify outputs without writing
npm run sfx:check            # verify the original Stage A catalog/audit
npm run test:sfx
npm test
npm run build
```

Normal builds consume committed outputs and do not install/run the authoring
decoder. CI should run the verification commands before release. Changes to
recordings, reviewed settings or pinned visual revisions require fresh valid
evidence; do not hand-edit generated files to bypass a failed check.

The [generation report](../tools/audio-import/reports/sfx-runtime.json) records ten
assets totaling **887,339 bytes (about 867 KiB)** and a 9,582-byte unminified runtime
data module. Their reviewed native buffers total 8,262,160 bytes if all ten are
decoded; playback does not eagerly decode the entire library.

Heroku serves `/audio/sfx/<sha256>.mp3` with a hash ETag and one-year immutable
caching. Missing audio returns 404, not an HTML fallback. Legacy `/sound_effects/`
files and cache behavior remain unchanged. The ten additions are byte-identical
copies, not re-encoded audio. There is no per-match audio stream or server mixer.
Retain older referenced hashes in later releases if open clients must survive an
asset update; immutable caching alone does not retain deleted server files.

Set `VITE_BATTLE_SFX_ENABLED=false` **before building** to disable move sounds for
that release while keeping cries. This is a build-time rollback switch. A future
CDN can supply the same descriptors through the asset resolver without changing
engine code or storing audio in a database.

Automated coverage includes immutable selection and provenance, native frame
conversion, late-load silence, queue/cache/voice bounds, cancellation, stale
callbacks, both presenters, cry coexistence and static delivery. Stage D expands
reviewed coverage; Stage E still requires real-device sync, combined-mix listening,
production load evidence and an asset-retention rollout policy. No production
deployment is performed by this implementation.
