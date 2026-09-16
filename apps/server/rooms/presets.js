import { createHash } from 'node:crypto'
import { GEN3 } from '@battle/game-data'
import { PRESET_TEAMS } from '../presets.js'

export function createRoomCatalog(engineFactory, presets = PRESET_TEAMS) {
  const teams = presets.map(preset => {
    const checked = engineFactory.validateTeam(preset.team)
    if (!checked.valid) throw new Error(`Invalid room preset ${preset.id}`)
    // Keep editable server-owned sets: canonical validation may add derived hpType,
    // which is not accepted as an editable team field when creating an engine.
    return { id: preset.id, name: preset.name, description: preset.description, team: structuredClone(preset.team) }
  })
  const revision = createHash('sha256').update(JSON.stringify(teams)).digest('hex')
  return {
    revision, presets: teams,
    profile: { id: 'gen3opensinglesv1', label: 'Gen 3 Open Singles · level 100 · six Pokémon' },
    moves: Object.fromEntries(GEN3.moves.map(move => [move.id, {
      id: move.id, name: move.name, type: move.type, category: move.category,
      shortDesc: move.shortDesc, basePower: move.basePower, accuracy: move.accuracy, pp: move.pp,
    }])),
  }
}
