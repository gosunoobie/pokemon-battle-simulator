# Remaining sound collection: technical audition pass

The remaining collection has a separate development-only audition page at
`/sfx-bench?collection=remaining`. It loads generated technical drafts without
changing the approved pilot, production selection, recordings or animations.

The later [simulation and move-preview integration](SFX_SIMULATION_DRAFTS.md) explicitly selects
323 of these whole-recording defaults for both pages at the user's request.
Their technical-draft status and all listening evidence remain unchanged. The
bench still edits separate studies; its optional comparisons do not automatically
change the enabled sound pack.

This pass measures the supplied audio and proposes bounded regions, timing
comparisons and conservative gains. **It is not a listening sign-off.** No
reviewer identity, near/far listening checks or native-browser measurements are
invented. Perceived sound character, semantic accent identity and final mix
balance cannot be established by a waveform calculation.

## Completed technical scope

- All 530 original recordings are decoded sequentially under the pinned decoder
  and checked against the existing PCM hashes.
- All 354 move policies, 335 attack animations, four preparation animations and
  28 battle-event policies are inventoried.
- The 11 existing approved configurations are preserved. Their ten production
  selections are unchanged.
- There are 502 new importable drafts in eight batches of at most 64 records.
  Twenty-seven candidate configurations belonging to the 19 moves without
  animations are report-only. Missing recordings stay explicit.
- Each asset has exact sample-peak/RMS measurements, threshold boundaries,
  10 ms energy-window analysis and separated energy-rise candidates. The compact
  display envelope does not replace those measurements.
- There are 158 optional energy-to-result timing comparisons. These use an
  existing authored visual cue and keep the whole recording; a proposal is
  omitted if it would require starting before the animation.

The [generated report](../tools/audio-import/reports/sfx-remaining-analysis.md)
and [machine-readable measurements](../tools/audio-import/reports/sfx-remaining-analysis.json)
contain the complete coverage, dispositions, provenance and batch links. Counts
of configurations differ from unique files because preparation phases can reuse
a recording as an unassigned candidate.

## Region and volume decisions

The default comparison preserves the whole original recording at normal speed.
An optional padded threshold-region comparison retains 20 ms before and 50 ms
after samples crossing −60 dBFS. That threshold is a numeric measurement, not a
claim that everything outside it is inaudible. The alternative edits playback
coordinates only; it never rewrites the MP3.

Another optional comparison places the start of the strongest 10 ms energy
window at the animation's declared result cue. That window is **not labeled as
the sound's semantic impact**. Source onset, peak energy and the animation's HP
reveal need not represent the same moment. The bench displays the actual original
animation, authored marker and observed result-cue trace so these choices can be
compared explicitly.

Draft volume uses attenuation only. It compares source sample peak and whole-file
RMS with the maxima in the validated ten-recording pilot: −7.9853 dBFS peak and
−20.0128 dBFS RMS. It chooses the most conservative nonpositive gain, rounded
down to 0.01 dB. Sixty-six unique recordings receive an attenuation proposal;
quiet recordings are never boosted. Existing approved gains are not changed.
Whole-file RMS is duration-dependent and is not perceived-loudness normalization
or a true-peak measurement. The runtime mix still needs its separate listening pass.

## Explicit exclusions and ambiguities

| Case | Treatment |
| --- | --- |
| Multipart recordings | Independent alternatives; no inferred launch/impact order |
| One-hit/two-hit recordings | No automatic repetition or damage-count inference |
| Fly, Bounce, Dig, Dive preparation | Separate unassigned studies; attack approval does not cover preparation |
| Present healing | Audio-only; the current visual depicts damage |
| Nine later-turn damage/heal recordings | Audio-only; an initial attack is not the matching visual |
| Generic hit, status, recall and faint sounds | Audio-only until paired with their actual lifecycle presentation |
| Mirror Move and Nature Power | No named source; no substitute or client-inferred called move |
| Nineteen moves without FX | Report-only candidate measurements; no paired review |
| Reduced-motion or effects-off playback | Outside this normal-animation review |

## Reproduce and inspect

```sh
npm run audio:setup
npm run sfx:analyze-remaining
npm run sfx:remaining:check
npm run sfx:runtime:check
npm run test:sfx
npm run dev
```

`sfx:remaining:check` re-decodes the collection and verifies deterministic outputs
without writing. Source, decoder, analysis policy, implementation, review bundle,
runtime selection and collection revision are pinned. Changed inputs require
regeneration; old approvals are not silently refreshed.

The page loads one batch at a time, with separate browser storage and JSON
exports. It validates batch membership, source hashes, visual revisions and
region bounds. Choose a recording, enable/load native audio, and compare **Full
original**, **Selected regions**, **FX only** or **Play together** from either side.
The proposal panel can apply an optional comparison, which clears listening
evidence. Native rate/frame count is recorded only after that browser decodes
the file. Import/export remains limited to 64 records and 1 MiB per batch.

The old `/sfx-bench` page and its pinned files remain intact. The collection's
new UI and helpers have separate revision tracking. Full authoring batches,
waveform analysis, decoder tooling and both bench pages stay outside the production
build. Simulation and move preview import only the separately compiled compact draft catalog.

Completing playback establishes that the transport ran, not that a person
approved the result. Any eventual listening approval must describe the actual
configuration and observations. A reviewed batch still needs explicit runtime
selection and compilation before new production move playback is enabled.

## Browser checks on 18 September 2026

The local bench was exercised in Chrome 152.0.0.0. Native decoding reported:

| Recording | Reference frames at 44.1 kHz | Native frames at 48 kHz | Native sample peak |
| --- | ---: | ---: | ---: |
| Body Slam | 67,473 | 73,440 | 0.4367 |
| Aerial Ace | 35,898 | 39,072 | 0.2975 |
| Present heal | 199,332 | 216,960 | 1.0314 |

Body Slam completed paired transport from both perspectives at the proposed
−0.8 dB gain. Its declared 0.820 s result cue was observed on rendered timeline
updates at 0.829 s near and 0.835 s far. Aerial Ace's comparison placed source
frame 15,435 (0.350 s) at the 0.620 s visual cue, scheduling playback at 0.270 s;
the visual result callback was observed at 0.627 s. These are software timeline
observations, not measured acoustic latency or listening judgments.

Present heal remained unavailable for paired playback and visual approval after
native loading. Its native peak differs from the pinned reference, reinforcing
why reference-only gains are proposals. Batch switching preserved separate
drafts, and listening checkboxes remained unchecked. Automated validation passed
708 application tests and 109 SFX tests; the production build excludes the bench,
analysis and decoder. Broader native-device measurement remains outstanding.
