import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration electricMoves.js. Shapes, particle laws and choreography are move-owned.
export default function thunderShock(context) {
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
function thunderShock(tl, move) {
    const source = { x: home.x + 6 + emission.x, y: home.y + emission.y }
    // Incline the original zigzag/branches without changing their authored residual shape.
    const aim = ([x,y], i) => x === source.x && y === source.y ? [x,y] : [x, y + (source.y - focus.y - 11.260416666667) * (1 - Math.max(0, Math.min(1, (x-source.x) / Math.max(1, focus.x + (-3)-source.x))))]

    const charge = glow(source.x, source.y, 70, 70)
    tl.to(attacker, { x: home.x - 8, duration: 0.12 }, 0)
      .to(attacker, { x: home.x + 6, duration: 0.1 }, 0.12)
      .to(charge, { alpha: 0.5, duration: 0.12 }, 0.14)
      .to(charge, { alpha: 0, duration: 0.16 }, 0.3)
    strike(tl, [[source.x, source.y], [home.x + (focus.x - home.x) * 0.351464435146, focus.y - 4], [home.x + (focus.x - home.x) * 0.412133891213, focus.y + 30], [home.x + (focus.x - home.x) * 0.529288702929, focus.y - 12], [home.x + (focus.x - home.x) * 0.65690376569, focus.y + 18], [home.x + (focus.x - home.x) * 0.794979079498, focus.y - 15], [focus.x - 3, focus.y]].map(aim),
      { at: 0.28, travel: 0.18, hold: 0.06, fade: 0.18, width: 2.4 })
    targetArcs(tl, 0.46, 1.8, 0.05)
    tl.call(() => burst((focus.x - 3), (focus.y), move.tint, 18, 170), [], 0.46)
      .to(impactGlow, { alpha: 0.32, duration: 0.08 }, 0.46)
      .to(impactGlow, { alpha: 0, duration: 0.3 }, 0.6)
      .to(attacker, { x: home.x, duration: 0.25 }, 0.75)
    addHit(tl, move, 0.46, { recoil: 8, shake: 1, duration: 0.5 })
    tl.call(() => {}, [], 1.3)
  }
  thunderShock(tl,move)
}
