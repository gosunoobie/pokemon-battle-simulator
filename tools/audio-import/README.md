# Battle audio preparation, audit and runtime compilation

This tool prepares the supplied Generation 3 sound collection for static delivery.
It removes the leading ID3v2.3 tag (including repeated album artwork and padding)
and copies every remaining byte unchanged. It does **not** re-encode, normalize,
trim silence, change channels, change timing or connect sounds to gameplay.
Original filenames and `/sound_effects/<encoded filename>` URLs are preserved.

## Commands

```sh
npm run audio:check
npm run audio:setup
npm run test:audio
npm run audio:optimize
```

`audio:check` checks the complete inventory, SHA-256 hashes, MPEG frame boundaries,
format metadata, public manifest and optimization report. It works on a fresh
checkout without the original downloads. `audio:optimize` reproducibly regenerates
from the local original cache; when that cache is absent it verifies the committed
optimized output instead. It refuses to overwrite an unexpected edited asset.

To reproduce from a separately archived copy of the original collection:

```sh
npm run audio:optimize -- --source /absolute/path/to/original-mp3-directory
```

The source must match **every** original checksum in `source-lock.json`. Nothing
is downloaded automatically. Initial enrollment uses `--init`, before a source
lock exists; that command deliberately refuses to replace an existing pin.

## Original backup and deployment

The first optimization copies and verifies all originals into
`tools/audio-import/.cache/originals/` **before** replacing public files. The
existing `.gitignore` ignores `.cache/`; `.slugignore` explicitly excludes this
backup from Heroku builds. Keep a separate durable backup of the originals if you
need source regeneration on another computer: ignored local files are not Git
backups. The original archive is approximately 90 MB and should not be added back
under `public/`.

The optimized MP3s and `manifest.json` under `public/sound_effects/` retain their
original public filenames. The separate Stage C compiler also publishes a small
approved subset under content-addressed `/audio/sfx/` URLs, described below.

## Validation and provenance

`source-lock.json` records original/output hashes and sizes, original text tags,
removed artwork hashes and MPEG format details. `reports/optimization.json`
records the measured size reduction. The public manifest retains the collection
reference and embedded album/artist/publisher/year credits as supplied. These tags
are provenance, not independently verified authorship or redistribution rights.
The files were supplied locally by the user in the context of the linked KHInsider
collection; no permission grant is inferred from their availability.

The parser intentionally accepts only the collection's unflagged ID3v2.3.0 tags
and constant-format MPEG-1 Layer III frames. Unexpected metadata, malformed frames,
changed source bytes and extra files fail before replacement. The small trailing
ID3v1 tags are retained along with all Xing/LAME encoder and gapless information.
MPEG frame count is encoded-stream metadata, **not** a decoded playback duration;
the later audio integration must measure decoded buffers and author cue points.

Tests cover malformed inputs, exact payload preservation and importer integrity.
For independent decoder verification, decode originals and optimized files with
the same decoder and compare PCM hashes, sample rates, channels and frame counts.
Automated decode equivalence does not establish move-to-animation timing or
perceptual correctness; those belong to the later sound integration review.

## Stage A: decoded audit and independent candidate catalog

Stage A adds `@battle/battle-sfx`, with records for all 530 recordings and explicit
policies for all 354 game moves. It does not connect move sounds to playback or
modify audio, animations, cries, battle results or server behavior. Filenames
establish candidates only: 352 moves have candidates, while Mirror Move and
Nature Power have explicit unresolved called-move policies. Generic recordings
have separate event IDs; unavailable intro/result/release/UI cues remain deferred.

On a fresh checkout, using the project's Node 24 toolchain:

```sh
# Installs only the isolated, pinned audit tools; the app does not need them.
npm run audio:setup
npm run audio:check
npm run sfx:check
npm run test:sfx

# Regenerate the same committed metadata under the existing audit pin.
npm run sfx:build
# Equivalent command: npm run audio:audit

# Optional: verifies every locally cached original against its original hash,
# and verifies that stripping its ID3v2 tag reproduces the committed bytes.
npm run audio:verify-originals
```

