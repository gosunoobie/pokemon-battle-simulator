import { createBattleFx } from '@battle/battle-fx'
import { loadMoveAssets } from '../../../packages/battle-fx/src/assets.js'
import { BATCH_SIX_EFFECTS } from './batchSixVisual.js'
import leafBlade, { timing as leafTiming } from '../../../packages/battle-fx/src/review-batch-six-v2/leaf-blade.js'
import ancientPower, { timing as ancientTiming } from '../../../packages/battle-fx/src/review-batch-six-v2/ancient-power.js'
import sacredFire, { timing as sacredTiming } from '../../../packages/battle-fx/src/review-batch-six-v2/sacred-fire.js'

const changes = { 'leaf-blade': [leafBlade,leafTiming], 'ancient-power': [ancientPower,ancientTiming], 'sacred-fire': [sacredFire,sacredTiming] }
export const BATCH_SIX_V2_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(BATCH_SIX_EFFECTS).map(([id, original]) => {
  const changed = changes[id]
  return [id, changed ? Object.freeze({ ...original, build: changed[0], contact: changed[1].contact, duration: changed[1].duration }) : original]
})))

/** Load the real Rock Slide texture before starting this review's clock. The
 * cache owns that texture; pending loads never borrow a pose or start audio. */
export function createBatchSixV2Fx(options = {}) {
  let disposed = false, rockTexture, rockPromise
  const effects = options.effects ?? BATCH_SIX_V2_EFFECTS
  const preparedEffects = { ...effects, ...(effects['ancient-power'] ? {
    'ancient-power': { ...effects['ancient-power'], build: context => effects['ancient-power'].build({ ...context, assets: { ...context.assets, rock: rockTexture } }) },
  } : {}) }
  const fx = createBattleFx({ ...options, effects: preparedEffects })
  const runs = new Set(), byScene = new WeakMap()
  const loadRock = () => rockPromise ??= loadMoveAssets('rock-slide', options.assetLoader).then(assets => {
    rockTexture = assets.rock; return rockTexture
  }, error => { rockPromise = null; throw error })
  function play(request = {}, environment = {}) {
    let inner, settled = false, timer, resolve
    const { scene, signal } = environment
    const finished = new Promise(done => { resolve = done })
    const handle = { finished, cancel: () => finish({ status: 'cancelled' }, true) }
    function finish(result, cancel = false) {
      if (settled) return
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort)
      if (cancel) inner?.cancel()
      runs.delete(handle)
      if (scene && byScene.get(scene) === handle) byScene.delete(scene)
      resolve(result)
    }
    const abort = () => handle.cancel()
    if (disposed || signal?.aborted) { finish({ status: 'cancelled' }); return handle }
    if (scene) { byScene.get(scene)?.cancel(); byScene.set(scene, handle) }
    runs.add(handle); signal?.addEventListener('abort', abort, { once: true })
    const needsRock = request.moveId === 'ancient-power' && effects['ancient-power'] && (request.phase ?? 'attack') === 'attack'
      && (!request.outcome || request.outcome === 'hit') && !environment.reducedMotion && scene
    const start = () => {
      if (settled || disposed) return
      clearTimeout(timer)
      try {
        inner = fx.play(request, environment)
        Promise.resolve(inner.finished).then(result => finish(result), error => finish({ status: 'failed', reason: error?.message ?? String(error) }, true))
      } catch (error) { finish({ status: 'failed', reason: error?.message ?? String(error) }, true) }
    }
    if (needsRock) {
      timer = setTimeout(() => finish({ status: 'failed', reason: 'Rock artwork loading exceeded the review deadline' }, true), options.deadlineMs ?? 6000)
      loadRock().then(start, error => finish({ status: 'failed', reason: error?.message ?? String(error) }))
    } else start()
    return handle
  }
  return { play, dispose() { if (disposed) return; disposed = true; for (const run of [...runs]) run.cancel(); fx.dispose() } }
}
