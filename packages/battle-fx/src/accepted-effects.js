import { Container, Graphics } from 'pixi.js'
import { createBattleFx } from './index.js'
import { MOVE_EFFECTS } from './registry.js'
import { loadMoveAssets } from './assets.js'
import { withAcceptedRecipes, usesAcceptedRockArtwork } from './accepted-recipes.js'

const original = MOVE_EFFECTS['thunder-punch']
const TAU = Math.PI * 2
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

// Approved Thunder Punch impact addition. This copied builder is verified
// against the frozen audition source; base choreography remains unchanged.
function buildImpactProposal(context) {
  let impact = () => {}
  original.build({ ...context, onCue(cue) {
    if (cue.type === 'impact') impact()
    context.onCue(cue)
  } })

  const { layer, scene, target, onFrame } = context
  const burst = new Container(); burst.label = 'thunder-punch-review-impact'; burst.alpha = 0
  const flash = new Graphics(); flash.label = 'thunder-punch-review-flash'
  const bolts = new Graphics(); bolts.label = 'thunder-punch-review-bolts'
  const sparks = new Graphics(); sparks.label = 'thunder-punch-review-sparks'
  burst.addChild(flash, bolts, sparks); layer.addChild(burst)
  const unit = scene.unit
  const radius = Math.min(94 * unit, Math.max(62 * unit, Math.min(target.metrics.width, target.metrics.height) * .46))
  const margin = Math.min(7 * unit, scene.width / 4, scene.height / 4)
  let offset = null
  const targetCenter = () => layer.toLocal(target.anchor('center'), scene.effects)

  function update(time) {
    flash.clear(); bolts.clear(); sparks.clear()
    const age = time - original.contact
    burst.alpha = offset && age >= 0 && age < .38 ? 1 : 0
    if (!burst.alpha) return
    const center = targetCenter()
    burst.position.set(center.x + offset.x, center.y + offset.y)
    // Fit every vertex, including fork ends and flying flecks, with enough
    // room for round strokes. World coordinates keep either perspective upright.
    const point = (x, y) => [clamp(burst.x + x, margin, scene.width - margin) - burst.x,
      clamp(burst.y + y, margin, scene.height - margin) - burst.y]
    const polygon = (outer, inner, count, angle) => Array.from({ length: count * 2 }, (_, i) => {
      const a = angle + i * Math.PI / count, r = i % 2 ? inner : outer
      return point(Math.cos(a) * r, Math.sin(a) * r)
    }).flat()
    const line = (graphic, points, style) => {
      const fitted = points.map(([x, y]) => point(x, y))
      graphic.moveTo(...fitted[0])
      for (const p of fitted.slice(1)) graphic.lineTo(...p)
      graphic.stroke({ ...style, cap: 'round', join: 'round' })
    }

    const pulse = Math.max(0, 1 - age / .19)
    flash.alpha = pulse
    flash.poly(polygon(radius * (.6 + age), radius * .24, 8, -.12)).fill({ color: 0xffd832, alpha: .45 })
      .poly(polygon(radius * .43, radius * .13, 6, -.12)).fill(0xffeb68)
      .poly(polygon(radius * .28, radius * .07, 4, 0)).fill(0xfffff2)

    bolts.alpha = (1 - age / .38) * (.86 + .14 * Math.cos(age * 70))
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8 + .12, reach = radius * (i % 2 ? .84 : 1)
      const c = Math.cos(angle), s = Math.sin(angle), bend = Math.sin(Math.floor(age * 75) + i * 2.3) * radius * .1
      const ray = (length, side = 0) => [c * length - s * side, s * length + c * side]
      const points = [ray(radius * .12), ray(reach * .36, bend), ray(reach * .48, -radius * .13), ray(reach)]
      line(bolts, points, { color: 0xffd736, width: 5.6 * unit })
      line(bolts, points, { color: 0xffffdc, width: 2 * unit })
      line(bolts, [points[1], ray(reach * .51, radius * .2), ray(reach * .7, radius * .27)],
        { color: 0xfff3a5, width: 2.3 * unit })
    }

    sparks.alpha = Math.max(0, 1 - age / .32)
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12 + .24, c = Math.cos(angle), s = Math.sin(angle)
      const distance = radius * (.44 + .8 * Math.min(1, age / .3)), length = (i % 2 ? 6 : 10) * unit
      line(sparks, [[c * distance, s * distance], [c * (distance + length), s * (distance + length)]],
        { color: i % 2 ? 0xffffec : 0xffdf4a, width: 3 * unit })
    }
  }
  impact = () => {
    const contact = layer.getChildByLabel('thunder-punch-impact', true)
    const actual = layer.toLocal({ x: 0, y: 0 }, contact), center = targetCenter()
    offset = { x: actual.x - center.x, y: actual.y - center.y }
    update(original.contact)
  }
  onFrame(update)
}

