import { createBattleFx } from '@battle/battle-fx'
import { BATCH_FIVE_EFFECTS } from './batchFiveVisual.js'
import fireBlast, { timing as fireTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/fire-blast.js'
import sludgeBomb, { timing as sludgeTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/sludge-bomb.js'
import overheat, { timing as overheatTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/overheat.js'
import eruption, { timing as eruptionTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/eruption.js'
import earthquake, { timing as earthquakeTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/earthquake.js'
import thunder, { timing as thunderTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/thunder.js'
import blizzard, { timing as blizzardTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/blizzard.js'
import bubbleBeam, { timing as bubbleTiming } from '../../../packages/battle-fx/src/review-batch-five-v2/bubble-beam.js'

const changes = { 'fire-blast': [fireBlast, fireTiming], 'sludge-bomb': [sludgeBomb, sludgeTiming], overheat: [overheat, overheatTiming], eruption: [eruption, eruptionTiming], earthquake: [earthquake, earthquakeTiming], thunder: [thunder, thunderTiming], blizzard: [blizzard, blizzardTiming], 'bubble-beam': [bubbleBeam, bubbleTiming] }
export const BATCH_FIVE_V2_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(BATCH_FIVE_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchFiveV2Fx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_FIVE_V2_EFFECTS })
}
