import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { ColorMatrixFilter, NoiseFilter, Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { loadMoveAssets } from '../packages/battle-fx/src/assets.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const close = (a, b, message, tolerance = .0001) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`)
const moves = ['surf', 'muddy-water']
function harness(reverse = false, portrait = false, custom = false) {
  let timeline
  const art = new Texture({ source: new TextureSource({ width: 1774, height: 887 }) }), calls = []
  const scene = createSceneGraph({ width: portrait ? 560 : 1000, height: portrait ? 700 : 450, actors: [
    { id: 'source', profile: 'tall', x: reverse ? .74 : .26, y: reverse ? .57 : .84, height: portrait ? .21 : .36, facing: reverse ? -1 : 1,
      ...(custom ? { anchors: { origin: [.44, .94], emission: [.68, .22], floor: [.44, .98] } } : {}) },
    { id: 'target', profile: 'wide', x: reverse ? .26 : .74, y: reverse ? .84 : .57, height: portrait ? .19 : .31, facing: reverse ? 1 : -1,
      ...(custom ? { anchors: { origin: [.57, .93], center: [.38, .36], floor: [.57, .96] } } : {}) },
  ] })
  const fx = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: (key, url) => { calls.push({ key, url }); return art },
    timelineEngine: { timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) } } })
  return { scene, fx, art, calls, get tl() { return timeline }, node: name => scene.effects.getChildByLabel(name, true),
    dispose() { fx.dispose(); scene.dispose(); art.destroy(true) } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0); assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1); assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.tint, 0xffffff)
  }
  assert.notEqual(h.art.destroyed, true); assert.notEqual(h.art.source.destroyed, true)
}
async function play(h, id, options = {}) {
  const run = h.fx.play({ moveId: id, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }, { scene: h.scene, ...options })
  await tick(); assert.ok(h.tl, id + ' timeline created'); return run
}
async function complete(h, run, duration = 3.2) {
  h.tl.time(duration, false); const result = await run.finished
  assert.equal(result.status, 'completed', result.reason); clean(h)
}
function lip(h, id) {
  const crest = h.node(id + '-leading')
  return h.scene.effects.toLocal({ x: -.045 * h.art.width, y: -.44 * h.art.height }, crest)
}
function geometry(h, id) {
  const out = []
  function walk(node, alpha = 1) {
    const visible = alpha * node.alpha
    if (['Graphics', 'Sprite'].includes(node.constructor.name)) {
      const bounds = node.getBounds()
      out.push({ kind: node.constructor.name, label: node.label?.replace(id, 'wave'), x: node.x, y: node.y,
        sx: node.scale.x, sy: node.scale.y, rotation: node.rotation, alpha: visible,
        bounds: [bounds.x, bounds.y, bounds.width, bounds.height] })
    }
    for (const child of node.children ?? []) walk(child, visible)
  }
  walk(h.scene.effects)
  for (const a of h.scene.actors.values()) out.push({ actor: a.id, x: a.pose.x, y: a.pose.y, rotation: a.pose.rotation, sx: a.pose.scale.x, sy: a.pose.scale.y, alpha: a.pose.alpha })
  out.push({ camera: true, x: h.scene.camera.x, y: h.scene.camera.y })
  return out
}

