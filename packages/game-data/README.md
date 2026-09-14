# @battle/game-data

Immutable Generation 3 reference data, separate from battle rules, presentation,
sprites, sound and effects. The runtime has **no dependencies** and runs without a
browser. It provides records and exact-ID lookups; it does not simulate battles
or validate complete teams.

The pinned snapshot contains 386 base species, 33 forms, 354 moves, 106 items,
20 capture-ball reference records, 76 abilities, 25 natures, 17 regular types and
419 learnset records. Data is
resolved through Pokémon Showdown's `gen3` Dex, rather than filtered from its
current-generation values. Existing battle previews and their move metadata are
not connected to this package.

## Use

Use Node 24 or later. An application can depend on the local workspace package
or install a packed release; it does not need the importer or Pokémon Showdown.

```js
import {
  GEN3, GEN3_MANIFEST,
  getSpecies, getForm, getMove, getItem, getCaptureBall,
  getAbility, getNature, getType, getLearnset,
} from '@battle/game-data'

const bulbasaur = getSpecies('bulbasaur')
const tackle = getMove('tackle')
const candidates = getLearnset('bulbasaur')
const safariBall = getCaptureBall('safariball')

getSpecies('Bulbasaur') // undefined: display names are not IDs
getMove('not-a-move')   // undefined
```

Every getter returns the same frozen record held in `GEN3`, or `undefined` for a
missing ID. IDs are matched exactly: there is no case folding, trimming, alias
resolution or conversion from display names. `getSpecies` searches base species
only; `getForm` searches the separate form collection. Lookups do not inherit
object keys such as `constructor` or `__proto__`.

`GEN3`, `GEN3_MANIFEST`, their records and all nested arrays/objects are deeply
frozen. Create separate mutable application or battle state instead of attaching
HP, status, inventory or animation state to these records.

The raw snapshots are also public exports:

```js
import data from '@battle/game-data/gen3.json' with { type: 'json' }
import manifest from '@battle/game-data/manifest.json' with { type: 'json' }
```

These JSON exports are ordinary JSON module imports. The root runtime export is
the API that guarantees deep freezing. No private source-file imports are part
of the public contract.

## Schema 1

`data/gen3.json` has this top-level structure:

```js
{
  schemaVersion: 1,
  generation: 3,
  source: { provider, version, gitCommit, dexMod },
  capabilities: {
    battleSimulation: false,
    teamValidation: false,
    learnsetCandidates: true,
  },
  species: [], forms: [], moves: [], items: [], captureBalls: [],
  abilities: [], natures: [], types: [], learnsets: [],
}
```

Every collection record has an `id`. Related species, moves, types and abilities
use IDs instead of object references. The extraction schema is implemented in
[`tools/data-import/extract.mjs`](../../tools/data-import/extract.mjs).

| Collection | Selected fields and meaning |
| --- | --- |
| `species`, `forms` | National number, name, base stats, dimensions, gender metadata, egg groups, type IDs, ability slots, evolution/form relationships and form kind. Optional `maxHP` retains a fixed override, such as Shedinja's `1`. `speciesGeneration` is the base species' introduction generation. `upstreamGeneration` retains the upstream record's generation value; it is not a promise about the form's historical introduction. |
| `moves` | Number, name, introduction generation, Gen 3 type/category, base power, accuracy, PP, priority, target and descriptions. Accuracy retains upstream numeric-or-`true` representation. |
| `items` | Number, name, introduction generation, descriptions and berry/Poké Ball flags. |
| `captureBalls` | A separate identity catalog for balls introduced by Generation 3, including upstream `Unobtainable` records. Uses item metadata plus `upstreamNonstandard` (`null` or `"Unobtainable"`). It is not a list of balls obtainable or usable for capture in Gen 3. |
| `abilities` | Number, name, introduction generation and descriptions. |
| `natures` | Name and stat IDs for `plus`/`minus`; neutral natures use `null`. |
| `types` | The 17 regular Gen 3 types. Each `damageTaken` maps an attacking type ID to its numeric multiplier against this defending type: `0`, `0.5`, `1` or `2`. |
| `learnsets` | Species/form ID, ancestry, source tokens, event-only flags, Gen 3 event/encounter records and candidate `sketchMoveIds`. |

