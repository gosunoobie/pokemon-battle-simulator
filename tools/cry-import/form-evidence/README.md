# Evidence for the six explicit form aliases

The first inventory deliberately left Castform Rainy/Snowy/Sunny and Deoxys
Attack/Defense/Speed unresolved because their individual PokéAPI Pokémon IDs have
no file in the pinned `legacy` collection. Absence of a file is not evidence of a
shared cry. These aliases instead use the original games' species-to-cry selection
as reconstructed in the `pret` decompilation projects.

The explicit allowlist and source pins are in [`../form-aliases.json`](../form-aliases.json).
No generic “missing form → base species” rule is authorized.

| Project identity | Selected PokéAPI recording | Evidence |
| --- | --- | --- |
| `castformrainy` | `cries/pokemon/legacy/351.ogg` | Emerald Castform form/type change retains the same species and cry selection |
| `castformsnowy` | `cries/pokemon/legacy/351.ogg` | Same |
| `castformsunny` | `cries/pokemon/legacy/351.ogg` | Same |
| `deoxysattack` | `cries/pokemon/legacy/386.ogg` | FireRed uses Attack-form stats with the same Deoxys species and cry selection |
| `deoxysdefense` | `cries/pokemon/legacy/386.ogg` | LeafGreen uses Defense-form stats with the same Deoxys species and cry selection |
| `deoxysspeed` | `cries/pokemon/legacy/386.ogg` | Emerald uses Speed-form stats with the same Deoxys species and cry selection |

## Emerald trace

Pinned source: [`pret/pokeemerald@5eff78649e7170a877b961ef0b3da13b81a16038`](https://github.com/pret/pokeemerald/tree/5eff78649e7170a877b961ef0b3da13b81a16038).

- [`CastformDataTypeChange`](https://github.com/pret/pokeemerald/blob/5eff78649e7170a877b961ef0b3da13b81a16038/src/battle_util.c#L2382-L2415)
  requires `SPECIES_CASTFORM`, changes the battle type, and returns a weather-form
  index without replacing the species.
- [`sDeoxysBaseStats` and `GetDeoxysStat`](https://github.com/pret/pokeemerald/blob/5eff78649e7170a877b961ef0b3da13b81a16038/src/pokemon.c#L1885-L1893)
  provide Emerald's Speed-form stats while retaining `SPECIES_DEOXYS` (the
  species check is at lines 2698–2713 of the same file).
- [`PlayCryInternal`](https://github.com/pret/pokeemerald/blob/5eff78649e7170a877b961ef0b3da13b81a16038/src/sound.c#L369-L495)
  receives a species and a sound mode, not a form index. It decrements the species
  identifier, resolves `SpeciesToCryId`, and selects a cry table entry. Sound modes
  can alter pitch, length and reversal; this does not introduce a form-specific cry.
- [`SpeciesToCryId`](https://github.com/pret/pokeemerald/blob/5eff78649e7170a877b961ef0b3da13b81a16038/src/pokemon.c#L5701-L5710)
  uses the species lookup table. That table contains one entry each for
  [`Castform` and `Deoxys`](https://github.com/pret/pokeemerald/blob/5eff78649e7170a877b961ef0b3da13b81a16038/src/data/pokemon/cry_ids.h#L111-L136).

## FireRed / LeafGreen trace

Pinned source: [`pret/pokefirered@c75f352304d529f6ba92d4f74b9cf8b5c3810788`](https://github.com/pret/pokefirered/tree/c75f352304d529f6ba92d4f74b9cf8b5c3810788).

- [`sDeoxysBaseStats`](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/pokemon.c#L1640-L1662)
  explicitly selects Attack forme for FireRed and Defense forme for LeafGreen.
  [`GetDeoxysStat`](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/pokemon.c#L6157-L6172)
  still uses the single `SPECIES_DEOXYS` identity.
- [`PlayCryInternal`](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/sound.c#L374-L500)
  and [`SpeciesToCryId`](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/pokemon.c#L5234-L5243)
  select by species, with a single
  [`SPECIES_DEOXYS` → `CRY_DEOXYS` table entry](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/data/pokemon/cry_ids.h#L138).

## Retained records and limitations

Each `.excerpts.json` retains the exact numbered source lines used for review.
The source lock records the full original file's byte count, SHA-256 and Git blob
SHA alongside separate byte counts and SHA-256 for the local excerpt document.
Each excerpt also has its own text SHA-256. Full source blob hashes were checked
against the repository tree at the pinned commit during evidence collection.

These are decompilation-derived source observations; this task did not build or
compare ROMs. The excerpts establish species/form cry identity. They do **not**
establish when or from which cartridge the PokéAPI `legacy` recordings were made,
nor do they establish byte equality between those recordings and GBA samples.

The pinned projects have no root `LICENSE` file; licenses under their `tools/`
directories apply to those tools, not automatically to game source. These small
excerpts are retained as technical provenance only. No decompiled implementation
or audio from either project is included in the game runtime. The audio still
comes exclusively from the independently pinned PokéAPI collection, with its own
retained upstream notice.
