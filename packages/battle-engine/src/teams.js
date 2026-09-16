import { getProfile, getFormat } from './profile.js'
import { getVendor } from './vendor.js'

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const FIELDS = new Set(['name', 'species', 'ability', 'item', 'moves', 'nature', 'gender', 'level', 'evs', 'ivs', 'happiness', 'shiny', 'pokeball'])
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const ZERO_EV_ADVISORY = ' has exactly 0 EVs - did you forget to EV it? (If this was intentional, add exactly 1 to one of your EVs, which won\'t change its stats but will tell us that it wasn\'t a mistake).'

// Examine descriptors before reading values so getters are never invoked.
function boundedJson(input) {
  let nodes = 0
  const seen = new Set()
  const copy = (value, depth) => {
    if (++nodes > 2048 || depth > 6) throw new Error('Team input exceeds the allowed JSON size or nesting depth.')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.length <= 256) return value
    if (!value || typeof value !== 'object') throw new Error('Team input must contain only finite, bounded plain JSON values.')
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new Error('Team input must contain only plain JSON arrays and objects.')
    }
    if (seen.has(value)) throw new Error('Team input must not contain cycles or shared object references.')
    seen.add(value)
    const keys = Reflect.ownKeys(value)
    const result = array ? [] : {}
    if (array && value.length > 32) throw new Error('Team input array exceeds its maximum length.')
    if (keys.length > 32) throw new Error('Team input object has too many properties.')
    for (const key of keys) {
      if (array && key === 'length') continue
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) throw new Error('Team input contains a forbidden property.')
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) throw new Error('Team arrays must contain only indexed values.')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('Team input cannot contain accessors or hidden properties.')
      result[key] = copy(descriptor.value, depth + 1)
    }
    if (array && Object.keys(result).length !== value.length) throw new Error('Team arrays cannot contain missing entries.')
    return result
  }
  const result = copy(input, 0)
  if (Buffer.byteLength(JSON.stringify(result)) > 16384) throw new Error('Team input exceeds 16 KiB.')
  return result
}

function changesBetween(before, after, setIndex, field = '', changes = []) {
  if (Object.is(before, after)) return changes
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changesBetween(before[key], after[key], setIndex, field ? `${field}.${key}` : key, changes)
    }
  } else {
    changes.push({
      setIndex, field, kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'replaced',
      ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }),
      reason: field === 'species' ? 'Pinned Gen 3 species/form normalization.' : 'Explicit profile default or pinned validator canonicalization.',
    })
  }
  return changes
}

