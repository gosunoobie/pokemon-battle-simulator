import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { Texture, TextureSource } from 'pixi.js'
import { createIdleMotion } from '../apps/simulation/src/idle.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors, previewSpriteHeight } from '../apps/game/src/scene/previewActors.js'

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .0001, `${message}: ${actual} vs ${expected}`)
const transform = actor => ({ x: actor.pose.x, y: actor.pose.y, scaleX: actor.pose.scale.x, scaleY: actor.pose.scale.y, rotation: actor.pose.rotation })
const neutral = actor => assert.deepEqual(transform(actor), { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 })
const visual = actor => actor.pose.children[0]
const foot = (scene, actor) => scene.effects.toLocal({ x: 0, y: 0 }, visual(actor))
function harness(species = 'charizard', width = 1000, height = 450, options = {}) {
  const actors = previewSceneActors(species, species).map((spec, index) => ({ ...spec,
    y: index ? spec.y : .82,
    height: previewSpriteHeight(species, { far: !!index, width, height }),
    anchors: { origin: [.14, 1.08], center: [.91, .12], ground: [.31, .66], floor: [.82, .7] },
  }))
  const scene = createSceneGraph({ width, height, actors, ...options }), timelines = []
  const idle = createIdleMotion({ scene, timelineEngine: { timeline(config) {
    const timeline = gsap.timeline({ ...config, paused: true }); timelines.push(timeline); return timeline
  } } })
  return { scene, idle, timelines, get tl() { return timelines.at(-1) }, dispose() { idle.dispose(); scene.dispose() } }
}

test('idle starts paused, breathes uniformly with distinct side phases, and loops continuously', () => {
  const h = harness(), source = h.scene.actor('source'), target = h.scene.actor('target')
  try {
    assert.equal(h.timelines.length, 0); neutral(source); neutral(target)
    h.idle.setActors(['source', 'target', 'source', 'missing'])
    assert.equal(h.timelines.length, 1)
    h.tl.totalTime(.01, false)
    assert.ok(source.pose.scale.x - 1 < .00001, 'motion eases in without a size jump')
    h.tl.totalTime(1.5, false)
    assert.ok(source.pose.scale.x > 1.005 && source.pose.scale.x <= 1.014)
    assert.equal(source.pose.scale.x, source.pose.scale.y)
    assert.notEqual(source.pose.scale.x, target.pose.scale.x, 'both sides breathe at different phases')
    assert.notEqual(source.pose.rotation, target.pose.rotation)
    const first = [...h.scene.actors.values()].map(transform)
    h.tl.totalTime(7.9, false)
    for (const [index, actor] of [...h.scene.actors.values()].entries()) {
      for (const [key, value] of Object.entries(transform(actor))) close(value, first[index][key], `periodic ${key}`)
    }
    h.tl.totalTime(6.4 - .0001, false); const end = transform(source)
    h.tl.totalTime(6.4 + .0001, false); const start = transform(source)
    for (const key of Object.keys(end)) assert.ok(Math.abs(end[key] - start[key]) < .001, `${key} continuous across repeat`)
    h.idle.setActors(['target', 'source'])
    assert.equal(h.timelines.length, 1, 'ordinary displayed-state refreshes keep the loop')
  } finally { h.dispose() }
})

test('small, wide and tall actors keep their actual feet planted and complete bounds within the field', () => {
  for (const species of ['caterpie', 'charizard', 'geodude', 'wailord', 'onix', 'diglett', 'unownquestion']) {
    for (const [width, height] of [[1000, 450], [720, 600], [560, 700]]) {
      const h = harness(species, width, height)
      try {
        const platforms = h.scene.terrain.children.map(node => ({ ...node.getBounds() }))
        const feet = new Map([...h.scene.actors].map(([id, actor]) => [id, foot(h.scene, actor)]))
        h.idle.setActors(['source', 'target'])
        for (let time = .1; time < 12.8; time += .17) {
          h.tl.totalTime(time, false)
          for (const [id, actor] of h.scene.actors) {
            const bottom = foot(h.scene, actor), resting = feet.get(id), { width: w, height: artHeight } = actor.metrics
            close(bottom.x, resting.x, `${species} foot x`); close(bottom.y, resting.y, `${species} foot y`)
            assert.ok(Math.abs(resting.y - actor.base('floor').y) > 1, 'semantic floor is deliberately different')
            assert.ok(actor.pose.scale.x >= 1 && actor.pose.scale.x <= 1.014)
            assert.equal(actor.pose.scale.x, actor.pose.scale.y)
            assert.ok(Math.abs(actor.pose.rotation) <= Math.PI / 600, 'less than .3 degrees of sway')
            for (const x of [-w / 2, w / 2]) for (const y of [-artHeight, 0]) {
              const corner = h.scene.effects.toLocal({ x, y }, visual(actor))
              assert.ok(corner.x >= -.001 && corner.x <= width + .001 && corner.y >= -.001 && corner.y <= height + .001,
                `${species} ${width}×${height}: full silhouette stays inside field`)
            }
          }
        }
        assert.deepEqual(h.scene.terrain.children.map(node => ({ ...node.getBounds() })), platforms)
        assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
        assert.equal(h.scene.effects.children.length, 0)
      } finally { h.dispose() }
    }
  }
})

