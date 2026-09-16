// Editable, local team settings only. These checks improve form feedback; the
// server's pinned Gen 3 validator remains the authority for complete legality.
export const STATS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe'])
const TEAM_SIZE = 6, MOVE_SLOTS = 4
const STORAGE_KEY = 'battle-simulation-team-draft-v1'
const STORAGE_VERSION = 1, MAX_STORED_LENGTH = 16384
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype'])
const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
// Read only own data properties. An imported object cannot run an accessor while
// being cloned, and inherited or battle-state fields never enter the draft.
const own = (value, key) => {
  if (!value || typeof value !== 'object') return undefined
  const property = Object.getOwnPropertyDescriptor(value, key)
  return property && 'value' in property ? property.value : undefined
}
const text = (value, fallback = '') => typeof value === 'string' && value.length <= 64 && !/[\r\n|]/.test(value) ? value.trim() : fallback
const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const stats = (value, fallback) => Object.fromEntries(STATS.map(stat => [stat, number(own(value, stat), fallback)]))
const validText = value => typeof value === 'string' && value.length <= 64 && !/[\r\n|]/.test(value)

function storageShape(team) {
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) return false
  for (let index = 0; index < TEAM_SIZE; index++) {
    const set = own(team, index)
    if (!isPlain(set)) return false
    for (const key of ['species', 'ability', 'item', 'nature', 'moves', 'evs', 'ivs', 'happiness', 'gender', 'level']) {
      const descriptor = Object.getOwnPropertyDescriptor(set, key)
      if (descriptor && !('value' in descriptor)) return false
    }
    for (const key of ['species', 'ability', 'item', 'nature', 'gender']) {
      const value = own(set, key)
      if (value !== undefined && !validText(value)) return false
    }
    for (const key of ['level', 'happiness']) {
      const value = own(set, key)
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) return false
    }
    const moves = own(set, 'moves')
    if (moves !== undefined) {
      if (!Array.isArray(moves) || moves.length > MOVE_SLOTS) return false
      for (let slot = 0; slot < moves.length; slot++) {
        const descriptor = Object.getOwnPropertyDescriptor(moves, slot)
        if (descriptor && (!('value' in descriptor) || !validText(descriptor.value))) return false
      }
    }
    for (const field of ['evs', 'ivs']) {
      const values = own(set, field)
      if (values === undefined) continue
      if (!isPlain(values)) return false
      for (const stat of STATS) {
        const descriptor = Object.getOwnPropertyDescriptor(values, stat)
        if (descriptor && (!('value' in descriptor) || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value))) return false
      }
    }
  }
  return true
}

export const normalizeId = value => typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''

/** Resolve either the canonical name or ID without changing the catalog. */
export function findCatalogRecord(records, value) {
  const id = normalizeId(value)
  return id && Array.isArray(records) ? records.find(record => normalizeId(record?.id) === id || normalizeId(record?.name) === id) ?? null : null
}

function blankSet() {
  return { species: '', ability: '', item: '', nature: 'Hardy', level: 100,
    moves: ['', '', '', ''], evs: stats(null, 0), ivs: stats(null, 31), happiness: 255, gender: '' }
}

function cloneSet(input) {
  const empty = blankSet()
  if (!isPlain(input)) return empty
  const moves = own(input, 'moves')
  return {
    species: text(own(input, 'species')), ability: text(own(input, 'ability')),
    item: text(own(input, 'item')), nature: text(own(input, 'nature'), 'Hardy'), level: 100,
    moves: Array.from({ length: MOVE_SLOTS }, (_, index) => text(Array.isArray(moves) ? own(moves, index) : undefined)),
    evs: stats(own(input, 'evs'), 0), ivs: stats(own(input, 'ivs'), 31),
    happiness: number(own(input, 'happiness'), 255),
    gender: ['', 'M', 'F', 'N'].includes(own(input, 'gender')) ? own(input, 'gender') : '',
  }
}

/** Clone a preset/canonical team into six editable slots, keeping four move fields. */
export function createTeamDraft(team) {
  return Array.from({ length: TEAM_SIZE }, (_, index) => {
    try { return cloneSet(Array.isArray(team) ? own(team, index) : undefined) }
    catch { return blankSet() }
  })
}

/** A species change deliberately clears the former species' moves and settings. */
export function selectDraftSpecies(_set, speciesRecord, catalog) {
  const next = blankSet()
  if (!speciesRecord) return next
  next.species = text(speciesRecord.name)
  const ability = findCatalogRecord(catalog?.abilities, speciesRecord.abilities?.[0])
  next.ability = ability ? text(ability.name) : ''
  return next
}

/** Remove empty move fields and all UI/unknown fields before server validation. */
export function toTeamPayload(draft) {
  return createTeamDraft(draft).map(set => ({ ...set, moves: set.moves.filter(Boolean) }))
}

