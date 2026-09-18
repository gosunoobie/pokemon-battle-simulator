# Batch 5: original style references for the third feedback pass

The six Keep decisions are exact approvals of their existing proposals. This pass changes only Fire Blast, Earthquake, Thunder and Blizzard, with all sound plans, impact times and clip durations preserved.

## References read

- `docs/ANIMATION_SPEC.md`, “Restored choreography and dynamic coordinates” and “Visual details restored”: each move owns its layers, geometry, particle laws and easing. Fire Blast combines a three-layer growing orb, five-point blast, expanding ring and large burst. Flamethrower supplies the moving flame material reference. Timing tables describe the original production recipes, not a requirement to undo the user's later sound-synchronization edits.
- `docs/ADDING_MOVES.md`: preserve independent recipes, semantic source/target anchors, uniform local art units, owned timeline updates, single cosmetic result cues and cleanup. Verify both directions, actor proportions, cancellation and actual browser appearance.
- `packages/battle-fx/src/moves/restored/fire-blast.js` and `flamethrower.js`: retain the layered warm orange/yellow/ivory material and flowing fire. The user approves the second revision's art; only its charge/release timing changes.
- `packages/battle-fx/src/moves/restored/earthquake.js`: the original ripple is an unrotated ellipse at the source floor. Only the jagged fault, pebbles and matte dust follow the floor-to-floor ground slope. These are separate pieces of the design.
- `packages/battle-fx/src/moves/restored/thunder.js` and `thunderbolt.js`: layer warm outer strokes, a yellow body and pale hot core; combine branching electricity with a localized impact glow. Use different primary and secondary line weights, retaining the reviewed upper-ground blast.
- `packages/battle-fx/src/moves/restored/ice-beam.js` and `blizzard.js`: translucent cyan/blue-white crystalline facets and traveling winter particles. Keep the already reviewed flight-to-lodge-to-growth sequence, but spread its attachment points across the opponent and turn the grown crystals upright.

## Applied choices

Fire Blast launches 0.30 authored seconds (0.40 elapsed seconds at the reviewed 75% pace) earlier. Its longer flight still reaches the original sound beat, and the approved five-arm flame aftermath stays intact.

Earthquake removes the diagonal shear from the ripples. Its fault and debris continue along the actual ground route, with their matte brown material and extended aftershock rhythm intact.

Thunder increases the second impact's fitted area, glow intensity and bolt-weight contrast while keeping every new stroke, glow and spark above the target's feet. Bright primary trunks and finer offshoots provide readable electrical structure.

Blizzard assigns seven separate body locations. Small incoming crystals lodge there, grow into vertical shards and shatter on the existing beats; the target remains visible through the translucent material.
