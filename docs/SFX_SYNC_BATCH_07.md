# Sound and animation review: Batch 7

Current status: accepted and active in all three game hosts through the [seven-batch rollout](SFX_ACCEPTED_ROLLOUT.md). The notes below preserve the review history.

Open [Batch 7](http://localhost:5173/sfx-bench?batch=sync-007), load each sound,
and choose **Play proposed**. All six proposals await review. **Play current**
retains the original registered animation with the same full recording.

| Move | Proposed finish | Visual duration |
| --- | --- | --- |
| Sing | Original pastel notes continue at the same speed, with moving lullaby waves through the final fade. | 4.19 s |
| Grass Whistle | Original leaf and sound pulses continue, with the seed drift moving through the ending. | 3.44 s |
| Attract | Original approach stays intact; six small hearts keep circling until the recording ends. | 6.01 s |
| Morning Sun | Original sunlight holds longer; rising healing light and glints begin at 3.3695 s and brighten at 3.49 s. | 4.57 s |
| Moonlight | Original moonlight holds longer; rising silver healing light begins at 4.3784 s and brightens at 4.53 s. | 5.57 s |
| Confuse Ray | Original ray and halo lead into three yellow ducks orbiting above the opponent from 1.81 s, bobbing on the ending sound accents. | 3.18 s |

Every recording plays completely from zero at its native speed and existing
0 dB gain, with no trim, repeat, splice or pitch change. Original first-contact
times remain 0.96, 0.88, 0.92, 1.15, 1.15 and 0.98 seconds respectively. The
added healing and duck imagery is cosmetic and emits no extra result cue.
Morning Sun and Moonlight retain source-only operation. Full actor visibility,
both perspectives, semantic sockets and cleanup remain unchanged.

The six independent recipes live in
`packages/battle-fx/src/review-batch-seven/`, routed by the local
`batchSevenVisual.js` factory. All original recipes are pinned in
`sync-batch-007.originals.json`. The request, exact audio/visual identities and
timing evidence live beside `sync-batch-007.json`. Batch 6's accepted final
versions remain intact.

The healing suffixes were checked by correlating the independently decoded
ending parts against their full recordings. The matches begin at reference
frames 148595 (Morning Sun) and 193089 (Moonlight), both at 44.1 kHz.
Confuse Ray's five ending energy rises align to its second part at an offset
of 79821 frames (1.81 s), matching at 1.92, 2.17, 2.29, 2.41 and 2.66 s. The
user supplied the meaning of those ending sounds; these measurements establish
their timing. They are recorded in the two `sync-batch-007.*-measurements.json`
files. Native browser decoding can differ slightly from the reference frame
counts and is measured when the sound loads.

Style references are the original six recipes, `ANIMATION_SPEC.md`,
`ADDING_MOVES.md` and the existing recovery effects. The original notes,
hearts, rays and moon/sun shapes remain; only their duration and the explicitly
requested endings change.

Validation on 2026-09-18: all 280 application sound/animation checks and 153
sound-tool checks passed, including original-opening parity, full art bounds,
both perspectives, source-only healing, late motion, cancellation and cleanup.
The production build passed with the existing large-chunk advisory. Browser
playback loaded all six full recordings at 48 kHz and confirmed the sustained
notes, whistle pulses and hearts, both healing finishes and three circling ducks.
Playback does not set a verdict; all six proposals remain awaiting user review.
