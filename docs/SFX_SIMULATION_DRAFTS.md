# Simulation and move-preview sound drafts

The solo battle simulation and move preview opt into the same 323 additional move
recordings at the user's request. Together with the ten approved pilot mappings, this covers
333 of the 335 attack animations. The two missing named sources are Mirror Move
and Nature Power. These additional recordings remain **technical drafts**:
enabling them does not create listening approvals or native-decoder reviews.

## Selection and playback

`@battle/battle-sfx/draft-runtime` is a separate, dependency-free catalog. Its
explicit selection contains 308 whole recordings, 14 one-hit alternatives where
no whole variant exists, and Present's damage recording. Each uses the generated
whole-region default at normal speed, starting at the actual visual-start cue.
Forty-three selected moves retain their measured attenuation; quiet recordings
are not boosted. Existing pilot plans take precedence and are unchanged.

The 158 optional energy-to-result comparisons and padded trim proposals remain
in the bench. They are not automatically promoted: a waveform's strongest energy
window is not necessarily its semantic impact. This release preserves source
character and provides broad playback coverage, not a claim of individually
auditioned impact alignment.

The draft runtime plays the complete **actual browser-decoded buffer**, rather
than interpreting reference frames as unmeasured browser trim coordinates. It
checks positive integer frame/rate metadata, bounded durations and a maximum
100 ms difference from the reference duration before playing. This is a
corruption/compatibility guard, not proof of perceptual synchronization. No
native offset or browser listening evidence is invented. The ten approved pilot
recordings still require their reviewed Chrome 152 / 48 kHz profile; they remain
silent on other profiles even where the new draft sounds can play.

Preparations, extra hits, multipart alternatives, residual effects, generic
hit/faint/status sounds and moves without animations remain excluded. Present's
damage recording requires a server-reported opposing damage event; a healing
result stays silent. Misses, failures, immunities, reduced motion and effects-off
presentation also stay silent. These choices do not change battle rules or FX.

## Host integration

`apps/simulation/src/audio.js` and `apps/game/src/presentation/audio.js` inject
the shared `apps/shared/battle/draftSoundPack.js` lookups into the existing audio
host. Both pages reuse the same catalog and hashed assets. Multiplayer retains
the ten approved mappings; the audition bench retains its separate review
workflow. No rules, sound filenames or decoding enter the engine.

The existing **Sound**, **Move sounds**, **Pokémon cries** and volume controls
apply. Own active choices and server-published move names warm a bounded set of
assets. If a buffer is unavailable at visual start, the sound is skipped rather
than played late or allowed to delay a turn. Drift, skip, quit, reset, mute,
backgrounding and disposal stop owned playback. Whole-recording tails may finish
after a normally completed animation until the next cancellation boundary.

Move preview warms only its selected move, including when sound is enabled after
selection. Explicit FX aliases are preserved through unlock, so `vice-grip`
continues to resolve to canonical `visegrip`. Replay, reset, move/attacker/species
changes, skip and page disposal cancel old playback. Near and far perspectives
use the same sound plan and their actual animation clock. Preparation remains
silent; the separate attack phase can play. Preview damage, healing, poses and
all animation choreography remain unchanged.

The current player keeps its shared budgets: 16 MiB decoded LRU, 48 MiB accounted
working memory, three load/decode jobs, 32 queued loads and eight total voices.
It never decodes the whole sound catalog upfront.

## Assets, verification and rollback

The additional pack is **28,326,318 bytes (27.0 MiB)** across 323 original-byte MP3
copies. The largest encoded file is 273,890 bytes, the largest reference decoded
buffer is 2,391,984 bytes and the longest recording is 6.78 seconds. Generated
catalog metadata is about 51 KiB gzipped. The total pack size is a deployment
footprint, not an initial per-player download. Heroku serves content-hashed
`/audio/sfx/<sha256>.mp3` files using the existing immutable caching policy;
mixing and decoding happen in the browser.

```sh
npm run audio:setup           # only if authoring dependencies are absent
npm run sfx:simulation        # regenerate the shared simulation/preview pack
npm run sfx:simulation:check  # verify provenance and every published byte
npm run sfx:runtime:check     # verify the unchanged approved pilot
npm run test:sfx
npm test
npm run build
```

The compiler verifies all source hashes, pinned PCM/visual metadata, analysis
and eight batch hashes, exact whole-region/gain defaults and selected coverage
before writing. It rejects fabricated listening evidence or silent promotion of
optional edits. Build/deployment uses the committed outputs without installing
the authoring decoder. Details are in
[`sfx-draft-runtime.json`](../tools/audio-import/reports/sfx-draft-runtime.json).

Set `VITE_SIMULATION_DRAFT_SFX_ENABLED=false` **before building** to return solo
simulation to the ten approved mappings. Set `VITE_PREVIEW_DRAFT_SFX_ENABLED=false`
to do the same for move preview independently. Set `VITE_BATTLE_SFX_ENABLED=false`
to disable all move SFX while retaining cries. All flags default to enabled when
absent; no new server environment variable or endpoint is required. The existing
`sfx:simulation` command names remain compatible and now generate/verify the pack
shared by both pages. This implementation does not itself deploy the application.

Further listening review can replace individual defaults with evidenced cue
regions and native compatibility records. Browser/device latency and perceived
mix balance remain listening work; automated checks do not certify them.

## Integration checks on 18 September 2026

- 728 application tests and eight focused draft package/compiler tests pass for
  the preview extension. The initial simulation integration also passed all
  117 SFX/package/pipeline tests.
- Every one of the 323 plans is exercised against 44.1 and 48 kHz native-buffer
  metadata; HTTP tests verify all published files, hashes, MIME, GET/HEAD and
  immutable caching. Present healing versus damage has a presenter regression.
- Both runtime compiler checks and the production build pass. The build retains
  the existing warning about a Pixi-related chunk larger than 500 kB.
- The built import graph has one shared draft catalog for simulation and move
  preview; multiplayer, playground and home remain outside its import graph.
- Local browser checks completed Dragon Claw, Rest and opponent Ice Beam turns,
  observed five on-demand move-sound asset URLs, and returned to setup on quit
  without console errors. These verify integration, not acoustic latency or a
  new listening approval. No production deployment was performed.
- Move preview completed Vice Grip from both perspectives after selecting the
  move and enabling sound. Its single hashed recording was observed loading,
  with no browser warnings/errors. Five additional regression tests cover its
  opt-in/rollback, alias warm-up, both perspectives, presentation exclusions and
  cancellation while preserving committed results.
