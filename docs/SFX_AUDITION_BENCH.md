# Stage B: SFX audition bench

The local bench compares the original move animations with selected regions of
the supplied recordings. It measures the browser decoder, displays the pinned
reference waveform, and saves explicit listening decisions with their source and
visual revisions. No recordings have been trimmed, normalized or re-encoded.

The authoring workflow is implemented. **User listening sign-off is recorded for
11 saved configurations across 10 moves.** See the [approval record](../tools/audio-import/review/PILOT_REVIEW.md)
and importable [review bundle](../tools/audio-import/review/pilot-reviews.json).
Decoding, successful playback and automated tests do not establish perceptual
approval; these records preserve the user's confirmation. The Stage A catalog
still contains zero approved production playback mappings.

## Open it

The remaining collection now has a separate [technical review workflow](SFX_REMAINING_REVIEW.md)
at `/sfx-bench?collection=remaining`: 502 drafts in eight bounded batches, with
measured region, cue-alignment and volume alternatives. The original pilot page
and approval pins remain intact; generated drafts add no listening approvals.

```sh
npm install
npm run audio:setup
npm run dev
```

Open `/sfx-bench` on the local Vite address. The existing `audio:setup` installs
the pinned reference decoder separately from app dependencies. Manifest and
reference requests verify its installed identity and Stage A inputs; run
`npm run sfx:check` to diagnose source or audit drift. Missing tool dependencies
do not prevent the ordinary game pages from running.

The bench HTML is excluded from production build inputs. Vite preview and the
production server return 404 for its reserved routes, even if a stray bench HTML
file is present. Production battle pages import neither the authoring UI nor its
audio transport, decoder, waveform data or review catalog.

## Review a move

1. Select a **Study** and a candidate **Recording**. The filenames are evidence
   of candidate identity only. Whole tracks and numbered parts remain separate
   choices; part numbers do not assign launch or impact roles.
2. Click **Enable & load sound**. This unlocks browser audio from the click,
   verifies the MP3 size/hash, decodes the selected file and shows actual browser
   frames/rate/peak. Nothing plays during loading.
3. Use **Full original** to hear the recording intact. Compare both waveforms.
   Both use min/max envelopes without amplitude normalization; the reference is
   generated from the exact PCM hash audited in Stage A.
4. Define a region using integer **start/end frames**, with an exclusive end.
   The **sound anchor** is the frame where the intended audible accent occurs.
   You can set these through numeric fields or the reference waveform's click
   mode. The displayed seconds help interpret the frame coordinates.
5. Set the **visual anchor** in seconds. Clicking an animation marker copies its
   authored time. The result-impact marker may differ from earlier cosmetic
   contacts: Double Kick has two visible contacts but only one result reveal.
6. Use **Play together**, then repeat from **Near side** and **Far side**.
   The original recipes, sprites, actor identities and choreography run in the
   existing FX renderer. **FX only** lets you inspect motion without sound.
7. Add up to eight regions from the same recording when separate accents fit
   better. Inspect natural attacks/tails and avoid layering a full multi-hit
   recording with duplicate isolated hits. Regions can overlap deliberately;
   the monitor applies conservative headroom and exposes its attenuation.
8. Write sound/region/gain notes, reviewer name and native alignment/output-device
   notes. Check each perspective only after listening to that configuration.
   Confirm browser alignment manually. **Record listening approval** validates
   the evidence and stores a revision-specific reviewer assertion.

There is no automatic onset selection, silence trimming, normalization, fade,
pitch adjustment or part-role assignment. Gain defaults to 0 dB as a draft
setting. Monitoring starts at 20% and is capped at 60%; this is listening volume,
separate from saved region gain. A volume/headroom estimate is not a mixed-audio
production certification.

## Reference frames, browser samples and timing

Reference coordinates name the pinned, gapless-enabled Stage A decode. Region
bounds quantize inward to the actual browser sample grid:

```text
nativeStart = ceil((startFrame / referenceRate + explicitNativeOffset) * nativeRate)
nativeEnd = floor((endFrame / referenceRate + explicitNativeOffset) * nativeRate)
startAfterVisual = visualAnchorSeconds - (sourceAnchorFrame - startFrame) / referenceRate
```

Inward conversion retains samples within the authored time window, changing each
boundary by less than one native frame. A tiny numerical tolerance handles
floating-point arithmetic at exact integers. It is not a clamp or a guessed
priming correction. Every region must still fit the native buffer and contain at
least one native frame. Tackle's 24,758 reference frames at 44.1 kHz become 26,947
frames in the tested 48 kHz browser decoder; Double Kick's 23,933 reference frames
become 26,049. Raw-second or nearest-frame bounds could reject these whole-file
drafts because the browser rounded its resampled output length down.

