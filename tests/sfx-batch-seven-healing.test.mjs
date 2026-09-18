import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS, EFFECT_TIMINGS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import morningSun, { timing as sunTiming } from '../packages/battle-fx/src/review-batch-seven/morning-sun.js'
import moonlight, { timing as moonTiming } from '../packages/battle-fx/src/review-batch-seven/moonlight.js'
import originalSun from '../packages/battle-fx/src/moves/restored/morning-sun.js'
import originalMoon from '../packages/battle-fx/src/moves/restored/moonlight.js'

const moves = [
  { id: 'morning-sun', build: morningSun, original: originalSun, timing: sunTiming, opening: 'morning-sun-dawn', heal: 148595 / 44100, crest: 3.49, end: 4.57, glints: 15 },
  { id: 'moonlight', build: moonlight, original: originalMoon, timing: moonTiming, opening: 'moonlight-curtain', heal: 193089 / 44100, crest: 4.53, end: 5.57, glints: 14 },
]
const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .005, `${label}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
const drawing = g => JSON.stringify(g.context.instructions.map(instruction => ({ action: instruction.action, path: instruction.data.path?.instructions,
  style: Object.fromEntries(Object.entries(instruction.data.style ?? {}).filter(([, value]) => value === null || ['number', 'string', 'boolean'].includes(typeof value))) })))
const capture = node => ({ label: node.label, x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha,
  scale: { x: node.scale.x, y: node.scale.y }, instructions: node.context ? drawing(node) : null, children: node.children.map(capture) })
function harness(move, sourceId = 'source', layout = -1, original = false, alone = false) {
  let timeline
  const actors = [
    { id: 'source', profile: layout === 1 ? 'tall' : 'wide', x: .29, y: layout === 1 ? .31 : .82, height: layout === 4 ? .2 : .3, facing: 1, anchors: { aura: [.52, .42] } },
    { id: 'target', profile: 'tall', x: layout === 2 || layout === 3 ? .945 : .74, y: layout === 3 ? .3 : .62, height: layout === 3 ? .3 : .18, facing: -1, anchors: { aura: layout === 3 ? [.5, .04] : [.48, .44] } },
  ]
  const scene = createSceneGraph(layout === -1 && !alone ? undefined : { width: layout === 4 ? 560 : 720, height: layout === 4 ? 700 : 600,
    actors: alone ? actors.filter(actor => actor.id === sourceId) : actors })
  const build = original ? context => { move.original(context); context.tl.call(() => {}, [], move.end) } : move.build
  const fx = createBattleFx({ effects: { [move.id]: { ...MOVE_EFFECTS[move.id], build, contact: move.timing.contact, duration: move.timing.duration } },
    glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, sourceId, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true),
    point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    run(options = {}) { return fx.play({ moveId: move.id, sourceId, targetIds: [], visualSeed: 42 }, { scene, ...options }) },
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
}

test('weather healing tails retain complete native sources with verified suffix mapping and no production timing change', async () => {
  const evidence = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-007.healing-measurements.json', import.meta.url)))
  for (const move of moves) {
    assert.deepEqual(EFFECT_TIMINGS[move.id], { contact: 1.15, duration: 2.5 })
    assert.equal(MOVE_EFFECTS[move.id].subject, 'source')
    assert.equal(move.timing.contact, 1.15); assert.equal(move.timing.duration, move.end)
    assert.equal(move.timing.markers.find(m => m.id === 'heal').timeSeconds, move.heal)
    assert.equal(move.timing.markers.find(m => m.id === 'heal-crest').timeSeconds, move.crest)
    const row = evidence.moves.find(row => row.moveId === move.id)
    assert.ok(row.suffixAlignment.leftCorrelation > .99 && row.suffixAlignment.rightCorrelation > .99)
    assert.equal(row.suffixAlignment.part2StartInFullFrame, row.referenceParts[0].sampleFrames)
    assert.equal(row.suffixAlignment.part2StartInFullSeconds, move.heal)
    assert.equal(row.playback.healingCrestSeconds, move.crest)
    assert.equal(row.playback.audioStartSeconds, 0); assert.equal(row.playback.playbackRate, 1); assert.equal(row.playback.gainDb, 0)
    assert.equal(row.playback.sourceStartFrame, 0); assert.equal(row.playback.sourceEndFrameExclusive, row.source.sampleFrames)
    assert.ok(move.end >= row.source.sampleFrames / row.source.sampleRate)
    for (const source of [row.source, ...row.referenceParts]) {
      const bytes = await readFile(new URL(`../${source.path}`, import.meta.url))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256)
    }
    const source = await readFile(new URL(`../packages/battle-fx/src/review-batch-seven/${move.id}.js`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(?:battle-core|battle-sfx|apps\/|vue|pokemon-sprites)/)
  }
})

test('original sun and moon openings are exact while their authored movement continues through the extended hold', async () => {
  for (const move of moves) for (const sourceId of ['source', 'target']) {
    const h = harness(move, sourceId), old = harness(move, sourceId, -1, true)
    try {
      h.run(); old.run(); await tick()
      for (const time of [.09, .34, .76, 1.15, 1.79]) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.deepEqual(capture(h.node(move.opening)), capture(old.node(move.opening)), `${move.id} opening at ${time}`)
        assert.equal(h.node(`${move.id}-healing`).alpha, 0)
      }
      for (const time of [2.8, move.heal - .04]) {
        h.tl.time(time, false); old.tl.time(time, false)
        assert.equal(h.node(move.opening).alpha, 1, 'original light remains present for complete first sound section')
        assert.deepEqual(h.node(move.opening).children.map(capture), old.node(move.opening).children.map(capture), 'original shapes and particle motion are unaltered')
      }
      const particle = h.node(move.opening).children.at(-1), point = h.point(particle)
      h.tl.time(move.heal + .02, false)
      assert.ok(Math.hypot(point.x - h.point(particle).x, point.y - h.point(particle).y) > .1, 'opening particles remain in motion at transition')
    } finally { old.dispose(); h.dispose() }
  }
})

test('healing finishes follow the source in either position without an opponent and emit only the original impact cue', async () => {
  for (const move of moves) for (const sourceId of ['source', 'target']) {
    const h = harness(move, sourceId, 0, false, true), cues = [], source = h.scene.actor(sourceId)
    try {
      const run = h.run({ onCue(cue) {
        cues.push([cue.type, h.tl.time()]); close(h.point(h.node(move.opening)), source.anchor('aura'), 'opening root before result cue')
      } }); await tick()
      h.tl.time(1.1499, false); assert.deepEqual(cues, [])
      h.tl.time(1.15, false); assert.deepEqual(cues, [['impact', 1.15]])
      h.tl.time(move.heal - .001, false); assert.equal(h.node(`${move.id}-healing`).alpha, 0)
      h.tl.time(move.crest, false)
      const healing = h.node(`${move.id}-healing`)
      assert.ok(healing.alpha > .98); close(h.point(healing), source.anchor('aura'), 'healing follows source aura')
      const sparkle = h.node(`${move.id}-healing-glint-3`), point = h.point(sparkle), core = h.node(`${move.id}-healing-core`)
      const bright = drawing(core)
      h.tl.time(move.crest + .1, false)
      assert.notEqual(drawing(core), bright, 'aura glow responds to measured healing crest')
      assert.ok(Math.hypot(point.x - h.point(sparkle).x, point.y - h.point(sparkle).y) > 1, 'sparkles rise during healing')
      source.pose.x += 4; source.pose.y -= 3; h.tl.time(move.crest + .14, false)
      close(h.point(healing), source.anchor('aura'), 'healing follows a live custom socket')
      h.tl.time(move.end - .18, false); const late = h.point(sparkle)
      assert.ok(healing.alpha > .5)
      h.tl.time(move.end - .035, false)
      assert.ok(healing.alpha > .05, 'healing remains visible through the full recording tail')
      assert.ok(Math.hypot(late.x - h.point(sparkle).x, late.y - h.point(sparkle).y) > 1, 'healing continues moving through fade')
      h.tl.time(move.end, false); assert.equal((await run.finished).status, 'completed'); clean(h)
      assert.deepEqual(cues, [['impact', 1.15]], 'cosmetic healing finish emits no second result')
    } finally { h.dispose() }
  }
})

test('complete sun, moon, healing art and actors fit both directions in wide, edge and portrait fields', async () => {
  for (const move of moves) for (const sourceId of ['source', 'target']) for (const layout of [-1, 0, 1, 2, 3, 4]) {
    const h = harness(move, sourceId, layout)
    try {
      const run = h.run(); await tick(); let seen = 0
      for (let time = .035; time < move.end - .01; time += .043) {
        h.tl.time(time, false)
        for (const actor of h.scene.actors.values()) {
          const p = actor.anchor('visualCenter'), rx = actor.metrics.width / 2, ry = actor.metrics.height / 2
          assert.ok(p.x - rx >= -.05 && p.x + rx <= h.scene.width + .05 && p.y - ry >= -.05 && p.y + ry <= h.scene.height + .05, 'full actor bounds')
          assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
        }
        const walk = (node, parentAlpha = 1) => {
          const alpha = parentAlpha * node.alpha
          if (alpha > .01 && node.constructor.name === 'Graphics') {
            seen++; const b = node.getBounds()
            assert.ok(b.x >= -.05 && b.y >= -.05 && b.x + b.width <= h.scene.width + .05 && b.y + b.height <= h.scene.height + .05,
              `${move.id}/${node.label} layout=${layout} source=${sourceId} t=${time}: ${JSON.stringify(b)}`)
          }
          for (const child of node.children ?? []) walk(child, alpha)
        }; walk(h.scene.effects)
      }
      assert.ok(seen > 500); h.tl.time(move.end, false); assert.equal((await run.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})

test('healing pair cancellation, replacement and reduced motion restore all owned effects and source poses', async () => {
  for (const move of moves) for (const sourceId of ['source', 'target']) {
    const h = harness(move, sourceId, 0, false, true)
    try {
      for (const time of [.4, 1.4, 2.7, move.heal + .3, move.end - .08]) {
        const run = h.run(); await tick(); h.tl.time(time, false); run.cancel()
        assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const old = h.run(); await tick(); h.tl.time(move.crest, false)
      const replacement = h.run({ reducedMotion: true }); assert.equal((await old.finished).status, 'cancelled'); await tick(); old.cancel()
      assert.equal(h.node(`${move.id}-healing`), null)
      h.tl.time(.8, false); assert.equal((await replacement.finished).status, 'completed'); clean(h)
    } finally { h.dispose() }
  }
})
