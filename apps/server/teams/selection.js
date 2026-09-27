// Use only after authoritative validation. Canonical validator output can carry
// derived fields (notably hpType) that are not editable engine inputs.
const SET_FIELDS = ['name', 'species', 'ability', 'item', 'moves', 'nature', 'gender', 'level', 'evs', 'ivs', 'happiness', 'shiny', 'pokeball']

export function editableTeam(team) {
  return team.map(set => Object.fromEntries(SET_FIELDS.filter(field => Object.hasOwn(set, field))
    .map(field => [field, structuredClone(set[field])])))
}
