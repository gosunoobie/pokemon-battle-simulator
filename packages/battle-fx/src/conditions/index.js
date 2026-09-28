import { Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { visualRandom } from '../random.js'

const colors = Object.freeze({ spikes: 0xc2cad3, poison: 0xc777e9, burn: 0xffa34c,
  'leech-seed': 0x8dde6d, sleep: 0xa9b9f5, paralysis: 0xffe47b, freeze: 0xabe8ff,
  confusion: 0xf6c4ed, cure: 0xaef8d2, blocked: 0xd1dbec, boost: 0xffac83, unboost: 0xa0beff })
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const active = new WeakMap()

function diamond(g, x, y, r, color, alpha = 1) {
  g.poly([x, y - r, x + r * .6, y, x, y + r, x - r * .6, y]).fill({ color, alpha })
}
function arrow(g, x, y, size, down, color) {
  const d = down ? 1 : -1
  g.moveTo(x - size, y).lineTo(x, y + d * size).lineTo(x + size, y)
    .moveTo(x, y + d * size).lineTo(x, y - d * size * 1.6).stroke({ color, width: size * .4, alpha: .8 })
}

/** Brief cosmetic reactions to already-confirmed public events. Never changes actor poses. */
export function playConditionReaction(request = {}, options = {}) {
  const { kind, actorId, visualSeed = 1 } = request ?? {}
  const { scene, signal, reducedMotion = false, timelineEngine = gsap, deadlineMs = 2500 } = options ?? {}
  let layer, art, timeline, timer, settled = false, resolve, actor, center, ground, size
  const finished = new Promise(done => { resolve = done })
  const handle = { finished, cancel: () => finish('cancelled') }
  const effects = scene?.effects, abort = () => finish('cancelled')
  function finish(status, error) {
    if (settled) return
    settled = true; clearTimeout(timer)
    signal?.removeEventListener('abort', abort); effects?.off?.('destroyed', abort)
    const handles = effects && active.get(effects)
    if (handles?.get(actorId) === handle) { handles.delete(actorId); if (!handles.size) active.delete(effects) }
    let cleanupError
    try { timeline?.kill() } catch (caught) { cleanupError = caught }
    try { if (layer && !layer.destroyed) layer.destroy({ children: true }) } catch (caught) { cleanupError ??= caught }
    const reason = error ?? cleanupError
    resolve({ status: cleanupError ? 'failed' : status, ...(reason ? { reason: reason.message ?? String(reason) } : {}) })
  }
  if (signal?.aborted) { finish('cancelled'); return handle }
  if (!Object.hasOwn(colors, kind) || !actorId || !effects || effects.destroyed ||
      !Number.isFinite(scene?.width) || scene.width <= 0 || !Number.isFinite(scene?.height) || scene.height <= 0 ||
      (scene.unit !== undefined && (!Number.isFinite(scene.unit) || scene.unit <= 0))) {
    finish('skipped'); return handle
  }
  try {
    actor = scene.actor?.(actorId)
    if (!actor || actor.root?.visible === false) { finish('skipped'); return handle }
    center = actor.anchor('visualCenter'); ground = actor.base('ground')
    if (![center?.x, center?.y, ground?.x, ground?.y].every(Number.isFinite)) { finish('skipped'); return handle }
    size = Math.min(58 * (scene.unit ?? 1), scene.width / 7, scene.height / 7)
    center = { x: clamp(center.x, size * 1.5, scene.width - size * 1.5), y: clamp(center.y, size * 1.5, scene.height - size * 1.5) }
    ground = { x: clamp(ground.x, size * 1.5, scene.width - size * 1.5), y: clamp(ground.y, size, scene.height - size * .4) }
    const handles = active.get(effects) ?? new Map()
    handles.get(actorId)?.cancel(); handles.set(actorId, handle); active.set(effects, handles)
    signal?.addEventListener('abort', abort, { once: true }); effects.once?.('destroyed', abort)
    layer = new Container(); layer.label = `condition-${kind}`; effects.addChild(layer)
    art = new Graphics(); art.label = `condition-${kind}-art`; layer.addChild(art)
    const random = visualRandom(visualSeed), phases = Array.from({ length: 8 }, () => random() * Math.PI * 2)
    const duration = reducedMotion ? .22 : .64, clock = { time: 0 }, color = colors[kind]
    function render() {
      if (settled) return
      if (effects.destroyed || layer.destroyed) { finish('cancelled'); return }
      try {
        const p = clock.time / duration, fade = Math.min(1, p * 7, (1 - p) * 4)
        layer.alpha = Math.max(0, fade); art.clear()
        if (reducedMotion) {
          art.ellipse(center.x, center.y, size * .7, size * .5).fill({ color, alpha: .13 })
          return
        }
        const { x, y } = center, s = size
        if (kind === 'poison') {
          for (let i = 0; i < 7; i++) {
            const q = (p * .9 + i / 7) % 1
            art.circle(x + Math.sin(phases[i] + p * 3) * s * .65, y + s * (.75 - q * 1.55), s * (.045 + q * .085))
              .fill({ color, alpha: .3 + .5 * Math.sin(q * Math.PI) })
          }
        } else if (kind === 'burn') {
          for (let i = 0; i < 5; i++) {
            const dx = (i - 2) * s * .29, rise = s * (.55 + Math.sin(phases[i] + p * 11) * .15)
            art.moveTo(x + dx - s * .14, y + s * .55).quadraticCurveTo(x + dx - s * .24, y, x + dx + s * .04, y - rise)
              .quadraticCurveTo(x + dx + s * .32, y + s * .13, x + dx + s * .14, y + s * .55).closePath().fill({ color, alpha: .65 })
          }
        } else if (kind === 'leech-seed') {
          for (let i = 0; i < 3; i++) {
            const yy = y + (i - 1) * s * .42
            art.moveTo(x - s, yy).bezierCurveTo(x - s * .5, yy - s * .28, x + s * .5, yy + s * .28, x + s, yy)
              .stroke({ color, width: s * .045, alpha: .65 })
            const q = (p + i / 3) % 1
            diamond(art, x + (q * 2 - 1) * s, yy + Math.sin(q * Math.PI * 2) * s * .1, s * .11, 0xd9ffbb)
          }
        } else if (kind === 'sleep') {
          for (let i = 0; i < 3; i++) {
            const q = (p * .6 + i / 3) % 1, xx = x + s * (.25 + q * .5), yy = y + s * (.4 - q * 1.5), r = s * (.08 + q * .12)
            art.moveTo(xx - r, yy - r).lineTo(xx + r, yy - r).lineTo(xx - r, yy + r).lineTo(xx + r, yy + r)
              .stroke({ color, width: s * .04, alpha: .8 })
          }
        } else if (kind === 'paralysis') {
          for (let i = 0; i < 3; i++) {
            const xx = x + (i - 1) * s * .58, shift = Math.sin(p * 26 + i) * s * .05
            art.poly([xx + shift, y - s * .8, xx - s * .22, y + s * .05, xx + s * .13, y - s * .1, xx - shift, y + s * .8])
              .stroke({ color, width: s * .065, alpha: .85 })
          }
        } else if (kind === 'freeze') {
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3, r = s * (.55 + p * .18)
            diamond(art, x + Math.cos(a) * r, y + Math.sin(a) * r, s * (.16 + Math.sin(p * Math.PI) * .07), color, .7)
          }
        } else if (kind === 'confusion') {
          for (let i = 0; i < 4; i++) {
            const a = p * 4 + i * Math.PI / 2
            art.star(x + Math.cos(a) * s * .85, y - s * .3 + Math.sin(a) * s * .28, 5, s * .14, s * .055).fill({ color, alpha: .9 })
          }
        } else if (kind === 'cure') {
          for (let i = 0; i < 5; i++) {
            const xx = x + Math.cos(phases[i]) * s * .75, yy = y + Math.sin(phases[i]) * s * .6 - p * s * .3, r = s * .12
            art.moveTo(xx - r, yy).lineTo(xx + r, yy).moveTo(xx, yy - r).lineTo(xx, yy + r).stroke({ color, width: s * .055, alpha: .8 })
          }
        } else if (kind === 'blocked') {
          const r = s * (.7 + p * .13)
          art.poly([x, y - r, x + r * .7, y - r * .55, x + r * .6, y + r * .5, x, y + r, x - r * .6, y + r * .5, x - r * .7, y - r * .55])
            .fill({ color, alpha: .08 }).stroke({ color, width: s * .05, alpha: .85 })
        } else if (kind === 'boost' || kind === 'unboost') {
          for (let i = 0; i < 3; i++) arrow(art, x + (i - 1) * s * .55,
            y + (kind === 'boost' ? 1 : -1) * s * (.35 - p * .8), s * .15, kind === 'unboost', color)
        } else if (kind === 'spikes') {
          for (let i = 0; i < 7; i++) {
            const xx = ground.x + (i - 3) * s * .36, yy = ground.y + Math.sin(i * 2) * s * .14
            art.poly([xx - s * .11, yy, xx, yy - s * (.18 + Math.sin(p * Math.PI) * .2), xx + s * .11, yy])
              .fill({ color, alpha: .85 }).stroke({ color: 0xffffff, width: s * .014, alpha: .7 })
          }
        }
      } catch (error) { finish('failed', error) }
    }
    timeline = timelineEngine.timeline({ onUpdate: render, onComplete: () => finish('completed') })
    timeline.to(clock, { time: duration, duration, ease: 'none' }, 0); render()
    if (!settled) timer = setTimeout(() => finish('failed', new Error('Condition reaction deadline exceeded.')),
      Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : 2500)
  } catch (error) { finish('failed', error) }
  return handle
}

