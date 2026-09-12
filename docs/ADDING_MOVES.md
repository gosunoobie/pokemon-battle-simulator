# Adding a move without changing existing effects

Create one recipe file at `packages/battle-fx/src/moves/restored/<move-id>.js`. Keep its visual design local: shapes, layers, particle behavior, curves, easing and recovery. Do not generalize existing moves into a new shared visual template. A local helper within a move is fine.

The context supplies `tl`, `layer`, `assets`, `glowTexture`, `random`, `onCue`, `onFrame`, source/target views and scene. `bindEffectSpace(context)` supplies a temporary local drawing container, source/target view proxies, home positions, target focus/floor, socket resolvers and contact solver. It performs coordinate mapping only. Resolve origins from anatomy, destination from the target and trajectory span from actor separation. Keep art dimensions in uniformly scaled local units; never use browser dimensions or Pokémon-specific pixel offsets.

Add the builder/contact/duration entry to `registry.js` and an id/name/tint descriptor to `catalog.js`; the independent playground can then play it. Add a separate battle-core rule and host moveDetails entry only when it should also be selectable in the game. A rule with no effect still resolves; an effect with no rule can still be previewed.

For a self effect, set the registry entry's fifth value to `'source'` (exposed as `subject: 'source'`). Runtime selects the source in both motion modes without reading rules or requiring an opponent. Use source metrics and the posed center socket for shield coverage. Independently set the core rule to `target: 'self'` when applicable; its event then identifies the user as the affected actor. The existing four shields demonstrate distinct geometry without a shared shield template.

The inactive `examples/water-gun.js` demonstrates an independent short jet and local impact, without a battle engine. It remains unregistered.

Schedule all draw updates/particles on the supplied timeline or owned `onFrame` callback. Emit an impact cue once; never apply HP or status from the recipe. Preserve shared texture ownership. Default reduced motion, skip and failure cleanup are runtime responsibilities.

For a drain effect, set the registry entry's sixth value to its recovery time (leave the fifth value undefined for an opponent target). Emit `recovery` after `impact` when the first returning particle reaches the source aura; update its live position before the callback. Runtime accepts each cue once and ignores early recovery. This only controls presentation: the core's separate `drain` rule owns healing, and the presenter reconciles the full committed result even if recovery never arrives.

Check the changed move in normal/reduced motion and after cancellation. For changes affecting the existing catalog, keep the original-frame regression passing or document the user-requested redesign explicitly. Test reverse direction, tall/wide actors and different stage proportions. Do not claim a browser visual review from numerical tests alone.

For field weather, set registry subject to `field` and draw directly with logical scene dimensions under the owned layer. Keep each move’s art and particle laws in its own file. Never use `bindEffectSpace` or actor metrics to size field weather. Core field targeting and the host badge are independent of FX; see `docs/MIGRATION.md` and the four weather recipes.
