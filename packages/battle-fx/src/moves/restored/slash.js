import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function slash(context) {
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

function slash(tl, move) {
    tl.to(attacker, { x: home.x - 20, duration: 0.16, ease: 'power2.in' }, 0)
      .to(attacker, { ...solveContact('tackle', 0, {x:focus.x+(-56.75),y:focus.y+(13.46875)}), duration: 0.22, ease: 'power3.in' }, 0.16)
    for (let i = 0; i < 3; i++) {
      const claw = new Graphics()
      // Parallel curved streaks, with a broad glow behind each bright core.
      for (const [width, alpha] of [[24, 0.13], [12, 0.45], [4, 1]]) {
        claw.moveTo(-54, -65).quadraticCurveTo(-6, -3, 43, 68)
          .stroke({ width, color: 0xf1ffe8, alpha, cap: 'round' })
      }
      claw.position.set((focus.x - 29) + i * 33, (focus.y - 25))
      claw.alpha = 0
      claw.scale.y = 0.05
      temporary.addChild(claw)
      const at = 0.38 + i * 0.075
      tl.to(claw, { alpha: 1, duration: 0.035 }, at)
        .to(claw.scale, { y: 1, duration: 0.14, ease: 'power3.out' }, at)
        .to(claw, { alpha: 0, x: claw.x + 16, y: (focus.y - 5), duration: 0.32 }, at + 0.17)
    }
    tl.call(() => burst((focus.x), (focus.y - 5), move.tint, 24, 190), [], 0.43)
      .to(impactGlow, { alpha: 0.45, duration: 0.1 }, 0.4)
      .to(impactGlow, { alpha: 0, duration: 0.25 }, 0.52)
      .to(attacker, { x: home.x, y: home.y, duration: 0.38, ease: 'power2.out' }, 0.84)
    addHit(tl, move, 0.43, { shake: 2, recoil: 11, duration: 0.5 })
    tl.call(() => {}, [], 1.45)
  }
  slash(tl,move)
}
