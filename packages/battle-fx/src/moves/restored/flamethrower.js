import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function flamethrower(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const jetRatio = Math.max(.1, (focus.x - emission.x) / 381.385416666667)
  const jetSlope = (focus.y - emission.y) / Math.max(1, focus.x - emission.x) - (-11.260416666667 / 381.385416666667)
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

  function spawnParticle() {
    const p = new Sprite(glowTexture)
    const ember = random() < 0.22
    const hot = random() < 0.3
    p.anchor.set(0.5)
    p.position.set(mouthGlow.x + random() * 10, mouthGlow.y + (random() - 0.5) * 12)
    p.tint = hot ? 0xffedaa : random() < 0.5 ? 0xffad25 : 0xff4610
    p.blendMode = 'add'
    const size = ember ? 6 + random() * 9 : 28 + random() * 29
    p.width = size * (ember ? 2 : 1.6)
    p.height = size * 0.75
    temporary.addChild(p)
    const life = 0.6 + random() * 0.24, vx = (510 + random() * 190) * jetRatio
    particles.push({ sprite: p, age: 0, life, vx, vy: 20 + (random() - 0.5) * 95 + jetSlope * vx, size, ember, phase: random() * 6.28 })
  }

  const particles = []

  let particleTime = 0
  onFrame(time => {
    const dt = Math.max(0, Math.min(time - particleTime, .05)); particleTime=time
    mouthGlow.position.copyFrom(socket('emission',true)); spawnCarry+=emitter.strength*180*dt;while(spawnCarry>=1){spawnParticle();spawnCarry--}
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

function flamethrower(timeline, move, hp) {
    timeline
        .to(attacker, { x: home.x - 16, duration: 0.28, ease: 'power2.inOut' }, 0)
        .to(mouthGlow, { alpha: 0.7, duration: 0.28 }, 0.1)
        .to(attacker, { x: home.x + 12, duration: 0.18, ease: 'power3.out' }, 0.28)
        .to(emitter, { strength: 1, duration: 0.12 }, 0.36)
        .to(mouthGlow, { alpha: 1, duration: 0.15 }, 0.36)
        .to(impactGlow, { alpha: 0.85, duration: 0.22 }, 0.85)
        .to(emitter, { strength: 0, duration: 0.22 }, 1.6)
        .to(mouthGlow, { alpha: 0, duration: 0.28 }, 1.6)
        .to(impactGlow, { alpha: 0, duration: 0.65 }, 1.8)
        .to(attacker, { x: home.x, duration: 0.3, ease: 'power2.out' }, 1.85)
        .set(defender, { x: defenderHome.x }, 1.85)
        .set(world, { x: 0, y: 0 }, 1.85)
        .call(() => {}, [], 2.65)
    addHit(timeline, move, 0.9, { duration: 0.85 })
  }
  flamethrower(tl,move)
}
