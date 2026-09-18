import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Third review of Thunder: stronger layered lightning and a broader, brighter upper-ground impact.
export const timing = Object.freeze({ contact: .84, duration: 2.65, markers: Object.freeze([
  { id: 'second-burst', label: 'Cosmetic second electrical explosion', timeSeconds: 1.4925 },
  { id: 'second-crest', label: 'Cosmetic second electrical crest', timeSeconds: 1.5825 },
  { id: 'crackle-end', label: 'Cosmetic sustained crackle starts fading', timeSeconds: 2.1975 },
  { id: 'second-fade', label: 'Cosmetic second electrical fade ends', timeSeconds: 2.50 },
]) })

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
    tl.call(() => {}, [], 2.65)
  }
  thunder(tl,move)

  // An upper half-dome rises from the visible feet. The earlier bolt is still
  // the only result cue; every late line, glow and mote stays above this ground.
  const second = new Container(); second.label = 'thunder-second-impact'; temporary.addChild(second)
  const discharge = new Graphics(); discharge.label = 'thunder-second-discharge'; discharge.blendMode = 'add'; second.addChild(discharge)
  const flecks = new Graphics(); flecks.label = 'thunder-second-sparks'; second.addChild(flecks)
  const localX = x => (x - temporary.x) / temporary.scale.x
  const bounds = { left: Math.min(localX(0), localX(context.scene.width)) + 5,
    right: Math.max(localX(0), localX(context.scene.width)) - 5,
    top: -temporary.y / unit + 5, bottom: (context.scene.height - temporary.y) / unit - 5 }
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x))
  const onset = 1.4925, crest = 1.5825, crackleEnd = 2.1975, fadeEnd = 2.50
  const boltLengths = [.53, .86, .62, .98, .72, .91, .57, .8, .66, 1, .49]
  const boltWeights = [1.0, 2.5, 1.25, 4.0, 1.5, 3.1, 1.1, 2.8, 1.4, 3.7, 1.05]
  const dome = (rx, ry, color, alpha) => {
    discharge.moveTo(-rx, -2).bezierCurveTo(-rx, -ry * .56, -rx * .56, -ry, 0, -ry)
      .bezierCurveTo(rx * .56, -ry, rx, -ry * .56, rx, -2).closePath().fill({ color, alpha })
  }
  onFrame(time => {
    discharge.clear(); flecks.clear()
    second.alpha = time >= onset && time < fadeEnd ? 1 : 0
    if (!second.alpha) return
    const live = targetSocket('visualCenter', true)
    const ground = { x: clamp(live.x, bounds.left + 5, bounds.right - 5),
      y: clamp(live.y + context.target.metrics.height / unit / 2, bounds.top + 8, bounds.bottom) }
    second.position.copyFrom(ground)
    const radiusX = Math.max(1, Math.min(215, ground.x - bounds.left - 4, bounds.right - ground.x - 4))
    const radiusY = Math.max(1, Math.min(225, radiusX * 1.14, ground.y - bounds.top - 4))
    const age = time - onset, rise = clamp(age / (crest - onset), 0, 1)
    const fade = time <= crackleEnd ? 1 : clamp((fadeEnd - time) / (fadeEnd - crackleEnd), 0, 1)
    const swell = .25 + .75 * rise
    const intensity = (time < crest ? .25 + .75 * rise : .42 + .58 * Math.exp(-(time - crest) * 8)) * fade
    // Nested translucent domes produce a soft rim without a solid half-disc.
    for (let i = 0; i < 18; i++) {
      const size = (.98 - i * .043) * swell
      dome(radiusX * size, radiusY * size, i < 8 ? 0xffbd36 : 0xffec9a, intensity * (.015 + i * .0019))
    }
    dome(radiusX * .29 * swell, radiusY * .34 * swell, 0xfff1a8, intensity * .4)
    dome(radiusX * .13 * swell, radiusY * .17 * swell, 0xffffdf, intensity * .86)
    dome(radiusX * .055 * swell, radiusY * .078 * swell, 0xffffff, intensity * .96)
    for (let i = 0; i < boltLengths.length; i++) {
      const angle = -Math.PI + .16 + i / (boltLengths.length - 1) * (Math.PI - .32)
      const length = boltLengths[i] * swell
      // The original electric recipes separate an amber halo, yellow body and ivory core.
      const weight = boltWeights[i], strokeMargin = weight * 2.3 + 1.5
      const root = { x: Math.sin(i * 2.3) * radiusX * .047, y: -strokeMargin }
      const shimmer = Math.sin(time * 32 + i * 1.7), flicker = .7 + .3 * Math.sin(time * 26 + i * 2.1) ** 2
      const at = (p, bend) => ({
        x: clamp(root.x + Math.cos(angle) * radiusX * length * p + Math.sin(angle) * radiusX * bend, -radiusX + strokeMargin, radiusX - strokeMargin),
        y: clamp(root.y + Math.sin(angle) * radiusY * length * p - Math.cos(angle) * radiusY * bend, -radiusY + strokeMargin, -strokeMargin),
      })
      const points = [root, at(.27, .035), at(.46, -.026), at(.68, .025 + shimmer * .006), at(.94, -.006)]
      for (const [width, color, alpha] of [[weight * 4.6, 0xffbd33, .16], [weight * 2, 0xffdf70, .8], [weight, 0xffffe8, 1]]) {
        discharge.moveTo(points[0].x, points[0].y)
        points.slice(1).forEach(point => discharge.lineTo(point.x, point.y))
        discharge.stroke({ width, color, alpha: alpha * flicker * intensity, cap: 'round', join: 'round' })
        if (i % 2 === 0) {
          const branch = at(.81, i % 4 ? -.1 : .1)
          discharge.moveTo(points[2].x, points[2].y).lineTo(branch.x, Math.min(-strokeMargin, branch.y))
            .stroke({ width: width * .62, color, alpha: alpha * .8 * flicker * intensity, cap: 'round' })
        }
      }
    }
    for (let i = 0; i < 36; i++) {
      const birth = onset + i / 35 * (crackleEnd - onset - .045), life = .32, particleAge = time - birth
      if (particleAge < 0 || particleAge > life) continue
      const phase = particleAge / life, angle = -Math.PI + .12 + ((i * .61803398875) % 1) * (Math.PI - .24)
      const x = Math.cos(angle) * radiusX * phase * (.55 + i % 3 * .12)
      const y = Math.sin(angle) * radiusY * phase * .78 + radiusY * .34 * phase * phase
      // Motes are extinguished on meeting the ground, never clamped below it.
      const size = 1.2 + i % 3 * .3
      if (y + size >= -2) continue
      flecks.circle(x, y, size).fill({ color: i % 2 ? 0xfffff2 : 0xffd85f, alpha: (1 - phase) * fade * .92 })
    }
  })

}
