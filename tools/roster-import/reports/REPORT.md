# Roster and sprite validation

**386 species + 33 forms**, each with front and back artwork: **838 PNGs**, 600849 bytes.

Source: [PokeAPI/sprites at 2ecb4eeacd5a1718621fc30f12772e3f60d830b9](https://github.com/PokeAPI/sprites/tree/2ecb4eeacd5a1718621fc30f12772e3f60d830b9). Data: Pokémon Showdown 0.11.11, resolved Gen 3. The locked PokeAPI identity CSVs map forms to filenames; they do not supply battle values.

Every file passed its pinned Git blob checksum, PNG CRC/decode and nonempty alpha-bound checks. All 18 original starter files match exactly. Missing sprites: **0**.

See [validation.json](./validation.json), [source-lock.json](../source-lock.json), and the sprite package manifest for per-file provenance, dimensions and hashes.

## Explicit limits

- Artwork uses the existing default PokeAPI static Gen 5 style collection. Battle reference data remains the resolved Gen 3 snapshot.
- Alpha bounds are measured from actual PNG bytes. New species use generic host attachment sockets; species-specific mouths, hands, eyes and feet have not been manually calibrated.
- The existing 18 starter images and their host-calibrated sockets are preserved. Every other identity has explicit front/back mappings; no base-form substitution is invented.
- All forms are selectable for visual preview, including Castform battle-only forms. Selection does not establish competitive team legality or implement form-change mechanics.
- Stats, types and ability names are display/reference data. Fixed preview HP and outcomes, the unfiltered move showcase, battle-core and FX recipes are not changed by this import.

Identical front/back file bytes, if present in the provider: none.
