import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration iceMoves.js. Shapes, particle laws and choreography are move-owned.
export default function blizzard(context) {
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

function blizzard(tl, move) {
    const mist = glow((focus.x - 55), (focus.y - 25), 400, 210, 0xb6e6ff)
    mist.blendMode = 'normal'
    tl.to(attacker, { x: home.x - 12, duration: 0.24 }, 0)
      .to(attacker, { x: home.x + 8, duration: 0.2 }, 0.24)
      .to(mist, { alpha: 0.18, duration: 0.3 }, 0.44)
      .to(mist, { alpha: 0, duration: 0.5 }, 1.62)
      .to(attacker, { x: home.x, duration: 0.3 }, 1.7)
    for (let i = 0; i < 3; i++) {
      const wind = new Graphics()
      for (const [width, alpha] of [[15, 0.08], [3, 0.45]]) {
        wind.moveTo(0, 0).bezierCurveTo(180, -70, 380, 75, 560, -20)
          .stroke({ width, color: 0xc8f2ff, alpha, cap: 'round' })
      }
      wind.position.set((home.x + 48), (focus.y - 82) + i * 55)
      wind.alpha = 0
      wind.scale.x = 0.1
      temporary.addChild(wind)
      const at = 0.3 + i * 0.14
      tl.to(wind, { alpha: 0.7, duration: 0.16 }, at)
        .to(wind.scale, { x: 1, duration: 0.46, ease: 'power1.out' }, at)
        .to(wind, { alpha: 0, x: (home.x + (focus.x - home.x) * 0.23640167364), duration: 0.5 }, at + 0.55)
    }
    for (let i = 0; i < 72; i++) {
      const at = 0.36 + i * 0.014
      const duration = 0.62 + (i % 4) * 0.045
      const x = home.x + 78 - (i % 4) * 44
      const y = focus.y - 145 + (i * 43) % 175
      const snow = i % 3 === 0 ? crystal(6, 15, 0xc7f2ff)
        : new Graphics().circle(0, 0, 2 + (i % 3)).fill(0xf0fbff)
      const state = { progress: 0 }
      snow.position.set(x, y)
      snow.alpha = 0
      temporary.addChild(snow)
      tl.to(snow, { alpha: 0.75, duration: 0.06 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          snow.position.set(x + (focus.x - home.x + 132) * p, y + 36 * p + 26 * Math.sin(p * Math.PI * 2 + i) * Math.sin(p * Math.PI))
          snow.rotation = -0.7 + p * 2
        } }, at)
        .to(snow, { alpha: 0, duration: 0.18 }, at + duration - 0.18)
    }
    shards(tl, (focus.x), (focus.y + 5), 0.82, 22, 110)
    tl.to(impactGlow, { alpha: 0.4, duration: 0.2 }, 0.82)
      .to(impactGlow, { alpha: 0, duration: 0.6 }, 1.4)
    addHit(tl, move, 0.82, { recoil: 16, shake: 4, duration: 0.85 })
    tl.call(() => {}, [], 2.65)
  }
  blizzard(tl,move)
}
