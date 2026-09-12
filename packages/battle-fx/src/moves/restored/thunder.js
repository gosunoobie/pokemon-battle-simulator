import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration electricMoves.js. Shapes, particle laws and choreography are move-owned.
export default function thunder(context) {
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

function glow(x, y, width, height, tint = 0xffdf72) {
    const sprite = new Sprite(glowTexture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    sprite.tint = tint
    sprite.alpha = 0
    sprite.blendMode = 'add'
    temporary.addChild(sprite)
    return sprite
  }

function strike(tl, points, { at, travel = 0.1, hold = 0.1, fade = 0.25, width = 3 }) {
    const line = new Graphics()
    line.alpha = 0
    temporary.addChild(line)
    const state = { progress: 0 }
    const draw = () => {
      line.clear()
      const limit = state.progress * (points.length - 1)
      if (limit <= 0) return
      const whole = Math.floor(limit)
      for (const [thickness, color, alpha] of [[width * 5, 0xffc533, 0.15], [width * 2, 0xffdb67, 0.8], [width, 0xffffdc, 1]]) {
        line.moveTo(...points[0])
        for (let i = 1; i <= whole; i++) line.lineTo(...points[i])
        if (whole < points.length - 1) {
          const a = points[whole]
          const b = points[whole + 1]
          const p = limit - whole
          line.lineTo(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p)
        }
        line.stroke({ width: thickness, color, alpha, cap: 'round', join: 'round' })
      }
    }
    tl.set(line, { alpha: 0.9 }, at)
      .to(state, { progress: 1, duration: travel, ease: 'none', onUpdate: draw }, at)
      .to(line, { alpha: 0, duration: fade }, at + travel + hold)
    return line
  }

function targetArcs(tl, at, width = 2.5, hold = 0.12) {
    const paths = [
      [[focus.x - 67, focus.y - 36], [focus.x - 81, focus.y - 19], [focus.x - 56, focus.y - 13], [focus.x - 71, focus.y + 9]],
      [[focus.x + 56, focus.y - 48], [focus.x + 72, focus.y - 29], [focus.x + 50, focus.y - 13], [focus.x + 65, focus.y + 2]],
      [[focus.x - 48, focus.y + 37], [focus.x - 29, floor.y - 22], [focus.x - 10, focus.y + 37], [focus.x + 9, floor.y - 21]],
    ]
    paths.forEach((points, i) => strike(tl, points, { at: at + i * 0.04, travel: 0.06, hold, fade: 0.32, width }))
  }
function thunder(tl, move) {
    const skyCharge = glow((focus.x - 5), focus.y - 175, 220, 90, 0xf3eaa5)
    tl.to(attacker, { x: home.x - 10, duration: 0.3 }, 0)
      .to(skyCharge, { alpha: 0.28, duration: 0.35 }, 0.15)
      .to(skyCharge, { alpha: 0, duration: 0.35 }, 0.84)
    strike(tl, [[focus.x - 14, focus.y - 265], [focus.x + 18, focus.y - 185], [focus.x - 24, focus.y - 146], [focus.x + 26, focus.y - 99], [focus.x - 13, focus.y - 63], [focus.x + 10, focus.y]],
      { at: 0.68, travel: 0.16, hold: 0.28, fade: 0.42, width: 7 })
    strike(tl, [[focus.x - 24, focus.y - 146], [focus.x - 70, focus.y - 107], [focus.x - 42, focus.y - 81], [focus.x - 88, focus.y - 52]],
      { at: 0.76, travel: 0.1, hold: 0.25, fade: 0.32, width: 3.5 })
    strike(tl, [[focus.x + 26, focus.y - 99], [focus.x + 72, focus.y - 70], [focus.x + 49, focus.y - 47], [focus.x + 100, focus.y - 25]],
      { at: 0.81, travel: 0.08, hold: 0.25, fade: 0.32, width: 3.5 })
    targetArcs(tl, 0.84, 3.5, 0.2)
    const ring = new Graphics().ellipse(0, 0, 85, 28).stroke({ color: 0xffed9b, width: 4, alpha: 0.85 })
    ring.position.set((focus.x + 10), (floor.y - 16))
    ring.alpha = 0
    temporary.addChild(ring)
    impactGlow.width = 440
    impactGlow.height = 310
    tl.to(ring, { alpha: 0.7, duration: 0.08 }, 0.84)
      .to(ring.scale, { x: 2, y: 2, duration: 0.55, ease: 'power2.out' }, 0.84)
      .to(ring, { alpha: 0, duration: 0.45 }, 0.94)
      .call(() => burst((focus.x + 10), (focus.y), move.tint, 60, 300), [], 0.84)
      .to(impactGlow, { alpha: 0.68, duration: 0.14 }, 0.84)
      .to(impactGlow, { alpha: 0, duration: 0.65 }, 1.26)
      .to(attacker, { x: home.x, duration: 0.3 }, 1.65)
    addHit(tl, move, 0.84, { recoil: 22, shake: 5, duration: 0.95 })
    tl.call(() => {}, [], 2.45)
  }
  thunder(tl,move)
}
