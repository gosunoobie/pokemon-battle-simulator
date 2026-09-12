# Animation specification

The 251 moves use semantic actor anchors for actor effects and logical scene dimensions for field weather. Weather geometry is independent of actor size and position. This replaces the old Charizard/Venusaur pixel-offset specification. Exact drawing constants are maintained in each move file; the table records the public contact/duration contract and retained outcome fixtures.

## Move inventory

Times are seconds from the start of the normal-motion timeline, after any required asset load. They are source values, not measured video. HP assumes the game preview's initial target HP of 160. Palette is the catalog's representative tint; each recipe layers additional material colors.

| Move | First impact | Duration | Final preview HP | Tint | Intended appearance |
| --- | --- | --- | --- | --- | --- |
| Slash | 0.43 | 1.45 | 120 | #e9f4df | A quick lunge and three sharp claw strikes. |
| Flamethrower | 0.90 | 2.65 | 96 | #ff842e | A sustained stream of fire washes over the target. |
| Wing Attack | 0.55 | 1.70 | 108 | #9fe8ff | A rising swoop, a wing strike, and a rush of air. |
| Fire Blast | 1.07 | 2.50 | 78 | #ff6b23 | A charged fireball erupts into a five-point blast. |
| Razor Leaf | 0.75 | 2.15 | 124 | #c6f38c | A sweeping volley of sharp, spinning leaves. |
| Solar Beam | 1.26 | 2.90 | 82 | #eafa9b | Gather sunlight, then release a brilliant beam. |
| Vine Whip | 0.67 | 1.90 | 128 | #b2ee91 | Two curling vines snap forward and whip the target. |
| Sludge Bomb | 1.02 | 2.25 | 100 | #d59aef | A heavy glob of sludge arcs into a violet splash. |
| Overheat | 0.98 | 2.50 | 68 | #ff8b4b | Build intense heat, then release a broad fiery surge. |
| Blaze Kick | 0.60 | 1.80 | 102 | #ffba55 | Leap into a flaming kick with a sweeping fire arc. |
| Eruption | 1.11 | 2.85 | 64 | #ffae49 | Launch a volcanic volley of arcing fireballs. |
| Blast Burn | 1.02 | 3.05 | 56 | #ffcc77 | Send a fiery fissure into a towering ground blast. |
| Earthquake | 0.66 | 2.10 | 88 | #dcc28b | A heavy stomp sends ripples and tremors through the ground. |
| Rock Slide | 0.87 | 2.35 | 106 | #d0bf9b | Falling boulders shatter into fragments and clouds of dust. |
| Thunder Wave | 0.76 | 1.85 | 160 + paralysis | #ffe58e | Electric rings surround the target and leave it paralyzed. |
| Thunder Shock | 0.46 | 1.30 | 132 | #ffdf70 | A quick, narrow jolt of electricity sparks on impact. |
| Thunderbolt | 0.52 | 2.00 | 98 | #ffe88a | A thick branching discharge crackles around the target. |
| Thunder | 0.84 | 2.45 | 76 | #ffefb1 | A heavy lightning strike descends from above. |
| Blizzard | 0.82 | 2.65 | 74 | #c9f1ff | A sweeping snowstorm rushes across the battlefield. |
| Ice Punch | 0.50 | 1.70 | 110 | #bbeeff | An icy close-range strike bursts into crystal fragments. |
| Aurora Beam | 0.70 | 2.30 | 106 | #ded0ff | Five ribbons of colored light weave into a shimmering beam. |
| Ice Beam | 0.68 | 2.40 | 92 | #b2edff | A straight blue-white beam forms a bursting crystal bloom. |
| Psychic | 0.95 | 2.15 | 88 | #f6a4e6 | A pulsing psychic aura lifts and releases the target. |
| Shadow Ball | 1.10 | 2.35 | 102 | #b599e6 | A dark orb trails smoky wisps and bursts on impact. |
| Bubble | 1.02 | 2.45 | 136 | #b5f0ff | Large shimmering bubbles drift toward the target and pop. |
| Bubble Beam | 0.78 | 2.30 | 116 | #9de5ff | A fast, tightly woven stream of bubbles bursts on contact. |
| Hydro Pump | 0.72 | 2.80 | 88 | #8edbff | A concentrated pressure jet sustains fast foam and a churning splash crown. |
| Surf | 1.12 | 3.20 | 94 | #a8e8f5 | A towering pixel-art tidal wave rolls over the target in a rush of white foam. |
| Waterfall | 0.78 | 3.15 | 104 | #bcefff | A flowing cascade strikes the target, breaking into churning foam and spreading ripples. |
| Quick Attack | 0.30 | 1.20 | 128 | #e2f1f7 | A short, sudden dash lands a sharp body strike. |
| Mach Punch | 0.38 | 1.35 | 132 | #ffce94 | A lightning-fast jab drives a compact impact through the target. |
| Extreme Speed | 0.32 | 1.40 | 102 | #d7f4ff | A near-instant rush leaves fading afterimages and a sharp pressure ring. |
| Body Slam | 0.82 | 1.85 | 98 | #f2d9ad | Leap onto the target with a heavy landing, a ground shockwave, and dust. |
| Poison Powder | 0.90 | 2.45 | 160 + poison | #c888e9 | Curling violet grains and seven translucent rolling puffs. |
| Sleep Powder | 1.02 | 2.60 | 160 + sleep | #b9efd7 | A lifted mint veil rains down, with a gentle nod and rising sleep marks. |
| Stun Spore | 0.74 | 2.20 | 160 + paralysis | #eac657 | Three amber spore puffs scatter into six brief surface crackles. |
| Bite | 0.44 | 1.25 | 118 | #cdbedb | A quick jaw snap and compact ivory impact flecks. |
| Crunch | 0.64 | 1.80 | 100 | #b39ac7 | Heavy jaws clamp and squeeze amid dark pressure cracks and shards. |
| Hyper Fang | 0.38 | 1.30 | 102 | #ffdfa1 | A fast pounce and two long diagonal fangs with a sharp flash. |
| Poison Fang | 0.58 | 2.05 | 124 | #d1a1eb | Curved fangs strike, leaving draining violet venom and droplets. |
| Smog | 0.84 | 2.20 | 138 | #b497b9 | Heavy violet exhaust rolls forward, then sinks and sheds soot. |
| Poison Gas | 0.98 | 2.75 | 160 + poison | #c29bdb | Thin violet/olive vapor curls into a circulating veil. |
| Smokescreen | 0.64 | 2.10 | 160 + accuracy −1 | #abb2b7 | A compact smoke shot blooms into charcoal billows that peel apart and rise. |
| Toxic | 0.86 | 2.35 | 160 + bad poison | #d77de0 | Concentrated venom arcs into three bubbling magenta pulses. |
| Barrier | 0.70 | 2.30 | 160; user Defense +2 | #b1ccff | Blue facets rise and lock into a barrier with two upward chevrons. |
| Protect | 0.50 | 2.10 | 160; user protected | #8bffd4 | A green dome snaps into place, with rim motes and expanding ripples. |
| Light Screen | 0.70 | 2.30 | 160; own-side screen | #ffe9aa | Golden glass rises with traveling bands of light and corner glints. |
| Reflect | 0.72 | 2.40 | 160; own-side screen | #f9c9ed | Three pink mirror panels unfold with silver sheen and diamond ripples. |
| Rapid Spin | 0.72 | 1.55 | 126 | #d6eeeb | A fast twirl with three sweeping wind trails and a sharp body strike. |
| Rollout | 0.88 | 2.10 | 128 | #d4bb91 | A tucked, rumbling roll with a rocky rim, dust and a low impact ripple. |
| Ice Ball | 1.04 | 2.25 | 124 | #c8f4ff | A rolling ice shell bounces twice and shatters into crystals. |
| Flame Wheel | 0.86 | 2.05 | 112 | #ffb451 | A rolling fire ring with curling flames, trailing embers and a compact hit. |
| Karate Chop | 0.52 | 1.40 | 124 | #f4d4ac | A quick knife-hand chop with a downward gold trail and narrow flash. |
| Brick Break | 0.68 | 1.75 | 106 | #e5bb8a | A raised hand drives through a panel that splits and falls apart. |
| Cross Chop | 0.76 | 1.85 | 90 | #f7bb91 | Two crossing strikes converge with diagonal sparks and an X-shaped impact. |
| Rock Smash | 0.70 | 1.95 | 130 | #d7bd92 | A fist strikes a faceted rocky impact, breaking it into chunks and dust. |
| Peck | 0.36 | 1.10 | 132 | #f2dda8 | A small golden beak snaps shut with a quick jab and sharp flecks. |
| Horn Attack | 0.58 | 1.50 | 114 | #e6d7af | An ivory horn thrusts forward with short air trails and a compact impact ring. |
| Drill Peck | 0.76 | 1.90 | 102 | #bdefff | A tapered beak spins with winding cyan bands and spiral air trails. |
| Megahorn | 0.88 | 2.10 | 76 | #c6e68b | A charged green horn drives forward with heavy recoil and lime splinters. |
| Cut | 0.50 | 1.35 | 124 | #e1edf0 | One sharp silver blade sweep with a narrow diagonal cut. |
| Fury Cutter | 0.60 | 1.55 | 130 | #d8e7a1 | A hooked green blade cuts upward with two close motion echoes. |
| Leaf Blade | 0.82 | 1.95 | 98 | #bce580 | A broad veined leaf swings through a green fan and leaf fragments. |
| Air Cutter | 0.82 | 1.70 | 118 | #c9edf7 | Two compact wind crescents follow opposing curved routes to the target. |
| Ember | 0.70 | 1.70 | 132 | #ffbd71 | Five small fire pellets with separate trails and brief sparks. |
| Dragon Rage | 1.00 | 2.05 | 120 | #c8a9eb | A charged violet dragon-fire flare with a jagged tail and compact blast. |
| Will-O-Wisp | 1.10 | 2.50 | 160 | #b9b8f1 | Three ghostly flames drift into the target and orbit upward; burn preview. |
| Tri Attack | 1.06 | 2.00 | 102 | #ffedba | Three elemental orbs spiral from a triangle into one mixed impact. |
| Whirlpool | 0.76 | 2.55 | 132 | #a6e8f4 | A translucent water funnel with rotating bands and flowing foam. |
| Fire Spin | 0.76 | 2.75 | 130 | #ffbf79 | A small flame ignites two rising fire helices and drifting embers. |
| Sand Tomb | 0.70 | 2.50 | 132 | #e4cc98 | Inward sand spirals, falling grains, low dust and a shallow sink. |
| Whirlwind | 0.84 | 2.25 | 160 | #d5e9e9 | A traveling wind funnel lifts and pushes the opponent; no HP damage. |
| Absorb | 0.40 | 1.80 | 142; user +9 | #bce5a3 | Eight small green motes draw energy into a soft receiving ring. |
| Mega Drain | 0.52 | 2.35 | 126; user +17 | #c1e880 | Larger energy beads follow two wavering tethers into a pulsing aura. |
| Giga Drain | 0.68 | 2.75 | 104; user +28 | #b3eb7a | A contracting floral aura releases three interwoven streams of leaf-shaped energy. |
| Leech Life | 0.52 | 2.25 | 106; user +27 | #e7bdc2 | Hooked mandibles snap, then rosy energy returns along a thin thread. |
| Refresh | 0.68 | 2.00 | 160; user cured | #a9f5e1 | Three cleansing rings rise through eighteen mint sparkles. |
| Heal Bell | 0.72 | 2.50 | 160; user cured | #ffe6a3 | A swinging golden bell sends three sound waves and six drifting notes. |
| Aromatherapy | 0.90 | 2.70 | 160; user cured | #cce8bd | Twelve herbs spiral through three fragrant wisps and ten petals. |
| Rest | 0.82 | 2.80 | 160; user 156 + sleep | #c9d3f1 | A gentle settling motion, breathing halo, moon and rising sleep marks. |
| Meditate | 0.70 | 2.10 | 160; user Attack +1 | #f1b9d7 | A steady rose aura, lotus-like petals and eight orbiting diamonds. |
| Calm Mind | 0.90 | 2.40 | 160; user Sp. Atk/Sp. Def +1 | #cbbff0 | Three slow lavender ripples and two orbiting lights. |
| Amnesia | 0.84 | 2.65 | 160; user Sp. Def +2 | #e9d5f4 | A question fades from a thought cloud that dissolves into empty bubbles. |
| Focus Energy | 0.62 | 2.00 | 160; user focused | #ffdd9a | Inward streaks converge on a sharp glint and golden outline. |
| Bulk Up | 0.66 | 2.10 | 160; user Attack/Defense +1 | #efb887 | A firm brace, rising energy columns and warm solid aura. |
| Howl | 0.50 | 2.20 | 160; user Attack +1 | #ffe4b6 | A backward lean and four expanding sound arcs from the mouth. |
| Swords Dance | 0.95 | 2.45 | 160; user Attack +2 | #dbe9ef | Four silver swords orbit with bright edges and fine trails. |
| Dragon Dance | 0.92 | 2.65 | 160; user Attack/Speed +1 | #b8d8ed | A twisting step with two winding ribbons and flowing scale motes. |
| Agility | 0.62 | 1.60 | 160; user Speed +2 | #d5eaf7 | Three quick sidesteps, nine speed streaks and a floor flash. |
| Double Team | 0.72 | 2.00 | 160; user Evasion +1 | #c4dbef | Four translucent actor copies separate and merge back. |
| Minimize | 0.70 | 2.15 | 160; user Evasion +2 | #e7cef5 | A small shrinking dodge, inward marks and orbiting glints. |
| Acid Armor | 0.76 | 2.50 | 160; user Defense +2 | #cbbded | A liquid coat, sliding highlights and pooling droplets. |
| Rage | 0.62 | 1.65 | 136 | #f2aa87 | A tense body charge with red pressure marks and warm impact sparks. |
| Thrash | 0.54 | 2.40 | 82 | #eadbb9 | Three uneven body strikes with alternating sweeps and low dust. |
| Outrage | 0.86 | 2.15 | 78 | #bca1f4 | A heavy rush wrapped in flowing dragon-energy ribbons and scales. |
| Struggle | 0.70 | 1.95 | 124; user 117 | #e8caa6 | An awkward tackle, backward bounce and small recoil flash. |
| Leer | 0.64 | 1.75 | 160; opponent Defense −1 | #e6ba86 | A narrow eye flash and three sharp pressure ripples. |
| Scary Face | 0.80 | 2.10 | 160; opponent Speed −2 | #dfb7de | A looming face with a moving jaw and shivering fear marks. |
| Glare | 0.72 | 2.20 | 160 + paralysis | #ffdc8b | A slit-eyed gaze followed by tight flickering arcs. |
| Mean Look | 0.90 | 2.40 | 160; trapped preview | #d6adeb | A watchful eye, closing brackets and flowing floor arcs. |
| Scratch | 0.38 | 1.18 | 132 | #efe5ce | A quick light rake with three fine marks and short flecks. |
| Metal Claw | 0.64 | 1.75 | 126 | #c4dae7 | Polished steel claws, a reflective glint and contact sparks. |
| Dragon Claw | 0.82 | 2.05 | 102 | #bca8ed | Charged energy talons, a rising rake and scattering fragments. |
| Tackle | 0.40 | 1.15 | 132 | #e9dfc8 | A quick body check, pressure arc and light dust. |
| Return | 0.78 | 1.85 | 88 | #f3d4ae | Small hearts, a bounding strike and warm star-shaped sparks. |
| Take Down | 0.66 | 1.90 | 96; user 140 | #e7d3ad | A committed charge, dusty impact and backward rebound. |
| Double-Edge | 0.74 | 2.15 | 76; user 128 | #f1d1b9 | A reckless rush, opposing impact crescents and heavy rebound. |
| Slam | 0.74 | 1.85 | 104 | #ebd5b2 | A broad blunt sweep and downward pressure impact. |
| Stomp | 0.66 | 1.65 | 114 | #e8d8b8 | A short foot lift, downward strike and compact dust burst. |
| Strength | 0.72 | 1.95 | 102 | #e8cea5 | A braced body shove that keeps both actors in contact. |
| Mega Punch | 0.56 | 1.65 | 104 | #edd6b3 | A heavy fist, short wake, blunt ring and chips. |
| Meteor Mash | 0.78 | 1.95 | 96 | #c6dfed | A steel fist, comet trail and scattering stars. |
| Dynamic Punch | 0.70 | 2.35 | 90 + confusion | #efcaa5 | An explosive fist, amber fragments and orbiting dizzy stars. |
| Focus Punch | 1.34 | 2.55 | 60 | #f0d8b4 | A held charge, inward rays and concentrated punch. |
| Rock Blast | 0.72 | 1.85 | 106 | #ddc59f | Three quick jagged rocks, chips and impact rings. |
| Ancient Power | 1.34 | 2.40 | 116 | #d6c7ab | Five levitating stones, runes and charged trails. |
| Rock Tomb | 0.70 | 2.30 | 118; opponent Speed −1 | #d8c29f | Four falling boulders close inward and crumble. |
| Confusion | 0.66 | 1.55 | 126 | #e7b5dd | A compact psychic squeeze, pulse and pink fragments. |
| Hypnosis | 0.92 | 2.55 | 160 + sleep | #d6bbef | Five drifting rings, closed eyes and rising sleep marks. |
| Confuse Ray | 0.98 | 2.35 | 160 + confusion | #e5c6a2 | A wavering golden ray and moving spirals. |
| Explosion | 1.10 | 2.50 | 36; user 0 | #f6d0a1 | A charged source blast, pressure rings, debris and smoke. |
| Self-Destruct | 0.84 | 1.85 | 60; user 0 | #ecc5a0 | A sudden tight burst, fast pressure wave and dust. |

| Vital Throw | 1.08 | 1.90 | 112 | #e9c6a2 | A grip, forceful flip and compact landing dust. |
| Submission | 1.12 | 2.20 | 104; user 142 | #dfbda1 | A grappling tumble, ground impact and recoil. |
| Sky Uppercut | 0.62 | 1.95 | 100 | #ebd5b5 | A rising fist, narrow wind sweep and upward flecks. |
| Seismic Toss | 1.50 | 2.45 | 110 at user level 50 | #e8c7a0 | A high throw, falling streaks and a ground shock. |

Reduced motion bypasses normal recipes: one subdued target glow, impact cue at 0.20 s, completion at 0.80 s, no projectile travel, pose lunge or shake. Drain moves add a source aura and recovery cue at 0.45 s. The presenter displays the same committed result. All cues are cosmetic; only battle-core owns HP, conditions and accuracy stages. Status moves inflict no immediate preview damage. Immunities, poison ticks, sleep duration, accuracy rolls and paralysis turn effects are not simulated.

## Restored choreography and dynamic coordinates

The original 33 recipes were restored from commit `ab6d3c42af93b8114a4c3a8d7c205e9ba0cc1fca`. Each lives in its own `packages/battle-fx/src/moves/restored/<move-id>.js` and owns its shapes, layers, particle laws, easing, timings, cues and recovery. The generic visual primitives introduced during migration have been removed.

