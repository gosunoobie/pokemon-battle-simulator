import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { gsap } from 'gsap'
import { Graphics, Sprite, Texture, TextureSource } from 'pixi.js'
import { playPokeballRelease } from '@battle/battle-fx/transitions'
import { SPRITE_VIEWS } from '@battle/pokemon-sprites'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { previewSceneActors, previewSpriteHeight } from '../apps/game/src/scene/previewActors.js'

const close = (a, b, message) => assert.ok(Math.abs(a - b) < .001, `${message}: ${a} vs ${b}`)
function harness(species = 'charmander', width = 1000, height = 450, custom = false) {
  let timeline
  const actors = previewSceneActors(species, species).map((spec, i) => ({ ...spec,
    height: previewSpriteHeight(species, { far: !!i, width, height }),
    ...(custom ? { anchors: { origin: [.15, 1.08], center: [.92, .13], ground: [.3, .85] } } : {}),
  }))
  const scene = createSceneGraph({ width, height, actors })
  return { scene, play(actorIds, options = {}) { return playPokeballRelease({ scene, actorIds, ...options,
    timelineEngine: { timeline(config) { return timeline = gsap.timeline({ ...config, paused: true }) } },
  }) }, get tl() { return timeline }, node: label => scene.effects.getChildByLabel(label, true) }
}
function normal(actor) {
  assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
  assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
  assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.tint, 0xffffff)
}
function bounds(h, label) {
  function inspect(node, parentAlpha = 1) {
    const alpha = parentAlpha * node.alpha
    if (alpha > .03 && node instanceof Graphics) {
      const b = node.getBounds()
      assert.ok(b.x >= -.01 && b.y >= -.01 && b.x + b.width <= h.scene.width + .01 && b.y + b.height <= h.scene.height + .01,
        `${label}: ${node.label} exceeds field: ${JSON.stringify(b)}`)
    }
    for (const child of node.children ?? []) inspect(child, alpha)
  }
  inspect(h.scene.effects)
  for (const actor of h.scene.actors.values()) {
    const center = actor.anchor('visualCenter'), w = actor.metrics.width * actor.pose.scale.x, height = actor.metrics.height * actor.pose.scale.y
    assert.ok(center.x - w / 2 >= -.01 && center.x + w / 2 <= h.scene.width + .01 && center.y - height / 2 >= -.01 && center.y + height / 2 <= h.scene.height + .01, label + ' actor fits')
  }
}

