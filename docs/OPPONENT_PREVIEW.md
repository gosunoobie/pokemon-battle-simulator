# Preview moves from either side

The game page keeps fixed field IDs: `source` is the near position and `target` is the far position. These names are historical, not attack roles. Choosing **Opponent side** sends `sourceId: 'target'` to FX. Offensive moves use `targetIds: ['source']`; field weather uses an empty target list. The camera and Pokémon positions stay in place. All 140 IDs use their existing independent recipe; there is no duplicate opponent registry, AI, turn scheduler or new battle engine.

The Use button and description remain above the move grid. Either position can display every supported stat, screen, status, confusion, trapping and fainted badge. Drain and cure fixtures follow the selected attacker. Side/species changes cancel active playback; late cues and completion cannot overwrite the new selection. Both pages offer all 386 Gen 1–3 species and 33 explicit forms through searchable selectors; the playground additionally supports geometric actors, scale controls and alternate layouts.

## Sprite presentation

Sprite sizing again follows the original pixel-art scale: 96-pixel artwork is drawn at 265 pixels on the near side and 235 pixels on the far side of the 1000×450 logical field. This restores the original default Charizard-back visible size (231.875×229.114583) and Venusaur-front size (193.385417×168.90625).

Smaller sprites receive a minimum **longest visible dimension of 150 near / 125 far**, plus a lower **height guard of 90 near / 75 far** for short silhouettes, at the 1000×450 logical scale. `MIN_SPRITE_EXTENT` and `MIN_SPRITE_HEIGHT` in `previewActors.js` own these presentation values. The host chooses the largest of the native pixel scale, `minimumExtent / max(visibleWidth, visibleHeight)` and `minimumHeight / visibleHeight`, then scales both axes uniformly. Transparent padding and Pokédex physical measurements do not determine display size. This is a readability adjustment for our interface, not a Generation 3 battle rule.

Compact small sprites such as Charmander and Caterpie retain their existing readable heights; Charizard remains substantially larger. Short, wide artwork no longer expands to the former 150/125 height floor: front Geodude is now **175×75**, instead of **292×125**, while front Wailord remains **213×181**. The lower height guard keeps Geodude readable at narrow viewport widths. The original Charizard-back and Venusaur-front dimensions stay unchanged. The same policy covers all 419 species/forms, without size classes or species multipliers.

The preview, battle simulation and playground share this sizing. The playground's optional scale adjustment still respects the minimum; alternate logical layouts and window resizing apply uniform scene scaling. The minimum is measured in logical artwork units, so it scales with the field on smaller screens. No move choreography, texture, socket or timing changed in this correction.

`previewSceneActors` assigns `view: 'back'` to the near field and `view: 'front'` to the far field. `spriteViews.js` preserves the 18 calibrated starter views. The independent `packages/pokemon-sprites` package supplies all 838 pinned front/back PNGs with measured alpha bounds; new species use generic host attachment sockets. Reference details show both types, abilities and base stats without changing fixed preview HP or move outcomes. See `tools/roster-import/reports/REPORT.md`. `resolveSpriteProfile` is used consistently for texture loading and actor geometry. Choosing the opponent as move user does not change artwork or field placement. Original Charizard-back and Venusaur-front sockets remain calibrated; the other views use measured host metadata. No move recipe, timing, FX runtime or battle rule was changed for this sprite update.

## Ground platforms

Platforms are fixed battlefield geometry: near radii 173×38 and far radii 143×31 at the 1000×450 logical scale. They do not depend on sprite bounds, size, species, pose or which side is attacking. Both pages use the same scene renderer.

Each platform center exactly matches the artwork's visible bottom-center slot position at rest, with no horizontal or vertical placement offset. This changes only terrain placement: sprite sizes, positions, anatomical sockets and all move recipes remain unchanged. Responsive resizing uniformly fits actors and terrain together.

## Direct animation use

