# Reproducible Gen 3 metadata importer

This tool produces the independent [`@battle/game-data`](../../packages/game-data/README.md)
package from the exact npm release `pokemon-showdown@0.11.11`, resolving its
`gen3` mod before projection. It never fetches data at game runtime and never
writes preview, engine or FX source files.

## Commands

Use Node 24+ and run from the repository root:

```sh
npm run data:setup
npm run data:import
npm run data:check
npm run test:data
```

Setup is the only network-dependent step. It uses this directory's independent
npm lockfile, omits optional dependencies and disables installation scripts.
The release includes the compiled simulator needed by the importer. Showdown
and its dependencies are not dependencies of the exported data package or the
game. A root `npm ci` does not install this isolated tool environment.

Import resolves and validates all records before writing six generated files:

- `packages/game-data/data/gen3.json`: the schema-1 reference snapshot.
- `packages/game-data/data/manifest.json`: revision, integrity, counts, input and output hashes.
- `packages/game-data/data/source-files.json`: sorted file hashes of the installed upstream package.
- `packages/game-data/LICENSE`: the unmodified upstream software license.
- `tools/data-import/reports/discrepancies.json`: complete machine-readable audit and diagnostics.
- `tools/data-import/reports/REPORT.md`: readable report with limitations.

`data:check` rebuilds everything in memory and fails on any missing or changed
artifact, without writing a replacement. It also checks the preview-comparison
report against the current preview metadata. If that metadata changes later,
regenerate and review the report even if the dataset itself is unchanged.

To generate into a separate destination, preserving the same repository-relative
layout, or check that destination:

```sh
npm run data:import -- --output-dir /private/tmp/gen3-reproduction
npm run data:import -- --check --output-dir /private/tmp/gen3-reproduction
```

No timestamps, absolute source paths, random IDs or live network responses enter
the artifacts. The same source, importer and preview-comparison input produce
the same bytes. Generated snapshots are checked in; consumers do not rebuild them.

## Source and projection

[`source-lock.json`](./source-lock.json) records the npm version, published
`gitHead`, tarball URL/integrity and an expected SHA-256 tree identity. npm
verifies tarball integrity during setup. Before executing Showdown, the importer
checks the dependency version and npm lock entry, then hashes the full installed
provider package against the saved identity. Unexpected installed-byte changes
fail rather than becoming the new baseline. Nested dependencies are pinned by
the npm lockfile; the provider tree inventory excludes their `node_modules`.

[`extract.mjs`](./extract.mjs) is an explicit allowlist, not serialization of the
entire simulator Dex. It exports resolved historical metadata, canonical IDs,
base species and forms, type multipliers, natures and generation-3 acquisition
sources. It rejects missing required values and unknown references. It does not
fill values from model memory or use a current-generation fallback.

Typed Hidden Power placeholders are deduplicated. Future species relationships
are removed and individually reported. Cosmetic Unown forms are expanded.
Learnset events preserve their original indices, and Smeargle has an explicit
Sketch candidate expansion. Capture-ball identities have their own reference
table, so a Safari Ball encounter can resolve without treating Safari Ball as
an obtainable held item. This table includes older ball identities and is not
a claim of Gen 3 capture availability.

The schema deliberately omits executable callbacks and most engine-specific
fields. It is useful for a team builder and for supplying reference data to a
future engine; it cannot execute moves or validate complete teams. The complete
field contract and known placeholder semantics are in the package README.

## Validation and review

`validate.mjs` checks National Dex coverage, explicit form namespaces, IDs,
cross-references, historical categories/stats/types, ability slots, the type
chart, learnset ancestry, source grammar and original event references. Negative
tests remove or corrupt records to ensure these gates actually fail.

`diagnostics.mjs` additionally checks every candidate against the pinned
provider's team validator and exercises known incompatible full sets. Its
diagnostic `Obtainable` format does not choose a competitive tier, banlist or
clauses for the game. Candidate checks are independent and use the provider's
default level 100; they do not prove all combinations or levels are legal.

The same-provider checks establish consistent extraction, not independent
cartridge accuracy. The [report](./reports/REPORT.md) records provider limits,
omitted executable behavior, excluded records and differences from the preview.
Existing showcase sample damage and sentinel values are not silently converted
into battle rules. Keep unresolved historical questions visible until there is
reviewable evidence for a source update or a separately documented correction.

## Updating a pin

1. Choose a specific new release intentionally. Verify its npm version,
   `gitHead`, tarball URL and integrity against the provider's published metadata.
2. Update this tool's exact dependency and lockfile in isolation. Install with
   scripts disabled and inspect the provider change before executing it.
3. Hash the verified installed provider with `inventory()` and `sha256(stableJson(files))`
   from `provenance.mjs`/`extract.mjs`; review and update `source-lock.json`.
   Never refresh a checksum merely to dismiss a mismatch.
4. Regenerate, review every data/provenance/discrepancy diff, and run
   `data:check`, `test:data`, the existing tests and the production build.
5. Release a deliberate package version. Add future generations as separate
   snapshots/contracts instead of changing the meaning of `GEN3` in place.

Source changes may legitimately alter coverage or schema. Investigate validation
failures before revising expected counts or historical regression values.
