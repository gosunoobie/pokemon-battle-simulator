import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../../../packages/battle-fx/src/registry.js'
import leafBlade, { timing as leafTiming } from '../../../packages/battle-fx/src/review-batch-six/leaf-blade.js'
import triAttack, { timing as triTiming } from '../../../packages/battle-fx/src/review-batch-six/tri-attack.js'
import meteorMash, { timing as meteorTiming } from '../../../packages/battle-fx/src/review-batch-six/meteor-mash.js'
import ancientPower, { timing as ancientTiming } from '../../../packages/battle-fx/src/review-batch-six/ancient-power.js'
import sacredFire, { timing as sacredTiming } from '../../../packages/battle-fx/src/review-batch-six/sacred-fire.js'

const changes = { 'leaf-blade': [leafBlade,leafTiming], 'tri-attack': [triAttack,triTiming], 'meteor-mash': [meteorMash,meteorTiming], 'ancient-power': [ancientPower,ancientTiming], 'sacred-fire': [sacredFire,sacredTiming] }
export const BATCH_SIX_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(MOVE_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchSixFx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_SIX_EFFECTS })
}
