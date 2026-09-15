import '../../../tests/helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { gsap } from 'gsap'
import { GEN3, getAbility, getType } from '@battle/game-data'
import { SPRITE_VIEWS, SPRITE_URLS } from '@battle/pokemon-sprites'
import spriteManifest from '../../../packages/pokemon-sprites/data/manifest.json' with { type: 'json' }
import { MOVE_RULES } from '@battle/battle-core'
import { createBattleFx, EFFECT_TIMINGS } from '@battle/battle-fx'
import { ROSTER, ROSTER_LIST } from '../../../apps/game/src/roster/index.js'
import { MIN_SPRITE_EXTENT, MIN_SPRITE_HEIGHT, PREVIEW_POKEMON, previewBattleActors, previewSceneActors, previewSpriteHeight } from '../../../apps/game/src/scene/previewActors.js'
import { STARTER_SPRITES } from '../../../apps/game/src/scene/spriteViews.js'
import { resolveSpriteProfile } from '../../../apps/game/src/scene/profiles.js'
import { createSceneGraph } from '../../../apps/game/src/scene/index.js'
import { createPreviewTransaction } from '../../../apps/game/src/previewState.js'
import { gitBlobHash, inspectPng } from '../png.mjs'

const ids = Object.keys(ROSTER)
const sorted = values => [...values].sort()
const close = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < .001, `${label}: ${actual} vs ${expected}`)
const findSprite = node => node instanceof Sprite ? node : node.children?.map(findSprite).find(Boolean)
const visibleBounds = (actor, profile) => {
  const sprite = findSprite(actor.root), r = profile.bounds
  const points = [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]
    .map(([x, y]) => sprite.toGlobal({ x, y }))
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y))
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y }
}
const decoded = new Map()
function inspectProfile(profile) {
  if (!decoded.has(profile.url)) {
    const url = profile.url.startsWith('/assets/') ? new URL('../../../public' + profile.url, import.meta.url) : new URL(profile.url)
    decoded.set(profile.url, inspectPng(readFileSync(url)))
  }
  return decoded.get(profile.url)
}
function makeScene(id, width = 1000, height = 450, mirror = false, { scale = 1, playground = false } = {}) {
  const actors = previewSceneActors(id, id).map((spec, i) => ({ ...spec,
    x: mirror ? 1 - (playground ? [.25, .75][i] : spec.x) : (playground ? [.25, .75][i] : spec.x),
    y: playground ? [.82, .63][i] : spec.y,
    facing: mirror ? -spec.facing : spec.facing,
    height: previewSpriteHeight(id, { scale, far: i === 1, width, height }),
  }))
  const textures = Object.fromEntries(actors.map(spec => {
    const { width, height } = inspectProfile(resolveSpriteProfile(spec))
    return [spec.id, new Texture({ source: new TextureSource({ width, height }) })]
  }))
  const scene = createSceneGraph({ width, height, actors, textures })
  return { actors, textures, scene, dispose() { scene.dispose(); for (const texture of Object.values(textures)) texture.destroy(true) } }
}

test('the selectable roster contains exactly 386 base species and 33 forms with Gen 3 display data', () => {
  assert.equal(GEN3.species.length, 386); assert.equal(GEN3.forms.length, 33)
  assert.equal(ROSTER_LIST.length, 419); assert.equal(ids.length, 419)
  assert.equal(PREVIEW_POKEMON, ROSTER)
  assert.deepEqual(sorted(ids), sorted([...GEN3.species, ...GEN3.forms].map(row => row.id)))
  assert.deepEqual(ROSTER_LIST.filter(row => row.kind === 'base').map(row => row.num).sort((a, b) => a - b), Array.from({ length: 386 }, (_, i) => i + 1))
  assert.equal(ROSTER_LIST.filter(row => row.kind !== 'base').length, 33)
  for (const source of [...GEN3.species, ...GEN3.forms]) {
    const record = ROSTER[source.id]
    assert.deepEqual(record, {
      id: source.id, num: source.num, name: source.name,
      types: source.types.map(id => getType(id).name), baseStats: source.baseStats,
      abilities: [...new Set(Object.values(source.abilities))].map(id => getAbility(id).name),
      kind: source.kind, baseSpeciesId: source.baseSpeciesId, forme: source.forme,
      speciesGeneration: source.speciesGeneration,
    }, source.id)
    assert.ok(Object.isFrozen(record) && Object.isFrozen(record.baseStats) && Object.isFrozen(record.types) && Object.isFrozen(record.abilities), source.id + ' metadata is immutable')
  }
  assert.deepEqual(ROSTER.bulbasaur.types, ['Grass', 'Poison'])
  assert.deepEqual(ROSTER.clefairy.types, ['Normal'])
  assert.deepEqual(ROSTER.gengar.abilities, ['Levitate'])
  assert.equal(ROSTER.deoxysattack.baseStats.atk, 180)
  assert.equal(ROSTER.unownquestion.baseSpeciesId, 'unown')
})

