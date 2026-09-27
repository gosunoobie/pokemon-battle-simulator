# Gen 3 starter-set collection

This offline tool builds the server's `gen3-starters-v1` collection. The ordinary
team editor and server validator remain the authorities for editable fields and
complete legality. Generation policy never changes battle rules or random rolls.

Run `node tools/team-generation/build.mjs` to rebuild, or add `--check` to detect
drift without writing. Run `node --test tests/random-team-corpus.test.mjs` for
coverage, actual six-member validation, editor round trips, quality assertions,
deterministic reproduction and representative headless battle checks.

The collection has exactly one set per each of the 386 base species. The runtime
must sample base species first; multiple forms or future templates must not give
a species extra weight. Origin metadata stays outside each editable set.

## Provenance and admission

`packages/battle-engine/src/generation.js` is a narrow offline adapter. It verifies
the existing pinned Pokémon Showdown file tree before loading its Gen 3 random
set generator. The vendor provides moves, item, ability and Hidden Power IVs for
213 collection members. Four relevant vendor-covered species instead use
explicit project mechanic overrides. The other 169 species have project starter
sets, for 173 project-generated entries overall. The exact counts are recorded in
`report.json` and should be recalculated after policy changes.

Vendor levels and uniform random-battle EVs are adapted to this project's level
100 profile. Natures/EVs use the moves' **Gen 3** categories and the stated role.
HP-dependent Substitute/berry setups are retuned at level 100. Hidden Power is
stored as the editor's plain move plus its IVs; typed aliases and validator-only
`hpType` never cross into editable DTOs. Full-team validation is repeated after
normalization and after conversion back to editable fields.

The source-aware fallback ranks same-type attacks, usable coverage and compatible
utility. Ranking uses Gen 3 base stats and move facts, prefers repeatable sources,
penalizes low accuracy, recoil and charging, and tries each move through the real
validator in a six-member fixture. Return's friendship-based power and fixed
damage are handled explicitly. Source ranking is only a preference; the actual
validator decides whether egg, tutor and event moves can coexist.

Explicit overrides cover limited movepools (including Ditto, Unown and Beldum),
Wobbuffet/Wynaut, Smeargle, Chansey, Clamperl, Cubone and Huge Power users. Ordinary
species must have four moves and a plausible attack or support plan. Low-move
exceptions are documented in `policy.mjs` and the report; they retain equal odds.

## What baseline review means

Every entry is labeled `baseline-checked`, not competitively optimized. Acceptance
checks cover legal complete combinations, role-appropriate stats, Hidden Power,
sleep/Stockpile dependencies, passive Choice items and special species mechanics.
The fallback list was also inspected for generic-setting mistakes; this caught
missing dynamic Return power and an Attack-IV reset bug when a special-only
partial candidate later gained physical coverage. Targeted tests retain those
regressions, including Shedinja's unusable HP investment.

Tests run short real-engine battles using physical, special, mixed, event,
Transform, counter, Sketch-support and one-move sets. These are integration and
mechanics smoke checks, not a win-rate study. The collection does not assess whole
team synergy, equal matchup strength, competitive viability or long-term balance.
Weak species remain weak. Future reviewed variants can improve variety without
altering the editable team or selection contracts.

Rebuilds are deterministic and record source, data, profile, adapter, builder and
policy hashes. There are no timestamps or runtime-dependent fingerprints in the
artifact. An upstream/profile/policy change requires regeneration and review.
The generated JSON is self-contained: requests never run the vendor random-set
generator. Runtime generation must still validate the final assembled team,
including all untrusted retained slots.
