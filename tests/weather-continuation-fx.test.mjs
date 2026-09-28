import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { playWeatherContinuation } from '@battle/battle-fx/weather'

const ids = ['rain', 'sun', 'sandstorm', 'hail']
const durations = { rain: .88, sun: .8, sandstorm: .9, hail: .94 }
function harness(width = 1000, height = 450) {
  const effects = new Container(), sibling = new Graphics().circle(20, 20, 4).fill(0xff0000)
  sibling.label = 'unrelated-move'; effects.addChild(sibling)
  const scene = { effects, width, height, unit: Math.min(width / 1000, height / 450),
    get actor() { throw new Error('Weather must not access actors') },
    get camera() { throw new Error('Weather must not access the camera') } }
  const timelines = []
  const timelineEngine = { timeline(config) { const timeline = gsap.timeline({ ...config, paused: true }); timelines.push(timeline); return timeline } }
  return { scene, sibling, timelines, play(weatherId, options = {}, request = {}) {
    return playWeatherContinuation({ weatherId, visualSeed: 23, ...request }, { scene, timelineEngine, ...options })
  }, get tl() { return timelines.at(-1) }, get layer() { return effects.children.find(node => node !== sibling) },
  node(label) { return effects.getChildByLabel(label, true) }, dispose() { effects.destroy({ children: true }) } }
}
function assertClean(h) {
  assert.deepEqual(h.scene.effects.children, [h.sibling])
  assert.equal(h.sibling.destroyed, false)
}
function geometry(node) {
  const bounds = node.getBounds()
  return { x: node.x, y: node.y, rotation: node.rotation, alpha: node.alpha,
    minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY }
}

test('all four brief weather continuations are field-only, independent and clean their own layer', async () => {
  const labels = { rain: ['rain-streak', 'rain-splash', 'rain-clouds'], sun: ['sun-ray', 'sun-disc', 'heat-glint'],
    sandstorm: ['sand-gust', 'sand-grain', 'sand-chip'], hail: ['hail-pellet', 'hail-chip'] }
  for (const id of ids) {
    const h = harness(), run = h.play(id), layer = h.layer
    try {
      assert.equal(layer.label, `weather-continuation-${id}`)
      assert.equal(h.timelines.length, 1)
      assert.equal(h.tl.duration(), durations[id])
      h.tl.time(.3, false)
      assert.equal(layer.alpha, 1)
      for (const label of labels[id]) assert.ok(h.node(label), `${id} has ${label}`)
      h.tl.time(durations[id], false)
      assert.deepEqual(await run.finished, { status: 'completed' })
      assert.equal(layer.destroyed, true); assertClean(h)
      run.cancel(); assertClean(h)
    } finally { run.cancel(); h.dispose() }
  }
})

test('every visible contour fits landscape, portrait and small fields throughout playback', async () => {
  for (const [width, height, unit] of [[1000, 450], [560, 700], [720, 600], [160, 90], [160, 90, 20]]) {
    for (const id of ids) {
      const h = harness(width, height)
      if (unit) h.scene.unit = unit
      const run = h.play(id)
      try {
        for (let time = .025; time < durations[id]; time += .037) {
          h.tl.time(time, false)
          const visit = node => {
            if (node instanceof Graphics && node.alpha > .001) {
              const bounds = node.getBounds()
              assert.ok(bounds.minX >= -.001 && bounds.maxX <= width + .001 && bounds.minY >= -.001 && bounds.maxY <= height + .001,
                `${id} ${width}×${height} at ${time.toFixed(3)} ${node.label}: ${JSON.stringify(bounds)}`)
            }
            for (const child of node.children ?? []) visit(child)
          }
          visit(h.layer)
        }
        h.tl.time(durations[id], false); assert.equal((await run.finished).status, 'completed')
      } finally { run.cancel(); h.dispose() }
    }
  }
})

test('rain and hail fall downward while particles, gusts and heat keep moving during the fade', () => {
  for (const id of ids) {
    const h = harness(), run = h.play(id)
    try {
      const label = { rain: 'rain-streak', sun: 'heat-glint', sandstorm: 'sand-grain', hail: 'hail-pellet' }[id]
      const nodes = h.layer.children.filter(node => node.label === label)
      h.tl.time(durations[id] - .18, false)
      const first = nodes.map(geometry), alpha = h.layer.alpha
      h.tl.time(durations[id] - .15, false)
      assert.ok(h.layer.alpha > 0 && h.layer.alpha < alpha)
      assert.ok(nodes.some((node, i) => node.alpha > .01 && first[i].alpha > .01 &&
        (node.x !== first[i].x || node.y !== first[i].y)), `${id} continues moving through the fade`)
      if (id === 'rain' || id === 'hail') {
        const before = nodes.map(geometry)
        h.tl.time(durations[id] - .145, false)
        const falling = nodes.filter((node, i) => node.alpha > 0 && before[i].alpha > 0 && before[i].y < h.scene.height * .45)
        assert.ok(falling.length > 0)
        for (const node of falling) {
          const old = before[nodes.indexOf(node)]
          // Exclude a newly wrapped particle returning to the top of the field.
          if (node.y > 15) assert.ok(node.y > old.y, `${id} has downward gravity`)
        }
      }
    } finally { run.cancel(); h.dispose() }
  }
})

