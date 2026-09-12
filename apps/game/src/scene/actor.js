import { Container, Sprite, Graphics } from 'pixi.js'

const DEFAULT_ANCHORS = { vine: [0.88, 0.4], center: [0.5, 0.5], emission: [0.88, 0.4], hand: [0.8, 0.62], foot: [0.7, 0.91], body: [0.65, 0.58], ground: [0.5, 1], origin: [.5, 1], floor: [.5, 1], tackle: [.65, .58], slam: [.5, .5], trail: [.6, .6], aura: [.5,.5], smoke: [.6,.4], vent: [.6,.4], leaf: [.85,.4], fissure: [.8,1] }

/** Coordinates refer to visible artwork, not transparent texture padding. Facing +1 means right. */
export function createActor({ id, texture, position, height = 220, facing = 1, nativeFacing = 1, bounds, anchors = {}, layer, effectSpace, shape = 'ellipse' }) {
  const root = new Container(), pivot = new Container(), pose = new Container(), visual = new Container()
  root.position.copyFrom(position); root.addChild(pivot); pivot.addChild(pose); pose.addChild(visual); layer.addChild(root)
  const rect = bounds ?? { x: 0, y: 0, width: texture?.width ?? 80, height: texture?.height ?? 100 }
  const pixelScale = height / rect.height
  const width = rect.width * pixelScale
  let art
  if (texture) {
    art = new Sprite(texture); art.anchor.set(0, 0)
    art.scale.set(pixelScale)
    art.position.set(-(rect.x + rect.width / 2) * pixelScale, -(rect.y + rect.height) * pixelScale)
    texture.source.scaleMode = 'nearest'
  } else {
    art = new Graphics()
    if (shape === 'wide') art.roundRect(-width / 2, -height, width, height, 18).fill(0x91b8bd)
    else art.ellipse(0, -height / 2, width / 2, height / 2).fill(0xbaafda)
  }
  visual.scale.x = facing / nativeFacing
  visual.addChild(art)
  const defaults = Object.fromEntries(Object.entries(DEFAULT_ANCHORS).map(([key, [u, v]]) => [key, [nativeFacing < 0 ? 1 - u : u, v]]))
  const sockets = { ...defaults, ...anchors, visualCenter: [.5, .5] }
  const [originU, originV] = sockets.origin
  const pivotX = (originU - .5) * width * facing / nativeFacing, pivotY = (originV - 1) * height
  pivot.position.set(pivotX, pivotY); visual.position.set(-pivotX, -pivotY)
  const initial = { ...position }
  const actor = {
    id, root, pose, metrics: Object.freeze({ width, height }), facing,
    hasAnchor(name) { return Object.hasOwn(sockets, name) },
    anchor(name = 'center') {
      const [u, v] = sockets[name] ?? sockets.center
      return effectSpace.toLocal({ x: (u - 0.5) * width, y: (v - 1) * height }, visual)
    },
    base(name = 'ground') {
      const [u, v] = sockets[name] ?? sockets.center
      return { x: initial.x + (u - 0.5) * width * facing / nativeFacing, y: initial.y + (v - 1) * height }
    },
    resetPose() { pose.position.set(0, 0); pose.scale.set(1); pose.rotation = 0; pose.alpha = 1; pose.tint = 0xffffff },
    snapshot() {
      // Copy the display tree's pose into effect-space; never transfer the shared texture's ownership.
      const copy = new Container(), clone = texture ? new Sprite(texture) : art.clone()
      if (texture) { clone.anchor.copyFrom(art.anchor); clone.position.copyFrom(art.position); clone.scale.copyFrom(art.scale) }
      const flip = new Container(); flip.scale.x = visual.scale.x; flip.position.copyFrom(visual.position); flip.addChild(clone); copy.addChild(flip)
      const p = effectSpace.toLocal({ x: 0, y: 0 }, pose)
      copy.position.copyFrom(p); copy.rotation = pose.rotation; copy.scale.copyFrom(pose.scale)
      return copy
    },
    destroy() { root.destroy({ children: true }) },
  }
  return actor
}
