import generatedRoster from './roster.generated.json' with { type: 'json' }

// This host projection contains reference labels and stats, not the full
// learnset catalog or mutable battle state.
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export const ROSTER_LIST = deepFreeze(generatedRoster.species)
export const ROSTER = Object.freeze(Object.fromEntries(ROSTER_LIST.map(record => [record.id, record])))
