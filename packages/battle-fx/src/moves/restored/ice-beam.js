import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration iceMoves.js. Shapes, particle laws and choreography are move-owned.
export default function iceBeam(context) {
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

  

function glow(x, y, width, height, tint = 0xb6edff) {
    const sprite = new Sprite(glowTexture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    sprite.tint = tint
    sprite.alpha = 0
    sprite.blendMode = 'add'
    temporary.addChild(sprite)
    return sprite
  }

function crystal(width, height, tint = 0xace9ff) {
    return new Graphics().poly([0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0])
      .fill({ color: tint, alpha: 0.8 }).stroke({ color: 0xeffcff, width: 1.2, alpha: 0.9 })
  }

function shards(tl, x, y, at, count = 18, spread = 100) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count
      const distance = spread * (0.55 + (i % 4) * 0.15)
      const duration = 0.5 + (i % 4) * 0.06
      const shard = crystal(7 + (i % 3) * 3, 19 + (i % 4) * 5)
      const state = { progress: 0 }
      shard.position.set(x, y)
      shard.rotation = angle
      shard.alpha = 0
      temporary.addChild(shard)
      tl.to(shard, { alpha: 0.9, duration: 0.05 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          shard.position.set(x + Math.cos(angle) * distance * p, y + Math.sin(angle) * distance * p + 55 * p * p)
          shard.rotation = angle + (i % 2 ? -2 : 2) * p
        } }, at)
        .to(shard, { alpha: 0, duration: 0.22 }, at + duration - 0.22)
    }
  }

function iceBeam(tl, move) {
    const beam = new Graphics()
    beam.alpha = 0
    temporary.addChild(beam)
    const charge = glow(0, 0, 118, 105)
    const followMouth = () => charge.position.set(attacker.x + emission.x, attacker.y + emission.y)
    followMouth()
    const state = { reach: 0 }
    const draw = () => {
      beam.clear()
      for (const [width, color, alpha] of [[32, 0x60c7ff, 0.18], [13, 0xacebff, 0.85], [4, 0xf4fdff, 1]]) {
        beam.moveTo(charge.x, charge.y)
          .lineTo(charge.x + (focus.x - charge.x) * state.reach, charge.y + (focus.y - charge.y) * state.reach)
          .stroke({ width, color, alpha, cap: 'round' })
      }
    }
    tl.to(attacker, { x: home.x - 13, duration: 0.28, onUpdate: followMouth }, 0)
      .to(attacker, { x: home.x + 9, duration: 0.2, onUpdate: followMouth }, 0.28)
      .to(charge, { alpha: 0.75, duration: 0.32 }, 0.12)
      .to(beam, { alpha: 0.95, duration: 0.08 }, 0.5)
      .to(state, { reach: 1, duration: 0.18, ease: 'none', onUpdate: draw }, 0.5)
      .to(impactGlow, { alpha: 0.48, duration: 0.16 }, 0.68)
      .to(beam, { alpha: 0, duration: 0.3 }, 1.4)
      .to(charge, { alpha: 0, duration: 0.3 }, 1.4)
      .to(impactGlow, { alpha: 0, duration: 0.5 }, 1.4)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: followMouth }, 1.75)
    // A temporary six-point crystal bloom breaks apart; it does not set a frozen condition.
    for (let i = 0; i < 6; i++) {
      const ice = crystal(17, 80, 0x9cddff)
      const angle = i * Math.PI / 3
      ice.position.set((focus.x) + Math.cos(angle) * 39, (focus.y) + Math.sin(angle) * 39)
      ice.rotation = angle + Math.PI / 2
      ice.scale.set(0.05)
      ice.alpha = 0
      temporary.addChild(ice)
      tl.to(ice, { alpha: 0.8, duration: 0.15 }, 0.68 + i * 0.025)
        .to(ice.scale, { x: 1, y: 1, duration: 0.3, ease: 'power2.out' }, 0.68 + i * 0.025)
        .to(ice, { alpha: 0, x: (focus.x) + Math.cos(angle) * 83, y: (focus.y + 16) + Math.sin(angle) * 83, duration: 0.4 }, 1.35)
    }
    shards(tl, (focus.x), (focus.y), 1.35, 20, 95)
    addHit(tl, move, 0.68, { recoil: 14, shake: 2, duration: 0.75 })
    tl.call(() => {}, [], 2.4)
  }
  iceBeam(tl,move)
}
