import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function sludgeBomb(context) {
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

  

function sludgeBomb(tl, move) {
    const source = { x: home.x + 12 + emission.x, y: home.y + emission.y }
    const target = { x: (focus.x - 2), y: (focus.y - 2) }
    const bomb = new Container()
    bomb.position.set(source.x, source.y)
    bomb.alpha = 0
    temporary.addChild(bomb)
    const glob = new Graphics()
      .circle(-15, 7, 17).fill(0x673584)
      .circle(13, -7, 18).fill(0x673584)
      .circle(0, 0, 25).fill(0x8646a2)
      .ellipse(-7, -9, 11, 7).fill({ color: 0xd3a0e5, alpha: 0.75 })
      .circle(11, 10, 6).fill({ color: 0x48265d, alpha: 0.65 })
    bomb.addChild(glob)
    const flight = { progress: 0 }
    tl.to(attacker, { x: home.x - 14, duration: 0.2 }, 0)
      .to(attacker, { x: home.x + 12, duration: 0.16, ease: 'power2.out' }, 0.2)
      .to(bomb, { alpha: 1, duration: 0.06 }, 0.32)
      .fromTo(bomb.scale, { x: 0.65, y: 0.85 }, { x: 1, y: 1, duration: 0.12 }, 0.32)
      .to(flight, {
        progress: 1, duration: 0.64, ease: 'power1.in',
        onUpdate: () => {
          const p = flight.progress
          bomb.x = source.x + (target.x - source.x) * p
          bomb.y = source.y + (target.y - source.y) * p - 440 * p * (1 - p)
          bomb.rotation = p * Math.PI * 1.5
        },
      }, 0.38)
      .set(bomb, { alpha: 0 }, 1.02)

    // Opaque droplets and a short-lived pool give sludge weight; these are timeline paths, not fluid physics.
    const pool = new Graphics().ellipse(0, 0, 52, 13).fill({ color: 0x8945a5, alpha: 0.55 })
    pool.position.set(target.x, (floor.y - 5))
    pool.alpha = 0
    pool.scale.set(0.25)
    temporary.addChild(pool)
    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18
      const distance = 65 + (i % 4) * 24
      const duration = 0.5 + (i % 4) * 0.08
      const size = 4 + (i % 3) * 2.5
      const drop = new Graphics().ellipse(0, 0, size * 1.3, size).fill(i % 2 ? 0xb47bc9 : 0x7d429c)
      const state = { progress: 0 }
      drop.position.set(target.x, target.y)
      drop.alpha = 0
      temporary.addChild(drop)
      tl.set(drop, { alpha: 0.95 }, 1.02)
        .to(state, {
          progress: 1, duration, ease: 'none',
          onUpdate: () => {
            const p = state.progress
            drop.x = target.x + Math.cos(angle) * distance * p
            drop.y = target.y + Math.sin(angle) * distance * p + 55 * p * p
            drop.rotation = angle + p * 1.5
          },
        }, 1.02)
        .to(drop, { alpha: 0, duration: 0.22 }, 1.02 + duration - 0.22)
    }
    tl.to(pool, { alpha: 1, duration: 0.15 }, 1.08)
      .to(pool.scale, { x: 1.45, y: 1, duration: 0.45, ease: 'power2.out' }, 1.08)
      .to(pool, { alpha: 0, duration: 0.6 }, 1.35)
      .to(impactGlow, { alpha: 0.38, duration: 0.1 }, 1.02)
      .to(impactGlow, { alpha: 0, duration: 0.38 }, 1.22)
      .to(attacker, { x: home.x, duration: 0.3 }, 1.4)
    addHit(tl, move, 1.02, { shake: 3, recoil: 16, duration: 0.75 })
    tl.call(() => {}, [], 2.25)
  }
  sludgeBomb(tl,move)
}