`effect-space.js` supplies only coordinate and actor-view bindings. The local origin is the source's registration anchor. Its X axis points toward the opponent; its Y axis remains downward. A uniform unit is bounded by stage scale and target visible height (nominal reference height 168.90625). This preserves artwork proportions while adapting coverage. Base/currents sockets map through visible bounds, mirroring, pivot, rotation and scale; the host's viewport fit adds uniform letterboxing.

Artwork dimensions and timing constants remain authored design values. Absolute source/target/window coordinates do not: target positions use center/floor sockets, attached effects use source anatomy, intermediate routes use actor separation, and physical contacts solve the appropriate hand/foot/tackle/slam socket. Default profile metadata reproduces the original sprite sizes and registration pivots. Generic actors need no Pokémon texture.

## Visual details restored

- Flamethrower: the original emitter ramps to 180 particles/s, preserves lifetime, velocity, widening, fade and ember distributions. Its range adapts to actor separation and its origin follows emission. The fixed 76-flight substitute is removed.
- Fire Blast: three-layer growing orb, original five-ray geometry, expanding ring and large burst. Original glows and their fade timing remain.
- Wing Attack: original swoop, three afterimages and three broad wind arcs. Slash preserves its original three curved claw strokes. Physical moves retain their own cuffs, flashes, dust, afterimages and squash/stretch.
- Solar Beam: original three-layer charge, 18 inward motes, contracting ring and additive beam. Razor Leaf restores original leaf sizes, signed lane bows, spin and width oscillation. Other Fire/Grass/Ground/Electric/Ice/Psychic/Ghost moves retain their original independent recipes rather than sharing a new visual template.
- Bubble: nine growing bubbles, signed curved lanes and original easing. Bubble Beam: 24 growing bubbles, original two thread strokes and timed pops.
- Hydro Pump: explicitly reworked with four dense bands, seven moving collars, twenty-two foam streaks, a live impact crown, fifty-six staggered spray droplets and a traveling cutoff; see the water and energy additions below.
- Surf: leading crest starts at 432×144 and grows to 432×216; following swell starts at 336×108 and grows to 336×168. The leading crest collapses from 1.44–2.18 s; following collapse is 1.70–2.35 s. Its blue tint, five-color wash, thirty moving streaks and 68 varied block-foam pieces return. Dimensions are local art units scaled by the coordinate frame, not window pixels.
- Waterfall: smooth 210-unit curtain, separate scrolling highlights, nested dark-to-white turbulent pool, ten moving foam strokes, seven double-line ripple rings, eighteen initial contact droplets and five ten-drop ground bursts. Stream drains by 2.30 s while the aftermath keeps moving through its original fades. The curtain uses two cropped regular sprites with the original repeating texture coordinates. It does not use a scene mask or TilingSprite; reveal and drainage stay confined to water geometry, and temporary crop textures are released without destroying shared artwork.

## Fidelity evidence

`tests/fixtures/original-effects.json` records 99 sampled frames captured by executing the pre-migration source with a fixed visual seed. The regression compares the 32 unchanged recipes' object count, bounds, opacity and inherited tint at three checkpoints, with 0.03 logical-unit rounding tolerance. Waterfall's crop replacement changes its internal object bounds; `tests/waterfall.test.mjs` separately checks original reveal/drain coverage, repeating texture samples, actor visibility, replay, cancellation and texture ownership in both directions. Overheat is restored and included in these comparisons; the original fixture remains unchanged. These are numerical checks, not screenshot/pixel-diff claims; they do not measure GPU rasterization.

Additional integration checks cover all moves with reversed portrait layouts and alternate actor proportions, semantic physical contacts, reduced motion, failures, cancellation and cleanup. Browser visual testing remains unperformed. See `VERIFICATION.md` for the complete scope.

## Powder move design

Each new recipe owns its particle paths and local reaction. Their emission follows the posed source socket; their envelope derives from the target's visible dimensions, capped in local art units. No new textures or shared visual recipe were added. Their particles use timeline age, so motion continues after arrival and cancels with the runtime.

- Poison Powder: 72 violet grains launch at 0.24 s with 9 ms staggering and 0.66–0.732 s curved travel. Seven low-opacity puffs roll through the route and keep circulating around the target. Grains drift and fade for 0.64 s after arrival; two restrained violet tints communicate contact. Target envelope: 90–178 wide and 74–142 high before uniform scene scaling.
- Sleep Powder: 60 mint motes lift above the route, reach the target's upper body, then fall for 0.8 s. Four faint wisps accompany the falling veil. Three small sleep marks rise between 1.16–2.32 s, while the target nods and returns by 2.30 s. Envelope: 86–170 wide and 80–148 high.
- Stun Spore: 54 amber seeds leave in three staggered groups, with 0.56–0.61 s travel. Seeds scatter after arrival; six compact double-stroke crackles pulse at different points around the target. Two small tremors finish by 1.40 s. Envelope: 90–174 wide and 76–145 high.

The powder contact/fade checks cover arrival cues and dissipation before teardown. Existing normal/reduced-motion, cancellation, effects-off and alternate-layout checks include these moves. The original 99-frame fixture continues to apply only to the original 33 recipes.

## Bite and fang move design

Each of these four recipes owns its jaw geometry, particle behavior, timing and recovery. The attacker's emission socket meets the target center plus six local art units on the impact frame. Drawing scale is bounded by the target's visible width or height; both routes and contact remain valid for reversed layouts and different actor proportions. The effects use ordinary Graphics and Sprite objects, without masks or new assets.

- Bite: a 0.16 s wind-up and 0.28 s lunge. Four teeth on each jaw snap shut over 0.09 s, hold briefly, then reopen. Ten short ivory/violet flecks and a small glow mark contact. The attacker returns by 0.97 s.
- Crunch: a 0.28 s wind-up and 0.36 s approach. Five broad teeth per jaw close at 0.64 s, tighten between 0.76–0.89 s, then release from 0.99 s. Seven jagged pressure cracks, fourteen shards, a low-opacity violet glow, brief squash and small tremor give the bite weight. The attacker returns by 1.53 s.
- Hyper Fang: the attacker pounces through a raised waypoint. Two long fangs converge along a tilted axis in 0.105 s, meeting at 0.38 s with a four-point flash and two expanding puncture rings. The attacker returns by 0.88 s.
- Poison Fang: two curved fangs close at 0.58 s and withdraw from 0.79 s. Twenty droplets follow gravity and two short venom trails drain down after the bite. Two restrained violet tints communicate venom; all liquid fades before completion. The attacker returns by 1.12 s.

These retain fixed demo damage. Bite/Hyper Fang flinching, Crunch Defense reduction and Poison Fang bad-poisoning rolls are not simulated. FX never applies HP or conditions. Contact/fade, normal/reduced motion, cancellation, replay, effects-off and alternate-actor checks include all four moves.

## Smog, Poison Gas, Smokescreen and Toxic

Each move owns its geometry and particle laws in its own file. Source emission follows the posed actor socket; target envelopes derive from visible actor bounds and are capped in local art units. Ordinary Graphics and glow sprites need no new assets, scene masks or shared visual helpers. All motion uses the move timeline and continues through dissipation.

- Smog: thirteen six-lobed billows launch at 0.20 s with 45 ms staggering and 0.64 s travel. Their scale breathes, their bodies rotate, and they sink and drift forward for 0.68 s after arrival. Thirty soot flecks accompany the exhaust. Envelope: 84–164 wide and 68–116 high; billow opacity is capped at 0.27. A small target tremor marks 22 fixed demo damage; secondary poisoning is not simulated.
- Poison Gas: sixteen soft violet/olive puffs launch from 0.24 s, travel for 0.74–0.80 s, then circulate and rise for 0.90 s. Four moving thread paths curl into loose target-local arcs. Envelope: 86–170 wide and 72–130 high. Contact at 0.98 s reveals the core's poison condition; no immediate HP loss.
- Smokescreen: a five-knot smoke shot travels from 0.16–0.64 s. Ten charcoal billows bloom over 0.32 s, then separate, rotate and lift while eighteen ash flecks rise. Envelope: 88–178 wide and 76–138 high. No actor opacity or visibility is altered. The core lowers `accuracyStage` by one, clamped to −6…6; the host shows `ACCURACY −1` in a fresh preview. HP and any existing condition are preserved.
- Toxic: eleven venom droplets arc from 0.24 s with 0.62 s travel. Three tight elliptical pulses begin at 0.86, 1.09 and 1.32 s; twenty-five bubbles rise through a softly pulsing magenta aura. Envelope: 80–146 wide and 76–136 high. The core sets `bad-poison`; the host shows `BADLY POISONED`. Increasing poison damage over later turns is not simulated.

Normal/reduced-motion playback, arrival cues, pre-completion fade, cancellation, replay, effects-off results and alternate actor layouts are covered by the existing integration checks. Reset/replay starts from clean condition and accuracy state. Browser appearance remains unverified.

## Defensive shields

These recipes use `subject: 'source'`. The effect-space unit derives from the user, the X direction follows its facing, and the shield follows its posed center. Their width/height are proportions of supplied visible actor metrics, with small minimum art dimensions. Neither the opponent nor its size determines coverage. Source-only requests work in the battle and standalone FX package. All objects are ordinary Graphics/Containers; no actor visibility changes, new images or scene masks are used.

- Barrier: a faceted outline grows vertically from 0.16–0.66 s. Fifteen hexagonal panes rise in staggered bottom-to-top rows, fully forming by 0.70 s. Two upward chevrons accompany Defense +2. Panes drift upward and dissolve from 1.56 s; the outline disappears by 2.08 s. Nominal wall is 0.92 user widths by 1.02 user heights before its chamfered silhouette.
- Protect: a translucent ellipse grows from 0.14–0.50 s with a restrained overshoot. Latitude lines and a curved highlight suggest a dome. Sixteen motes travel along the rim; two ripples pulse from 0.50 and 0.78 s. The shell breathes gently and fades by 1.88 s. Its diameter is 1.18 user widths by 1.12 user heights.
- Light Screen: a thin golden glass plane rises and activates at 0.70 s. Three luminous bands travel upward, and six edge stars brighten in sequence. The glass lifts slightly as it disappears by 2.07 s. Its authored frame uses 0.90 user widths by 1.04 user heights, offset slightly toward the facing direction.
- Reflect: three panels unfold from edge-on at 0.18, 0.30 and 0.42 s, reaching full width by 0.72 s. Diagonal silver highlights sweep upward; three diamond ripples expand across the mirror. The panels fold shut and fade in sequence by 2.17 s. The assembly is approximately one user width and height, offset toward the facing direction.

All four leave both actors' HP unchanged. Core owns the user's Defense/protection preview fields; FX emits only an activation cue. Reduced motion uses a subdued source-sized glow. Focused checks cover source-only and misleading opponent requests, both motion modes, tall/wide actors, reversed facing, bounded coverage and cancellation without touching the opponent. Browser appearance remains unverified.

## Spinning and rolling attacks

Each recipe has its own artwork, route, pose math, debris and recovery. The visible center socket is compensated for the current rotation and scale, so a tucked actor rolls around its body instead of its registration pivot. Routes use source/target center and floor sockets; dimensions are bounded local art units based on visible actor metrics. The source remains visible, all effects move through their fades, and the move updater applies the contact pose before emitting the cosmetic cue. No shared rolling template or new assets are used.

- Rapid Spin: three partial elliptical wind strokes sweep around the body at different heights. From 0.24–0.72 s the user advances while its silhouette narrows and tilts to suggest a rapid vertical twirl. The tackle socket reaches target center +8 local Y at 0.72 s; sixteen flecks and a small oval flash mark impact. The user returns by 1.34 s. Fixed preview damage: 34; Speed increase and trap/hazard removal are omitted.
- Rollout: the user tucks over 0.22 s into a rocky rim with radius 27–62 art units. It accelerates along the floor route until 0.88 s, with small ground bumps, ten trailing dust puffs, eighteen impact fragments and a ground ripple. The leading rim reaches the target's lower body. A short rebound precedes the return and gradual untuck, complete by 1.80 s. Fixed preview damage: 32.
- Ice Ball: a translucent, faceted ice shell forms by 0.34 s around the tucked user (radius 28–63). Two small bounces carry it to contact at 1.04 s. Twelve trailing crystals lead into twenty-two shattering pieces and a white-blue contact ring. The shell dissolves over 0.18 s while the user returns, fully restored by 1.96 s. Fixed preview damage: 36.
- Flame Wheel: a ten-tongue fire ring ignites as the user tucks over 0.28 s (radius 29–65). Flame tips flicker independently as the ring rotates through the accelerating charge. Eighteen trailing embers and twenty forward impact embers accompany contact at 0.86 s. The ring fades by 1.22 s; the actor returns and untucks by 1.74 s. Fixed preview damage: 48; burn and thawing are omitted.

Rollout and Ice Ball show one hit, without consecutive-turn power doubling, turn lock or the Defense Curl bonus. Contact, center attachment, source visibility and recovery checks cover both directions and tall, wide and original Pokémon profiles. Existing normal/reduced playback, cancellation, effects-off results and original-geometry checks still apply. Browser appearance remains unverified.

## Chops and smashing strikes

All four recipes own their geometry, hand shapes, particles and timing. The source hand meets target center +6 local Y for the chops and Brick Break, or +12 local Y for Rock Smash. Local scale is derived from target visible height; paths and attachments resolve from actor anchors. The hand artwork updates before the cosmetic impact callback, and both actors remain visible. No new images, masks or shared visual recipe were added.

- Karate Chop: 0.20 s wind-up, followed by a fast 0.32 s approach. A narrow open hand follows the posed hand socket. A three-layer golden downward sweep grows from 0.34–0.52 s; twelve sharp flecks and a narrow flash mark impact. The source returns by 1.15 s. Fixed damage: 36; increased critical-hit chance is not simulated.
- Brick Break: a 0.18 s wind-up and 0.32 s raised approach precede a heavy 0.18 s downward blow. Six translucent tiles appear in front of the target, crack at 0.68 s, then rotate apart under gravity. Sixteen chips and an expanding oval shock mark the strike. The source returns by 1.36 s; all tiles fade by 1.365 s. Fixed damage: 54. Independently, core clears the target's Light Screen and Reflect when present; source screens, Protect, Defense, conditions and accuracy are preserved. The animated panel always appears without querying gameplay state.
- Cross Chop: a 0.26 s wind-up and 0.50 s approach. Two long hand shapes close and rotate into a cross while two broad diagonal trails carve an X. Twenty diagonal sparks and a compact flash appear at 0.76 s. The source returns by 1.49 s. Fixed damage: 70; increased critical-hit chance is not simulated.
- Rock Smash: a 0.24 s wind-up and 0.46 s punching approach. A small faceted stone silhouette (radius 28–48 art units) fractures at 0.70 s into eight tumbling wedges. Eighteen expanding dust puffs and a small shock ring carry the impact forward. The source returns by 1.37 s and debris fades by 1.46 s. Fixed damage: 30; secondary Defense reduction is not simulated.

## Beak and horn attacks

These four independent recipes attach to an explicit `beak` or `horn` socket when the host exposes it through optional `hasAnchor(name)`. Hosts without that method, or profiles without those sockets, use `emission`. Artwork size follows source visible height in the adapted drawing space, with bounded lengths. To place the visible tip at target center, each recipe subtracts its rotated tip vector before calling `solveContact`. The attachment updates before the impact cue; actor scale remains one. Target contact is center +4 local Y for Peck/Drill Peck, +6 for Horn Attack, and +8 for Megahorn. No fixed Pokémon positions or new assets are used.

- Peck: a 0.12 s wind-up and 0.24 s jab. The golden beak is 18–36 art units long (0.13 source heights); its jaws open and snap closed by 0.36 s. Nine small flecks and a narrow four-point flash mark the hit. The beak fades by 0.61 s and the actor returns by 0.80 s. Fixed damage: 28.
- Horn Attack: a 0.22 s wind-up and 0.36 s thrust. A shaded ivory horn is 32–64 units long (0.24 source heights), with three trailing air strokes. Fourteen chips and an expanding oval mark contact at 0.58 s. The horn fades by 1.01 s; recovery ends at 1.24 s. Fixed damage: 46.
- Drill Peck: a 0.24 s wind-up and accelerating 0.52 s approach. The pale blue cone is 34–70 units long (0.25 source heights). Two tapered sine bands revolve around its long axis at 31 radians/s while a pair of winding trails follows behind. Contact at 0.76 s produces sixteen drifting curls and a narrow ring; the brief drilling hold is a single hit. Art fades by 1.40 s and recovery ends at 1.55 s. Fixed damage: 58.
- Megahorn: a 0.38 s wind-up gathers eight green motes around a curved, ridged horn, 52–96 units long (0.38 source heights). A 0.50 s accelerating charge ends at 0.88 s with eighteen lime splinters, two small shock ovals and a compact flash. Art fades by 1.40 s and the actor returns by 1.70 s. Fixed damage: 84.

Renderer-free playback checks cover custom and fallback sockets, adapters without `hasAnchor`, both facing directions, tall/wide actors, viewport fit, exact tip contact, full recovery, reduced motion and cancellation. These checks establish geometry and lifecycle behavior; browser pixel appearance remains unverified.

## Cutting attacks

All four own their artwork, paths, reactions and fades. Cut/Fury Cutter use `hand`; Leaf Blade uses an optional explicit `blade` socket with `hand` fallback. Their visible blade-tip vector is rotated by swing angle plus actor rotation and subtracted from the target contact point before solving the source pose. No actor scaling is applied. Air Cutter is ranged and holds the source near its starting position. Actor proportions, sockets, facing and the shared coordinate adapter determine the placement; constants below are local art units.

- Cut: 0.18 s wind-up and 0.32 s lunge. A narrow silver blade, length 26–50 units (0.22 source heights), swings from −0.85 to +0.55 radians during 0.26–0.50 s. Its tip meets target center +6 Y at 0.50 s, producing a fine diagonal nick and ten flecks. Blade fades by 0.73 s and source returns by 1.10 s. Fixed damage: 36.
- Fury Cutter: 0.18 s wind-up and 0.42 s approach. A hooked green blade, length 32–68 units (0.26 source heights), swings upward from +1.05 to −0.60 radians during 0.32–0.60 s. Two translucent echoes follow the same stroke. Tip meets target center +4 Y at 0.60 s with fourteen splinters and a curved score. Blade fades by 0.86 s and source returns by 1.25 s. Fixed damage: 30; one use, without consecutive-use power increases.
- Leaf Blade: 0.28 s wind-up and 0.54 s approach. A broad leaf, length 40–86 units (0.34 source heights), has a central vein, eight branches and a bright edge. It swings from −1.30 to +0.35 radians during 0.44–0.82 s, leaving a tapered green fan within roughly one blade length of the attachment. Tip meets target center +6 Y at 0.82 s. Twelve veined fragments spin away; blade fades by 1.32 s and source returns by 1.65 s. Fixed damage: 62; raised critical-hit chance is not simulated.
- Air Cutter: source winds up for 0.18 s and reaches its held release pose at 0.30 s. Crescents launch at 0.32 and 0.40 s from the posed `wing` socket, or `emission` when absent. Radius is 18–34 units (0.16 target heights), with the second at 83% size. Their leading edges follow 0.50 s curved flights with opposite bows, capped at 48 units or 13% of anchor distance. First edge meets target center at 0.82 s and emits the only cue; the second arrives at 0.90 s, offset downward by 0.4 radii. Three fine trails follow each crescent, with eighteen short impact wisps. Source returns by 0.92 s; crescents fade by 1.05 s and wisps by 1.29 s. Fixed damage: 42; single opponent and no critical-hit roll.

