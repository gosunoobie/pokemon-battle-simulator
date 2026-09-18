import { createBattleFx } from '@battle/battle-fx'
import { BATCH_FIVE_V3_EFFECTS } from './batchFiveVisualV3.js'
import eruption, { timing as eruptionTiming } from '../../../packages/battle-fx/src/review-batch-five-v4/eruption.js'
import blizzard, { timing as blizzardTiming } from '../../../packages/battle-fx/src/review-batch-five-v4/blizzard.js'

const changes = { eruption: [eruption, eruptionTiming], blizzard: [blizzard, blizzardTiming] }
export const BATCH_FIVE_V4_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(BATCH_FIVE_V3_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchFiveV4Fx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_FIVE_V4_EFFECTS })
}
