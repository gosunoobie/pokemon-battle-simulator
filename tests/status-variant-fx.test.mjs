import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, VARIANT_TIMINGS } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const variants = [['curse', 'self-setup'], ['mirror-move', 'source-cast']]
function setup(reverse = false, width = 1000, height = 450) {
  let tl
  const scene = createSceneGraph({ width, height, actors: [{ id: 'caster', profile: 'charizard', x: reverse ? .72 : .28, y: .7,
    height: .32, facing: reverse ? -1 : 1 }] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) {
    tl = gsap.timeline({ ...options, paused: true }); return tl
  } } })
  return { scene, fx, get tl() { return tl }, dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  const pose = h.scene.actor('caster').pose
  assert.equal(pose.x, 0); assert.equal(pose.y, 0); assert.equal(pose.rotation, 0)
  assert.equal(pose.alpha, 1); assert.equal(pose.scale.x, 1); assert.equal(pose.scale.y, 1)
}

test('Curse setup and Mirror Move casting work without an opponent, in either direction and reduced motion', async () => {
  for (const [moveId, variant] of variants) for (const reverse of [false, true]) for (const reducedMotion of [false, true]) {
    const h = setup(reverse), cues = [], timing = reducedMotion ? { contact: .2, duration: .8 } : VARIANT_TIMINGS[moveId][variant]
    try {
      const run = h.fx.play({ moveId, variant, sourceId: 'caster', targetIds: [], visualSeed: 3 }, {
        scene: h.scene, reducedMotion, onCue: cue => cues.push(cue.type),
      })
      await tick(); assert.ok(h.tl, 'a source-only variant creates its own timeline')
      h.tl.time(timing.contact - .001, false); assert.equal(cues.length, 0)
      h.tl.time(timing.contact, false); assert.deepEqual(cues, ['impact'])
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('variant art stays within field bounds and cancellation removes only its owned artwork', async () => {
  for (const [moveId, variant] of variants) for (const [width, height] of [[1000, 450], [390, 720]]) {
    const h = setup(false, width, height)
    try {
      const run = h.fx.play({ moveId, variant, sourceId: 'caster', targetIds: [] }, { scene: h.scene })
      await tick()
      for (const time of [.25, .65, .85, 1.1]) {
        h.tl.time(time, false)
        const bounds = h.scene.effects.getBounds()
        assert.ok(bounds.minX >= -.1 && bounds.maxX <= width + .1, `${moveId} horizontal bounds`)
        assert.ok(bounds.minY >= -.1 && bounds.maxY <= height + .1, `${moveId} vertical bounds`)
      }
      run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
    } finally { h.dispose() }
  }
})

test('unknown variants, unsupported phases and ordinary offensive self-targets still skip safely', async () => {
  const h = setup()
  try {
    for (const request of [
      { moveId: 'curse', targetIds: ['caster'] }, { moveId: 'mirror-move', targetIds: ['caster'] },
      { moveId: 'tackle', variant: 'self-setup', targetIds: ['caster'] },
      { moveId: 'curse', variant: 'unknown', targetIds: [] },
      { moveId: 'curse', variant: 'self-setup', phase: 'prepare', targetIds: [] },
    ]) {
      assert.equal((await h.fx.play({ sourceId: 'caster', ...request }, { scene: h.scene }).finished).status, 'skipped')
      clean(h)
    }
  } finally { h.dispose() }
})