test('edge clearance reduces idle amplitude instead of moving the resting slot or cropping the art', () => {
  const actors = [
    { id: 'source', profile: 'wide', x: .15, y: .8, height: .4, facing: 1,
      bounds: { x: 0, y: 0, width: 149.9, height: 200 }, anchors: { origin: [.1, .2] } },
    { id: 'target', profile: 'tall', x: .8, y: .4002, height: .4, facing: -1,
      bounds: { x: 0, y: 0, width: 100, height: 200 }, anchors: { origin: [.8, .1] } },
  ]
  const h = harness('charizard', 1000, 1000, { actors })
  try {
    h.idle.setActors(['source', 'target'])
    let peak = 1
    for (let time = .9; time < 6.4; time += .05) {
      h.tl.totalTime(time, false)
      for (const actor of h.scene.actors.values()) {
        peak = Math.max(peak, actor.pose.scale.x)
        const { width, height } = actor.metrics
        for (const x of [-width / 2, width / 2]) for (const y of [-height, 0]) {
          const corner = h.scene.effects.toLocal({ x, y }, visual(actor))
          assert.ok(corner.x >= -.001 && corner.x <= 1000.001 && corner.y >= -.001 && corner.y <= 1000.001)
        }
      }
    }
    assert.ok(peak > 1 && peak < 1.002, 'the tiny available margin still allows restrained breathing')
  } finally { h.dispose() }
})

test('pause relinquishes all actors synchronously and never overwrites the subsequent attack pose', () => {
  const h = harness(), source = h.scene.actor('source'), target = h.scene.actor('target')
  try {
    target.pose.position.set(18, -6); target.pose.alpha = .4; target.pose.tint = 0xff99aa
    h.idle.setActors(['source']); h.tl.totalTime(1.3, false)
    const old = h.tl, callback = old.eventCallback('onUpdate')
    h.idle.pause(); neutral(source)
    assert.equal(old.eventCallback('onUpdate'), undefined)
    assert.equal(target.pose.x, 18); assert.equal(target.pose.y, -6)
    assert.equal(target.pose.alpha, .4); assert.equal(target.pose.tint, 0xff99aa)
    source.pose.position.set(103, -19); source.pose.scale.set(.83, 1.12); source.pose.rotation = .45
    const attack = transform(source)
    old.totalTime(2.5, false); callback(); h.idle.pause(); h.idle.dispose(); callback()
    assert.deepEqual(transform(source), attack, 'stale callbacks and repeated stop calls cannot reset an attack')
    h.idle.setActors(['source']); assert.equal(h.timelines.length, 1, 'disposed controller cannot restart')
  } finally { h.dispose() }
})

test('eligibility changes restore only departed actors, filter hidden actors and retain the other phase', () => {
  const h = harness(), source = h.scene.actor('source'), target = h.scene.actor('target')
  try {
    target.root.visible = false; target.pose.position.set(7, -3)
    h.idle.setActors(['source', 'target']); h.tl.totalTime(1.7, false)
    assert.equal(target.pose.x, 7); assert.equal(target.pose.y, -3, 'hidden actor was never claimed')
    target.root.visible = true; target.pose.position.set(0, 0)
    const sourcePhase = transform(source)
    h.idle.setActors(['source', 'target']); assert.deepEqual(transform(source), sourcePhase)
    assert.equal(h.timelines.length, 1)
    h.tl.totalTime(2.8, false); assert.ok(target.pose.scale.x > 1)
    h.idle.setActors(['target']); neutral(source)
    source.pose.position.set(90, 12)
    h.tl.totalTime(3.2, false); assert.equal(source.pose.x, 90); assert.equal(source.pose.y, 12)
    target.root.visible = false; h.tl.totalTime(3.4, false); neutral(target)
    target.pose.position.set(41, 6)
    h.idle.pause(); assert.equal(target.pose.x, 41, 'hidden actor was already relinquished')
    assert.equal(target.root.visible, false)
  } finally { h.dispose() }
})

test('idle preserves tint, opacity, visibility and texture ownership through pause and disposal', () => {
  const texture = new Texture({ source: new TextureSource({ width: 96, height: 96 }) })
  const h = harness('charizard', 1000, 450, { textures: { source: texture, target: texture } })
  const actor = h.scene.actor('source'), sprite = visual(actor).children[0]
  try {
    actor.pose.alpha = .75; actor.pose.tint = 0xddaaff; actor.root.zIndex = 900
    h.idle.setActors(['source']); h.tl.totalTime(2, false); h.idle.pause()
    assert.equal(actor.pose.alpha, .75); assert.equal(actor.pose.tint, 0xddaaff)
    assert.equal(actor.root.visible, true); assert.equal(actor.root.zIndex, 900)
    assert.equal(sprite.texture, texture); assert.notEqual(texture.destroyed, true)
    h.idle.setActors(['source']); h.tl.totalTime(1.4, false); h.idle.dispose(); h.idle.dispose()
    neutral(actor); assert.equal(sprite.texture, texture); assert.notEqual(texture.destroyed, true)
    assert.equal(h.scene.effects.children.length, 0)
  } finally { h.dispose(); texture.destroy(true) }
})

test('missing inputs and timeline failures leave neutral actors without an active loop', () => {
  const h = harness(), actor = h.scene.actor('source')
  try {
    const empty = createIdleMotion(); empty.setActors(['source']); empty.pause(); empty.dispose()
    h.idle.setActors(['missing']); h.idle.setActors('source'); assert.equal(h.timelines.length, 0)
    actor.pose.alpha = 0; h.idle.setActors(['source']); assert.equal(h.timelines.length, 0)
    actor.pose.alpha = 1
    const broken = createIdleMotion({ scene: h.scene, timelineEngine: { timeline() { throw new Error('Unavailable') } } })
    broken.setActors(['source']); neutral(actor); broken.dispose()
  } finally { h.dispose(); gsap.ticker.sleep() }
})
