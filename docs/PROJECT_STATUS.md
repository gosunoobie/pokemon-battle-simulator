# Project status

## Implemented in the workspace migration

- All 33 existing moves have rules, FX recipes, catalog entries and game selector entries, including Quick Attack, Mach Punch, Extreme Speed and Body Slam.
- Pure battle-core package and standalone battle-fx package with explicit exports, assets and independent manifests.
- Committed/displayed state separation, presentation queue, lazy FX, effects-off, skip, fallback deadlines, stale-callback guards and cleanup.
- Semantic actor anchors, visible-art metrics, pose layers, uniform camera scaling and optional snapshots.
- Independent FX playground with all moves, alternate actor shapes, size controls, reversed sides, wide/square/portrait stages and reduced motion.
- Existing controls remain above the moveset grid. Existing fixed damage, paralysis preview and focused Water/physical designs are retained in the migrated recipes.
- Export tooling and project guides use the workspace paths.

The code migration is complete. See `VERIFICATION.md` for checked behavior. Production publication is a separate hosting operation; the final task response records its result.

## Remaining limits

This remains a showcase ruleset, not a complete battle simulator. The default game view still chooses Charizard/Venusaur; the FX package does not. Current effects support a single source and first target, with no miss-specific choreography. PixiJS/GSAP are the FX rendering dependencies. Package archives can be produced locally, but no public npm release is made by this migration.

Browser visual verification is pending: the managed preview started, but browser navigation was rejected with `ERR_BLOCKED_BY_CLIENT`. The successful automated checks cover state, lifecycle and geometry, not pixel appearance, accessibility interaction or subjective visual parity. No new source ZIP is claimed unless an explicit export is subsequently made.

## Restoration update

All 33 pre-migration effects are restored with dynamic coordinates and their own move-specific implementations. Generic visual helpers have been removed. Nineteen tests pass, including 99 original-frame geometry comparisons and alternate-actor/reversed-layout playback. Existing battle-core, presenter, game controls and playground remain. The previously delivered ZIP is a prior snapshot; this iteration updates source and the live demo.


## Projectile additions

Added Bullet Seed, Pin Missile, Spike Cannon, Icicle Spear, Poison Sting, Twineedle, Swift, Pay Day, Rock Throw, Egg Bomb, Barrage and Present: 152 moves total. All are available from either side, with independent art, dynamic socket placement and fixed preview outcomes. Present shows its damaging outcome only. Existing move recipes, shared runtime, sprite layout and UI are unchanged. This update does not refresh the source ZIP.


## Separate preparation and attack previews

Fly, Bounce, Dig and Dive bring the catalog to 156 moves, with eight independently authored new clips. Round controls are available above the move grid and in the FX playground. Preparation leaves the battle snapshot unchanged; attack uses the ordinary damage resolver. Both clips restore poses independently, with no turn engine or retained hidden state. Existing animation files, sprite selection/sizing and platforms are unchanged. All 111 checks and the production build passed; browser appearance remains unverified.

## Dragon Breath, Sacred Fire and Overheat

Dragon Breath and Sacred Fire bring the catalog to 158 moves. Overheat now has layered flames erupting in every direction with a bounded source burst and compact target flare; its timing and damage are unchanged. These three recipes own their artwork and particle motion. The other 155 recipes, shared FX/scene code, sprite sizing and platforms are unchanged. The 71 integration checks and four focused contact/bounds checks passed. Browser appearance remains unverified; this iteration does not refresh the source ZIP.

The subsequent requested revision replaces Dragon Breath with a violet recolor of Flamethrower and restores original Overheat. Sacred Fire is unchanged; the current animation specification describes the active effects.

Psybeam and Signal Beam bring the catalog to 160 moves. Aurora Beam was already present and retains its animation. Both new recipes have independent artwork, dynamic endpoints, compact bounds and normal/reduced-motion cleanup from either side. Sacred Fire's subsequent refinement is recorded in the animation specification. No source ZIP refresh is included in this iteration.

Counter, Mirror Coat, Pain Split and Endeavor bring the catalog to 164 moves. Their independent effects accompany stateless core HP rules and labeled host sample fixtures. Both Pain Split HP changes commit together; retaliation depends on a caller-supplied prior hit, with no history or turn engine. The existing presenter, FX runtime, prior recipes, sprite sizing and platforms are unchanged. No source ZIP refresh is included in this iteration.

Disable, Encore, Torment, Imprison, Taunt, Swagger, Flatter and Fake Tears bring the catalog to 172 moves. Each has independent, dynamically fitted art for either side. Five illustrative restriction badges require no turn engine; Swagger/Flatter show their target boosts and confusion, and Fake Tears lowers Special Defense. All preserve HP. Existing recipes and the scene layout remain unchanged. No source ZIP refresh is included in this iteration.

The 26 additions from Sing through Endure bring the catalog to 198 moves. Every addition has its own art and timeline for either perspective, including 17 self moves and one field move. Direct/weather healing, Belly Drum and Trick resolve before optional FX; Wish, Perish Song and unsupported protection/infatuation mechanics remain explicit previews. Source sizes, ground platforms, existing recipes and the shared FX runtime remain unchanged. No source ZIP refresh is included in this iteration.

The eleven additions from Double Slap through Smelling Salts bring the catalog to 209 moves. The requested Wing Attack was already present and remains unchanged. Repeated strikes, metallic wings, distinct tail sweeps and body attacks each have independent art and timelines for both perspectives. Facade and Smelling Salts use labeled conditional-damage samples; Smelling Salts cures a surviving target after damage. All 139 tests and the production build passed. The previous 198 recipes, sprite sizing, platforms and shared FX runtime are unchanged. No source ZIP refresh is included in this iteration; browser pixel appearance remains unverified.

Hidden Power, Zap Cannon, Weather Ball and Mist Ball bring the catalog to 213 moves. Shadow Ball was already present and remains unchanged. All four additions own independent artwork and timelines for either side; Hidden Power and Weather Ball are explicitly labeled fixed samples. Zap Cannon commits damage and eligible paralysis together before optional FX. The 143-test suite and both-page production build passed. All previous effects, sprite sizing, platforms and the shared FX runtime remain unchanged. No source ZIP refresh was requested; browser pixel appearance remains unverified.


The 32 utility, sound, targeting and copying additions bring the catalog to 245. Taunt, Swagger, Flatter and Fake Tears were already present and remain unchanged. All new effects work from either side with dynamic sockets and full pose cleanup; source/field clips also work alone. Core handles bounded Substitute, Recycle, Psych Up, stat, confusion and badge previews independently of optional FX. Switching, random called attacks and ability/turn systems remain outside scope. The 150-test suite and both-page production build passed. Existing effect sources, sprite sizing, platforms and shared runtime were unchanged. Browser pixel appearance remains unverified; no source ZIP refresh was requested.


Water Gun, Hydro Cannon, Spit Up, Hyper Beam, Aeroblast and Luster Purge bring the catalog to 251. Hydro Pump was explicitly reworked with a sustained pressure body, live target tracking and continuous bounded spray, retaining its damage and total timing. All other existing recipes remain unchanged. The 154-test suite and both-page production build passed. Spit Up is a labeled one-stockpile sample; no stockpile, recharge or new secondary-effect engine was added. Browser pixel appearance remains unverified.
