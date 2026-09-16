import { GEN3, getLearnset } from '@battle/game-data'

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

let catalog

/** Public editor choices from the pinned data package. Learnset candidates may
 * have incompatible acquisition sources; the engine validates complete sets.
 * Build on demand so ordinary battle configuration stays compact.
 */
export function getTeamBuilderCatalog() {
  if (catalog) return catalog
  const species = [...GEN3.species, ...GEN3.forms.filter(form => form.battleOnly.length === 0)]
  catalog = freeze({
    generation: GEN3.generation,
    species: species.map(species => {
      const learnset = getLearnset(species.id)
      return {
        id: species.id, name: species.name, num: species.num,
        baseSpeciesId: species.baseSpeciesId, kind: species.kind,
        types: [...species.types], abilities: [...new Set(Object.values(species.abilities))],
        moveIds: [...new Set([...learnset.sources.map(source => source.moveId), ...learnset.sketchMoveIds])].sort(),
      }
    }),
    moves: GEN3.moves.map(({ id, name, type, category, pp, shortDesc }) => ({ id, name, type, category, pp, shortDesc })),
    abilities: GEN3.abilities.map(({ id, name, shortDesc }) => ({ id, name, shortDesc })),
    items: GEN3.items.filter(item => !item.isPokeball).map(({ id, name, shortDesc }) => ({ id, name, shortDesc })),
    natures: GEN3.natures.map(({ id, name, plus, minus }) => ({ id, name, plus, minus })),
    rules: { teamSize: 6, level: 100, maxMoves: 4, maxEv: 255, totalEvs: 510, maxIv: 31 },
  })
  return catalog
}
