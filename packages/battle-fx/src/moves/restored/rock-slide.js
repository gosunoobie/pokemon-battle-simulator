import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration earthMoves.js. Shapes, particle laws and choreography are move-owned.
export default function rockSlide(context) {
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
function rockSlide(tl, move) {
    tl.to(attacker, { x: home.x - 10, rotation: -0.03, duration: 0.18 }, 0)
      .to(attacker, { x: home.x + 8, rotation: 0.025, duration: 0.16, ease: 'power2.out' }, 0.18)
      .to(attacker, { x: home.x, rotation: 0, duration: 0.3 }, 1.2)

    for (let i = 0; i < 7; i++) {
      const target = { x: (focus.x) + ((i % 3) - 1) * 46, y: (focus.y + 2) + (i % 2) * 22 }
      const size = 55 + (i % 3) * 10
      const at = 0.32 + i * 0.09
      const duration = 0.55 + (i % 3) * 0.025
      const contact = at + duration
      const boulder = rock(target.x + 46, (focus.y - 294) - (i % 3) * 18, size, i % 2 ? 0xbfa787 : 0xd1b997)
      boulder.rotation = i * 0.4
      const shadow = new Graphics().ellipse(0, 0, size * 0.6, size * 0.15).fill({ color: 0x292b22, alpha: 0.32 })
      shadow.position.set(target.x, (floor.y - 4))
      shadow.scale.set(0.35)
      shadow.alpha = 0
      temporary.addChild(shadow)
      tl.to(boulder, { alpha: 1, duration: 0.05 }, at)
        .to(boulder, { x: target.x, y: target.y, rotation: boulder.rotation + (i % 2 ? -1 : 1) * 1.6, duration, ease: 'power2.in' }, at)
        .to(shadow, { alpha: 0.8, duration }, at)
        .to(shadow.scale, { x: 1, y: 1, duration }, at)
        .set(boulder, { alpha: 0 }, contact)
        .to(shadow, { alpha: 0, duration: 0.25 }, contact)

      for (let j = 0; j < 6; j++) {
        const angle = j * Math.PI * 2 / 6
        const distance = 36 + (j % 3) * 18
        const flight = 0.42 + (j % 2) * 0.12
        const fragment = rock(target.x, target.y, 12 + (j % 3) * 5, j % 2 ? 0xb49c7a : 0xd3c3a8)
        const state = { progress: 0 }
        tl.set(fragment, { alpha: 1 }, contact)
          .to(state, {
            progress: 1, duration: flight, ease: 'none',
            onUpdate: () => {
              const p = state.progress
              fragment.x = target.x + Math.cos(angle) * distance * p
              fragment.y = target.y + Math.sin(angle) * distance * p + 75 * p * p
              fragment.rotation = angle + p * 3
            },
          }, contact)
          .to(fragment, { alpha: 0, duration: 0.18 }, contact + flight - 0.18)
      }
      dust(tl, target.x, target.y + 20, contact, 5, 90)
    }
    tl.to(impactGlow, { alpha: 0.23, duration: 0.1 }, 0.87)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 1.25)
    addHit(tl, move, 0.87, { recoil: 14, shake: 3, duration: 0.8 })
    // Last boulder lands at 1.41 s; the final dust fades by 2.06 s.
    tl.call(() => {}, [], 2.35)
  }
  rockSlide(tl,move)
}
