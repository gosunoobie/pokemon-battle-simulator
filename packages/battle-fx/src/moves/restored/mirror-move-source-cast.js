import { Container, Graphics } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// This source-only casting gate precedes the engine's separate copied move.
// It contains no copied-move lookup or opponent-directed attack geometry.
export default function mirrorMoveSourceCast(context) {
  const { tl, onFrame, onCue } = context
  const { temporary, socket, unit } = bindEffectSpace(context)
  const edges = [-temporary.x / temporary.scale.x, (context.scene.width - temporary.x) / temporary.scale.x]
  const left = Math.min(...edges), right = Math.max(...edges)
  const top = -temporary.y / unit, bottom = (context.scene.height - temporary.y) / unit
  const clamp = n => Math.max(0, Math.min(1, n))
  const root = new Container(); root.label = 'mirror-move-source-cast-root'; temporary.addChild(root)
  const frame = new Graphics(); frame.label = 'mirror-move-source-cast-frame'; root.addChild(frame)
  const reflections = new Graphics(); reflections.label = 'mirror-move-source-cast-reflections'; root.addChild(reflections)
  const glints = new Graphics(); glints.label = 'mirror-move-source-cast-glints'; root.addChild(glints)
  function update(time) {
    const center = socket('emission', true)
    root.position.copyFrom(center)
    root.scale.set(Math.max(0, Math.min(1, (center.x - left - 4) / 76, (right - center.x - 4) / 76,
      (center.y - top - 4) / 82, (bottom - center.y - 4) / 82)))
    root.alpha = time >= .025 && time < 1.34 ? Math.min(1, (time - .025) / .16, (1.34 - time) / .3) : 0
    const open = clamp(time / .38), release = clamp((time - .65) / .5), width = 8 + open * 25
    frame.clear().poly([0, -48, width, 0, 0, 48, -width, 0]).fill({ color: 0x9abedc, alpha: .16 })
      .stroke({ color: 0xdaeffc, width: 2.2, alpha: .93 })
      .poly([0, -36, width * .72, 0, 0, 36, -width * .72, 0]).stroke({ color: 0x789cbf, width: 1.1, alpha: .72 })
    reflections.clear()
    for (let side of [-1, 1]) {
      const x = side * (12 + release * 29), height = 35 - release * 6
      reflections.poly([x, -height, x + side * 14, -height + 12, x + side * 14, height - 12, x, height])
        .fill({ color: side < 0 ? 0xb2cbe5 : 0xe0f1fb, alpha: .14 })
        .stroke({ color: 0xc4e4f6, width: 1.4, alpha: .65 })
    }
    glints.clear()
    const y = -29 + (time * 53 % 58), pulse = Math.max(0, 1 - Math.abs(time - .65) / .23)
    glints.moveTo(-10, y - 6).lineTo(10, y + 6).stroke({ color: 0xffffff, width: 2.5, alpha: .84 })
    for (let i = 0; i < 4; i++) {
      const theta = i * Math.PI / 2, r = 48 + release * 12, x = Math.cos(theta) * r, y = Math.sin(theta) * r
      glints.moveTo(x - 3 - pulse * 3, y).lineTo(x + 3 + pulse * 3, y)
        .moveTo(x, y - 5 - pulse * 3).lineTo(x, y + 5 + pulse * 3)
        .stroke({ color: 0xecfaff, width: 1.3, alpha: .4 + pulse * .6 })
    }
  }
  onFrame(update)
  tl.call(() => { update(.65); onCue({ type: 'impact' }) }, [], .65).call(() => {}, [], 1.4)
}