```js
const run = fx.play({
  moveId: 'hydro-pump',
  sourceId: 'enemy-1',
  targetIds: ['player-1'],
  visualSeed: 42,
}, { scene, reducedMotion: false })
await run.finished
```

`scene.actor(id)` supplies the corresponding views. Move recipes receive only visual inputs. Self moves resolve the acting view directly and work without an opponent. The same applies to shields, boosts, healing auras and afterimages. Draining effects return energy to the actual user. Gravity stays down; only the horizontal attack direction is mirrored.

## Adding different artwork

The host scene accepts actor-specific `url` or an already-loaded `texture`, visible `bounds`, `nativeFacing`, desired `facing`, and normalized anatomical `anchors`. `createSceneGraph` merges partial anchor overrides with the chosen profile instead of discarding its measured sockets. Omitted sockets follow the artwork's native facing; explicit sockets use native-image coordinates and are never mirrored twice. Coordinates use the visible rectangle, excluding transparent padding. `visualCenter` is reserved for geometric centering; `center` remains an anatomical aiming socket. For a new Pokémon, measure the image bounds and inspect its emission/body/limb sockets once. No move changes or species lookup in FX are required.

```js
const scene = await createScene(element, {
  actors: [
    { id: 'player-1', profile: 'squirtle', view: 'back', x: .25, y: .8, height: .3, facing: 1 },
    { id: 'enemy-1', url: '/my-pokemon.png',
      bounds: { x: 12, y: 8, width: 72, height: 80 },
      nativeFacing: -1, facing: -1,
      anchors: { emission: [.18, .42], hand: [.2, .65] },
      x: .75, y: .6, height: .26 },
  ],
})
```

A host may implement optional `scene.updateDepth(source, target)` for draw order. The demo brings a rear attacker in front when it moves into the receiving silhouette, and restores its depth on cleanup. Effect shape, attack path and battle state are unaffected.

## Move legality

This showcase intentionally offers the complete animation catalog; it is not a learnset database. An integrating game should supply its generation-specific legal move IDs before requesting FX. `createPreviewTransaction(move, { sourceId, targetId, actors, allowedMoveIds })` optionally rejects moves outside a supplied list. Omitting the list preserves unrestricted previewing. FX never imports learnsets or decides whether a Pokémon can use a move.

## Preserved art and coordinate corrections

- Every recipe retains its palette, shapes, particle counts/laws, easing, impact timing and duration. No shared visual recipe templates were introduced.
- Vine Whip now uses a supplied vine socket; Charizard's socket reproduces the original launch point. Flamethrower applies slope correction per particle velocity.
- Earthquake retains its irregular crack pattern along the supplied floor route. Opponent Surf descends from the far ground plane toward the foreground while keeping the approved wave dimensions.
- Thunder Shock and Thunderbolt incline their existing zigzags and branches along the actual attack route.
- Body Slam, Wing Attack and Blaze Kick derive hop height from their rotated contact sockets so small actors still rise before the hit. Original default-profile coordinates are preserved.
- Rapid Spin, Rollout, Ice Ball and Flame Wheel center rotation/shells on visible artwork. Whirlwind bounds use the same geometric midpoint. These correct off-center custom profiles without replacing the effect art.

## Verification

The sprite sizing update passes all 319 workspace tests and 18 roster/import tests, plus the production build. Coverage includes all 838 front/back views across wide, square and portrait layouts, both facings, and the playground's minimum/default/maximum scale settings. Tests assert both readability minimums, unchanged aspect ratios, fixed platforms, responsive camera fitting and the original default dimensions. Geodude and Unown-X have explicit size regressions and join the representative both-side Tackle/Water Gun lifecycle checks. All 335 effects still pass the starter/opponent suite; the 90 unchanged original geometry frames and Waterfall crop/flow checks pass.

Browser review included Charmander beside Charizard, Unown-X and Geodude at a 360-pixel viewport, and successful Water Gun playback with no horizontal overflow. This is representative visual verification, not a screenshot audit of every species or animation. Custom artwork must still provide sensible visible bounds and sockets.
