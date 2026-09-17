# Lossless battle audio preparation

This tool prepares the supplied Generation 3 sound collection for static delivery.
It removes the leading ID3v2.3 tag (including repeated album artwork and padding)
and copies every remaining byte unchanged. It does **not** re-encode, normalize,
trim silence, change channels, change timing or connect sounds to gameplay.
Original filenames and `/sound_effects/<encoded filename>` URLs are preserved.

## Commands

```sh
npm run audio:check
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

Only the optimized MP3s and `manifest.json` under `public/sound_effects/` are copied
into Vite's static build. Public filenames are not content hashed. The manifest
records content hashes for later cache-versioning work; this change does not add
immutable cache headers or a CDN. It also does not implement browser playback.

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
