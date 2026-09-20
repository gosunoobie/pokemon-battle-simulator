import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { Graphics, Sprite, Texture, TextureSource } from 'pixi.js'
import { playPokemonFaint } from '@battle/battle-fx/transitions'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors, previewSpriteHeight } from '../apps/game/src/scene/previewActors.js'

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .001, `${message}: ${actual} vs ${expected}`)
function harness(species = 'charmander', width = 1000, height = 450, textures = {}) {
  let timeline
  const actors = previewSceneActors(species, species).map((spec, index) => ({ ...spec,
    height: previewSpriteHeight(species, { far: !!index, width, height }),
    anchors: { origin: [.15, 1.08], center: [.92, .13], ground: [.3, .65], floor: [.8, .72] },
  }))
  const scene = createSceneGraph({ width, height, actors, textures })
  return { scene, play(actorIds, options = {}) { return playPokemonFaint({ scene, actorIds, ...options,
    timelineEngine: { timeline(config) { return timeline = gsap.timeline({ ...config, paused: true }) } },
  }) }, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true) }
}
function normal(actor) {
  assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
  assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.tint, 0xffffff)
}

test('faint cues fire once after successful first-frame setup, including reduced motion, and survive callback errors', async () => {
  for (const reducedMotion of [false, true]) {
    const h = harness(), cues = []
    const run = h.play(['source', 'target', 'source', 'missing'], { reducedMotion, onCue(cue) {
      if (!reducedMotion) assert.ok(h.node(`faint-copy-${cue.actorId}`))
      cues.push(cue)
      throw new Error('Sound is optional')
    } })
    try {
      assert.deepEqual(cues, [{ type: 'faint', actorId: 'source' }, { type: 'faint', actorId: 'target' }])
      h.tl.time(.1, false); h.tl.time(0, false); h.tl.time(reducedMotion ? .22 : .9, false)
      assert.equal((await run.finished).status, 'completed'); assert.equal(cues.length, 2)
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('faint cues stay silent when absent, pre-aborted, or unable to build the first frame', async () => {
  for (const mode of ['missing', 'abort', 'capture', 'builder', 'frame']) {
    const h = harness(), cues = [], controller = new AbortController()
    if (mode === 'abort') controller.abort()
    if (mode === 'capture') h.scene.actor('source').snapshot = () => { throw new Error('No capture') }
    if (mode === 'frame') {
      const snapshot = h.scene.actor('source').snapshot
      h.scene.actor('source').snapshot = () => {
        const copy = snapshot(); copy.position.set = () => { throw new Error('No first frame') }; return copy
      }
    }
    const options = { scene: h.scene, actorIds: mode === 'missing' ? ['missing'] : ['source'], signal: controller.signal,
      onCue: cue => cues.push(cue), timelineEngine: mode === 'builder' ? { timeline() { throw new Error('No timeline') } } :
        { timeline: config => gsap.timeline({ ...config, paused: true }) } }
    const run = playPokemonFaint(options)
    try {
      assert.equal((await run.finished).status, mode === 'missing' ? 'skipped' : mode === 'abort' ? 'cancelled' : 'failed')
      assert.deepEqual(cues, [])
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('either side dips, loses saturation and sinks behind its actual visible bottom without changing the other actor', async () => {
  for (const actorId of ['source', 'target']) {
    const h = harness('charizard'), actor = h.scene.actor(actorId)
    const other = h.scene.actor(actorId === 'source' ? 'target' : 'source')
    other.pose.position.set(6, -3); other.pose.alpha = .7
    const center = actor.base('visualCenter'), bottom = center.y + actor.metrics.height / 2
    const platforms = h.scene.terrain.children.map(node => ({ ...node.getBounds() }))
    const run = h.play([actorId])
    try {
      assert.equal(actor.pose.alpha, 0)
      const copy = h.node(`faint-copy-${actorId}`), clip = h.node(`faint-clip-${actorId}`)
      assert.equal(copy.mask, clip)
      close(clip.getLocalBounds().maxY, bottom, 'mask stops at visible bottom')
      assert.notEqual(bottom, actor.base('floor').y, 'custom semantic socket does not determine disappearance line')
      const initial = copy.getBounds(), initialY = copy.y
      close(initial.x + initial.width / 2, center.x, 'copy centered despite custom registration')
      close(initial.maxY, bottom, 'copy retains exact resting feet')
      h.tl.time(.17, false)
      assert.ok(copy.y > initialY && copy.y - initialY < 8, 'brief defeated dip')
      assert.ok(copy.filters[0].matrix[0] < .5, 'artwork desaturates')
      assert.equal(copy.filters[0].matrix[18], 1, 'filter preserves source alpha')
      assert.equal(copy.scale.x, 1); assert.equal(copy.scale.y, 1)
      h.tl.time(.55, false)
      assert.ok(copy.y > initialY + actor.metrics.height * .3, 'downward sink follows dip')
      assert.ok(h.node(`faint-ripple-${actorId}`).alpha > 0)
      h.tl.time(.8, false)
      assert.ok(copy.getBounds().minY >= bottom, 'entire artwork has passed below the mask')
      assert.equal(actor.pose.alpha, 0)
      h.tl.time(.9, false)
      assert.deepEqual(await run.finished, { status: 'completed' })
      normal(actor)
      assert.equal(actor.root.visible, true, 'final visibility remains host owned')
      assert.equal(other.pose.x, 6); assert.equal(other.pose.y, -3); assert.equal(other.pose.alpha, .7)
      assert.deepEqual(h.scene.terrain.children.map(node => ({ ...node.getBounds() })), platforms)
      assert.equal(h.scene.effects.children.length, 0)
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('owned faint copies remain visible independently of host-hidden roots and share one timeline', async () => {
  const h = harness(), source = h.scene.actor('source'), target = h.scene.actor('target')
  const run = h.play(['source', 'target', 'source', 'missing'])
  try {
    source.root.visible = false; target.root.visible = false
    h.tl.time(.35, false)
    for (const id of ['source', 'target']) {
      const copy = h.node(`faint-copy-${id}`)
      assert.equal(copy.visible, true); assert.equal(copy.alpha, 1)
      assert.equal(copy.parent, h.scene.effects.children[0])
    }
    assert.equal(h.scene.effects.children[0].children.filter(node => node.label.startsWith('faint-copy-')).length, 2)
    h.tl.time(.9, false); assert.equal((await run.finished).status, 'completed')
    assert.equal(source.root.visible, false); assert.equal(target.root.visible, false)
    normal(source); normal(target)
  } finally { run.cancel(); h.scene.dispose() }
})

test('small, wide and tall silhouettes use a fixed full-width field mask and restrained dust in all layouts', async () => {
  for (const species of ['caterpie', 'charizard', 'geodude', 'wailord', 'onix', 'diglett', 'unownquestion']) {
    for (const [width, height] of [[1000, 450], [720, 600], [560, 700]]) {
      const h = harness(species, width, height), run = h.play(['source', 'target'])
      try {
        const masks = ['source', 'target'].map(id => ({ node: h.node(`faint-clip-${id}`), bounds: { ...h.node(`faint-clip-${id}`).getLocalBounds() } }))
        for (let time = .03; time < .9; time += .053) {
          h.tl.time(time, false)
          for (const mask of masks) assert.deepEqual({ ...mask.node.getLocalBounds() }, mask.bounds)
          for (const node of h.scene.effects.children[0].children) {
            if (!(node instanceof Graphics) || node.alpha < .01) continue
            const b = node.getBounds()
            assert.ok(b.minX >= -.001 && b.maxX <= width + .001 && b.minY >= -.001 && b.maxY <= height + .001,
              `${species} ${width}×${height}: ${node.label} fits the field`)
          }
          for (const actor of h.scene.actors.values()) {
            assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
            assert.equal(actor.pose.rotation, 0)
          }
        }
        const mote = h.node('faint-dust-source-0')
        h.tl.time(.53, false); const previous = { x: mote.x, alpha: mote.alpha }
        h.tl.time(.64, false)
        assert.ok(mote.x !== previous.x && mote.alpha < previous.alpha && mote.alpha > 0, 'dust keeps drifting during its fade')
        h.tl.time(.9, false); assert.equal((await run.finished).status, 'completed')
      } finally { run.cancel(); h.scene.dispose() }
    }
  }
})

test('reduced motion is a .22-second opacity fade without copies, filters, movement or dust', async () => {
  const h = harness(), run = h.play(['source', 'target'], { reducedMotion: true })
  try {
    assert.equal(h.scene.effects.children[0].children.length, 0)
    h.tl.time(.11, false)
    for (const actor of h.scene.actors.values()) {
      close(actor.pose.alpha, .5, 'halfway fade'); assert.equal(actor.pose.scale.x, 1)
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    }
    h.tl.time(.22, false); assert.equal((await run.finished).status, 'completed')
    for (const actor of h.scene.actors.values()) normal(actor)
    assert.equal(h.scene.effects.children.length, 0)
  } finally { run.cancel(); h.scene.dispose() }
})

test('adapters without snapshots use a bounded dip and fade and preserve the resting scale', async () => {
  const h = harness('geodude'), actor = h.scene.actor('source'); delete actor.snapshot
  const run = h.play(['source'])
  try {
    assert.equal(h.node('faint-copy-source'), null)
    h.tl.time(.4, false)
    assert.ok(actor.pose.alpha > 0 && actor.pose.alpha < .6)
    assert.ok(actor.pose.y > 0 && actor.pose.y <= 7)
    assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    h.tl.time(.64, false); assert.equal(actor.pose.alpha, 0)
    h.tl.time(.9, false); assert.equal((await run.finished).status, 'completed'); normal(actor)
  } finally { run.cancel(); h.scene.dispose() }
})

test('completion and cancellation destroy only the owned copy, mask and filter, preserving shared textures', async () => {
  for (const cancel of [false, true]) {
    const texture = new Texture({ source: new TextureSource({ width: 96, height: 96 }) })
    const h = harness('charizard', 1000, 450, { source: texture, target: texture }), actor = h.scene.actor('source')
    const previousFilters = actor.pose.filters, run = h.play(['source'])
    try {
      const copy = h.node('faint-copy-source'), clip = h.node('faint-clip-source'), filter = copy.filters[0]
      const originalDestroy = filter.destroy.bind(filter); let destroys = 0
      filter.destroy = () => { destroys++; originalDestroy() }
      const sprite = actor.root.children[0].children[0].children[0].children[0]
      assert.ok(sprite instanceof Sprite); assert.equal(sprite.texture, texture)
      h.tl.time(.5, false)
      if (cancel) run.cancel()
      else h.tl.time(.9, false)
      assert.equal((await run.finished).status, cancel ? 'cancelled' : 'completed')
      assert.equal(copy.destroyed, true); assert.equal(clip.destroyed, true); assert.equal(destroys, 1)
      assert.notEqual(texture.destroyed, true); assert.equal(sprite.texture, texture)
      assert.equal(actor.pose.filters, previousFilters); normal(actor)
      run.cancel(); assert.equal(destroys, 1)
      const next = actor.snapshot(); next.destroy({ children: true })
      assert.notEqual(texture.destroyed, true, 'future entries and effects can reuse the same texture')
    } finally { run.cancel(); h.scene.dispose(); texture.destroy(true) }
  }
})

test('abort, builder failure, capture failure and frame failure settle once and restore targeted poses', async () => {
  for (const mode of ['abort', 'builder-failure', 'capture-failure', 'frame-failure']) {
    const h = harness(), actor = h.scene.actor('source'), controller = new AbortController()
    const other = h.scene.actor('target'); other.pose.alpha = .4
    const reset = actor.resetPose; let resets = 0
    actor.resetPose = () => { resets++; reset() }
    if (mode === 'capture-failure') actor.snapshot = () => { throw new Error('Capture failed') }
    const run = mode === 'builder-failure' ? playPokemonFaint({ scene: h.scene, actorIds: ['source'],
      timelineEngine: { timeline() { throw new Error('Builder failed') } },
    }) : h.play(['source'], { signal: controller.signal })
    try {
      if (mode === 'abort') { h.tl.time(.4, false); controller.abort() }
      if (mode === 'frame-failure') {
        h.node('faint-copy-source').position.set = () => { throw new Error('Frame failed') }
        h.tl.time(.5, false)
      }
      assert.equal((await run.finished).status, mode === 'abort' ? 'cancelled' : 'failed')
      assert.equal(resets, 2, 'one initialization reset and one final reset')
      run.cancel(); controller.abort(); assert.equal(resets, 2)
      assert.equal(h.scene.effects.children.length, 0); normal(actor); assert.equal(other.pose.alpha, .4)
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('the safety deadline settles a stalled timeline and releases its owned artwork', async () => {
  const h = harness(), originalSetTimeout = globalThis.setTimeout
  let watchdog, run
  try {
    globalThis.setTimeout = (callback, delay, ...args) => {
      if (delay === 5000) watchdog = callback
      return originalSetTimeout(callback, delay, ...args)
    }
    run = h.play(['source'])
  } finally { globalThis.setTimeout = originalSetTimeout }
  try {
    assert.equal(typeof watchdog, 'function')
    h.tl.time(.45, false)
    watchdog()
    assert.deepEqual(await run.finished, { status: 'failed', reason: 'Pokémon faint deadline exceeded.' })
    assert.equal(h.scene.effects.children.length, 0); normal(h.scene.actor('source'))
    watchdog(); run.cancel()
    assert.equal(h.scene.effects.children.length, 0)
  } finally { run?.cancel(); h.scene.dispose() }
})

test('missing actors, invalid requests and pre-aborted requests settle without touching the field', async () => {
  const h = harness(), controller = new AbortController(); controller.abort()
  try {
    assert.deepEqual(await h.play(['missing']).finished, { status: 'skipped' })
    assert.deepEqual(await h.play(['source'], { signal: controller.signal }).finished, { status: 'cancelled' })
    assert.deepEqual(await playPokemonFaint().finished, { status: 'skipped' })
    assert.deepEqual(await playPokemonFaint({ scene: h.scene, actorIds: 'source' }).finished, { status: 'skipped' })
    assert.equal(h.scene.effects.children.length, 0)
    for (const actor of h.scene.actors.values()) normal(actor)
  } finally { h.scene.dispose(); gsap.ticker.sleep() }
})
