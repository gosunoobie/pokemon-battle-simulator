import { Application, Assets, Container, Graphics } from 'pixi.js'
import { createActor } from './actor.js'
import { resolveSpriteProfile } from './profiles.js'

// Battlefield dimensions are authored scene units, never derived from actor artwork.
const PLATFORM_RADII = { near: [173, 38], far: [143, 31] }

// Renderer-free scene construction is also used by geometry/playback tests.
export function createSceneGraph({ width = 1000, height = 450, actors: specs, textures = {} } = {}) {
  const root = new Container(), camera = new Container(), terrain = new Container(), actorLayer = new Container(), effects = new Container()
  root.addChild(camera); camera.addChild(terrain, actorLayer, effects)
  actorLayer.sortableChildren = true
  const unit = Math.min(width / 1000, height / 450)
  const defaults = [
    { id: 'source', profile: 'charizard', x: .246479166666667, y: .769236111111111, height: .509143518518519, facing: 1 },
    { id: 'target', profile: 'venusaur', x: .745776041666667, y: .593958333333333, height: .375347222222222, facing: -1 },
  ]
  // Share the slot center with the actor's visible bottom center at rest.
  for (const spec of specs ?? defaults) {
    const [rx, ry] = PLATFORM_RADII[spec.id === 'source' ? 'near' : 'far']
    const platform = new Graphics().ellipse(spec.x * width, spec.y * height, rx * unit, ry * unit)
      .fill({ color: 0xc3e2b0, alpha: .055 }).stroke({ color: 0xc3e2b0, alpha: .17, width: 1.5 * unit })
    platform.label = `platform-${spec.id}`
    terrain.addChild(platform)
  }
  const actors = new Map((specs ?? defaults).map(spec => {
    const profile = resolveSpriteProfile(spec)
    const actor = createActor({ ...profile, ...spec, texture: spec.texture ?? textures[spec.id] ?? textures[spec.profile], layer: actorLayer, effectSpace: effects,
      anchors: { ...profile.anchors, ...spec.anchors },
      position: { x: spec.x * width, y: spec.y * height }, height: spec.height * height })
    actor.root.zIndex = spec.y * height
    const resetPose = actor.resetPose
    actor.resetPose = () => { resetPose(); actor.root.zIndex = spec.y * height }
    return [spec.id, actor]
  }))
  return { root, camera, terrain, effects, actors, width, height, unit,
    actor: id => actors.get(id),
    fit(viewWidth, viewHeight) {
      const scale = Math.min(viewWidth / width, viewHeight / height)
      root.scale.set(scale); root.position.set((viewWidth - width * scale) / 2, (viewHeight - height * scale) / 2)
    },
    updateDepth(source, target) {
      // When a rear attacker moves into the other silhouette, keep its strike readable.
      // This affects draw order only; identities, field placement and move paths stay fixed.
      if (!source.root || !target.root || source === target) return
      const a = source.anchor('visualCenter'), b = target.anchor('visualCenter')
      const start = source.base('visualCenter'), toward = Math.sign(target.base('center').x - start.x)
      const approaching = (a.x - start.x) * toward > source.metrics.width * .1
      const overlap = Math.abs(a.x - b.x) < (source.metrics.width + target.metrics.width) * .5
      source.root.zIndex = approaching && overlap ? Math.max(source.base('ground').y, target.base('ground').y) + 1 : source.base('ground').y
    },
    resetPoses() { for (const actor of actors.values()) actor.resetPose(); camera.position.set(0, 0) },
    dispose() { root.destroy({ children: true }) },
  }
}

/** Base sprite failures use geometric actor fallbacks; optional FX is never loaded here. */
export async function createScene(host, options = {}) {
  const app = new Application()
  try {
    await app.init({ width: 1000, height: 450, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(globalThis.devicePixelRatio || 1, 2), autoDensity: true })
    const specs = options.actors ?? [{ id: 'source', profile: 'charizard' }, { id: 'target', profile: 'venusaur' }]
    const textures = Object.fromEntries(await Promise.all(specs.map(async spec => {
      const url = spec.url ?? resolveSpriteProfile(spec).url
      try { return [spec.id, spec.texture ?? (url ? await Assets.load(url) : null)] } catch { return [spec.id, null] }
    })))
    const scene = createSceneGraph({ ...options, textures })
    app.stage.addChild(scene.root)
    host.appendChild(app.canvas); app.canvas.setAttribute('aria-hidden', 'true')
    const fit = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight)
      app.renderer.resize(width, height); scene.fit(width, height)
    }
    const observer = new ResizeObserver(fit); observer.observe(host); fit()
    return { ...scene, dispose() { observer.disconnect(); app.destroy(true, { children: true }) } }
  } catch (error) { app.destroy(true, { children: true }); throw error }
}
