import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function fireBlast(context) {
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

function fireBlast(tl, move) {
    const orb = new Container()
    orb.position.set(home.x + emission.x, home.y + emission.y)
    orb.alpha = 0
    temporary.addChild(orb)
    for (const [size, tint] of [[145, 0xff3a0c], [95, 0xffa125], [43, 0xfff4b5]]) {
      const glow = new Sprite(glowTexture)
      glow.anchor.set(0.5)
      glow.width = glow.height = size
      glow.tint = tint
      glow.blendMode = 'add'
      orb.addChild(glow)
    }
    const blast = new Container()
    blast.position.set((focus.x - 2), (focus.y - 10))
    blast.alpha = 0
    blast.scale.set(0.2)
    temporary.addChild(blast)
    // Five blazing rays make Fire Blast visually different from the flame stream.
    const tips = [[0, -105], [-112, -22], [112, -22], [-78, 96], [78, 96]]
    for (const [x, y] of tips) {
      const ray = new Graphics()
      for (const [width, color, alpha] of [[38, 0xff4917, 0.25], [19, 0xff9b24, 0.8], [6, 0xfff5b6, 1]]) {
        ray.moveTo(0, 0).lineTo(x, y).stroke({ width, color, alpha, cap: 'round' })
      }
      blast.addChild(ray)
    }
    const ring = new Graphics().circle(0, 0, 66).stroke({ width: 5, color: 0xffbd68, alpha: 0.85 })
    ring.position.copyFrom(blast.position)
    ring.alpha = 0
    temporary.addChild(ring)
    impactGlow.width = 420
    impactGlow.height = 340
    tl.to(attacker, { x: home.x - 22, duration: 0.35, ease: 'power2.inOut' }, 0)
      .to(mouthGlow, { alpha: 0.9, duration: 0.4 }, 0.1)
      .to(orb, { alpha: 1, duration: 0.28 }, 0.18)
      .fromTo(orb.scale, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8, duration: 0.4 }, 0.18)
      .to(attacker, { x: home.x + 14, duration: 0.17, ease: 'power3.out' }, 0.5)
      .to(orb, { x: (focus.x - 2), y: (focus.y - 10), duration: 0.48, ease: 'power2.in' }, 0.57)
      .to(orb.scale, { x: 1.25, y: 1.25, duration: 0.48 }, 0.57)
      .to(mouthGlow, { alpha: 0, duration: 0.25 }, 0.68)
      .set(orb, { alpha: 0 }, 1.05)
      .to(blast, { alpha: 1, duration: 0.08 }, 1.05)
      .to(blast.scale, { x: 1.05, y: 1.05, duration: 0.25, ease: 'back.out(1.5)' }, 1.05)
      .to(impactGlow, { alpha: 0.8, duration: 0.12 }, 1.05)
      .call(() => burst((focus.x - 2), (focus.y - 10), 0xffa733, 70, 330), [], 1.07)
      .to(ring, { alpha: 0.8, duration: 0.04 }, 1.08)
      .to(ring.scale, { x: 2.5, y: 2.5, duration: 0.5, ease: 'power2.out' }, 1.08)
      .to(ring, { alpha: 0, duration: 0.42 }, 1.16)
      .to(blast, { alpha: 0, duration: 0.65 }, 1.55)
      .to(blast.scale, { x: 1.25, y: 1.25, duration: 0.65 }, 1.55)
      .to(impactGlow, { alpha: 0, duration: 0.7 }, 1.4)
      .to(attacker, { x: home.x, duration: 0.3 }, 1.75)
    addHit(tl, move, 1.07, { shake: 5, recoil: 23, duration: 0.8 })
    tl.call(() => {}, [], 2.5)
  }
  fireBlast(tl,move)
}