test('all 838 front/back PNGs match their hashes, decoded alpha bounds and manifest dimensions', () => {
  assert.equal(spriteManifest.counts.baseSpecies, 386); assert.equal(spriteManifest.counts.forms, 33)
  assert.equal(spriteManifest.counts.views, 838); assert.equal(spriteManifest.files.length, 838)
  assert.deepEqual(sorted(Object.keys(SPRITE_VIEWS)), sorted(ids))
  assert.deepEqual(sorted(Object.keys(SPRITE_URLS)), sorted(spriteManifest.files.map(file => file.asset)))
  const seen = new Set()
  let bytesTotal = 0
  for (const file of spriteManifest.files) {
    const key = `${file.id}/${file.view}`
    assert.ok(!seen.has(key), key + ' appears once'); seen.add(key)
    assert.ok(ROSTER[file.id], key + ' references the roster')
    assert.ok(['front', 'back'].includes(file.view))
    const spec = SPRITE_VIEWS[file.id][file.view]
    assert.equal(spec.file, file.asset)
    assert.equal(spec.nativeFacing, file.view === 'front' ? -1 : 1)
    assert.equal(spec.anatomy, 'host-defaults-unmeasured')
    const bytes = readFileSync(new URL(SPRITE_URLS[spec.file])), info = inspectPng(bytes)
    assert.equal(bytes.length, file.bytes, key + ' byte length'); bytesTotal += bytes.length
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, key + ' SHA-256')
    assert.equal(gitBlobHash(bytes), file.gitBlobSha, key + ' upstream Git identity')
    assert.deepEqual(info, { width: file.width, height: file.height, bounds: file.bounds, opaquePixels: file.opaquePixels }, key + ' decoded pixels')
    assert.deepEqual({ width: spec.width, height: spec.height, bounds: spec.bounds }, { width: info.width, height: info.height, bounds: info.bounds }, key + ' view metadata')
    const profile = resolveSpriteProfile({ profile: file.id, view: file.view })
    assert.deepEqual(profile.bounds, info.bounds, key + ' selected host profile')
    if (!Object.hasOwn(STARTER_SPRITES, file.id)) assert.equal(profile.url, SPRITE_URLS[spec.file])
  }
  assert.equal(bytesTotal, spriteManifest.counts.bytes)
  for (const id of ids) assert.deepEqual(sorted(Object.keys(SPRITE_VIEWS[id])), ['back', 'front'], id + ' has both views')
})

test('the original 18 starter images and selected profile bounds remain calibrated', () => {
  assert.equal(Object.keys(STARTER_SPRITES).length, 9)
  for (const [id, views] of Object.entries(STARTER_SPRITES)) for (const [view, baseline] of Object.entries(views)) {
    const profile = resolveSpriteProfile({ profile: id, view })
    assert.equal(profile.url, baseline.url, id + ' retains the existing view asset')
    assert.equal(profile.nativeFacing, baseline.nativeFacing)
    assert.deepEqual(profile.bounds, baseline.bounds)
    assert.deepEqual(inspectProfile(profile).bounds, baseline.bounds, id + '/' + view + ' actual visible pixels')
  }
  assert.deepEqual(resolveSpriteProfile({ profile: 'charizard', view: 'back' }).anchors.emission, [79 / 84, 45 / 83])
  assert.deepEqual(resolveSpriteProfile({ profile: 'venusaur', view: 'front' }).anchors.emission, [.13, .72])
  close(previewSceneActors()[0].height * 450, 229.114583333333)
  close(previewSceneActors()[1].height * 450, 168.90625)
})

