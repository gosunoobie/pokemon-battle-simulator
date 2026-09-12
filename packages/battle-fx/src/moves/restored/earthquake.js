import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration earthMoves.js. Shapes, particle laws and choreography are move-owned.
export default function earthquake(context) {
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

  

function rock(x, y, size, tint = 0xc1aa87) {
    const sprite = new Sprite(assets.rock)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.width = sprite.height = size
    sprite.tint = tint
    sprite.alpha = 0
    temporary.addChild(sprite)
    return sprite
  }

function dust(tl, x, y, at, count = 6, spread = 85) {
    for (let i = 0; i < count; i++) {
      const puff = new Sprite(glowTexture)
      const size = 24 + (i % 3) * 8
      const offset = (i / (count - 1) - 0.5) * spread
      puff.anchor.set(0.5)
      puff.position.set(x + offset * 0.18, y)
      puff.width = size * 1.6
      puff.height = size * 0.7
      puff.tint = i % 2 ? 0xbca98b : 0xd6c7a8
      puff.alpha = 0
      // Dust stays matte; additive blending would make it read as another fire effect.
      temporary.addChild(puff)
      tl.to(puff, { alpha: 0.22, duration: 0.08 }, at)
        .to(puff, { x: x + offset, y: y - 22 - (i % 3) * 10, width: size * 2.6, height: size * 1.6, duration: 0.65, ease: 'power2.out' }, at)
        .to(puff, { alpha: 0, duration: 0.45 }, at + 0.2)
    }
  }
function earthquake(tl, move) {
    const sourceFloor = socket('floor')
    // Preserve each authored crack's irregular offset while following the actual ground slope.
    const groundPoint = (x, y) => {
      const t = x / 495
      return [sourceFloor.x + (floor.x - sourceFloor.x) * t, sourceFloor.y + (floor.y - sourceFloor.y) * t + y + 67 * t]
    }
    tl.to(attacker, { y: home.y - 10, duration: 0.18, ease: 'power2.out' }, 0)
      .to(attacker, { y: home.y + 4, duration: 0.14, ease: 'power3.in' }, 0.18)
      .to(attacker, { y: home.y, duration: 0.08 }, 0.32)

    for (let i = 0; i < 4; i++) {
      const ripple = new Graphics().ellipse(0, 0, 80, 22)
        .stroke({ color: i % 2 ? 0xd5bb83 : 0x9e8157, width: i === 0 ? 4 : 2.5, alpha: 0.8 })
      ripple.position.set(sourceFloor.x + 36, sourceFloor.y - 8)
      ripple.scale.set(0.5)
      ripple.alpha = 0
      temporary.addChild(ripple)
      const at = 0.32 + i * 0.13
      tl.to(ripple, { alpha: 0.75, duration: 0.08 }, at)
        .to(ripple.scale, { x: 8, y: 5, duration: 0.9, ease: 'power2.out' }, at)
        .to(ripple, { alpha: 0, duration: 0.55 }, at + 0.35)
    }

    const points = [[58,-16],[128,-43],[213,-21],[283,-61],[358,-43],[438,-73],[513,-53],[583,-81]].map(([x,y]) => groundPoint(x,y))
    for (let i = 0; i < points.length - 1; i++) {
      const crack = new Graphics()
      for (const [width, color, alpha] of [[7, 0x342e22, 0.9], [2, 0xb99e6c, 0.8]]) {
        crack.moveTo(...points[i]).lineTo(...points[i + 1]).stroke({ width, color, alpha, cap: 'round' })
      }
      crack.alpha = 0
      temporary.addChild(crack)
      tl.to(crack, { alpha: 1, duration: 0.06 }, 0.36 + i * 0.045)
        .to(crack, { alpha: 0, duration: 0.5 }, 1.2)
    }

    for (let i = 0; i < 10; i++) {
      const [x, y] = groundPoint(108 + i * 49, -6 - i * 49 * .11)
      const pebble = rock(x, y, 8 + (i % 3) * 3)
      const state = { progress: 0 }
      const at = 0.4 + i * 0.045
      const direction = i % 2 ? 1 : -1
      tl.set(pebble, { alpha: 0.9 }, at)
        .to(state, {
          progress: 1, duration: 0.52, ease: 'none',
          onUpdate: () => {
            const p = state.progress
            pebble.x = x + direction * 20 * p
            pebble.y = y - 44 * Math.sin(p * Math.PI)
            pebble.rotation = direction * p * 3
          },
        }, at)
        .to(pebble, { alpha: 0, duration: 0.16 }, at + 0.36)
    }
    dust(tl, sourceFloor.x + 20, sourceFloor.y - 4, 0.32, 5, 55)
    dust(tl, ...groundPoint(178, -21), 0.55, 8, 100)
    dust(tl, ...groundPoint(368, -45), 0.65, 8, 100)
    dust(tl, ...groundPoint(495, -71), 0.75, 8, 100)
    tl.to(impactGlow, { alpha: 0.2, duration: 0.1 }, 0.66)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 0.88)
    addHit(tl, move, 0.66, { recoil: 10, shake: 4, duration: 0.8 })
    // addHit restores world at 1.16 s. Start this weaker aftershock afterward to avoid competing tweens.
    tl.to(world, { x: 2, y: 1, duration: 0.06, repeat: 5, yoyo: true, ease: 'none' }, 1.2)
      .set(world, { x: 0, y: 0 }, 1.58)
      .call(() => {}, [], 2.1)
  }
  earthquake(tl,move)
}
