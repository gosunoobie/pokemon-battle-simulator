# Sound and animation review: batch 4

Current status: accepted and active in all three game hosts through the [seven-batch rollout](SFX_ACCEPTED_ROLLOUT.md). The notes below preserve the review history.

Open `/sfx-bench?batch=sync-004` while `npm run dev` is running. This comparison
covers Ember, Waterfall, Dragon Claw, Ancient Power, Shadow Punch and Swords Dance.
The proposals keep each complete original runtime recording at its natural pitch.
Dragon Claw keeps its existing −0.55 dB attenuation; all other gains remain 0 dB.
The preceding three batches remain available as accepted versions.

All six browser keep decisions are archived in `sync-batch-004.feedback-01.json`
and `sync-batch-004.review-01.json`. Their notes and native measurements carry
forward only while the sound plans, visual identities and playback modules
match. They remain review decisions; the accepted game catalog is unchanged.
The next requested set is [Batch 5](SFX_SYNC_BATCH_05.md).

## Proposed comparisons

Times in this table are elapsed playback seconds. Definition cues use the original
recipe clock; audio always runs at native speed.

| Move | Proposed sound timing | Visual pace | Sound / visual end |
| --- | --- | --- | --- |
| Ember | Start at 0.46 s; source 0.24 s energy maximum meets first flame contact at 0.70 s | Original | About 1.6627 / 1.70 s |
| Waterfall | Start at 0.07 s; source 0.71 s energy rise meets descending front contact at 0.78 s | Original | About 2.5480 / 3.15 s |
| Dragon Claw | Start at about 0.1311 s; source 0.78 s energy rise meets claw-tip contact at about 0.9111 s | 90% | About 2.1211 / 2.2778 s |
| Ancient Power | Start at 0.10 s; source 1.24 s energy maximum meets first stone contact at 1.34 s | Original | 2.05 / 2.40 s |
| Shadow Punch | Start at 0.48 s; source 0.26 s energy maximum meets spectral knuckle contact at 0.74 s | Original | 1.19 / 1.85 s |
| Swords Dance | Start at 0.08 s; source 0.87 s energy maximum meets the source-only result cue at 0.95 s | Original | About 1.3214 / 2.45 s |

These are numerical timing hypotheses for listening review. Energy measurements
alone do not identify semantic launches or impacts. Each baseline plays the same
whole runtime recording at animation start with original visual pace and gain.
No source trimming, repeated audio, pitch change or extra sound layer is proposed.

## What to compare

**Ember** sends five small flames at the existing 0.085 s intervals, from 0.26 to
0.60 s. Delaying the recording brings its strongest measured window to the first
arrival and existing result cue at 0.70 s. Later flames and sparks remain cosmetic
parts of one result. The complete 1.2026984127 s recording finishes shortly before
the visual ends; compare the buildup, volley and brief sparks together.

**Waterfall** begins revealing its curtain at 0.32 s and descending at 0.36 s.
The chosen energy rise meets contact at 0.78 s. Its later source maximum at 1.88 s
then occurs at elapsed 1.95 s, shortly after the stream starts draining at 1.92 s.
The full 2.4780045351 s recording ends during the spreading whitewater, before its
fade completes at 2.92 s. The complete Waterfall recording remains the selected
source; its separately cataloged parts are not assigned phase roles.

**Dragon Claw** compares a small slowdown of its charged approach, talon sweep and
return. The sweep begins at elapsed 0.5333 s, contact occurs at about 0.9111 s and
the return begins at about 1.1889 s. The 90% pace gives the complete 1.99 s recording
more room through recovery. The chosen rise precedes the later source maximum
at 1.33 s, so listen to the contact and later energy together. Its hand attachment,
visible claw-tip contact and existing −0.55 dB attenuation remain intact.

**Ancient Power** lifts five rune-marked stones before launching them from 0.86 s
at the original 0.055 s intervals. The first 0.48 s flight reaches the target at
1.34 s, where the proposed recording's maximum meets the existing impact pulse
and single result cue. The complete 1.95 s recording accompanies the lift,
accelerating volley and fragments through 2.05 s.

**Shadow Punch** forms a spectral fist, launches it at 0.32 s and arrives after
its 0.42 s flight. The proposed delay puts the strongest measured window at the
0.74 s knuckle contact. The full 0.71 s recording ends at 1.19 s, alongside the
contact crescent finishing its fade at 1.18 s. The user remains at its resting
slot, and the fist keeps its three afterimages and live attachment.

**Swords Dance** keeps the original orbit from 0.20 to 1.55 s. A short delay aligns
the measured maximum with the existing 0.95 s source-only result cue. The full
1.2414285714 s recording ends during the orbit, preserving its active natural
ending. The sword aura fades from 1.72 to 2.14 s. Compare whether the quiet finish
suits the four orbiting swords; no opponent contact is introduced.

## Review workflow

1. Select a move and click **Enable & load sound**.
2. Compare **Play current** and **Play proposed** from both sides.
3. Choose **Keep proposed version**, **Adjust sound**, **Adjust animation** or
   **Adjust both**, and describe the moment that needs attention.
4. Use **Export batch feedback** for a durable copy, or provide the move names
   and notes in chat. **View feedback JSON** provides a copyable fallback.

Sound-only and animation-only controls can help isolate a mismatch. Tuning a
proposal clears its verdict. Feedback is scoped to this batch and its exact
revision; technical playback checks do not approve a proposal.

## Evidence and validation

`tools/audio-import/review/sync-batch-004.json` pins each selected source hash,
reference PCM hash, visual revision and baseline gain. Its anchors use existing
44.1 kHz measurements in
`tools/audio-import/reports/sfx-remaining-analysis.json`:

| Move | Measurement | Start frame | Source time |
| --- | --- | ---: | ---: |
| Ember | Strongest 10 ms energy window | 10584 | 0.24 s |
| Waterfall | Positive energy rise | 31311 | 0.71 s |
| Dragon Claw | Positive energy rise | 34398 | 0.78 s |
| Ancient Power | Strongest 10 ms energy window | 54684 | 1.24 s |
| Shadow Punch | Strongest 10 ms energy window | 11466 | 0.26 s |
| Swords Dance | Strongest 10 ms energy window | 38367 | 0.87 s |

Cosmetic markers include literal evidence from the six independent move recipes.
Ember's fifth launch is its 0.26 s first launch plus four 0.085 s intervals.
Swords Dance's orbit finishes at 0.20 s plus its 1.35 s progression. Existing result
markers remain supplied by the registered effect timings.

The compiler checks provenance, exact runtime baselines, measured anchors, marker
evidence, source bounds, legal visual pace and nonnegative audio starts. The
browser validates each actual native buffer before scheduling. Every proposed
source region starts at zero and ends at the actual buffer end; reference
durations can differ slightly between browser decoders. All six reference plans
finish their whole recordings within their paced visual lifetimes.

This definition changes no independent move recipe, source recording, battle
rule or accepted plan. It remains an unreviewed development-only comparison.

Authoring verification on 2026-09-18: `createSyncBatchManifest({ batch:
'sync-004' })` compiled successfully, and a separate calculation verified that
all six complete reference recordings end within their paced visual lifetimes.

Integration verification: 778 application tests and 153 sound/package tests
passed, all three runtime catalogs reproduced, and the production build passed.
The six new recipe tests cover both perspectives, cue timing and cleanup.
