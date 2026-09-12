import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration fireMoves.js. Shapes, particle laws and choreography are move-owned.
export default function overheat(context) {
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
function overheat(tl, move) {
    const sourceRatio = context.source.metrics.height / 229.114583333333 / unit
    const aura = glow(temporary, 205 * sourceRatio, 265 * sourceRatio, 0xff4a18, 0)
    const followBody = () => aura.position.copyFrom(socket('aura', true))
    followBody()
    const source = { x: home.x + 12 + emission.x, y: home.y + emission.y }
    const target = { x: (focus.x), y: (focus.y - 2) }
    impactGlow.width = 380
    impactGlow.height = 280

    tl.to(attacker, { x: home.x - 16, duration: 0.42, onUpdate: followBody }, 0)
      .to(aura, { alpha: 0.55, duration: 0.45 }, 0.05)
      .to(attacker, { x: home.x + 12, duration: 0.16, ease: 'power2.out', onUpdate: followBody }, 0.42)
      .to(aura, { alpha: 0, duration: 0.4 }, 0.82)

    for (let i = 0; i < 3; i++) {
      const wave = new Container()
      wave.position.set(source.x, source.y)
      wave.alpha = 0
      wave.scale.set(0.4, 0.45)
      temporary.addChild(wave)
      glow(wave, 120, 160, i === 1 ? 0xffa62f : 0xff571c, 0.5)
      const crest = new Graphics()
      for (const [width, color, alpha] of [[32, 0xff4817, 0.24], [12, 0xffa62f, 0.8], [4, 0xfff1ad, 1]]) {
        crest.moveTo(-10, -65).quadraticCurveTo(62, 0, -10, 65)
          .stroke({ width, color, alpha, cap: 'round' })
      }
      wave.addChild(crest)
      const at = 0.58 + i * 0.09
      tl.to(wave, { alpha: 0.9, duration: 0.05 }, at)
        .to(wave, { x: target.x, y: target.y, duration: 0.4, ease: 'power2.in' }, at)
        .to(wave.scale, { x: 1.5, y: 1.55, duration: 0.4 }, at)
        .to(wave, { alpha: 0, duration: 0.32 }, at + 0.4)
    }
    for (let i = 0; i < 4; i++) {
      const smoke = glow(temporary, 42, 42, 0xb9aaa0, 0)
      smoke.blendMode = 'normal'
      smoke.position.set(socket('smoke').x + i * 14, socket('smoke').y)
      const at = 1.3 + i * 0.06
      tl.to(smoke, { alpha: 0.17, duration: 0.1 }, at)
        .to(smoke, { y: smoke.y - 55, x: smoke.x + 18, width: 82, height: 82, duration: 0.55 }, at)
        .to(smoke, { alpha: 0, duration: 0.35 }, at + 0.2)
    }
    tl.call(() => burst(target.x, target.y, 0xffb151, 50, 260), [], 0.98)
      .to(impactGlow, { alpha: 0.68, duration: 0.12 }, 0.98)
      .to(impactGlow, { alpha: 0, duration: 0.6 }, 1.25)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: followBody }, 1.65)
    addHit(tl, move, 0.98, { recoil: 21, shake: 4, duration: 0.85 })
    tl.call(() => {}, [], 2.5)
  }
  overheat(tl,move)
}
