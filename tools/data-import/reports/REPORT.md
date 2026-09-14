# Gen 3 data import report

Generated deterministically by `npm run data:import`. Detailed records and reference paths are in [discrepancies.json](./discrepancies.json).

## Pinned source

Pokémon Showdown **0.11.11**, commit [739a5e1fee432ad80ff7136d70cca993be358b59](https://github.com/smogon/pokemon-showdown/tree/739a5e1fee432ad80ff7136d70cca993be358b59), resolved through `Dex.mod('gen3')`. The npm tarball integrity and installed file-tree checksum are in `source-lock.json`; the shipped manifest identifies all importer inputs and generated data.

## Exported coverage

| Collection | Records |
| --- | ---: |
| species | 386 |
| forms | 33 |
| moves | 354 |
| items | 106 |
| captureBalls | 20 |
| abilities | 76 |
| natures | 25 |
| types | 17 |
| learnsets | 419 |

## Validation

Structural, historical regression, and provenance checks passed before writing any artifacts. **20,186 candidate species/move pairs passed**, with **0 failures**; all **8 complete-set fixtures** met expectations. Learnset diagnostics use a separate Gen 3 Obtainable probe; see the JSON for every candidate and complete-set fixture result. These checks compare against the same pinned provider and do not constitute independent cartridge validation.

## Explicit transformations and exclusions

- Deduplicated 16 typed Hidden Power placeholders into one canonical move.
- Omitted 159 species relationships outside the Gen 3 roster; every original relationship is recorded in JSON.
- Inventoried executable callbacks on 257 move/item/ability records. Only allowlisted metadata is exported.
- Expanded cosmetic Unown aliases explicitly, preserving base and form identities.
- Retained only generation-3 acquisition tokens and event/encounter records, preserving original event indices and ancestry.

| Resolved source table | Excluded records |
| --- | ---: |
| species | 1125 |
| types | 2 |
| abilities | 244 |
| moves | 584 |
| items | 477 |
| natures | 0 |

## Existing preview comparison

The preview is a fixed-outcome effects showcase. Its reference fields are compared read-only; differences are migration evidence, not automatic corrections. Fixed preview damage is never treated as a Gen 3 power value.

```json
{
  "catalogMoves": 354,
  "discrepancyFields": 90,
  "mappedPreviewMoves": 335,
  "missingPreviewMoves": 19,
  "movesWithDiscrepancies": 80,
  "noteFields": 235,
  "previewMoves": 335,
  "uniqueOverlappingMoves": 335,
  "unmappedPreviewMoves": 0
}
```

The detailed JSON contains ID mappings and notes on variable/sample values. No preview or FX file is written by this importer.

| Preview move | Field | Preview value | Resolved Gen 3 value |
| --- | --- | --- | --- |
| air-cutter | power | 60 | 55 |
| bide | accuracy | null | 100 |
| bind | accuracy | 85 | 75 |
| blizzard | power | 110 | 120 |
| bone-rush | accuracy | 90 | 80 |
| bubble | power | 40 | 20 |
| bullet-seed | power | 25 | 10 |
| charm | type | Fairy | Normal |
| clamp | accuracy | 85 | 75 |
| cotton-spore | accuracy | 100 | 85 |
| crabhammer | accuracy | 90 | 85 |
| crabhammer | power | 100 | 90 |
| curse | type | Ghost | ??? |
| dig | power | 80 | 60 |
| disable | accuracy | 100 | 55 |
| dive | power | 80 | 60 |
| doom-desire | accuracy | 100 | 85 |
| doom-desire | power | 140 | 120 |
| fire-blast | power | 110 | 120 |
| fire-spin | accuracy | 85 | 70 |
| fire-spin | power | 35 | 15 |
| flamethrower | power | 90 | 95 |
| flash | accuracy | 100 | 70 |
| fly | power | 90 | 70 |
| foresight | accuracy | null | 100 |
| fury-cutter | power | 40 | 10 |
| future-sight | accuracy | 100 | 90 |
| future-sight | power | 120 | 80 |
| giga-drain | power | 75 | 60 |
| glare | accuracy | 100 | 75 |
| high-jump-kick | power | 130 | 85 |
| hydro-pump | power | 110 | 120 |
| ice-beam | power | 90 | 95 |
| icicle-spear | power | 25 | 10 |
| jump-kick | power | 100 | 70 |
| knock-off | power | 65 | 20 |
| leaf-blade | power | 90 | 70 |
| leech-life | power | 80 | 20 |
| lick | power | 30 | 20 |
| lock-on | accuracy | null | 100 |
| luster-purge | power | 95 | 70 |
| memento | accuracy | 100 | true |
| meteor-mash | accuracy | 90 | 85 |
| meteor-mash | power | 90 | 100 |
| mind-reader | accuracy | null | 100 |
| mist-ball | power | 95 | 70 |
| moonlight | type | Fairy | Normal |
| muddy-water | power | 90 | 95 |
| nature-power | accuracy | null | 95 |
| nightmare | accuracy | 100 | true |
| odor-sleuth | accuracy | null | 100 |
| outrage | power | 120 | 90 |
| overheat | power | 130 | 140 |
| petal-dance | power | 120 | 70 |
| pin-missile | accuracy | 95 | 85 |
| pin-missile | power | 25 | 14 |
| poison-gas | accuracy | 90 | 55 |
| psywave | accuracy | 100 | 80 |
| rapid-spin | power | 50 | 20 |
| roar | accuracy | null | 100 |
| rock-blast | accuracy | 90 | 80 |
| rock-smash | power | 40 | 20 |
| rock-tomb | accuracy | 95 | 80 |
| rock-tomb | power | 60 | 50 |
| sand-tomb | accuracy | 85 | 70 |
| sand-tomb | power | 35 | 15 |
| scary-face | accuracy | 100 | 90 |
| skull-bash | power | 130 | 100 |
| smelling-salts | power | 70 | 60 |
| smog | power | 30 | 20 |
| snore | power | 50 | 40 |
| struggle | accuracy | null | 100 |
| surf | power | 90 | 95 |
| swagger | accuracy | 85 | 90 |
| sweet-kiss | type | Fairy | Normal |
| tackle | accuracy | 100 | 95 |
| tackle | power | 40 | 35 |
| thrash | power | 120 | 90 |
| thunder | power | 110 | 120 |
| thunder-wave | accuracy | 90 | 100 |
| thunderbolt | power | 90 | 95 |
| toxic | accuracy | 90 | 85 |
| uproar | power | 90 | 50 |
| vine-whip | power | 45 | 35 |
| whirlpool | accuracy | 85 | 70 |
| whirlpool | power | 35 | 15 |
| whirlwind | accuracy | null | 100 |
| will-o-wisp | accuracy | 85 | 75 |
| wrap | accuracy | 90 | 85 |
| zap-cannon | power | 120 | 100 |

The following catalog moves have no preview rule: `acid`, `camouflage`, `conversion`, `conversion2`, `covet`, `growth`, `haze`, `heatwave`, `mist`, `powdersnow`, `pursuit`, `shockwave`, `sludge`, `snatch`, `spore`, `stockpile`, `swallow`, `thief`, `waterspout`. Catalog coverage does not register or create an animation.

## Limits and follow-up

- This is a metadata projection of a pinned community simulator, not independent proof of cartridge correctness.
- No battle engine, executable callbacks, full team validator, format bans, or competitive clauses are exported. The diagnostic Obtainable format is not the game format.
- Learnsets contain generation-3 acquisition candidates. Event, breeding, version, evolution, and move-combination restrictions require a compatible team validator.
- Hidden Power retains upstream Normal/Physical/basePower 0 placeholders. Its actual type, category, and power need the Gen 3 engine and IVs. Zero base power does not imply zero damage.
- Curse preserves the upstream ??? type sentinel. It is not an eighteenth regular type.
- Cosmetic aliases may inherit their base species generation. upstreamGeneration is not a verified form introduction date; this package targets the resolved Gen 3 mod, not one cartridge/version.
- Descriptions are upstream prose, not executable rules. Item/ability metadata and type multipliers do not encode every mechanic, immunity, condition, or interaction.
- captureBalls is a reference catalog of 20 ball identities introduced by Gen 3, not a Gen 3 capture-availability list. Eight retain upstream Unobtainable flags; Friend Ball retains upstream null. No availability is inferred from these flags. Safari Ball is retained so encounter references resolve even though it is excluded from the standard item table.
- Sprites, cries, sound effects, and animation recipes are outside this import. No existing preview rule or presentation is modified.
