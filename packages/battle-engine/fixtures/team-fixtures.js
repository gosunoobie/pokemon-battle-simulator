export function createTeamSet(species, ability, moves, extras = {}) {
  return {
    species, ability, moves: [...moves], nature: 'Hardy', level: 100,
    evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 4 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...extras,
  }
}

export function createTeamFixture() {
  return [
    createTeamSet('Charizard', 'Blaze', ['Flamethrower']),
    createTeamSet('Blastoise', 'Torrent', ['Surf']),
    createTeamSet('Venusaur', 'Overgrow', ['Razor Leaf']),
    createTeamSet('Raichu', 'Static', ['Thunderbolt']),
    createTeamSet('Alakazam', 'Synchronize', ['Psychic']),
    createTeamSet('Machamp', 'Guts', ['Cross Chop']),
  ]
}