/** Cheap form/candidate checks, not egg/event/transfer/moveset legality. */
export function draftIssues(draft, catalog) {
  const issues = []
  const add = (code, message, setIndex) => issues.push({ code, message, ...(setIndex === undefined ? {} : { setIndex }) })
  if (!Array.isArray(draft) || draft.length !== TEAM_SIZE) add('TEAM_SIZE', 'Choose exactly six Pokémon.')
  if (!catalog || !Array.isArray(catalog.species)) {
    add('CATALOG_UNAVAILABLE', 'Load the team catalog before checking your team.')
    return issues
  }
  const rules = { maxMoves: 4, maxEv: 255, totalEvs: 510, maxIv: 31, ...catalog.rules }
  const usedSpecies = new Set()
  for (let index = 0; index < Math.min(Array.isArray(draft) ? draft.length : 0, TEAM_SIZE); index++) {
    const set = own(draft, index)
    if (!isPlain(set)) { add('INVALID_SET', 'Each team slot must contain a Pokémon set.', index); continue }
    const species = findCatalogRecord(catalog.species, own(set, 'species'))
    if (!validText(own(set, 'species')) || !species) add('SPECIES', 'Choose a Pokémon from the Gen 3 roster.', index)
    if (species) {
      const base = normalizeId(species.baseSpeciesId || species.id)
      if (usedSpecies.has(base)) add('SPECIES_CLAUSE', 'Each team member must have a different base species; forms count as the same species.', index)
      usedSpecies.add(base)
    }
    const ability = findCatalogRecord(catalog.abilities, own(set, 'ability'))
    if (!validText(own(set, 'ability')) || !ability || !species?.abilities?.some(id => normalizeId(id) === normalizeId(ability.id))) {
      add('ABILITY', 'Choose an available ability for this Pokémon.', index)
    }
    const item = own(set, 'item')
    if (!validText(item) || (item.trim() && !findCatalogRecord(catalog.items, item))) add('ITEM', 'Choose an available Gen 3 held item, or no item.', index)
    if (!validText(own(set, 'nature')) || !findCatalogRecord(catalog.natures, own(set, 'nature'))) add('NATURE', 'Choose a nature.', index)
    if (own(set, 'level') !== 100) add('LEVEL', 'All team members battle at level 100.', index)

    const moveInput = own(set, 'moves')
    const moves = Array.isArray(moveInput) ? Array.from({ length: Math.min(moveInput.length, MOVE_SLOTS + 1) }, (_, slot) => own(moveInput, slot)) : null
    const populated = moves ? moves.filter(move => typeof move === 'string' && move.trim()) : []
    if (!Array.isArray(moves) || moves.length > rules.maxMoves || populated.length < 1 ||
        populated.length > rules.maxMoves || moves.some(move => !validText(move))) {
      add('MOVES', 'Choose one through four moves; unused move fields can be blank.', index)
    }
    const usedMoves = new Set()
    for (const moveName of populated.slice(0, MOVE_SLOTS)) {
      const move = findCatalogRecord(catalog.moves, moveName)
      const id = normalizeId(move?.id ?? moveName)
      if (usedMoves.has(id)) add('DUPLICATE_MOVE', 'A Pokémon cannot use the same move twice.', index)
      usedMoves.add(id)
      if (!move || !species?.moveIds?.some(candidate => normalizeId(candidate) === id)) {
        add('MOVE_CANDIDATE', `${move?.name ?? text(moveName)} is not in this Pokémon's candidate move list.`, index)
      }
    }
    for (const [field, maximum, code] of [['evs', rules.maxEv, 'EVS'], ['ivs', rules.maxIv, 'IVS']]) {
      const values = own(set, field)
      if (!isPlain(values) || STATS.some(stat => !Number.isInteger(own(values, stat)) || own(values, stat) < 0 || own(values, stat) > maximum)) {
        add(code, `${field === 'evs' ? 'EVs' : 'IVs'} must be whole numbers from 0 through ${maximum}.`, index)
      }
      if (field === 'evs' && STATS.reduce((total, stat) => total + (typeof own(values, stat) === 'number' ? own(values, stat) : 0), 0) > rules.totalEvs) {
        add('EV_TOTAL', `Total EVs cannot exceed ${rules.totalEvs}.`, index)
      }
    }
    const happiness = own(set, 'happiness')
    if (!Number.isInteger(happiness) || happiness < 0 || happiness > 255) add('HAPPINESS', 'Happiness must be a whole number from 0 through 255.', index)
    const gender = own(set, 'gender')
    if (gender !== undefined && !['', 'M', 'F', 'N'].includes(gender)) add('GENDER', 'Choose automatic, male, female or genderless.', index)
  }
  return issues
}

/** Read this browser's saved draft, never a battle/session/checkpoint. */
export function readTeamDraft(storage) {
  try {
    const source = storage?.getItem(STORAGE_KEY)
    if (typeof source !== 'string' || source.length > MAX_STORED_LENGTH) return null
    const saved = JSON.parse(source, (key, value) => {
      if (forbiddenKeys.has(key)) throw new Error('Unsafe saved draft property.')
      return value
    })
    if (!isPlain(saved) || saved.version !== STORAGE_VERSION || !storageShape(saved.team)) return null
    return createTeamDraft(saved.team)
  } catch { return null }
}

/** Persist only whitelisted editable settings. Quota/privacy failures return false. */
export function saveTeamDraft(storage, team) {
  try {
    if (!storageShape(team) || typeof storage?.setItem !== 'function') return false
    const source = JSON.stringify({ version: STORAGE_VERSION, team: createTeamDraft(team) })
    if (source.length > MAX_STORED_LENGTH) return false
    storage.setItem(STORAGE_KEY, source)
    return true
  } catch { return false }
}
