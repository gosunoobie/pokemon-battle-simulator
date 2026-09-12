import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration iceMoves.js. Shapes, particle laws and choreography are move-owned.
export default function auroraBeam(context) {
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
function auroraBeam(tl, move) {
    const beam = new Graphics()
    beam.alpha = 0
    temporary.addChild(beam)
    const charge = glow(0, 0, 112, 100, 0xe0c6ff)
    const state = { reach: 0, phase: 0 }
    const followMouth = () => charge.position.set(attacker.x + emission.x, attacker.y + emission.y)
    const draw = () => {
      beam.clear()
      const sx = charge.x, sy = charge.y
      const palette = [0x80edff, 0xa6ffc7, 0xffe6a3, 0xf3b1f0, 0xb9a4ff]
      for (let lane = 0; lane < palette.length; lane++) {
        for (const [width, alpha] of [[15, 0.1], [4, 0.85]]) {
          beam.moveTo(sx, sy)
          for (let j = 1; j <= 32; j++) {
            const p = state.reach * j / 32
            const wave = Math.sin(p * Math.PI * 5 + state.phase + lane * Math.PI * 2 / palette.length) * 17 * Math.sin(p * Math.PI)
            beam.lineTo(sx + (focus.x - sx) * p, sy + (focus.y - sy) * p + wave)
          }
          beam.stroke({ width, color: palette[lane], alpha, cap: 'round' })
        }
      }
    }
    followMouth()
    tl.to(attacker, { x: home.x - 10, duration: 0.25, onUpdate: followMouth }, 0)
      .to(attacker, { x: home.x + 6, duration: 0.18, onUpdate: followMouth }, 0.25)
      .to(charge, { alpha: 0.65, duration: 0.28 }, 0.12)
      .to(beam, { alpha: 0.9, duration: 0.08 }, 0.45)
      .to(state, { reach: 1, duration: 0.25, ease: 'power1.out', onUpdate: draw }, 0.45)
      .to(state, { phase: Math.PI * 3, duration: 1.25, ease: 'none', onUpdate: draw }, 0.45)
      .to(beam, { alpha: 0, duration: 0.35 }, 1.35)
      .to(charge, { alpha: 0, duration: 0.35 }, 1.35)
      .call(() => burst((focus.x), (focus.y), 0xd9d5ff, 24, 155), [], 0.7)
      .to(impactGlow, { alpha: 0.38, duration: 0.15 }, 0.7)
      .to(impactGlow, { alpha: 0, duration: 0.45 }, 1.2)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: followMouth }, 1.75)
    impactRing(tl, (focus.x), (focus.y), 0.7, 43, 0xe0c6ff)
    addHit(tl, move, 0.7, { recoil: 11, shake: 2, duration: 0.65 })
    tl.call(() => {}, [], 2.3)
  }
  auroraBeam(tl,move)
}