Curse retains its Gen 3 move type sentinel, `"???"`. This is not an eighteenth
regular type and does not have a `getType` record. Consumers must handle the
sentinel explicitly rather than silently changing Curse to a later-generation
type.

`basePower: 0` does not necessarily mean zero damage. Fixed-damage and
variable-power moves require mechanics supplied by the engine. Hidden Power's
`normal` type, `Physical` category and zero base power are resolved upstream
placeholders: a Gen 3 engine must determine its type and power from IVs, then
derive its damage category from that type.

Moves, items and abilities expose reference metadata. Executable upstream
callbacks are intentionally omitted. Fields such as move power, target and
descriptions do not encode every rule needed to execute a move. A battle engine
must supply mechanics separately.

Event and encounter `pokeball` references resolve through `captureBalls`, not
the 106-record `items` collection. For example, Golduck's Safari Ball encounter
is preserved even though `getItem('safariball')` is `undefined`;
`getCaptureBall('safariball')` returns its reference metadata. Neither inclusion
nor `upstreamNonstandard: null` proves Gen 3 capture availability: the source
also gives Friend Ball a null flag. Preserve these source facts and let a
separate validator determine game-specific availability and legality.

## Learnsets are candidates

A learnset record describes potential acquisition paths for that species or
form, including inherited learnset ancestry. Each `sources` entry retains
`{ speciesId, moveId, source }`; `speciesId` identifies the upstream ancestor or
form that owns the source. Only Generation 3 tokens are included:

| Token | Meaning |
| --- | --- |
| `3L<number>` | Level-up source. |
| `3M` | Machine source. |
| `3T` | Tutor source. |
| `3E` | Egg source. |
| `3S<index>` | Event source; resolve against that species' original upstream event index. |
| `3R` | Restricted source; retain the restriction rather than treating it as an unrestricted learnable move. |

Event and encounter records retain their original upstream indices when filtered
to Generation 3. Do not reindex a filtered event list and use its array position
to resolve a `3S` token. `eventOnlyBySpecies`, source ownership and event/encounter
metadata remain available for a future validator.

The presence of a move in `sources` or `sketchMoveIds` **does not establish that
an arbitrary four-move set or team is legal**. Breeding combinations, event
restrictions, levels, game availability and other compatibility rules require a
separate validator. No later-generation source token is imported as a Gen 3
acquisition path.

## Reproduce and check the snapshot

Run these commands from the repository root:

```sh
npm run data:setup
npm run data:import
npm run data:check
npm run test:data
```

`data:setup` installs the pinned importer dependencies in `tools/data-import`
using its separate lockfile, with `npm ci --ignore-scripts --omit=optional`.
`data:import` generates the checked-in data and manifest. `data:check` checks the
snapshot against the pinned source without accepting a newly generated result
as the baseline. `test:data` runs the data checks/tests configured by the host
workspace. The package's runtime tests can also run with
`npm test --workspace @battle/game-data` once the generated files are present.

The isolated importer may use Pokémon Showdown; the published runtime does not.
There are no network requests, battle-engine imports, renderer imports or asset
loads in the runtime. Importing data does not edit or register existing preview
moves or FX recipes.

The pinned source is `pokemon-showdown@0.11.11`, git commit
`739a5e1fee432ad80ff7136d70cca993be358b59`, Dex mod `gen3`. See
[`source-lock.json`](../../tools/data-import/source-lock.json) for the npm tarball
and integrity pin, [`data/manifest.json`](data/manifest.json) for the generated
manifest, and [`NOTICE`](NOTICE) / [`LICENSE`](LICENSE) for upstream provenance
and the reproduced software license.

For an upgrade, explicitly update the source pin, regenerate, inspect the data
and manifest diff, and run checks before accepting the result. Later-generation
support should add an explicitly versioned snapshot/API; it must not silently
change what `GEN3` means.
