import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { loadMoveAssets } from '../packages/battle-fx/src/assets.js'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import ancientPower, { timing } from '../packages/battle-fx/src/review-batch-six-v2/ancient-power.js'
import previousAncientPower, { timing as previousTiming } from '../packages/battle-fx/src/review-batch-six/ancient-power.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.abs(a - b) < .02, `${label}: ${a} / ${b}`)
const closePoint = (a, b, label) => { close(a.x, b.x, `${label} x`); close(a.y, b.y, `${label} y`) }
const layouts = [undefined,
  { width: 620, height: 650, actors: [{ id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 }, { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 }] },
  { width: 720, height: 600, actors: [{ id: 'source', profile: 'wide', x: .22, y: .8, height: .22, facing: 1 }, { id: 'target', profile: 'tall', x: .94, y: .42, height: .2, facing: -1, anchors: { center: [.9, .05] } }] },
  { width: 560, height: 700, actors: [{ id: 'source', profile: 'wide', x: .27, y: .8, height: .2, facing: 1 }, { id: 'target', profile: 'tall', x: .85, y: .24, height: .2, facing: -1, anchors: { center: [.5, .05] } }] },
]
async function harness(side = 'source', layout = 0, previous = false) {
  let timeline
  const scene = createSceneGraph(layouts[layout]), rock = new Texture({ source: Texture.WHITE.source }), loads = []
  const assets = await loadMoveAssets('rock-slide', (key, url) => { loads.push([key, url]); return rock })
  const build = previous ? previousAncientPower : context => ancientPower({ ...context, assets })
  const fx = createBattleFx({ effects: { 'ancient-power': { ...MOVE_EFFECTS['ancient-power'], build, ...timing } }, glowTexture: Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  const targetId = side === 'source' ? 'target' : 'source'
  return { scene, rock, loads, source: scene.actor(side), target: scene.actor(targetId), get tl() { return timeline },
    play: options => fx.play({ moveId: 'ancient-power', sourceId: side, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }),
    node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    clean() {
      assert.equal(scene.effects.children.length, 0); assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
      for (const actor of scene.actors.values()) {
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
        assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.tint, 0xffffff)
      }
      assert.equal(rock.destroyed, false); assert.equal(rock.source.destroyed, false)
    },
    dispose() { fx.dispose(); scene.dispose(); rock.destroy(); gsap.ticker.sleep() },
  }
}
function bounds(h, time) {
  function walk(node, alpha = 1) {
    if (!node.visible) return
    alpha *= node.alpha
    if (alpha > .02 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds()
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.maxX <= h.scene.width + .05 && b.maxY <= h.scene.height + .05, `${node.label || node.parent?.label} at ${time}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, alpha)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
    const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(center.x - rx >= -.05 && center.x + rx <= h.scene.width + .05 && center.y - ry >= -.05 && center.y + ry <= h.scene.height + .05, `actor ${actor.id} at ${time}`)
    assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.alpha, 1)
  }
}

test('Ancient Power uses the actual shared Rock Slide sprites with exactly doubled visible dimensions', async () => {
  const svg = await readFile(new URL('../packages/battle-fx/assets/rock.svg', import.meta.url), 'utf8')
  assert.match(svg, /viewBox="0 0 512 512"/)
  for (const side of ['source', 'target']) {
    const h = await harness(side), old = await harness(side, 0, true)
    try {
      const run = h.play(), previous = old.play(); await tick(); h.tl.time(.82, false); old.tl.time(.82, false)
      assert.equal(h.loads.length, 1); assert.equal(h.loads[0][0], 'rock'); assert.match(h.loads[0][1], /\/assets\/rock\.svg$/)
      for (let i = 0; i < 5; i++) {
        const art = h.node(`ancient-power-rendered-rock-${i}`), before = old.node(`ancient-power-rock-slide-art-${i}`)
        assert.equal(art.constructor.name, 'Sprite'); assert.equal(art.texture, h.rock)
        assert.equal(art.tint, i % 2 ? 0xbfa787 : 0xd1b997)
        close(art.width * 438.593 / 512, before.width * 2, 'doubled visible width')
        close(art.height * 468.81 / 512, before.height * 2, 'doubled visible height')
        assert.equal(h.node(`ancient-power-stone-${i}`).children.length, 1, 'only the final Rock Slide render supplies rock artwork')
      }
      assert.equal(h.node('ancient-power-stone-5'), null)
      run.cancel(); previous.cancel(); await Promise.all([run.finished, previous.finished]); h.clean(); old.clean()
    } finally { h.dispose(); old.dispose() }
  }
})

test('five rocks keep evenly spaced 72 degree positions around the live user with real rear/front occlusion', async () => {
  for (const side of ['source', 'target']) {
    const h = await harness(side)
    try {
      const run = h.play(); await tick(); h.tl.time(.82, false)
      const space = h.node('move-artwork'), rear = h.node('ancient-power-orbit-rear'), front = h.node('ancient-power-orbit-front'), copy = h.node('ancient-power-orbit-source')
      assert.ok(space.getChildIndex(rear) < space.getChildIndex(copy)); assert.ok(space.getChildIndex(copy) < space.getChildIndex(front))
      assert.equal(copy.visible, true); assert.ok(copy.children.length > 0)
      const center = space.toLocal(h.source.anchor('visualCenter'), h.scene.effects), radii = []
      for (let i = 0; i < 5; i++) {
        const stone = h.node(`ancient-power-stone-${i}`), angle = -Math.PI / 2 + i * Math.PI * 2 / 5 + (.82 - .16) * 1.45
        assert.equal(stone.parent, Math.sin(angle) < 0 ? rear : front)
        radii.push({ x: (stone.x - center.x) / Math.cos(angle), y: (stone.y - center.y) / Math.sin(angle) })
      }
      assert.ok(rear.children.length >= 2 && front.children.length >= 2)
      for (const radius of radii) closePoint(radius, radii[0], 'one evenly spaced projected circle')
      assert.ok(radii[0].x > h.source.metrics.width / space.scale.y / 2, 'the wider orbit surrounds the body')
      const copyBounds = copy.getBounds(), c = h.source.anchor('visualCenter')
      close(copyBounds.x + copyBounds.width / 2, c.x, 'snapshot aligned horizontally')
      close(copyBounds.y + copyBounds.height / 2, c.y, 'snapshot aligned vertically')
      const before = h.point(h.node('ancient-power-stone-1'))
      h.source.pose.x += 7; h.source.pose.y -= 6; h.tl.time(.825, false)
      const moved = h.point(h.node('ancient-power-stone-1')); assert.ok(Math.hypot(moved.x - before.x, moved.y - before.y) > 5)
      h.tl.time(.86, false); assert.equal(h.node('ancient-power-stone-0').parent, h.node('ancient-power-flights'))
      assert.ok(space.getChildIndex(h.node('ancient-power-flights')) > space.getChildIndex(copy))
      h.tl.time(1.08, false); assert.equal(copy.visible, false)
      for (let i = 0; i < 5; i++) assert.equal(h.node(`ancient-power-stone-${i}`).parent, h.node('ancient-power-flights'))
      run.cancel(); await run.finished; h.clean()
    } finally { h.dispose() }
  }
})

test('all five original launch and impact frames remain exact, with one result cue and live aim', async () => {
  assert.equal(timing.contact, previousTiming.contact); assert.equal(timing.duration, previousTiming.duration)
  assert.deepEqual(timing.markers.map(({ id, timeSeconds }) => [id, timeSeconds]), previousTiming.markers.map(({ id, timeSeconds }) => [id, timeSeconds]))
  for (const side of ['source', 'target']) {
    const h = await harness(side), cues = []; let contact
    try {
      const run = h.play({ onCue(cue) { cues.push(cue.type); contact = { stone: h.point(h.node('ancient-power-stone-0')), target: h.target.anchor('center') } } }); await tick()
      for (let i = 0; i < 5; i++) {
        const launch = .86 + i * .055
        h.tl.time(launch - .0001, false); assert.notEqual(h.node(`ancient-power-stone-${i}`).parent, h.node('ancient-power-flights'))
        h.tl.time(launch, false); assert.equal(h.node(`ancient-power-stone-${i}`).parent, h.node('ancient-power-flights'))
      }
      h.tl.time(1.25, false); h.target.pose.x += 8; h.target.pose.y -= 5
      h.tl.time(1.339, false); assert.deepEqual(cues, [])
      h.tl.time(1.34, false); assert.deepEqual(cues, ['impact']); closePoint(contact.stone, contact.target, 'first contact precedes cue')
      const space = h.node('move-artwork'), unit = space.scale.y, sign = Math.sign(space.scale.x)
      const r = Math.min(22, Math.max(12, h.source.metrics.height / unit * .085))
      for (let i = 1; i < 5; i++) {
        h.tl.time(.86 + i * .055 + .48, false)
        const point = h.target.anchor('center')
        closePoint(h.point(h.node(`ancient-power-stone-${i}`)), { x: point.x + [0, -.4, .4, -.2, .2][i] * r * unit * sign, y: point.y + [0, .2, -.2, -.5, .5][i] * r * unit }, `cosmetic contact ${i}`)
      }
      assert.deepEqual(cues, ['impact']); h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})

test('full enlarged art stays bounded in both directions and all owned layers clean up without destroying the rock texture', async () => {
  for (const side of ['source', 'target']) for (const layout of [0, 1, 2, 3]) {
    const h = await harness(side, layout)
    try {
      const run = h.play(); await tick()
      for (let time = .017; time < timing.duration; time += .037) { h.tl.time(time, false); bounds(h, time) }
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); h.clean()
      for (const time of [.4, .9, 1.03, 1.4, 1.8]) {
        const cancelled = h.play(); await tick(); h.tl.time(time, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); h.clean()
      }
      const reduced = h.play({ reducedMotion: true }); await tick(); h.tl.time(h.tl.duration(), false); assert.equal((await reduced.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})
