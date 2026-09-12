import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration psychicGhostMoves.js. Shapes, particle laws and choreography are move-owned.
export default function shadowBall(context) {
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

function glow(x, y, width, height, tint, alpha = 0, blendMode = 'add') {
    const sprite = new Sprite(glowTexture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    sprite.tint = tint
    sprite.alpha = alpha
    sprite.blendMode = blendMode
    temporary.addChild(sprite)
    return sprite
  }
function shadowBall(tl, move) {
    const orb = new Container()
    orb.alpha = 0
    orb.scale.set(0.2)
    temporary.addChild(orb)
    orb.addChild(glow(0, 0, 120, 100, 0x914bdd, 0.65))
    orb.addChild(new Graphics().circle(0, 0, 25).fill(0x191129))
    for (let i = 0; i < 2; i++) {
      const swirl = new Graphics().ellipse(0, 0, 28, 12)
        .stroke({ color: i ? 0x9462d1 : 0xcc95ff, width: 2.5, alpha: 0.85 })
      swirl.rotation = i * Math.PI / 2 + 0.6
      orb.addChild(swirl)
    }
    const followSource = () => orb.position.set(attacker.x + emission.x, attacker.y + emission.y)
    followSource()
    const source = { x: home.x + 10 + emission.x, y: home.y + emission.y }
    const target = { x: (focus.x + 1), y: (focus.y) }
    const flight = { progress: 0 }
    tl.to(attacker, { x: home.x - 12, duration: 0.25, onUpdate: followSource }, 0)
      .to(attacker, { x: home.x + 10, duration: 0.25, onUpdate: followSource }, 0.25)
      .to(orb, { alpha: 1, duration: 0.16 }, 0.1)
      .to(orb.scale, { x: 1, y: 1, duration: 0.4 }, 0.1)
      .to(orb, { rotation: -Math.PI * 2, duration: 1.05, ease: 'none' }, 0.05)
      .to(flight, { progress: 1, duration: 0.55, ease: 'power2.in', onUpdate: () => {
        const p = flight.progress
        orb.position.set(source.x + (target.x - source.x) * p, source.y + (target.y - source.y) * p - 45 * Math.sin(Math.PI * p))
      } }, 0.55)
      .to(orb.scale, { x: 1.2, y: 1.2, duration: 0.55 }, 0.55)
      .set(orb, { alpha: 0 }, 1.1)
      .to(attacker, { x: home.x, duration: 0.3 }, 1.45)
    for (let i = 0; i < 12; i++) {
      const at = 0.58 + i * 0.035
      const smoke = glow(0, 0, 35, 30, 0x634080, 0, 'normal')
      const origin = { x: 0, y: 0 }
      const drift = { progress: 0 }
      tl.call(() => { origin.x = orb.x; origin.y = orb.y; smoke.position.set(origin.x, origin.y) }, [], at)
        .to(smoke, { alpha: 0.32, duration: 0.08 }, at)
        .to(drift, { progress: 1, duration: 0.43, ease: 'none', onUpdate: () => {
          const p = drift.progress
          smoke.position.set(origin.x - 25 * p, origin.y + (-10 + i % 3 * 8) * p)
          smoke.width = 35 + 45 * p
          smoke.height = 30 + 25 * p
        } }, at)
        .to(smoke, { alpha: 0, duration: 0.35 }, at + 0.08)
    }
    const cloud = glow(target.x, target.y, 240, 180, 0x321847, 0, 'normal')
    const ring = new Graphics().circle(0, 0, 45).stroke({ color: 0xa684ed, width: 3, alpha: 0.9 })
    ring.position.set(target.x, target.y)
    ring.alpha = 0
    ring.scale.set(0.35)
    temporary.addChild(ring)
    tl.to(cloud, { alpha: 0.5, duration: 0.1 }, 1.1)
      .to(cloud, { width: 330, height: 250, duration: 0.4 }, 1.1)
      .to(cloud, { alpha: 0, duration: 0.5 }, 1.25)
      .to(ring, { alpha: 0.75, duration: 0.08 }, 1.1)
      .to(ring.scale, { x: 2.1, y: 2.1, duration: 0.5, ease: 'power2.out' }, 1.1)
      .to(ring, { alpha: 0, duration: 0.45 }, 1.2)
      .call(() => burst(target.x, target.y, move.tint, 32, 230), [], 1.1)
      .to(impactGlow, { alpha: 0.32, duration: 0.12 }, 1.1)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 1.35)
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      const wisp = glow(target.x, target.y, 32, 24, 0x765496, 0, 'normal')
      tl.to(wisp, { alpha: 0.45, duration: 0.08 }, 1.1)
        .to(wisp, { x: target.x + Math.cos(angle) * 120, y: target.y + Math.sin(angle) * 80 + 10, width: 65, height: 45, duration: 0.58, ease: 'power2.out' }, 1.1)
        .to(wisp, { alpha: 0, duration: 0.45 }, 1.23)
    }
    addHit(tl, move, 1.1, { recoil: 16, shake: 3, duration: 0.7 })
    tl.call(() => {}, [], 2.35)
  }
  shadowBall(tl,move)
}
