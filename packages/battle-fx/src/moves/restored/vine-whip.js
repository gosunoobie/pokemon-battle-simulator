import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function vineWhip(context) {
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

function vineWhip(tl, move) {
    const source = socket(context.source.hasAnchor?.('vine') ? 'vine' : 'emission')
    const target = { x: (focus.x), y: (focus.y - 2) }
    tl.to(attacker, { x: home.x - 12, rotation: -0.035, duration: 0.18 }, 0)
      .to(attacker, { x: home.x + 10, rotation: 0.025, duration: 0.15, ease: 'power2.out' }, 0.18)

    for (let i = 0; i < 2; i++) {
      const vine = new Graphics()
      const direction = i === 0 ? -1 : 1
      const state = { reach: 0 }
      const at = 0.3 + i * 0.08
      const contact = at + 0.37
      vine.alpha = 0
      temporary.addChild(vine)
      const drawVine = () => {
        const p = state.reach
        const endX = source.x + (target.x - source.x) * p
        const endY = source.y + (target.y + direction * 13 - source.y) * p
        const span = endX - source.x
        const bow = direction * (28 + 80 * (1 - p)) * p
        vine.clear()
        // Layered cubic curves keep the tendril solid while its tip extends and retracts.
        for (const [width, color, alpha] of [[13, 0x284b2e, 1], [8, i ? 0x74b85c : 0x568f43, 1], [2.5, 0xd3f2a2, 0.8]]) {
          vine.moveTo(source.x, source.y)
            .bezierCurveTo(source.x + span * 0.28, source.y + bow, source.x + span * 0.72, endY + bow, endX, endY)
            .stroke({ width, color, alpha, cap: 'round' })
        }
      }
      tl.to(vine, { alpha: 1, duration: 0.05 }, at)
        .to(state, { reach: 1, duration: 0.37, ease: 'power3.out', onUpdate: drawVine }, at)
        .call(() => burst(target.x, target.y + direction * 13, move.tint, 12, 155), [], contact)
        .to(state, { reach: 0, duration: 0.3, ease: 'power2.in', onUpdate: drawVine }, contact + 0.2)
        .to(vine, { alpha: 0, duration: 0.06 }, contact + 0.44)
    }
    tl.to(impactGlow, { alpha: 0.35, duration: 0.09 }, 0.67)
      .to(impactGlow, { alpha: 0, duration: 0.3 }, 0.87)
      .to(attacker, { x: home.x, rotation: 0, duration: 0.35, ease: 'power2.out' }, 1.05)
    addHit(tl, move, 0.67, { shake: 2, recoil: 12, duration: 0.55 })
    tl.call(() => {}, [], 1.9)
  }
  vineWhip(tl,move)
}