test('visual seeds are deterministic without changing global randomness', () => {
  const random = Math.random
  for (const id of ids) {
    const a = harness(), b = harness(), c = harness(), runs = [a.play(id), b.play(id), c.play(id, {}, { visualSeed: 24 })]
    try {
      for (const h of [a, b, c]) h.tl.time(.33, false)
      const snapshot = h => h.layer.children.map(geometry)
      assert.deepEqual(snapshot(a), snapshot(b))
      assert.notDeepEqual(snapshot(a), snapshot(c))
      assert.equal(Math.random, random)
    } finally { runs.forEach(run => run.cancel()); [a, b, c].forEach(h => h.dispose()) }
  }
})

test('reduced motion uses only a short field tint and preserves sibling move effects', async () => {
  for (const id of ids) {
    const h = harness(), run = h.play(id, { reducedMotion: true })
    try {
      assert.equal(h.tl.duration(), .24)
      assert.equal(h.layer.children.length, 1)
      const wash = h.node('weather-reduced-wash')
      assert.ok(wash)
      h.tl.time(.1, false); const initial = geometry(wash)
      h.tl.time(.2, false); assert.deepEqual(geometry(wash), initial)
      assert.ok(h.layer.alpha > 0 && h.layer.alpha < 1)
      h.tl.time(.24, false); assert.deepEqual(await run.finished, { status: 'completed' }); assertClean(h)
    } finally { run.cancel(); h.dispose() }
  }
})

test('a new valid continuation replaces only the old continuation on the same field', async () => {
  const a = harness(), b = harness(), first = a.play('rain'), other = b.play('hail')
  const oldLayer = a.layer, oldTimeline = a.tl
  const second = a.play('sun')
  try {
    assert.deepEqual(await first.finished, { status: 'cancelled' })
    assert.equal(oldLayer.destroyed, true)
    assert.equal(b.layer.destroyed, false)
    oldTimeline.time(.6, false)
    assert.equal(a.layer.label, 'weather-continuation-sun')
    assert.equal(a.sibling.destroyed, false)
    a.tl.time(.8, false); b.tl.time(.94, false)
    assert.equal((await second.finished).status, 'completed')
    assert.equal((await other.finished).status, 'completed')
    assertClean(a); assertClean(b)
  } finally { first.cancel(); other.cancel(); second.cancel(); a.dispose(); b.dispose() }
})

test('unsupported, malformed and pre-aborted requests never interrupt a running continuation', async () => {
  const h = harness(), first = h.play('rain'), layer = h.layer
  try {
    for (const weatherId of [undefined, '', 'RainDance', 'snow', '__proto__', 'constructor']) {
      assert.equal((await h.play(weatherId).finished).status, 'skipped')
      assert.equal(layer.destroyed, false)
    }
    const aborted = new AbortController(); aborted.abort()
    assert.equal((await h.play('sun', { signal: aborted.signal }).finished).status, 'cancelled')
    const field = { effects: h.scene.effects, width: 1000, height: 450, unit: 1 }
    for (const scene of [null, { ...field, width: 0 }, { ...field, height: NaN }, { ...field, unit: -1 }]) {
      assert.equal((await playWeatherContinuation({ weatherId: 'sun' }, { scene }).finished).status, 'skipped')
    }
    assert.equal(layer.destroyed, false)
    h.tl.time(.88, false); assert.equal((await first.finished).status, 'completed'); assertClean(h)
  } finally { first.cancel(); h.dispose() }
})

test('abort, manual cancellation, disposal, builder errors and frame errors settle and remove owned art', async () => {
  for (const mode of ['abort', 'cancel', 'dispose', 'builder', 'frame']) {
    const h = harness(), controller = new AbortController()
    const run = h.play('rain', { signal: controller.signal, ...(mode === 'builder' ? {
      timelineEngine: { timeline() { throw new Error('Timeline unavailable') } },
    } : {}) })
    const layer = h.layer
    try {
      if (mode === 'abort') controller.abort()
      if (mode === 'cancel') run.cancel()
      if (mode === 'dispose') h.dispose()
      if (mode === 'frame') {
        h.node('rain-streak').position.set = () => { throw new Error('Frame failed') }
        h.tl.time(.2, false)
      }
      const result = await run.finished
      assert.equal(result.status, ['builder', 'frame'].includes(mode) ? 'failed' : 'cancelled')
      if (layer) assert.equal(layer.destroyed, true)
      if (mode !== 'dispose') assertClean(h)
      run.cancel(); controller.abort()
    } finally { run.cancel(); if (!h.scene.effects.destroyed) h.dispose() }
  }
})

test('the configurable deadline resolves a stalled timeline without disturbing move effects', async () => {
  const h = harness(), run = h.play('sandstorm', { deadlineMs: 15 })
  try {
    const result = await run.finished
    assert.equal(result.status, 'failed'); assert.match(result.reason, /deadline exceeded/)
    assertClean(h)
  } finally { run.cancel(); h.dispose() }
})
