// Offline collection tooling only. Runtime hosts consume the generated JSON;
// the browser and request generator never load vendor random-battle internals.
import { createRequire } from 'node:module'
import { getVendor, PINNED_SOURCE } from './vendor.js'

const require = createRequire(import.meta.url)

export function createStarterSetAdapter() {
  const { Dex } = getVendor() // Verify the complete pinned package before require.
  const { RandomGen3Teams } = require('pokemon-showdown/dist/data/random-battles/gen3/teams.js')
  const dex = Dex.mod('gen3')
  const reference = new RandomGen3Teams('gen3randombattle', [1, 2, 3, 4])
  if (typeof reference.randomSet !== 'function' || !reference.randomSets) {
    throw new Error('Pinned Gen 3 starter-set adapter assumptions changed.')
  }
  return Object.freeze({
    source: Object.freeze({ ...PINNED_SOURCE, path: 'data/random-battles/gen3/sets.json' }),
    speciesIds: Object.freeze(Object.keys(reference.randomSets).sort()),
    candidate(speciesId, seed) {
      if (!Object.hasOwn(reference.randomSets, speciesId)) return null
      const generator = new RandomGen3Teams('gen3randombattle', seed)
      return structuredClone(generator.randomSet(speciesId, {}, false))
    },
    hiddenPower(ivs) { return { ...dex.getHiddenPower(ivs) } },
    hiddenPowerIvs(type) {
      const values = dex.types.get(type).HPivs
      if (!values) throw new TypeError('Unknown Hidden Power type.')
      return { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...values }
    },
    move(id, ivs) {
      const move = dex.moves.get(id)
      // The editable DTO has one Hidden Power move. Its IVs, not an alias or
      // validator-private hpType field, preserve both type and power.
      const hidden = move.id.startsWith('hiddenpower') ? dex.getHiddenPower(ivs) : null
      const typed = hidden ? dex.moves.get(`hiddenpower${hidden.type}`) : move
      return { id: hidden ? 'hiddenpower' : move.id, name: hidden ? 'Hidden Power' : move.name,
        type: typed.type.toLowerCase(), category: typed.category,
        basePower: hidden?.power ?? move.basePower, accuracy: move.accuracy,
        damage: typeof move.damage === 'number' || move.damage === 'level' ? move.damage : null }
    },
  })
}
