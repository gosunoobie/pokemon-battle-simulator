# Regional league roster provenance

The league fixture is `apps/server/league-rosters.js`. It contains three separate,
ordered five-battle circuits. The player fights the four Elite Four members and
then that region's Champion. These are **adapted NPC teams under Gen 3 mechanics**,
not a reproduction of cartridge AI, generated stats, bag items or the original
level curve.

| League | Edition | Order | First-clear party source |
| --- | --- | --- | --- |
| Kanto | FireRed / LeafGreen | Lorelei, Bruno, Agatha, Lance, Blue | `sParty_EliteFourLorelei`, `sParty_EliteFourBruno`, `sParty_EliteFourAgatha`, `sParty_EliteFourLance`, `sParty_ChampionFirstSquirtle` |
| Johto | Gold / Silver | Will, Koga, Bruno, Karen, Lance | `WillGroup`, `KogaGroup`, `BrunoGroup`, `KarenGroup`, `ChampionGroup` |
| Hoenn | Ruby / Sapphire | Sidney, Phoebe, Glacia, Drake, Steven | `gTrainerParty_Sidney`, `gTrainerParty_Phoebe`, `gTrainerParty_Glacia`, `gTrainerParty_Drake`, `gTrainerParty_Steven` |

Each circuit retains the original five-member Elite Four parties and six-member
Champion party, including repeated species and party order. There are 15 trainers
and 78 total team slots. Kanto deliberately selects **Blue's Blastoise variant**;
the team does not vary according to the player's preset or lead. Hoenn uses the
Ruby/Sapphire parties throughout, not Emerald's changed parties or Wallace.

## Pinned sources

Sources were retrieved on 2026-09-16 from the pret decompilation/disassembly
projects. The SHA-256 is of the complete raw source file, not the adapted fixture.
No ROM images, trainer artwork or upstream implementation code are distributed
by this fixture.

| Repository | Commit | File SHA-256 |
| --- | --- | --- |
| `pret/pokefirered` | `c75f352304d529f6ba92d4f74b9cf8b5c3810788` | `cb135d9cbdfc52c87066374d582506830a8c93561eab2033d847331c2de00299` |
| `pret/pokegold` | `656583c939d30f920a316177311a502dd222b57c` | `fd7099ef191cdd65a286d78cf79b39f10a6bb448962be7de297302e69909b8b9` |
| `pret/pokeruby` | `63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1` | `63b460bf7bbcd1c35011072e9f6bebd190c3a1c6d982e0ec3f239d3265b6dc9a` |

- [FRLG trainer parties at the pinned commit](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/src/data/trainer_parties.h)
- [Gold/Silver trainer parties at the pinned commit](https://github.com/pret/pokegold/blob/656583c939d30f920a316177311a502dd222b57c/data/trainers/parties.asm)
- [Ruby/Sapphire trainer parties at the pinned commit](https://github.com/pret/pokeruby/blob/63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1/src/data/trainer_parties.h)

To audit the fixture, retrieve the pinned raw files, compare their SHA-256 values,
and inspect the named party blocks above. For every party slot, compare species,
the ordered four moves, held item and `originalLevels`. The fixture's level is
always 100 by the user's selected rules. This is a reviewed fixture, not a new
general-purpose trainer-data importer.

## Explicit adaptations

- Every player and NPC Pokemon uses level 100. `originalLevels` records the source
  levels as provenance only; it never controls battle stats.
- NPC species, ordered moves and held items are transcribed from the source.
  `ITEM_NONE` and the Gen 2 `TRAINERTYPE_MOVES` parties become an empty held item.
  Sitrus Berries remain held items on the FRLG and Ruby/Sapphire aces. Trainer bag
  items such as Full Restores are not part of the fixture or battle actions.
- The source names `FAINT_ATTACK` and `HI_JUMP_KICK` map to the pinned dataset's
  canonical Feint Attack and High Jump Kick. `PSYCHIC_M` maps to Psychic. These are
  identifier/name differences, not replacement moves.
- All NPCs use Hardy nature, zero EVs, and 31 in each IV. These are deliberate,
  uniform simulation settings, not inferred cartridge-generated stats. In
  particular, the Gen 3 source's `.iv = 250` is not a legal per-stat IV of 250.
- Every NPC receives its species' **slot 0 Gen 3 ability**, resolved through the
  pinned `@battle/game-data` package. The fixture does not claim to reproduce a
  cartridge personality/ability roll. Gold/Silver has no abilities or natures,
  so these fields are explicitly introduced by the Gen 3 adaptation.
- Opponent selection, command handling, full healing between battles and
  tournament progress belong to the simulation host, not this data module.
  The existing player presets retain their existing moves and stat allocation.
- The data module checks all species, moves, items and ability references and
  freezes its records. This reference check does not replace engine legality
  validation.

## Discrepancy found by validation

The pinned Showdown 0.11.11 Gen 3 Obtainable validator accepts 14 of the 15 teams
under a league format permitting five-member teams and repeated species. It
rejects exactly one sourced move:

| Trainer / slot | Source value | Gen 3 validator result |
| --- | --- | --- |
| Johto Karen / slot 4 | Murkrow: Quick Attack, Whirlwind, Pursuit, Feint Attack | `Murkrow's move Quick Attack can't be transferred from Gen 7 to 3.` |

The Gold/Silver source explicitly gives this NPC Murkrow Quick Attack even though
the corresponding Gen 3 player-obtainable set is invalid. The fixture preserves
that source value. `packages/battle-engine/src/profile.js` declares one exception
on the separate `gen3regionalleaguev1` profile: Murkrow with exactly Quick Attack,
Whirlwind, Pursuit and Feint Attack. Only opponent validation enables it. Engine
creation uses that validation for the `p2` NPC seat; `p1` receives ordinary Gen 3
move validation and this sourced set is rejected there.

The exception temporarily excludes Quick Attack from validation, validates the
remaining moves and every other field normally, and restores the original move
only when validation succeeds. It does not suppress arbitrary error strings.
Changing the species or moveset removes eligibility; an invalid ability, item or
stat allocation still fails. The competitive `gen3opensinglesv1` profile has no
NPC move exceptions, still requires six distinct species, and is unchanged.

Exactly-zero-EV advisories are informational and are handled by the existing
engine policy without changing the intended zero EVs. All other errors must
remain errors. NPC team sizes and duplicate species are intentional differences
from Open Singles v1 and use the league's separate profile.

`tests/simulation-league-rosters.test.mjs` validates all 15 NPC teams, data
references, explicit adaptations, frozen fixtures, and the NPC-only exception.
Its normalized catalog SHA-256 (`89fca33516267109f2a4b4292f739878584b9b4ebdec76b00a64d5703271abba`)
protects the reviewed roster content, move order and selected stat policy from
accidental edits. It excludes descriptive UI copy. Update that digest only after
an intentional roster change has been audited against the pinned source blocks;
the digest itself is a regression check, not independent proof of accuracy.