Playback checks cover exact blade-tip contact before cues, custom/fallback sockets, reversed facing, multiple actor proportions, source-relative Air Cutter release, full recovery and cancellation. Browser visual review remains unperformed.

## Ember, Dragon Rage, Will-O-Wisp and Tri Attack

Each recipe owns its shapes, routes, particle laws and recovery. All launch from the supplied `emission` anchor. Ember, Dragon Rage and Tri Attack hold a planned firing pose through release, allowing a stable source point in both facing directions. Will-O-Wisp gently follows the source's settling pose during its early drifting flight. Contact callbacks update the visible projectile positions before emitting the cosmetic cue. No new assets or shared visual helpers are required.

- Ember: five orange/gold flame pellets launch at 0.26 s plus 0.085 s per pellet. Flights take 0.44 s, with 0.03 s added to alternate pellets. Flame size is 9–15 art units (0.065 target heights); the five target lanes are center and ±0.5/±1 flame sizes. Each impact emits five small sparks. First contact is 0.70 s, last 1.04 s; all sparks fade by 1.41 s. The source returns by 1.02 s. Fixed damage: 28; secondary burn chance is omitted.
- Dragon Rage: a rotating charge grows at the posed source socket from 0.08–0.46 s. A single violet/coral flare of radius 20–32 units (0.16 target heights) launches at 0.46 s, with an accelerating 0.54 s flight and a shallow bow capped at 20 units. Three thin tail ribbons flicker behind its angular flame silhouette. Contact at 1.00 s creates twenty-two sparks, a narrow shock oval and a compact four-point flash. Flare fades by 1.18 s and the source returns by 1.65 s. Core damage is fixed at 40, capped by remaining HP; base power is absent.
- Will-O-Wisp: three upright violet/blue flames launch from 0.28 s at 0.08 s intervals, traveling for 0.82/0.85/0.88 s. Their heights use a base size of 11–18 units (0.085 target heights). Each reaches target center, then spreads into a rising orbit bounded to 30–60 units horizontally and 24–44 vertically. First contact at 1.10 s reveals burn without HP loss. Twelve pale cinders drift upward; the final flame fades by 2.17 s. The host displays BURNED until reset or another preview. Ongoing burn damage, Attack reduction and immunity checks remain outside this preview.
- Tri Attack: three orbs form a rotating triangle around the source from 0.10 s. Radius is 10–16 units (0.08 target heights), with formation radius 2.4 times orb radius. A flame, lightning bolt and snowflake distinguish the elements. At 0.48 s the full formation transitions continuously into a 0.58 s weaving flight; its radius contracts to zero at target center. All three converge at 1.06 s for one cue and white flash, with three colored shock arcs and eighteen flame/bolt/crystal fragments. Orbs/trails fade by 1.23 s, fragments by 1.56 s, and the source returns by 1.56 s. Fixed damage: 58; no random burn, paralysis or freeze.

Checks cover supplied sockets and registration pivots, both directions and actor proportions, launch/impact alignment, Tri Attack transition continuity, normal/reduced playback, reset/cancellation, effects-off outcomes, burn persistence and Dragon Rage damage clamping. Browser appearance remains unverified.

## Vortices and trapping previews

These are four independently authored recipes, with no shared vortex template. Whirlpool, Fire Spin and Sand Tomb form around the target's resting `floor` anchor. Whirlwind travels from the source's posed `emission` to target center, then follows the target's posed center while lifting it. All sizes below are adapted local art units; source/target anchors determine their positions. No masks, shared texture edits or actor visibility changes are used.

- Whirlpool: a short droplet inlet travels from 0.22–0.76 s while a translucent funnel grows from 0.30–0.76 s. Radius is 44–88 units (0.52 target widths), height 70–150 (0.78 target heights). Seven rotating broken water bands and thirty-two moving foam drops provide continuous flow. The funnel drains downward and fades from 1.65–2.30 s. Contact is 0.76 s; source returns by 0.95 s and target recoil ends by 1.06 s. Fixed initial damage: 28.
- Fire Spin: a corkscrewing flame travels from 0.24–0.76 s. Two interleaved fire helices grow from 0.58–1.00 s around the target, radius 40–78 (0.44 widths), height 95–172 (0.85 heights). Twenty-four rising flame tongues and eighteen embers circulate continuously. Coils fade from 1.80–2.45 s; the source returns by 1.17 s. Fixed initial damage: 30.
- Sand Tomb: a ground pit forms from 0.16–0.70 s, with radius 48–95 units (0.53 target widths) and vertical radius 29% of that. Three rotating spiral channels guide fifty-two grains inward; eight low dust clusters drift upward. Target sinks by at most 10 units (0.07 target heights) from 0.70–0.96 s, then rises from 1.65–2.15 s. Sand fades from 1.75–2.25 s. Fixed initial damage: 28. These three moves do not apply trapping state or later-turn damage.
- Whirlwind: a seven-band open wind funnel travels from 0.22–0.84 s, growing from 35% to full size. Radius is 30–66 (0.34 target widths), height 100–164 (0.92 target heights); sixteen fine wisps circulate upward. After contact, the target moves outward by up to 34 units and upward by up to 22, with lean of 0.10/0.05/0 radians chosen to fit its rotated visible bounds. Available side/top clearance limits translation. Motion peaks at 1.28 s and recovers from 1.38–1.98 s; the funnel fades from 1.20–1.75 s. `switchPreview` produces an explicit no-damage, no-switch result, with battle actors and conditions unchanged.

Checks cover both directions and wide/tall actors, anchor placement before cues, continuing particle movement, sprite visibility, full pose recovery, viewport-corner bounds, cancellation/replay, reduced motion and effects-off results. Browser visuals remain unverified.

The contact checks inspect hand and attached artwork positions inside the cue callback, for original, tall and wide actors in both directions. Existing checks cover reduced motion, fade, cancellation, replay and unchanged original geometry. Separate core/presenter checks verify Brick Break's screen removal with effects disabled and preserve unrelated state. Browser appearance remains unverified.

## Drain move design

Each move owns its geometry and timing. Energy launches from the target's live center and arrives at the source's posed aura socket, including during Leech Life's return. Target-relative sizes are capped in local art units, paths follow actor separation, and both actors remain visible. No new textures or shared visual recipe are used.

- Absorb: eight 3–5-unit green motes launch from 0.40 s at 45 ms intervals, travel for 0.58 s, and fade over 0.10 s. A small target ring contracts while a source ring receives the energy. Recovery cue: 0.98 s; receiving ring fades by 1.56 s; completion: 1.80 s.
- Mega Drain: twelve 5–8-unit hexagonal beads launch from 0.52 s at 60 ms intervals and travel for 0.68 s. Two thin wavering tethers and paired target rings make the flow denser. Paired receiving rings pulse from recovery at 1.20 s and fade by 2.10 s; completion: 2.35 s.
- Giga Drain: a three-part rotating target aura contracts into eighteen leaf-shaped particles, staggered by 34 ms from 0.68 s with 0.78 s travel. Three ribbons follow interwoven paths with a 32-unit transverse envelope that narrows to zero at both endpoints. Recovery: 1.46 s; receiving aura fades by 2.36 s; completion: 2.75 s.
- Leech Life: two hooked ivory/rose mandibles attach to the posed emission socket and close at 0.52 s. The user returns by 1.03 s while eight rosy/gold motes launch from 0.70 s at 55 ms intervals, taking 0.66 s to reach its moving aura. Recovery: 1.36 s; receiving rings fade by 2.04 s; completion: 2.25 s.

Core healing is half the HP actually removed, rounded and capped by missing source HP. Fresh drain previews start the user at 101/156 HP; final source HP is 110, 118, 129 and 128 respectively. The target HP and damage fixtures appear in the inventory. Battle state commits both changes before FX; display reveals damage at impact and healing at recovery. Numerical checks cover those cue phases, live endpoints with alternate sockets and reversed/tall/wide layouts, healing caps and rounding, missing recovery, effects-off, skip, cancellation and stale callbacks. Browser visuals remain unverified.


## Refresh, Heal Bell, Aromatherapy and Rest

All four use source-targeted FX entries and independent drawings, with size derived from source visible metrics and capped in local art units. Effects follow the posed user center, work without an opponent and never modify the opponent's pose. Source alpha and scale remain unchanged. The single impact cue reveals the already-committed cure or Rest result; none uses the drain recovery phase.

- Refresh: three ellipse rings begin at 0.12 s with 0.16 s staggering, sweeping upward for 1.15 s each. Horizontal radius is 42–110 units; scan height is 80–190. Eighteen glints spread outward from 0.38 s with 45 ms staggering and 0.65 s life. A faint cleansing pulse peaks at activation (0.68 s). Latest glint fades at 1.795 s; completion at 2.00 s.
- Heal Bell: the bell fades in from 0.12 s, swings from 0.40 s with a decaying 0.22-radian amplitude and an opposing clapper. Three elliptical sound waves expand from 0.72 s with 0.27 s staggering and 0.90 s life. Six notes drift outward/upward, with mirroring compensated so they remain readable. Latest wave fades at 2.16 s; completion at 2.50 s. This is visual bell motion; no audio track is added.
- Aromatherapy: twelve veined herbs spiral upward from 0.18 s, staggered by 60 ms with 1.50 s life. Three continuously bending scent wisps and ten small lavender/cream petals accompany them. Envelope radii are 44–108 horizontally and 48–105 vertically. Activation is 0.90 s; latest wisp fades at 2.47 s; completion at 2.70 s.
- Rest: the user settles by at most seven units and leans 0.035 radians, then breathes gently under a lavender halo and ivory crescent. Three rising Z marks begin at activation (0.82 s), staggered by 0.33 s with 0.98 s life; glyph mirroring is compensated. The pose returns by 2.30 s, last mark fades at 2.46 s, completion is 2.80 s. The Asleep badge persists in core state after cosmetic pose recovery.

Fresh previews start Refresh poisoned, Heal Bell paralyzed and Aromatherapy burned, all at 156 HP. Their successful cures leave HP unchanged. Rest starts poisoned at 70/156 HP and commits 156 HP plus sleep. Refresh cannot cure sleep/freeze; Rest fails at full HP or when already asleep. Bell/Aromatherapy preview only the user, without party or ability handling; sleep turns are not simulated. Checks cover immutable rules, failed outcomes, source-only playback, both facings and actor proportions, activation alignment, dissipation, cancellation/replay, effects-off and stale callbacks. Browser appearance remains unverified.


## Meditate, Calm Mind, Amnesia and Focus Energy

Each independently authored recipe uses `subject: 'source'`, follows the posed source center and resolves its envelope from source visible metrics in local art units. The opponent remains untouched and need not exist. Each emits one impact/activation cue; the host reveals the core's committed stat/focus result then. Neither HP nor condition changes. No new assets, dependencies or shared visual helpers are used.

- Meditate: five translucent lotus-like petals and a lower elliptical ring frame a steady rose aura. Eight diamond motes orbit slowly; horizontal radius is 40–105 units and vertical radius 48–110. The user lifts by at most four units from 0.15–0.65 s and returns by 1.80 s. Activation at 0.70 s reveals Attack +1. Aura fades from 1.45–1.87 s; completion at 2.10 s.
- Calm Mind: three concentric lavender/blue ellipses pulse with a 3.5% scale variation while two contrasting lights orbit at 0.95 radians/s. Twelve motes move inward from 0.22 s with 50 ms staggering and 0.95 s life. Envelope radii are 43–108 and 50–115. Activation at 0.90 s reveals Special Attack +1 and Special Defense +1. The whole aura fades from 1.70–2.18 s; completion at 2.40 s.
- Amnesia: a softly filled thought cloud and two connecting bubbles form beside the upper body. Its question mark fades from 0.62–0.80 s, then eleven empty bubbles drift apart from 0.84 s with 65 ms staggering and 0.92 s life. The glyph counter-mirrors to remain readable. Activation at 0.84 s reveals Special Defense +2; latest bubble fades at 2.41 s; completion at 2.65 s.
- Focus Energy: fourteen tapered radial streaks tighten from 0.10 s with 25 ms staggering and 0.50 s life. A compact diamond outline contracts while a four-point glint peaks at activation (0.62 s). Eight gold sparks rise from that moment with 55 ms staggering and 0.76 s life. Radii are 42–105 and 50–115. Latest spark fades at 1.765 s; completion at 2.00 s.

Core stores stages within −6…6 and allows a partially capped Calm Mind to raise its remaining stat. Focus Energy stores a non-stacking flag representing +2 critical-hit ratio. Fully capped boosts and repeated Focus Energy fail without changing actors; ordinary FX skips failed outcomes. Damage multipliers, critical-hit rolls and expiry on switching are outside the fixed preview. Checks cover stage limits, partial caps, repeated use, state preservation, source-only/reversed/alternate-actor playback, activation alignment, fade, cancellation/replay, effects-off and stale callbacks. Browser appearance remains unverified.


## Bulk Up, Howl, Swords Dance and Dragon Dance

These are four independent `subject: 'source'` recipes. Each follows live semantic anchors, derives size from source visible metrics and uses capped local art units. The opponent is untouched and may be absent. No shared visual helper, new image, mask or sprite visibility/scale change is added. One activation cue reveals the core's already-committed stat changes.

- Bulk Up: the user braces downward by at most five units from 0.06–0.34 s, then rises from 0.48–0.66 s. Ten tapered energy columns climb over 0.90 s each, staggered by 70 ms from 0.22 s. A warm outline and base ring frame the body (radii 42–108 and 48–112), with a brief central pulse at activation, 0.66 s. Aura fades by 1.80 s; completion at 2.10 s.
- Howl: the user leans back 0.05 radians and lifts two local units, holding while four arcs expand from the posed emission socket. The sound container points slightly upward; its origin updates after the pose and before the activation cue at 0.50 s. Arcs have 0.18 s staggering and 0.80 s life, bounded by a 44–92-unit span. The pose returns by 1.47 s, last arc fades at 1.84 s; completion at 2.20 s. This is a visual sound effect, without an audio track.
- Swords Dance: four individually drawn silver blades with gold crossguards orbit on an ellipse, with changing depth opacity/scale and fine trailing arcs. Blade length is 40–74 units; orbit radii derive from 46–112 horizontal and 48–105 vertical bounds. The orbit turns 4.8 radians from 0.20–1.55 s. Activation at 0.95 s reveals Attack +2; the swords fade from 1.72–2.14 s; completion at 2.45 s.
- Dragon Dance: two cyan/lavender ribbons and sixteen scale-shaped motes flow around the user's moving center. The dance runs from 0.20–1.85 s, with two swaying steps, at most 0.055 radians of rotation, ten local units of horizontal movement and five upward. Rotation compensates the supplied visible center, preventing wide/tall artwork from swinging around its foot pivot. Activation at 0.92 s reveals Attack/Speed +1. Ribbons keep flowing through the fade to 2.20 s; completion at 2.65 s.

Core clamps each stat independently and lets Bulk Up or Dragon Dance succeed when either requested stat can rise. Howl is a user-only preview; allied boosts and sound-related abilities are not simulated. Speed is stored and displayed, without a turn-order engine. Checks cover partial/full caps, Speed validation/preservation/reset, unchanged Barrier semantics, custom Howl sockets, bounded Dragon Dance center movement, both facings and actor proportions, source-only playback, activation/fade, cancellation/replay, effects-off and stale callbacks. Browser visuals remain unverified.


## Agility, Double Team, Minimize and Acid Armor

All four own independent recipes with `subject: 'source'`, using source visible metrics and semantic anchors. Effects follow the posed center, with floor-relative geometry where appropriate. There are no actor-opacity changes or new assets. Core stat results are displayed at a single activation cue; FX cannot change HP, stats or conditions.

- Agility: three bounded sidesteps from 0.16–1.12 s, with horizontal amplitude at most 22 local units and vertical lift at most four. Nine short streaks start at 0.18 s with 65 ms staggering and 0.48 s life; a floor flash accompanies activation at 0.62 s. Latest streak fades at 1.18 s; completion at 1.60 s.
- Double Team: four copies of the supplied actor separate left/right in two ranks, over 0.55 s each from staggered starts at 0.16–0.31 s. Spread is 28–74 local units; opacity is 0.24/0.14. Copies preserve artwork, size, facing and shared texture ownership. A move-owned outline substitutes when snapshots are unavailable. Activation: 0.72 s. Copies keep a subtle three-unit shimmer and merge from 1.22–1.67 s; completion: 2.00 s.
- Minimize: shrink from 100% to 42% during 0.16–0.70 s, preserving the supplied floor even with a custom registration origin. Activation at 0.70 s reveals Evasion +2. The small actor dodges sideways by up to nine units from 0.78–1.20 s, with inward brackets and eight glints. Art fades by 1.615 s; scale restores from 1.35–1.85 s; completion: 2.15 s. The source remains fully opaque and visibly present throughout.
- Acid Armor: soften to 105% width and 83% height during 0.16–0.76 s, compensated around the supplied floor. A low-opacity lavender coat carries five continuously sliding mint highlights; twelve droplets flow into a moving pool. Activation: 0.76 s. Original proportions return from 1.50–2.00 s while the coat continues flowing through its fade to 2.28 s; completion: 2.50 s.

Core validates Evasion stages and clamps every boost to +6. Agility gives Speed +2, Double Team Evasion +1, Minimize Evasion +2 and Acid Armor Defense +2; fully capped moves fail without actor changes. Accuracy rolls, turn order and special attacks against minimized targets are not simulated. Checks cover caps, field preservation/reset, optional snapshot fallback, clone dimensions, custom floor/pivot anchors, positive scales and sprite visibility, normal/reduced motion, both facings, cancellation/replay, effects-off and unchanged original geometry. Browser appearance remains unverified.

## Rage, Thrash, Outrage and Struggle

Each recipe owns its drawing and choreography. Physical contact uses `solveContact('tackle', rotation)` against the supplied opponent center, at scale one. Their bounded art radii derive from visible source height in effect-space units; the camera supplies uniform viewport fitting. Neither actor fades or disappears. No new textures or shared visual helpers are needed.