/** Static public Spikes layers. Geometry belongs to host slots, never actor anatomy. */
export function createHazardDisplay({ scene } = {}) {
  const terrain = scene?.terrain
  let layer = null, destroyed = false, key = ''
  const destroy = () => {
    if (destroyed) return
    destroyed = true; terrain?.off?.('destroyed', destroy)
    if (layer && !layer.destroyed) layer.destroy({ children: true })
  }
  if (!terrain || terrain.destroyed || typeof terrain.addChild !== 'function' ||
      !Number.isFinite(scene.width) || scene.width <= 0 || !Number.isFinite(scene.height) || scene.height <= 0 ||
      (scene.unit !== undefined && (!Number.isFinite(scene.unit) || scene.unit <= 0))) return { update() {}, destroy }
  layer = new Container(); layer.label = 'persistent-spikes'; terrain.addChild(layer)
  terrain.once?.('destroyed', destroy)
  return { destroy, update(entries = []) {
    if (destroyed || layer.destroyed) return
    const rows = ['near', 'far'].map(side => {
      const count = entries.find(entry => entry.side === side)?.layers
      return { side, layers: Number.isFinite(count) ? clamp(Math.floor(count), 0, 3) : 0 }
    })
    const nextKey = JSON.stringify(rows)
    if (nextKey === key) return
    key = nextKey
    for (const child of layer.removeChildren()) child.destroy()
    for (const { side, layers } of rows) {
      const slot = scene.hazardSlots?.[side]
      if (!layers || !slot || ![slot.x, slot.y, slot.rx, slot.ry].every(Number.isFinite)) continue
      const art = new Graphics(); art.label = `spikes-${side}-${layers}`; layer.addChild(art)
      const u = Math.min(scene.unit ?? 1, scene.width / 400, scene.height / 120)
      for (let ring = 0; ring < layers; ring++) for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7 + ring * .36, r = .62 + ring * .13
        const x = clamp(slot.x + Math.cos(angle) * slot.rx * r, 9 * u, scene.width - 9 * u)
        const y = clamp(slot.y + Math.sin(angle) * slot.ry * r, 15 * u, scene.height - 3 * u)
        art.ellipse(x, y + 1 * u, 7 * u, 2.5 * u).fill({ color: 0x121e29, alpha: .3 })
        art.poly([x - 6 * u, y, x - 2 * u, y - 11 * u, x + 1 * u, y - 3 * u, x + 6 * u, y - 6 * u, x + 5 * u, y + 1 * u])
          .fill({ color: 0xa9b9c7, alpha: .8 }).stroke({ color: 0xe0eaf1, width: .8 * u, alpha: .7 })
      }
    }
  } }
}
