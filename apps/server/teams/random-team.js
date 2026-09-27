import { randomInt as cryptoRandomInt } from 'node:crypto'
import { GEN3 } from '@battle/game-data'
import starterCollection from './starter-sets.generated.json' with { type: 'json' }
import { editableTeam } from './selection.js'

const TEAM_SIZE = 6
const normalize = value => typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
const speciesById = new Map([...GEN3.species, ...GEN3.forms].flatMap(record =>
  [[record.id, record], [normalize(record.name), record]]))
const plain = value => value !== null && typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const forbidden = new Set(['__proto__', 'constructor', 'prototype'])

// API JSON is bounded too, but this independent port must not execute getters,
// clone inherited fields, or accept cyclic/oversized direct callers.
function copyInput(input) {
  let nodes = 0
  const seen = new Set()
  function copy(value, depth = 0) {
    if (++nodes > 2048 || depth > 7) throw new Error('The draft exceeds the allowed size.')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.length <= 256) return value
    const array = Array.isArray(value)
    if (!array && !plain(value)) throw new Error('Send a plain JSON draft.')
    if (array && Object.getPrototypeOf(value) !== Array.prototype) throw new Error('Send ordinary draft arrays.')
    if (seen.has(value)) throw new Error('Draft values cannot contain cycles or shared references.')
    seen.add(value)
    const keys = Reflect.ownKeys(value)
    if (keys.length > 33 || (array && value.length > 32)) throw new Error('The draft exceeds the allowed size.')
    const result = array ? [] : {}
    for (const key of keys) {
      if (array && key === 'length') continue
      if (typeof key !== 'string' || forbidden.has(key) ||
          (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new Error('The draft contains an unsupported property.')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('The draft must not contain accessors.')
      result[key] = copy(descriptor.value, depth + 1)
    }
    if (array && Object.keys(result).length !== value.length) throw new Error('The draft must not contain missing array entries.')
    return result
  }
  const result = copy(input)
  if (Buffer.byteLength(JSON.stringify(result)) > 20 * 1024) throw new Error('The draft exceeds 20 KiB.')
  return result
}

const safeErrors = errors => errors.slice(0, 32).map(({ code, message, setIndex }) => ({
  code: String(code).slice(0, 64), message: String(message).slice(0, 512),
  ...(Number.isInteger(setIndex) && setIndex >= 0 && setIndex < TEAM_SIZE ? { setIndex } : {}),
}))

function lockChanges(before, after) {
  const changes = []
  const identities = new Set(['species', 'ability', 'nature', 'item', 'pokeball'])
  for (const [field, value] of Object.entries(before)) {
    // Automatic/omitted settings may acquire explicit defaults. Existing values
    // cannot be silently repaired; catalog names/IDs and casing are equivalent.
    if (field === 'gender' && value === '') continue
    if (identities.has(field)) {
      if (normalize(value) !== normalize(after[field])) changes.push(field)
    } else if (field === 'moves') {
      if (value.some((move, index) => normalize(move) !== normalize(after.moves?.[index]))) changes.push(field)
    } else if (field === 'evs' || field === 'ivs') {
      for (const [stat, number] of Object.entries(value)) if (number !== after[field]?.[stat]) changes.push(`${field}.${stat}`)
    } else if (JSON.stringify(value) !== JSON.stringify(after[field])) changes.push(field)
  }
  return changes
}

/** Casual team preparation only. It does not authenticate, mutate a match, or
 * use battle RNG. Species are sampled before sets, with no rejection resampling.
 */
export function createRandomTeamGenerator({ validateTeam, randomInt = cryptoRandomInt, collection = starterCollection } = {}) {
  if (typeof validateTeam !== 'function' || typeof randomInt !== 'function') throw new TypeError('Generation requires a validator and random integer function.')
  if (collection.schemaVersion !== 1 || collection.profileId !== 'gen3opensinglesv1' || !Array.isArray(collection.entries)) throw new Error('Unsupported starter-set collection.')
  const sets = new Map()
  for (const entry of collection.entries) {
    if (!GEN3.species.some(species => species.id === entry.speciesId) || !entry.set ||
        normalize(entry.set.species) !== normalize(speciesById.get(entry.speciesId)?.name)) throw new Error('Invalid starter species.')
    if (!sets.has(entry.speciesId)) sets.set(entry.speciesId, [])
    sets.get(entry.speciesId).push(structuredClone(entry.set))
  }
  if (sets.size !== 386) throw new Error('The starter-set collection must cover all 386 base species.')
  const identity = Object.freeze({ version: collection.version, profileId: collection.profileId, speciesCount: sets.size })
  const fail = (code, message, setIndex) => ({ valid: false, team: null, changes: [], collection: identity,
    errors: [{ code, message, ...(setIndex === undefined ? {} : { setIndex }) }] })
  const choose = length => {
    const index = randomInt(length)
    if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error('Random integer provider returned an out-of-range value.')
    return index
  }

  function generate(input) {
    let body
    try { body = copyInput(input) } catch (error) { return fail('INVALID_DRAFT', error.message) }
    if (!plain(body) || Object.keys(body).some(key => !['team', 'lockedSlots'].includes(key)) ||
        !Array.isArray(body.team) || body.team.length !== TEAM_SIZE || !Array.isArray(body.lockedSlots) ||
        body.lockedSlots.length > TEAM_SIZE || body.lockedSlots.some(slot => !Number.isInteger(slot) || slot < 0 || slot >= TEAM_SIZE) ||
        new Set(body.lockedSlots).size !== body.lockedSlots.length) {
      return fail('INVALID_DRAFT', 'Send six draft slots and distinct locked slot indexes from zero through five.')
    }
    const locked = new Set(body.lockedSlots), used = new Set(), team = Array(TEAM_SIZE)
    if (locked.size === TEAM_SIZE) return fail('ALL_LOCKED', 'Unlock a Pokémon before rerolling.')
    for (const slot of locked) {
      const set = body.team[slot]
      const species = plain(set) && speciesById.get(normalize(set.species))
      if (!species) return fail('LOCKED_SPECIES', 'Choose a Gen 3 Pokémon using its catalog name or ID before locking it.', slot)
      const base = species.baseSpeciesId || species.id
      if (used.has(base)) return fail('SPECIES_CLAUSE', 'Locked Pokémon must have different base species; forms count as the same species.', slot)
      used.add(base)
      // Empty editor move fields are not moves; all other unknown/invalid fields
      // survive to the authoritative validator rather than being sanitized away.
      team[slot] = { ...set, ...(Array.isArray(set.moves) ? { moves: set.moves.filter(move => move !== '') } : {}) }
    }
    const pool = GEN3.species.map(species => species.id).filter(id => !used.has(id))
    if (pool.length < TEAM_SIZE - locked.size) return fail('POOL_TOO_SMALL', 'There are not enough different species to fill the unlocked slots.')
    for (let slot = 0; slot < TEAM_SIZE; slot++) {
      if (locked.has(slot)) continue
      const [id] = pool.splice(choose(pool.length), 1)
      const candidates = sets.get(id)
      team[slot] = structuredClone(candidates[choose(candidates.length)])
    }
    // One bounded whole-team check. This collection has a reviewed baseline for
    // each species; failure never changes the sampled species or any locked set.
    const checked = validateTeam(team)
    if (!checked.valid) return { valid: false, team: null, changes: [], collection: identity,
      errors: safeErrors(checked.errors) }
    const output = editableTeam(checked.team)
    for (const slot of locked) {
      const changed = lockChanges(team[slot], output[slot])
      if (changed.length) {
        const changes = checked.changes.filter(change => change.setIndex === slot && changed.includes(change.field))
        const detail = changes.length ? changes.map(change => `${change.field}: ${change.before} → ${change.after}`).join('; ') : changed.join(', ')
        return { ...fail('LOCKED_SET_CHANGED', `Validation would change ${detail}. Check this set before rerolling.`, slot), changes }
      }
      output[slot] = structuredClone(team[slot])
    }
    return { valid: true, team: output, errors: [], changes: [], collection: identity }
  }
  return Object.freeze({ generate, collection: identity })
}