export function validateTeam(input, profileId, { npc = false } = {}) {
  const profile = getProfile(profileId)
  const errors = []
  const error = (code, message, setIndex) => errors.push({ code, message, ...(setIndex === undefined ? {} : { setIndex }) })
  let original
  try { original = boundedJson(input) } catch (cause) {
    return { valid: false, team: null, errors: [{ code: 'INVALID_JSON', message: cause.message }], changes: [] }
  }
  const minSize = profile.team.size ?? profile.team.minSize
  const maxSize = profile.team.size ?? profile.team.maxSize
  if (!Array.isArray(original) || original.length < minSize || original.length > maxSize) {
    return { valid: false, team: null, errors: [{ code: 'TEAM_SIZE', message: minSize === maxSize ? 'Open Singles v1 requires exactly six Pokémon.' : 'Regional League v1 requires one through six Pokémon.' }], changes: [] }
  }
  for (const [index, set] of original.entries()) {
    if (!set || Array.isArray(set) || typeof set !== 'object') {
      error('INVALID_SET', 'Each team member must be a plain object.', index)
      continue
    }
    for (const key of Object.keys(set)) if (!FIELDS.has(key)) error('UNKNOWN_FIELD', `Unsupported team field: ${key}.`, index)
    for (const key of ['species', 'ability', 'nature']) {
      if (typeof set[key] !== 'string' || !set[key].trim() || set[key].length > 64 || /[\r\n|]/.test(set[key])) error('REQUIRED_FIELD', `${key} must be nonempty text of at most 64 characters without protocol delimiters.`, index)
    }
    for (const key of ['name', 'item', 'gender', 'pokeball']) {
      if (set[key] !== undefined && (typeof set[key] !== 'string' || set[key].length > (key === 'name' ? 18 : 64) || /[\r\n|]/.test(set[key]))) {
        error('INVALID_FIELD', `${key} must be bounded text without protocol delimiters.`, index)
      }
    }
    if (set.gender !== undefined && !['', 'M', 'F', 'N'].includes(set.gender)) error('INVALID_GENDER', 'gender must be M, F, N or empty.', index)
    if (set.level !== undefined && set.level !== 100) error('LEVEL', 'Every team member must be level 100.', index)
    if (set.happiness !== undefined && (!Number.isInteger(set.happiness) || set.happiness < 0 || set.happiness > 255)) error('HAPPINESS', 'happiness must be an integer from 0 through 255.', index)
    if (set.shiny !== undefined && typeof set.shiny !== 'boolean') error('SHINY', 'shiny must be a boolean.', index)
    if (!Array.isArray(set.moves) || set.moves.length < 1 || set.moves.length > 4 ||
        set.moves.some(move => typeof move !== 'string' || !move.trim() || move.length > 64 || /[\r\n|]/.test(move))) {
      error('MOVES', 'Each member requires one through four bounded move names or IDs.', index)
    }
    for (const kind of ['evs', 'ivs']) {
      if (set[kind] === undefined) continue
      const stats = set[kind]
      if (!stats || Array.isArray(stats) || typeof stats !== 'object') {
        error('STATS', `${kind} must be an object containing stat integers.`, index)
        continue
      }
      for (const [stat, value] of Object.entries(stats)) {
        if (!STATS.includes(stat) || !Number.isInteger(value) || value < 0 || value > (kind === 'evs' ? 255 : 31)) {
          error('STATS', `${kind}.${stat} must be an allowed stat integer within the Gen 3 range.`, index)
        }
      }
      if (kind === 'evs' && Object.values(stats).reduce((total, value) => total + value, 0) > 510) error('EV_TOTAL', 'Total EVs must not exceed 510.', index)
    }
  }
  if (errors.length) return { valid: false, team: null, errors, changes: [] }
  const { Dex, TeamValidator } = getVendor()
  const format = getFormat(profile.id)
  const dex = Dex.mod('gen3')
  const team = JSON.parse(JSON.stringify(original))
  const baseSpecies = new Set()
  for (const [index, set] of team.entries()) {
    const species = dex.species.get(set.species)
    if (!species.exists || species.num < 1 || species.num > 386 || species.gen > 3) {
      error('ROSTER', 'Species must belong to National Dex #001–386 and the Gen 3 roster.', index)
    }
    const base = Dex.toID(species.baseSpecies)
    if (profile.team.distinctBaseSpecies && baseSpecies.has(base)) error('SPECIES_CLAUSE', 'Team members must have six distinct base species.', index)
    baseSpecies.add(base)
    const moves = set.moves.map(move => dex.moves.get(move).id)
    if (new Set(moves).size !== moves.length) error('DUPLICATE_MOVE', 'A move cannot appear twice in one moveset.', index)
    set.level ??= profile.defaults.level
    set.item ??= profile.defaults.item
    set.happiness ??= profile.defaults.happiness
    set.shiny ??= profile.defaults.shiny
    set.evs = Object.fromEntries(STATS.map(stat => [stat, set.evs?.[stat] ?? profile.defaults.ev]))
    set.ivs = Object.fromEntries(STATS.map(stat => [stat, set.ivs?.[stat] ?? profile.defaults.iv]))
  }
  if (errors.length) return { valid: false, team: null, errors, changes: [] }
  // One sourced cartridge NPC set is unobtainable by ordinary players. Validate
  // its remaining moves and every other field normally, then restore only the
  // explicitly pinned move. Never suppress arbitrary validator error strings.
  const npcRestores = []
  if (npc) for (const [index, set] of team.entries()) {
    const ids = set.moves.map(move => dex.moves.get(move).id)
    const exception = profile.npcMoveExceptions?.find(entry => Dex.toID(set.species) === entry.species &&
      ids.length === entry.exactMoves.length && entry.exactMoves.every(move => ids.includes(move)))
    if (exception) {
      npcRestores.push({ index, moves: ids.map(move => dex.moves.get(move).name) })
      set.moves = set.moves.filter(move => dex.moves.get(move).id !== exception.move)
    }
  }
  const problems = new TeamValidator(format).validateTeam(team) || []
  for (const message of problems) {
    // This exact informational reminder rejects cartridge-legal untrained sets.
    // Preserve zeros. Any other upstream message remains a validation failure.
    if (!message.endsWith(ZERO_EV_ADVISORY)) error('GEN3_LEGALITY', message)
  }
  if (errors.length) return { valid: false, team: null, errors, changes: [] }
  for (const { index, moves } of npcRestores) team[index].moves = moves
  const changes = team.flatMap((set, index) => changesBetween(original[index], set, index))
  return { valid: true, team, errors: [], changes }
}