test('only the two crests shrink by exactly 12 percent; wash, spray and glow retain their dimensions', async () => {
  for (const id of moves) for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      const run = await play(h, id), leading = h.node(id + '-leading'), following = h.node(id + '-following'), wash = h.node(id + '-wash')
      assert.deepEqual(EFFECT_TIMINGS[id], { contact: 1, duration: 3.2 })
      close(leading.width, 720 * .6 * .88, id + ' leading width'); close(leading.height, 240 * .6 * .88, id + ' initial leading height')
      close(following.width, 560 * .6 * .88, id + ' following width'); close(following.height, 180 * .6 * .88, id + ' initial following height')
      close(wash.scale.x, .6, id + ' retained wash X scale'); close(wash.scale.y, .6, id + ' retained wash Y scale')
      const glow = h.node(id + '-impact-glow'); close(glow.width, 330, id + ' original glow width'); close(glow.height, 240, id + ' original glow height')
      const foam = wash.parent.children.filter(n => n.label?.startsWith(id + '-foam-')); assert.equal(foam.length, 68)
      for (const g of foam) {
        close(g.scale.x, .6, id + ' original foam scale'); close(g.scale.y, .6, id + ' original foam scale')
        const i = Number(g.label.split('-').at(-1)), size = 3 + i % 3 * 3
        close(g.width, size * 2 * .6, id + ' original foam width'); close(g.height, size * (i % 2 === 0 ? 2 : 1) * .6, id + ' original foam height')
      }
      h.tl.time(.87, false); close(leading.height, 360 * .528, id + ' leading peak'); close(following.height, 280 * .528, id + ' following peak')
      await complete(h, run)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('wash and crests start sooner, the real foam lip contacts at one second, and both exit stages follow the tighter schedule', async () => {
  for (const id of moves) for (const reverse of [false, true]) for (const portrait of [false, true]) {
    const h = harness(reverse, portrait, true), cues = []
    try {
      const run = await play(h, id, { onCue: cue => {
        const p = lip(h, id), target = h.scene.actor('target').anchor('center'), unit = Math.abs(h.node('move-artwork').scale.y)
        close(p.x, target.x, id + ' foam lip X before cue', .03); close(p.y, target.y, id + ' foam lip Y before cue', .3 * unit)
        cues.push(cue.type)
      } }), leading = h.node(id + '-leading'), following = h.node(id + '-following'), wash = h.node(id + '-wash')
      h.tl.time(.159, false); assert.equal(wash.alpha, 0)
      h.tl.time(.17, false); assert.ok(wash.alpha > 0); assert.equal(leading.alpha, 0)
      h.tl.time(.199, false); assert.equal(leading.alpha, 0)
      h.tl.time(.21, false); assert.ok(leading.alpha > 0); assert.equal(following.alpha, 0)
      h.tl.time(.319, false); assert.equal(following.alpha, 0)
      h.tl.time(.33, false); assert.ok(following.alpha > 0)
      h.tl.time(.999, false); assert.deepEqual(cues, [])
      h.tl.time(1, false); assert.deepEqual(cues, ['impact']); const hitX = leading.x
      h.tl.time(1.01, false); assert.ok(leading.x > hitX, id + ' leading leaves immediately after contact')
      h.tl.time(1.32, false)
      const targetLocal = h.node('move-artwork').toLocal(h.scene.actor('target').base('center'), h.scene.effects)
      close(following.x, targetLocal.x + 40, id + ' following finishes approach at 1.32')
      h.tl.time(1.88, false); close(leading.x, targetLocal.x + 500, id + ' leading exit end')
      h.tl.time(2.04, false); close(following.x, targetLocal.x + 460, id + ' following exit end')
      h.tl.time(2.06, false); close(leading.height, 110 * .528, id + ' leading collapse')
      h.tl.time(2.13, false); close(following.height, 70 * .528, id + ' following collapse')
      h.tl.time(2.36, false); assert.equal(leading.alpha, 0)
      h.tl.time(2.43, false); assert.equal(following.alpha, 0); assert.ok(wash.alpha > 0)
      h.tl.time(2.85, false); assert.equal(wash.alpha, 0)
      await complete(h, run); assert.deepEqual(cues, ['impact'])
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('three retained foam bursts and the impact glow follow the new schedule, with foam falling through its fade', async () => {
  for (const id of moves) for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      const run = await play(h, id), glow = h.node(id + '-impact-glow')
      for (const [at, count] of [[1, 28], [1.28, 22], [1.6, 18]]) {
        const prefix = id + '-foam-' + at.toFixed(2) + '-'
        assert.equal(h.node('move-artwork').children.filter(n => n.label?.startsWith(prefix)).length, count)
      }
      const burst = at => {
        const first = h.node(id + '-foam-' + at.toFixed(2) + '-0')
        h.tl.time(at - .001, false); assert.equal(first.alpha, 0)
        h.tl.time(at, false); close(first.alpha, .95, id + ' spray start ' + at)
      }
      burst(1)
      h.tl.time(1.12, false); close(glow.alpha, .22, id + ' glow peak')
      burst(1.28)
      h.tl.time(1.46, false); close(glow.alpha, .22, id + ' glow held until 1.46')
      burst(1.6)
      h.tl.time(1.66, false); assert.ok(glow.alpha > 0 && glow.alpha < .22)
      const foam = h.node(id + '-foam-1.60-3')
      h.tl.time(2.10, false); const p = h.scene.effects.toLocal({ x: 0, y: 0 }, foam); assert.ok(foam.alpha > .02)
      h.tl.time(2.23, false); const q = h.scene.effects.toLocal({ x: 0, y: 0 }, foam); assert.ok(foam.alpha > .02)
      assert.ok(q.y > p.y + 1, id + ' spray falls in world coordinates during fade'); assert.ok(Math.abs(q.x - p.x) > .2)
      await complete(h, run)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('Surf and Muddy Water retain identical motion and geometry in both directions and custom portrait layouts', async () => {
  for (const reverse of [false, true]) for (const portrait of [false, true]) for (const custom of [false, true]) {
    const surf = harness(reverse, portrait, custom), muddy = harness(reverse, portrait, custom)
    try {
      const runs = [await play(surf, 'surf'), await play(muddy, 'muddy-water')]
      for (let time = .04; time < 3.2; time += .037) {
        surf.tl.time(time, false); muddy.tl.time(time, false)
        assert.deepEqual(geometry(muddy, 'muddy-water'), geometry(surf, 'surf'), `identical geometry at ${time}, reverse ${reverse}, portrait ${portrait}, custom ${custom}`)
        for (const actor of surf.scene.actors.values()) { assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1) }
      }
      await complete(surf, runs[0]); await complete(muddy, runs[1])
    } finally { surf.dispose(); muddy.dispose() }
  }
  gsap.ticker.sleep()
})

test('both moves load the same cached Surf PNG, while Muddy owns brown/noise filters and preserves texture and programs on every exit', async () => {
  const h = harness()
  try {
    for (const id of moves) {
      const loaded = await loadMoveAssets(id, (key, url) => { assert.equal(key, 'surf'); assert.ok(url.endsWith('/assets/surf-tidal-wave.png')); return h.art })
      assert.equal(loaded.surf, h.art); assert.equal(h.art.source.scaleMode, 'nearest')
    }
    for (const id of moves) for (const cancel of [false, true]) {
      const run = await play(h, id), crests = ['leading', 'following'].map(n => h.node(id + '-' + n)), filters = crests.flatMap(w => w.filters ?? []), programs = []
      for (const crest of crests) {
        assert.equal(crest.texture, h.art)
        if (id === 'surf') assert.equal(crest.filters?.length ?? 0, 0)
        else {
          const [color, noise] = crest.filters; assert.ok(color instanceof ColorMatrixFilter); assert.ok(noise instanceof NoiseFilter)
          close(noise.noise, .1, 'silt noise'); close(noise.seed, .42, 'deterministic silt')
          const matrix = color.matrix, red = matrix[0] + matrix[1] + matrix[2] + matrix[4], green = matrix[5] + matrix[6] + matrix[7] + matrix[9], blue = matrix[10] + matrix[11] + matrix[12] + matrix[14]
          assert.ok(red > green && green > blue, 'wave maps to warm brown'); assert.deepEqual(Array.from(matrix).slice(15), [0, 0, 0, 1, 0], 'alpha survives the recoloring')
          programs.push(...crest.filters.map(f => f.glProgram))
        }
      }
      if (id === 'muddy-water') assert.equal(new Set(filters).size, 4, 'each crest owns its filters')
      h.tl.time(1.15, false)
      if (cancel) { run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h) } else await complete(h, run)
      for (const crest of crests) assert.equal(crest.destroyed, true)
      for (const filter of filters) assert.equal(filter.resources, null, 'owned filter destroyed')
      for (const program of programs) assert.ok(program.fragment && program.vertex, 'shared shader program retained')
    }
  } finally { h.dispose() }
  gsap.ticker.sleep()
})

test('both waves clean before contact, after contact and in reduced motion without loading art in reduced mode', async () => {
  for (const id of moves) for (const reverse of [false, true]) {
    const h = harness(reverse)
    try {
      for (const at of [.1, .6, 1.17]) {
        const run = await play(h, id); h.tl.time(at, false); run.cancel(); assert.equal((await run.finished).status, 'cancelled'); clean(h)
      }
      const before = h.calls.length, cues = [], run = await play(h, id, { reducedMotion: true, onCue: c => cues.push(c.type) })
      await complete(h, run, .8); assert.deepEqual(cues, ['impact']); assert.equal(h.calls.length, before)
    } finally { h.dispose() }
  }
  gsap.ticker.sleep()
})

test('missing wave artwork fails cleanly before a timeline or impact cue is created', async () => {
  for (const id of moves) for (const reverse of [false, true]) {
    const h = harness(reverse), cues = []
    let timelines = 0
    const failing = createBattleFx({ glowTexture: Texture.WHITE, assetLoader: () => Promise.reject(new Error('wave artwork unavailable')),
      timelineEngine: { timeline() { timelines++; throw new Error('must not build without wave artwork') } } })
    try {
      const run = failing.play({ moveId: id, sourceId: 'source', targetIds: ['target'] }, { scene: h.scene, onCue: c => cues.push(c.type) })
      const result = await run.finished
      assert.equal(result.status, 'failed'); assert.match(result.reason, /wave artwork unavailable/)
      assert.equal(timelines, 0); assert.deepEqual(cues, []); clean(h)
    } finally { failing.dispose(); h.dispose() }
  }
  gsap.ticker.sleep()
})
