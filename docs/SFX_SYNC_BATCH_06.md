# Sound and animation review: batch 6 — accepted finals

Current status: accepted and active in all three game hosts through the [seven-batch rollout](SFX_ACCEPTED_ROLLOUT.md). The notes below preserve the review history.

All five final versions were approved on 2026-09-18: “The final Outputs looks perfect for batch 6”. Open [Batch 6](http://localhost:5173/sfx-bench?batch=sync-006) and choose **Play final version**. The five saved Keep reviews and native measurements are archived in `sync-batch-006.feedback-02.json`, with the exact reviewed proposal in `sync-batch-006.manifest-02.json`. The final approval file pins both records and all 23 playback sources; the bench exposes only the accepted versions. Earlier comparisons remain archived.

| Move | Latest change |
| --- | --- |
| Leaf Blade | The lower filled half beneath the curved center vein is removed, leaving the upper green crescent and white edge. Its root, tip, two physical strikes, opposite cuts and cross finish are unchanged. |
| Tri Attack | Approved version preserved: original triangle opening, burning flames, electrical sparks and upright growing ice. |
| Meteor Mash | Approved version preserved: larger cosmic-star impact with live fist contact and dark violet glow. |
| Ancient Power | Five actual Rock Slide texture sprites are twice the previous visible dimensions. An enlarged orbit uses even 72° spacing around the user, with rear rocks obscured by an owned actor snapshot and front rocks drawn above it. The original five launches and impact times remain. |
| Sacred Fire | Approved purple charging flames are unchanged. The release becomes a Dragon Breath-style continuous flame stream. The receiving crown uses the opening's purple flame material, with doubled flame width/height and seven evenly spaced plumes. |

All five reviewed sound plans remain byte-for-byte unchanged: complete native recordings at 100% visual pace, with no new cut, pitch change or gain change. Delays remain Leaf Blade 0.40 s, Tri Attack 0 s, Meteor Mash and Ancient Power 0.10 s, Sacred Fire 0.06 s. Ancient Power still launches at 0.86 s with 0.055 s spacing and 0.48 s flights, contacts at 1.34 s and completes at 2.40 s. Leaf Blade contacts at 0.81/1.69 s, finishes its cross at 2.56 s and completes at 4.20 s. Sacred Fire contacts at 1.42 s, surges at 3.44 s, fades through 4.32 s and completes at 4.50 s.

The new move-owned recipes live in `packages/battle-fx/src/review-batch-six-v2/`. `batchSixVisualV2.js` loads the same cached rock texture used by Rock Slide before Ancient Power's animation/audio clock starts. Loading can be cancelled or superseded without touching actors, starting late playback or destroying the cache's texture. The orbit's temporary actor copy stays inside the owned effect layer; the live actor remains visible and both actors' poses recover on every exit.

The source request remains in `sync-batch-006.request-01.md`; the visible browser feedback is archived as `sync-batch-006.feedback-01.json`, with matching `manifest-01.json` and `review-01.json`. The reviewed manifest revision is `1494b2d4f74885194ef3a95e13e0ea3e6cbd49e99d7b1c37ebcfcf6ba8a2e1af`. The revision compiler verifies those hashes, original playback sources, all sound plans and the retained contact/duration contracts before carrying the two approvals forward. Original recipes, the v1 compiler/factory and their review evidence stay frozen.

Style references are `ANIMATION_SPEC.md`, `ADDING_MOVES.md`, the original move recipes, Rock Slide and Dragon Breath/Flamethrower, and the reviewed Thunder/Blizzard aftermath. No production sound, battle rule or registered move is replaced. The revised clips keep one cosmetic result cue; later contacts and elemental aftermath do not add damage or statuses.

Focused validation covers exact unchanged Leaf Blade choreography, removed lower blade geometry, texture identity and doubled rock dimensions, even orbit spacing and depth occlusion, unchanged Sacred Fire charge, doubled purple flame material, live stream contact, continuous fades, full art/actor bounds, both directions and lifecycle. Separate integration checks cover actual asset loading, pending-load cancellation, all current/previous playback paths, immutable reviews and the two carried approvals.

Revision validation on 2026-09-18: all 261 application sound/animation tests and 153 sound-tool tests passed. The production build passed with the existing large-chunk advisory. Browser playback verified the revised upper blade against its archived full blade, the textured Ancient Power orbit from both sides, and Sacred Fire's continuous release and sustained purple crown. The browser reported no errors or warnings. The user subsequently approved all five versions; acceptance changes only the saved review state and bench controls, preserving the artwork, timing and sounds.

Acceptance validation: five focused acceptance/history tests and all 153 sound-tool tests passed, followed by a successful build. The final-only playback tests cover all five moves from both sides and hold Ancient Power's paired clock until its texture is ready. The browser shows 5/5 accepted versions and completed Ancient Power's final playback without errors or warnings.
