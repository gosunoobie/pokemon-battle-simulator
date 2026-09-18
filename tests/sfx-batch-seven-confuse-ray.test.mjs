import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { MOVE_EFFECTS } from '../packages/battle-fx/src/registry.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import confuseRay, { timing } from '../packages/battle-fx/src/review-batch-seven/confuse-ray.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, label) => assert.ok(Math.abs(a - b) < .02, `${label}: ${a}/${b}`)
const pointClose = (a, b, label) => { close(a.x, b.x, `${label} x`); close(a.y, b.y, `${label} y`) }
const layouts = [undefined,
  { width: 620, height: 650, actors: [{ id: 'source', profile: 'wide', x: .29, y: .78, height: .2, facing: 1 }, { id: 'target', profile: 'tall', x: .8, y: .44, height: .2, facing: -1 }] },
  { width: 720, height: 600, actors: [{ id: 'source', profile: 'wide', x: .22, y: .8, height: .22, facing: 1, anchors: { eyes: [.8, .2], head: [.5, .1] } }, { id: 'target', profile: 'tall', x: .94, y: .42, height: .2, facing: -1, anchors: { head: [.5, .1] } }] },
  { width: 560, height: 700, actors: [{ id: 'source', profile: 'wide', x: .27, y: .8, height: .2, facing: 1 }, { id: 'target', profile: 'tall', x: .85, y: .24, height: .2, facing: -1 }] },
]
function harness(side = 'source', layout = 0, original = false) {
  let timeline
  const scene = createSceneGraph(layouts[layout]), targetId = side === 'source' ? 'target' : 'source'
  const fx = createBattleFx({ effects: { 'confuse-ray': original ? MOVE_EFFECTS['confuse-ray'] : { ...MOVE_EFFECTS['confuse-ray'], build: confuseRay, ...timing } }, glowTexture: Texture.WHITE,
    timelineEngine: { timeline(options) { timeline = gsap.timeline({ ...options, paused: true }); timeline.play = () => timeline; return timeline } } })
  return { scene, source: scene.actor(side), target: scene.actor(targetId), get tl() { return timeline },
    node: label => scene.effects.getChildByLabel(label, true), point: node => scene.effects.toLocal({ x: 0, y: 0 }, node),
    play: options => fx.play({ moveId: 'confuse-ray', sourceId: side, targetIds: [targetId], visualSeed: 42 }, { scene, ...options }),
    clean() {
      assert.equal(scene.effects.children.length, 0); assert.equal(scene.camera.x, 0); assert.equal(scene.camera.y, 0)
      for (const actor of scene.actors.values()) {
        assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
        assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.tint, 0xffffff)
      }
    },
    dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() },
  }
}
function snapshot(node) {
  return { x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha, scale: { x: node.scale.x, y: node.scale.y },
    drawing: node.context ? JSON.stringify(node.context.instructions.map(instruction => instruction.data.path?.instructions)) : null,
    children: (node.children ?? []).map(snapshot) }
}
function bounds(h, time) {
  function walk(node, alpha = 1) {
    if (!node.visible) return
    alpha *= node.alpha
    if (alpha > .025 && ['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const b = node.getBounds()
      assert.ok(b.x >= -.05 && b.y >= -.05 && b.maxX <= h.scene.width + .05 && b.maxY <= h.scene.height + .05, `${node.label || node.parent?.label} at ${time}: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) walk(child, alpha)
  }
  walk(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    const center = actor.anchor('visualCenter'), c = Math.abs(Math.cos(actor.pose.rotation)), s = Math.abs(Math.sin(actor.pose.rotation))
    const rx = (actor.metrics.width * c + actor.metrics.height * s) / 2, ry = (actor.metrics.height * c + actor.metrics.width * s) / 2
    assert.ok(center.x - rx >= -.05 && center.x + rx <= h.scene.width + .05 && center.y - ry >= -.05 && center.y + ry <= h.scene.height + .05, `actor ${actor.id} at ${time}`)
  }
}

test('duck timing follows independently measured tail accents while retaining the complete recording and original result cue', async () => {
  const evidence = JSON.parse(await readFile(new URL('../tools/audio-import/review/sync-batch-007.confusion-measurements.json', import.meta.url)))
  const bytes = await readFile(new URL(`../${evidence.provenance.referenceReport}`, import.meta.url)), report = JSON.parse(bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.provenance.referenceReportSha256)
  for (const identity of [evidence.source, ...evidence.parts]) {
    const source = report.measurements.find(row => row.assetId === identity.assetId)
    for (const [key, value] of Object.entries(identity)) assert.equal(source[key], value)
  }
  const full = report.measurements.find(row => row.assetId === 'source.confuse-ray'), part2 = report.measurements.find(row => row.assetId === 'source.confuse-ray-part-2')
  assert.equal(evidence.parts[0].sampleFrames, 79821); assert.equal(evidence.parts[1].sampleFrames, 60417)
  assert.equal(evidence.parts[0].sampleFrames + evidence.parts[1].sampleFrames, full.sampleFrames)
  assert.equal(timing.contact, .98); assert.equal(timing.duration, full.durationSeconds); assert.equal(timing.duration, 3.18)
  assert.deepEqual(evidence.playback, { sourceStartSeconds: 0, sourceEndSeconds: null, soundDelaySeconds: 0, playbackRate: 1, gainDb: 0, contactSeconds: .98, ducksStartSeconds: 1.81, ducksFullSeconds: 1.92, ducksEndSeconds: 3.18 })
  for (const [i, match] of evidence.computedAlignment.matchedRises.entries()) {
    assert.equal(match.part2StartFrame + 79821, match.fullStartFrame)
    assert.ok(full.positiveEnergyRises.some(row => row.startFrame === match.fullStartFrame))
    assert.ok(part2.positiveEnergyRises.some(row => row.startFrame === match.part2StartFrame))
    assert.ok(match.rmsDifferenceDb < .03)
    assert.equal(timing.markers.find(marker => marker.id === `duck-bob-${i + 1}`).timeSeconds, match.fullStartFrame / 44100)
  }
  assert.match(evidence.interpretation.semantic, /user explicitly requested/)
})

test('the independently preserved ray, live attachment, opening spiral and original contact remain unchanged', async () => {
  for (const side of ['source', 'target']) {
    const h = harness(side), old = harness(side, 0, true)
    try {
      const run = h.play(), previous = old.play(); await tick()
      for (const time of [.15, .3, .55, .8, .98, 1.2, 1.55, 1.8, 2.05]) {
        h.tl.time(time, false); old.tl.time(time, false)
        for (const label of ['confuse-ray-source', 'confuse-ray-ribbon', 'confuse-ray-head', 'confuse-ray-halo']) assert.deepEqual(snapshot(h.node(label)), snapshot(old.node(label)), `${label}/${side}/${time}`)
        pointClose(h.source.pose, old.source.pose, 'source choreography')
      }
      run.cancel(); previous.cancel(); await Promise.all([run.finished, previous.finished]); h.clean(); old.clean()
      let contact; const cues = []
      const live = h.play({ onCue(cue) { cues.push(cue.type); contact = { head: h.point(h.node('confuse-ray-head')), target: h.target.anchor('center'), from: h.point(h.node('confuse-ray-source')), eyes: h.source.anchor(h.source.hasAnchor('eyes') ? 'eyes' : 'emission') } } }); await tick()
      h.tl.time(.93, false); h.target.pose.x += 8; h.target.pose.y -= 6
      h.tl.time(.98, false); assert.deepEqual(cues, ['impact']); pointClose(contact.head, contact.target, 'ray arrives before its cue'); pointClose(contact.from, contact.eyes, 'source attached to live eye/emission socket')
      h.tl.time(3.18, false); assert.equal((await live.finished).status, 'completed'); assert.deepEqual(cues, ['impact']); h.clean()
    } finally { h.dispose(); old.dispose() }
  }
})

test('three actual yellow ducks orbit evenly above the live head with readable faces, sound-accent bobs and moving fade', async () => {
  for (const side of ['source', 'target']) {
    const h = harness(side)
    try {
      const run = h.play(); await tick(); h.tl.time(1.8, false); assert.equal(h.node('confuse-ray-ducks').alpha, 0)
      h.tl.time(1.86, false); assert.ok(h.node('confuse-ray-ducks').alpha > .4); assert.ok(h.node('confuse-ray-halo').alpha > 0)
      h.tl.time(1.92, false); close(h.node('confuse-ray-ducks').alpha, 1, 'ducks fully readable on first tail accent')
      const ducks = h.node('confuse-ray-ducks'), orbit = h.node('confuse-ray-duck-orbit').getLocalBounds(), rx = (orbit.width - 1.1) / 2, ry = (orbit.height - 1.1) / 2
      const angles = []
      for (let i = 0; i < 3; i++) {
        const bird = h.node(`confuse-ray-duck-${i}`), art = h.node(`confuse-ray-duck-art-${i}`)
        assert.ok(h.node(`confuse-ray-duck-body-${i}`)); assert.ok(h.node(`confuse-ray-duck-bill-${i}`)); assert.ok(h.node(`confuse-ray-duck-wing-${i}`)); assert.ok(h.node(`confuse-ray-duck-eye-${i}`))
        assert.equal(art.children.length, 4, 'each duck has separate readable body/head, bill, wing and eye artwork')
        const left = h.scene.effects.toLocal({ x: 0, y: 0 }, art), bill = h.scene.effects.toLocal({ x: 12, y: -1 }, art), up = h.scene.effects.toLocal({ x: 0, y: -7 }, art)
        assert.ok(bill.x > left.x, 'face stays readable in screen direction from either side'); assert.ok(up.y < left.y, 'head never flips downward')
        angles.push((Math.atan2(bird.y / ry, bird.x / rx) + Math.PI * 2) % (Math.PI * 2))
      }
      assert.equal(h.node('confuse-ray-duck-3'), null)
      angles.sort((a, b) => a - b)
      for (let i = 0; i < 3; i++) close((angles[(i + 1) % 3] - angles[i] + Math.PI * 2) % (Math.PI * 2), Math.PI * 2 / 3, 'even angular spacing')
      const ordered = ducks.children.filter(node => node.label.startsWith('confuse-ray-duck-') && /^confuse-ray-duck-\d$/.test(node.label)).map(node => node.zIndex)
      assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b))
      for (const [i, time] of [1.92, 2.17, 2.29, 2.41, 2.66].entries()) { h.tl.time(time, false); assert.ok(h.node(`confuse-ray-duck-art-${i % 3}`).y < -3.45, 'duck bobs at its measured accent') }
      const before = h.point(ducks); h.target.pose.x += 5; h.target.pose.y -= 4
      h.tl.time(2.7, false); pointClose(h.point(ducks), { x: before.x + 5, y: before.y - 4 }, 'orbit follows live opponent head')
      h.tl.time(3.04, false); const position = h.point(h.node('confuse-ray-duck-0')), opacity = ducks.alpha
      h.tl.time(3.12, false); assert.ok(ducks.alpha > .25 && ducks.alpha < opacity)
      assert.ok(Math.hypot(h.point(h.node('confuse-ray-duck-0')).x - position.x, h.point(h.node('confuse-ray-duck-0')).y - position.y) > 4, 'circling continues through the sound-tail fade')
      h.tl.time(3.18, false); assert.equal((await run.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})

test('all art and actors remain bounded across both perspectives, with full cleanup after every phase and reduced motion', async () => {
  for (const side of ['source', 'target']) for (const layout of [0, 1, 2, 3]) {
    const h = harness(side, layout)
    try {
      const run = h.play(); await tick()
      for (let time = .017; time < timing.duration; time += .037) { h.tl.time(time, false); bounds(h, time) }
      h.tl.time(timing.duration, false); assert.equal((await run.finished).status, 'completed'); h.clean()
      for (const time of [.4, 1.03, 1.86, 2.4, 3.12]) {
        const cancelled = h.play(); await tick(); h.tl.time(time, false); cancelled.cancel(); assert.equal((await cancelled.finished).status, 'cancelled'); h.clean()
      }
      const reduced = h.play({ reducedMotion: true }); await tick(); h.tl.time(h.tl.duration(), false); assert.equal((await reduced.finished).status, 'completed'); h.clean()
    } finally { h.dispose() }
  }
})
