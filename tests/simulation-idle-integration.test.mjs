import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { Texture } from 'pixi.js'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { playPokemonFaint } from '@battle/battle-fx/transitions'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors } from '../apps/game/src/scene/previewActors.js'
import { createSimulationScene } from '../apps/simulation/src/scene.js'
import { createIdleMotion } from '../apps/simulation/src/idle.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.abs(a - b) < .03, `${label}: ${a} vs ${b}`)
const pose = actor => ({ x: actor.pose.x, y: actor.pose.y, scaleX: actor.pose.scale.x, scaleY: actor.pose.scale.y, rotation: actor.pose.rotation })
const rest = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
function fixture() {
  const member = (memberId, species) => ({ memberId, species, active: true, fainted: false, hp: { current: 100, max: 100 } })
  return { matchId: 'idle-integration', own: { active: 'p1:1', team: [member('p1:1', 'Charizard')] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur')] } }
}
function harness() {
  const idleTimelines = []; let faintTimeline
  const coordinator = createSimulationScene({
    getHost: () => ({ appendChild() {} }), createHost: () => ({ remove() {} }),
    loadScene: async () => ({ previewSceneActors, createScene: async (host, options) => createSceneGraph(options) }),
    loadIdle: async () => ({ createIdleMotion: ({ scene }) => createIdleMotion({ scene,
      timelineEngine: { timeline(options) { const tl = gsap.timeline({ ...options, paused: true }); idleTimelines.push(tl); return tl } },
    }) }),
    loadFaint: async () => ({ playPokemonFaint: options => playPokemonFaint({ ...options,
      timelineEngine: { timeline(config) { return faintTimeline = gsap.timeline({ ...config, paused: true }) } },
    }) }),
  })
  return { coordinator, idleTimelines, get faintTimeline() { return faintTimeline } }
}

test('idle yields native geometry to either attacking side and cannot overwrite a borrowed move pose', async () => {
  for (const sourceId of ['source', 'target']) {
    const h = harness(), view = fixture(); let moveTimeline
    const fx = createBattleFx({ glowTexture: Texture.WHITE,
      timelineEngine: { timeline(options) { return moveTimeline = gsap.timeline({ ...options, paused: true }) } },
    })
    try {
      h.coordinator.setIdleMotion({ enabled: true })
      await h.coordinator.ensure(view); await tick()
      const scene = h.coordinator.get(), platforms = scene.terrain.children.map(node => ({ ...node.getBounds() }))
      const idle = h.idleTimelines.at(-1); assert.ok(idle)
      idle.totalTime(1.7, false)
      assert.notDeepEqual(pose(scene.actor('source')), rest)
      h.coordinator.setIdleMotion({ paused: true })
      for (const actor of scene.actors.values()) assert.deepEqual(pose(actor), rest)
      const targetId = sourceId === 'source' ? 'target' : 'source', contacts = []
      const run = fx.play({ moveId: 'tackle', sourceId, targetIds: [targetId], visualSeed: 42 }, { scene, onCue() {
        const tip = scene.actor(sourceId).anchor('tackle'), target = scene.actor(targetId).anchor('center')
        close(tip.x, target.x, 'Tackle contact x after idle'); close(tip.y, target.y, 'Tackle contact y after idle'); contacts.push(tip)
      } })
      await tick(); moveTimeline.time(.25, false)
      const borrowed = pose(scene.actor(sourceId))
      h.coordinator.setIdleMotion({ paused: true }); h.coordinator.display(view)
      idle.totalTime(4.3, false)
      assert.deepEqual(pose(scene.actor(sourceId)), borrowed, 'repeated pauses and stale idle callbacks leave the attack alone')
      moveTimeline.time(EFFECT_TIMINGS.tackle.contact, false)
      moveTimeline.time(EFFECT_TIMINGS.tackle.duration, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal(contacts.length, 1)
      h.coordinator.setIdleMotion({ paused: false }); await tick()
      h.idleTimelines.at(-1).totalTime(1.7, false)
      assert.notDeepEqual(pose(scene.actor('source')), rest)
      h.coordinator.setIdleMotion({ reducedMotion: true })
      for (const actor of scene.actors.values()) assert.deepEqual(pose(actor), rest)
      assert.deepEqual(scene.terrain.children.map(node => ({ ...node.getBounds() })), platforms)
    } finally { fx.dispose(); h.coordinator.destroy() }
  }
})

test('a faint automatically takes ownership from idle and only the surviving actor resumes afterwards', async () => {
  const h = harness(), before = fixture(), after = structuredClone(before)
  after.opponent.known[0].hp.current = 0; after.opponent.known[0].fainted = true
  try {
    h.coordinator.setIdleMotion({ enabled: true })
    await h.coordinator.ensure(before); await tick()
    const scene = h.coordinator.get(), idle = h.idleTimelines.at(-1)
    idle.totalTime(1.7, false)
    h.coordinator.display(after, { retainFaintedActorIds: ['target'] })
    const done = h.coordinator.faint(after, { actorIds: ['target'] })
    await tick(); assert.ok(h.faintTimeline)
    h.faintTimeline.time(.44, false)
    const during = pose(scene.actor('target'))
    idle.totalTime(4.3, false)
    assert.deepEqual(pose(scene.actor('target')), during)
    assert.equal(scene.actor('target').pose.alpha, 0, 'idle cannot restore a masked-out fainting sprite')
    h.faintTimeline.time(.9, false); assert.equal((await done).status, 'completed'); await tick()
    h.idleTimelines.at(-1).totalTime(1.7, false)
    assert.equal(scene.actor('target').root.visible, false)
    assert.deepEqual(pose(scene.actor('target')), rest)
    assert.notDeepEqual(pose(scene.actor('source')), rest)
    assert.equal(scene.effects.children.length, 0)
  } finally { h.coordinator.destroy(); gsap.ticker.sleep() }
})