`audio:setup` requires network or an existing npm cache; generation and checking
use local files only. Ordinary app installs/builds do not install or run this
decoder. `test:audio` now includes decoded-audit tests, so it also needs setup.
The decoder dependencies and original cache are excluded from the Heroku slug.

The reference is `mpg123-decoder@1.0.3`, with gapless handling enabled. Its exact
npm dependency graph, integrities and installed JS/embedded WASM hashes are pinned
in `audit-lock.json`. The lock also pins the source manifest, game/FX catalogs,
mapping policy and audit algorithms. The audited FX catalog is a trusted,
self-contained repository module; its captured pinned bytes are imported without
loading the renderer or any move implementation.

The audit records native-rate, interleaved Float32 PCM hashes, frame counts,
duration, decoded bytes, finite samples, sample peak/RMS, quiet edges and
mean-centered stereo correlation. Zero is the first sample returned by the
gapless-enabled reference decoder. It writes measurements, **not decoded audio
files**. Unsupported channels, malformed streams, decoder errors, invalid/empty
PCM or resource-limit violations stop generation before publication. The current
collection is stereo 44.1 kHz; it is not a claim of support for arbitrary MP3s.

Measurements have precise limits:

- Sample peak is not oversampled true peak, and RMS is not integrated LUFS.
- Quiet edges use a fixed -60 dBFS sample threshold, not perceptual onset or
  automatically approved trim points. Digital silence has null dBFS values.
- A sample above full scale triggers review; it does not prove source clipping.
- Exact duplicate hashes do not establish perceptual similarity or difference.
- Native browser decoders may resample or handle encoder delay differently.
  Reference coordinates require browser/listening validation before region use.

No gain, cue regions or visual timing revision is invented. Asset annotations
have empty regions, null gain/revision and an explicit unreviewed browser state.
Normal, reduced-motion and instant playback policies remain unreviewed. A source
change invalidates the audit rather than silently carrying annotations forward.

## Outputs and reproducibility

| File | Purpose |
| --- | --- |
| `mapping-policy.json` | Reviewed spelling aliases, generic filename candidates and unresolved event/called-move policies |
| `audit-lock.json` | Decoder implementation and input/algorithm pins |
| `reports/decoded.json` | Every source/PCM hash, format, decoded measurement and exact duplicate group |
| `reports/sfx-coverage.json` | Every file category, game move, FX match and event policy |
| `reports/sfx-discrepancies.json` | Missing/unreviewed mappings, warnings and explicit remaining limitations |
| `reports/sfx-audit.md` | Readable measured summary |
| `reports/sfx-generation.json` | Output sizes/hashes and the audit-lock hash |
| `../../packages/battle-sfx/data/catalog.json` | Independent, versioned source/candidate catalog |
| `../../packages/battle-sfx/src/catalog.generated.js` | Equivalent JS catalog for plain JavaScript consumers |

`sfx:check` re-decodes all 530 files and compares every generated byte, including
the publication receipt. It creates no files/cache and never repairs drift. It
needs no original cache. All inputs are revalidated before publication, including
files already decoded. Unknown/ambiguous files, stale aliases, changed source
bytes, pins, catalogs or decoder implementation fail closed. Managed paths reject
symlinks and traversal.

Generation validates everything first, replaces each metadata file atomically
and writes the receipt last. This is not a multi-file filesystem transaction:
an interrupted publication is detected by `sfx:check`; `sfx:build` repairs it
under the same lock. The first `--init` enrollment is already complete and refuses
to overwrite an existing lock/output set. Source/decoder/algorithm pin changes
require a deliberate reviewed migration with regenerated outputs; there is no
automatic re-pin switch.

All 530 local originals were verified during Stage A. That local verification
does not establish an external durable archive. Preserve a separate backup
before later source-transform work. Existing `/sound_effects/` bytes and URLs
stay unchanged during the separate approved runtime compilation.

The development-only Stage B [audition bench](../../docs/SFX_AUDITION_BENCH.md)
is now available at `/sfx-bench` under Vite. `bench.mjs` verifies this audit and
supplies the selected pilot manifest/reference waveforms; `review/pilot.json`
records the worklist and source-backed visual marker evidence. Neither changes
the Stage A pin or approves sounds. Listen against the actual animations,
annotate regions and check native-browser alignment before enabling any move SFX.

