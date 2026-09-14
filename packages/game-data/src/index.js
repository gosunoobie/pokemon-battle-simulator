import generationThree from '../data/gen3.json' with { type: 'json' }
import generationThreeManifest from '../data/manifest.json' with { type: 'json' }

// Generated JSON is an acyclic tree. Freeze every record and nested collection
// so hosts can share the data without turning it into mutable battle state.
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export const GEN3 = deepFreeze(generationThree)
export const GEN3_MANIFEST = deepFreeze(generationThreeManifest)

// Indexes stay private. Map lookups preserve exact IDs and never inherit keys
// such as "constructor" or "__proto__" from Object.prototype.
function lookup(records) {
  const recordsById = new Map(records.map(record => [record.id, record]))
  return id => recordsById.get(id)
}

/** Look up a base species by its exact ID. Forms have a separate lookup. */
export const getSpecies = lookup(GEN3.species)
export const getForm = lookup(GEN3.forms)
export const getMove = lookup(GEN3.moves)
export const getItem = lookup(GEN3.items)
/** Capture-ball identity metadata, not a capture-availability or legality check. */
export const getCaptureBall = lookup(GEN3.captureBalls)
export const getAbility = lookup(GEN3.abilities)
export const getNature = lookup(GEN3.natures)
export const getType = lookup(GEN3.types)
export const getLearnset = lookup(GEN3.learnsets)
