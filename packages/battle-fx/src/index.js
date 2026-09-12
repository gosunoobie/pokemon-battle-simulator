import { Container, Graphics, Texture, Sprite } from 'pixi.js'
import { gsap } from 'gsap'
import { FX_CATALOG } from './catalog.js'
import { MOVE_EFFECTS } from './registry.js'
import { loadMoveAssets } from './assets.js'
import { visualRandom } from './random.js'
export { FX_CATALOG } from './catalog.js'
export { EFFECT_TIMINGS, PHASE_TIMINGS } from './registry.js'

function makeGlow() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.25, '#fffffff2'); gradient.addColorStop(.52, '#ffffff80'); gradient.addColorStop(1, '#ffffff00')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
  return Texture.from(canvas)
}

/** Optional, Vue-free renderer package. Inputs contain no battle state or damage authority. */
export function createBattleFx({ timelineEngine = gsap, assetLoader, glowTexture: suppliedGlow, effects = MOVE_EFFECTS, deadlineMs = 6000 } = {}) {
  let disposed = false, glowTexture = suppliedGlow
  const runs = new Set(), byScene = new WeakMap()
  function play(request = {}, { scene, signal, onCue = () => {}, reducedMotion = false } = {}) {
    let settled = false, raw, layer, timer, actors = [], resolve
    const finished = new Promise(done => { resolve = done })
    const handle = { finished, cancel: () => finish('cancelled') }
    function finish(status, error) {
      if (settled) return
      settled = true
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
      let cleanupError
      const attempt = fn => { try { fn() } catch (error) { cleanupError ??= error } }
      attempt(() => raw?.kill())
      attempt(() => { if (layer && !layer.destroyed) layer.destroy({ children: true }) })
      if (byScene.get(scene) === handle) {
        for (const actor of actors) attempt(() => actor.resetPose())
        attempt(() => scene.camera.position.set(0, 0))
        byScene.delete(scene)
      }
      runs.delete(handle)
      const reason = error ?? cleanupError
      resolve({ status: cleanupError ? 'failed' : status, ...(reason ? { reason: reason.message ?? String(reason) } : {}) })
    }

    const abort = () => finish('cancelled')
    function guard(fn) {
      return (...args) => { if (!settled) { try { return fn(...args) } catch (error) { finish('failed', error) } } }
    }
    if (disposed || signal?.aborted) { finish('cancelled'); return handle }
    const registered = Object.hasOwn(effects, request.moveId) ? effects[request.moveId] : null
    const phase = request.phase ?? 'attack'
    const effect = phase === 'attack' ? registered : phase === 'prepare' ? registered?.preparation : null
    if (!scene || !effect || (request.outcome && request.outcome !== 'hit')) { finish('skipped'); return handle }
    let source, target
    const localSubject = effect.subject === 'source' || effect.subject === 'field'
    try { source = scene.actor(request.sourceId); target = localSubject ? source : scene.actor(request.targetIds?.[0]) }
    catch (error) { finish('failed', error); return handle }
    if (!source || !target || (source === target && !localSubject)) { finish('skipped'); return handle }
    byScene.get(scene)?.cancel()
    actors = [...new Set([source, target])]; byScene.set(scene, handle); runs.add(handle)
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => finish('failed', new Error('Effect playback deadline exceeded.')), deadlineMs)
    void (async () => {
      try {
        const assets = reducedMotion ? {} : await loadMoveAssets(request.moveId, assetLoader)
        if (settled) return
        glowTexture ??= makeGlow()
        layer = new Container(); layer.label = 'battle-fx-run'; scene.effects.addChild(layer)
        const frameUpdates = []
        raw = timelineEngine.timeline({ onComplete: () => finish('completed'), onUpdate: guard(() => { for (const update of frameUpdates) update(raw.time()); scene.updateDepth?.(source, target) }) })
        let tl
        // Guard asynchronous callbacks as well as synchronous builder errors.
        const callbacks = vars => Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, key.startsWith('on') && typeof value === 'function' ? guard(value) : value]))
        tl = new Proxy(raw, { get(object, key) {
          if (['to', 'set', 'from', 'fromTo'].includes(key)) return (...args) => {
            args[1] = callbacks(args[1]); if (key === 'fromTo') args[2] = callbacks(args[2])
            object[key](...args); return tl
          }
          if (key === 'call') return (fn, params, at) => { object.call(guard(fn), params, at); return tl }
          const value = object[key]; return typeof value === 'function' ? value.bind(object) : value
        } })
        const cued = new Set()
        const cue = guard(value => {
          if (!(phase === 'prepare' ? ['prepared'] : ['impact', 'recovery']).includes(value.type) || cued.has(value.type)) return
          if (value.type === 'recovery' && (!cued.has('impact') || effect.recovery == null)) return
          cued.add(value.type); scene.updateDepth?.(source, target); onCue(value)
        })
        const c = { tl, layer, source, target, scene, glowTexture, random: visualRandom(request.visualSeed), assets, tint: FX_CATALOG.find(m => m.id === request.moveId)?.tint ?? 0xffffff, onCue: cue, onFrame: fn => frameUpdates.push(fn) }
        if (reducedMotion && effect.subject === 'field') {
          const wash = new Graphics().rect(0, 0, scene.width, scene.height).fill(c.tint)
          wash.label = 'weather-reduced-wash'; wash.alpha = 0; layer.addChild(wash)
          tl.to(wash, { alpha: .1, duration: .2 }, 0).to(wash, { alpha: 0, duration: .4 }, .2)
            .call(() => cue({ type: 'impact' }), [], .2).call(() => {}, [], .8)
        } else if (reducedMotion) {
          const glow = new Sprite(glowTexture); glow.anchor.set(.5); glow.position.copyFrom(target.anchor('center'))
          glow.width = effect.subject === 'source' ? target.metrics.width * 1.15 : 135 * scene.unit
          glow.height = effect.subject === 'source' ? target.metrics.height * 1.05 : 100 * scene.unit
          glow.tint=c.tint; glow.alpha=0; glow.blendMode='add'; layer.addChild(glow)
          tl.to(glow,{alpha:.25,duration:.2},0).to(glow,{alpha:0,duration:.4},.2)
          tl.call(() => cue({ type: phase === 'prepare' ? 'prepared' : 'impact' }), [], .2).call(() => {}, [], .8)
          if (effect.recovery != null) {
            const receive = new Sprite(glowTexture); receive.anchor.set(.5); receive.position.copyFrom(source.anchor('aura'))
            receive.width = 95 * scene.unit; receive.height = 75 * scene.unit; receive.tint = c.tint; receive.alpha = 0; layer.addChild(receive)
            tl.to(receive,{alpha:.2,duration:.12},.33).to(receive,{alpha:0,duration:.25},.45)
              .call(() => cue({ type: 'recovery' }), [], .45)
          }
        } else {
          effect.build(c)
          tl.call(() => {}, [], effect.duration)
        }
      } catch (error) { finish('failed', error) }
    })()
    return handle
  }
  return { play, dispose() { if (disposed) return; disposed = true; for (const run of [...runs]) run.cancel(); if (glowTexture && !suppliedGlow) glowTexture.destroy(true) } }
}