## Stage C: approved runtime subset

The user-approved `review/pilot-reviews.json` contains 11 configurations across
10 moves. `runtime-selection.json` explicitly selects 10 whole-recording defaults;
Absorb Part 1 remains an approved, unscheduled alternative. Selection does not
infer roles from filenames or promote other candidates. The Stage A catalog and
its audit pins remain unchanged.

```sh
# Authoring setup is only needed when generating or verifying these outputs.
npm run audio:setup
npm run sfx:runtime
npm run sfx:runtime:check
```

`runtime.mjs` checks the exact review-bundle hash, approval fingerprints, source
hashes, audit/decoder pins and fresh visual revisions before writing anything.
It preserves the approved whole-recording regions, zero gain adjustment and
timing at playback rate one; it does not trim, normalize, re-encode or invent
additional contacts. The check command compares all expected outputs without
repairing or writing files.

| Output | Purpose |
| --- | --- |
| `../../packages/battle-sfx/src/runtime.generated.js` | Compact approved plans and asset descriptors, consumed through `@battle/battle-sfx/runtime` |
| `../../public/audio/sfx/<sha256>.mp3` | 10 verified byte-for-byte copies, totaling **887,339 bytes**, with content-addressed filenames |
| `reports/sfx-runtime.json` | Coverage, selected review/source/revision hashes, output sizes and hashes, and the unscheduled approved alternative |

Original archives and existing `/sound_effects/` assets are unchanged. The
production host gives the hashed copies immutable caching; legacy URLs keep
their existing behavior. Production installs/builds use committed outputs and
need no isolated audit decoder, bench or authoring dependencies.

The runtime entry exports `SFX_RUNTIME_CATALOG`, `getMoveSoundPlan`,
`getFxSoundPlan` and `getRuntimeSoundAsset`. It loads no candidate catalog and
plays nothing itself. The host enforces the reviewed **Chrome 152 / 48 kHz**
native profile and exact per-asset decoded frame counts. Other native profiles,
unapproved moves/phases, reduced/instant presentation and unsuccessful outcomes
remain silent. See the [runtime pilot guide](../../docs/SFX_RUNTIME_PILOT.md)
for integration and operational limits.

## Remaining-collection technical drafts

`npm run sfx:analyze-remaining` re-decodes all 530 pinned recordings and creates
`reports/sfx-remaining-analysis.{json,md}` plus eight bounded JSON review bundles
under `review/remaining/`. `npm run sfx:remaining:check` recomputes and verifies
them without writing. The algorithm and `analysis-policy.json` are pinned in the
report. No runtime selection, source file or approved record is modified.

These are 502 **technical drafts**, with measured energy/region alternatives and
attenuation-only volume proposals. They contain no listening approval or invented
browser measurements. The separate `/sfx-bench?collection=remaining` page loads
one batch at a time; the original pilot's pinned authoring files stay intact.
See the [scope, exclusions and audition procedure](../../docs/SFX_REMAINING_REVIEW.md).

## Simulation and move-preview technical-draft runtime

`npm run sfx:simulation` compiles the explicit 323-move selection in
`draft-runtime-selection.json`; `npm run sfx:simulation:check` verifies all outputs
without writes. The compiler checks the current collection, analysis and eight
batch hashes, source/PCM and visual revisions, exact generated whole regions and
attenuation defaults. It rejects listening evidence in technical drafts.

Outputs are `packages/battle-sfx/src/draft-runtime.generated.js`, 323 original-byte
hashed MP3 copies in `public/audio/sfx/`, and `reports/sfx-draft-runtime.json`.
The separate `@battle/battle-sfx/draft-runtime` export is injected by solo
simulation and move preview, with independent host rollout switches. It does not change the approved runtime selection or enable optional
trim/energy comparisons. See the [runtime policy, budgets and rollback flag](../../docs/SFX_SIMULATION_DRAFTS.md).
