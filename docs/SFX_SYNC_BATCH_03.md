# Sound and animation review: batch 3 — accepted

The user accepted all six final versions on 2026-09-18.
`/sfx-bench?batch=sync-003` now replays the finals; continue reviewing at
`/sfx-bench?batch=sync-004`. Game preview, simulation and multiplayer use these
plans before the historical defaults, bringing accepted coverage to 18 moves.

## Final timings

Each plan preserves the complete original recording, its natural pitch and
0 dB gain. Times below are elapsed playback seconds; visual pace scales the
recipe clock without changing audio speed.

| Move | Final sound timing | Visual pace | Sound / visual end |
| --- | --- | --- | --- |
| Surf | Start at 0.33 s; source 0.67 s energy maximum meets crest contact at 1.00 s | Original | 2.19 / 3.20 s |
| Water Gun | Start at 0.035 s; source 0.09 s energy rise meets muzzle glow at 0.125 s | 80%; impact at 0.60 s | 1.735 / 1.8125 s |
| Crunch | Start at 0.38 s; source 0.26 s energy maximum meets jaw contact at 0.64 s | Original | 1.53 / 1.80 s |
| Thunder Punch | Start at about 0.2378 s; source 0.34 s energy rise meets contact at about 0.5778 s | 90% | About 1.7661 / 1.7778 s |
| Swift | Start at 0.39 s; source 0.55 s energy maximum meets the first star at 0.94 s | Original; final result at 1.28 s | 1.52 / 2.05 s |
| Calm Mind | Start at 0.05 s; source 1.15 s energy maximum meets the result cue at 1.20 s | 75% | About 1.6273 / 3.20 s |


## Thunder Punch impact spark

The approved variant adds a white-yellow flash and branching lightning at the
existing authored 0.52 s contact (elapsed 0.5778 s at 90% pace). It follows the
opponent through recoil and fades with the existing discharge. The sound and
impact timing remain exactly as reviewed, with no extra voice or battle cue.

`@battle/battle-fx/accepted-effects` supplies the independent renderer variant
to the shared host. Its drawing function matches the frozen bench audition
exactly; the underlying Thunder Punch recipe and all 335 registry entries are
preserved. Sound mute and unsupported audio decoding do not remove the spark.
Normal cancellation, replacement and completion own its graphics and restore
poses; reduced motion uses the existing short effect without the flash.

## Acceptance evidence

`tools/audio-import/review/sync-batch-003.final.json` records the explicit chat
approval and pins the exact `feedback-02.json` and `review-02.json` captures.
The captures retain all six keep decisions, native measurements, full sound
plans, visual revisions and the four original bench playback modules. The
initial feedback and pre-spark artwork remain archived in the `-01` captures.
Acceptance does not rewrite these historical files or the earlier batch finals.

The accepted compiler validates source bytes, reference PCM, visual identities,
native decode bounds and playback revisions. The host preserves the reviewed
Chrome 152 / 48 kHz decoding scope and full recording tails. Regenerate with
`npm run sfx:accepted`; verify with `npm run sfx:accepted:check`.

Tests compare the accepted spark against the exact reviewed audition from both
perspectives, including geometry before the impact cue, actor poses, pacing,
cleanup, cancellation and replacement. Batch 4 tests cover its six independent
recipes from both sides and verify that each full recording fits the proposal.

Verification on 2026-09-18: 778 application tests and 153 sound/package tests
passed, along with all three runtime reproducibility checks and the production
build. The build retains the existing large-chunk warning. Browser verification
confirmed accepted-only controls and the link to Batch 4.