test('species metadata does not calculate battle stats or change the fixed preview HP and damage', () => {
  const move = MOVE_RULES.find(move => move.id === 'tackle')
  const samples = ['shedinja', 'blissey', 'wailord', 'deoxysattack', 'ditto']
  assert.equal(new Set(samples.map(id => ROSTER[id].baseStats.hp)).size, samples.length)
  for (const id of samples) {
    const actors = previewBattleActors(id, id)
    assert.deepEqual(actors, [
      { id: 'source', name: ROSTER[id].name, level: 50, hp: 156, maxHp: 156 },
      { id: 'target', name: ROSTER[id].name, level: 50, hp: 160, maxHp: 160 },
    ])
    for (const sourceId of ['source', 'target']) {
      const targetId = sourceId === 'source' ? 'target' : 'source'
      const tx = createPreviewTransaction(move, { sourceId, targetId, actors })
      assert.equal(tx.after.actors[targetId].hp, tx.before.actors[targetId].hp - move.damage, id + ' fixed preview damage')
      assert.deepEqual(tx.after.actors[sourceId], tx.before.actors[sourceId])
    }
  }
})

test('all 419 species/forms stay readable at minimum/default/maximum playground scales and fit all layouts with fixed platforms', () => {
  const overflow = []
  const presentations = [{ scale: 1, playground: false }, ...[.8, 1, 1.2].map(scale => ({ scale, playground: true }))]
  for (const [width, height] of [[1000, 450], [720, 600], [560, 700]]) for (const mirror of [false, true]) for (const presentation of presentations) for (const id of ids) {
    const h = makeScene(id, width, height, mirror, presentation)
    try {
      const platformBounds = () => h.actors.map(spec => {
        const b = h.scene.terrain.getChildByLabel(`platform-${spec.id}`).getBounds()
        return { x: b.x, y: b.y, width: b.width, height: b.height }
      })
      const before = platformBounds()
      for (const [i, spec] of h.actors.entries()) {
        const actor = h.scene.actor(spec.id), profile = resolveSpriteProfile(spec), b = visibleBounds(actor, profile), platform = before[i]
        const label = `${id}/${spec.view} ${width}×${height} mirror=${mirror} ${JSON.stringify(presentation)}`
        if (b.x < -.001 || b.y < -.001 || b.x + b.width > width + .001 || b.y + b.height > height + .001) overflow.push({ label, bounds: b })
        assert.equal(findSprite(actor.root).texture, h.textures[spec.id], label + ' uses its actual view texture')
        close(b.width / b.height, profile.bounds.width / profile.bounds.height, label + ' preserves native proportions')
        close(b.height, spec.height * height, label + ' displayed height')
        assert.ok(Math.max(b.width, b.height) >= MIN_SPRITE_EXTENT[i === 0 ? 'near' : 'far'] * h.scene.unit - .001, label + ' meets the visible-size minimum')
        assert.ok(b.height >= MIN_SPRITE_HEIGHT[i === 0 ? 'near' : 'far'] * h.scene.unit - .001, label + ' short silhouettes remain readable')
        close(platform.x + platform.width / 2, b.x + b.width / 2, label + ' platform horizontal center')
        close(platform.y + platform.height / 2, b.y + b.height, label + ' platform ground')
        close(platform.width, ((i === 0 ? 346 : 286) + 1.5) * h.scene.unit, label + ' platform width')
        close(platform.height, ((i === 0 ? 76 : 62) + 1.5) * h.scene.unit, label + ' platform height')
        for (const socket of ['center', 'visualCenter', 'emission', 'hand', 'foot', 'tackle', 'ground', 'origin']) {
          const point = actor.anchor(socket)
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), label + ' has finite ' + socket)
        }
        actor.pose.position.set(40, -30); actor.pose.scale.set(.6); actor.pose.rotation = .3
      }
      assert.deepEqual(platformBounds(), before, id + ' cosmetic poses leave platforms fixed')
      h.scene.resetPoses(); assert.deepEqual(platformBounds(), before)
      const metrics = [...h.scene.actors.values()].map(actor => ({ ...actor.metrics }))
      h.scene.fit(320, 240)
      close(h.scene.root.scale.x, h.scene.root.scale.y, 'uniform camera fit')
      assert.deepEqual([...h.scene.actors.values()].map(actor => ({ ...actor.metrics })), metrics)
      for (const spec of h.actors) {
        const b = visibleBounds(h.scene.actor(spec.id), resolveSpriteProfile(spec))
        if (b.x < -.001 || b.y < -.001 || b.x + b.width > 320.001 || b.y + b.height > 240.001) overflow.push({ label: `${id}/${spec.view} ${width}×${height} mirror=${mirror} resized`, bounds: b })
      }
    } finally { h.dispose() }
  }
  assert.deepEqual(overflow, [], 'all visible sprite bounds remain inside the field')
})