The explicit native offset defaults to zero, with an authoring bound of ±100 ms.
It is an unreviewed hypothesis until you compare/listen and record evidence.
Do not infer audible alignment from similar durations or quiet-threshold edges.

Sound scheduling begins only after visual asset loading and recipe construction.
A dev-only adapter starts the original timeline and schedules ready regions from
that point. It does not change the production FX cue contract or delay battle
controls. Immediate segments use the current audio clock; future regions use its
scheduled start times. Audio stays at rate 1. Regions requiring a start before
the animation, anchors beyond the move's duration, invalid gains or out-of-buffer
coordinates are rejected.

The trace separates source-backed **authored guides**, **observed result cues**
and audio scheduling. Browser latency/timestamp fields are diagnostics rather
than a measured sound-to-image error. The bench stops an audition if foreground
audio/timeline drift exceeds 100 ms; this guard is not the plan's proposed 50 ms
perceptual acceptance test. Actual audiovisual capture/listening on the target
devices is still required. Web Audio's scheduling clock and output timestamp
behavior are described by [MDN scheduling](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
and [output timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp).

Stop, Escape, tab backgrounding, page exit, selection change or a context
interruption cancel owned playback. Interrupted voices do not count as completed
listening trials. Late fetch/decode/FX preparation cannot restart a stopped run.
The bench reloads on Vite code updates so review pins cannot survive hot-swapped
animation code unnoticed.

## Pilot scope and honest gaps

The worklist has 18 studies and 25 source candidates: Tackle, Flamethrower,
Hyper Beam, Double Kick, Bullet Seed, Absorb, Protect, Will-O-Wisp, Rain Dance,
Fly attack/preparation, Mirror Move, Present, plus normal/super-effective/resisted
hit, heal and faint recordings.

- Mirror Move has no named sound. Its original visual can be inspected, but no
  replacement recording or called move is invented.
- Fly phases show their unassigned candidates independently.
- Present's existing animation depicts damage. Its heal candidate is available
  for audio-only comparison; paired playback/approval is disabled for that file.
- General battle-event recordings are audio-only studies at this stage. Save
  their notes and regions as drafts; a matching lifecycle visual is required
  before paired sign-off. No intro, victory, defeat or ball-opening sound is
  fabricated.
- Compact/reduced/instant recipes and production cue-driven playback belong to
  later stages. A normal-mode bench approval does not approve those modes.

## Save, export and validate

Valid drafts save when switching selections or pressing **Save draft**. Invalid
edits remain visible and block a selection change until fixed or reset. Editing
regions/gain/offsets clears perspective and alignment evidence. Approved records
include an exact settings/evidence snapshot; any later edit invalidates it.

**Export reviews** downloads a versioned JSON bundle. **Import JSON** validates
source SHA-256, reference PCM hash/coordinates, audit lock, visual revision,
subject/phase/asset membership, region bounds and evidence. Import merges matching
subject/phase/asset records; it never changes source assets or production data.
Bundles are limited to 64 records and 1 MiB of UTF-8 JSON. Exports are a portable
copy; browser storage alone is not a durable archive.

Stale stored bundles are not silently repaired or reused. Their original text is
available through **Export previous reviews** and is backed up under a separate
storage key before a replacement is saved/imported. Migration requires review
against the new source/visual version.

The pure schema lives in `@battle/battle-sfx/review`. Source recordings and Stage A
generated catalogs remain separate from these editorial records. Visual revisions
include the selected recipe, shared FX code, pilot marker policy and audition
adapters. This allows a later recipe compiler to consume approved exports without
adding browser dependencies to the SFX package or mechanics to the bench.

## Validation and next gate

```sh
npm run test:sfx-bench
npm run sfx:check
npm test
npm run build
```

The bench suite covers malformed/stale reviews, native coordinate conversion,
decode/hash/resource failures, scheduling/cancellation, failed FX construction,
both actor identities, real dev routes, and preview/production exclusions. Its
HTTP tests use temporary loopback ports. The ordinary root test suite does not
require the isolated decoder installation.

Reference decoding runs one job at a time with a bounded queue and caches four
small waveform summaries. Browser audition retains one selected buffer, at most
one active load/decode plus one replacement request, and at most eight scheduled
voices. No full-library browser decode or database service is introduced.

The representative ten-move listening gate is now recorded, including both
perspectives and native-browser measurements. Approvals are explicit imported
records, never automatically filled for new drafts. Present, Fly preparation,
other variants and audio-only events remain pending. The [Stage C runtime pilot](SFX_RUNTIME_PILOT.md)
now consumes ten selected configurations through a compact catalog, shared mixer
and cosmetic visual clock. Combined-mix listening and broader browser/device
validation remain release work; bench approval does not imply those checks passed.
