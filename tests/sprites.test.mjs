import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Texture, TextureSource, Sprite } from 'pixi.js'
import { MIN_SPRITE_HEIGHT, previewSceneActors, previewSpriteHeight } from '../apps/game/src/scene/previewActors.js'
import { STARTER_SPRITES } from '../apps/game/src/scene/spriteViews.js'
import { resolveSpriteProfile } from '../apps/game/src/scene/profiles.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'

const ids = Object.keys(STARTER_SPRITES)
const close = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} vs ${b}`)
const texture = () => new Texture({ source: new TextureSource({ width: 96, height: 96 }) })
const findSprite = node => node instanceof Sprite ? node : node.children?.map(findSprite).find(Boolean)
const visibleBounds = (actor, profile) => {
  const art = findSprite(actor.root), r = profile.bounds
  const a = art.toGlobal({ x: r.x, y: r.y }), b = art.toGlobal({ x: r.x + r.width, y: r.y + r.height })
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

test('original default dimensions are restored, with a readable minimum for smaller starters', () => {
  assert.deepEqual(ids, ['bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard', 'squirtle', 'wartortle', 'blastoise'])
  const defaults = createSceneGraph({ actors: previewSceneActors() })
  try {
    close(defaults.actor('source').metrics.height, 229.114583333333)
    close(defaults.actor('source').metrics.width, 231.875)
    close(defaults.actor('target').metrics.height, 168.90625)
    close(defaults.actor('target').metrics.width, 193.385416666667)
  } finally { defaults.dispose() }
  for (const far of [false, true]) {
    const height = id => previewSceneActors(id, id)[far ? 1 : 0].height * 450
    const area = id => {
      const spec = previewSceneActors(id, id)[far ? 1 : 0], { bounds } = resolveSpriteProfile(spec)
      return (spec.height * 450) ** 2 * bounds.width / bounds.height
    }
    assert.ok(height('charizard') > height('charmander') * 1.35, 'Charmander is visibly smaller')
    assert.ok(area('venusaur') < area('charizard') * 1.5, 'Venusaur has no oversized multiplier')
    for (const id of ['bulbasaur', 'charmander', 'squirtle']) {
      assert.ok(height(id) >= MIN_SPRITE_HEIGHT[far ? 'far' : 'near'] - .001, id + ' meets the minimum')
      assert.ok(height(id) < height('charizard') * .85, id + ' remains a smaller starter')
    }
  }
})

test('every starter has distinct front/back PNGs, selected by field position with separate anatomy', () => {
  for (const id of ids) {
    const specs = previewSceneActors(id, id), [near, far] = specs.map(resolveSpriteProfile)
    assert.equal(specs[0].view, 'back'); assert.equal(specs[1].view, 'front')
    assert.equal(near.nativeFacing, 1); assert.equal(far.nativeFacing, -1)
    assert.notEqual(near.url, far.url); assert.notDeepEqual(near.anchors.emission, far.anchors.emission)
    const files = [near, far].map(profile => {
      const bytes = readFileSync(new URL('../public' + profile.url, import.meta.url))
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
      const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20), b = profile.bounds
      assert.ok(b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h)
      return bytes
    })
    assert.notDeepEqual(files[0], files[1], id + ' has actual different artwork, not a flip of one file')
    const textures = { source: texture(), target: texture() }
    const scene = createSceneGraph({ actors: specs, textures })
    try {
      for (const spec of specs) {
        const actor = scene.actor(spec.id), profile = resolveSpriteProfile(spec), art = findSprite(actor.root)
        assert.equal(art.texture, textures[spec.id])
        close(art.parent.scale.x, 1) // Each native image already faces into this field.
        close(visibleBounds(actor, profile).height, spec.height * 450)
        close(actor.metrics.width / actor.metrics.height, profile.bounds.width / profile.bounds.height)
        const ghost = actor.snapshot()
        assert.equal(findSprite(ghost).texture, textures[spec.id], 'afterimages retain this field view')
        ghost.destroy({ children: true })
      }
    } finally { scene.dispose(); for (const tex of Object.values(textures)) tex.destroy(true) }
  }
})

test('sprites stay inside wide, square and portrait fields and resize uniformly', () => {
  for (const [width, height] of [[1000, 450], [720, 600], [560, 700]]) for (const id of ids) for (const mirror of [false, true]) {
    const actors = previewSceneActors(id, id).map((spec, i) => ({ ...spec,
      x: mirror ? 1 - spec.x : spec.x, facing: mirror ? -spec.facing : spec.facing,
      height: previewSpriteHeight(id, { far: i === 1, width, height }),
    }))
    const textures = { source: texture(), target: texture() }, scene = createSceneGraph({ width, height, actors, textures })
    try {
      for (const spec of actors) {
        const b = visibleBounds(scene.actor(spec.id), resolveSpriteProfile(spec))
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${id} fits ${width}×${height}`)
      }
      const metrics = [...scene.actors.values()].map(a => ({ ...a.metrics }))
      scene.fit(320, 240)
      close(scene.root.scale.x, scene.root.scale.y)
      assert.deepEqual([...scene.actors.values()].map(a => ({ ...a.metrics })), metrics)
      for (const spec of actors) {
        const b = visibleBounds(scene.actor(spec.id), resolveSpriteProfile(spec))
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 320 && b.y + b.height <= 240, 'camera preserves the visible sprite')
      }
    } finally { scene.dispose(); for (const tex of Object.values(textures)) tex.destroy(true) }
  }
})

