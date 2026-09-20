# Sound and animation review: batch 5 — fourth feedback revision

Current status: accepted and active in all three game hosts through the [seven-batch rollout](SFX_ACCEPTED_ROLLOUT.md). The notes below preserve the review history.

Open [Batch 5](http://localhost:5173/sfx-bench?batch=sync-005) and choose **Play proposed**. Eight moves now retain their exact approved proposals and Keep verdicts. Only Eruption and Blizzard have new changes to review; Eruption is selected by default.

| Move | Latest change |
| --- | --- |
| Eruption | All 38 lava balls are twice as wide and tall, with the same continuous volley, launch/arrival schedule and impact rhythm. Larger contour clearance keeps them inside the field. |
| Blizzard | Each large crystal has half its previous final width and height. It begins upright at 20% of that new size, grows smoothly over 0.24 authored seconds, then fades over 0.08 seconds to disappear on the existing beat. |

Blizzard's small incoming crystals still travel to the seven distributed contact points. Each incoming particle hands off over 0.045 authored seconds to the small upright growth. Flight begins 0.58 seconds before the existing beat and lasts 0.26 seconds; growth starts 0.32 seconds before the beat. Snow, wind and later impact fragments remain intact.

**Play previous proposal** replays the exact third revision, including its earlier crystal growth and original lava-ball sizes. **Play current** retains the original baseline. All ten sound plans, result-cue times, clip durations and listening gains remain unchanged. Fire Blast, Solar Beam, Razor Leaf, Sludge Bomb, Overheat, Earthquake, Thunder and Bubble Beam keep their approved artwork.

## Original style references

The preceding style pass consulted `docs/ANIMATION_SPEC.md` (restored choreography, original visual details and move appearance), `docs/ADDING_MOVES.md`, and the checked-in restored Fire Blast, Flamethrower, Earthquake, Thunder, Thunderbolt, Ice Beam and Blizzard recipes. The practical findings and applied choices are recorded in [the third-pass style notes](../tools/audio-import/review/sync-batch-005.style-notes-03.md).

The original Earthquake separates level elliptical ripples from a sloped jagged fault. Removing the second revision's ripple shear restores that distinction. Matte dust remains matte. Fire Blast retains its layered growing orb and flowing five-arm identity; only the release phase is shorter. Thunder uses heavier main trunks and fine branches with a warm glow and pale hot core. Blizzard retains translucent faceted ice and the reviewed continuous flight-to-growth sequence.

Each move owns its artwork and particle motion, uses semantic actor attachments and emits one cosmetic result cue. New effects remain within the battlefield, continue moving through their fades and restore poses on all exits. No battle rules or production recipes change.

## Review evidence and playback

The three browser feedback rounds remain archived in `tools/audio-import/review/sync-batch-005.feedback-01.json` through `feedback-03.json`, with matching review captures and manifests. The latest request was made directly in chat. Its exact text, eight approvals, two requested changes and frozen playback hashes are recorded separately in `sync-batch-005.chat-review-04.json`, with the reviewed third-revision proposal in `sync-batch-005.manifest-04.json`. Chat approval is never represented as a browser export.

`sync-fifth-fourth-revision.mjs` validates this evidence, source/PCM and playback identities, and the exact reviewed contact/duration contracts. Eight approvals retain their previous visual revision identities. The two changes receive new identities and fresh review records. All prior recipes and review adapters remain frozen.

The new recipes live in `packages/battle-fx/src/review-batch-five-v4/`; `batchFiveVisualV4.js` selects them. Kept moves still use their approved earlier builders. UI playback independently chooses original, previous and proposed artwork and metadata, retaining correct sound-boundary fades. This local review does not automatically publish into game playback.

## Validation

Focused tests compare all 38 lava balls and all three glow layers against the approved sizes, exercise continuous flight and live attachments, and check full art/actor bounds from both sides in portrait and standard layouts. Blizzard tests verify exact half-size geometry and strokes, upright 20% starts, gradual growth and disappearance, incoming-particle handoff, seven attachments, original sound beats, flowing aftermath and cleanup. Integration checks cover all ten proposed and previous playback paths, eight exact carried approvals, unchanged sounds, cancellation and reduced motion. Browser review checks actual appearance and timing.

The fourth revision passed 212 app/effect checks, 153 sound-tool checks and the production build. Browser captures confirm the larger lava volley and smaller upright crystals during playback.
