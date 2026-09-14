// Metadata projection only. Executable Showdown behavior stays in the upstream engine.
export const SCHEMA_VERSION = 1
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const byId = (a, b) => compare(a.id, b.id)
const byNumber = (a, b) => a.num - b.num || byId(a, b)
const available = record => record.exists && record.gen <= 3 && record.isNonstandard == null

export function stableJson(value) {
  const sort = item => {
    if (Array.isArray(item)) return item.map(sort)
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort(compare).map(key => [key, sort(item[key])]))
    return item
  }
  return `${JSON.stringify(sort(value), null, 2)}\n`
}

function copyJson(value, path = 'record') {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((item, index) => copyJson(item, `${path}[${index}]`))
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyJson(item, `${path}.${key}`)]))
  }
  throw new Error(`Non-JSON or missing upstream value at ${path}`)
}

function required(record, keys) {
  return Object.fromEntries(keys.map(key => {
    if (record[key] === undefined) throw new Error(`Missing required upstream field ${record.id}.${key}`)
    return [key, copyJson(record[key], `${record.id}.${key}`)]
  }))
}

function callbackPaths(record, path = '', result = []) {
  for (const [key, value] of Object.entries(record)) {
    const next = path ? `${path}.${key}` : key
    if (typeof value === 'function') result.push(next)
    else if (value && typeof value === 'object') callbackPaths(value, next, result)
  }
  return result.sort(compare)
}

/** Source tokens remain unchanged; event indices refer to the original upstream array. */
export function parseSource(source) {
  const match = /^3([MLTESR])(\d*)$/.exec(source)
  if (!match || ((match[1] === 'L' || match[1] === 'S') ? !match[2] : !!match[2])) {
    throw new Error(`Unrecognized Gen 3 learnset source: ${source}`)
  }
  return { method: match[1], index: match[2] ? Number(match[2]) : null }
}

