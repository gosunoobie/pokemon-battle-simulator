import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration psychicGhostMoves.js. Shapes, particle laws and choreography are move-owned.
export default function psychic(context) {
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
function psychic(tl, move) {
    const focus = glow(0, 0, 100, 120, 0xff97dc)
    const followSource = () => focus.position.set(attacker.x + emission.x, attacker.y + emission.y)
    followSource()
    const field = new Container()
    field.alpha = 0
    temporary.addChild(field)
    const aura = glow(0, 0, 230, 190, 0xe76cdf, 0.22)
    field.addChild(aura)
    const followTarget = () => field.position.set(targetSocket('center').x + defender.x - defenderHome.x, targetSocket('center').y + defender.y - defenderHome.y)
    followTarget()
    for (let i = 0; i < 3; i++) {
      const ring = new Graphics().ellipse(0, 0, 80 + i * 12, 56 + i * 8)
        .stroke({ color: i === 1 ? 0xffb8e9 : 0xd799ff, width: 3, alpha: 0.75 })
      ring.rotation = i * Math.PI / 3
      field.addChild(ring)
      tl.to(ring, { rotation: ring.rotation + Math.PI / 2, duration: 1.4, ease: 'none' }, 0.35)
    }
    tl.to(attacker, { x: home.x - 6, duration: 0.25, onUpdate: followSource }, 0)
      .to(focus, { alpha: 0.55, duration: 0.3 }, 0.12)
      .to(field, { alpha: 0.7, duration: 0.3 }, 0.3)
      .to(defender, { y: defenderHome.y - 32, rotation: -0.045, duration: 0.45, ease: 'power1.inOut', onUpdate: followTarget }, 0.4)
      .to(defender, { rotation: 0.045, duration: 0.42, ease: 'power1.inOut', onUpdate: followTarget }, 0.85)
      .to(field.scale, { x: 0.78, y: 0.78, duration: 0.18 }, 0.85)
      .to(field.scale, { x: 1.18, y: 1.18, duration: 0.28 }, 1.03)
      .to(field.scale, { x: 1, y: 1, duration: 0.22 }, 1.31)
      .call(() => burst(targetSocket('center').x + defender.x - defenderHome.x, targetSocket('center').y + defender.y - defenderHome.y, move.tint, 20, 150), [], 0.95)
      .to(impactGlow, { alpha: 0.25, duration: 0.12 }, 0.95)
      .to(impactGlow, { alpha: 0, duration: 0.35 }, 1.3)
      .to(focus, { alpha: 0, duration: 0.35 }, 1.25)
      .to(defender, { y: defenderHome.y, rotation: 0, duration: 0.45, ease: 'power1.inOut', onUpdate: followTarget }, 1.4)
      .to(field, { alpha: 0, duration: 0.4 }, 1.45)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: followSource }, 1.65)
    // The local reaction owns x recoil and tint; this handler exclusively owns lift/tilt.
    addHit(tl, move, 0.95, { recoil: 0, shake: 1, duration: 0.7 })
    tl.call(() => {}, [], 2.15)
  }
  psychic(tl,move)
}