- Rage: six warm pressure marks pulse around the moving source center from 0.08–0.92 s. A tense 0.42 s wind-up precedes the 0.20 s rush. Contact at 0.62 s emits one cue, a nine-ray burst and fifteen short sparks. Radius is 30–58 units (0.27 source heights). Source returns by 1.35 s; completion 1.65 s. Fixed damage 24; later-hit Attack boosts are not simulated.
- Thrash: the first rush contacts at 0.54 s; two irregular withdrawal/return motions strike again at 0.96 and 1.42 s with rotations +0.13, −0.16 and +0.19 radians. Three move-owned sweeps/bursts and 24 short dust motes accompany the combo. Target recoil returns between contacts. Only the first strike emits a cue and resolves the single 78-damage preview. Radius is 32–60 units (0.28 source heights). Source returns by 2.16 s; completion 2.40 s. No multi-turn locking or confusion.
- Outrage: three continuously redrawn violet/blue ribbons and twelve moving scale motes surround the source during the charge/rush. The held 0.54 s wind-up leads into contact at 0.86 s, followed by a ten-ray crash, narrow expanding ellipse and twenty fragments. Radius is 35–65 units (0.30 source heights). Fragments finish by 1.46 s; source returns by 1.78 s; completion 2.15 s. Fixed damage 82; no multi-turn locking or confusion.
- Struggle: three hesitant shifts lead into a 0.24 s tackle, contacting at 0.70 s. A rough impact shape, three short scuff lines and ten dust motes precede the backward bounce. A separate five-mark source flash appears at 0.83 s and follows the user through recoil; a brief warm tint clears at 1.08 s. Radius is 27–48 units (0.23 source heights). Source finishes its recovery wobble at 1.71 s; completion 1.95 s.

Struggle's fixed damage is 36. Core computes recoil as `min(currentHp, max(1, round(maxHp / 4)))`, independent of damage actually removed from the target. The default user loses 39 HP (156 → 117), even if the target has only 1 HP. Both HP changes commit together before FX and are displayed at the ordinary impact cue. No healing/recovery phase is registered; skipping, disabled FX, failure and stale callbacks use the existing reconciliation flow. The Normal label is catalog metadata; the move is typeless in battle mechanics. PP prerequisites and type calculations are not simulated in this fixed-damage showcase.

Validation covers exact contact before cues across custom anchors, wide/tall actors and reversed facing; all three Thrash contacts; continuous sprite visibility, pose recovery, cancellation/replay, normal/reduced motion, recoil rounding/capping and both-actor reconciliation. Browser appearance remains unverified.

## Leer, Scary Face, Glare and Mean Look

Each move owns its gaze artwork, timing and reaction. An explicitly supplied `eyes` anchor is used when available, otherwise `emission` provides the face attachment. Every local updater runs before its impact cue. Effects scale uniformly from actor metrics, remain bounded around the participants and preserve both sprites at full opacity and scale. No HP damage is applied by these four core rules.

- Leer: a pair of narrow warm eyes appears at 0.08 s, with a brief glint at 0.23 s. Three thin pressure crescents leave at 0.28 s with 75 ms staggering and 0.36 s flight, following the posed source/target sockets. First arrival/cue: 0.64 s. Three downward marks drift and fade after contact. Eye radius is 19–34 local units (0.14 source widths). Eyes fade by 0.87 s; final falling mark by 1.40 s; source returns by 1.08 s; completion: 1.75 s.
- Scary Face: a freestanding face with slanted eyes and a jagged, moving jaw grows from 40% size and travels from the source face to the opponent center during 0.25–0.80 s. Radius is 32–52 units (0.27 target heights). Arrival at 0.80 s emits the cue before target recoil. Six shivering strokes and a double downward mark accompany the response. Mask fades by 1.36 s, final fear stroke by 1.625 s, target returns by 1.48 s; completion: 2.10 s.
- Glare: golden slit eyes appear from 0.10 s. A narrow outlined gaze and diamond tip travel from 0.38–0.72 s. The tip reaches target center before the cue. Five short angular arcs orbit and flicker around the posed target, with reach 38–78 units (0.40 target widths), while the target trembles by 2.5 local units. Source eyes fade by 1.05 s, target tremble/tint clear by 1.16 s, arcs keep moving through their fade to 1.78 s; completion: 2.20 s.
- Mean Look: a small source glint precedes a violet almond-shaped eye over the opponent. Eye half-width is 32–57 units (0.28 target widths), with a moving iris ring. Side brackets close from 0.57–0.90 s, with the cue at closure. Three floor arcs continue circulating beneath the target. Eye fades by 1.83 s, brackets by 1.95 s and floor arcs by 2.06 s; completion: 2.40 s.

Core lowers Leer Defense by one stage and Scary Face Speed by two, clamped to −6; already capped moves fail with unchanged actors. Messages use actual stage change, so −5 → −6 is a one-stage fall. Existing positive boosts and Barrier behavior remain unchanged. Glare uses the existing paralysis preview. Mean Look sets a validated `trapped` boolean; repeated use fails unchanged. The flag persists through other moves and resets with a fresh preview; it does not enforce switching, escape exceptions or source-departure expiry. Opponent badges display these committed results at the ordinary impact cue, and effects-off/skip/failure reveal the same state.

Checks cover custom/fallback eye sockets, wide/tall actors and reversed facing, arrival before cue, normal/reduced motion, fade/pose cleanup, cancel/replay, stat floors and negative wording, trapping reset, and presenter reconciliation. Browser appearance remains unverified.

## Scratch, Metal Claw and Dragon Claw

Three independent move files own all shapes, choreography and particles. An explicit `claw` socket falls back to `hand`; legacy actors without `hasAnchor` use the hand too. Central claw-tip contact subtracts the rotated tip vector from the target point before `solveContact`. Attachment updates run before impact cues. Source scale and both actors’ opacity remain one; effects use actor-relative, bounded art units and uniform camera fitting.

- Scratch: three small ivory nails appear at 0.14 s. A 0.13 s wind-up leads into the 0.25 s approach, with a fast sweep from −0.80 to +0.65 radians. Central tip length is 24–42 units (0.18 source heights), meeting target center +4 local Y at 0.38 s with actor rotation +0.035. Three fine rake marks appear with 25 ms staggering and eight short flecks scatter. Claws fade by 0.60 s, marks by 0.67 s and flecks by 0.70 s; source returns by 0.94 s. Completion: 1.18 s. Fixed damage: 28.
- Metal Claw: a faceted steel base supports three angular tines with shaded undersides and bright edges. A small glint slides along them from 0.13–0.39 s. After a 0.24 s wind-up, the approach finishes at 0.64 s; the swing rotates from −1.05 to +0.12 radians with actor rotation +0.055. Central tip length is 34–65 units (0.26 source heights), contacting target center +4 Y. A restrained silver fan, short impact cut and twenty warm/white sparks mark contact. Art fades by 1.12 s; source returns by 1.38 s. Completion: 1.75 s. Fixed damage: 34; no random Attack increase.
- Dragon Claw: three curling arcs gather at the moving hand from 0.08 s as three translucent violet/blue talons appear. The user winds up for 0.30 s then advances until 0.82 s. The talons rake upward from +0.95 to −0.35 radians with actor rotation +0.07. Central tip length is 40–76 units (0.30 source heights), meeting target center +6 Y. Three flowing wake curves, a three-line luminous rake and eighteen scale-shaped fragments accompany the hit. Charge fades by 0.90 s, rake by 1.22 s, talons by 1.32 s and fragments by 1.39 s; source returns by 1.63 s. Completion: 2.05 s. Fixed damage: 58.

The core and presenter require no new behavior. Checks cover capped damage, unchanged source stats/conditions/guards/trapping, no Metal Claw boost, central-tip contact before cues with custom/fallback/legacy anchors, wide/tall actors, reversed facing, viewport fitting, normal/reduced motion, cancellation/replay and fades before cleanup. Browser appearance remains unverified.

## Tackle, Return, Take Down and Double-Edge

Four separate recipes own their art, particles, approach and recovery. `solveContact('tackle', rotation)` aligns the supplied body contact anchor to the opponent center at scale one. Source-relative attachments update before cues. Neither actor fades; logical art units scale with the supplied actor and viewport fit.

- Tackle: a 0.14 s wind-up leads into a 0.26 s body check, contacting at 0.40 s with rotation +0.04. A small pressure arc, three short impact ticks and twelve dust motes replace long speed trails. Art radius is 25–43 units (0.20 source heights). The user bounces back 0.35 radii, then returns home by 0.94 s. Last dust fades by 0.77 s. Completion: 1.15 s. Fixed damage: 28.
- Return: three small warm hearts and a fine halo gather at the moving user center. After 0.24 s anticipation, a two-part bound rises half an art radius above the interpolated path before contacting at 0.78 s with rotation +0.065. Radius is 32–59 units (0.27 source heights). A six-ray bloom and twelve star-shaped sparks accompany the strike. Hearts fade by 0.77 s, halo by 1.03 s and sparks by 1.31 s; source returns by 1.56 s. Completion: 1.85 s. Maximum power label 102; fixed damage 72. Friendship is not stored or calculated.
- Take Down: a 0.30 s committed wind-up precedes a 0.36 s accelerating charge, contacting at 0.66 s with rotation +0.11. Four short wake strokes, an angular impact and seventeen dust motes accompany the collision. Radius is 32–59 units (0.27 source heights). The source rebounds 0.65 radii backward and 0.14 upward, leaning −0.12 radians; a small recoil mark and warm tint follow it. Target returns by 1.11 s, source by 1.57 s; last dust fades by 1.17 s. Completion: 1.90 s. Fixed damage 64; default source recoil 16.
- Double-Edge: a longer 0.38 s wind-up feeds a sharply accelerating 0.36 s rush with two trailing ribbons. Contact at 0.74 s uses rotation +0.14, opposing crescents, a narrow expanding ellipse and 24 scattered chips. Radius is 36–66 units (0.30 source heights). Source rebounds 0.90 radii backward and 0.20 upward with −0.19-radian lean; a separate ring follows its center. Target slides and shudders before returning by 1.30 s. Source returns and settles by 1.80 s; all art fades by 1.29 s. Completion: 2.15 s. Fixed damage 84; default source recoil 28.

Core uses `recoilDamage` fractions 0.25 and 0.33 for Take Down and Double-Edge, matching the Showdown reference. Recoil uses actual HP removed (`target.hp - afterHp`), rounded to nearest HP, minimum one for positive damage, capped by the user's remaining HP. Target overkill therefore cannot inflate recoil. Struggle keeps its separate quarter-maximum-HP basis. Both HP losses commit in the same immutable result before FX; the existing ordinary impact reveal displays them together. No healing/recovery cue is added. Ability interactions are outside the preview.

Checks include low target HP, half rounding, Double-Edge's 33% ratio (56 damage → 18 recoil), source HP capping and simultaneous fainting, state preservation, disabled/skipped/failed effects, stale callbacks, dynamic body contact across proportions and facings, continuous actor visibility, cancellation/replay, fades and full pose recovery. Browser appearance remains unverified.

## Slam, Stomp and Strength

Each recipe owns its shapes, motion, particles and recovery. Actor scale/opacity remain one, with contact solved against supplied semantic anchors. No new core or presenter behavior is needed. All are fixed single-hit previews without recoil; Stomp’s flinch chance and extra damage/accuracy against Minimize are not simulated.

- Slam: an explicit `tail` socket falls back to `hand`. A 0.24 s wind-up precedes a 0.28 s raised approach and a 0.22 s downward swing. Contact at 0.74 s aligns that socket to target center +5 local Y at rotation +0.13. Two broad curved pressure strokes end at the socket; a flattened impact shape and sixteen dust motes accompany the strike. Radius is 33–61 units (0.28 source heights). Sweep fades by 1.02 s, impact by 1.06 s and dust by 1.24 s; target returns by 1.18 s and source by 1.54 s. Completion: 1.85 s. Fixed damage: 56.
- Stomp: the supplied `foot` lands 45% of the way from target center toward its floor, avoiding an unnecessarily high landing. The user anticipates for 0.20 s, approaches/lifts for 0.28 s and strikes down for 0.18 s, contacting at 0.66 s with rotation +0.045. Art radius is 30–54 units (0.25 source heights). Extra lift is capped at 0.85 radii and conservatively limited by contact height minus actor height, rotation allowance and an eight-scene-unit margin. The release lift uses the same cap. A small footprint silhouette, two downward streaks, a flat pressure ring and fifteen spreading dust motes emphasize the foot. Art fades by 1.14 s; target returns by 1.05 s and source by 1.40 s. Completion: 1.65 s. Fixed damage: 46.
- Strength: paired tension arcs appear around the moving body during 0.10–1.30 s. A 0.30 s brace feeds a 0.42 s deliberate approach; `tackle` reaches the target center at 0.72 s with rotation +0.08. Both actors then move 13 local units with identical easing over 0.24 s, maintaining contact throughout the shove. Two pressure curves follow the pushed target, while twelve flecks rise from its original floor. Radius is 34–63 units (0.29 source heights). Pressure fades by 1.25 s, brace by 1.30 s and last fleck by 1.334 s; target returns by 1.35 s and source by 1.60 s. Completion: 1.95 s. Fixed damage: 58.

Checks cover custom tail/hand/foot/body sockets, mirrored wide/tall actors, artwork and actor alignment before cues, Strength’s sustained contact, sprite visibility, fades and pose restoration, cancellation/replay, normal/reduced motion and state preservation with effects disabled. Browser appearance remains unverified.

## Mega Punch, Meteor Mash, Dynamic Punch and Focus Punch

Four independent recipes attach to a supplied `fist` socket, falling back to `hand`. The front knuckle at local `(radius, 0)` meets the target center plus the stated local Y offset. Each recipe subtracts the rotated radius before solving the source pose, then updates the attachment before emitting impact. Both sprites retain full opacity and scale. Dimensions are logical art units adapted to actor metrics and uniform viewport fit.

- Mega Punch: radius 20–35 (0.13 source heights), contact Y +4, rotation +0.07. Wind-up ends at 0.22 s; a 0.34 s drive contacts at 0.56 s. Seven short impact rays, a narrow ellipse and thirteen chips provide a blunt hit. Art fades by 1.00 s; source returns by 1.30 s. Completion 1.65 s; fixed damage 56.
- Meteor Mash: radius 22–37 (0.15 source heights), contact Y +4, rotation +0.09. After 0.26 s anticipation, a raised approach ends at 0.52 s and drives down to contact at 0.78 s. The faceted steel fist carries three comet strokes and eleven trailing stars; sixteen fragments spread from its five-point impact. Art fades by 1.34 s; source returns by 1.56 s. Completion 1.95 s; fixed damage 64. The 20% user Attack boost is not simulated.
- Dynamic Punch: radius 25–41 (0.17 source heights), contact Y +6, rotation +0.10. A 0.30 s wind-up and 0.40 s drive end in a nine-point amber burst and twenty-one fragments. Three dizzy stars orbit the live target center from 0.95 s, fading by 2.13 s. Source returns by 1.50 s. Completion 2.35 s; fixed damage 70. The core applies separate confusion to surviving targets; stars remain cosmetic and read no battle state.
- Focus Punch: radius 26–43 (0.17 source heights), contact Y +5, rotation +0.09. The user winds up for 0.28 s, holds until 1.00 s, then drives for 0.34 s. Twelve inward rays, two contracting fist rings and a brief flash signal anticipation. Contact uses a narrow bright star, ellipse and ten outward rays. Art fades by 1.78 s; source returns by 2.20 s. Completion 2.55 s; fixed damage 100. This is a successful execution preview without priority, interruption or a Focus Energy flag.

Numerical checks cover front-knuckle contact with custom/fallback sockets, wide/tall actors, reversed facing and viewport fit; normal/reduced motion, fade, cancellation/replay and pose cleanup; confusion coexistence with major conditions, survival gating, effects off/skip/failure and stale reset cues. Browser appearance remains unverified.

## Rock Blast, Ancient Power and Rock Tomb

Each recipe owns its stone silhouettes, facets, trails, motion and debris. No assets or dependencies were added. Positions use actor sockets and logical dimensions; camera fit handles viewport resizing. Both actors retain their full opacity and scale.

- Rock Blast: three emission launches at 0.32/0.52/0.72 s fly for 0.40 s each. Radius is 14–22 units (0.10 target heights); the firing pose is held through the final release. Spinning stones use narrow matte trails and arrive at center with small vertical lane offsets. Each impact has a tight elliptical ring and nine chips. Only the first contact, 0.72 s, emits a result cue. Source returns by 1.32 s; last debris fades by 1.56 s; completion 1.85 s. Fixed total damage 54. Power 25 is labeled per hit; the three-shot preview does not roll the usual 2–5 hits or resolve separate per-hit results.
- Ancient Power: five stones rise from the source floor toward a charged aura from 0.16 s with 0.06 s staggering. Radius is 12–22 units (0.085 source heights). Two fine elliptical rings and twelve orbiting motes frame the charge. Runes glow on faceted stones; launches at 0.86 s with 0.055 s staggering travel for 0.48 s along lightly bowed routes. Their arrival points follow the posed opponent. First impact at 1.34 s emits one cue and a double pulse; each stone scatters six fragments. Source returns by 1.66 s, target recoil ends by 1.76 s, last fragments fade by 2.08 s; completion 2.40 s. Fixed damage 44; the 10% five-stat boost is outside this preview.
- Rock Tomb: four boulders fall for 0.42 s and land at 0.70/0.80/0.90/1.00 s. Radius is 20–36 units (0.15 target heights), horizontal span is bounded to 92 units and derived from target width. Start heights respect stage headroom. Rear/front landing points sit around the supplied floor, leaving the middle of the actor readable. After landing, each slides inward by 0.32 radii over 0.22 s and leans inward. Seven moving dust puffs per stone and a floor ellipse soften each landing. Boulders crumble and fade from 1.50–1.95 s, with sixteen gravel pieces fading by 2.05 s; completion 2.30 s. The first landing emits one cue. Fixed damage 42 and surviving-target Speed −1 commit together; the Speed floor cannot cancel the damage. No trapping is applied.

Checks cover held emission launch, all volley arrivals, live target recoil, custom center/aura/floor sockets, reversed wide/tall actors, Rock Tomb closure and viewport fit, ordinary/reduced motion and cleanup, and combined damage/Speed results through effects-off, skip, failure and reset. Browser appearance remains unverified.

## Confusion, Hypnosis and Confuse Ray

Three separate recipes own their shapes, motion, particles and fade timing. An optional source `eyes` socket falls back to `emission`. Source artwork and target fields resolve posed anchors every update, including on the contact callback. All sizes are logical art units adapted to actor metrics; both sprites stay fully visible at their supplied scale.