export function extractGen3(dex, source) {
  if (dex.gen !== 3) throw new Error('The importer requires a resolved Generation 3 Dex.')
  const audit = { exclusions: {}, omittedRelationships: [], aliases: [], behaviorCallbacks: [] }
  const select = (table, predicate = () => true) => {
    const all = dex[table].all()
    audit.exclusions[table] = all.filter(row => !available(row) || !predicate(row)).map(row => ({
      id: row.id, name: row.name, generation: row.gen,
      reason: !row.exists ? 'nonexistent' : row.isNonstandard != null ? row.isNonstandard : row.gen > 3 ? 'later-generation' : 'outside-national-dex-001-386',
    })).sort(byId)
    return all.filter(row => available(row) && predicate(row))
  }
  const rawSpecies = select('species', row => row.num >= 1 && row.num <= 386)
  const speciesMap = new Map(rawSpecies.map(row => [row.id, row]))
  for (const row of rawSpecies) {
    for (const name of row.cosmeticFormes ?? []) {
      const form = dex.species.get(name)
      if (!available(form) || form.num < 1 || form.num > 386 || !form.isCosmeticForme) {
        throw new Error(`Unexpected cosmetic form ${name}`)
      }
      speciesMap.set(form.id, form)
    }
  }
  const includedSpecies = [...speciesMap.values()].sort(byNumber)
  const typeRows = select('types').sort(byId)
  const typeIds = new Set(typeRows.map(row => row.id))
  const abilityRows = select('abilities').sort(byNumber)
  const abilityIds = new Set(abilityRows.map(row => row.id))
  const referenced = (table, name, allowed) => {
    const result = dex[table].get(name)
    if (!result.exists || !allowed.has(result.id)) throw new Error(`Unavailable ${table} reference ${name}`)
    return result.id
  }
  const relationship = (owner, field, name) => {
    if (!name) return null
    const related = dex.species.get(name)
    if (!related.exists) throw new Error(`Unknown upstream species relationship ${owner.id}.${field}: ${name}`)
    const id = related.id
    if (speciesMap.has(id)) return id
    audit.omittedRelationships.push({ speciesId: owner.id, field, referencedId: id, reason: 'not-in-gen3-roster' })
    return null
  }
  const projectSpecies = row => ({
    ...required(row, ['id', 'num', 'name', 'baseStats', 'weightkg', 'heightm', 'gender', 'genderRatio', 'eggGroups']),
    speciesGeneration: dex.species.get(row.baseSpecies).gen,
    upstreamGeneration: row.gen,
    ...(row.maxHP !== undefined ? { maxHP: copyJson(row.maxHP) } : {}),
    baseSpeciesId: referenced('species', row.baseSpecies, new Set(speciesMap.keys())),
    forme: row.forme,
    baseForme: row.baseForme,
    kind: !row.forme ? 'base' : row.isCosmeticForme ? 'cosmetic' : row.battleOnly ? 'battle-only' : 'alternate',
    types: row.types.map(name => referenced('types', name, typeIds)),
    abilities: Object.fromEntries(Object.entries(row.abilities).map(([slot, name]) => [slot, referenced('abilities', name, abilityIds)])),
    prevo: relationship(row, 'prevo', row.prevo),
    evos: row.evos.map(name => relationship(row, 'evos', name)).filter(Boolean),
    forms: [...(row.otherFormes ?? []), ...(row.cosmeticFormes ?? [])].map(name => relationship(row, 'forms', name)).filter(Boolean),
    battleOnly: row.battleOnly ? (Array.isArray(row.battleOnly) ? row.battleOnly : [row.battleOnly]).map(name => referenced('species', name, new Set(speciesMap.keys()))) : [],
    ...(row.requiredAbility ? { requiredAbility: referenced('abilities', row.requiredAbility, abilityIds) } : {}),
  })
  const speciesRecords = includedSpecies.map(projectSpecies)

  // Typed Hidden Power placeholders share the same canonical id. Retrieve the base record.
  const selectedMoves = select('moves')
  for (const row of selectedMoves.filter(row => row.placeholderFor)) {
    audit.aliases.push({ name: row.name, canonicalId: row.id, reason: 'upstream-placeholder' })
  }
  const moveRows = [...new Set(selectedMoves.map(row => row.id))].map(id => dex.moves.get(id)).sort(byNumber)
  const moveIds = new Set(moveRows.map(row => row.id))
  const moves = moveRows.map(row => ({
    ...required(row, ['id', 'num', 'name', 'category', 'basePower', 'accuracy', 'pp', 'priority', 'target', 'shortDesc', 'desc']),
    introducedGeneration: row.gen,
    type: row.type === '???' && row.id === 'curse' ? row.type : referenced('types', row.type, typeIds),
  }))
  const itemRows = select('items').sort(byNumber)
  const items = itemRows.map(row => ({
    ...required(row, ['id', 'num', 'name', 'shortDesc', 'desc', 'isBerry', 'isPokeball']),
    introducedGeneration: row.gen,
  }))
  // Acquisition metadata has a different scope from obtainable battle items.
  // Safari Ball is Unobtainable as an item but occurs in valid Gen 3 encounters.
  const captureBalls = dex.items.all().filter(row => row.exists && row.gen <= 3 && row.isPokeball &&
    (row.isNonstandard == null || row.isNonstandard === 'Unobtainable')).sort(byNumber).map(row => ({
    ...required(row, ['id', 'num', 'name', 'shortDesc', 'desc', 'isBerry', 'isPokeball']),
    introducedGeneration: row.gen,
    upstreamNonstandard: row.isNonstandard ?? null,
  }))
  const abilities = abilityRows.map(row => ({
    ...required(row, ['id', 'num', 'name', 'shortDesc', 'desc']), introducedGeneration: row.gen,
  }))
  const natures = select('natures').sort(byId).map(row => ({
    ...required(row, ['id', 'name']), plus: row.plus ?? null, minus: row.minus ?? null,
  }))
  const damageCodes = { 0: 1, 1: 2, 2: 0.5, 3: 0 }
  const types = typeRows.map(row => ({
    ...required(row, ['id', 'name']),
    damageTaken: Object.fromEntries(typeRows.map(attacking => {
      const code = row.damageTaken[attacking.name]
      if (!Object.hasOwn(damageCodes, code)) throw new Error(`Unknown type damage code ${attacking.id} -> ${row.id}`)
      return [attacking.id, damageCodes[code]]
    })),
  }))

  for (const [table, rows] of [['moves', moveRows], ['items', itemRows], ['abilities', abilityRows]]) {
    for (const row of rows) {
      const callbacks = callbackPaths(row)
      if (callbacks.length) audit.behaviorCallbacks.push({ table, id: row.id, callbacks })
    }
  }
  const learnsets = includedSpecies.map(row => {
    const chain = dex.species.getFullLearnset(row.id)
    if (!chain.length) throw new Error(`Missing learnset ancestry for ${row.id}`)
    const sources = [], events = [], encounters = [], eventOnlyBySpecies = {}
    for (const entry of chain) {
      const speciesId = entry.species.id
      if (!speciesMap.has(speciesId)) throw new Error(`Unexpected learnset parent ${speciesId} for ${row.id}`)
      if (!entry.learnset) throw new Error(`Missing learnset for ${speciesId}`)
      eventOnlyBySpecies[speciesId] = entry.eventOnly
      for (const [moveId, tokens] of Object.entries(entry.learnset)) {
        for (const token of tokens) {
          if (!token.startsWith('3')) continue
          const parsed = parseSource(token)
          if (!moveIds.has(moveId)) throw new Error(`Gen 3 source references unavailable move ${speciesId}.${moveId}`)
          if (parsed.method === 'S' && entry.eventData?.[parsed.index]?.generation !== 3) {
            throw new Error(`Unresolved event reference ${speciesId}.${moveId}:${token}`)
          }
          sources.push({ speciesId, moveId, source: token })
        }
      }
      for (const [index, event] of (entry.eventData ?? []).entries()) {
        if (event.generation === 3) events.push({ speciesId, index, data: copyJson(event, `${speciesId}.eventData[${index}]`) })
      }
      for (const [index, encounter] of (entry.encounters ?? []).entries()) {
        if (encounter.generation === 3) encounters.push({ speciesId, index, data: copyJson(encounter, `${speciesId}.encounters[${index}]`) })
      }
    }
    const hasSketch = sources.some(entry => entry.moveId === 'sketch')
    const sketchMoveIds = hasSketch ? [...dex.species.getMovePool(row.id)].filter(id => moveIds.has(id)).sort(compare) : []
    return {
      id: row.id, ancestry: chain.map(entry => entry.species.id), eventOnlyBySpecies,
      sources: sources.sort((a, b) => compare(a.speciesId, b.speciesId) || compare(a.moveId, b.moveId) || compare(a.source, b.source)),
      events, encounters, sketchMoveIds,
    }
  })
  audit.omittedRelationships.sort((a, b) => compare(a.speciesId, b.speciesId) || compare(a.field, b.field) || compare(a.referencedId, b.referencedId))
  const data = {
    schemaVersion: SCHEMA_VERSION, generation: 3,
    source: { provider: source.provider, version: source.version, gitCommit: source.gitCommit, dexMod: source.dexMod },
    capabilities: { battleSimulation: false, teamValidation: false, learnsetCandidates: true },
    species: speciesRecords.filter(row => row.kind === 'base'),
    forms: speciesRecords.filter(row => row.kind !== 'base'),
    moves, items, captureBalls, abilities, natures, types, learnsets,
  }
  return { data, audit }
}
