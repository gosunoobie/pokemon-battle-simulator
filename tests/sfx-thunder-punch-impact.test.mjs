import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSyncVisualAuditioner } from '../apps/sfx-bench/src/syncVisual.js'
import { createThunderPunchImpactFx } from '../apps/sfx-bench/src/thunderPunchImpact.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const near = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .001, label)
const label = 'thunder-punch-review-impact'
const subject = { fxId: 'thunder-punch', visual: { durationSeconds: 1.6, markers: [] } }
const pose = actor => ({ x: actor.pose.x, y: actor.pose.y, rotation: actor.pose.rotation,
  scaleX: actor.pose.scale.x, scaleY: actor.pose.scale.y, alpha: actor.pose.alpha, tint: actor.pose.tint })

function display(node) {
  return { label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha,
    scaleX: node.scale.x, scaleY: node.scale.y,
    graphics: node.context?.instructions.map(({ action, data }) => {
      const { texture, ...style } = data.style
      return { action, style, path: data.path.instructions }
    }), children: node.children?.map(display) }
}
function harness({ factory = createThunderPunchImpactFx, scene: spec, fx: options = {} } = {}) {
  const scene = createSceneGraph(spec), timelines = []
  const createFx = vars => factory({ ...vars, ...options, glowTexture: Texture.WHITE })
  const timelineEngine = { timeline(vars) {
    const timeline = gsap.timeline({ ...vars, paused: true })
    timeline.play = () => timeline
    timelines.push(timeline)
    return timeline
  } }
  const audition = createSyncVisualAuditioner({ createFx, timelineEngine, now: () => 1000 })
  const fx = createFx({ timelineEngine })
  const node = name => scene.effects.getChildByLabel(name, true)
  const point = item => scene.effects.toLocal({ x: 0, y: 0 }, item)
  const sample = () => JSON.parse(JSON.stringify({ artwork: display(node('move-artwork')),
    actors: [...scene.actors.values()].map(pose), platforms: display(scene.terrain), camera: { x: scene.camera.x, y: scene.camera.y } }))
  function clean() {
    assert.equal(scene.effects.children.length, 0)
    assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
    for (const actor of scene.actors.values()) assert.deepEqual(pose(actor),
      { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, tint: 0xffffff })
    assert.equal(Texture.WHITE.destroyed, false)
  }
  return { scene, fx, audition, node, point, sample, clean, get tl() { return timelines.at(-1) },
    dispose() { audition.dispose(); fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('only the proposed Thunder Punch gains an immediate contact flash while its original art, random geometry, poses and cues stay identical', async () => {
  for (const sourceId of ['source', 'target']) for (const visualRate of [1, .9]) {
    const original = harness({ factory: createBattleFx }), proposed = harness(), records = []
    try {
      for (const [h, enhanced] of [[original, false], [proposed, true]]) {
        const cues = [], contactSamples = []
        const handle = h.audition.play(subject, { scene: h.scene, sourceId, visualRate, onMarker(marker) {
          cues.push({ id: marker.id, time: marker.authoredTimelineSeconds, elapsed: marker.elapsedSeconds })
          contactSamples.push(h.sample())
          if (enhanced) {
            const burst = h.node(label)
            assert.equal(burst.alpha, 1, 'flash is already visible inside the existing impact callback')
            assert.equal(h.node('thunder-punch-review-flash').alpha, 1)
            near(h.point(burst), h.point(h.node('thunder-punch-impact')), 'new flash meets the original front-knuckle contact')
            assert.ok(burst.getBounds().width > 120, 'clear burst across the receiver instead of a tiny knuckle glint')
          } else assert.equal(h.node(label), null)
        } })
        await tick()
        assert.equal(h.tl.duration(), 1.6)
        assert.equal(h.tl.timeScale(), visualRate)
        h.tl.time(.5199, false)
        if (enhanced) assert.equal(h.node(label).alpha, 0, 'no spark before physical contact')
        const samples = []
        for (const time of [.52, .55, .61, .72, .9, 1.3]) { h.tl.time(time, false); samples.push(h.sample()) }
        records.push({ samples, cues, contactSamples })
        assert.deepEqual(cues, [{ id: 'impact', time: .52, elapsed: .52 / visualRate }])
        if (enhanced) assert.equal(h.node(label).alpha, 0, 'the added effect has faded before recovery finishes')
        h.tl.time(1.6, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
      }
      assert.deepEqual(records[1], records[0], 'the added layer cannot rewrite any existing choreography or result timing')
    } finally { original.dispose(); proposed.dispose() }
  }
})

test('branches, flash and flying spark strokes fit both perspectives, portrait fields and short actors, following the original contact offset through recoil', async () => {
  for (const sourceId of ['source', 'target']) for (const edge of ['normal', 'side', 'top', 'portrait']) {
    const width = edge === 'portrait' ? 380 : 720, height = edge === 'portrait' ? 640 : 600
    const targetId = sourceId === 'source' ? 'target' : 'source'
    const reverse = sourceId === 'target'
    const h = harness({ scene: { width, height, actors: [
      { id: sourceId, profile: 'tall', x: reverse ? .72 : .28, y: .84, height: .3, facing: reverse ? -1 : 1,
        anchors: { fist: [.87, .44] } },
      { id: targetId, profile: 'wide', x: reverse ? (edge === 'side' ? .025 : .26) : (edge === 'side' ? .975 : .74),
        y: edge === 'top' ? .07 : .61, height: .09, facing: reverse ? 1 : -1,
        anchors: { center: edge === 'top' ? [.48, .04] : [.48, .43] } },
    ] } })
    try {
      let offset
      const target = h.scene.actor(targetId)
      const handle = h.fx.play({ moveId: 'thunder-punch', sourceId, targetIds: [targetId], visualSeed: 42 }, {
        scene: h.scene, onCue() {
          const center = target.anchor('center'), actual = h.point(h.node('thunder-punch-impact'))
          offset = { x: actual.x - center.x, y: actual.y - center.y }
          near(h.point(h.node(label)), actual, 'contact offset comes from the original fitted strike')
        },
      })
      await tick(); h.tl.time(.52, false)
      assert.ok(offset)
      for (let time = .52; time < .9; time += .013) {
        h.tl.time(time, false)
        const center = target.anchor('center'), burst = h.node(label)
        near(h.point(burst), { x: center.x + offset.x, y: center.y + offset.y }, 'flash follows the posed receiver')
        for (const graphic of burst.children) {
          if (graphic.alpha <= .001) continue
          const b = graphic.getBounds()
          assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height,
            `${sourceId}/${edge}/${time}/${graphic.label} includes every branch and stroke: ${JSON.stringify(b)}`)
        }
      }
      h.tl.time(.9, false); assert.equal(h.node(label).alpha, 0)
      for (const graphic of h.node(label).children) assert.equal(graphic.context.instructions.length, 0)
      h.tl.time(1.6, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})

test('the isolated addition cleans up on cancellation, supersession, disposal, failure, timeout and reduced motion', async () => {
  const request = { moveId: 'thunder-punch', sourceId: 'source', targetIds: ['target'], visualSeed: 42 }
  for (const exit of ['cancel-before', 'cancel-impact', 'supersede', 'dispose', 'failure', 'timeout', 'reduced', 'unsupported', 'miss']) {
    const h = harness({ fx: exit === 'timeout' ? { deadlineMs: 10 } : {} })
    try {
      const cues = []
      const handle = h.fx.play({ ...request, ...(exit === 'unsupported' ? { moveId: 'swift' } : {}), ...(exit === 'miss' ? { outcome: 'miss' } : {}) }, {
        scene: h.scene, reducedMotion: exit === 'reduced', onCue: cue => cues.push(cue.type),
      })
      await tick()
      if (['unsupported', 'miss'].includes(exit)) {
        assert.equal((await handle.finished).status, 'skipped'); h.clean(); continue
      }
      if (exit === 'timeout') { assert.equal((await handle.finished).status, 'failed'); h.clean(); continue }
      h.tl.time(exit === 'cancel-before' ? .3 : exit === 'reduced' ? .2 : .56, false)
      if (exit === 'reduced') {
        assert.equal(h.node(label), null); assert.deepEqual(cues, ['impact'])
        h.tl.time(.8, false); assert.equal((await handle.finished).status, 'completed')
      } else if (exit === 'failure') {
        h.scene.actor('target').anchor = () => { throw new Error('target view became unavailable') }
        h.tl.time(.6, false)
        assert.equal((await handle.finished).status, 'failed')
      }
      else if (exit === 'supersede') {
        const oldBurst = h.node(label), oldTimeline = h.tl
        const replacement = h.fx.play(request, { scene: h.scene })
        assert.equal((await handle.finished).status, 'cancelled'); assert.equal(oldBurst.destroyed, true)
        await tick(); h.tl.time(.57, false)
        const replacementBurst = h.node(label), before = h.sample()
        oldTimeline.vars.onUpdate(); oldTimeline.vars.onComplete()
        assert.equal(h.node(label), replacementBurst); assert.deepEqual(h.sample(), before)
        replacement.cancel(); assert.equal((await replacement.finished).status, 'cancelled')
      } else {
        if (exit === 'dispose') h.fx.dispose()
        else handle.cancel()
        assert.equal((await handle.finished).status, 'cancelled')
      }
      h.clean()
    } finally { h.dispose() }
  }
})
