import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration fireMoves.js. Shapes, particle laws and choreography are move-owned.
export default function blazeKick(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const hopSocket=socket('foot')
  const hopY=(offset, angle)=>focus.y+offset+(71.770833333333)*Math.sin(angle)+(-33.125)*Math.cos(angle)-hopSocket.x*Math.sin(angle)-hopSocket.y*Math.cos(angle)
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
function blazeKick(tl, move) {
    const footFire = new Container()
    footFire.alpha = 0
    temporary.addChild(footFire)
    glow(footFire, 110, 90, 0xff541a, 0.8)
    glow(footFire, 56, 42, 0xffd45e)
    const followFoot = () => {
      const dx = socket('foot').x
      const dy = socket('foot').y
      const c = Math.cos(attacker.rotation)
      const s = Math.sin(attacker.rotation)
      footFire.position.set(attacker.x + dx * c - dy * s, attacker.y + dx * s + dy * c)
      footFire.rotation = attacker.rotation
    }
    followFoot()
    const sweep = new Graphics()
    for (const [width, color, alpha] of [[34, 0xff531a, 0.25], [15, 0xffa72c, 0.85], [4, 0xfff2b4, 1]]) {
      sweep.moveTo(-110, 45).quadraticCurveTo(20, 90, 44, -66)
        .stroke({ width, color, alpha, cap: 'round' })
    }
    sweep.position.set((focus.x - 8), (focus.y + 23))
    sweep.alpha = 0
    sweep.scale.y = 0.1
    temporary.addChild(sweep)

    tl.to(attacker, { x: home.x - 18, y: home.y + 5, rotation: -0.08, duration: 0.16, onUpdate: followFoot }, 0)
      .to(footFire, { alpha: 1, duration: 0.12 }, 0.12)
      .to(attacker, { x: (home.x + (focus.x - home.x) * 0.257322175732), y: hopY(40, -0.22), rotation: -0.22, duration: 0.2, ease: 'power2.out', onUpdate: followFoot }, 0.16)
      .to(attacker, { ...solveContact('foot', 0.22, {x:focus.x+(-7.7301705491141774),y:focus.y+(24.335918897456907)}), duration: 0.24, ease: 'power2.in', onUpdate: followFoot }, 0.36)
      .to(sweep, { alpha: 1, duration: 0.05 }, 0.48)
      .to(sweep.scale, { y: 1, duration: 0.12, ease: 'power2.out' }, 0.48)
      .call(() => burst((focus.x - 8), (focus.y + 23), 0xffbc4e, 32, 240), [], 0.6)
      .to(impactGlow, { alpha: 0.48, duration: 0.08 }, 0.6)
      .to(impactGlow, { alpha: 0, duration: 0.3 }, 0.74)
      .to(sweep, { alpha: 0, rotation: -0.3, duration: 0.28 }, 0.64)
      .to(footFire, { alpha: 0, duration: 0.18 }, 0.68)
      .to(attacker, { x: (home.x + (focus.x - home.x) * 0.309623430962), y: hopY(40, -0.12), rotation: -0.12, duration: 0.35, ease: 'power2.out', onUpdate: followFoot }, 0.82)
      .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: 0.33, ease: 'power1.inOut', onUpdate: followFoot }, 1.17)
    addHit(tl, move, 0.6, { recoil: 19, shake: 3, duration: 0.55 })
    tl.call(() => {}, [], 1.8)
  }
  blazeKick(tl,move)
}