test('release hides only the incoming actor immediately, throws a red/white ball from its own side, and reveals at the opening', async () => {
  for (const actorId of ['source', 'target']) {
    const h = harness('charizard', 1000, 450, true), actor = h.scene.actor(actorId)
    const other = h.scene.actor(actorId === 'source' ? 'target' : 'source'), center = actor.base('visualCenter')
    const platforms = h.scene.terrain.children.map(p => ({ ...p.getBounds() })), metrics = { ...actor.metrics }
    other.pose.position.set(7, 9); other.pose.alpha = .73
    const run = h.play([actorId])
    try {
      assert.equal(actor.pose.alpha, 0)
      assert.equal(other.pose.x, 7); assert.equal(other.pose.y, 9); assert.equal(other.pose.alpha, .73)
      const ball = h.node(`pokeball-${actorId}`)
      assert.ok(actorId === 'source' ? ball.x < center.x : ball.x > center.x)
      const red = ball.getChildByLabel('pokeball-red-half'), white = ball.getChildByLabel('pokeball-white-half')
      assert.equal(red.context.instructions.find(i => i.action === 'fill').data.style.color, 0xed454e)
      assert.equal(white.context.instructions.find(i => i.action === 'fill').data.style.color, 0xf9fbff)
      h.tl.time(.3, false); assert.equal(actor.pose.alpha, 0); assert.ok(ball.alpha > .99)
      h.tl.time(.52, false)
      close(ball.x, center.x, 'ball opens at visible center x'); close(ball.y, center.y, 'ball opens at visible center y')
      assert.equal(actor.pose.alpha, 0)
      h.tl.time(.7, false)
      assert.ok(actor.pose.alpha > .5); assert.ok(actor.pose.scale.x > .5 && actor.pose.scale.x < 1)
      close(actor.anchor('visualCenter').x, center.x, 'custom pivot keeps release centered x')
      close(actor.anchor('visualCenter').y, center.y, 'custom pivot keeps release centered y')
      close(actor.pose.scale.x, actor.pose.scale.y, 'aspect ratio preserved')
      h.tl.time(1.35, false)
      assert.deepEqual(await run.finished, { status: 'completed' }); normal(actor)
      assert.deepEqual(actor.metrics, metrics)
      assert.deepEqual(h.scene.terrain.children.map(p => ({ ...p.getBounds() })), platforms)
      assert.equal(other.pose.x, 7); assert.equal(other.pose.y, 9); assert.equal(other.pose.alpha, .73)
      assert.equal(h.scene.effects.children.length, 0)
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('simultaneous initial entries stagger briefly, preserve both footprints, and never move camera or platforms', async () => {
  const h = harness(), camera = { x: 3, y: 4 }
  h.scene.camera.position.set(camera.x, camera.y)
  const run = h.play(['source', 'target', 'source', 'missing'])
  try {
    assert.equal(h.scene.actor('source').pose.alpha, 0); assert.equal(h.scene.actor('target').pose.alpha, 0)
    assert.equal(h.node('pokeball-source').alpha, 1); assert.equal(h.node('pokeball-target').alpha, 0)
    h.tl.time(.59, false)
    assert.ok(h.scene.actor('source').pose.alpha > 0); assert.equal(h.scene.actor('target').pose.alpha, 0)
    h.tl.time(1.45, false); assert.equal((await run.finished).status, 'completed')
    for (const actor of h.scene.actors.values()) normal(actor)
    assert.equal(h.scene.camera.x, camera.x); assert.equal(h.scene.camera.y, camera.y)
    assert.equal(h.scene.effects.children.length, 0)
  } finally { run.cancel(); h.scene.dispose() }
})

test('the ball has a visible tumble, projected button, changing seam and continuous opening rotation', async () => {
  for (const actorId of ['source', 'target']) {
    const h = harness(), run = h.play([actorId])
    try {
      const ball = h.node(`pokeball-${actorId}`), button = ball.getChildByLabel('pokeball-button')
      const seam = ball.getChildByLabel('pokeball-equator')
      assert.equal(ball.scale.x, .7)
      assert.equal(ball.scale.y, .7)
      assert.ok(ball.getChildByLabel('pokeball-red-half').getBounds().width >= 28, 'ball markings remain readable at the reduced size')
      assert.ok(ball.getChildByLabel('pokeball-glint', true), 'an asymmetric highlight travels with the shell')
      const frames = []
      for (const time of [.03, .065, .13, .23, .32, .42]) {
        h.tl.time(time, false)
        frames.push({ rotation: ball.rotation, x: button.x, width: button.scale.x, alpha: button.alpha,
          seam: JSON.stringify(seam.context.instructions.map(instruction => instruction.data.path.instructions)) })
      }
      assert.ok(frames.some(frame => frame.x > 5 && frame.alpha > .5))
      assert.ok(frames.some(frame => frame.x < -5 && frame.alpha > .5), 'button crosses the sphere, rather than staying centered')
      assert.ok(Math.max(...frames.map(frame => frame.width)) - Math.min(...frames.map(frame => frame.width)) > .3, 'button foreshortens while tumbling')
      assert.ok(new Set(frames.map(frame => frame.seam)).size > 3, 'projected equator changes shape')
      assert.ok(Math.abs(frames.at(-1).rotation - frames[0].rotation) > Math.PI * 3, 'multiple readable turns during flight')
      h.tl.time(.5199, false); const before = ball.rotation
      h.tl.time(.5201, false); const after = ball.rotation
      assert.ok(Math.abs(after - before) < .01, 'opening never snaps back to angle zero')
      h.tl.time(.6, false)
      assert.ok(Math.abs(ball.rotation) > Math.abs(after), 'shell keeps rotating as it opens')
    } finally { run.cancel(); await run.finished; h.scene.dispose() }
  }
})

test('the opening has an immediate bright core, layered rings, a speed trail and moving fading sparks', async () => {
  const h = harness(), run = h.play(['source'])
  try {
    h.tl.time(.25, false)
    assert.ok(h.node('pokeball-trail-source').context.instructions.length > 20, 'a connected multi-layer trail carries the throw')
    assert.equal(h.node('release-core-source').alpha, 0)
    h.tl.time(.52, false)
    assert.equal(h.node('release-core-source').alpha, 1, 'burst peaks at opening, without a slow fade-in')
    assert.equal(h.node('release-light-source').alpha, 1)
    const ring = h.node('release-ring-source-0'), first = ring.scale.x
    h.tl.time(.63, false)
    assert.ok(ring.scale.x > first)
    assert.ok(h.node('release-ring-source-1').alpha > 0)
    assert.ok(h.node('release-silhouette-source').alpha > .5, 'white silhouette resolves into the actual sprite')
    const mote = h.node('release-mote-source-0')
    h.tl.time(.92, false); const previous = { x: mote.x, y: mote.y, alpha: mote.alpha }
    h.tl.time(1.07, false)
    assert.ok(Math.hypot(mote.x - previous.x, mote.y - previous.y) > 1, 'sparks keep moving during the fade')
    assert.ok(mote.alpha > 0 && mote.alpha < previous.alpha)
    assert.equal(h.node('release-silhouette-source').alpha, 0)
    h.tl.time(1.35, false)
    assert.equal((await run.finished).status, 'completed')
    assert.equal(h.scene.effects.children.length, 0)
  } finally { run.cancel(); h.scene.dispose() }
})

test('small, tall, short/wide and large species fit wide, square and portrait fields throughout their release', async () => {
  for (const species of ['caterpie', 'charmander', 'charizard', 'geodude', 'wailord', 'onix', 'diglett', 'unownquestion']) {
    for (const [width, height] of [[1000, 450], [720, 600], [560, 700]]) {
      const h = harness(species, width, height, true), run = h.play(['source', 'target'])
      try {
        for (let time = 0; time < 1.45; time += .037) { h.tl.time(time, false); bounds(h, `${species} ${width}×${height} at ${time}`) }
        h.tl.time(1.45, false); assert.equal((await run.finished).status, 'completed')
      } finally { run.cancel(); h.scene.dispose() }
    }
  }
})

test('every imported front/back shape grows uniformly around its visible center and restores exact minimum-sized bounds', async () => {
  let count = 0
  for (const species of Object.keys(SPRITE_VIEWS)) {
    const h = harness(species), run = h.play(['source', 'target'])
    try {
      const resting = [...h.scene.actors.values()].map(actor => ({ center: actor.base('visualCenter'), metrics: { ...actor.metrics } }))
      h.tl.time(.8, false)
      for (const [index, actor] of [...h.scene.actors.values()].entries()) {
        close(actor.anchor('visualCenter').x, resting[index].center.x, species + ' centered x')
        close(actor.anchor('visualCenter').y, resting[index].center.y, species + ' centered y')
        close(actor.pose.scale.x, actor.pose.scale.y, species + ' uniform scaling')
        assert.deepEqual(actor.metrics, resting[index].metrics)
        count++
      }
      bounds(h, species)
      h.tl.time(1.45, false); await run.finished
      for (const actor of h.scene.actors.values()) normal(actor)
    } finally { run.cancel(); h.scene.dispose() }
  }
  assert.equal(count, 838)
})

test('reduced motion uses only a short fade with full-size silhouettes', async () => {
  const h = harness(), run = h.play(['source', 'target'], { reducedMotion: true })
  try {
    assert.equal(h.scene.effects.children[0].children.length, 0)
    h.tl.time(.125, false)
    for (const actor of h.scene.actors.values()) {
      close(actor.pose.alpha, .5, 'halfway fade'); assert.equal(actor.pose.scale.x, 1)
      assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0)
    }
    h.tl.time(.25, false); assert.equal((await run.finished).status, 'completed')
    for (const actor of h.scene.actors.values()) normal(actor)
    assert.equal(h.scene.effects.children.length, 0)
  } finally { run.cancel(); h.scene.dispose() }
})

test('the white silhouette owns its filter and copy, preserving the live sprite and shared texture', async () => {
  for (const cancel of [false, true]) {
    const texture = new Texture({ source: new TextureSource({ width: 96, height: 96 }) })
    const scene = createSceneGraph({ actors: previewSceneActors('charizard', 'geodude'), textures: { source: texture, target: texture } })
    let timeline
    const actor = scene.actor('source'), previousFilters = actor.pose.filters
    const run = playPokeballRelease({ scene, actorIds: ['source'], timelineEngine: {
      timeline(config) { return timeline = gsap.timeline({ ...config, paused: true }) },
    } })
    try {
      const copy = scene.effects.getChildByLabel('release-silhouette-source', true)
      const filter = copy.filters[0], originalDestroy = filter.destroy.bind(filter)
      let destroyed = 0
      filter.destroy = () => { destroyed++; originalDestroy() }
      timeline.time(.66, false)
      const sourceSprite = actor.root.children[0].children[0].children[0].children[0]
      assert.ok(sourceSprite instanceof Sprite)
      assert.equal(sourceSprite.texture, texture)
      assert.equal(actor.pose.filters, previousFilters)
      assert.equal(copy.filters[0].matrix[18], 1, 'silhouette preserves source alpha')
      if (cancel) run.cancel()
      else timeline.time(1.35, false)
      assert.equal((await run.finished).status, cancel ? 'cancelled' : 'completed')
      assert.equal(copy.destroyed, true)
      assert.equal(destroyed, 1)
      assert.notEqual(texture.destroyed, true)
      assert.equal(sourceSprite.texture, texture)
      assert.equal(actor.pose.filters, previousFilters)
      normal(actor)
      const next = actor.snapshot(); next.destroy({ children: true })
      assert.notEqual(texture.destroyed, true, 'future moves can still snapshot the same sprite')
    } finally { run.cancel(); scene.dispose(); texture.destroy(true) }
  }
})

test('adapters without snapshots still get the full release and restore their actor', async () => {
  const h = harness(), actor = h.scene.actor('source')
  delete actor.snapshot
  const run = h.play(['source'])
  try {
    h.tl.time(.64, false)
    assert.ok(actor.pose.alpha > 0)
    assert.equal(h.node('release-silhouette-source'), null)
    assert.ok(h.node('release-core-source').alpha > 0)
    h.tl.time(1.35, false)
    assert.equal((await run.finished).status, 'completed'); normal(actor)
  } finally { run.cancel(); h.scene.dispose() }
})

test('cancel, abort, builder failure, and frame failure clean up once and restore only targeted actors', async () => {
  for (const mode of ['cancel-before-open', 'cancel-after-open', 'abort', 'builder-failure', 'frame-failure']) {
    const h = harness(), actor = h.scene.actor('source'), controller = new AbortController()
    const other = h.scene.actor('target'); other.pose.alpha = .4
    let resets = 0
    const reset = actor.resetPose; actor.resetPose = () => { resets++; reset() }
    const run = mode === 'builder-failure' ? playPokeballRelease({ scene: h.scene, actorIds: ['source'],
      timelineEngine: { timeline() { throw new Error('Builder failed') } },
    }) : h.play(['source'], { signal: controller.signal })
    try {
      if (mode !== 'builder-failure') h.tl.time(mode === 'cancel-before-open' ? .2 : .7, false)
      if (mode === 'abort') controller.abort()
      else if (mode === 'frame-failure') { actor.anchor = () => { throw new Error('Frame failed') }; h.tl.time(.8, false) }
      else run.cancel()
      assert.equal((await run.finished).status, mode.endsWith('failure') ? 'failed' : 'cancelled')
      const doneResets = resets; run.cancel(); controller.abort(); assert.equal(resets, doneResets)
      assert.equal(resets, 2, 'one initialization reset and one final reset')
      assert.equal(h.scene.effects.children.length, 0); normal(actor); assert.equal(other.pose.alpha, .4)
    } finally { run.cancel(); h.scene.dispose() }
  }
})

test('missing actors and pre-aborted requests settle without touching the field', async () => {
  const h = harness(), controller = new AbortController(); controller.abort()
  try {
    assert.deepEqual(await h.play(['missing']).finished, { status: 'skipped' })
    assert.deepEqual(await h.play(['source'], { signal: controller.signal }).finished, { status: 'cancelled' })
    assert.deepEqual(await playPokeballRelease().finished, { status: 'skipped' })
    assert.equal(h.scene.effects.children.length, 0)
    for (const actor of h.scene.actors.values()) normal(actor)
  } finally { h.scene.dispose(); gsap.ticker.sleep() }
})