test('front/back profile selection retains measured sockets through partial host overrides', () => {
  for (const id of ids) for (const spec of previewSceneActors(id, id)) {
    const profile = resolveSpriteProfile(spec), scene = createSceneGraph({ actors: [{ ...spec, anchors: { fist: [.4, .6] } }] })
    try {
      const actor = scene.actor(spec.id)
      close(actor.base('emission').x, spec.x * 1000 + (profile.anchors.emission[0] - .5) * actor.metrics.width * spec.facing / profile.nativeFacing)
      close(actor.base('emission').y, spec.y * 450 + (profile.anchors.emission[1] - 1) * actor.metrics.height)
      assert.ok(actor.hasAnchor('fist'))
    } finally { scene.dispose() }
  }
})

test('platform size and placement stay fixed across species, sprite scales and cosmetic movement', () => {
  for (const [width, height] of [[1000, 450], [560, 700]]) for (const mirror of [false, true]) {
    let baseline
    for (const id of ids) for (const scale of [.8, 1, 1.2]) {
      const actors = previewSceneActors(id, id).map((spec, i) => ({ ...spec,
        x: mirror ? 1 - spec.x : spec.x, facing: mirror ? -spec.facing : spec.facing,
        height: previewSpriteHeight(id, { scale, far: i === 1, width, height }),
      }))
      const scene = createSceneGraph({ width, height, actors })
      const platforms = () => actors.map(spec => {
        const b = scene.terrain.getChildByLabel(`platform-${spec.id}`).getBounds()
        return { x: b.x, y: b.y, width: b.width, height: b.height }
      })
      try {
        const before = platforms()
        baseline ??= before
        assert.deepEqual(before, baseline, id + ' does not change either platform')
        for (const [i, spec] of actors.entries()) {
          const actor = scene.actor(spec.id), b = before[i], p = actor.base('visualCenter')
          close(b.width, ((i === 0 ? 346 : 286) + 1.5) * scene.unit)
          close(b.height, ((i === 0 ? 76 : 62) + 1.5) * scene.unit)
          close(p.x, b.x + b.width / 2)
          close(p.y + actor.metrics.height / 2, b.y + b.height / 2)
          actor.pose.position.set(40, -30); actor.pose.scale.set(.6)
        }
        assert.deepEqual(platforms(), before, 'movement and scaling never move the ground')
        scene.resetPoses()
        assert.deepEqual(platforms(), before, 'reset preserves the ground')
        scene.fit(320, 240)
        const after = platforms(), cameraScale = scene.root.scale.x
        for (const [i, b] of before.entries()) {
          close(after[i].width, b.width * cameraScale)
          close(after[i].height, b.height * cameraScale)
        }
      } finally { scene.dispose() }
    }
  }
})
