import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../../../packages/battle-fx/src/registry.js'
import fireBlast, { timing as fireTiming } from '../../../packages/battle-fx/src/review-batch-five/fire-blast.js'
import solarBeam, { timing as solarTiming } from '../../../packages/battle-fx/src/review-batch-five/solar-beam.js'
import eruption, { timing as eruptionTiming } from '../../../packages/battle-fx/src/review-batch-five/eruption.js'
import thunder, { timing as thunderTiming } from '../../../packages/battle-fx/src/review-batch-five/thunder.js'
import blizzard, { timing as blizzardTiming } from '../../../packages/battle-fx/src/review-batch-five/blizzard.js'

const changes = { 'fire-blast': [fireBlast, fireTiming], 'solar-beam': [solarBeam, solarTiming], eruption: [eruption, eruptionTiming], thunder: [thunder, thunderTiming], blizzard: [blizzard, blizzardTiming] }
export const BATCH_FIVE_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(MOVE_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchFiveFx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_FIVE_EFFECTS })
}
