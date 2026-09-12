import { Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration waterMoves.js. Shapes, particle laws and choreography are move-owned.
export default function waterfall(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const sourceBaseScale=1, targetBaseScale=1, move={tint:context.tint}
  const impactGlow=new Sprite(glowTexture);impactGlow.anchor.set(.5);impactGlow.position.set(focus.x-10,focus.y);impactGlow.tint=move.tint;impactGlow.blendMode='add';impactGlow.width=330;impactGlow.height=240;impactGlow.alpha=0;temporary.addChild(impactGlow)
  const mouthGlow=new Sprite(glowTexture);mouthGlow.anchor.set(.5);mouthGlow.position.copyFrom(emission);mouthGlow.tint=0xff6c1d;mouthGlow.blendMode='add';mouthGlow.width=mouthGlow.height=150;mouthGlow.alpha=0;temporary.addChild(mouthGlow)
  onFrame(() => mouthGlow.position.copyFrom(socket('emission', true)))
  const emitter={strength:0};let spawnCarry=0

  function addHit(tl, move, at, { shake = 3, recoil = 13 } = {}) {
    tl.to(defender,{x:defenderHome.x+recoil,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .to(world,{x:shake,y:-shake/2,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .call(()=>{onCue({type:'impact'});defender.tint=move.tint},[],at)
      .call(()=>{defender.tint=0xffffff},[],at+.24)
      .set(defender,{x:defenderHome.x},at+.5).set(world,{x:0,y:0},at+.5)
  }

  
  const mouth = lean => ({ x: home.x + lean + emission.x, y: home.y + emission.y })
function charge(tl, size, alpha, fadeAt) {
    const light = new Sprite(glowTexture)
    light.anchor.set(0.5)
    light.width = size
    light.height = size * 0.9
    light.tint = 0x9ceaff
    light.alpha = 0
    light.blendMode = 'add'
    temporary.addChild(light)
    const follow = () => light.position.set(attacker.x + emission.x, attacker.y + emission.y)
    follow()
    tl.to(light, { alpha, duration: 0.3 }, 0.1)
      .to(light, { alpha: 0, duration: 0.3 }, fadeAt)
    return follow
  }

function waterfall(tl, move) {
    const center = focus.x + 8, top = focus.y - 246, bottom = floor.y, width = 210, contact = 0.78
    // Waterfall has smooth sampling and continuous coordinates; Surf keeps its pixel style.
    assets.waterfall.source.scaleMode = 'linear'
    const follow = charge(tl, 85, 0.28, 0.5)
    tl.to(attacker, { x: home.x - 8, rotation: -0.02, duration: 0.24, onUpdate: follow }, 0)
      .to(attacker, { x: home.x + 5, rotation: 0, duration: 0.16, onUpdate: follow }, 0.24)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: follow }, 1.05)

    // All ground water is animated geometry. The stream image contains no baked-in splash.
    const pool = new Graphics()
    pool.label = 'waterfall-whitewater'
    pool.alpha = 0
    temporary.addChild(pool)
    const wash = { reach: 0, phase: 0 }
    const drawPool = () => {
      pool.clear()
      for (const [radius, color, alpha] of [[78, 0x239ed9, 0.26], [57, 0x74dcef, 0.52], [38, 0xe1fbff, 0.72]]) {
        for (let j = 0; j <= 48; j++) {
          const a = j / 48 * Math.PI * 2
          const churn = 1 + Math.sin(a * 5 + wash.phase) * 0.1 + Math.cos(a * 3 - wash.phase * 1.3) * 0.06
          const x = center + Math.cos(a) * radius * wash.reach * churn
          const y = bottom + Math.sin(a) * radius * 0.22 * wash.reach * churn
          if (j === 0) pool.moveTo(x, y)
          else pool.lineTo(x, y)
        }
        pool.closePath().fill({ color, alpha })
      }
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI * 2 / 10 + wash.phase * 0.12
        const radius = (32 + Math.sin(wash.phase + i) * 12) * wash.reach
        const x = center + Math.cos(angle) * radius
        const y = bottom - 2 + Math.sin(angle) * radius * 0.25
        pool.moveTo(x - 5, y).quadraticCurveTo(x, y - 3, x + 6, y + 1)
          .stroke({ color: 0xf0fdff, width: 1.7, alpha: 0.75, cap: 'round' })
      }
    }

    // Successive wave fronts keep spreading after the falling stream has drained.
    for (let i = 0; i < 7; i++) {
      const ring = new Graphics().ellipse(0, 0, 25, 7)
        .stroke({ color: i % 2 ? 0xb6f1ff : 0x70d5ef, width: 1.6, alpha: 0.75 })
        .ellipse(0, 2, 22, 5).stroke({ color: 0xf3fdff, width: 0.8, alpha: 0.45 })
      ring.label = 'waterfall-ripple'
      ring.position.set(center, (floor.y - 2))
      ring.alpha = 0
      temporary.addChild(ring)
      const at = 0.87 + i * 0.205
      tl.to(ring, { alpha: 0.76, y: (floor.y + 6) + i, duration: 0.16 }, at)
        .to(ring.scale, { x: 4.6 + i % 2 * 0.4, y: 2.7, duration: 0.84, ease: 'power1.out' }, at)
        .to(ring, { alpha: 0, duration: 0.55 }, at + 0.29)
    }

    const curtain = new Container()
    curtain.label = 'waterfall-curtain'
    curtain.alpha = 0
    temporary.addChild(curtain)
    // Crop two ordinary sprites into the revealed interval. Wrapping the image
    // needs at most two slices and never changes the scene's stencil state.
    const image = assets.waterfall, streamHeight = bottom - top
    const flowingBody = new Container()
    flowingBody.label = 'waterfall-flowing-body'
    curtain.addChild(flowingBody)
    const slices = Array.from({ length: 2 }, () => {
      const texture = new Texture({ source: image.source, frame: image.frame.clone(), dynamic: true })
      const sprite = new Sprite(texture)
      sprite.label = 'waterfall-flow-slice'
      sprite.visible = false; sprite.alpha = .88
      sprite.scale.set(width / image.width, streamHeight / image.height)
      sprite.once('destroyed', () => texture.destroy(false))
      flowingBody.addChild(sprite)
      return sprite
    })
    const current = new Graphics()
    current.label = 'waterfall-current'
    curtain.addChild(current)
    const flow = { front: top, tail: top, phase: 0 }
    const drawClip = () => {
      const start = Math.max(top, flow.tail), end = Math.min(bottom, flow.front)
      let y = start
      for (const sprite of slices) {
        let offset = ((y - top - flow.phase) % streamHeight + streamHeight) % streamHeight
        if (streamHeight - offset < .00001) offset = 0
        const height = Math.max(0, Math.min(end - y, streamHeight - offset))
        sprite.visible = height > .00001
        if (!sprite.visible) continue
        sprite.texture.frame.copyFrom(new Rectangle(image.frame.x, image.frame.y + offset / streamHeight * image.height,
          image.width, height / streamHeight * image.height))
        sprite.texture.update()
        sprite.position.set(center - width / 2, y)
        y += height
      }
      drawCurrent()
    }
    const drawCurrent = () => {
      current.clear()
      const start = Math.max(top, flow.tail), end = Math.min(bottom, flow.front)
      if (end <= start) return
      for (let i = 0; i < 18; i++) {
        const x = center - 42 + i % 7 * 14
        const y = top - 52 + (i * 61 + flow.phase) % (bottom - top + 60)
        const length = Math.min(14 + i % 4 * 6, bottom - 4 - y)
        if (length <= 0) continue
        // Exact sub-curve: the original quadratic has linear Y progression.
        const a = Math.max(0, (start - y) / length), b = Math.min(1, (end - y) / length)
        if (b <= a) continue
        const curveX = t => x + 5 * t - 6.5 * t * t
        current.moveTo(curveX(a), y + a * length)
          .quadraticCurveTo(curveX(a) + (b - a) * (5 - 13 * a) / 2, y + (a + b) * length / 2, curveX(b), y + b * length)
          .stroke({ color: i % 3 ? 0xb5edff : 0xf0fcff, width: 1 + i % 3 * 0.6, alpha: 0.4, cap: 'round' })
      }
    }
    drawClip()

    function crash(at, count, y, spread) {
      for (let i = 0; i < count; i++) {
        const size = 1.8 + i % 3 * 0.6
        const drop = new Graphics().ellipse(0, 0, size, size * 1.9)
          .fill({ color: i % 3 ? 0x91ddf5 : 0xe9fcff, alpha: 0.88 })
        drop.label = 'waterfall-droplet'
        drop.alpha = 0
        const x = center + (i % 5 - 2) * 9
        drop.position.set(x, y)
        temporary.addChild(drop)
        const state = { p: 0 }
        const dx = (i % 2 ? 1 : -1) * spread * (0.4 + i % 7 * 0.1)
        const lift = 16 + i % 5 * 8
        const duration = 0.42 + i % 4 * 0.06
        const launch = at + i % 4 * 0.015
        tl.set(drop, { alpha: 0.9 }, launch)
          .to(state, { p: 1, duration, ease: 'none', onUpdate: () => {
            const p = state.p
            drop.position.set(x + dx * p, y - 4 * lift * p * (1 - p) + 34 * p * p)
            // Turn the elongated droplet along its instantaneous ballistic direction.
            drop.rotation = Math.atan2(-4 * lift + (8 * lift + 68) * p, dx) - Math.PI / 2
          } }, launch)
          .to(drop.scale, { x: 0.6, y: 0.75, duration, ease: 'none' }, launch)
          .to(drop, { alpha: 0, duration: 0.22 }, launch + duration - 0.22)
      }
    }

    tl.to(curtain, { alpha: 1, duration: 0.08 }, 0.32)
      .to(flow, { front: focus.y, duration: 0.42, ease: 'power1.in', onUpdate: drawClip }, 0.36)
      .to(flow, { front: bottom, duration: 0.12, ease: 'none', onUpdate: drawClip }, contact)
      .to(flow, { phase: 1188, duration: 2.2, ease: 'none', onUpdate: drawClip }, 0.36)
      .to(flow, { tail: bottom, duration: 0.38, ease: 'power1.in', onUpdate: drawClip }, 1.92)
      .set(curtain, { alpha: 0 }, 2.3)
      .to(pool, { alpha: 0.85, duration: 0.16 }, 0.86)
      .to(wash, { reach: 1, duration: 0.36, ease: 'power2.out', onUpdate: drawPool }, 0.86)
      .to(wash, { phase: 30, duration: 2.08, ease: 'none', onUpdate: drawPool }, 0.86)
      .to(wash, { reach: 1.25, duration: 0.74, ease: 'power1.out', onUpdate: drawPool }, 2.12)
      .to(pool, { alpha: 0, duration: 0.62 }, 2.3)
      .to(impactGlow, { alpha: 0.18, duration: 0.1 }, contact)
      .to(impactGlow, { alpha: 0, duration: 0.34 }, 1.04)
    crash(contact, 18, focus.y, 70)
    for (const at of [0.94, 1.22, 1.5, 1.78, 2.06]) crash(at, 10, bottom - 4, 92)
    addHit(tl, move, contact, { recoil: 9, shake: 2.5, duration: 0.85 })
    tl.call(() => {}, [], 3.15)
  }
  waterfall(tl,move)
}
