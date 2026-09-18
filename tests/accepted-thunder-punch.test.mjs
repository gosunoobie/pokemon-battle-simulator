import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createAcceptedBattleFx } from '@battle/battle-fx/accepted-effects'
import { createReviewedBattleFx } from '../apps/shared/battle/reviewedFx.js'
import { createThunderPunchImpactFx } from '../apps/sfx-bench/src/thunderPunchImpact.js'
import { createClockedBattleFx } from '@battle/battle-fx/presentation-clock'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const request = sourceId => ({ moveId: 'thunder-punch', sourceId, targetIds: [sourceId === 'source' ? 'target' : 'source'], visualSeed: 42 })
function display(node) {
  return { label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha,
    sx: node.scale.x, sy: node.scale.y, tint: node.tint,
    graphics: node.context?.instructions.map(({ action, data }) => {
      const { texture, ...style } = data.style
      return { action, style, path: data.path.instructions }
    }), children: node.children?.map(display) }
}
function harness(factory) {
  const scene = createSceneGraph(), timelines = []
  const options = { glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(vars) {
      const timeline = gsap.timeline({ ...vars, paused: true }); timeline.play = () => timeline
      timelines.push(timeline); return timeline
    } } }
  const fx = factory(options)
  const sample = () => JSON.parse(JSON.stringify({ effects: display(scene.effects),
    actors: [...scene.actors.values()].map(actor => display(actor.pose)), terrain: display(scene.terrain) }))
  function clean() {
    assert.equal(scene.effects.children.length, 0)
    for (const actor of scene.actors.values()) {
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
      assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    }
  }
  return { scene, fx, sample, clean, get timeline() { return timelines.at(-1) },
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}

test('the published impact builder is identical to the reviewed artwork and remains renderer-only', async () => {
  const bench = await readFile(new URL('../apps/sfx-bench/src/thunderPunchImpact.js', import.meta.url), 'utf8')
  const runtime = await readFile(new URL('../packages/battle-fx/src/accepted-effects.js', import.meta.url), 'utf8')
  const builder = source => source.slice(source.indexOf('function buildImpactProposal(context)'), source.indexOf('\n}\n', source.indexOf('function buildImpactProposal(context)')) + 3)
  assert.ok(builder(bench).length > 3000)
  assert.equal(builder(runtime), builder(bench))
  assert.doesNotMatch(runtime, /from ['"][^'"]*(?:apps\/|battle-core|battle-sfx|vue|pokemon-sprites)/)
})

test('host playback exactly matches the approved audition from both perspectives without any sound observer', async () => {
  for (const sourceId of ['source', 'target']) {
    const approved = harness(options => createClockedBattleFx({ ...options, createFx: createThunderPunchImpactFx }))
    const actual = harness(createReviewedBattleFx), recordings = []
    try {
      for (const [h, audition] of [[approved, true], [actual, false]]) {
        const cues = [], frames = []
        const handle = h.fx.play(request(sourceId), { scene: h.scene, ...(audition ? { visualRate: .9 } : {}), onCue(cue) {
          cues.push({ type: cue.type, time: h.timeline.time() })
          assert.equal(h.scene.effects.getChildByLabel('thunder-punch-review-impact', true).alpha, 1)
          frames.push(h.sample())
        } })
        await tick(); assert.equal(h.timeline.timeScale(), .9)
        for (const time of [.2, .5199, .52, .56, .64, .79, .9, 1.3]) { h.timeline.time(time, false); frames.push(h.sample()) }
        assert.deepEqual(cues, [{ type: 'impact', time: .52 }])
        recordings.push(frames)
        h.timeline.time(1.6, false); assert.equal((await handle.finished).status, 'completed'); h.clean()
      }
      assert.deepEqual(recordings[1], recordings[0])
    } finally { approved.dispose(); actual.dispose() }
  }
})

test('accepted runtime preserves the full registry, custom registries, reduced motion and cancellation ownership', async () => {
  const h = harness(createReviewedBattleFx)
  try {
    const first = h.fx.play(request('source'), { scene: h.scene }); await tick(); h.timeline.time(.52, false)
    assert.equal(h.scene.effects.getChildByLabel('thunder-punch-review-impact', true).alpha, 1)
    const replacement = h.fx.play({ moveId: 'swift', sourceId: 'target', targetIds: ['source'] }, { scene: h.scene })
    assert.equal((await first.finished).status, 'cancelled'); await tick(); first.cancel()
    assert.equal(h.scene.effects.getChildByLabel('thunder-punch-review-impact', true), null)
    h.timeline.time(2.05, false); assert.equal((await replacement.finished).status, 'completed'); h.clean()
    for (const patch of [{ outcome: 'miss' }, { phase: 'prepare' }]) {
      const skipped = h.fx.play({ ...request('source'), ...patch }, { scene: h.scene })
      assert.equal((await skipped.finished).status, 'skipped'); h.clean()
    }
    const reduced = h.fx.play(request('target'), { scene: h.scene, reducedMotion: true }); await tick()
    assert.equal(h.timeline.timeScale(), 1)
    assert.equal(h.scene.effects.getChildByLabel('thunder-punch-review-impact', true), null)
    h.timeline.time(.8, false); assert.equal((await reduced.finished).status, 'completed'); h.clean()
  } finally { h.dispose() }
  const custom = harness(options => createAcceptedBattleFx({ ...options, effects: {} }))
  try { assert.equal((await custom.fx.play(request('source'), { scene: custom.scene }).finished).status, 'skipped'); custom.clean() }
  finally { custom.dispose() }
})