- Confusion: a small source glint triggers three tilted elliptical bands around the target. Radius X is 34–70 units (0.30 target widths); radius Y is 30–62 (0.29 target heights). The field grows from 0.27 s, compresses to 67% over 0.52–0.66 s, then expands to 114% in 0.20 s. Impact at 0.66 s adds eight short pressure marks, fourteen pink/lilac flecks and a six-unit recoil. Source returns by 1.02 s; all art fades by 1.26 s; completion 1.55 s. Fixed damage 34; the 10% confusion secondary is not rolled.
- Hypnosis: five double elliptical rings launch from 0.24 s with 0.13 s spacing and travel for 0.68 s. Their radius is 22–40 units (0.18 target heights); the narrow ellipse turns along the source-to-target direction. First arrival at 0.92 s applies the cosmetic cue. Rings expand and dissolve for 0.22 s after arrival. Closed-eyelid strokes appear above the live center, followed by three rising Z glyphs from 1.02 s with 0.22 s spacing and 0.78 s life. Glyph mirroring is compensated. Target settles by 1.91 s; final glyph fades at 2.24 s; completion 2.55 s. Zero damage; core applies sleep only when no major condition is occupied, preserving independent confusion.
- Confuse Ray: a small golden source light releases two thin intertwined ribbons over 0.26–0.98 s. The bright leading orb follows a wave whose displacement tapers to zero at both endpoints; maximum lateral displacement is 10–18 units (0.075 target heights). Contact at 0.98 s begins two moving spirals and seven orbiting glints around the target, radius 24–42 (0.20 target heights). Ray, head and source fade by 1.26 s; source pose returns by 1.55 s; spirals fade by 2.10 s; completion 2.35 s. No HP damage; core sets separate confusion and fails unchanged if already confused.

Checks cover eye/emission fallback, custom target centers, contact before cues, following posed actors, mirrored glyph readability, alternate actor proportions and viewport fit, normal/reduced motion, fading and cleanup. Core/presentation checks cover existing major statuses, independent confusion, repeated application, effects-off, skip/failure and stale reset cues. Browser appearance remains unverified.

## Explosion and Self-Destruct

Both independently authored recipes use the source center for their detonation and a narrow traveling pressure arc for target contact. Only the local blast is filled; the path across the field is not a screen-sized flash. Source motion stops before the detonation, and neither sprite changes opacity or scale. The leading midpoint of each quadratic pressure arc is local `(0, 0)` and reaches the posed target center before its cue. Window fit and supplied actor metrics control placement and coverage.

- Explosion: radius 62–102 units (0.40 source heights). Ten inward charge ticks compress while the source shudders from 0.18–0.66 s, returning home before the 0.72 s detonation. Nine overlapping lobes, a warm inner ellipse and bright cross expand to 108% over 0.24 s and fade by 1.25 s. Three source rings stagger by 0.10 s, expanding to 136%. A narrow pressure arc travels from 0.72–1.10 s, when the single cue reveals the committed result and a target ellipse appears. Twenty-eight chips scatter from the source; ten drifting smoke puffs fade by 2.072 s. Target returns by 1.60 s; completion 2.50 s. Fixed target damage 124; default target HP 36 and user HP zero.
- Self-Destruct: radius 46–80 units (0.31 source heights). Two tight rings contract to 55% while the source shudders from 0.14–0.44 s. A twelve-point burst detonates at 0.50 s, expands to 103% over 0.16 s and fades by 0.84 s. One source ring expands while a pressure arc travels for 0.34 s, contacting the target at 0.84 s. Eighteen chips and eight matte dust puffs disperse; latest dust fades by 1.575 s. Target recoil ends by 1.10 s; completion 1.85 s. Fixed target damage 100; default target HP 60 and user HP zero.

The core's `selfDestruct` rule sets source HP directly to zero regardless of current HP or target overkill. Source fainting and target damage commit together, with dedicated `selfDestruct`, `sourceBeforeHp` and `sourceAfterHp` event fields. They are not recoil or drain healing. The ordinary impact reveal displays both changes and the host's HP-derived fainted badges; effects-off, skipping or failure must produce the same result. Replay starts a fresh preview. Both remain Normal-type single-opponent demonstrations; spread targets, Damp, immunity, protection and accuracy rolls are not simulated.

Checks cover low starting HP, target overkill and simultaneous fainting, immutable fields, effects-off/skip/failure/reset, source-centered detonation, leading-edge contact, custom centers, reversed wide/tall actors, viewport fit, normal/reduced motion and full cleanup. Browser appearance remains unverified.

## Vital Throw, Submission, Sky Uppercut and Seismic Toss

Four independent recipes use the supplied visible dimensions and sockets. The host adds a reserved `visualCenter` socket at the geometric center of visible art, separate from a custom anatomical `center`. Target rotation is compensated around this geometric center. Full flips use the target's half-diagonal to check available space; cramped layouts use a smaller lean. Lift respects headroom. Each recipe also fits the rotated source silhouette into the scene; at an edge, the grip can move lower on the target instead of clipping the source. Actor opacity and scale stay one, and window fit preserves logical placement.

- Vital Throw: hand grip at 0.42 s, followed by a 0.66 s backward flip with a short pull toward the source. Lift is capped at 55 units. A narrow trajectory arc, floor ring and fourteen dust particles mark landing at 1.08 s. Source returns by 1.40 s; dust ends by 1.60 s; completion 1.90 s. Fixed damage 48. Accuracy metadata reads Always; priority is outside the preview.
- Submission: grip at 0.48 s, then a 0.64 s rolling grapple. The source hand follows the target's posed center where bounds permit; two rotating partial loops surround the tumble. Landing at 1.12 s adds a floor ring and sixteen chips; a separate source recoil ring follows. Source returns by 1.88 s; completion 2.20 s. Core commits 56 damage plus recoil of one quarter of actual removed HP, using the existing recoil event and presentation.
- Sky Uppercut: explicit `fist` socket or `hand` fallback. The upward front knuckle at local `(0, -radius)` reaches its fitted contact point at 0.62 s after a low approach and sharp 0.18 s rise. Radius 18–31 units, based on source height. Two narrow wind curves, a vertical impact star and thirteen flecks reinforce the ascent. Both actors make a bounded additional lift. Target returns by 1.41 s, source by 1.56 s; completion 1.95 s. Fixed damage 60; airborne interactions are not simulated.
- Seismic Toss: grip at 0.46 s and launch through 0.98 s, a brief held turn, then an accelerating 0.34 s descent landing at 1.50 s. Lift is capped at 155 units and 72% of target height. Four falling streaks, two ground rings, short cracks and twenty-two moving dust puffs mark the slam. A small bounce settles by 1.77 s; last dust ends by 2.10 s; completion 2.45 s. Core damage equals validated user level (default 50), capped by remaining target HP; FX receives no level or HP.

Checks cover grab/fist contact before cues, landing pose, custom registration origins and centers, reversed wide/tall actors, upper-edge bounds, viewport fit, normal/reduced motion, cancellation and recovery. Core checks cover level limits and actual-damage recoil; effects-off preserves the committed outcomes. Browser appearance remains unverified.

## Opponent perspective

Every timing and recipe in the table also applies when the far-side Pokémon acts. See [Opponent previews](OPPONENT_PREVIEW.md) for the coordinate corrections, metadata contract and full 251-move coverage. Gravity, colors, counts and durations stay the same under horizontal reflection. Actor dimensions and supplied anchors determine placement; the field remains in the player's perspective.


## Field weather: Rain Dance, Sunny Day, Sandstorm and Hail

All four are independent recipes drawn in scene coordinates. `scene.unit` controls stroke and particle sizes; logical width/height control coverage. They do not depend on actor dimensions, positions, artwork or which side used the move. The existing camera fit handles the window size. Actors and platforms remain still and readable through low-opacity weather layers.

| Move | Activation | Duration | Appearance |
|---|---:|---:|---|
| Rain Dance | 0.65 s | 3.10 s | Nine drifting cloud patches, 76 staggered diagonal rain streaks in varied depths, thin elliptical splashes at each landing. Rain emission tapers after 2.25 s; full fade 2.45–3.00 s. |
| Sunny Day | 0.75 s | 2.80 s | Small sun at 50% width/9% height, seven slowly drifting broad rays, restrained warm wash and 18 rising heat glints. Full fade 2.10–2.70 s. |
| Sandstorm | 0.70 s | 3.20 s | Five undulating dust bands with two stronger gust pulses and 86 lateral grains, including heavier hopping chips near the ground. Movement continues through fade 2.45–3.10 s. |
| Hail | 0.65 s | 3.05 s | 48 staggered faceted ice pellets fall with acceleration, bounce once and split into two fading chips each. Cool wash; full fade 2.40–2.95 s. |

`subject: 'field'` accepts a source without an opponent. Field effects keep their gravity and composition from either side rather than mirroring the sky. Their reduced-motion treatment is a 10%-opacity field wash with activation at 0.2 s and completion at 0.8 s. All temporary weather art ends with the timeline, and cancellation/replacement uses existing runtime ownership.

Core sets one field weather value and increments the revision without changing actors. The host commits before playback and reveals its weather badge at activation, reconciling on skip, failure or effects-off. The badge persists until the next preview/reset; replacing weather in sequential core calls also works. This is a weather preview without turn duration, damage modifiers, residual damage or abilities. Hail remains the requested move, not a replacement Snow animation.

Weather verification: all 97 tests and the production build passed, including all 140 moves from both sides across nine starter pairings, the 96 original geometry reference frames, weather field-state/presenter checks, source-only playback, actor-size invariance, continuous flow, cancellation and reduced motion. Browser pixel appearance remains unverified.


## Fire Punch, Thunder Punch and Shadow Punch

Each move owns its fist shape, particle movement and timing. An explicit `fist` socket falls back to `hand`; local art units adapt through the coordinate adapter. The player/opponent versions use the same recipe, and actor scale and opacity stay at one. Existing punches and all sprite/platform geometry are preserved.

| Move | Contact | Duration | Target HP | Color | Choreography |
|---|---:|---:|---:|---|---|
| Fire Punch | 0.68 s | 1.80 s | 110 | #ffbb78 | Low wind-up, forward hook, six moving flame tongues, five-lobed impact fan and 17 rising embers. |
| Thunder Punch | 0.52 s | 1.60 s | 110 | #ffe89a | Brief charge, fast straight jab, eight branching bolts and 15 angular sparks. |
| Shadow Punch | 0.74 s | 1.85 s | 116 | #c7a3dd | Spectral fist detaches from the user, leaves three delayed fists, then breaks into hollow crescents and 12 inward-curling wisps. |

- Fire Punch: radius 19–32 local units (12% source height), charge from 0.12 s, approach 0.24–0.46 s, final hook 0.46–0.68 s. Fist swing closes to zero at contact. The fan expands and fades 0.77–1.04 s; fist fades 0.86–1.10 s; source returns 0.92–1.42 s. Embers continue rising independently of facing.
- Thunder Punch: radius 18–30 units (11.5% source height), crawling charge from 0.08 s, direct jab 0.32–0.52 s. Irregular branches continue moving through their 0.62–0.92 s fade. Sparks travel radially without ember gravity. Source returns 0.80–1.23 s.
- Shadow Punch: radius 20–33 units (12.5% source height), gathers 0.06–0.31 s and launches from the current socket at 0.32 s. The curved route ends at the posed target center at 0.74 s, subtracting the rotated knuckle radius. Three delayed fist images track the same route. The user remains at its own slot. Fist fades 0.78–0.98 s; crescents fade through 1.18 s; curling wisps finish by 1.40 s.

Fire/Thunder clamp the source's rotated visible bounds within the field, maintaining fist attachment and a consistent impact point. All three cap target recoil by the available space toward the field edge. All cues follow the per-frame contact update. Core resolves fixed 50/50/44 damage respectively; random burn/paralysis, immunities and abilities are not simulated. Shadow Punch displays reference accuracy as Always. The existing reduced-motion, no-FX, cleanup and both-side paths require no runtime changes.

Verification: the full 98-check suite passed, followed by targeted checks for bounded recoil and sprite silhouettes in edge layouts, including new fist-tip/socket checks, Shadow Punch launch/contact/recoil tracking, cancellation, reduced motion, all 140 moves from both sides across nine starter pairs, and the original reference geometry. Browser pixel appearance remains unverified.


## Mega Kick, Low Kick, Rolling Kick, Double Kick, Triple Kick, Jump Kick and High Jump Kick

These seven independent recipes add to the existing Blaze Kick. Blaze Kick's artwork, timing, rules and metadata remain unchanged. All new foot shapes attach to the supplied `foot` socket; the visible toe at `(r, 0)` reaches the actual fitted contact point, including any animated swing or foot-art stretch. Actor sprite scale and opacity remain one.

| Move | Visual contacts | Result cue | Duration | Final target HP | Distinct appearance |
|---|---|---:|---:|---:|---|
| Mega Kick | 0.82 s | 0.82 s | 2.00 s | 76 | Deliberate chamber, broad side boot, forceful drive, compressed pressure wedge and 18 chunky chips. |
| Low Kick | 0.56 s | 0.56 s | 1.50 s | 118 | Shallow sole sweep low on the opponent, thin ground crescent and 16 skimming grit particles. |
| Rolling Kick | 0.86 s | 0.86 s | 1.90 s | 116 | Roundhouse pivot with three circling motion arcs, a curved heel and 14 tangential flecks. |
| Double Kick | 0.52 / 0.94 s | 0.94 s | 1.90 s | 116 | Two sharp thrusts at different heights, visible retraction, two elliptical contact stamps and nine particles per strike. |
| Triple Kick | 0.50 / 0.84 / 1.20 s | 1.20 s | 2.25 s | 100 | Three rising kicks; foot artwork grows to 100% / 115% / 130%, with progressively larger stars and 8 / 11 / 14 splinters. |
| Jump Kick | 0.84 s | 0.84 s | 2.00 s | 90 | Forward hop, extended sole, diagonal speed rails, narrow compression flash and 14 chips. |
| High Jump Kick | 1.08 s | 1.08 s | 2.30 s | 70 | Upward gather, brief apex hold, descending bent sole, tall pressure wedge and 18 downward rays. |

The shared coordinate adapter only maps actor sockets, units and facing; every new file owns its local bounds math, paths, drawing and timeline. Foot-art radius is clamped in local units: Mega 26–43 (17% source height), Low 21–35 (14%), Rolling 22–36 (14.5%), Double 21–34 (13.5%), Triple 18–29 (11.5%), Jump 24–39 (15.5%), High Jump 25–41 (16%). Source height is divided by the adapter unit before applying the factor.

