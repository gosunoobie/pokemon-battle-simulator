// Structural and selected historical checks for the metadata projection, not team legality.
const EXPECTED_COUNTS = Object.freeze({ species: 386, forms: 33, moves: 354, items: 106, captureBalls: 20, abilities: 76, natures: 25, types: 17, learnsets: 419 })
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const BATTLE_STATS = STATS.filter(id => id !== 'hp')
const SOURCE = /^3(?:[MTR]|L\d+|E|S\d+)$/
const own = (value, key) => Object.hasOwn(value, key)
const toId = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function requireThat(condition, path, message) {
  if (!condition) throw new Error(`Invalid Gen 3 data at ${path}: ${message}`)
}
function object(value, path) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, path, 'expected a plain object')
}
function text(value, path) {
  requireThat(typeof value === 'string' && value.length > 0, path, 'expected a nonempty string')
}
function integer(value, minimum, maximum, path) {
  requireThat(Number.isSafeInteger(value) && value >= minimum && value <= maximum, path, `expected an integer in ${minimum}..${maximum}`)
}
function unique(values, path) {
  requireThat(Array.isArray(values), path, 'expected an array')
  requireThat(new Set(values).size === values.length, path, 'duplicate values')
}
function reference(value, map, path) {
  requireThat(typeof value === 'string' && map.has(value), path, `unresolved reference ${String(value)}`)
}
function references(values, map, path) {
  unique(values, path)
  values.forEach((value, index) => reference(value, map, `${path}[${index}]`))
}
function jsonValue(value, path = 'data', seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return
  if (typeof value === 'number') {
    requireThat(Number.isFinite(value), path, 'nonfinite number')
    return
  }
  requireThat(value && typeof value === 'object', path, 'non-JSON value')
  requireThat(!seen.has(value), path, 'cyclic value')
  if (!Array.isArray(value)) object(value, path)
  seen.add(value)
  for (const [key, child] of Object.entries(value)) jsonValue(child, `${path}.${key}`, seen)
  seen.delete(value)
}

