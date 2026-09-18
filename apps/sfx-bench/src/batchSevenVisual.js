import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../../../packages/battle-fx/src/registry.js'
import sing, { timing as singTiming } from '../../../packages/battle-fx/src/review-batch-seven/sing.js'
import grassWhistle, { timing as grassTiming } from '../../../packages/battle-fx/src/review-batch-seven/grass-whistle.js'
import attract, { timing as attractTiming } from '../../../packages/battle-fx/src/review-batch-seven/attract.js'
import morningSun, { timing as sunTiming } from '../../../packages/battle-fx/src/review-batch-seven/morning-sun.js'
import moonlight, { timing as moonTiming } from '../../../packages/battle-fx/src/review-batch-seven/moonlight.js'
import confuseRay, { timing as confuseTiming } from '../../../packages/battle-fx/src/review-batch-seven/confuse-ray.js'

const changes = { sing: [sing, singTiming], 'grass-whistle': [grassWhistle, grassTiming], attract: [attract, attractTiming],
  'morning-sun': [morningSun, sunTiming], moonlight: [moonlight, moonTiming], 'confuse-ray': [confuseRay, confuseTiming] }
export const BATCH_SEVEN_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(MOVE_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))
export function createBatchSevenFx(options = {}) {
  return createBattleFx({ ...options, effects: options.effects ?? BATCH_SEVEN_EFFECTS })
}