test('short wide artwork uses the lower height guard, while tiny forms remain readable', () => {
  const size = (id, far) => {
    const h = makeScene(id)
    try { return { ...h.scene.actor(far ? 'target' : 'source').metrics } }
    finally { h.dispose() }
  }
  for (const far of [false, true]) {
    const geodude = size('geodude', far), wailord = size('wailord', far), tiny = size('unownx', far)
    assert.ok(geodude.width < wailord.width, 'Geodude stays narrower than Wailord in either view')
    assert.ok(geodude.height < wailord.height * .55, 'Geodude retains its short silhouette')
    close(geodude.height, far ? 75 : 90, 'short sprites meet the lower height guard')
    close(tiny.width, far ? 125 : 150, 'the smallest square form remains readable')
    close(tiny.height, far ? 125 : 150)
  }
  close(size('geodude', true).width, 175)
  close(size('geodude', false).width, 183.214285714286)
})

test('representative new silhouettes use existing effects from either side and restore their actual front/back sprites', async () => {
  const tick = () => new Promise(resolve => setImmediate(resolve))
  for (const id of ['wailord', 'onix', 'diglett', 'geodude', 'unown', 'unownx', 'deoxys', 'castform']) {
    const h = makeScene(id)
    let timeline
    const fx = createBattleFx({ glowTexture: Texture.WHITE, timelineEngine: { timeline(options) { return timeline = gsap.timeline({ ...options, paused: true }) } } })
    try {
      for (const sourceId of ['source', 'target']) for (const moveId of ['tackle', 'water-gun']) {
        const targetId = sourceId === 'source' ? 'target' : 'source', cues = []
        const originalBounds = h.actors.map(spec => visibleBounds(h.scene.actor(spec.id), resolveSpriteProfile(spec)))
        const run = fx.play({ moveId, sourceId, targetIds: [targetId], visualSeed: 42 }, { scene: h.scene, onCue: cue => cues.push(cue.type) })
        await tick()
        assert.ok(timeline, id + ' ' + moveId + ' loads')
        for (let time = .025; time < EFFECT_TIMINGS[moveId].duration; time += .05) {
          timeline.time(time, false)
          for (const actor of h.scene.actors.values()) {
            const point = actor.anchor('visualCenter')
            assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), id + ' ' + moveId + ' finite pose')
            assert.ok(actor.pose.alpha > 0 && actor.pose.scale.x > 0 && actor.pose.scale.y > 0)
          }
        }
        timeline.time(EFFECT_TIMINGS[moveId].duration, false)
        assert.equal((await run.finished).status, 'completed', id + ' ' + moveId)
        assert.deepEqual(cues, ['impact'])
        assert.equal(h.scene.effects.children.length, 0)
        assert.equal(h.scene.camera.x, 0); assert.equal(h.scene.camera.y, 0)
        for (const actor of h.scene.actors.values()) {
          assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
          assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
        }
        assert.deepEqual(h.actors.map(spec => visibleBounds(h.scene.actor(spec.id), resolveSpriteProfile(spec))), originalBounds)
      }
    } finally { fx.dispose(); h.dispose(); gsap.ticker.sleep() }
  }
})
