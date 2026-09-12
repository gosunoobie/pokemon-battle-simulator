import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration fireMoves.js. Shapes, particle laws and choreography are move-owned.
export default function eruption(context) {
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
function eruption(tl, move) {
    const source = socket('vent')
    const vent = glow(temporary, 135, 205, 0xff681d, 0)
    vent.position.set(source.x, source.y - 40)
    tl.to(attacker, { y: home.y + 7, duration: 0.22 }, 0)
      .to(attacker, { y: home.y - 8, duration: 0.2, ease: 'power2.out' }, 0.22)
      .to(vent, { alpha: 0.55, duration: 0.18 }, 0.28)
      .to(vent, { alpha: 0, height: 265, y: source.y - 70, duration: 0.5 }, 0.76)

    for (let i = 0; i < 9; i++) {
      const lava = new Container()
      const lane = (i % 3) - 1
      const target = { x: (focus.x) + lane * 24, y: (focus.y) + lane * 12 }
      const at = 0.46 + i * 0.07
      const duration = 0.65 + (i % 3) * 0.04
      const height = 130 + (i % 3) * 15
      const state = { progress: 0 }
      lava.position.set(source.x, source.y)
      lava.alpha = 0
      temporary.addChild(lava)
      glow(lava, 58, 74, 0xff4818, 0.85)
      glow(lava, 31, 39, 0xffba39)
      glow(lava, 12, 16, 0xfff0af)
      tl.to(lava, { alpha: 1, duration: 0.04 }, at)
        .to(state, {
          progress: 1, duration, ease: 'none',
          onUpdate: () => {
            const p = state.progress
            lava.x = source.x + (target.x - source.x) * p
            lava.y = source.y + (target.y - source.y) * p - 4 * height * p * (1 - p)
            // Align the elongated ember with the tangent of its ballistic-looking arc.
            lava.rotation = Math.atan2(target.y - source.y - 4 * height * (1 - 2 * p), target.x - source.x) - Math.PI / 2
          },
        }, at)
        .set(lava, { alpha: 0 }, at + duration)
        .call(() => burst(target.x, target.y, 0xffb13c, 9, 165), [], at + duration)
    }
    tl.to(impactGlow, { alpha: 0.58, duration: 0.12 }, 1.11)
      .to(impactGlow, { alpha: 0, duration: 0.55 }, 1.8)
      .to(attacker, { y: home.y, duration: 0.35 }, 1.15)
    addHit(tl, move, 1.11, { recoil: 18, shake: 4, duration: 0.9 })
    tl.call(() => {}, [], 2.85)
  }
  eruption(tl,move)
}