export const ACCEPTED_MOVE_EFFECTS = Object.freeze({ ...withAcceptedRecipes(MOVE_EFFECTS),
  'thunder-punch': Object.freeze({ ...original, build: buildImpactProposal }),
})

export const ACCEPTED_EFFECT_TIMINGS = Object.freeze(Object.fromEntries(Object.entries(ACCEPTED_MOVE_EFFECTS)
  .map(([id, { contact, duration }]) => [id, Object.freeze({ contact, duration })])))

/** Optional reviewed artwork for hosts. Explicit custom effect registries win. */
export function createAcceptedBattleFx(options = {}) {
  const effects = options.effects ?? ACCEPTED_MOVE_EFFECTS
  if (!usesAcceptedRockArtwork(effects['ancient-power'])) return createBattleFx({ ...options, effects })
  let disposed = false, rockTexture, rockPromise
  const preparedEffects = { ...effects, 'ancient-power': { ...effects['ancient-power'], build: context =>
    effects['ancient-power'].build({ ...context, assets: { ...context.assets, rock: rockTexture } }) } }
  const fx = createBattleFx({ ...options, effects: preparedEffects })
  const runs = new Set(), byScene = new WeakMap()
  const loadRock = () => rockPromise ??= loadMoveAssets('rock-slide', options.assetLoader).then(assets => {
    rockTexture = assets.rock; return rockTexture
  }, error => { rockPromise = null; throw error })
  function play(request = {}, environment = {}) {
    let inner, settled = false, timer, resolve
    const { scene, signal } = environment
    const ownsScene = scene !== null && (typeof scene === 'object' || typeof scene === 'function')
    const finished = new Promise(done => { resolve = done })
    const handle = { finished, cancel: () => finish({ status: 'cancelled' }, true) }
    function finish(result, cancel = false) {
      if (settled) return
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort)
      if (cancel) inner?.cancel()
      runs.delete(handle)
      if (ownsScene && byScene.get(scene) === handle) byScene.delete(scene)
      resolve(result)
    }
    const abort = () => handle.cancel()
    if (disposed || signal?.aborted) { finish({ status: 'cancelled' }); return handle }
    if (ownsScene) { byScene.get(scene)?.cancel(); byScene.set(scene, handle) }
    runs.add(handle); signal?.addEventListener('abort', abort, { once: true })
    const needsRock = request.moveId === 'ancient-power' && (request.phase ?? 'attack') === 'attack'
      && (!request.outcome || request.outcome === 'hit') && !environment.reducedMotion && ownsScene
    const start = () => {
      if (settled || disposed) return
      clearTimeout(timer)
      try {
        inner = fx.play(request, environment)
        Promise.resolve(inner.finished).then(result => finish(result), error => finish({ status: 'failed', reason: error?.message ?? String(error) }, true))
      } catch (error) { finish({ status: 'failed', reason: error?.message ?? String(error) }, true) }
    }
    if (needsRock) {
      // The cache owns the texture. Loading neither borrows actor poses nor
      // creates a timeline, so presentation observers cannot start audio early.
      timer = setTimeout(() => finish({ status: 'failed', reason: 'Rock artwork loading exceeded the accepted effect deadline' }, true), options.deadlineMs ?? 6000)
      loadRock().then(start, error => finish({ status: 'failed', reason: error?.message ?? String(error) }))
    } else start()
    return handle
  }
  return { play, dispose() { if (disposed) return; disposed = true; for (const run of [...runs]) run.cancel(); fx.dispose() } }
}