Local fitting uses geometric `visualCenter` (or the adapter's center fallback), clamps actor lean when its rotated dimensions would exceed the logical field, and keeps the complete silhouette within the scene. Contact points are recomputed from the fitted toe. Recoil is limited by available space toward the scene edge. Gravity and vertical motion remain unchanged when the acting side is reversed.

Double Kick retracts from 0.56–0.72 s before its second strike; Triple Kick retracts at 0.54–0.66 and 0.88–1.01 s. Target recoil returns home before each later strike. Every contact updates the foot before its impact artwork, but only the final strike emits the public result cue. There is one fixed total damage result, never a damage callback per visual kick. Source recovery finishes at 1.64 s for Double and 2.00 s for Triple.

Jump Kick reaches its apex at 0.51 s and lands at 0.84 s, recovering by 1.67 s. High Jump Kick reaches its apex at 0.58 s, holds through 0.78 s and lands at 1.08 s, recovering by 2.00 s. Apex positions derive from both home and contact visual centers and available headroom. This preserves a real descending segment when the near-side Pokémon attacks the higher far-side position.

Reference move IDs, type, power and accuracy follow [PokeAPI's move dataset](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv). Low Kick displays variable power; Double Kick displays power per hit, and Triple Kick first-hit power. Showcase damage remains fixed. Weight-based calculations, per-hit accuracy/power, flinching, misses and crash damage are not simulated.

Verification: 69 core/FX/opponent integration checks and four focused kick checks passed, covering every move from both sides across nine starter pairings, foot/toe placement at every contact, custom/legacy sockets, complete sprite bounds, jump descent, cancellation/replay, reduced motion and no-effects outcomes. Browser pixel appearance remains unverified.


## Seed, needle, star and thrown-object projectiles

All twelve recipes own their artwork, trajectories, particles and timelines. They add no runtime visual helpers or assets. The existing 140 effects are unchanged. The default roster, sprite scaling, fixed platforms and move controls are unchanged.

| Move | Shot count | First launch | Result cue | Duration | Final target HP | Appearance |
|---|---:|---:|---:|---:|---:|---|
| Bullet Seed | 5 | 0.25 s | 1.03 s | 1.70 s | 110 | Five rapid seeds cut through narrow green trails and break into husk flecks. |
| Pin Missile | 4 | 0.30 s | 1.12 s | 1.80 s | 116 | Four finned needles fan outward and converge into sharp, staggered impacts. |
| Spike Cannon | 3 | 0.28 s | 0.97 s | 1.65 s | 116 | Three thick ivory spikes fire in a forceful rhythm with muzzle rings and splintering impacts. |
| Icicle Spear | 3 | 0.34 s | 1.24 s | 2.00 s | 110 | Three faceted ice spears streak forward and shatter into falling crystal shards. |
| Poison Sting | 1 | 0.28 s | 0.72 s | 1.50 s | 142 | A violet barbed dart leaves a thin wake and a small burst of poisonous droplets. |
| Twineedle | 2 | 0.28 s | 0.91 s | 1.60 s | 128 | Two golden stingers cross through opposed bends and strike in quick succession. |
| Swift | 5 | 0.32 s | 1.28 s | 2.05 s | 118 | Five spinning golden stars seek the opponent along curved, sparkling trails. |
| Pay Day | 3 | 0.32 s | 1.20 s | 1.95 s | 132 | Three tumbling gold coins arc toward the opponent and scatter bright metallic sparks. |
| Rock Throw | 1 | 0.40 s | 1.07 s | 1.95 s | 120 | A single craggy rock tumbles through a high lob and breaks into gravel and drifting dust. |
| Egg Bomb | 1 | 0.38 s | 1.13 s | 2.10 s | 90 | A speckled egg arcs into the opponent, cracks open and bursts into shell pieces and smoke. |
| Barrage | 5 | 0.27 s | 1.21 s | 1.95 s | 118 | Five round seed bombs bounce through shallow arcs and burst in a rapid series of small pops. |
| Present | 1 | 0.42 s | 1.32 s | 2.35 s | 104 | A ribboned gift lobs toward the opponent, pauses, then opens in a burst of paper and confetti. |

Each projectile captures its current emission/attachment socket at launch. Sources hold their firing pose through the last launch; detached shots retain their launch position when the actor recovers. Targets are sampled during travel; each impact captures the posed contact point so debris stays at the collision while the recipient recoils. Per-shot lanes are clamped to the recipient's visible vertical bounds. Contact geometry updates before the cosmetic cue. Multiple shots reveal one already-committed damage result on the final contact.

- Bullet Seed: five launches 0.105 s apart; 0.36 s straight flight, olive oval seeds with seams, thin green streaks and seven husk chips per contact. Radius 6–10 local units at 4.4% target height.
- Pin Missile: four launches 0.12 s apart; 0.46 s flight, opposed sine-bow fan and six splinters per hit. Optional `spike` socket falls back to `emission`. Radius 7–12 at 5.2% target height. Positive and negative bends use available bottom/top room respectively.
- Spike Cannon: three launches 0.19 s apart; 0.31 s straight flight, thick ivory cones, expanding muzzle rings and eight fragments per hit. Uses `spike`/`emission`; radius 9–15 at 6.4% target height.
- Icicle Spear: three launches 0.20 s apart; 0.50 s shallow arched flight, faceted long ice tips, frosted streaks and twelve falling shards per impact. Radius 9–15 at 6.4% target height; shards use positive downward gravity.
- Poison Sting: one 0.44 s flight with a shallow curved wake, violet barbs, focused puncture flash and nine droplets. Uses `stinger`/`emission`; radius 7–11 at 4.9% target height.
- Twineedle: exactly two launches 0.20 s apart, each with 0.43 s flight. Opposed double-sine paths cross during flight; gold stingers leave eight flecks per hit. Uses `stinger`/`emission`; radius 8–12 at 5.3% target height.
- Swift: five launches 0.085 s apart; 0.62 s curved seeking flight. Five-point gold stars spin over twelve-segment trails and release six glints each. Radius 10–16 at 7.1% target height. Stars are one move hit, not a multi-hit battle rule.
- Pay Day: three launches 0.15 s apart; 0.58 s upward parabolic lob. Diamond-embossed coins rotate and compress in X to show tumbling without reaching zero width, then ping into seven sparks each. Uses `coin`/`emission`; radius 10–16 at 7% target height. No readable text is mirrored.
- Rock Throw: one 0.67 s high parabolic lob, angular facets and continuous tumble, six expanding dust clouds and thirteen heavier gravel pieces. Uses `rock`/`hand`; radius 20–30 at 14% target height. Dust drifts while gravel falls.
- Egg Bomb: one 0.75 s lob, speckled cream egg and gentle tilt. Contact draws a shell crack; ten shell pieces release immediately, followed 0.055 s later by twelve smoke puffs. A compact warm glow fades by 1.48 s. Uses `egg`/`hand`; radius 18–27 at 12% target height.
- Barrage: five launches 0.13 s apart; alternating 0.42/0.45 s shallow parabolas. Seamed round nut bombs tumble in opposed directions and produce eight chips each. Radius 11–16 at 7.1% target height. The shortest contact gap is 0.10 s; target recoil finishes in 0.07 s.
- Present: one 0.72 s buoyant lob reaches the target at 1.14 s, then holds with a rattling lid. The box opens at 1.32 s with the result cue; the lid lifts and turns, the body dissolves, and 26 colored paper pieces scatter with downward gravity. All paper fades by 2.08 s. Uses `gift`/`hand`; radius 17–25 at 11% target height.

Needle, cone and spear visible tips are authored at local `(0, 0)` so their flight roots are their contact points. Centered seeds, stars, coins, rocks, eggs and gifts use their body centers. Target height is divided by the coordinate adapter's unit before each radius factor; the resulting art is uniformly scaled. Lobs subtract an upward bow capped by scene headroom. Horizontal reflection changes travel direction while keeping gravity downward. Actor scale/opacity remain one, and bounded wind-up/recoil restore before completion.

Reference IDs, types, power and accuracy follow [PokeAPI's move dataset](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv). Repeated-hit moves label power per hit. Swift displays Always accuracy. Present retains variable canonical power and explicitly previews the 80-power damaging outcome with fixed 56 damage. Hit-count rolls, per-hit calculations, random poisoning, money awards and Present's random damage/healing selection are not simulated. No core resolver, presenter or scene API changes are needed.

Verification: 72 focused integration/projectile checks and the production build passed. Launch/arrival checks cover custom and fallback sockets, both directions and wide/tall actors. Low-edge paths, target-lane bounds, final-only cues, Present opening, full pose recovery, cancellation and reduced motion are covered. Browser pixel appearance remains unverified.


## Fly, Bounce, Dig and Dive: separate round clips

There are four public move IDs and eight independently authored clips. Both the game and playground expose Round 1 · Prepare and Round 2 · Attack. Each clip resets its actor poses when it finishes; attack clips begin from their own airborne/submerged pose and do not depend on preparation having played. The source may intentionally disappear during these clips; the opponent stays visible.

| Move | Round 1 appearance | Prepared cue / duration | Round 2 appearance | Impact / duration | Attack damage |
|---|---|---|---|---|---:|
| Fly | Twin takeoff gusts, accelerating ascent, narrow launch ring and twelve wind wisps | 0.94 / 1.40 s | Diagonal swoop, three trailing air rails, crossing gust and eighteen featherlike flecks | 0.68 / 1.95 s | 64 |
| Bounce | Ground-centered crouch, vertical spring, two expanding rings and twelve dust puffs | 0.94 / 1.35 s | Almost vertical fall, rounded speed envelope, flattened pressure stamp, twenty dust puffs and one rebound | 0.84 / 2.05 s | 58 |
| Dig | Scraping chips, dark soil opening, jagged near lip, masked descent and closing hole | 0.96 / 1.50 s | Ground bulge and cracks, upward emergence, thirty soil fragments and a compact body hit | 0.82 / 2.20 s | 56 |
| Dive | Glossy water opening, smooth submersion, three flowing ripples and twenty-three bubbles/drops | 1.06 / 1.65 s | Gathering bubbles, two upward splash sheets, thirty-two bubbles/drops and expanding ripples | 0.98 / 2.40 s | 56 |

Fly preparation accelerates upward from 0.23–0.91 s, fading during the last part of its exit. Its lift is the supplied ground-to-scene-top distance plus a small margin. The source's backward shift is bounded by available horizontal room. Fly attack descends from an independent offscreen start from 0.10–0.68 s into the supplied `tackle` contact. A short upward recovery leads into its return by 1.62 s.

Bounce preparation compresses to at most 107% width and 88% height around `ground`, with horizontal fitting for edge layouts. It releases at 0.33 s and rises through 0.90 s. Bounce attack stays at full sprite scale, descends 0.16–0.84 s into `slam`, and rebounds to a headroom-limited apex before returning by 1.75 s.

Dig preparation opens the source-ground hole at 0.08 s and sinks the actor copy from 0.26–0.93 s behind the owned mask. The dark opening closes from 0.95 s; all soil fades before the clip ends. Dig attack begins below the target's ground, rises from 0.32–0.82 s into `body`, then clears the opening before returning. It switches from owned copy to the visible live actor at 1.10 s, with matching coordinates, and returns by 1.78 s.

Dive preparation opens the water pool from 0.04 s, sinks 0.30–1.03 s, and retains moving ripples until 1.49 s. Dive attack gathers bubbles before its 0.45–0.98 s rise into `body`. Curved water sheets grow upward, then collapse with positive downward droplet gravity; their ripples continue expanding through the fade. It switches from copy to live actor at 1.30 s and returns by 2.02 s. Water geometry stays local to the recipient, with radius clamped to 42–88 art units.

All four attack contacts solve from semantic sockets and fit the source's visible bounds. Contact geometry updates before the cue; target push/lift is bounded by the logical scene. Horizontal reflection changes the approach direction without reversing gravity. Dig/Dive masks and copies belong only to the temporary layer, share but never destroy source textures, and end exactly at the supplied `ground` plane. Adapters without snapshots use a fade fallback. Scene platforms and original sprite sizing/art remain untouched.

The FX request `phase` selects the independent preparation descriptor before actor lookup. Preparation emits `prepared`, has no target requirement and no HP result. Default attack emits `impact` and follows existing result handling. `PHASE_TIMINGS` contains both phase contracts; reduced-motion variants retain their distinct cue types at 0.20 s and complete at 0.80 s. No retained hidden pose, turn state, semi-invulnerability or Bounce paralysis roll is introduced.

Move reference metadata follows [PokeAPI's official move table](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv): Fly #019 Flying 90/95%, Bounce #340 Flying 85/85%, Dig #091 Ground 80/100%, Dive #291 Water 80/100%. The damage figures above are fixed showcase values.

Verification: all 111 checks and the production build passed, including both phases from both sides, preparation without an opponent, unchanged preparation state, effects-off/skip/failure routing, masked-copy alignment, custom sockets, cancellation while concealed and the original geometry references. Browser pixel appearance remains unverified.

## Dragon Breath, Sacred Fire and restored Overheat

The catalog contains 164 moves. Dragon Breath now reuses Flamethrower's complete choreography with a violet palette, as explicitly requested. Its independent recipe retains the same dynamic anchors, stream dimensions, emitter rate, particle movement, glow, recoil and camera motion. Contact is 0.90 s and completion 2.65 s. The mouth is `#a252f0`; hot, medium and outer particles use `#ead1ff`, `#bd7aff` and `#7d3de0`; impact tint is `#c8b0ec`. Fixed preview damage remains 42 (target HP 118 from 160).

Overheat is restored byte-for-byte from the dynamic recipe at `56122fa6fc59ee68d39285d02e37dec264da1f7f`, before the rejected radial eruption. It retains its original charge, broad heat surges, particles and recovery, with 0.98 s contact, 2.50 s completion and 92 damage (target HP 68).

Sacred Fire now charges with a soft golden glow and contracting arcs, then accelerates a layered flame comet from 0.40–0.94 s. Three filled, flowing ribbons and twelve trailing wisps give the flame continuous motion. At contact, a brief ivory flash, warm bloom and two thin expanding rings lead into seven independently curling/rising flame tongues and thirty ascending embers. Orange `#f06b20`, gold `#ffbf43`, pale gold `#fff0ae` and ivory `#fffbed` separate the layers. The base radius remains 20–30 art units; full rotated contours, glows, rings and particles fit available field space. Target recoil is capped at 12 art units; actors retain their scale and opacity. Effects dissipate by 1.92 s, completion remains 2.20 s, and damage remains 72 (target HP 88).

Dragon Breath paralysis and Sacred Fire burn/thawing remain unsimulated. No core rules, sprite sizes, platforms or shared FX runtime change. Deterministic playback compares Dragon Breath with Flamethrower under an explicit palette mapping, including particle bounds, opacity, poses and cue timing in both directions with tall/wide actors. Overheat again matches its three original reference frames, restoring the 32-move / 96-frame regression set. Browser pixel appearance remains unverified.

## Psybeam and Signal Beam

Aurora Beam already exists and is unchanged. The two additions bring the catalog to 160 moves, available from both sides through the same optional FX package.

| Move | Contact / completion | Fixed damage / target HP from 160 | Appearance |
| --- | --- | --- | --- |
| Psybeam | 0.68 / 2.30 s | 46 / 114 | Violet/magenta rippling light with ten elliptical pressure pulses and expanding psychic rings. |
| Signal Beam | 0.61 / 2.15 s | 52 / 108 | Red/lime strands wound around a pale core, sixteen fast packets and segmented impact rings. |

Psybeam charges from 0.06 s, grows from 0.42–0.68 s and fades from 1.42–1.70 s. Ten pulses start every 0.075 s from 0.42 s with 0.26 s travel and 0.14 s local fades. Three expanding rings and twenty-two motes accompany the first contact. Stream layers use `#9464e6`, `#bf8df0` and `#f4c9f4`; radius is 16–25 art units and the widest line is 18 units. The source returns from 1.78–2.10 s.

Signal Beam charges from 0.04 s, grows from 0.36–0.61 s and fades from 1.35–1.60 s. Two opposing sine strands use `#ff6975` and `#bcf565` over a pale `#f6f3c5` center. Sixteen packets launch every 0.05 s with 0.25 s travel and 0.10 s fades. A rotating hexagonal lens marks emission; three segmented rings and twenty-four colored chips mark contact. Radius is 12–19 units, broad translucent strand width is 11 units and the bright strand width is 33% of that. The source returns from 1.66–1.99 s.

Both hold their firing poses until the beams fade, track semantic live endpoints, cap complete artwork to available edge room and restore poses on completion/cancellation. Only one impact cue and fixed result are applied. Window resizing uses the existing uniform scene fit.

Reference metadata follows [PokeAPI's move table](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv): Psybeam #060 is Psychic, power 65, accuracy 100%; Signal Beam #324 is Bug, power 75, accuracy 100%. Their confusion chance is not simulated. The 69 core/FX/opponent integration checks and three focused beam checks passed, including both sides, all nine starter profiles, contact-before-cue, continued flow, upper/side bounds and cleanup. Browser pixel appearance remains unverified.

## Counter, Mirror Coat, Pain Split and Endeavor

The catalog now has 164 moves. Each addition owns its geometry and timeline; existing recipes, sprites and platforms remain unchanged.

| Move | Contact / completion | Appearance | Default near-side sample |
| --- | --- | --- | --- |
| Counter | 0.78 / 1.90 s | Compressed guard marks, a fast palm retaliation, warm trails and a compact starburst. | User starts at 124 HP after a sample 32 physical damage; target takes 64 and ends at 96. |
| Mirror Coat | 0.92 / 2.10 s | A translucent faceted mirror catches six incoming motes, flashes and returns three rose-white rays. | User starts at 120 HP after a sample 36 special damage; target takes 72 and ends at 88. |
| Pain Split | 1.40 / 2.20 s | Two colored auras exchange twenty orbs along opposite arcs, then pulse together. | User 62 and target 160 become 111 each. |
| Endeavor | 0.70 / 1.90 s | A held brace, determined rush, ivory pressure front, expanding impact ring and fading motes. | User starts at 54 HP; target falls from 160 to 54. |

Counter's source braces over 0.22 s and lunges from 0.44–0.78 s. Its palm uses an optional `fist` socket with `hand` fallback, an 18–29 unit radius, and a short cosmetic extension when fitting a large source prevents a full lunge. Eighteen orange/gold chips follow impact. Source recovery ends at 1.44 s.

Mirror Coat's incoming motes begin at 0.18 s and take 0.32 s to reach its source aura. The shield has a 28–43 unit radius and translucent rose facets. Three rays launch at 0.54, 0.575 and 0.61 s with 0.38 s flight; only the first emits impact. Their visible leading tips are local zero. Facets fade by 1.30 s, impact shards by 1.62 s, and the source returns by 1.72 s.

Pain Split holds both actors still. Ten orbs per direction launch every 0.04 s from 0.34 s; each takes 0.70 s. Opposing sine arcs vanish at their live aura endpoints. All transfers finish by 1.40 s before the sole impact cue, and all orbs fade by 1.58 s. Halo radius is 21–33 units and all auras fade by 1.99 s. The effect never assumes which actor gains HP.

Endeavor braces to 0.27 s, rushes from 0.34–0.70 s and recovers from 1.01–1.46 s. Five ivory speed trails lead into a 25–39 unit pressure front and twenty motes. Actor silhouettes are fitted without scaling, and the pressure front meets the semantic target center even when extreme layouts require a shorter body approach.

All four use dynamic sockets, preserve actor visibility, support either side and clean up on completion/cancellation. Their special HP rules stay in core; the optional prior-hit contract is documented in `MIGRATION.md`. Counter/Mirror Coat fail without a matching supplied hit. Pain Split averages and independently caps HP, including when the source loses HP. Endeavor fails when the target's HP is not greater. Turn ordering, automatic hit history, immunities and ability interactions remain outside this preview.

Metadata and relevant rules follow [PokeAPI](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv) and [Pokémon Showdown's move definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts): Counter #068 Fighting, Mirror Coat #243 Psychic, Pain Split #220 Normal and Endeavor #283 Normal. Power is variable/not applicable; accuracy is 100% except Pain Split's always-hit metadata. Browser pixel appearance remains unverified.

## Disable, Encore, Torment, Imprison, Taunt, Swagger, Flatter and Fake Tears

These eight independent recipes bring the catalog to 172 moves. All deal zero HP damage. Existing recipes, sprite proportions, platforms and the shared FX runtime remain unchanged.

| Move | Contact / completion | Artwork and motion | Preview result |
| --- | --- | --- | --- |
| Disable | 0.76 / 2.08 s | Eye glint, three narrow pulses, closing brackets and a crossed violet seal. | Target Disable badge. |
| Encore | 0.64 / 2.20 s | Two hands clap at 0.64, 0.98 and 1.32 s, with three applause rings and eighteen stars. | Target Encore badge. |
| Torment | 0.84 / 2.30 s | Three opposing red/violet bands tighten around a jagged mark; ten restless shards drift outward. | Target Torment badge. |
| Imprison | 0.92 / 2.50 s | Two hexagonal seals align around the user, a lock closes and twelve rune fragments drift outward. | User Imprison badge. |
| Taunt | 0.80 / 2.10 s | A finger beckons; three sharp pulses provoke a throbbing anger mark and six ticks. | Target Taunt badge. |
| Swagger | 1.02 / 2.55 s | Seven proud golden rays launch a gleam into rising anger chevrons and five dizzy orbiters. | Target Attack +2 and confusion. |
| Flatter | 0.96 / 2.45 s | Five stars/hearts travel along paired flowing ribbons, leaving three soft curls and seven orbiting lights. | Target Special Attack +1 and confusion. |
| Fake Tears | 0.88 / 2.25 s | Twenty-eight source tears fall in two streams; three pleas reach the target and its aura droops. | Target Special Defense −2. |

Disable uses `eyes` with `emission` fallback. Pulses start at 0.18 s with 0.09 s staggering and 0.58 s flight. The first arrives as the central cross finishes; rings rotate until the 1.48–1.90 s fade. Seal radius is 26–43 art units, using pale violet `#dcc1f6` and ivory highlights.

Encore's mirrored hands pivot inward over 0.14 s around each clap. Eighteen peach/gold/pink stars travel for 0.60 s per six-star group; applause rings expand over 0.38 s. The 30–47 unit base radius accounts for the full fingers and outward stars when fitted. All applause fades by 2.04 s. Only the first clap reveals the result.

Torment closes its bands over 0.20–0.84 s. The alternating curves continue rotating and its central mark throbs; shards start at contact with 0.035 s staggering and 0.90 s lifetime. Radius is 31–53 units, colors red `#e48b9b`, violet `#9c6cae` and light pink. The field fades by 2.14 s.

Imprison is source-only and follows live `aura`. Its two hexagons align from 0.30–0.92 s, the central lock appears over 0.70–0.92 s, and six outer runes continue orbiting. Twelve fragments start at contact with 0.025 s staggering and 0.85 s lifetime. Base radius is 37–67 units, rose `#f3a9ca` and violet `#bb9bdf`; fade ends at 2.32 s. No opponent is required.

Taunt attaches the beckoning hand to `hand` with `emission` fallback. The finger curls continuously; three pulses start at 0.30, 0.43 and 0.56 s and travel for 0.50 s. The target mark uses a 23–34 unit radius with warm red `#f7a1a8`, continuing its pulse until the 1.52–1.90 s fade.

Swagger's boast rays follow source `aura`; its golden gleam travels over 0.42–1.02 s. Target chevrons rise over 0.35 s while five pink/violet lights orbit its upper center, with a 28–43 unit base radius. The target field fades by 2.38 s. Flatter instead launches five alternating stars/hearts from `emission` every 0.11 s from 0.24 s, each traveling for 0.72 s. Two sine ribbons meet the exact live target center; three softly rotating curls and seven lights continue through the fade at 2.28 s. Base radius is 28–46 units, with warm gold, blush and lavender.

Fake Tears follows `eyes` with `emission` fallback. Fourteen tear pairs start every 0.065 s from 0.15 s, with 0.52 s lifetimes and positive downward acceleration. Their fan spans 21–39 units before edge fitting; horizontal reflection does not reverse gravity. Three pleas launch at 0.32/0.52/0.72 s with 0.56 s flight. Target curves descend continuously until the 1.66–2.06 s fade, with a 26–41 unit base radius. Pale blue `#a9d9f4` tears and lavender defensive curves distinguish source crying from the target reaction.

Each recipe scales only its owned artwork to fit live sockets and logical field edges. Neither actor is moved, scaled or hidden. Every move emits exactly one impact after its activation geometry updates; reduced motion and cancellation use the existing runtime. The first five results are illustrative badges, without history, PP, duration, move blocking or a turn engine. Swagger/Flatter preserve major conditions and succeed when either their capped boost or confusion can change. Fake Tears floors Special Defense at −6. None of this state is passed into FX.

Reference metadata follows [PokeAPI](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv) and [Pokémon Showdown](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts). All are status moves: Disable #050 Normal, Encore #227 Normal, Torment #259 Dark, Imprison #286 Psychic, Taunt #269 Dark, Swagger #207 Normal, Flatter #260 Dark, Fake Tears #313 Dark. Reference accuracy is 100% except Swagger at 85% and self-targeted Imprison at Always; this showcase guarantees eligible preview hits.


## Music, affection, healing and defenses: 26 additions

These additions bring the catalog to 198 moves. Each owns its complete recipe; existing artwork, sprite sizing, platforms and shared FX runtime remain unchanged. All new clips emit one impact, and none changes a live actor’s position, scale or visibility.

| Move | Contact / completion | Subject | Appearance |
| --- | --- | --- | --- |
| Sing | 0.96 / 2.50 s | opponent | Seven lilting musical notes drift toward the opponent and settle into a gentle lullaby. |
| Grass Whistle | 0.88 / 2.50 s | opponent | A leaf vibrates at the user’s mouth, sending pale green notes into a drifting seed lullaby. |
| Snore | 0.72 / 1.80 s | opponent | Sleep bubbles swell before three thick snoring waves strike the opponent. |
| Perish Song | 1.12 / 3.05 s | field | A haunting score crosses the field as violet musical notes drift through fading sound rings. |
| Belly Drum | 1.02 / 2.25 s | source | Four quick belly beats build into rising amber chevrons and a decisive final pulse. |
| Trick | 1.15 / 2.10 s | opponent | Two small parcels arc past each other and arrive in opposite hands with golden sparkles. |
| Charm | 0.90 / 2.15 s | opponent | A playful wink sends a soft pink heart toward the opponent, followed by falling attack marks. |
| Attract | 0.92 / 2.55 s | opponent | Five hearts flutter forward and gather into a gently circling ring around the opponent. |
| Sweet Kiss | 0.96 / 2.50 s | opponent | A sparkling heart floats through an airy arc and leaves a dizzy spiral of stars. |
| Lovely Kiss | 1.08 / 2.55 s | opponent | A rose-colored kiss travels slowly, opens into falling petals and leaves soft sleep rings. |
| Recover | 1.20 / 2.20 s | source | Twelve bright repair fragments spiral inward, then release a few rising recovery glints. |
| Soft-Boiled | 1.16 / 2.35 s | source | A small egg cracks open at the user’s hand, releasing five golden pearls into its aura. |
| Milk Drink | 1.10 / 2.30 s | source | A small cup tips toward the user, pouring moving drops of milk into warm settling ripples. |
| Slack Off | 1.05 / 2.40 s | source | A slow exhale releases three soft puffs as low ripples settle and quiet glints brighten. |
| Morning Sun | 1.15 / 2.50 s | source | A little golden sun rises over the user, sending narrow shafts and descending light motes. |
| Synthesis | 1.23 / 2.55 s | source | Four green leaves unfurl and feed glowing chlorophyll motes into a bright central seed. |
| Moonlight | 1.15 / 2.50 s | source | A silver crescent casts a narrow curtain of falling light over a softly moving reflection. |
| Wish | 1.00 / 2.60 s | source | A five-point star traces itself, rises along a dotted trail and disappears into a few falling sparks. |
| Harden | 0.90 / 2.10 s | source | Six pale facets settle inward and catch a diagonal gleam before dissolving. |
| Iron Defense | 1.00 / 2.30 s | source | Four beveled metal plates rotate into an open armor frame with traveling steel glints. |
| Defense Curl | 0.92 / 2.20 s | source | Two warm bands sweep around the user and curl inward into a compact rounded enclosure. |
| Withdraw | 1.00 / 2.25 s | source | Five translucent shell ribs fan upward, close around the user and retract. |
| Safeguard | 1.05 / 2.50 s | source | Six turquoise panes rise around the user while small lights travel along their connecting ribbon. |
| Magic Coat | 1.05 / 2.45 s | source | A flowing diamond-patterned veil catches small sparkles and reflects them outward. |
| Cosmic Power | 1.15 / 2.55 s | source | An asymmetric constellation draws around the user as two tiny planets trace crossing orbits. |
| Endure | 0.95 / 2.30 s | source | Amber brace marks tighten, a low band glows and compact sparks fall away from the user. |

All actor-local recipes use the supplied semantic sockets and uniform effect space. Each file owns its field-clearance calculation and fits the complete artwork extent, including late particles and overhead objects. Source-only moves use `subject: 'source'`; Perish Song uses `subject: 'field'`. Perish Song draws directly in the logical field, leaving gravity and musical notation upright. The other independent recipes use `aura`, `emission`, `hand`, or an optional `eyes` socket (with emission fallback); no Pokémon artwork or battle state enters these files.

**Music:** Sing launches seven notes from 0.20 s at 0.12 s intervals, each taking 0.76 s along a gently oscillating route. Three lullaby curves continue through the 1.94–2.32 s fade. Grass Whistle vibrates a leaf at emission, sends five narrow green pulses from 0.28 s every 0.15 s with 0.60 s travel, and leaves ten drifting seed shapes. Snore uses three swelling sleep bubbles, followed by three thick pressure curves launched every 0.16 s from 0.32 s, taking 0.40 s to contact; ten compact streaks mark the hit. Perish Song sends three source-centered sound rings through a low-opacity violet field score and eighteen floating notes. It fades by 2.84 s and never hides or faints an actor.

**Belly Drum and Trick:** Belly Drum's two palms clap inward at 0.36, 0.58, 0.80 and 1.02 s around the source center. Four elliptical pulses and three rising amber chevrons fit a 32–54 unit base radius. The last beat is the sole result cue. Trick sends two symbolic parcels from opposite live `hand` sockets along opposite sine arcs over 0.35–1.15 s. Both arrive before the one cue; six glints mark each receiving point. No held-item image or item label is needed by FX.

**Affection:** Charm starts with an eye-socket wink and floats one large pink heart over 0.30–0.90 s, followed by three downward stat marks and a soft expanding ring. Attract sends five smaller hearts every 0.13 s from 0.20 s with 0.72 s travel; six hearts orbit the target until the 1.98–2.40 s fade. Sweet Kiss sends one heart with nine trailing sparkles over 0.24–0.96 s, then draws a spiral and five dizzy stars. Lovely Kiss uses its own rose lip silhouette over 0.30–1.08 s, twelve falling petals and three descending sleep rings. Particle geometry keeps downward motion under horizontal reflection.

**Direct healing:** Recover draws twelve lozenges inward using `angle = phase + 1.6*u`, `radius = r*(1-u)^0.7`. They launch from 0.15 s with 0.04 s staggering and 0.61 s travel; all arrive by the 1.20 s cue, then five glints rise. Soft-Boiled opens two independently rotating egg halves at `hand` over 0.38–0.80 s. Five gold pearls launch every 0.08 s from 0.55 s with 0.61 s travel to `aura`; the first arrival reveals healing. Milk Drink tips a small cup at `emission`, draws a curved pour from 0.45–1.40 s and moves twelve cream drops along it; three low ripples settle at `aura`. Slack Off slowly exhales three puffs every 0.23 s from 0.20 s, with 1.20 s lifetimes; two low ripples settle and four quiet glints breathe. It contains no sleep glyph or sleep result.

**Weather healing and Wish:** Morning Sun raises a small sun over 0.06–0.76 s, rotates ten rays and sends fifteen motes down five narrow shafts. Synthesis unfolds four independent leaves, then launches sixteen chlorophyll motes from 0.58 s with 0.035 s staggering and 0.65 s travel into a bright seed. Moonlight uses a slim crescent, a translucent silver curtain, fourteen downward streaks and three moving reflections. Wish traces a five-point star over 0.12–0.80 s, raises it over 0.80–1.85 s, and leaves a dotted trail with nine faint falling sparks. Wish depicts casting only, with no returning healing orb. All overhead art fits the whole local effect extent; base radii for these four are 39–67 art units.

**Defenses:** Harden draws six irregular pale facets inward over 0.14–0.90 s and passes a diagonal gleam over them. Iron Defense rotates four beveled plates into an open frame with staggered 0.58 s arrivals and two traveling edge glints. Defense Curl draws two curved bands with inward-curled ends over 0.10–0.92 s; highlights continue traveling along their seams. Withdraw fans five translucent shell ribs upward over 0.14–1.00 s, then retracts them from 1.50 s. Safeguard raises six hexagonal panes and keeps six lights moving along a connecting ribbon. Magic Coat draws two flowing veil edges and a loose diamond lattice; eight sparkles approach and bounce from the edges. Cosmic Power traces a six-star asymmetric constellation over 0.15–1.15 s while two tiny planets follow differently tilted elliptical paths. Endure tightens six amber brace strokes over 0.10–0.95 s, pulses a low band and scatters fourteen small downward sparks. Complete contours are fitted, with base radii capped at 64–76 art units.

Core outcomes are decided before FX: Sing, Grass Whistle and Lovely Kiss sleep only clear-condition targets; Sweet Kiss confuses; Charm lowers Attack two stages. Snore previews fixed 36 damage with an asleep host fixture and fails while awake. Belly Drum pays floor(half maximum HP), minimum one, and maximizes Attack, failing if no HP would remain or Attack is already +6. Trick exchanges nullable held-item labels; the host supplies Oran Berry and Sitrus Berry, while actual item effects/eligibility remain outside scope.

Recover, Soft-Boiled, Milk Drink and Slack Off restore half maximum HP rounded to nearest, capped by missing HP. Weather heals restore half normally, about two-thirds in sun, one quarter in other modeled weather. Their current-generation fixed-point formula is `floor((maxHp * floor(factor * 4096) + 2047) / 4096)`, with factors 0.5, 0.667 or 0.25 and minimum one. Unlike direct healing, neutral-weather exact halves round down. Healing preserves all conditions and uses the ordinary impact display rather than a drain recovery cue. Host heal fixtures start at 40% HP; fainted actors stay fainted.

Wish records `wishPending` without immediate healing. Perish Song marks all living actors with `perishSong`, preserves weather and never advances a countdown. Attract uses an illustrative infatuation badge without gender eligibility/action-failure simulation. Safeguard, Magic Coat and Endure are badges, without prevention/reflection/survival mechanics or timers. Harden, Defense Curl and Withdraw raise Defense by one, Iron Defense by two, and Cosmic Power raises Defense/Special Defense by one each; stages cap at +6 and combined boosts allow partial success. Defense Curl's Rollout/Ice Ball interaction is unsimulated.

Metadata follows [PokeAPI](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv); relevant healing, item and status rules follow [Pokémon Showdown move definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts), [healing caller](https://github.com/smogon/pokemon-showdown/blob/master/sim/battle-actions.ts), and [fixed-point rounding](https://github.com/smogon/pokemon-showdown/blob/master/sim/battle.ts). The catalog retains current metadata, so Charm, Sweet Kiss and Moonlight are Fairy (they were Normal in Gen 3). These are successful illustrative previews, without generation-specific immunities, abilities, turn sequencing or accuracy rolls. Browser pixel appearance remains unverified.

## Repeated strikes, wings, tails and conditional body attacks

These eleven additions bring the catalog to 209. Wing Attack already exists and retains its complete original recipe. Each addition owns its geometry and timeline in `moves/restored/<id>.js`. Times below are normal-motion seconds; the last listed contact is the single result cue.

| Move | Contacts | Complete | Fixed damage | Shape and motion |
| --- | --- | --- | --- | --- |
| Double Slap | 0.52, 0.88 | 1.75 | 30 total | Two broad cream palms, alternating shallow swings and five short slap streaks per contact. |
| Comet Punch | 0.56, 0.86, 1.16 | 2.05 | 42 total | Three small orange fists with knuckle lines, moving comet tails and seven stars per hit. |
| Arm Thrust | 0.62, 0.98, 1.34 | 2.30 | 42 total | Three tall red palms with paired straight pressure lines and vertical compression rings. |
| Fury Attack | 0.44, 0.68, 0.92, 1.16 | 1.95 | 40 total | Four tapered ivory jabs in alternating interior target lanes, each with a compact puncture mark. |
| Steel Wing | 0.76 | 1.85 | 48 | Five rigid metal feathers with a traveling glint, diagonal white cut and twelve silver sparks. |
| Iron Tail | 0.91 | 2.10 | 70 | Seven steel segments wind through a curved swing into a blunt beveled tip and eight impact spokes. |
| Poison Tail | 0.74 | 1.85 | 36 | Flexible violet hook follows a low curve, flicks back and releases sixteen falling droplets. |
| Headbutt | 0.58 | 1.50 | 48 | Small preparatory nod, rounded forehead contour, direct rush and quick rebound. |
| Frustration | 0.75 | 1.80 | 72 | Three rust-red anger marks, tense backward vibration, abrupt rush and seven jagged impact cracks. |
| Facade | 0.82 | 1.90 | 48; sample 96 | Two contrasting theater masks part into a clean body strike and ten scattering fragments. |
| Smelling Salts | 0.84 | 1.95 | 42; sample 84 | Two pale palms close together, followed by a wake-up ring, two moving vapor trails and eighteen salt grains. |

All use uniform source-local effect space. The local source fit uses the supplied `visualCenter` and full rotated visible width/height; `center` is the aim point. Optional `palm`, `fist`, `horn`/`beak`, `wing`, `tail` and `head` anchors fall back to `hand` or `emission`, while Frustration/Facade use `tackle`. Actor scale and opacity remain one. When edge fitting shortens the body approach, each recipe's own connecting motion brings its visible front to the semantic contact without pushing an actor out of view. No sprite names, fixed screen positions or shared visual template enters the recipes.

Repeated strikes retract fully before the next reach. Double Slap reaches/retracts over 0.17/0.16 s, Comet Punch 0.14/0.13 s, Arm Thrust 0.19/0.15 s and Fury Attack 0.12/0.11 s. Target recoil returns within each beat; the last contact alone reveals the already-committed total. Fury Attack offsets contacts by at most seven art units, additionally capped by target height and field clearance. These cosmetic counts do not implement the real 2–5 hit roll.

Steel Wing's 31–46 unit base radius fits the full feather fan; its glint moves throughout the sweep. Iron Tail's 24–36 unit radius caps the blunt head and segmented curve independently. Poison Tail's 23–34 unit radius controls a tapered Bézier hook and descending droplets; gravity remains downward under horizontal reflection. Each impact point is frozen for debris after arrival. All emission, contact and visible-front geometry updates before the cue; effects fade and both poses recover before completion.

Facade's host sample starts the selected user burned and doubles fixed damage from 48 to 96. Core also qualifies poison, bad poison and paralysis, but excludes confusion, sleep and freeze and retains all user conditions. Smelling Salts starts only the selected recipient paralyzed, doubles 42 to 84, then cures a surviving target in the same core result. Healthy and other-status targets take ordinary damage without a cure or failure; a KO retains its major condition. Neither effect reads condition or HP. Frustration previews maximum power 102 at zero friendship, without a friendship model. Steel Wing Defense boosts, Iron Tail Defense drops, Poison Tail poison/critical rolls, Headbutt flinching and accuracy rolls remain outside these previews.

Move numbers, powers and accuracy follow [PokeAPI move metadata](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv). Conditional rules follow [Showdown move definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts), [damage-before-onHit ordering](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/battle-actions.ts) and [surviving-only status cure](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/pokemon.ts).

## Hidden Power, Zap Cannon, Weather Ball and Mist Ball

These four additions bring the catalog to 213. Shadow Ball already exists and retains its original 1.10/2.35 s recipe. Each addition owns its drawing, particle paths, charge, release and recovery. No shared visual template, Pokémon artwork, actor status or weather state enters the effects.

| Move | Release | Result cue / complete | Fixed damage | Appearance |
| --- | --- | --- | --- | --- |
| Hidden Power | 0.48–0.83 s | 1.35 / 2.20 s | 42 total | Six pastel energy beads charge in a turning segmented ring, travel along different narrow spiral paths and burst at the target. |
| Zap Cannon | 0.74 s | 1.16 / 2.15 s | 86 + eligible paralysis | A dense gold orb builds among inward electric spokes, accelerates forward and breaks into nine branching arcs and eighteen sparks. |
| Weather Ball | 0.40 s | 1.00 / 1.95 s | 36 | A compact pearly sphere follows a shallow high arc, leaving seven airy eddies and a bright pressure ripple. |
| Mist Ball | 0.52 s | 1.10 / 2.30 s | 66 | Five translucent tufts surround a pale core, followed by eleven drifting wisps, a flowing mist bloom and ten feathery fragments. |

Hidden Power's base charge radius is 32–48 art units. Its six beads have 7–10.5 unit cores and peach, blue, lavender, mint, rose and pale-green colors. Each bead contracts into the live emission socket over 0.17 s before release, then travels for 0.52 s along `linear route + sin(pi*u) * sin(2*pi*u + phase) * amplitude`. Emissions are spaced 0.07 s apart; impacts at 1.00–1.35 s reveal one fixed total only at the final contact. Trails consist of four recent route segments. Four tiny sparks and a ring dissipate over 0.50 s per contact.

Zap Cannon uses a 23–33 unit core radius. Five jagged arcs rotate around its layered gold/white core, while eight inward spokes visibly build charge. Flight takes 0.42 s using `progress = u²`; five recent route segments form a short pressure trail. Nine contact branches change their reach throughout a 0.66 s fade. Eighteen small bolt fragments travel radially for 0.64 s, and the target's three brief recoil pulses finish before recovery. It does not fill the field with a flash or use a continuous beam.

Weather Ball is explicitly the neutral-weather Normal sample, with a 19–28 unit radius and three moving circular orbit strokes. Its 0.60 s route has an upward sine arc capped at 26 art units and endpoint clearance. Seven elliptical wakes are captured along the flight at 0.068 s intervals, rotating and drifting until each 0.42 s fade ends. The contact ring, four rotating arc fragments and twelve drifting motes clear by 1.60 s. Weather-dependent typing, doubled power and damage modifiers are not simulated.

Mist Ball's 22–31 unit radius supports five softly overlapping lobes and three moving white curls. Its 0.58 s route has a restrained asymmetric oscillation capped at 18 art units. Eleven wisps are captured every 0.045 s, then drift, turn and expand over 0.66 s. The target mist consists of six counter-moving lobes and curls over 0.84 s; ten small feather shapes flutter outward with downward gravity. The cloud continues moving through its fade, and both actors remain visible at full scale.

Every release captures the live `emission` socket. Flight targets follow the posed semantic center until contact, then each hit freezes its own debris origin. Source backward/forward movement and target recoil are capped using full visual bounds. Each recipe fits the complete orb, halo, trail and particle radius to logical field clearance, including reversed attacks and portrait layouts. Horizontal reflection preserves gravity; viewport resizing uses the existing uniform camera fit.

Hidden Power uses catalog Normal with a neutral visual sample; actual attack type is variable, and IV/type calculation is outside this preview. Zap Cannon's damaging `conditionOnHit` adds paralysis only to a surviving clear-status target and never turns an otherwise valid damaging hit into failure. Core commits HP and paralysis together before optional FX. Mist Ball uses current base power 95 and does not roll its 50% Special Attack reduction. Metadata and these distinctions follow [PokeAPI](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv), [Showdown move definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts) and [status eligibility](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/pokemon.ts). Accuracy, type immunities and ability interactions remain outside the successful-hit showcase.


## Utility, sound, targeting and copying previews

These 32 additions bring the catalog to 245. Taunt, Swagger, Flatter and Fake Tears already exist and retain their exact recipes. Each new move owns its artwork, paths, timing and recovery in `moves/restored/<id>.js`; no shared visual template or existing recipe was changed. Times below are normal-motion seconds.

| Move | Result cue / complete | Visual sequence |
| --- | --- | --- |
| Teleport | 0.82 / 1.80 s | Contracting violet rings and rising light columns briefly fade the user, then restore it. |
| Baton Pass | 0.96 / 1.90 s | A small golden baton flips inward while three relay ribbons gather around the user. |
| Substitute | 1.00 / 2.15 s | A compact green decoy rises through soft puffs and settles with stitch-like glints. |
| Recycle | 1.00 / 2.00 s | Three green arrows turn as fragments gather into a recovered berry at the user’s hand. |
| Growl | 0.64 / 1.65 s | Three low, rounded sound bands travel forward and leave a falling attack mark. |
| Roar | 0.65 / 1.85 s | Three broad jagged pressure fans push the opponent back before it returns to its slot. |
| Screech | 0.70 / 1.95 s | Two thin piercing waveforms converge into a sharp point and scatter brittle fragments. |
| Metal Sound | 0.76 / 1.90 s | A vibrating metallic fork releases narrow silver rings and ringing impact sparks. |
| Metronome | 1.02 / 1.80 s | A raised index finger wags three times while colored dots gather into one bright spark. |
| Assist | 1.10 / 1.90 s | Three warm paw seals appear, then one moves into a small release flare at the user. |
| Sleep Talk | 1.08 / 1.90 s | A drowsy speech bubble wobbles with three dots and dissolves into a crooked star. |
| Nature Power | 1.18 / 2.05 s | Leaf, stone, water and light motifs rise from a small ground ring into a luminous seed. |
| Mud Sport | 0.82 / 2.25 s | Small fountains of mud scatter grains into low splashes across the field. |
| Water Sport | 0.88 / 2.40 s | Light arcs of water fall into expanding ripples and moving droplets across the field. |
| Spikes | 1.44 / 2.30 s | Eight small caltrops arc into the opponent’s ground and settle through short dust puffs. |
| Sweet Scent | 0.82 / 2.15 s | Nine softly turning petals trail perfume into a drifting pink cloud and descending marks. |
| Fake Out | 0.38 / 1.15 s | Two palms snap together in a quick surprise clap with one crisp impact star. |
| Astonish | 0.60 / 1.55 s | A small spectral face rushes forward and opens into startled violet rays. |
| Tail Whip | 0.86 / 1.95 s | A soft curved tail sways briskly with two wake arcs, followed by a falling defense mark. |
| Tickle | 0.81 / 2.05 s | Two small hands wiggle beside the target while playful curls and two stat marks drift down. |
| Supersonic | 0.68 / 1.95 s | Five fine golden rings converge into a turning spiral with three dizzy motes. |
| Sonic Boom | 0.53 / 1.40 s | A fast compressed sound crescent breaks into two sharply separated pressure curves. |
| Hyper Voice | 0.74 / 2.05 s | Four full-throated golden sound fronts expand toward the target with bright inner rims. |
| Uproar | 0.63 / 2.10 s | Six uneven zigzag barks alternate in height and keep rattling around the target. |
| Lock-On | 0.88 / 1.55 s | Four corner brackets close while a red-orange reticle turns into exact alignment. |
| Mind Reader | 1.08 / 1.90 s | A violet eye sends three faint thought filaments to a luminous eye over the target. |
| Foresight | 0.95 / 1.65 s | A narrow golden slit scans the opponent and forms a clear identification halo. |
| Odor Sleuth | 1.06 / 1.85 s | Three scent curls drift back toward the user’s nose, followed by an identification ring. |
| Mimic | 1.15 / 1.95 s | A translucent move-card duplicate folds, travels to the user and opens again. |
| Psych Up | 1.20 / 2.05 s | Three colored stat ribbons flow from the target into upward focusing pulses around the user. |
| Role Play | 1.18 / 2.00 s | An ability medallion creates a duplicate that travels into a mask-like crest over the user. |
| Skill Swap | 1.25 / 2.15 s | A turquoise diamond and golden ring cross on opposite curves and settle around the other actor. |

Source effects use supplied hand, emission, aura and floor sockets; Tail Whip supports an optional tail socket with hand fallback. Incoming copy effects travel from the target aura to the user aura. Odor Sleuth follows the reverse scent route into the user's emission socket. Skill Swap sends two distinct tokens on opposite sine arcs and settles both before its sole result cue. These are symbolic effects and never replace or exchange Pokémon artwork. Local `fit` functions contain the complete contour in available field space. Actor scale stays one. Teleport briefly fades the user to 20% opacity and restores it before completion; it never hides either actor. Roar's bounded push returns the target to its slot.

Sound attacks have separate silhouettes and rhythms: three rounded Growl bands, three jagged Roar fans, two fine Screech waveforms, four narrow Metal Sound rings, five Supersonic rings, one compressed Sonic Boom crescent, four broad Hyper Voice fronts and six uneven Uproar barks. The first arrival reveals one already-decided result; subsequent visual pulses add no damage events. Sonic Boom's leading midpoint sits at the supplied contact socket.

Mud Sport uses 38 ballistic grains from three low fountains; Water Sport uses 44 drops from four fountains. Both draw in logical field coordinates so gravity and field coverage stay identical from either side. Moving splashes/ripples live for 0.50 s and clear before completion. Spikes launches eight independent caltrops every 0.08 s from 0.22 s, each with 0.66 s flight; the final 1.44 s arrival reveals one layer. The caltrops dissipate rather than leaving unowned persistent artwork. Sweet Scent sends nine fluttering petals every 0.055 s from 0.16 s, followed by moving perfume lobes.

Substitute pays `max(1, floor(maxHp / 4))` only when the user has more HP than that cost and no existing substitute; `substituteHp` records a preview badge without damage interception. Recycle restores `consumedItem` only when `heldItem` is empty; the host supplies a labeled consumed Oran Berry. Psych Up copies all seven stat stages plus Focus Energy, including negative stages and a cleared focus flag, while preserving HP, conditions, items and guards. The host supplies explicit target sample stages. No sample data reaches FX.

Growl lowers Attack one stage; Screech lowers Defense two; Metal Sound lowers Special Defense two; Sweet Scent lowers Evasion two; Tail Whip lowers Defense one; Tickle lowers Attack and Defense one each. Stages stop at −6, with partial success for Tickle. Supersonic adds confusion without replacing the major condition. Fake Out, Astonish, Sonic Boom, Hyper Voice and Uproar deal fixed 28, 22, 20, 64 and 64 demo damage respectively. Fake Out is an explicitly successful first-turn sample; turn gating, flinching, sound immunity and Uproar repetition/sleep prevention are omitted.

Mud Sport and Water Sport set independent field preview flags and preserve weather; they do not modify damage or expire. Spikes stores up to three target-side preview layers without switch-in damage. Lock-On/Mind Reader and Foresight/Odor Sleuth set `aimed` or `identified` preview badges, without source binding, accuracy/immunity enforcement or expiry.

Teleport, Baton Pass, Roar, Metronome, Assist, Sleep Talk, Nature Power, Mimic, Role Play and Skill Swap show casting only. No party switch, escape, move history, PP, random called attack or ability system is introduced. Nature Power intentionally previews only its local casting sequence. Sleep Talk requires a sleeping source; its host sample supplies sleep without reviving a fainted actor. All source/field recipes run without an opponent. Effects off, completion, skip and renderer failure reconcile the same core result.

Metadata follows current [PokeAPI move data](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv) and [Pokémon Showdown definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts), consistent with the existing catalog rather than a Gen 3 battle simulator. Sweet Scent uses current Evasion −2 and Uproar uses power 90. Browser pixel appearance remains unverified.


## Water jets, charged shots and energy beams

All seven recipes were visually reworked together; the catalog remains at 251 with no duplicate Hydro Cannon entry. Each effect owns its geometry, colors, path equations and recovery. Release, contact and completion times and fixed battle outcomes are preserved. Water Gun's older teaching example remains inactive; `moves/restored/water-gun.js` is the registered recipe.

| Move | Release | Contact / complete | Demo damage | Shape and movement |
| --- | --- | --- | --- | --- |
| Water Gun | 0.24 | 0.48 / 1.45 s | 28 | Narrow rolling water packets, twelve detached beads and twenty falling splash droplets. |
| Hydro Pump | 0.50 | 0.72 / 2.80 s | 72 | Two broad pale braids inside a dense pressure jet, eight collars, twenty-six foam strokes and a continuously churning crown. |
| Hydro Cannon | 0.82 | 1.16 / 2.50 s | 100 | Rotating water sheets and twelve intake droplets compress into a large torpedo, with a short wake and four breaking impact sheets. |
| Spit Up | 0.54 | 0.90 / 1.80 s | 70 | Three uneven warm energy lobes follow a shallow arc, trailing soft puffs and breaking into seven drifting clouds and amber flecks. |
| Hyper Beam | 0.90 | 1.10 / 2.60 s | 100 | Fourteen inward amber charge rays, a rigid five-layer golden beam, rail glints and an angular pressure crown. |
| Aeroblast | 0.54 | 0.83 / 2.25 s | 70 | Five hollow intake arcs, four helical air ribbons, twelve traveling pressure crescents and replenishing sliced gusts. |
| Luster Purge | 0.74 | 1.05 / 2.15 s | 66 | Eight orbiting facets resolve into a star, then a split magenta/lavender prism, ten diamond highlights and expanding broken diamond frames. |

Water Gun uses a 5.6–8 art-unit half-width, pinched into rolling packets with a fine connecting stream. Twelve highlighted beads peel off the stream, while twenty impact droplets arrive in four five-drop groups at 0.48, 0.59, 0.70 and 0.81 s. Six moving splash curls continue through the fade. The cutoff still travels from the mouth over 0.72–0.92 s; the final droplets clear by 1.27 s.

Hydro Pump uses a 22–30 unit half-width. Three opaque blue bands contain two broad pale strands that wind in counterphase, with a 7.5% pressure oscillation at the edges. Eight transverse collars advance at 2.7 route lengths per second and twenty-six internal strokes at 3.1. Four muzzle rings roll into the flow. Ten continually refreshed crown curls and eight groups of seven highlighted spray droplets keep the impact moving; groups launch every 0.15 s from contact, living 0.35–0.48 s with downward gravity. The crown follows the recoiling target throughout the stream. The cutoff travels over 1.66–1.92 s, the jet clears by 1.99 s, the crown by 2.22 s and floor wash by 2.28 s. The source holds until 2.02 s. No camera shake or field-wide flash is used.

Hydro Cannon has a 34–42 unit base radius and a front-aligned layered water torpedo extending 2.65 radii behind its nose. Twelve intake droplets circle the charging chamber as four broken water rings contract. The shot accelerates using `u^1.8` over 0.34 s; six curved pressure marks cross its shell and five recent path segments form its tail. Release rings expand at the mouth. Four heavy water sheets, ten curling splash strokes, twenty-six falling droplets and three floor ripples clear after impact, with the wash gone by 2.18 s.

Spit Up retains its 16–23 unit radius and 0.36 s flight with at most twelve units of upward sine arc, fitted to clearance. Five soft charge lobes gather at the mouth, followed by a three-lobed projectile with a front-aligned leading edge. Six uneven trailing puffs and a short exhale distinguish it from the water shots. Seven drifting impact clouds and sixteen amber flecks disperse after contact. This remains one stockpiled-energy sample.

Hyper Beam uses a 22–29 unit half-width, fourteen inward charge rays and five straight amber/gold/ivory layers. Twenty short rail glints advance at 3.3 route lengths per second while the white core remains solid. Its 0.90–1.10 s leading front uses `u^1.4`; the cutoff follows over 1.76–1.98 s, with complete beam fade by 2.04 s. A jagged sustained pressure crown and eight expanding broken facets follow the moving target; twenty-eight initial sparks retain their own collision origin.

Aeroblast uses a 22–30 unit base radius. Five rotating intake arcs remain hollow, and four tapered helical ribbons surround clear air instead of a filled beam. Twelve pressure crescents launch every 0.081 s with 0.29 s travel; only the first emits a result cue. Six continuously replenished receiver arcs keep moving through the sustained gust, followed by twenty-two curved fragments with downward drift.

Luster Purge uses a 20–27 unit base radius. Eight inward orbiting facets resolve into a four-point charging star. The 0.31 s leading ray is a tapered prism with magenta and lavender faces and a fine white seam, carrying ten diamond highlights in two lanes. A four-point impact flare and two expanding broken diamond frames follow the recoiling target while twenty detached prism shards disperse from the collision origin.

All source charges follow the live emission socket, all beam heads and main contact effects follow the posed target center, and one-shot projectiles capture their launch position before flight. Visible front points align with their contact roots. Each recipe fits its complete art contour to logical field clearance; actor movement is capped using the supplied geometric visual center and full visible width. Actor scale and opacity remain one. Horizontal reflection changes attack direction while preserving gravity; window resizing uses the existing uniform camera fit. Both completion and cancellation restore all poses and clear temporary artwork.

Core uses fixed single-hit results with no new state or resolver branches. Spit Up explicitly assumes one Stockpile charge (reference power 100) while the power label stays variable; Stockpile tracking, defense boosts and charge consumption are omitted. Hydro Cannon and Hyper Beam do not add recharge turns. Aeroblast critical-hit rolls and Luster Purge's random Special Defense reduction are omitted. Luster Purge uses current power 95; Hydro Pump retains its existing 72 damage. Current metadata follows [PokeAPI](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv) and [Pokémon Showdown definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts).


The September 2026 visual rework passed all four focused pressure-move tests and the production build for both pages. Browser review rendered 60 deterministic frames across wide and portrait layouts and both attack directions. All 126 normal playbacks (seven moves, two sides, nine starter profiles) and fourteen reduced-motion playbacks completed with one impact cue, empty effect layers and fully restored poses.


## Magical leaves, petals, cutting wind and electric body strikes

Six independent additions bring the catalog to 257. Existing recipes, including the seven water/energy reworks, are unchanged. Each new effect owns its geometry, particle motion and recovery; core rules and display metadata remain separate from FX.

| Move | Release | Contact / complete | Demo damage | Shape and movement |
| --- | --- | --- | --- | --- |
| Magical Leaf | 0.42 s | 1.06 / 2.05 s | 42 | Six luminous colored leaves orbit, home along separate curves, then converge into a bloom and 24 glints. |
| Petal Dance | 0.40 s | 1.02 / 2.65 s | 84 | Thirty-six pink petals gather, stream into a target vortex and loosen into a falling aftermath. |
| Razor Wind | 0.84 s | 1.16 / 2.35 s | 56 | Five winding charge coils compress into two broad silver cutting sheets with moving wake threads. |
| Charge | Source only | 0.95 / 2.10 s | 0 | Twenty-six electric motes draw inward while climbing arcs and concentric rings store light around the user. |
| Spark | Body strike | 0.64 / 1.70 s | 46 | A quick electrified lunge, short crackling wake, seven branching impact bolts and seventeen discharge sparks. |
| Volt Tackle | Body strike | 0.98 / 2.45 s | 84 + recoil | A gathered electric mantle drives an accelerating dash, five lightning trails, twelve impact branches, twenty-five sparks and a strong rebound. |

Magical Leaf staggers launches by 0.021 s and converges all six leaf fronts on the posed target at 1.06 s, emitting a single result cue. Its colored veins and pointed contours remain separate from the narrow fading trails. Petal Dance staggers its 36 petals by 0.012 s; the first arrives at 1.02 s and later petals keep feeding the target swirl. Individual petals turn and descend without reversing gravity when the attack direction flips. Razor Wind combines visible preparation and the attack in one independent clip, using broad curved sheets rather than a sustained filled beam.

Charge is registered with FX subject `source` and independently targets `self` in core, so it works without any opponent. It preserves the user's pose and draws around the live center. Spark and Volt Tackle use the supplied `tackle` socket, solve the body contact pose, fit the full source silhouette inside the logical field and update the visible contact artwork before the cue. Their fixed collision origins anchor detached discharge fragments while the source rebounds. In constrained edge layouts, the receiver approaches by the minimum bounded distance needed for the fitted tackle socket to touch its visible body. Recoil starts from this adjusted pose, and both receiver coordinates return home. Ordinary layouts retain their original contact positions. Both actors retain full scale and opacity, with complete pose/effect restoration on finish or cancellation.

Metadata follows [Pokémon Showdown move definitions](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts): Magical Leaf has reference power 60 and always-hit accuracy; Petal Dance 120; Razor Wind 80 and Normal type; Spark 65; Volt Tackle 120. Charge raises Special Defense by one stage through the existing capped boost rule, with no persistent electric-power store. Volt Tackle uses existing `recoilDamage: 0.33`, based on HP actually removed, rounded to nearest HP with a minimum of one for positive damage and capped by the user's HP. Both losses commit together and reveal at the ordinary impact cue. Petal Dance turn locking and confusion, Razor Wind separate turns/spread targeting/critical rolls, and random paralysis for Spark or Volt Tackle are outside these fixed previews. Each limitation is shown in the move's description panel.

`tests/leaf-electric.test.mjs` checks registration, immutable results, Charge caps and source-only playback, Volt Tackle overkill/recoil, presentation with effects off/cues/failure/skip, live launch/contact ordering, both directions, full field-edge/portrait bounds, reduced motion and cancellation. The existing core catalog fixture now covers 257 entries.


Verification: all 160 tests and the two-page production build pass. Browser review inspected 96 deterministic frames across both directions and wide/portrait layouts, with 124 successful playback checks including source-only Charge. After the electric edge-contact correction, 32 Spark/Volt Tackle frames were regenerated and all 40 targeted normal/reduced playbacks passed. No previous move recipe changed.
