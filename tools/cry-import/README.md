# Pokémon cries: stage-one inventory

This dependency-free Node tool inventories the upstream **legacy** cry collection for the project's existing Gen 1–3 roster. It generates a mapping and discrepancy report. It does not download, decode, optimize, deploy or play any audio, and does not change battle data or mechanics.

## Current result

- 386 base species have an exact Pokémon-ID path in the pinned legacy collection.
- 27 extra Unown forms share the verified Pokémon ID 201 and its source path.
- Six forms remain unresolved: Castform Sunny/Rainy/Snowy and Deoxys Attack/Defense/Speed. Their exact legacy paths are absent. Available base and latest candidates are listed for review, never selected as fallbacks.
- All 419 project identities are accounted for; 413 currently have source-path mappings.
- 386 selected source files total **2,245,221 bytes according to GitHub tree metadata**. This is not a measurement of downloaded, decoded or optimized assets.
- Zero cry audio files have been fetched or decoded by this tool.

Read [the generated inventory](reports/inventory.md) for the human-readable report, [inventory.json](reports/inventory.json) for all mappings and source-file metadata, and [discrepancies.json](reports/discrepancies.json) for machine-readable unresolved cases and pending checks.

## Commands

From the workspace root, using the project's supported Node version:

```sh
npm run cries:inventory
npm run cries:check
npm run test:cries
```

`cries:inventory` rebuilds the three reports deterministically from local pinned metadata. It performs no network requests. Input validation completes before it writes reports; each report is replaced atomically. A process interruption between reports can leave a mixed report set, detected by `cries:check` and repaired by rerunning generation.

`cries:check` is entirely offline and read-only. It validates source snapshots, input hashes, source-tree integrity, identity coverage and exact generated report contents. Known, explicitly reported unresolved mappings do not fail this stage-one consistency check.

To require complete mapping coverage as well:

```sh
npm run cries:check -- --require-resolved
```

This deliberately exits nonzero while the six form mappings remain unresolved. Neither command certifies playable audio; decoding and browser checks belong to stage two.

Optional upstream verification:

```sh
npm run cries:verify-source
```

This makes four public metadata/document requests: the exact commit, its recursive tree, README and LICENSE. It normalizes and compares the responses with the checked-in snapshots. It never requests `.ogg` files, follows `main`, updates a pin, or writes files. Network failures and provider rate limits fail the command; ordinary checks and builds remain usable offline.

## Pins and evidence

The cry repository is pinned independently of battle rules and sprite artwork:

- Repository: <https://github.com/PokeAPI/cries>
- Commit: `ef687b18f0ce17169b4b4c09175819f7ade92f0f`
- Root Git tree: `f2d94d5cdf098bb1e01370a6aab12aa7cd6dbaef`
- Collection: `legacy`
- Identity source: the existing `tools/roster-import/source-lock.json`, whose PokéAPI identity CSVs are pinned at `4b82c204ddd19ecb8eda2ea044ccb59e222b721c`.

`source-lock.json` pins SHA-256 hashes and lengths for the game-data input, its manifest, the existing roster mapping and four source snapshots. The original game-data hash must also agree with its own validated manifest. No live PokéAPI endpoint is used to infer battle data or names.

`sources/commit.json` retains stable commit metadata, omitting GitHub profile/counter fields. `sources/tree.json` retains the complete normalized recursive tree, including modern cries as metadata only. Keeping the complete tree lets the validator reconstruct **every Git tree object** and match its SHA-1 identity, detecting missing entries even if a response incorrectly claims not to be truncated. It also supports evidence for absent legacy paths without downloading unrelated cries.

`sources/README.upstream.md` and `sources/LICENSE.upstream.txt` preserve upstream text unchanged. Their bytes must match both the local SHA-256 lock and the Git blob hashes in the pinned tree.

Git blob hashes describe upstream content identity; they are not a substitute for downloading and validating audio. Source-file byte sizes come from the GitHub API; sizes are not encoded in Git tree objects. Stage two must verify both actual length and blob hash before accepting each download, then record its SHA-256 and audio inspection results.

## Identity rules

The declared game roster is the allowlist: 386 base species plus 33 forms. Do not include modern forms merely because their National Dex number is below 387. Do not filter by `pokeapiPokemonId <= 386`, which would drop legitimate Gen 3 forms.

Cry filenames use **Pokémon IDs**, never Pokémon-form IDs or sprite filenames. For example:

| Project ID | Pokémon ID | Form ID | Result |
| --- | ---: | ---: | --- |
| `unownb` | 201 | 10001 | Shared `legacy/201.ogg` |
| `deoxysattack` | 10001 | 10031 | Missing `legacy/10001.ogg`; unresolved |
| `castformrainy` | 10014 | 10029 | Missing `legacy/10014.ogg`; unresolved |

The Unown mappings reuse an existing shared Pokémon identity. This is different from inferring that two different Pokémon IDs should share a recording. Missing form files never silently fall back to a base-species cry or to the `latest` collection. Unknown or additional identities cause validation failure.

## Revisions and future stages

The existing source lock is a review boundary. Commands cannot silently bless changed inputs or update the upstream revision. A future update should explicitly select a full commit, capture normalized metadata with `normalizeCommit`/`normalizeTree`, verify the document Git blobs, and review source/input hashes and generated differences together. Keep the prior revision available in version control. Never replace a failed checksum merely to make a check pass.

Before creating a complete deployable catalog, resolve the six form mappings using additional pinned evidence or an explicit, documented product decision. Merely finding a base recording is not evidence that it is the correct variant recording. Preserve these discrepancies until that decision is recorded.

Stage two can fetch `inventory.files` at their immutable URLs, check lengths and Git blob hashes, record SHA-256, inspect/decode Ogg and make measured optimization decisions. It must keep audio originals and staging outside `public`, exclude its new cache from Heroku deployment, and publish generated assets only after validation. The existing MP3 optimizer must remain independent: its ID3 stripping algorithm is not applicable to Ogg.

Stage three can add a small cry catalog package and the browser audio player, connected to host presentation cues. No runtime package, frontend import, audio endpoint, cache directory, database change or deployment change is introduced in stage one.

## Recording provenance

`legacy` is the upstream collection label, not proof of authentic Gen 3 cartridge recordings. Recording vintage and audible content remain unverified in this metadata-only stage.

The upstream LICENSE says the audio contents are copyrighted by The Pokémon Company and separately describes the repository's CC0 dedication. Retain the complete notice; this inventory does not establish redistribution rights to the recordings.
