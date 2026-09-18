import { createBattleFx } from '@battle/battle-fx'
import { BATCH_FIVE_V2_EFFECTS } from './batchFiveVisualV2.js'
import fireBlast, { timing as fireTiming } from '../../../packages/battle-fx/src/review-batch-five-v3/fire-blast.js'
import earthquake, { timing as earthquakeTiming } from '../../../packages/battle-fx/src/review-batch-five-v3/earthquake.js'
import thunder, { timing as thunderTiming } from '../../../packages/battle-fx/src/review-batch-five-v3/thunder.js'
import blizzard, { timing as blizzardTiming } from '../../../packages/battle-fx/src/review-batch-five-v3/blizzard.js'

const changes = { 'fire-blast': [fireBlast, fireTiming], earthquake: [earthquake, earthquakeTiming], thunder: [thunder, thunderTiming], blizzard: [blizzard, blizzardTiming] }
export const BATCH_FIVE_V3_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(BATCH_FIVE_V2_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchFiveV3Fx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_FIVE_V3_EFFECTS })
}
