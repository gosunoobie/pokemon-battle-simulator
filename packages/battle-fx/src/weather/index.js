import { Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { visualRandom } from '../random.js'
import rain from './rain.js'
import sun from './sun.js'
import sandstorm from './sandstorm.js'
import hail from './hail.js'

const recipes = Object.freeze({ rain, sun, sandstorm, hail })
const colors = Object.freeze({ rain: 0x284f77, sun: 0xffcd73, sandstorm: 0xab7b3b, hail: 0x8cbedb })
const active = new WeakMap()
const clamp = value => Math.max(0, Math.min(1, value))

/** A brief cosmetic field continuation. Weather rules and event ordering belong to the host. */
export function playWeatherContinuation(request = {}, options = {}) {
  const { weatherId, visualSeed = 1 } = request ?? {}
  const { scene, signal, reducedMotion = false, timelineEngine = gsap, deadlineMs = 3000 } = options ?? {}
  let settled = false, layer, timeline, timer, resolve
  const finished = new Promise(done => { resolve = done })
  const handle = { finished, cancel: () => finish('cancelled') }
  const abort = () => finish('cancelled')
  const effects = scene?.effects

  function finish(status, error) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    effects?.off?.('destroyed', abort)
    if (effects && active.get(effects) === handle) active.delete(effects)
    let cleanupError
    const attempt = fn => { try { fn() } catch (caught) { cleanupError ??= caught } }
    attempt(() => timeline?.kill())
    attempt(() => { if (layer && !layer.destroyed) layer.destroy({ children: true }) })
    const reason = error ?? cleanupError
    resolve({ status: cleanupError ? 'failed' : status, ...(reason ? { reason: reason.message ?? String(reason) } : {}) })
  }

  if (signal?.aborted) { finish('cancelled'); return handle }
  if (!Object.hasOwn(recipes, weatherId) || !effects || effects.destroyed || typeof effects.addChild !== 'function' ||
      !Number.isFinite(scene.width) || scene.width <= 0 || !Number.isFinite(scene.height) || scene.height <= 0 ||
      (scene.unit !== undefined && (!Number.isFinite(scene.unit) || scene.unit <= 0))) {
    finish('skipped'); return handle
  }

  try {
    active.get(effects)?.cancel()
    active.set(effects, handle)
    signal?.addEventListener('abort', abort, { once: true })
    effects.once?.('destroyed', abort)
    layer = new Container(); layer.label = `weather-continuation-${weatherId}`
    effects.addChild(layer)
    // The field's logical dimensions determine every contour; actor geometry is irrelevant.
    const field = { width: scene.width, height: scene.height,
      unit: Math.min(scene.unit ?? 1, scene.width / 400, scene.height / 120) }
    const clip = reducedMotion ? { duration: .24, render() {} } : recipes[weatherId]({ layer, scene: field, random: visualRandom(visualSeed) })
    if (reducedMotion) {
      const wash = new Graphics().rect(0, 0, field.width, field.height).fill({ color: colors[weatherId], alpha: .075 })
      wash.label = 'weather-reduced-wash'; layer.addChild(wash)
    }
    const duration = clip.duration, clock = { time: 0 }
    const render = () => {
      if (settled) return
      if (effects.destroyed || layer.destroyed) { finish('cancelled'); return }
      try {
        layer.alpha = Math.min(clamp(clock.time / (reducedMotion ? .08 : .12)),
          clamp((duration - clock.time) / (reducedMotion ? .12 : .24)))
        clip.render(clock.time)
      } catch (error) { finish('failed', error) }
    }
    timeline = timelineEngine.timeline({ onUpdate: render, onComplete: () => finish('completed') })
    timeline.to(clock, { time: duration, duration, ease: 'none' }, 0)
    render()
    if (!settled) timer = setTimeout(() => finish('failed', new Error('Weather continuation deadline exceeded.')),
      Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : 3000)
  } catch (error) { finish('failed', error) }
  return handle
}
