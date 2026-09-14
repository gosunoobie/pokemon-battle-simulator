// Explicit demo teams, validated by the same profile used for their battles.
// These are selectable fixtures, not generated competitive team recommendations.
const set = (species, ability, moves, item = 'Leftovers') => ({
  species, ability, moves, item, nature: 'Hardy', level: 100,
  evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 0, spe: 4 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
})

export const PRESET_TEAMS = [
  {
    id: 'kanto', name: 'Kanto companions',
    description: 'Familiar starters with status moves, recovery, and mixed attacks.',
    team: [
      set('Charizard', 'Blaze', ['Flamethrower', 'Dragon Claw', 'Fly', 'Rest'], 'Chesto Berry'),
      set('Blastoise', 'Torrent', ['Surf', 'Ice Beam', 'Toxic', 'Protect']),
      set('Venusaur', 'Overgrow', ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Synthesis'], 'Lum Berry'),
      set('Raichu', 'Static', ['Thunderbolt', 'Thunder Wave', 'Quick Attack', 'Light Screen'], 'Magnet'),
      set('Alakazam', 'Synchronize', ['Psychic', 'Calm Mind', 'Recover', 'Reflect'], 'Sitrus Berry'),
      set('Machamp', 'Guts', ['Cross Chop', 'Rock Slide', 'Bulk Up', 'Rest']),
    ],
  },
  {
    id: 'johto', name: 'Johto explorers',
    description: 'Elemental attacks, screens, paralysis, and a powerful physical finisher.',
    team: [
      set('Typhlosion', 'Blaze', ['Flamethrower', 'Thunder Punch', 'Smokescreen', 'Rest'], 'Charcoal'),
      set('Feraligatr', 'Torrent', ['Surf', 'Ice Beam', 'Bite', 'Screech'], 'Mystic Water'),
      set('Meganium', 'Overgrow', ['Razor Leaf', 'Body Slam', 'Reflect', 'Synthesis']),
      set('Ampharos', 'Static', ['Thunderbolt', 'Thunder Wave', 'Fire Punch', 'Light Screen'], 'Magnet'),
      set('Espeon', 'Synchronize', ['Psychic', 'Bite', 'Morning Sun', 'Reflect'], 'Lum Berry'),
      set('Heracross', 'Guts', ['Megahorn', 'Brick Break', 'Swords Dance', 'Rock Slide']),
    ],
  },
  {
    id: 'hoenn', name: 'Hoenn expedition',
    description: 'Gen 3 starters with weather, setup moves, and sturdy teammates.',
    team: [
      set('Sceptile', 'Overgrow', ['Leaf Blade', 'Dragon Claw', 'Quick Attack', 'Detect'], 'Miracle Seed'),
      set('Blaziken', 'Blaze', ['Blaze Kick', 'Sky Uppercut', 'Bulk Up', 'Quick Attack'], 'Black Belt'),
      set('Swampert', 'Torrent', ['Surf', 'Earthquake', 'Ice Beam', 'Protect']),
      set('Gardevoir', 'Synchronize', ['Psychic', 'Thunderbolt', 'Calm Mind', 'Hypnosis'], 'Lum Berry'),
      set('Flygon', 'Levitate', ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Sandstorm'], 'Soft Sand'),
      set('Metagross', 'Clear Body', ['Meteor Mash', 'Psychic', 'Agility', 'Protect'], 'Sitrus Berry'),
    ],
  },
]
