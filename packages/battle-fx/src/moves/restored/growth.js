import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// A climbing sprout of light; sprite size stays unchanged.
export default function growth(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const art = new Container(); art.label = 'growth-sprout'; art.alpha = 0; temporary.addChild(art)
  const stem = new Graphics(); art.addChild(stem)
  const leaves = Array.from({ length: 8 }, (_, i) => {
    const leaf = new Graphics().moveTo(0, 0).quadraticCurveTo(23, -22, 30, -6).quadraticCurveTo(20, 6, 0, 0)
      .fill(i % 2 ? 0xbedf88 : 0xe3efa8).stroke({ color: 0xf8f7c8, width: 1, alpha: .5 })
    leaf.label = 'growth-leaf'; art.addChild(leaf); return leaf
  })
  const rings = [0, 1, 2].map(() => { const g = new Graphics().ellipse(0, 0, 56, 13).stroke({ color: 0xd9ed9e, width: 1.6 }); art.addChild(g); return g })
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges), top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  function update(time) {
    const p = socket('visualCenter', true), room = Math.max(0, Math.min(p.x - left, right - p.x, p.y - top, bottom - p.y) - 3)
    art.position.copyFrom(p); art.scale.set(Math.min(1, room / 106))
    const grow = Math.min(1, Math.max(0, (time - .1) / .82))
    stem.clear().moveTo(0, 69).bezierCurveTo(-16, 24, 19, -12, 0, 69 - 142 * grow).stroke({ color: 0xe7eaaa, width: 3, alpha: .8 })
    leaves.forEach((leaf, i) => { const age = time - .18 - i * .085, u = Math.max(0, Math.min(1, age / .3)); leaf.position.set(Math.sin(i * 1.3) * 7, 54 - i * 16 - Math.max(0, age - .6) * 9); leaf.rotation = (i % 2 ? Math.PI : 0) + Math.sin(time * 2 + i) * .09; leaf.scale.set(u * (.68 + i * .035)); leaf.alpha = u * .85 })
    rings.forEach((g, i) => { const age = Math.max(0, time - .25 - i * .18), phase = age % 1.25; g.y = 56 - phase * 108; g.scale.set(.5 + phase * .34); g.alpha = Math.sin(Math.PI * phase / 1.25) * .48 })
  }
  onFrame(update)
  tl.to(art, { alpha: 1, duration: .25 }, .05).to(art, { alpha: 0, duration: .48 }, 1.58)
    .call(() => { update(.86); onCue({ type: 'impact' }) }, [], .86)
}
