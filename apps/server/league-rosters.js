import { getSpecies, getAbility, getMove, getItem } from '@battle/game-data'

// First-clear cartridge party composition, moves and held items, transcribed
// from pinned pret sources. Levels and generated stats are explicit adaptations;
// see docs/LEAGUE_ROSTERS.md. This module contains no battle rules or progress.
const stats = value => Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(stat => [stat, value]))

function member(speciesId, moveIds, itemId = '') {
  const species = getSpecies(speciesId)
  const ability = species && getAbility(species.abilities['0'])
  const moves = moveIds.map(getMove)
  const item = itemId ? getItem(itemId) : null
  if (!species || !ability || moves.some(move => !move) || (itemId && !item)) {
    throw new Error(`Regional league roster references missing Gen 3 data: ${speciesId}.`)
  }
  return {
    species: species.name, ability: ability.name, moves: moves.map(move => move.name),
    item: item?.name ?? '', nature: 'Hardy', level: 100, evs: stats(0), ivs: stats(31),
  }
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

export const REGIONAL_LEAGUES = freeze([
  {
    id: 'kanto', name: 'Kanto', edition: 'FireRed / LeafGreen',
    description: 'Blue uses his first-clear Blastoise party.',
    trainers: [
      {
        id: 'lorelei', name: 'Lorelei', title: 'Elite Four', specialty: 'Ice',
        sourceParty: 'sParty_EliteFourLorelei',
        originalLevels: [52, 51, 52, 54, 54],
        team: [
          member('dewgong', ['icebeam', 'surf', 'hail', 'safeguard']),
          member('cloyster', ['spikes', 'protect', 'hail', 'dive']),
          member('slowbro', ['icebeam', 'surf', 'amnesia', 'yawn']),
          member('jynx', ['icepunch', 'doubleslap', 'lovelykiss', 'attract']),
          member('lapras', ['confuseray', 'icebeam', 'surf', 'bodyslam'], 'sitrusberry'),
        ],
      },
      {
        id: 'bruno', name: 'Bruno', title: 'Elite Four', specialty: 'Fighting',
        sourceParty: 'sParty_EliteFourBruno',
        originalLevels: [51, 53, 53, 54, 56],
        team: [
          member('onix', ['earthquake', 'rocktomb', 'irontail', 'roar']),
          member('hitmonchan', ['skyuppercut', 'machpunch', 'rocktomb', 'counter']),
          member('hitmonlee', ['megakick', 'foresight', 'brickbreak', 'facade']),
          member('onix', ['doubleedge', 'earthquake', 'irontail', 'sandtomb']),
          member('machamp', ['crosschop', 'bulkup', 'scaryface', 'rocktomb'], 'sitrusberry'),
        ],
      },
      {
        id: 'agatha', name: 'Agatha', title: 'Elite Four', specialty: 'Ghost',
        sourceParty: 'sParty_EliteFourAgatha',
        originalLevels: [54, 54, 53, 56, 58],
        team: [
          member('gengar', ['shadowpunch', 'confuseray', 'toxic', 'doubleteam']),
          member('golbat', ['confuseray', 'poisonfang', 'aircutter', 'bite']),
          member('haunter', ['hypnosis', 'dreameater', 'curse', 'meanlook']),
          member('arbok', ['sludgebomb', 'screech', 'irontail', 'bite']),
          member('gengar', ['shadowball', 'sludgebomb', 'hypnosis', 'nightmare'], 'sitrusberry'),
        ],
      },
      {
        id: 'lance', name: 'Lance', title: 'Elite Four', specialty: 'Dragon',
        sourceParty: 'sParty_EliteFourLance',
        originalLevels: [56, 54, 54, 58, 60],
        team: [
          member('gyarados', ['hyperbeam', 'dragonrage', 'twister', 'bite']),
          member('dragonair', ['hyperbeam', 'safeguard', 'dragonrage', 'outrage']),
          member('dragonair', ['hyperbeam', 'safeguard', 'thunderwave', 'outrage']),
          member('aerodactyl', ['hyperbeam', 'ancientpower', 'wingattack', 'scaryface']),
          member('dragonite', ['hyperbeam', 'safeguard', 'outrage', 'wingattack'], 'sitrusberry'),
        ],
      },
      {
        id: 'blue', name: 'Blue', title: 'Champion', specialty: 'Mixed',
        sourceParty: 'sParty_ChampionFirstSquirtle',
        originalLevels: [59, 57, 59, 59, 61, 63],
        team: [
          member('pidgeot', ['aerialace', 'featherdance', 'sandattack', 'whirlwind']),
          member('alakazam', ['psychic', 'futuresight', 'recover', 'reflect']),
          member('rhydon', ['takedown', 'earthquake', 'rocktomb', 'scaryface']),
          member('arcanine', ['extremespeed', 'flamethrower', 'roar', 'bite']),
          member('exeggutor', ['gigadrain', 'eggbomb', 'sleeppowder', 'lightscreen']),
          member('blastoise', ['hydropump', 'raindance', 'skullbash', 'bite'], 'sitrusberry'),
        ],
      },
    ],
  },
  {
    id: 'johto', name: 'Johto', edition: 'Gold / Silver',
    description: 'Gold/Silver trainer parties adapted to Generation 3 mechanics.',
    trainers: [
      {
        id: 'will', name: 'Will', title: 'Elite Four', specialty: 'Psychic',
        sourceParty: 'WillGroup',
        originalLevels: [40, 41, 41, 41, 42],
        team: [
          member('xatu', ['quickattack', 'futuresight', 'confuseray', 'psychic']),
          member('jynx', ['doubleslap', 'lovelykiss', 'icepunch', 'psychic']),
          member('exeggutor', ['reflect', 'leechseed', 'eggbomb', 'psychic']),
          member('slowbro', ['curse', 'amnesia', 'bodyslam', 'psychic']),
          member('xatu', ['quickattack', 'futuresight', 'confuseray', 'psychic']),
        ],
      },
      {
        id: 'koga', name: 'Koga', title: 'Elite Four', specialty: 'Poison',
        sourceParty: 'KogaGroup',
        originalLevels: [40, 41, 43, 42, 44],
        team: [
          member('ariados', ['doubleteam', 'spiderweb', 'batonpass', 'gigadrain']),
          member('venomoth', ['supersonic', 'gust', 'psychic', 'toxic']),
          member('forretress', ['protect', 'swift', 'explosion', 'spikes']),
          member('muk', ['minimize', 'acidarmor', 'sludgebomb', 'toxic']),
          member('crobat', ['doubleteam', 'quickattack', 'wingattack', 'toxic']),
        ],
      },
      {
        id: 'bruno', name: 'Bruno', title: 'Elite Four', specialty: 'Fighting',
        sourceParty: 'BrunoGroup',
        originalLevels: [42, 42, 42, 43, 46],
        team: [
          member('hitmontop', ['pursuit', 'quickattack', 'dig', 'detect']),
          member('hitmonlee', ['swagger', 'doublekick', 'highjumpkick', 'foresight']),
          member('hitmonchan', ['thunderpunch', 'icepunch', 'firepunch', 'machpunch']),
          member('onix', ['bind', 'earthquake', 'sandstorm', 'rockslide']),
          member('machamp', ['rockslide', 'foresight', 'vitalthrow', 'crosschop']),
        ],
      },
      {
        id: 'karen', name: 'Karen', title: 'Elite Four', specialty: 'Dark',
        sourceParty: 'KarenGroup',
        originalLevels: [42, 42, 45, 44, 47],
        team: [
          member('umbreon', ['sandattack', 'confuseray', 'feintattack', 'meanlook']),
          member('vileplume', ['stunspore', 'acid', 'moonlight', 'petaldance']),
          member('gengar', ['lick', 'spite', 'curse', 'destinybond']),
          member('murkrow', ['quickattack', 'whirlwind', 'pursuit', 'feintattack']),
          member('houndoom', ['roar', 'pursuit', 'flamethrower', 'crunch']),
        ],
      },
      {
        id: 'lance', name: 'Lance', title: 'Champion', specialty: 'Dragon',
        sourceParty: 'ChampionGroup',
        originalLevels: [44, 47, 47, 46, 46, 50],
        team: [
          member('gyarados', ['flail', 'raindance', 'surf', 'hyperbeam']),
          member('dragonite', ['thunderwave', 'twister', 'thunder', 'hyperbeam']),
          member('dragonite', ['thunderwave', 'twister', 'blizzard', 'hyperbeam']),
          member('aerodactyl', ['wingattack', 'ancientpower', 'rockslide', 'hyperbeam']),
          member('charizard', ['flamethrower', 'wingattack', 'slash', 'hyperbeam']),
          member('dragonite', ['fireblast', 'safeguard', 'outrage', 'hyperbeam']),
        ],
      },
    ],
  },
  {
    id: 'hoenn', name: 'Hoenn', edition: 'Ruby / Sapphire',
    description: 'The original Hoenn Elite Four with Steven as Champion.',
    trainers: [
      {
        id: 'sidney', name: 'Sidney', title: 'Elite Four', specialty: 'Dark',
        sourceParty: 'gTrainerParty_Sidney',
        originalLevels: [46, 48, 46, 48, 49],
        team: [
          member('mightyena', ['roar', 'takedown', 'sandattack', 'crunch']),
          member('shiftry', ['fakeout', 'doubleteam', 'swagger', 'extrasensory']),
          member('cacturne', ['leechseed', 'feintattack', 'needlearm', 'cottonspore']),
          member('sharpedo', ['crunch', 'swagger', 'surf', 'slash']),
          member('absol', ['aerialace', 'snatch', 'swordsdance', 'slash'], 'sitrusberry'),
        ],
      },
      {
        id: 'phoebe', name: 'Phoebe', title: 'Elite Four', specialty: 'Ghost',
        sourceParty: 'gTrainerParty_Phoebe',
        originalLevels: [48, 49, 50, 49, 51],
        team: [
          member('dusclops', ['shadowpunch', 'confuseray', 'curse', 'futuresight']),
          member('banette', ['shadowball', 'spite', 'willowisp', 'feintattack']),
          member('sableye', ['shadowball', 'psychic', 'attract', 'feintattack']),
          member('banette', ['shadowball', 'psychic', 'toxic', 'skillswap']),
          member('dusclops', ['shadowball', 'icebeam', 'confuseray', 'earthquake'], 'sitrusberry'),
        ],
      },
      {
        id: 'glacia', name: 'Glacia', title: 'Elite Four', specialty: 'Ice',
        sourceParty: 'gTrainerParty_Glacia',
        originalLevels: [50, 50, 52, 52, 53],
        team: [
          member('glalie', ['lightscreen', 'crunch', 'hail', 'icebeam']),
          member('sealeo', ['surf', 'bodyslam', 'hail', 'iceball']),
          member('sealeo', ['attract', 'dive', 'hail', 'blizzard']),
          member('glalie', ['shadowball', 'crunch', 'hail', 'icebeam']),
          member('walrein', ['surf', 'bodyslam', 'blizzard', 'sheercold'], 'sitrusberry'),
        ],
      },
      {
        id: 'drake', name: 'Drake', title: 'Elite Four', specialty: 'Dragon',
        sourceParty: 'gTrainerParty_Drake',
        originalLevels: [52, 54, 53, 53, 55],
        team: [
          member('shelgon', ['rocktomb', 'dragonclaw', 'protect', 'crunch']),
          member('altaria', ['takedown', 'dragonbreath', 'dragondance', 'refresh']),
          member('flygon', ['dig', 'dragonbreath', 'fly', 'sandstorm']),
          member('flygon', ['flamethrower', 'crunch', 'dragonbreath', 'sandattack']),
          member('salamence', ['flamethrower', 'dragonclaw', 'fly', 'crunch'], 'sitrusberry'),
        ],
      },
      {
        id: 'steven', name: 'Steven', title: 'Champion', specialty: 'Steel',
        sourceParty: 'gTrainerParty_Steven',
        originalLevels: [57, 55, 56, 56, 56, 58],
        team: [
          member('skarmory', ['toxic', 'aerialace', 'spikes', 'steelwing']),
          member('claydol', ['reflect', 'lightscreen', 'ancientpower', 'earthquake']),
          member('aggron', ['thunder', 'earthquake', 'solarbeam', 'dragonclaw']),
          member('cradily', ['gigadrain', 'ancientpower', 'sludgebomb', 'confuseray']),
          member('armaldo', ['waterpulse', 'ancientpower', 'aerialace', 'slash']),
          member('metagross', ['earthquake', 'psychic', 'meteormash', 'hyperbeam'], 'sitrusberry'),
        ],
      },
    ],
  },
])
