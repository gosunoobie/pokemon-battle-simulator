# Verification

Run `npm test` from the workspace root. The integration suite uses Node's test runner, real PixiJS display objects and real paused GSAP timelines. Canvas/glow/asset inputs are supplied in tests where a browser would otherwise be required.

The migration run passed all 19 integration tests.

## Automated coverage

| Area | Evidence |
| --- | --- |
| Core outcomes | All 33 original HP fixtures, Thunder Wave paralysis, immutable transactions, arbitrary names/HP, clamping and invalid participants |
| Dependency separation | Renderer-free core imports; no rule/health authority in FX; host controls work without invoking the FX loader |
| Effects disabled | All 33 committed outcomes displayed with zero FX imports |
| Normal / reduced motion | All 33 recipes complete, one cue at expected contact, same reduced-motion timing, restored actors/camera and empty temporary layers |
| Cancellation | All 33 cancelled before/after contact and replayed without stale effects |
| Failures | Missing assets, builder/update errors, missing effects, rejected and stalled imports, cleanup/callback exceptions |
| Stale work | Skip/reset, repeated cues, ordered queue, destroy/late imports and explicit retry |
| Geometry | Melee sockets at contact for reversed/small/wide/tall/art fixtures; padding, mirroring, nested transforms and uniform resize |
| Attached effects | Mach Punch cuff after pose update; contracting Solar Beam charge ring |

Both Vue entry components are also compiled by the production build. Production Vite output includes `/` and `/playground.html`; runtime asset URLs are bundled from the FX package. Independent package archives retain exports, source and effect assets/notices. A successful package/build check does not prove appearance in the browser.

## Browser status and useful next checks

The managed preview started successfully. Navigation to its approved browser preview address failed with `ERR_BLOCKED_BY_CLIENT`; rendered visual and browser interaction checks were not performed.

When the browser is available, use the playground to inspect contact, silhouettes, effects after impact, both directions, all fixture profiles, altered sizes, logical stage proportions, and resize during playback. In the game, check effects-off, skip, replay, keyboard focus, narrow layouts and enlarged text. Confirm the Use button remains above the grid and the HP bar/condition badge reconcile correctly.

For Surf verify moderate crest coverage and moving collapse; for Waterfall inspect smooth scrolling and the moving aftermath after 2.30 s; for Hydro Pump inspect a substantial but narrow jet and attached emission. Check physical move sockets at their contact timestamps in `ANIMATION_SPEC.md`. These visual checks are a pending checklist, not completed evidence.

## Efficient future verification

A routine visual tweak needs its relevant contact/cleanup check and one build; do not repeatedly export ZIPs or reinstall dependencies. Run broad integration checks when changing shared primitives, lifecycle or package contracts. Regenerate a complete source export when a handoff is requested; `scripts/export_project.py` includes apps, packages, tests and assets and excludes dependency/build/hosting internals.

## Original-effects restoration

`tests/restoration.test.mjs` compares all 33 effects against 99 scene-graph checkpoints captured from the pre-migration source (`ab6d3c42af93b8114a4c3a8d7c205e9ba0cc1fca`). It checks visible object counts, bounds (0.03 logical-unit tolerance), opacity and inherited tint. A second test runs every move with reversed portrait layouts and independently sized tall/wide actors. Physical contact tests retain each move's original contact offset and distinguish tackle from slam sockets. All pass.

These fixtures were obtained by executing the original source; they are not recordings of the new implementation. They do not establish pixel-by-pixel screenshot parity or every-frame GPU appearance. Browser visual testing remains unperformed.


## Projectile batch verification

The 72 focused core/FX/opponent/projectile checks and production build passed. Coverage includes all 152 moves from both field positions across nine starter pairings (2,736 normal playbacks), reduced motion, cancellation/replay, effects-off outcomes, custom and legacy sockets, all projectile launches and contacts, final-only cues, Present arrival/opening, bounded low-edge fan paths, valid opacity and full actor recovery. Existing 140 recipe files and shared runtime/scene code are unchanged. Browser pixel appearance remains unverified; no fresh install or ZIP export was performed for this batch.


## Two-round preview verification

All 111 tests and the production build passed for Fly, Bounce, Dig and Dive. The existing suite covers all 156 default attacks, including both sides across nine starter pairs and the original geometry references. Five focused tests cover immutable preparation without battle-state changes, independent attack results, optional phase routing, unsupported phases, effects-off/skip/failure/stale cues, preparation without an opponent, nine starter profiles in both directions, reduced motion, cancellation during concealment, body-socket contact, owned-mask alignment and snapshot fallback. The 152 earlier recipe files and scene/sprite/platform code remain unchanged. Browser pixel appearance is unverified; no ZIP export or fresh dependency install was performed.

## Breath and flame update

The 71 core/FX/opponent/restoration integration checks and four focused checks in `tests/breath-fire.test.mjs` passed for Dragon Breath, Sacred Fire and the redesigned Overheat. All 158 moves play from both sides across the nine starter profiles, with effects-off results, reduced motion and cancellation covered. Focused checks verify live launches, visible tips at contact before cues, held firing poses, unchanged Overheat timing/damage, moving flames in every quadrant, full radial bounds, secondary spark bounds near upper/side edges and clean replay. Overheat is now deliberately excluded from the historical geometry comparison; 31 unchanged originals retain all 93 sampled frames, and the original 99-frame fixture file is untouched. Browser pixel appearance remains unverified.

