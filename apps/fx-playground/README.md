# FX playground

The playground is an independent visual and sound audition tool. It uses all 335
entries from `@battle/battle-fx/catalog`, the same reviewed FX/pacing adapter as
the battle hosts, and the existing sprite scene. It does not import battle-core,
resolve moves, or use the battle presenter.

The move library searches names, IDs and move numbers. Filters show compatible
sound mappings or the four moves with separate preparation/attack clips. Filtering
never changes the selected move. Playback supports replay, Stop, Space outside
form controls, seeded variations, and an optional repeat gap. Changing a playback
setting or the scene cancels the current audition; hidden tabs stop without
restarting on return.

`audio.js` composes the existing audio player and move/impact adapters. Reviewed
sound plans take precedence over the original pilot and technical draft plans,
preserving native recording speed, accepted regions/accents and authored gains.
Preparation and reduced motion omit move recordings; optional impact feedback is
an explicit cosmetic selection. Legacy pilot recordings still require their
compatible decoder. Nature Power and Mirror Move have no move recording. Cry
buttons audition the selected species/form; geometric fixtures have no cry.

Sound settings are local to the playground and do not overwrite player settings.
Audio unlocks within Play, cry audition or the Sound toggle. Sound loading has a
350 ms grace period before visual playback, and missing sounds never delay or
retry an already-started effect. Stop can cancel natural audio tails after visual
completion. Each replay/loop owns its audio and FX callbacks.

The scene retains stable source/target field identities, native sprite views,
existing scale minimums, fixed platforms and the original playground coordinates.
Changing the move user does not move sprites. Stale scene loads dispose their own
resources. Both the scene owner and playback/audio controllers clean up on exit.

Checks: `node --test tests/fx-playground-audio.test.mjs tests/playground-playback.test.mjs`.
Run the workspace suite and production build after integration changes. Browser
checks cover desktop/mobile layout, search, replay/Stop, loops, prepare/attack,
opponent moves, cry audition and scene changes during playback.
