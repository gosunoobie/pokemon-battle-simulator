import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration iceMoves.js. Shapes, particle laws and choreography are move-owned.
export default function icePunch(context) {
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

function impactRing(tl, x, y, at, radius, tint) {
    const ring = new Graphics().circle(0, 0, radius).stroke({ width: 3, color: tint, alpha: 0.85 })
    ring.position.set(x, y)
    ring.scale.set(0.45)
    ring.alpha = 0
    temporary.addChild(ring)
    tl.to(ring, { alpha: 0.65, duration: 0.08 }, at)
      .to(ring.scale, { x: 1.65, y: 1.65, duration: 0.5, ease: 'power2.out' }, at)
      .to(ring, { alpha: 0, duration: 0.36 }, at + 0.14)
  }
function icePunch(tl, move) {
    const fist = new Container()
    temporary.addChild(fist)
    const fistGlow = glow(0, 0, 86, 78)
    fist.addChild(fistGlow)
    const cuff = new Graphics().circle(0, 0, 23).stroke({ color: 0xd9f9ff, width: 3, alpha: 0.85 })
    cuff.alpha = 0
    fist.addChild(cuff)
    const followFist = () => {
      const dx = socket('hand').x, dy = socket('hand').y
      const c = Math.cos(attacker.rotation), s = Math.sin(attacker.rotation)
      fist.position.set(attacker.x + dx * c - dy * s, attacker.y + dx * s + dy * c)
      fist.rotation = attacker.rotation
    }
    followFist()
    const sweep = new Graphics()
    for (const [width, color, alpha] of [[30, 0x70cfff, 0.22], [12, 0xb6edff, 0.8], [3, 0xf4fdff, 1]]) {
      sweep.moveTo(-92, 30).quadraticCurveTo(-25, -34, 18, 0).stroke({ width, color, alpha, cap: 'round' })
    }
    sweep.position.set((focus.x - 3), (focus.y + 7))
    sweep.alpha = 0
    sweep.scale.x = 0.1
    temporary.addChild(sweep)
    tl.to(attacker, { x: home.x - 20, rotation: -0.09, duration: 0.18, onUpdate: followFist }, 0)
      .to(fistGlow, { alpha: 0.75, duration: 0.18 }, 0.08)
      .to(cuff, { alpha: 0.8, duration: 0.18 }, 0.08)
      .to(attacker, { ...solveContact('hand', 0.07, {x:focus.x+(-3.80586277568716),y:focus.y+(5.163820637595279)}), duration: 0.32, ease: 'power3.in', onUpdate: followFist }, 0.18)
      .to(sweep, { alpha: 0.9, duration: 0.06 }, 0.4)
      .to(sweep.scale, { x: 1, duration: 0.1 }, 0.4)
      .to(sweep, { alpha: 0, duration: 0.3 }, 0.54)
      .to(fistGlow, { alpha: 0, duration: 0.25 }, 0.6)
      .to(cuff, { alpha: 0, duration: 0.25 }, 0.6)
      .to(impactGlow, { alpha: 0.48, duration: 0.08 }, 0.5)
      .to(impactGlow, { alpha: 0, duration: 0.32 }, 0.64)
      .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: 0.5, ease: 'power2.inOut', onUpdate: followFist }, 0.82)
    shards(tl, (focus.x - 3), (focus.y + 7), 0.5, 18, 105)
    impactRing(tl, (focus.x - 3), (focus.y + 7), 0.5, 38, 0xd9f9ff)
    addHit(tl, move, 0.5, { recoil: 20, shake: 3, duration: 0.55 })
    tl.call(() => {}, [], 1.7)
  }
  icePunch(tl,move)
}
