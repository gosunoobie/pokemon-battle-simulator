import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration fireMoves.js. Shapes, particle laws and choreography are move-owned.
export default function blastBurn(context) {
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

  
  const particles = []
  function burst(x, y, tint, count = 30, speed = 220) {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2, velocity = speed * (0.4 + random() * 0.6)
      const sprite = new Sprite(glowTexture); sprite.anchor.set(.5); sprite.position.set(x,y); sprite.tint=tint; sprite.blendMode='add'; temporary.addChild(sprite)
      particles.push({sprite,age:0,life:.35+random()*.35,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,size:7+random()*15,ember:true,phase:angle})
    }
  }
  let particleTime = 0
  onFrame(time => {
    const dt = Math.max(0, Math.min(time - particleTime, .05)); particleTime=time

    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.age+=dt; const progress=p.age/p.life
      if(progress>=1){p.sprite.destroy();particles.splice(i,1);continue}
      p.sprite.x+=p.vx*dt; p.sprite.y+=p.vy*dt+Math.sin(p.phase+p.age*22)*15*dt
      p.sprite.rotation=Math.atan2(p.vy,p.vx)
      p.sprite.alpha=Math.min(1,p.age*20)*Math.pow(1-progress,.65)*(p.ember?1:.85)
      const spread=1+progress*(p.ember?.2:2.4)
      p.sprite.width=p.size*spread*1.6;p.sprite.height=p.size*spread*.75
    }
  })

function glow(parent, width, height, tint, alpha = 1) {
    const sprite = new Sprite(glowTexture)
    sprite.anchor.set(0.5)
    sprite.width = width
    sprite.height = height
    sprite.tint = tint
    sprite.alpha = alpha
    sprite.blendMode = 'add'
    parent.addChild(sprite)
    return sprite
  }
function blastBurn(tl, move) {
    const source = socket('fissure')
    const target = { x: (focus.x), y: (floor.y - 5) }
    const chargeRing = new Graphics().ellipse(0, 0, 70, 18).stroke({ color: 0xffa43a, alpha: 0.8, width: 3 })
    chargeRing.position.set(home.x, home.y - 4)
    chargeRing.alpha = 0
    temporary.addChild(chargeRing)
    tl.to(attacker.scale, { y: sourceBaseScale * 0.94, duration: 0.24 }, 0)
      .to(attacker.scale, { y: sourceBaseScale, duration: 0.1 }, 0.48)
      .to(chargeRing, { alpha: 0.8, duration: 0.18 }, 0.12)
      .to(chargeRing.scale, { x: 1.6, y: 1.4, duration: 0.38 }, 0.12)
      .to(chargeRing, { alpha: 0, duration: 0.2 }, 0.45)

    const point = i => ({
      x: source.x + (target.x - source.x) * i / 8,
      y: source.y + (target.y - source.y) * i / 8 + (i === 0 || i === 8 ? 0 : (i % 2 ? -12 : 12)),
    })
    for (let i = 0; i < 8; i++) {
      const a = point(i)
      const b = point(i + 1)
      const crack = new Graphics()
      for (const [width, color, alpha] of [[16, 0xff4e19, 0.2], [5, 0xffb33f, 0.9], [1.5, 0xffefab, 1]]) {
        crack.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, alpha, cap: 'round' })
      }
      crack.alpha = 0
      temporary.addChild(crack)
      tl.to(crack, { alpha: 1, duration: 0.045 }, 0.5 + i * 0.065)
        .to(crack, { alpha: 0, duration: 0.5 }, 1.4)
    }

    // Ground-level detonation: seven upright plumes and two flat shock rings.
    for (let i = 0; i < 7; i++) {
      const plume = new Container()
      plume.position.set(target.x + (i - 3) * 25, target.y)
      plume.alpha = 0
      plume.scale.y = 0.04
      temporary.addChild(plume)
      const height = 155 + (3 - Math.abs(i - 3)) * 20
      const outer = glow(plume, 72, height, 0xff521b, 0.72)
      const inner = glow(plume, 30, height * 0.74, 0xffe38b, 0.9)
      outer.anchor.y = inner.anchor.y = 1
      const at = 1.02 + Math.abs(i - 3) * 0.035
      tl.to(plume, { alpha: 0.85, duration: 0.08 }, at)
        .to(plume.scale, { y: 1.1, duration: 0.22, ease: 'power3.out' }, at)
        .to(plume, { alpha: 0, y: target.y - 25, duration: 0.65 }, at + 0.48)
    }
    for (let i = 0; i < 2; i++) {
      const ring = new Graphics().ellipse(0, 0, 70, 22).stroke({ color: i ? 0xffeaa0 : 0xffa333, width: i ? 3 : 5, alpha: 0.85 })
      ring.position.set(target.x, target.y)
      ring.alpha = 0
      temporary.addChild(ring)
      const at = 1.02 + i * 0.15
      tl.to(ring, { alpha: 0.85, duration: 0.06 }, at)
        .to(ring.scale, { x: 2.6, y: 2.6, duration: 0.6, ease: 'power2.out' }, at)
        .to(ring, { alpha: 0, duration: 0.5 }, at + 0.1)
    }
    impactGlow.width = 410
    impactGlow.height = 320
    tl.call(() => burst((focus.x), (focus.y + 8), 0xffb54c, 64, 285), [], 1.02)
      .to(impactGlow, { alpha: 0.65, duration: 0.14 }, 1.02)
      .to(impactGlow, { alpha: 0, duration: 0.7 }, 1.45)
    addHit(tl, move, 1.02, { recoil: 23, shake: 5, duration: 0.95 })
    // A longer quiet recovery sells the weight; it does not implement a recharge turn.
    tl.call(() => {}, [], 3.05)
  }
  blastBurn(tl,move)
}
