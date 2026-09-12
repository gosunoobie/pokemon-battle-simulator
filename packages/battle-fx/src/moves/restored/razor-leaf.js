import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function razorLeaf(context) {
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

function razorLeaf(tl, move) {
    const origin = socket('leaf')
    const target = { x: (focus.x - 1), y: (focus.y - 2) }
    const palette = [0xc6f38c, 0x83c74b, 0xe0f5a1]
    const leafCount = 12

    tl.to(attacker, { x: home.x - 14, rotation: -0.045, duration: 0.2 }, 0)
      .to(attacker, { x: home.x + 9, rotation: 0.025, duration: 0.18, ease: 'power2.out' }, 0.2)

    for (let i = 0; i < leafCount; i++) {
      // A local SVG icon supplies the leaf silhouette; all movement belongs to this timeline.
      const leaf = new Sprite(assets.leaf)
      const lane = (i % 3) - 1
      const size = 27 + (i % 4) * 4
      const start = 0.28 + i * 0.045
      const flight = 0.47 + (i % 3) * 0.025
      const state = { progress: 0 }
      const startY = origin.y + lane * 16
      const endY = target.y + lane * 20
      const bow = lane * 70 + (i % 2 === 0 ? -25 : 25)
      const spin = (i % 2 === 0 ? 1 : -1) * Math.PI * 3
      leaf.anchor.set(0.5)
      leaf.position.set(origin.x, startY)
      leaf.width = leaf.height = size
      leaf.tint = palette[i % palette.length]
      leaf.rotation = i * 0.8
      leaf.alpha = 0
      temporary.addChild(leaf)

      tl.to(leaf, { alpha: 1, duration: 0.06 }, start)
        .to(state, {
          progress: 1,
          duration: flight,
          ease: 'power1.in',
          onUpdate: () => {
            const p = state.progress
            leaf.x = origin.x + (target.x - origin.x) * p
            leaf.y = startY + (endY - startY) * p + Math.sin(p * Math.PI) * bow
            leaf.rotation = i * 0.8 + p * spin
            // Foreshortening gives the impression of a blade turning edge-on.
            leaf.width = size * (0.45 + 0.55 * Math.abs(Math.cos(p * Math.PI * 3)))
          },
        }, start)
        .call(() => burst(target.x, endY, palette[i % palette.length], 5, 145), [], start + flight)
        .to(leaf, { alpha: 0, duration: 0.09 }, start + flight)
    }

    tl.to(impactGlow, { alpha: 0.4, duration: 0.12 }, 0.75)
      .to(impactGlow, { alpha: 0, duration: 0.42 }, 1.3)
      .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: 0.32, ease: 'power2.out' }, 1.22)
    addHit(tl, move, 0.75, { shake: 2, recoil: 12, duration: 0.75 })
    // The final leaf lands at 1.295 s; its longest-lived impact particles end by 1.995 s.
    tl.call(() => {}, [], 2.15)
  }
  razorLeaf(tl,move)
}
