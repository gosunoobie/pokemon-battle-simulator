import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const texture = (width, height) => new Texture({ source: new TextureSource({ width, height }) })
const close = (a, b, label) => assert.ok(Math.abs(a - b) < .002, `${label}: ${a} / ${b}`)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('Waterfall preserves actor visibility and the original scrolling image within its crop, including replay and cancellation', async () => {
  const image = texture(1024, 1536), actorTexture = texture(96, 96)
  for (const reversed of [false, true]) {
    const scene = createSceneGraph({ textures: { charizard: actorTexture, venusaur: actorTexture },
      ...(reversed ? { width: 720, height: 600, actors: [
        { id: 'source', profile: 'tall', x: .75, y: .8, height: .3, facing: -1 },
        { id: 'target', profile: 'wide', x: .25, y: .55, height: .24, facing: 1 },
      ] } : {}) })
    let tl
    const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: () => image,
      timelineEngine: { timeline(options) { return tl = gsap.timeline({ ...options, paused: true }) } } })
    try {
      for (const cancelAt of [null, .6, 1.2, 2.15, null]) {
        const cues = []
        const run = fx.play({ moveId: 'waterfall', sourceId: 'source', targetIds: ['target'] }, { scene, onCue: cue => cues.push(cue) })
        await tick()
        const space = scene.effects.getChildByLabel('move-artwork', true)
        const center = space.toLocal(scene.actor('target').base('center'), scene.effects)
        const floor = space.toLocal(scene.actor('target').base('floor'), scene.effects)
        const top = center.y - 246, bottom = floor.y, height = bottom - top
        const slices = scene.effects.getChildByLabel('waterfall-flowing-body', true).children
        const ownedTextures = slices.map(slice => slice.texture)
        const duration = cancelAt ?? 3.15
        for (let time = .01; time < duration; time += .017) {
          tl.time(time, false)
          for (const actor of scene.actors.values()) {
            assert.equal(actor.pose.alpha, 1)
            assert.equal(actor.root.destroyed, false)
            assert.ok(Number.isFinite(actor.anchor('center').x))
            for (let parent = actor.root; parent; parent = parent.parent) {
              assert.equal(parent.visible, true)
              assert.ok(parent.mask == null)
            }
          }
          const front = time <= .36 ? top : time < .78 ? top + (center.y - top) * ((time - .36) / .42) ** 2
            : time < .9 ? center.y + (bottom - center.y) * ((time - .78) / .12) : bottom
          const tail = time <= 1.92 ? top : time < 2.3 ? top + height * ((time - 1.92) / .38) ** 2 : bottom
          const phase = Math.max(0, Math.min(1, (time - .36) / 2.2)) * 1188
          const visible = slices.filter(slice => slice.visible)
          close(visible.reduce((sum, slice) => sum + slice.height, 0), front - tail, 'revealed height')
          let end = tail
          for (const slice of visible) {
            close(slice.y, end, 'no gap between texture slices')
            close(slice.width, 210, 'original stream width')
            assert.equal(slice.alpha, .88)
            assert.ok(slice.texture.frame.y >= 0 && slice.texture.frame.bottom <= image.height + .002)
            // Sample the original repeating texture equation inside each crop.
            for (const portion of [.1, .5, .9]) {
              const y = slice.y + slice.height * portion
              const expected = (((y - top - phase) % height + height) % height) / height
              const sampled = (slice.texture.frame.y + slice.texture.frame.height * portion) / image.height
              close(sampled, expected, 'original downward texture flow')
            }
            end += slice.height
          }
        }
        if (cancelAt !== null) run.cancel()
        else tl.time(3.15, false)
        assert.equal((await run.finished).status, cancelAt === null ? 'completed' : 'cancelled')
        assert.equal(cues.length, cancelAt !== null && cancelAt < .78 ? 0 : 1)
        assert.equal(scene.effects.children.length, 0)
        assert.ok(ownedTextures.every(texture => texture.destroyed))
        assert.equal(image.destroyed, false); assert.equal(image.source.destroyed, false)
        assert.equal(actorTexture.destroyed, false)
        for (const actor of scene.actors.values()) {
          assert.equal(actor.pose.alpha, 1); close(actor.pose.x, 0, 'reset X'); close(actor.pose.y, 0, 'reset Y')
        }
      }
    } finally { fx.dispose(); scene.dispose() }
  }
  image.destroy(true); actorTexture.destroy(true); gsap.ticker.sleep()
})