/** Throws on invalid metadata. A successful report makes no complete-team legality claim. */
export function validateGen3(data) {
  jsonValue(data)
  object(data, 'data')
  requireThat(data.schemaVersion === 1 && data.generation === 3, 'data', 'expected schemaVersion 1 and generation 3')
  object(data.source, 'source')
  requireThat(data.source.provider === 'pokemon-showdown' && data.source.dexMod === 'gen3', 'source', 'expected the resolved pokemon-showdown gen3 source')
  text(data.source.version, 'source.version')
  requireThat(/^[a-f0-9]{40}$/.test(data.source.gitCommit), 'source.gitCommit', 'expected a pinned commit hash')
  requireThat(data.capabilities?.battleSimulation === false && data.capabilities?.teamValidation === false && data.capabilities?.learnsetCandidates === true, 'capabilities', 'metadata must not claim simulation or complete team validation')

  const tables = {}, counts = {}
  for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
    const rows = data[name]
    requireThat(Array.isArray(rows) && rows.length === expected, name, `expected exactly ${expected} records`)
    const ids = rows.map((row, index) => {
      object(row, `${name}[${index}]`)
      requireThat(typeof row.id === 'string' && /^[a-z0-9]+$/.test(row.id), `${name}[${index}].id`, 'expected a canonical ID')
      return row.id
    })
    unique(ids, `${name}.ids`)
    tables[name] = new Map(rows.map(row => [row.id, row]))
    counts[name] = rows.length
  }
  const actors = new Map([...tables.species, ...tables.forms])
  requireThat(actors.size === 419, 'forms.ids', 'base species and form IDs overlap')
  requireThat(data.species.every(row => row.kind === 'base') && data.forms.every(row => ['alternate', 'battle-only', 'cosmetic'].includes(row.kind)), 'species.kind', 'base and form tables disagree')
  const nationalNumbers = data.species.map(row => row.num).sort((a, b) => a - b)
  requireThat(nationalNumbers.every((number, index) => number === index + 1), 'species.num', 'National Dex 001..386 must be complete without duplicates')
  for (const row of actors.values()) {
    const path = `species.${row.id}`
    text(row.name, `${path}.name`)
    integer(row.num, 1, 386, `${path}.num`)
    integer(row.speciesGeneration, 1, 3, `${path}.speciesGeneration`)
    integer(row.upstreamGeneration, 1, 3, `${path}.upstreamGeneration`)
    requireThat(row.speciesGeneration === (row.num <= 151 ? 1 : row.num <= 251 ? 2 : 3), `${path}.speciesGeneration`, 'generation does not match the base species National Dex number')
    reference(row.baseSpeciesId, tables.species, `${path}.baseSpeciesId`)
    requireThat(tables.species.get(row.baseSpeciesId).num === row.num, `${path}.baseSpeciesId`, 'form National Dex number differs from its base species')
    requireThat(row.kind !== 'base' || row.baseSpeciesId === row.id, `${path}.baseSpeciesId`, 'base species must reference itself')
    requireThat(typeof row.forme === 'string' && typeof row.baseForme === 'string', path, 'form names must be strings')
    references(row.types, tables.types, `${path}.types`)
    requireThat(row.types.length >= 1 && row.types.length <= 2, `${path}.types`, 'expected one or two regular types')
    object(row.abilities, `${path}.abilities`)
    requireThat(own(row.abilities, '0') && Object.keys(row.abilities).every(key => ['0', '1'].includes(key)), `${path}.abilities`, 'expected Gen 3 normal ability slots; hidden abilities are unavailable')
    for (const [slot, id] of Object.entries(row.abilities)) reference(id, tables.abilities, `${path}.abilities.${slot}`)
    object(row.baseStats, `${path}.baseStats`)
    requireThat(Object.keys(row.baseStats).length === 6, `${path}.baseStats`, 'expected all six base stats')
    for (const stat of STATS) integer(row.baseStats[stat], 1, 255, `${path}.baseStats.${stat}`)
    for (const key of ['heightm', 'weightkg']) requireThat(Number.isFinite(row[key]) && row[key] > 0, `${path}.${key}`, 'expected a positive measurement')
    requireThat(['', 'M', 'F', 'N'].includes(row.gender), `${path}.gender`, 'invalid gender marker')
    object(row.genderRatio, `${path}.genderRatio`)
    for (const key of ['M', 'F']) requireThat(Number.isFinite(row.genderRatio[key]) && row.genderRatio[key] >= 0 && row.genderRatio[key] <= 1, `${path}.genderRatio.${key}`, 'invalid gender ratio')
    requireThat(Array.isArray(row.eggGroups) && row.eggGroups.length > 0 && row.eggGroups.every(value => typeof value === 'string' && value.length > 0), `${path}.eggGroups`, 'expected egg group labels')
    if (row.prevo !== null) reference(row.prevo, actors, `${path}.prevo`)
    for (const key of ['evos', 'forms', 'battleOnly']) references(row[key], actors, `${path}.${key}`)
    requireThat((row.kind === 'battle-only') === (row.battleOnly.length > 0), `${path}.battleOnly`, 'battle-only form classification disagrees')
    if (own(row, 'requiredAbility')) reference(row.requiredAbility, tables.abilities, `${path}.requiredAbility`)
    if (own(row, 'maxHP')) integer(row.maxHP, 1, 255, `${path}.maxHP`)
  }
  for (const name of ['moves', 'items', 'captureBalls', 'abilities']) {
    unique(data[name].map(row => row.num), `${name}.num`)
    for (const row of data[name]) {
      const path = `${name}.${row.id}`
      integer(row.num, 1, 10000, `${path}.num`)
      integer(row.introducedGeneration, 1, 3, `${path}.introducedGeneration`)
      for (const key of ['name', 'shortDesc', 'desc']) text(row[key], `${path}.${key}`)
    }
  }
  for (const row of data.moves) {
    const path = `moves.${row.id}`
    requireThat(row.type === '???' ? row.id === 'curse' : tables.types.has(row.type), `${path}.type`, 'unknown regular type or unexpected typeless sentinel')
    requireThat(['Physical', 'Special', 'Status'].includes(row.category), `${path}.category`, 'invalid damage category')
    integer(row.basePower, 0, 1000, `${path}.basePower`)
    if (row.accuracy !== true) integer(row.accuracy, 1, 100, `${path}.accuracy`)
    integer(row.pp, 1, 64, `${path}.pp`)
    integer(row.priority, -7, 7, `${path}.priority`)
    text(row.target, `${path}.target`)
  }
  for (const row of data.items) for (const key of ['isBerry', 'isPokeball']) requireThat(typeof row[key] === 'boolean', `items.${row.id}.${key}`, 'expected a boolean')
  // This separate identity catalog preserves source flags; it does not certify Gen 3 capture availability.
  for (const row of data.captureBalls) {
    requireThat(row.isPokeball === true && row.isBerry === false, `captureBalls.${row.id}`, 'expected a capture-ball identity')
    requireThat(row.upstreamNonstandard === null || row.upstreamNonstandard === 'Unobtainable', `captureBalls.${row.id}.upstreamNonstandard`, 'unexpected upstream availability marker')
  }
  for (const row of data.natures) {
    text(row.name, `natures.${row.id}.name`)
    requireThat((row.plus === null && row.minus === null) || (BATTLE_STATS.includes(row.plus) && BATTLE_STATS.includes(row.minus) && row.plus !== row.minus), `natures.${row.id}`, 'invalid nature stat modifiers')
  }
  for (const row of data.types) {
    text(row.name, `types.${row.id}.name`)
    object(row.damageTaken, `types.${row.id}.damageTaken`)
    requireThat(Object.keys(row.damageTaken).length === 17, `types.${row.id}.damageTaken`, 'expected all 17 attacking types')
    for (const [id, value] of Object.entries(row.damageTaken)) {
      reference(id, tables.types, `types.${row.id}.damageTaken.${id}`)
      requireThat([0, 0.5, 1, 2].includes(value), `types.${row.id}.damageTaken.${id}`, 'invalid single-type damage multiplier')
    }
  }

  let sourceRows = 0, eventRows = 0, encounterRows = 0, candidatePairs = 0
  for (const row of data.learnsets) {
    const path = `learnsets.${row.id}`
    reference(row.id, actors, `${path}.id`)
    references(row.ancestry, actors, `${path}.ancestry`)
    requireThat(row.ancestry.length > 0, `${path}.ancestry`, 'missing ancestry')
    const ancestry = new Set(row.ancestry)
    object(row.eventOnlyBySpecies, `${path}.eventOnlyBySpecies`)
    requireThat(Object.keys(row.eventOnlyBySpecies).length === ancestry.size, `${path}.eventOnlyBySpecies`, 'expected each ancestry owner exactly once')
    for (const [id, flag] of Object.entries(row.eventOnlyBySpecies)) requireThat(ancestry.has(id) && typeof flag === 'boolean', `${path}.eventOnlyBySpecies.${id}`, 'invalid ancestry flag')
    const eventMap = new Map()
    for (const key of ['events', 'encounters']) {
      requireThat(Array.isArray(row[key]), `${path}.${key}`, 'expected acquisition records')
      const recordIds = new Set()
      for (const entry of row[key]) {
        const location = `${path}.${key}.${entry.speciesId}:${entry.index}`
        requireThat(ancestry.has(entry.speciesId), location, 'acquisition owner is outside ancestry')
        integer(entry.index, 0, 100000, `${location}.index`)
        const id = `${entry.speciesId}:${entry.index}`
        requireThat(!recordIds.has(id), location, 'duplicate acquisition index')
        recordIds.add(id)
        object(entry.data, `${location}.data`)
        requireThat(entry.data.generation === 3, `${location}.data.generation`, 'acquisition source is not Gen 3')
        integer(entry.data.level, 1, 100, `${location}.data.level`)
        if (entry.data.moves) references(entry.data.moves, tables.moves, `${location}.data.moves`)
        if (entry.data.abilities) references(entry.data.abilities, tables.abilities, `${location}.data.abilities`)
        if (entry.data.pokeball) reference(entry.data.pokeball, tables.captureBalls, `${location}.data.pokeball`)
        if (entry.data.nature) reference(toId(entry.data.nature), tables.natures, `${location}.data.nature`)
        if (entry.data.gender) requireThat(['M', 'F', 'N'].includes(entry.data.gender), `${location}.data.gender`, 'invalid gender restriction')
        if (own(entry.data, 'shiny')) requireThat([true, false, 1].includes(entry.data.shiny), `${location}.data.shiny`, 'invalid shiny restriction')
        if (own(entry.data, 'emeraldEventEgg')) requireThat(typeof entry.data.emeraldEventEgg === 'boolean', `${location}.data.emeraldEventEgg`, 'invalid Emerald event-egg flag')
        if (entry.data.ivs) for (const [stat, value] of Object.entries(entry.data.ivs)) {
          requireThat(STATS.includes(stat), `${location}.data.ivs.${stat}`, 'unknown IV stat')
          integer(value, 0, 31, `${location}.data.ivs.${stat}`)
        }
        if (key === 'events') eventMap.set(id, entry.data)
      }
    }
    requireThat(Array.isArray(row.sources), `${path}.sources`, 'expected move source records')
    const sourceIds = new Set(), candidates = new Set()
    for (const entry of row.sources) {
      const location = `${path}.sources.${entry.speciesId}.${entry.moveId}:${entry.source}`
      requireThat(ancestry.has(entry.speciesId), location, 'move source owner is outside ancestry')
      reference(entry.moveId, tables.moves, `${location}.moveId`)
      requireThat(typeof entry.source === 'string' && SOURCE.test(entry.source), location, 'invalid Gen 3 source grammar')
      const sourceId = `${entry.speciesId}:${entry.moveId}:${entry.source}`
      requireThat(!sourceIds.has(sourceId), location, 'duplicate move source')
      sourceIds.add(sourceId)
      if (entry.source[1] === 'L') integer(Number(entry.source.slice(2)), 0, 100, `${location}.level`)
      if (entry.source[1] === 'S') {
        const event = eventMap.get(`${entry.speciesId}:${Number(entry.source.slice(2))}`)
        requireThat(event, location, 'unresolved original event index')
        requireThat(event.moves?.includes(entry.moveId), location, 'event index does not contain the source move')
      }
      candidates.add(entry.moveId)
    }
    references(row.sketchMoveIds, tables.moves, `${path}.sketchMoveIds`)
    const hasSketch = candidates.has('sketch')
    requireThat(hasSketch === (row.sketchMoveIds.length > 0), `${path}.sketchMoveIds`, 'Sketch expansion must have a Gen 3 Sketch source')
    requireThat(!row.sketchMoveIds.includes('struggle'), `${path}.sketchMoveIds`, 'Struggle is not Sketchable')
    row.sketchMoveIds.forEach(id => candidates.add(id))
    requireThat(candidates.size > 0, path, 'missing move candidates')
    sourceRows += row.sources.length
    eventRows += row.events.length
    encounterRows += row.encounters.length
    candidatePairs += candidates.size
  }

  // Independent historical sentinels catch accidental current-generation extraction.
  const move = id => tables.moves.get(id)
  const history = [
    [move('curse')?.type === '???', 'Curse must retain the Gen 3 ??? type'],
    [move('hiddenpower')?.basePower === 0 && move('hiddenpower')?.type === 'normal' && move('hiddenpower')?.name === 'Hidden Power', 'Hidden Power must remain the canonical variable-power record'],
    [move('flamethrower')?.basePower === 95, 'Flamethrower must have Gen 3 power 95'],
    [move('tackle')?.basePower === 35 && move('tackle')?.accuracy === 95, 'Tackle must have Gen 3 power 35 and accuracy 95'],
    [move('knockoff')?.basePower === 20 && move('knockoff')?.category === 'Special', 'Knock Off must have Gen 3 power 20 and Special category'],
    [move('petaldance')?.basePower === 70, 'Petal Dance must have Gen 3 power 70'],
    [tables.species.get('clefairy')?.types.join(',') === 'normal', 'Clefairy must be Normal, without Fairy typing'],
    [tables.species.get('shedinja')?.maxHP === 1, 'Shedinja must retain its fixed maximum HP metadata'],
    [tables.captureBalls.get('safariball')?.upstreamNonstandard === 'Unobtainable', 'Safari Ball must preserve its upstream acquisition identity flag'],
    [tables.types.get('steel')?.damageTaken.ghost === 0.5 && tables.types.get('steel')?.damageTaken.dark === 0.5, 'Steel must resist Ghost and Dark'],
    [tables.types.get('ghost')?.damageTaken.normal === 0 && tables.types.get('normal')?.damageTaken.ghost === 0, 'Normal/Ghost immunity chart orientation is incorrect'],
    [tables.forms.get('unownquestion')?.kind === 'cosmetic' && tables.forms.get('castformsunny')?.kind === 'battle-only' && tables.forms.get('deoxysattack')?.kind === 'alternate', 'Gen 3 form classifications are incomplete'],
    [tables.learnsets.get('raichu')?.ancestry.join(',') === 'raichu,pikachu,pichu', 'Raichu learnset ancestry is incomplete'],
    [tables.learnsets.get('unownquestion')?.ancestry.join(',') === 'unown', 'Unown cosmetic form must inherit the base learnset'],
    [tables.learnsets.get('smeargle')?.sketchMoveIds.length === 353, 'Smeargle must include the 353 Sketch candidates, including Sketch itself'],
  ]
  for (const [valid, message] of history) requireThat(valid, 'historical', message)
  return {
    valid: true,
    counts,
    checks: { historicalSentinels: history.length, sourceRows, eventRows, encounterRows, candidatePairs, completeTeamLegality: false },
  }
}
