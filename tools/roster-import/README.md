# Roster data and sprite import

This importer joins the validated Gen 3 data snapshot with pinned sprite
identities. It creates an independent sprite package and a small host roster
projection. It does not edit battle-core, move rules, FX recipes, existing starter
PNGs or their calibrated anatomy.

## Reproduce

Use Node 24+, from the repository root:

```sh
npm run data:check
npm run roster:setup
npm run roster:fetch
npm run roster:check
npm run test:roster
```

The checked-in assets need no network connection to run the app. `roster:setup`
installs the exact PNG decoder (`pngjs@7.0.0`) in this isolated tool directory
using its lockfile and disabled install scripts. `data:check` additionally needs
the separately installed data-import tools (`npm run data:setup`).

`roster:fetch` downloads missing or changed files from the exact source commit,
verifies their Git blob hashes, decodes PNGs and generates the outputs. The 18
original starter files must match their pin; they are copied into the standalone
package without overwriting the host originals. Downloads are bounded and
retried; a missing or corrupt image fails instead of inventing replacement art.

After setup/fetch, both commands below are offline:

```sh
npm run roster:import  # regenerate metadata from verified local PNGs and data
npm run roster:check  # compare all outputs without accepting or writing changes
```

## Outputs and validation

- `packages/pokemon-sprites/assets`: 838 unchanged front/back PNGs, for all 419 identities.
- `packages/pokemon-sprites/data`: measured visible rectangles and full per-file provenance.
- `packages/pokemon-sprites/src/urls.generated.js`: static asset URLs, suitable for bundlers.
- `apps/game/src/roster/roster.generated.json`: 419 names, numbers, types, abilities, base stats and form identities, copied from the validated data snapshot.
- `reports/validation.json` and `reports/REPORT.md`: coverage, checks and explicit limits.

The host projection is about 182 KB uncompressed. It avoids loading the full
4.48 MB battle-reference snapshot and learnsets just to populate roster selectors.
PNG files remain separate assets; the renderer requests only the selected pair.

Every import checks the Gen 3 snapshot's manifest hash and structural validation,
the complete identity mapping, each image's pinned bytes, all PNG chunk CRCs,
decoded dimensions and nonempty alpha bounds. Visible bounds count all alpha
values above zero, including partially transparent pixels. No pixel is edited.
The manifest records tool/input/output hashes without timestamps, and repeated
generation must be byte-identical.

`source-lock.json` records sprite paths, sizes and Git blob hashes from the pinned
Git trees. It also identifies the pinned PokeAPI identity CSVs used to reconcile
Pokémon/form IDs. The CSVs supply identity only; Showdown remains the source of
Gen 3 battle-reference values. Change pins only deliberately, review every
mapping and artifact diff, then rerun all checks. Never update a hash to dismiss
an unexplained mismatch.

## Host behavior

Both previews use the complete searchable roster and show both types. Optional
reference details display base stats, abilities and form kind. Those values do
not alter preview HP, damage, move availability, turn order or any battle rule.
The 335-move showcase remains unfiltered.

Near actors keep back artwork and far actors keep front artwork when the move
user changes. Original starter anatomy overrides generated bounds; other species
use generic host sockets, which are explicitly not manually measured anatomy.
Castform battle forms are selectable visual fixtures, not new form-change logic.

Legacy exhaustive animation tests retain their nine calibrated starter fixtures.
Separate roster tests cover every 419 identity and 838 images, layouts and source
references, plus representative new-body-shape effects. See the
[validation report](./reports/REPORT.md) for the exact source pin and limits.
