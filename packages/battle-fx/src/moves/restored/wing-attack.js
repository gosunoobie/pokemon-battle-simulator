import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration battle.js. Shapes, particle laws and choreography are move-owned.
export default function wingAttack(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const hopSocket=socket('tackle')
  const hopY=(offset, angle)=>focus.y+offset+(66.25)*Math.sin(angle)+(-74.53125)*Math.cos(angle)-hopSocket.x*Math.sin(angle)-hopSocket.y*Math.cos(angle)
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

function wingAttack(tl, move) {
    for (let i = 0; i < 3; i++) {
      const ghost = captureActor()
      ghost.anchor.set(0.5, 1)
      ghost.scale.set(sourceBaseScale)
      ghost.tint = 0xb2eaff
      ghost.alpha = 0
      temporary.addChild(ghost)
      tl.call(() => {
        ghost.position.copyFrom(attacker.position)
        ghost.rotation = attacker.rotation
      }, [], 0.33 + i * 0.075)
        .to(ghost, { alpha: 0.18, duration: 0.03 }, 0.33 + i * 0.075)
        .to(ghost, { alpha: 0, duration: 0.25 }, 0.39 + i * 0.075)
    }
    const gusts = new Container()
    gusts.position.set((focus.x - 2), (focus.y - 3))
    gusts.alpha = 0
    temporary.addChild(gusts)
    for (let i = 0; i < 3; i++) {
      const arc = new Graphics().moveTo(-112, -30 + i * 24)
        .quadraticCurveTo(0, -110 + i * 30, 104, -15 + i * 24)
        .stroke({ color: i === 1 ? 0xf3ffff : 0x9fe8ff, width: i === 1 ? 8 : 4, alpha: 0.9, cap: 'round' })
      gusts.addChild(arc)
    }
    tl.to(attacker, { x: (home.x + 93), y: hopY(35, -0.14), rotation: -0.14, duration: 0.3, ease: 'power2.out' }, 0)
      .to(attacker, { ...solveContact('tackle', 0.18, {x:focus.x+(-8.47705745839346),y:focus.y+(16.533609011346186)}), duration: 0.26, ease: 'power2.in' }, 0.3)
      .to(gusts, { alpha: 1, rotation: 0.3, duration: 0.14 }, 0.48)
      .to(gusts.scale, { x: 1.35, y: 1.35, duration: 0.38 }, 0.48)
      .to(gusts, { alpha: 0, rotation: 0.8, duration: 0.32 }, 0.65)
      .call(() => burst((focus.x - 2), (focus.y - 5), move.tint, 34, 290), [], 0.54)
      .to(impactGlow, { alpha: 0.5, duration: 0.1 }, 0.53)
      .to(impactGlow, { alpha: 0, duration: 0.35 }, 0.68)
      .to(attacker, { x: (home.x + (focus.x - home.x) * 0.31589958159), y: hopY(37, -0.12), rotation: -0.12, duration: 0.32, ease: 'power1.out' }, 0.78)
      .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: 0.34, ease: 'power1.inOut' }, 1.1)
    addHit(tl, move, 0.55, { shake: 3, recoil: 18 })
    tl.call(() => {}, [], 1.7)
  }
  wingAttack(tl,move)
}
