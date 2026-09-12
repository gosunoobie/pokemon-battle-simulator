import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function solarBeam(context) {
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

function solarBeam(tl, move) {
    const mouthOffset = { x: emission.x, y: emission.y }
    const target = { x: (focus.x), y: (focus.y - 2) }
    const source = { x: home.x + 10 + mouthOffset.x, y: home.y + mouthOffset.y }
    const charge = new Container()
    temporary.addChild(charge)
    const followMouth = () => charge.position.set(attacker.x + mouthOffset.x, attacker.y + mouthOffset.y)
    followMouth()

    const orb = new Container()
    orb.alpha = 0
    orb.scale.set(0.1)
    charge.addChild(orb)
    for (const [size, tint] of [[145, 0x91ce4b], [86, 0xf3ef83], [32, 0xffffe6]]) {
      const glow = new Sprite(glowTexture)
      glow.anchor.set(0.5)
      glow.width = glow.height = size
      glow.tint = tint
      glow.blendMode = 'add'
      orb.addChild(glow)
    }
    const chargeRing = new Graphics().circle(0, 0, 52).stroke({ color: 0xeafa9b, width: 2, alpha: 0.65 })
    chargeRing.label = 'solar-charge-ring'
    chargeRing.alpha = 0
    chargeRing.scale.set(1.45)
    charge.addChild(chargeRing)
    for (let i = 0; i < 18; i++) {
      const mote = new Sprite(glowTexture)
      const angle = i * Math.PI * 2 / 18
      const radius = 70 + (i % 3) * 20
      mote.anchor.set(0.5)
      mote.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius)
      mote.width = mote.height = 9 + (i % 3) * 3
      mote.tint = i % 2 ? 0xeafa9b : 0xfff5ac
      mote.blendMode = 'add'
      mote.alpha = 0
      charge.addChild(mote)
      const at = 0.08 + i * 0.036
      tl.to(mote, { alpha: 0.9, duration: 0.06 }, at)
        .to(mote, { x: 0, y: 0, duration: 0.28, ease: 'power2.in' }, at)
        .to(mote, { alpha: 0, duration: 0.06 }, at + 0.24)
    }

    // The source is at the mouth after the forward lean; the attacker holds this pose during firing.
    const beam = new Graphics()
    const length = Math.hypot(target.x - source.x, target.y - source.y)
    for (const [width, color, alpha] of [[80, 0x92ce4b, 0.13], [42, 0xe7ed78, 0.55], [12, 0xffffdf, 0.95]]) {
      beam.moveTo(0, 0).lineTo(length, 0).stroke({ width, color, alpha, cap: 'round' })
    }
    beam.position.set(source.x, source.y)
    beam.rotation = Math.atan2(target.y - source.y, target.x - source.x)
    beam.scale.set(0.001, 0.3)
    beam.alpha = 0
    beam.blendMode = 'add'
    temporary.addChild(beam)
    const ring = new Graphics().circle(0, 0, 42).stroke({ width: 3, color: 0xf1f7ac, alpha: 0.8 })
    ring.position.set(target.x, target.y)
    ring.alpha = 0
    temporary.addChild(ring)

    tl.to(attacker, { x: home.x - 12, duration: 0.32, onUpdate: followMouth }, 0)
      .to(orb, { alpha: 0.9, duration: 0.3 }, 0.06)
      .to(orb.scale, { x: 1, y: 1, duration: 0.9, ease: 'power2.in' }, 0.06)
      .to(chargeRing, { alpha: 1, duration: 0.12 }, 0.14)
      .to(chargeRing.scale, { x: 0.5, y: 0.5, duration: 0.82, ease: 'power1.in' }, 0.14)
      .to(chargeRing, { alpha: 0, duration: 0.15 }, 0.84)
      .to(attacker, { x: home.x + 10, duration: 0.14, ease: 'power2.out', onUpdate: followMouth }, 1)
      .to(beam, { alpha: 0.85, duration: 0.04 }, 1.14)
      .to(beam.scale, { x: 1, y: 1, duration: 0.12, ease: 'power3.out' }, 1.14)
      .to(impactGlow, { alpha: 0.6, duration: 0.12 }, 1.26)
      .call(() => burst(target.x, target.y, move.tint, 38, 210), [], 1.26)
      .to(ring, { alpha: 0.65, duration: 0.06 }, 1.26)
      .to(ring.scale, { x: 2.1, y: 2.1, duration: 0.42, ease: 'power2.out' }, 1.26)
      .to(ring, { alpha: 0, duration: 0.32 }, 1.36)
      .to(beam.scale, { y: 0.88, duration: 0.16, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 1.38)
      .to(beam, { alpha: 0, duration: 0.3 }, 2.05)
      .to(beam.scale, { y: 0.05, duration: 0.3, ease: 'power2.in' }, 2.05)
      .to(orb, { alpha: 0, duration: 0.3 }, 2.05)
      .to(impactGlow, { alpha: 0, duration: 0.45 }, 2.02)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: followMouth }, 2.35)
    addHit(tl, move, 1.26, { shake: 3, recoil: 18, duration: 0.8 })
    tl.call(() => {}, [], 2.9)
  }
  solarBeam(tl,move)
}
