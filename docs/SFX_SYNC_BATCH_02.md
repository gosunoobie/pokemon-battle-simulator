# Sound and animation: accepted batch 2

The user accepted all six versions on 2026-09-18, including Psychic's added impact
sound. Open `/sfx-bench?batch=sync-002` during `npm run dev` to replay the locked
finals. Continue with the six new comparisons at `/sfx-bench?batch=sync-004`.

| Move | Accepted sound timing | Accepted animation |
| --- | --- | --- |
| Ice Beam | Source region 0–2.60 s starts at 0.395 s | 80% pace; impact at elapsed 0.85 s |
| Psychic | Whole base recording starts at 0.06 s; whole Hit Normal Damage accent at 0.85 s, −6 dB | Original pace; burst at 0.95 s |
| Flamethrower | Whole recording starts at about 0.0433 s | 75% pace; impact at elapsed 1.20 s |
| Shadow Ball | Whole recording starts at 0.29 s | Original pace; impact at 1.10 s |
| Rock Slide | Whole recording starts at 0.19 s | Original pace; first contact at 0.87 s |
| Giga Drain | Whole recording starts at 0.25 s | 80% pace; impact at 0.85 s and recovery at 1.825 s |

All recordings retain their original pitch. Base gains remain at 0 dB. Ice Beam's
80 ms excluded tail lies in the measured below −60 dBFS region; its earlier quiet
gap and both active sections remain intact. Psychic's accent shares the base
sound's clock and cancellation scope. Its measured rise at source 0.10 s meets
the existing visible burst; it adds no battle-result cue.

## Acceptance and runtime

`tools/audio-import/review/sync-batch-002.final.json` records the exact approved
plans, source/PCM/visual identities, native decoder measurements and the user's
acceptance. The first feedback and review snapshots remain historical evidence.
The separate native measurement capture records the actual Psychic impact decode;
it is technical evidence, not an automated listening verdict.

`npm run sfx:accepted` generates the independent accepted runtime catalog. With
Batch 3 accepted, it contains 18 moves and 19 source recordings. Accepted plans take precedence over
the historical pilot and draft defaults in simulation, move preview and
multiplayer. The host supplies cosmetic animation pacing even when sound is
muted; recipes, geometry, rules and result cues stay unchanged. Psychic's two
layers preload and validate together and stop together on cancellation.

The accepted sounds retain the reviewed Chrome 152 / 48 kHz native decoder gate.
Unsupported decodes remain silent instead of playing superseded versions. Source
MP3s remain intact, and the runtime serves hash-addressed copies. The accepted
review page exposes final playback only; new comparisons and their notes belong
to batch 4.

## Validation

`npm run sfx:accepted:check` verifies the final provenance, generated catalog and
published audio bytes. Focused compiler, player and host tests cover both Psychic
layers, their common clock and cancellation, accepted pacing, and the unchanged
first batch. Run `npm test`, `npm run test:sfx` and `npm run build` for shared
runtime changes. Browser playback verifies loading and completion; automated
checks do not replace the user's listening approval.