The subsequent recolor/restoration revision checks Dragon Breath against Flamethrower under a palette mapping at matching playback steps in both directions and tall/wide layouts. Overheat is restored to the original geometry comparison (32 moves / 96 frames). Sacred Fire retains its focused socket/spark checks.

## Retaliation and HP-adjustment previews

All 123 tests passed for the 164-move catalog. Five focused tests cover eligible/wrong/missing prior hits, retaliation overkill, Pain Split rounding and unequal maximum-HP caps, equal HP, Endeavor failure, immutable unrelated fields, fainted custom fixtures, both HP panels at one cue, effects-off/skip/failure/stale callbacks, semantic contact, both directions, complete actor/effect bounds and cancellation. The full suite also retains all 96 original geometry reference frames, all nine starter profiles, reduced motion and the two-round/weather contracts. Browser pixel appearance remains unverified.

## Disruption and provocation previews

All 127 tests passed for the 172-move catalog, and the production build passed. Four focused tests cover validated restriction badges, unchanged HP/major conditions, source-only Imprison, Swagger/Flatter partial successes and total failure, Fake Tears caps, effects-off/skip/failure/reset, contact-before-cue, both directions, custom sockets, complete-art bounds and cleanup. The existing full suite also checks all nine starter profiles, normal/reduced motion and the 96 original reference frames. An independent review sampled 11,272 visible-art bounds without finding an overflow. Browser pixel appearance remains unverified.

## Music, affection, healing and defenses

The full 134-test suite passed for the 198-move catalog. Seven focused tests cover direct/weather rounding, healing caps, Belly Drum success/failure, awake Snore, nullable and identical-item Trick exchanges, status/stat caps, Wish without instant healing, living-only Perish Song, effects-off/skip/failure/reset, fainted fixtures, contact-before-cue, source-only playback, both perspectives and complete effect bounds. After keeping Sing's note glyphs readable under reversal, the seven focused tests passed again, including the new orientation assertion. An independent review also checked 156 direction/edge playbacks and 36 source/field runs with no opponent. Production builds passed. The 96 original reference frames, all nine starter profiles and prior recipes remain intact. Browser pixel appearance remains unverified.

## Repeated strikes, wing, tail and body additions

The full 139-test suite passed for the 209-move catalog, followed by a successful production build of both game and standalone playground. Five new focused tests check Facade condition eligibility, Smelling Salts ordinary/boosted damage and surviving-only cure, immutable outcomes, three-actor fixture routing, optional FX reconciliation and stale reset callbacks. Real PixiJS objects and paused GSAP timelines verify all individual strike contacts before the final-only cue, full actor scale/opacity, cancellation and complete rotated actor/effect bounds near top and side edges in both directions. Generic coverage includes all nine starter profiles, reduced motion, portrait layouts and the unchanged 96 original reference frames. Independent read-only reviews checked metadata, core boundaries and additional edge sweeps. No prior move recipe was edited, including Wing Attack. Browser pixel appearance remains unverified.

## Hidden Power, Zap Cannon, Weather Ball and Mist Ball

The full 143-test suite and production build passed for the 213-move catalog. Four focused tests cover Zap Cannon's surviving/clear-status paralysis eligibility, ordinary damage with occupied status or KO, immutable results and optional presentation exits. Real PixiJS/GSAP checks verify six individual Hidden Power launches and contacts, final-only cues, live emission attachment, drifting mist/wakes after impact, cancellation and full actor/effect bounds in both directions. The edge matrix includes a target touching the upper edge with its semantic aim point at 4% of its height. An independent review identified a Weather Ball arc-start mismatch; it was corrected and the exact extreme-edge case passed before the final suite. All nine starter profiles, reduced motion and the 96 unchanged original reference frames pass. Existing Shadow Ball and all prior effect source files were left unchanged. Browser pixel appearance remains unverified.


## Utility, sound, targeting and copying additions

All 150 tests and the production build passed for the 245-move catalog. Seven focused tests cover Substitute cost/failure, Recycle eligibility, all seven Psych Up stages and Focus Energy, sports coexisting with weather, Spikes caps, targeting badges, stat floors, fixed damage, confusion and casting-only behavior. All 32 fixtures reconcile identically with effects off, after impact, skip, failure and reset; fainted actors remain fainted. Real PixiJS/GSAP timelines verify outward contacts, inward copy/scent endpoints, both Skill Swap arrivals, source-only clips, full actor/effect bounds, Teleport opacity and cancellation. The four edge fixtures run in both directions and begin with complete sprite silhouettes inside the field. All nine starter profiles, reduced motion and 96 unchanged original reference frames pass. An independent review also compared 426 previous-move transactions and checked 128 utility rule edge cases. Browser pixel appearance remains unverified.


## Water and energy additions / Hydro Pump rework

All 154 tests and the production build passed for 251 moves. Four focused tests verify fixed outcomes with existing statuses/items/stages, live launch and contact sockets, single cues, contact effects following recoil, firing-pose holds, continuous late Hydro Pump spray, traveling cutoff, viewport fit, cancellation and complete actor/effect bounds. Bounds include both directions, wide/tall users, upper/side target sockets and a 560×700 portrait layout with valid in-field starting silhouettes. A separate review exercised 140 geometry/playback cases and confirmed that every impact changes its drawn geometry after contact. Aeroblast and Luster Purge impact centers were corrected to follow recoil; Water Gun, Hydro Pump and Hyper Beam front artwork was aligned to the contact point. All nine starter profiles and reduced motion pass. Hydro Pump is intentionally excluded from the old geometry snapshot because the user requested its redesign; 31 unchanged recipes still match 93 reference frames. Browser pixel appearance remains unverified.
